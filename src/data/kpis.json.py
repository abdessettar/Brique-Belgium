"""Headline KPIs with year-on-year change.

Windows are defined on publication_creationDate (the listing's own date), not on when it was
observed. A rolling 12 month window is compared with the one before it. Medians tolerate the
uneven collection; counts would not, so there is no count KPI.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

# Latest month present in the data, so the window follows the data rather than the wall clock.
MAX_MONTH = bq.query(
    f"SELECT MAX({S.LISTING_MONTH}) AS m FROM `{S.PROJECT}.raw.maison_a_vendre` "
    f"WHERE publication_creationDate != ''", label="max-month")[0]["m"]

y, m = int(MAX_MONTH[:4]), int(MAX_MONTH[5:])


def shift(year: int, month: int, months_back: int) -> str:
    total = year * 12 + (month - 1) - months_back
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


CUR_FROM, PRV_FROM = shift(y, m, 11), shift(y, m, 23)
PRV_TO = shift(y, m, 12)

WINDOW = f"""CASE
      WHEN {S.LISTING_MONTH} BETWEEN '{CUR_FROM}' AND '{MAX_MONTH}' THEN 'current'
      WHEN {S.LISTING_MONTH} BETWEEN '{PRV_FROM}' AND '{PRV_TO}' THEN 'prior'
    END"""

SALE_SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES)}),
tagged AS (
  SELECT {S.PROPERTY_CLASS} AS class, {WINDOW} AS win,
         {S.SALE_PRICE} AS price, {S.SURFACE} AS surface,
         SAFE_CAST(statistics_viewCount AS INT64) AS views,
         {S.DAYS_LISTED} AS days_listed
  FROM latest WHERE {S.SALE_FILTERS}
)
SELECT class, win, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(500)] AS INT64) AS median_price,
       CAST(APPROX_QUANTILES(
              IF(surface BETWEEN {S.SURF_MIN} AND {S.SURF_MAX}, price / surface, NULL),
              1000)[OFFSET(500)] AS INT64) AS median_eur_m2,
       ROUND(APPROX_QUANTILES(
              IF(days_listed >= 3 AND views > 0, views / days_listed, NULL),
              1000)[OFFSET(500)], 1) AS median_views_per_day
FROM tagged WHERE win IS NOT NULL AND class != 'Multi-unit'
GROUP BY 1, 2
"""

RENT_SQL = f"""
WITH latest AS ({S.union_dedup(S.RENT_TABLES)}),
tagged AS (
  SELECT {S.PROPERTY_CLASS} AS class, {WINDOW} AS win,
         {S.RENT_PRICE} AS rent, {S.SURFACE} AS surface
  FROM latest WHERE {S.RENT_FILTERS}
)
SELECT class, win, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(rent, 1000)[OFFSET(500)] AS INT64) AS median_rent
FROM tagged WHERE win IS NOT NULL AND class != 'Multi-unit'
GROUP BY 1, 2
"""

sale = bq.query(SALE_SQL, label="kpi-sale")
rent = bq.query(RENT_SQL, label="kpi-rent")


def index(rows, *keys):
    return {tuple(r[k] for k in keys): r for r in rows}


sale_i, rent_i = index(sale, "class", "win"), index(rent, "class", "win")


def pct(cur, prv):
    if cur in (None, 0) or prv in (None, 0):
        return None
    return round((cur - prv) / prv * 100, 1)


kpis = []
for cls in ("House", "Apartment"):
    c, p = sale_i.get((cls, "current")), sale_i.get((cls, "prior"))
    cr, pr = rent_i.get((cls, "current")), rent_i.get((cls, "prior"))
    if not c:
        continue
    # Gross yield: annual median rent over median sale price, same window and class. The two
    # medians come from different listings, so this is a market ratio, not a property return.
    yield_pct = (round(12 * cr["median_rent"] / c["median_price"] * 100, 2)
                 if cr and c["median_price"] else None)
    prior_yield = (round(12 * pr["median_rent"] / p["median_price"] * 100, 2)
                   if pr and p and p["median_price"] else None)
    kpis.append({
        "class": cls,
        "n_sale": c["n"], "n_rent": cr["n"] if cr else 0,
        "median_price": c["median_price"], "median_price_yoy": pct(c["median_price"], p and p["median_price"]),
        "median_eur_m2": c["median_eur_m2"], "median_eur_m2_yoy": pct(c["median_eur_m2"], p and p["median_eur_m2"]),
        "median_rent": cr["median_rent"] if cr else None,
        "median_rent_yoy": pct(cr and cr["median_rent"], pr and pr["median_rent"]),
        "gross_yield_pct": yield_pct,
        "gross_yield_yoy": pct(yield_pct, prior_yield),
        "median_views_per_day": c["median_views_per_day"],
        "median_views_per_day_yoy": pct(c["median_views_per_day"],
                                        p and p["median_views_per_day"]),
    })

bq.emit({
    "window": {"current": [CUR_FROM, MAX_MONTH], "prior": [PRV_FROM, PRV_TO]},
    "kpis": kpis,
    "caveats": {
        "no_dom": ("Days on market is not reported. lastKnownDateOnline is identical to "
                   "the observation date in every row, so any duration derived from it measures how "
                   "often the data was collected rather than how long a property took to sell."),
        "views": ("Views are normalised by days since listing creation, because a view count is a "
                  "snapshot at observation time and would otherwise just measure listing age."),
        "yield": ("Gross yield compares median asking rent to median asking price across "
                  "different listings in the same class. It is a market ratio, not a per-property "
                  "return, and ignores costs, taxes and vacancy."),
    },
})
