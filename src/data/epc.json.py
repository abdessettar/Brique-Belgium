"""EPC (energy certificate) mix and the green premium.

Comparing raw EUR/m2 across EPC bands would mostly restate geography and building age, since
newer areas are both greener and pricier. The premium is therefore computed within cells of
region, class and construction era, so an A rated 1960s house in Wallonia is compared with a
G rated 1960s house in Wallonia.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

BANDS = ["A++", "A+", "A", "B", "C", "D", "E", "F", "G"]

ERA = """CASE
      WHEN yr IS NULL THEN 'Unknown'
      WHEN yr < 1945 THEN 'Pre-1945'
      WHEN yr < 1970 THEN '1945-1969'
      WHEN yr < 1990 THEN '1970-1989'
      WHEN yr < 2010 THEN '1990-2009'
      ELSE '2010+'
    END"""

SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES)}),
base AS (
  SELECT {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         transaction_certificates_epcScore AS epc,
         SAFE_CAST(property_building_constructionYear AS INT64) AS yr,
         {S.SALE_PRICE} AS price, {S.SURFACE} AS surface,
         {S.LISTING_MONTH} AS month
  FROM latest WHERE {S.SALE_FILTERS} AND {S.SURFACE_FILTER}
),
tagged AS (
  SELECT region, class, month, {ERA} AS era,
         IF(epc IN ({", ".join(f"'{b}'" for b in BANDS)}), epc, 'Unknown') AS epc,
         price / surface AS eur_m2
  FROM base
  WHERE yr IS NULL OR yr BETWEEN 1800 AND EXTRACT(YEAR FROM CURRENT_DATE()) + 1
)
SELECT region, class, era, epc, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(eur_m2, 1000)[OFFSET(500)] AS INT64) AS median_eur_m2
FROM tagged
WHERE region != 'Unknown' AND class != 'Multi-unit'
GROUP BY 1, 2, 3, 4
HAVING n >= 25
"""

MIX_SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES)}),
base AS (
  SELECT {S.LISTING_MONTH} AS month, {S.REGION} AS region,
         IF(transaction_certificates_epcScore IN ({", ".join(f"'{b}'" for b in BANDS)}),
            transaction_certificates_epcScore, 'Unknown') AS epc
  FROM latest WHERE {S.SALE_FILTERS}
)
SELECT month, region, epc, COUNT(*) AS n
FROM base
WHERE month >= '2023-01' AND region != 'Unknown'
GROUP BY 1, 2, 3
HAVING n >= 20
ORDER BY 1, 2
"""

cells = bq.query(SQL, label="epc-cells")
mix = bq.query(MIX_SQL, label="epc-mix")

# Within each (region, class, era) cell, express every band relative to the cell's D rated
# median. D is the most common band.
premium: dict[str, dict] = {}
by_cell: dict[tuple, dict] = {}
for r in cells:
    by_cell.setdefault((r["region"], r["class"], r["era"]), {})[r["epc"]] = r

for (region, cls, era), bands in by_cell.items():
    ref = bands.get("D")
    if not ref or not ref["median_eur_m2"]:
        continue
    for band, r in bands.items():
        if band == "Unknown" or not r["median_eur_m2"]:
            continue
        slot = premium.setdefault(band, {"band": band, "_w": 0.0, "_n": 0})
        rel = r["median_eur_m2"] / ref["median_eur_m2"] * 100 - 100
        slot["_w"] += rel * r["n"]
        slot["_n"] += r["n"]

premium_rows = [{"band": b, "premium_vs_D_pct": round(v["_w"] / v["_n"], 1), "n": v["_n"]}
                for b, v in premium.items() if v["_n"]]
premium_rows.sort(key=lambda r: BANDS.index(r["band"]) if r["band"] in BANDS else 99)

bq.emit({
    "bands": BANDS,
    "cells": cells,
    "mix": mix,
    "premium": premium_rows,
    "note": ("Premium is measured against D-rated stock within the same region, property class "
             "and construction era, then sample-weighted across cells. This strips out the "
             "geography and building-age effects that a raw EPC-vs-price comparison would "
             "mistake for an energy effect."),
})
