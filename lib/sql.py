"""SQL fragments shared by every loader, so they all apply the same cleaning rules.

Deduplication: the raw tables are a panel with one row per observation, so every query keeps
only the latest observation per listing id.

Segment: the source table does not determine the property class (`maison_a_vendre` holds about
100k apartments), so listings are always classified on property_subtype.

Outliers: raw prices run from EUR 1 to EUR 32M and surfaces from 1 to 452,230 m2. Prices are
bounded at the 1st and 99th percentiles of the sale tables (EUR 80k to 2.15M).

Construction year: not used as a filter. It is only 64% populated, and requiring it would drop
about a third of all listings.

Medians: always APPROX_QUANTILES(x, 1000)[OFFSET(500)], never the two bucket form. With two
buckets the estimate is off by up to 1% and changes with how the rows are partitioned, so the
same data gave different headline figures on consecutive runs. A thousand buckets is within
0.02% of exact, stable, and scans no extra bytes. Quartiles use OFFSET(250) and OFFSET(750).
"""

import os

import bq

# Defaults to the project of the service account key (see bq.py).
PROJECT = os.environ.get("BQ_PROJECT") or bq.PROJECT

SALE_TABLES = ["maison_a_vendre", "appartement_a_vendre"]
RENT_TABLES = ["maison_a_louer", "appartement_a_louer"]

# Outlier bounds (1st and 99th percentiles of the sale tables).
PRICE_MIN, PRICE_MAX = 80_000, 2_150_000
RENT_MIN, RENT_MAX = 300, 15_000
SURF_MIN, SURF_MAX = 11, 2_000

# Immoweb subtypes bucketed into the three classes the dashboard reports on.
_HOUSE = ("HOUSE", "VILLA", "MANSION", "TOWN_HOUSE", "BUNGALOW", "COUNTRY_COTTAGE",
          "FARMHOUSE", "CHALET", "MANOR_HOUSE", "CASTLE", "EXCEPTIONAL_PROPERTY",
          "PAVILION", "HOUSE_GROUP")
_APARTMENT = ("APARTMENT", "DUPLEX", "PENTHOUSE", "FLAT_STUDIO", "LOFT", "TRIPLEX",
              "GROUND_FLOOR", "SERVICE_FLAT", "KOT", "APARTMENT_GROUP")
# APARTMENT_BLOCK and MIXED_USE_BUILDING are priced per building rather than per dwelling, so
# they fall into their own class and are left out of the headline figures.

def _in(values) -> str:
    return ", ".join(f"'{v}'" for v in values)


PROPERTY_CLASS = f"""CASE
      WHEN property_subtype IN ({_in(_HOUSE)}) THEN 'House'
      WHEN property_subtype IN ({_in(_APARTMENT)}) THEN 'Apartment'
      ELSE 'Multi-unit'
    END"""

# Region from the province column, which is always populated. Province names are stored in
# French regardless of the province's language; PROVINCE_EN translates them for display.
REGION = """CASE
      WHEN property_location_province IN ('Anvers','Flandre Orientale','Flandre Occidentale',
                                          'Brabant Flamand','Limbourg') THEN 'Flanders'
      WHEN property_location_province IN ('Hainaut','Liège','Namur','Luxembourg',
                                          'Brabant Wallon') THEN 'Wallonia'
      WHEN property_location_province = 'Bruxelles' THEN 'Brussels'
      ELSE 'Unknown'
    END"""

PROVINCE_EN = """CASE property_location_province
      WHEN 'Anvers' THEN 'Antwerp'
      WHEN 'Flandre Orientale' THEN 'East Flanders'
      WHEN 'Flandre Occidentale' THEN 'West Flanders'
      WHEN 'Brabant Flamand' THEN 'Flemish Brabant'
      WHEN 'Limbourg' THEN 'Limburg'
      WHEN 'Brabant Wallon' THEN 'Walloon Brabant'
      WHEN 'Bruxelles' THEN 'Brussels'
      WHEN 'Liège' THEN 'Liege'
      ELSE property_location_province
    END"""

