"""Affordability: what a budget buys where, and what renting costs against buying.

Three views, all by province (plus region and national rollups) and property class, over the
last 24 listing months:

  budgets   For each fixed budget, the listings priced within 7.5% of it: size, bedrooms,
            energy rating and age. What EUR 300k buys in Hainaut against Flemish Brabant.
  ladder    The price distribution of the whole market and the share of listings at or under
            each budget.
  rent      Median asking rent, rent per m2 and surface, so renting can be set against buying
            for the same province and class.

Every figure is a median or a share. Collection was uneven and four months are missing, so
counts mostly reflect collection while ratios within one population do not. The n column is
kept only to suppress small cells. Budgets are nominal euros; a 24 month window keeps them close
to current prices while leaving enough sample in thin provinces (Luxembourg, Walloon Brabant
apartments).

Rollups (region, Belgium) are pooled over listings, not averaged over provinces, so they are real
medians of the larger population. The province Brussels equals the region Brussels and appears
once at each level; that is expected.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

BUDGETS = [150_000, 200_000, 250_000, 300_000, 350_000, 400_000, 500_000, 600_000, 750_000,
           1_000_000]
# A budget band is 7.5% either side of the nominal figure: wide enough for the thin end of the
# ladder (EUR 1M houses in Luxembourg) to clear MIN_N, narrow enough that neighbouring budgets
# still describe different stock. Bands overlap slightly from 350k up, which is acceptable since
# each budget is read on its own.
BAND_LO, BAND_HI = 0.925, 1.075
MIN_N = 30
MONTHS = 24

EPC_BANDS = ["A++", "A+", "A", "B", "C", "D", "E", "F", "G"]
EPC_GREEN = ["A++", "A+", "A", "B"]

# Latest month present in the data, so the window follows the data rather than the wall clock.
MAX_MONTH = bq.query(
    f"SELECT MAX({S.LISTING_MONTH}) AS m FROM `{S.PROJECT}.raw.maison_a_vendre` "
    f"WHERE publication_creationDate != ''", label="max-month")[0]["m"]

y, m = int(MAX_MONTH[:4]), int(MAX_MONTH[5:])
total = y * 12 + (m - 1) - (MONTHS - 1)
FROM_MONTH = f"{total // 12:04d}-{total % 12 + 1:02d}"

_in = lambda vals: ", ".join(f"'{v}'" for v in vals)

# Each listing is counted once per geography level: its province, its region and the country.
# The expansion happens after the table read, so it scans no extra bytes, and a single GROUP BY
# then yields pooled medians at every level.
GEO_UNNEST = "CROSS JOIN UNNEST([STRUCT(province AS geo, 'province' AS level), " \
             "STRUCT(region, 'region'), STRUCT('Belgium', 'country')]) AS g"

_under = ",\n       ".join(f"COUNTIF(price <= {b}) AS under_{b}" for b in BUDGETS)

# Budget 0 stands for the whole market and produces the ladder rows. Other budgets keep only
# the listings inside their band. Both come from the same scan.
SALE_SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES, "flags_isNewlyBuilt")}),
base AS (
  SELECT {S.PROVINCE_EN} AS province, {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         {S.SALE_PRICE} AS price,
         IF({S.SURFACE_FILTER}, {S.SURFACE}, NULL) AS surface,
         SAFE_CAST(property_bedroomCount AS INT64) AS bedrooms,
         CASE
           WHEN transaction_certificates_epcScore IN ({_in(EPC_GREEN)}) THEN 1
           WHEN transaction_certificates_epcScore IN ({_in(EPC_BANDS)}) THEN 0
         END AS epc_green,
         IF(flags_isNewlyBuilt = 'True', 1, 0) AS newbuild,
         SAFE_CAST(property_building_constructionYear AS INT64) AS yr
  FROM latest
  WHERE {S.SALE_FILTERS}
    AND {S.LISTING_MONTH} BETWEEN '{FROM_MONTH}' AND '{MAX_MONTH}'
),
expanded AS (
  SELECT g.geo, g.level, class, price, surface, bedrooms, epc_green, newbuild,
         IF(yr BETWEEN 1800 AND EXTRACT(YEAR FROM CURRENT_DATE()) + 1, yr, NULL) AS yr,
         budget
  FROM base
  {GEO_UNNEST}
  CROSS JOIN UNNEST([0, {", ".join(str(b) for b in BUDGETS)}]) AS budget
  WHERE region != 'Unknown' AND class != 'Multi-unit'
    AND (budget = 0 OR price BETWEEN {BAND_LO} * budget AND {BAND_HI} * budget)
)
SELECT geo, level, class, budget, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(100)] AS INT64) AS p10_price,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(250)] AS INT64) AS p25_price,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(500)] AS INT64) AS median_price,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(750)] AS INT64) AS p75_price,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(900)] AS INT64) AS p90_price,
       {_under},
       CAST(APPROX_QUANTILES(surface, 1000)[OFFSET(250)] AS INT64) AS p25_surface,
       CAST(APPROX_QUANTILES(surface, 1000)[OFFSET(500)] AS INT64) AS median_surface,
       CAST(APPROX_QUANTILES(surface, 1000)[OFFSET(750)] AS INT64) AS p75_surface,
       COUNTIF(surface IS NOT NULL) AS n_surface,
       CAST(APPROX_QUANTILES(bedrooms, 1000)[OFFSET(500)] AS INT64) AS median_bedrooms,
       COUNTIF(bedrooms IS NOT NULL) AS n_bedrooms,
       CAST(APPROX_QUANTILES(yr, 1000)[OFFSET(500)] AS INT64) AS median_year_built,
       COUNTIF(yr IS NOT NULL) AS n_year,
       COUNTIF(epc_green IS NOT NULL) AS n_epc,
       SUM(epc_green) AS n_epc_green,
       SUM(newbuild) AS n_newbuild
FROM expanded
GROUP BY 1, 2, 3, 4
HAVING n >= {MIN_N}
"""

