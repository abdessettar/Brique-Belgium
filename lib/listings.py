"""Per-listing extracts for the Explorer page, written as Parquet to stdout.

Cloudflare Pages rejects any file over 25 MiB, so the output is split by transaction type and
the build fails if either file exceeds the limit. Only the last 24 months are included; the
aggregate JSON files carry the full history.
"""
from __future__ import annotations

import io
import sys

import pyarrow as pa
import pyarrow.parquet as pq

import bq
import sql as S

MONTHS_BACK = 24
MAX_BYTES = 25 * 1024 * 1024  # Cloudflare Pages per-file limit


def _sql(kind: str) -> str:
    tables = S.SALE_TABLES if kind == "sale" else S.RENT_TABLES
    filters = S.SALE_FILTERS if kind == "sale" else S.RENT_FILTERS
    price = S.SALE_PRICE if kind == "sale" else S.RENT_PRICE
    return f"""
WITH latest AS ({S.union_dedup(tables)}),
base AS (
  SELECT CAST(id AS INT64) AS id,
         {S.PROPERTY_CLASS} AS class,
         property_subtype AS subtype,
         {S.REGION} AS region,
         {S.PROVINCE_EN} AS province,
         property_location_locality AS locality,
         {S.POSTAL} AS postal,
         {price} AS price,
         {S.SURFACE} AS surface,
         SAFE_CAST(property_bedroomCount AS INT64) AS bedrooms,
         IF(transaction_certificates_epcScore IN
              ('A++','A+','A','B','C','D','E','F','G'),
            transaction_certificates_epcScore, NULL) AS epc,
         SAFE_CAST(property_building_constructionYear AS INT64) AS year_built,
         SAFE_CAST(property_location_latitude AS FLOAT64) AS lat,
         SAFE_CAST(property_location_longitude AS FLOAT64) AS lon,
         {S.LISTING_MONTH} AS month,
         SAFE_CAST(statistics_viewCount AS INT64) AS views,
         {S.DAYS_LISTED} AS days_listed
  FROM latest
  WHERE {filters}
    AND {S.LISTING_MONTH} >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(),
                                                           INTERVAL {MONTHS_BACK} MONTH))
)
SELECT id, class, subtype, region, province, locality, postal, price, surface,
       IF(surface BETWEEN {S.SURF_MIN} AND {S.SURF_MAX},
          CAST(ROUND(price / surface) AS INT64), NULL) AS eur_m2,
       bedrooms, epc, year_built, lat, lon, month, views,
       IF(days_listed >= 3 AND views > 0, ROUND(views / days_listed, 1), NULL) AS views_per_day
FROM base
WHERE class != 'Multi-unit'
"""


# Explicit schema: the REST API returns untyped JSON, and inferring types from the first row
# would make a column null typed whenever that row is empty.
_SCHEMA = pa.schema([
    ("id", pa.int64()), ("class", pa.string()), ("subtype", pa.string()),
    ("region", pa.string()), ("province", pa.string()), ("locality", pa.string()),
    ("postal", pa.int32()), ("price", pa.int32()), ("surface", pa.int32()),
    ("eur_m2", pa.int32()), ("bedrooms", pa.int16()), ("epc", pa.string()),
    ("year_built", pa.int16()), ("lat", pa.float32()), ("lon", pa.float32()),
    ("month", pa.string()), ("views", pa.int32()), ("views_per_day", pa.float32()),
])


def build(kind: str) -> None:
    rows = bq.query(_sql(kind), label=f"listings-{kind}")
    if not rows:
        raise SystemExit(f"listings-{kind}: query returned no rows")

    columns = {f.name: [r.get(f.name) for r in rows] for f in _SCHEMA}
    table = pa.table(columns, schema=_SCHEMA)

    buf = io.BytesIO()
    # Most of the saving comes from dictionary encoding: locality, province, epc and month are
    # low cardinality strings repeated across hundreds of thousands of rows.
    pq.write_table(table, buf, compression="zstd", compression_level=9,
                   use_dictionary=True, row_group_size=50_000)
    data = buf.getvalue()

    mb = len(data) / 1024 / 1024
    if len(data) > MAX_BYTES:
        raise SystemExit(
            f"listings-{kind}.parquet is {mb:.1f} MiB, over the {MAX_BYTES / 1024 / 1024:.0f} MiB "
            f"Cloudflare Pages per-file limit. Reduce MONTHS_BACK or shard further."
        )
    bq.log(f"  [listings-{kind}] {len(rows):,} rows, {mb:.1f} MiB")
    sys.stdout.buffer.write(data)