POSTAL = "SAFE_CAST(REGEXP_REPLACE(property_location_postalCode, r'[^0-9]', '') AS INT64)"
SURFACE = "SAFE_CAST(property_netHabitableSurface AS INT64)"
# Refer to the normalised aliases produced by dedup(), not the raw columns: the sale tables have
# no transaction_rental_monthlyRentalPrice, so a shared expression must go through the alias.
SALE_PRICE = "SAFE_CAST(sale_price_raw AS INT64)"
RENT_PRICE = "SAFE_CAST(rent_price_raw AS INT64)"

_SHARED_COLS = """id, property_subtype, property_location_province, property_location_postalCode,
             property_location_locality, property_netHabitableSurface, property_bedroomCount,
             transaction_certificates_epcScore, publication_creationDate,
             publication_lastModificationDate, lastKnownDateOnline,
             property_building_constructionYear, property_location_latitude,
             property_location_longitude, statistics_viewCount, statistics_bookmarkCount,
             flags_isLifeAnnuitySale, property_constructionPermit_hasObligationToConstruct,
             transaction_subtype, metaDateScraped"""


def dedup(table: str, extra_cols: str = "") -> str:
    """CTE body: latest observation per listing id from one raw table.

    Price columns differ by table (sale tables lack the rental column entirely), so both are
    normalised here to sale_price_raw / rent_price_raw and every caller uses those.
    """
    cols = f", {extra_cols}" if extra_cols else ""
    is_rent = table in RENT_TABLES
    rent_expr = ("transaction_rental_monthlyRentalPrice" if is_rent else "CAST(NULL AS STRING)")
    return f"""
    SELECT * EXCEPT(rn) FROM (
      SELECT {_SHARED_COLS},
             transaction_sale_price AS sale_price_raw,
             {rent_expr} AS rent_price_raw{cols},
             ROW_NUMBER() OVER (PARTITION BY id
                                ORDER BY publication_lastModificationDate DESC) AS rn
      FROM `{PROJECT}.raw.{table}`
    ) WHERE rn = 1"""


def union_dedup(tables: list[str], extra_cols: str = "") -> str:
    return "\n    UNION ALL\n".join(dedup(t, extra_cols) for t in tables)


# Filters shared by every headline metric. Construction year is intentionally not one of them.
BASE_FILTERS = f"""
      flags_isLifeAnnuitySale != 'True'
      AND property_constructionPermit_hasObligationToConstruct != 'True'
      AND {POSTAL} BETWEEN 1000 AND 9999"""

SALE_FILTERS = f"""{BASE_FILTERS}
      AND transaction_subtype = 'BUY_REGULAR'
      AND {SALE_PRICE} BETWEEN {PRICE_MIN} AND {PRICE_MAX}"""

RENT_FILTERS = f"""{BASE_FILTERS}
      AND {RENT_PRICE} BETWEEN {RENT_MIN} AND {RENT_MAX}"""

# Applied only where a per m2 figure is computed. Surface is 90.5% populated, so requiring it
# everywhere would shrink every sample for no reason.
SURFACE_FILTER = f"{SURFACE} BETWEEN {SURF_MIN} AND {SURF_MAX}"

# Listing month comes from publication_creationDate (always populated) rather than the
# observation date, so the collection schedule does not show up as a market signal.
LISTING_MONTH = "SUBSTR(publication_creationDate, 1, 7)"

# publication_creationDate is ISO8601 with a Z suffix ('2026-05-23T23:00:45.914Z'), so it needs a
# TIMESTAMP cast; a DATETIME cast silently returns NULL.
CREATED_DATE = "DATE(SAFE_CAST(publication_creationDate AS TIMESTAMP))"

# Days between listing creation and the observation, used to normalise view counts.
#
# This is not time on market. `lastKnownDateOnline` equals `metaDateScraped` in every row, so it
# records when the listing was observed, not when it left the market, and any "days on market"
# derived from it would only measure how often data was collected.
DAYS_LISTED = f"DATE_DIFF(DATE(SAFE_CAST(metaDateScraped AS DATE)), {CREATED_DATE}, DAY)"

# Months with no data collection at all. Count based metrics are meaningless here.
DEAD_MONTHS = ("2025-12", "2026-01", "2026-02", "2026-03")