RENT_SQL = f"""
WITH latest AS ({S.union_dedup(S.RENT_TABLES)}),
base AS (
  SELECT {S.PROVINCE_EN} AS province, {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
         {S.RENT_PRICE} AS rent,
         IF({S.SURFACE_FILTER}, {S.SURFACE}, NULL) AS surface
  FROM latest
  WHERE {S.RENT_FILTERS}
    AND {S.LISTING_MONTH} BETWEEN '{FROM_MONTH}' AND '{MAX_MONTH}'
)
SELECT g.geo, g.level, class, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(rent, 1000)[OFFSET(250)] AS INT64) AS p25_rent,
       CAST(APPROX_QUANTILES(rent, 1000)[OFFSET(500)] AS INT64) AS median_rent,
       CAST(APPROX_QUANTILES(rent, 1000)[OFFSET(750)] AS INT64) AS p75_rent,
       ROUND(APPROX_QUANTILES(rent / surface, 1000)[OFFSET(500)], 2) AS median_rent_m2,
       CAST(APPROX_QUANTILES(surface, 1000)[OFFSET(500)] AS INT64) AS median_surface,
       COUNTIF(surface IS NOT NULL) AS n_surface
FROM base
{GEO_UNNEST}
WHERE region != 'Unknown' AND class != 'Multi-unit'
GROUP BY 1, 2, 3
HAVING n >= {MIN_N}
"""

sale = bq.query(SALE_SQL, label="budget-sale")
rent = bq.query(RENT_SQL, label="budget-rent")

LEVEL_ORDER = {"country": 0, "region": 1, "province": 2}
sort_key = lambda r: (LEVEL_ORDER[r["level"]], r["geo"], r["class"], r.get("budget", 0))


def share(num, den):
    return round(num / den, 4) if den else None


budgets, ladder = [], []
for r in sorted(sale, key=sort_key):
    head = {"province": r["geo"], "level": r["level"], "class": r["class"]}
    if r["budget"] == 0:
        ladder.append({
            **head, "n": r["n"],
            "median_price": r["median_price"], "p10_price": r["p10_price"],
            "p25_price": r["p25_price"], "p75_price": r["p75_price"], "p90_price": r["p90_price"],
            "share_under": {str(b): share(r[f"under_{b}"], r["n"]) for b in BUDGETS},
        })
    else:
        # An optional attribute is reported only when its own populated subsample reaches MIN_N.
        # Otherwise a cell of 30 listings with 12 known surfaces would print a median of 12.
        has_surf = r["n_surface"] >= MIN_N
        budgets.append({
            **head, "budget": r["budget"], "n": r["n"],
            "median_surface": r["median_surface"] if has_surf else None,
            "p25_surface": r["p25_surface"] if has_surf else None,
            "p75_surface": r["p75_surface"] if has_surf else None,
            "median_bedrooms": r["median_bedrooms"] if r["n_bedrooms"] >= MIN_N else None,
            "median_year_built": r["median_year_built"] if r["n_year"] >= MIN_N else None,
            "share_epc_ab": share(r["n_epc_green"], r["n_epc"]) if r["n_epc"] >= MIN_N else None,
            "share_newbuild": share(r["n_newbuild"], r["n"]),
        })

rent_rows = [{
    "province": r["geo"], "level": r["level"], "class": r["class"], "n": r["n"],
    "median_rent": r["median_rent"], "p25_rent": r["p25_rent"], "p75_rent": r["p75_rent"],
    "median_rent_m2": r["median_rent_m2"] if r["n_surface"] >= MIN_N else None,
    "median_surface": r["median_surface"] if r["n_surface"] >= MIN_N else None,
} for r in sorted(rent, key=sort_key)]

bq.emit({
    "window": {"from": FROM_MONTH, "to": MAX_MONTH},
    "budget_levels": BUDGETS,
    "band": [BAND_LO, BAND_HI],
    "min_sample": MIN_N,
    "budgets": budgets,
    "ladder": ladder,
    "rent": rent_rows,
    "note": ("Asking prices and asking rents from listings created in the last 24 months, "
             "latest observation per listing. A budget row describes listings priced within "
             "7.5% either side of that budget. Surface based figures use only listings with a "
             "plausible habitable surface; the EPC share is among listings with a known "
             "certificate. Region and Belgium rows are pooled over listings, not averaged over "
             "provinces. Budgets are nominal euros and are not adjusted for inflation."),
})
