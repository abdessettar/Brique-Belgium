"""Per commune aggregates: asking price, rent, gross yield, demand and the recorded sale price.

Sale and rent listings are matched on postal code, then rolled up to NIS commune codes through
socioeconomic.nis_postal_code_conversion so the result joins both the Statbel figures and the
map geometry.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

# Minimum listings on each side (sale and rent) before a commune gets a yield.
MIN_SIDE = 30

SQL = f"""
WITH sale_latest AS ({S.union_dedup(S.SALE_TABLES)}),
     rent_latest AS ({S.union_dedup(S.RENT_TABLES)}),

sale AS (
  SELECT {S.POSTAL} AS postal,
         ANY_VALUE(property_location_locality) AS locality,
         ANY_VALUE({S.PROVINCE_EN}) AS province,
         ANY_VALUE({S.REGION}) AS region,
         COUNT(*) AS n_sale,
         CAST(APPROX_QUANTILES({S.SALE_PRICE}, 1000)[OFFSET(500)] AS INT64) AS median_price,
         CAST(APPROX_QUANTILES(
                IF({S.SURFACE} BETWEEN {S.SURF_MIN} AND {S.SURF_MAX},
                   {S.SALE_PRICE} / {S.SURFACE}, NULL), 1000)[OFFSET(500)] AS INT64) AS median_eur_m2,
         ROUND(APPROX_QUANTILES(
                IF({S.DAYS_LISTED} >= 3 AND SAFE_CAST(statistics_viewCount AS INT64) > 0,
                   SAFE_CAST(statistics_viewCount AS INT64) / {S.DAYS_LISTED}, NULL),
                1000)[OFFSET(500)], 1) AS median_views_per_day
  FROM sale_latest WHERE {S.SALE_FILTERS}
  GROUP BY 1
),
rent AS (
  SELECT {S.POSTAL} AS postal, COUNT(*) AS n_rent,
         CAST(APPROX_QUANTILES({S.RENT_PRICE}, 1000)[OFFSET(500)] AS INT64) AS median_rent
  FROM rent_latest WHERE {S.RENT_FILTERS}
  GROUP BY 1
),
conv AS (
  SELECT SAFE_CAST(postalcode AS INT64) AS postal, SAFE_CAST(nis AS INT64) AS nis
  FROM `{S.PROJECT}.socioeconomic.nis_postal_code_conversion`
)
SELECT conv.nis, sale.postal, sale.locality, sale.province, sale.region,
       sale.n_sale, sale.median_price, sale.median_eur_m2, sale.median_views_per_day,
       rent.n_rent, rent.median_rent
FROM sale
LEFT JOIN rent ON sale.postal = rent.postal
LEFT JOIN conv ON sale.postal = conv.postal
WHERE sale.postal IS NOT NULL
"""

OFFICIAL_SQL = f"""
SELECT SAFE_CAST(m.nis AS INT64) AS nis,
       SAFE_CAST(m.medianSellPrice AS INT64) AS official_median_price,
       SAFE_CAST(p.Total AS INT64) AS population,
       SAFE_CAST(v.riskMonetaryPoverty AS FLOAT64) AS poverty_risk
FROM `{S.PROJECT}.socioeconomic.median_sell_price_nis_s1_2025` m
LEFT JOIN `{S.PROJECT}.socioeconomic.population_par_nis` p ON m.nis = p.nis
LEFT JOIN `{S.PROJECT}.socioeconomic.monetary_poverty_risk_nis` v ON m.nis = v.nis
"""

rows = bq.query(SQL, label="communes")
official = {r["nis"]: r for r in bq.query(OFFICIAL_SQL, label="official-stats")}

# Roll postal codes up to NIS communes. Several postal codes share one commune, so each postal
# code's median is weighted by its sample size. This approximates the pooled median without a
# second pass over the raw tables.
by_nis: dict[int, dict] = {}
unmapped = 0
for r in rows:
    nis = r["nis"]
    if nis is None:
        unmapped += 1
        continue
    c = by_nis.setdefault(nis, {
        "nis": nis, "locality": r["locality"], "province": r["province"], "region": r["region"],
        "n_sale": 0, "n_rent": 0, "_price_w": 0.0, "_m2_w": 0.0, "_rent_w": 0.0,
        "_views_w": 0.0, "_m2_n": 0, "_views_n": 0, "_name_n": 0,
    })
    # Name the commune after its largest postal code. ANY_VALUE would otherwise pick a district
    # such as GENTBRUGGE over Gent.
    if (r["n_sale"] or 0) > c["_name_n"]:
        c["_name_n"] = r["n_sale"] or 0
        c["locality"] = r["locality"]
    c["n_sale"] += r["n_sale"] or 0
    c["_price_w"] += (r["median_price"] or 0) * (r["n_sale"] or 0)
    if r["median_eur_m2"]:
        c["_m2_w"] += r["median_eur_m2"] * r["n_sale"]
        c["_m2_n"] += r["n_sale"]
    if r["median_views_per_day"]:
        c["_views_w"] += r["median_views_per_day"] * r["n_sale"]
        c["_views_n"] += r["n_sale"]
    if r["n_rent"]:
        c["n_rent"] += r["n_rent"]
        c["_rent_w"] += (r["median_rent"] or 0) * r["n_rent"]

communes = []
for c in by_nis.values():
    price = round(c["_price_w"] / c["n_sale"]) if c["n_sale"] else None
    rent = round(c["_rent_w"] / c["n_rent"]) if c["n_rent"] else None
    eur_m2 = round(c["_m2_w"] / c["_m2_n"]) if c["_m2_n"] else None
    views = round(c["_views_w"] / c["_views_n"], 1) if c["_views_n"] else None
    # Yield only where both sides carry a real sample; otherwise it is noise on a map.
    enough = c["n_sale"] >= MIN_SIDE and c["n_rent"] >= MIN_SIDE
    gross_yield = round(12 * rent / price * 100, 2) if (enough and price and rent) else None
    o = official.get(c["nis"], {})
    off = o.get("official_median_price") or None
    communes.append({
        "nis": c["nis"], "locality": c["locality"], "province": c["province"],
        "region": c["region"], "n_sale": c["n_sale"], "n_rent": c["n_rent"],
        "median_price": price, "median_eur_m2": eur_m2, "median_rent": rent,
        "median_views_per_day": views, "gross_yield_pct": gross_yield,
        "official_median_price": off,
        # How far asking prices sit above the last recorded sale price. The periods and
        # populations differ, so this is an indication rather than a measured premium.
        "asking_vs_official_pct": round((price - off) / off * 100, 1) if (price and off) else None,
        "population": o.get("population"), "poverty_risk": o.get("poverty_risk"),
    })

communes.sort(key=lambda c: -(c["n_sale"] or 0))
with_yield = [c for c in communes if c["gross_yield_pct"] is not None]

bq.emit({
    "communes": communes,
    "summary": {
        "n_communes": len(communes),
        "n_with_yield": len(with_yield),
        "min_side_sample": MIN_SIDE,
        "unmapped_postal_codes": unmapped,
        "yield_range": ([min(c["gross_yield_pct"] for c in with_yield),
                         max(c["gross_yield_pct"] for c in with_yield)] if with_yield else None),
    },
    "note": ("Commune figures are sample-weighted rollups of postal-code medians, not pooled "
             "medians. Yield is shown only where both buy and rent clear "
             f"{MIN_SIDE} listings."),
})
