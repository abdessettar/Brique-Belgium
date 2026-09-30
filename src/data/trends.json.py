"""Monthly price series by region and property class, plus an index rebased to 2023-01.

Keyed on publication_creationDate, so the x axis is when a property was listed rather than when
it was observed. Each point carries its sample count so the pages can drop thin months.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

MIN_N = 40  # below this a monthly median is too noisy to plot

SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES)}),
base AS (
  SELECT {S.LISTING_MONTH} AS month, {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         {S.SALE_PRICE} AS price, {S.SURFACE} AS surface
  FROM latest WHERE {S.SALE_FILTERS}
)
SELECT month, region, class, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(500)] AS INT64) AS median_price,
       CAST(APPROX_QUANTILES(
              IF(surface BETWEEN {S.SURF_MIN} AND {S.SURF_MAX}, price / surface, NULL),
              1000)[OFFSET(500)] AS INT64) AS median_eur_m2
FROM base
WHERE month >= '2023-01' AND region != 'Unknown' AND class != 'Multi-unit'
GROUP BY 1, 2, 3
HAVING n >= {MIN_N}
ORDER BY 1, 2, 3
"""

RENT_SQL = f"""
WITH latest AS ({S.union_dedup(S.RENT_TABLES)}),
base AS (
  SELECT {S.LISTING_MONTH} AS month, {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         {S.RENT_PRICE} AS rent
  FROM latest WHERE {S.RENT_FILTERS}
)
SELECT month, region, class, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(rent, 1000)[OFFSET(500)] AS INT64) AS median_rent
FROM base
WHERE month >= '2023-01' AND region != 'Unknown' AND class != 'Multi-unit'
GROUP BY 1, 2, 3
HAVING n >= {MIN_N}
ORDER BY 1, 2, 3
"""

sale = bq.query(SQL, label="trends-sale")
rent = bq.query(RENT_SQL, label="trends-rent")

# Rebase each (region, class) series to 100 at its first month with a usable sample, so lines
# with different absolute levels stay comparable.
def rebase(rows, value_key, out_key):
    bases: dict[tuple, float] = {}
    for r in sorted(rows, key=lambda r: r["month"]):
        key = (r["region"], r["class"])
        v = r.get(value_key)
        if v:
            bases.setdefault(key, v)
            r[out_key] = round(v / bases[key] * 100, 1)
    return rows


rebase(sale, "median_eur_m2", "index_eur_m2")
rebase(sale, "median_price", "index_price")
rebase(rent, "median_rent", "index_rent")

# Flag points the pages must not draw as ordinary readings. A few listings created during the
# 2025-12 to 2026-03 gap were picked up later, enough to clear MIN_N and draw a false dip.
CONFIDENT_N = 300
for row in sale + rent:
    row["low_confidence"] = bool(row["month"] in S.DEAD_MONTHS or row["n"] < CONFIDENT_N)

bq.emit({
    "sale": sale,
    "rent": rent,
    "min_sample": MIN_N,
    "confident_sample": CONFIDENT_N,
    "dead_months": list(S.DEAD_MONTHS),
    "index_base": "Each region/class series is rebased to 100 at its first month with a usable sample.",
    "note": ("Points flagged low_confidence fall in the collection gap or have a thin "
             "sample; they are backfill artifacts, not market movements, and should be broken "
             "out of any line rather than drawn through."),
})
