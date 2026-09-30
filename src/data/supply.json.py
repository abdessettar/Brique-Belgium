"""Composition of new supply: new build versus resale, and how much of it is affordable.

Both metrics are shares rather than counts, which matters because collection was uneven: the
number of listings recorded in a month partly reflects collection, while the proportion that are
new builds, or that sit under a price threshold, does not.

flags_isNewlyBuilt is True or False on every row (9% True), so using it drops no listings.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

MIN_N = 40         # below this a monthly share is too noisy to plot
CONFIDENT_N = 300  # below this the point is flagged for the frontend to drop
THRESHOLDS = [200_000, 250_000, 300_000]

_counts = ",\n       ".join(
    f"COUNTIF(price < {t}) AS under_{t // 1000}k" for t in THRESHOLDS
)

SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES, "flags_isNewlyBuilt")}),
base AS (
  SELECT {S.LISTING_MONTH} AS month, {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         {S.SALE_PRICE} AS price,
         IF(flags_isNewlyBuilt = 'True', 1, 0) AS is_newbuild
  FROM latest WHERE {S.SALE_FILTERS}
)
SELECT month, region, class, COUNT(*) AS n,
       SUM(is_newbuild) AS n_newbuild,
       {_counts},
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(250)] AS INT64) AS p25_price,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(500)] AS INT64) AS median_price
FROM base
WHERE month >= '2023-01' AND region != 'Unknown' AND class != 'Multi-unit'
GROUP BY 1, 2, 3
HAVING n >= {MIN_N}
ORDER BY 1, 2, 3
"""

rows = bq.query(SQL, label="supply-composition")

for r in rows:
    r["newbuild_share"] = round(r["n_newbuild"] / r["n"], 4) if r["n"] else None
    for t in THRESHOLDS:
        key = f"under_{t // 1000}k"
        r[f"{key}_share"] = round(r[key] / r["n"], 4) if r["n"] else None
    r["low_confidence"] = bool(r["month"] in S.DEAD_MONTHS or r["n"] < CONFIDENT_N)

bq.emit({
    "rows": rows,
    "thresholds": THRESHOLDS,
    "min_sample": MIN_N,
    "confident_sample": CONFIDENT_N,
    "note": ("Shares of newly listed properties for sale. New build is taken from the listing's "
             "own new build flag, which is set on every record. Affordability thresholds are "
             "fixed in nominal euros, so part of any decline reflects general price inflation "
             "rather than a change in what is being offered."),
})
