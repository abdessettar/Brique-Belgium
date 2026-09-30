"""Anatomy of a price: what individual property features cost, measured within cells.

A raw "houses with a pool cost X% more" comparison mostly restates geography and building age,
because pools come with large new villas in expensive communes. Premiums are computed as in
epc.json.py: each feature level is compared with a reference level inside cells of region,
property class and construction era, so a 4 facade 1960s house in Wallonia is compared with a
2 facade 1960s house in Wallonia. Cell premiums are then weighted by the level's count.

Premiums are in EUR/m2, so they measure what a feature adds to the price of a square metre, not
to the price of a home. For facades this matters: detached houses are bigger, so they can have
a higher asking price and a lower EUR/m2 at once. Absolute medians (price, EUR/m2, habitable
surface, land) per facade count are emitted as well so the page can show both.

Only listings created since 2024-01 are used, so price drift inside a cell is small.

How the source encodes the fields:
  * hasGarden, hasTerrace, hasAttic and hasBasement hold only 'True' or '', never 'False'.
    parkingCountIndoor is a count or '' and never '0'. For these five a blank is read as "not
    present" (absent_is_false in the output). The other flags (pool, lift, heat pump, solar,
    double glazing, air conditioning, fireplace, new build) have an explicit 'False', and a
    blank is treated as unknown and skipped.
  * kitchen_type has USA_* variants (open plan kitchens), folded into the base level.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
import sql as S

MIN_CELL = 25          # a level needs this many listings in a cell, and so does the reference
WINDOW_FROM = "2024-01"
REGIONS = ["Flanders", "Wallonia", "Brussels"]

# Same era buckets as epc.json.py so the two pages agree on what "same age" means.
ERA = """CASE
      WHEN yr IS NULL THEN 'Unknown'
      WHEN yr < 1945 THEN 'Pre-1945'
      WHEN yr < 1970 THEN '1945-1969'
      WHEN yr < 1990 THEN '1970-1989'
      WHEN yr < 2010 THEN '1990-2009'
      ELSE '2010+'
    END"""


def flag(col: str, absent_is_false: bool = False) -> str:
    """Normalise a raw flag column to 'True' / 'False' / NULL (unknown)."""
    if absent_is_false:
        return f"IF({col} = 'True', 'True', 'False')"
    return f"CASE WHEN {col} IN ('True', 'False') THEN {col} END"


def boolean(key, label, col, classes, *, absent_is_false=False, yes=None, no=None):
    return {
        "key": key, "label": label, "classes": classes, "reference": "False",
        "levels": {"True": yes or label, "False": no or f"No {label.lower()}"},
        "expr": flag(col, absent_is_false), "absent_is_false": absent_is_false,
    }


# Each feature: a SQL expression yielding the level code (NULL = skip the listing), the classes
# it applies to, the reference level, and the display label per level code. Level order here is
# the display order.
FEATURES = [
    {
        "key": "facades", "label": "Facades", "classes": ["House"], "reference": "2",
        "levels": {"2": "2 facades", "3": "3 facades", "4": "4 facades"},
        "expr": "IF(property_building_facadeCount IN ('2', '3', '4'), "
                "property_building_facadeCount, NULL)",
    },
    {
        "key": "condition", "label": "Condition", "classes": ["House", "Apartment"],
        "reference": "GOOD",
        "levels": {"TO_RESTORE": "To restore", "TO_RENOVATE": "To renovate",
                   "TO_BE_DONE_UP": "To be done up", "GOOD": "Good",
                   "JUST_RENOVATED": "Just renovated", "AS_NEW": "As new"},
        "expr": "IF(property_building_condition IN ('TO_RESTORE', 'TO_RENOVATE', "
                "'TO_BE_DONE_UP', 'GOOD', 'JUST_RENOVATED', 'AS_NEW'), "
                "property_building_condition, NULL)",
    },
    boolean("garden", "Garden", "property_hasGarden", ["House", "Apartment"],
            absent_is_false=True),
    boolean("terrace", "Terrace", "property_hasTerrace", ["House", "Apartment"],
            absent_is_false=True),
    {
        # No listing carries a '0' here, so blank is the "no indoor parking" level.
        "key": "parking", "label": "Indoor parking", "classes": ["House", "Apartment"],
        "reference": "False",
        "levels": {"True": "Indoor parking", "False": "No indoor parking"},
        "expr": "IF(SAFE_CAST(property_parkingCountIndoor AS INT64) >= 1, 'True', 'False')",
        "absent_is_false": True,
    },
    boolean("pool", "Swimming pool", "property_hasSwimmingPool", ["House", "Apartment"]),
    boolean("lift", "Lift", "property_hasLift", ["Apartment"]),
    boolean("heatpump", "Heat pump", "property_energy_hasHeatPump", ["House", "Apartment"]),
    boolean("solar", "Solar panels", "property_energy_hasPhotovoltaicPanels",
            ["House", "Apartment"]),
    boolean("glazing", "Double glazing", "property_energy_hasDoubleGlazing",
            ["House", "Apartment"], no="No double glazing"),
    boolean("attic", "Attic", "property_hasAttic", ["House"], absent_is_false=True),
    boolean("basement", "Basement", "property_hasBasement", ["House", "Apartment"],
            absent_is_false=True),
    boolean("aircon", "Air conditioning", "property_hasAirConditioning",
            ["House", "Apartment"]),
    boolean("fireplace", "Fireplace", "property_fireplaceExists", ["House", "Apartment"]),
    {
        "key": "heating", "label": "Heating", "classes": ["House", "Apartment"],
        "reference": "GAS",
        "levels": {"GAS": "Gas", "FUELOIL": "Fuel oil", "ELECTRIC": "Electric",
                   "PELLET": "Pellet", "WOOD": "Wood"},
        "expr": "IF(property_energy_heatingType IN ('GAS', 'FUELOIL', 'ELECTRIC', 'PELLET', "
                "'WOOD'), property_energy_heatingType, NULL)",
    },
    {
        "key": "newbuild", "label": "New build", "classes": ["House", "Apartment"],
        "reference": "False",
        "levels": {"True": "New build", "False": "Existing"},
        "expr": flag("flags_isNewlyBuilt"),
    },
    {
        "key": "kitchen", "label": "Kitchen", "classes": ["House", "Apartment"],
        "reference": "INSTALLED",
        "levels": {"NOT_INSTALLED": "Not installed", "SEMI_EQUIPPED": "Semi equipped",
                   "INSTALLED": "Installed", "HYPER_EQUIPPED": "Hyper equipped"},
        # USA_* are open-plan variants of the same equipment level; USA_UNINSTALLED is the
        # odd one out in naming.
        "expr": """CASE REPLACE(property_kitchen_type, 'USA_', '')
      WHEN 'UNINSTALLED' THEN 'NOT_INSTALLED'
      WHEN 'NOT_INSTALLED' THEN 'NOT_INSTALLED'
      WHEN 'SEMI_EQUIPPED' THEN 'SEMI_EQUIPPED'
      WHEN 'INSTALLED' THEN 'INSTALLED'
      WHEN 'HYPER_EQUIPPED' THEN 'HYPER_EQUIPPED'
    END""",
    },
]

EXTRA_COLS = ", ".join([
    "flags_isNewlyBuilt", "property_building_condition", "property_building_facadeCount",
    "property_energy_heatingType", "property_hasGarden", "property_hasTerrace",
    "property_parkingCountIndoor", "property_hasSwimmingPool", "property_hasLift",
    "property_energy_hasHeatPump", "property_energy_hasPhotovoltaicPanels",
    "property_energy_hasDoubleGlazing", "property_hasAttic", "property_hasBasement",
    "property_hasAirConditioning", "property_fireplaceExists", "property_kitchen_type",
    "property_land_surface",
])


def _in(values) -> str:
    return ", ".join(f"'{v}'" for v in values)


# Unpivot: one (feature, level) row per listing per feature it applies to. Restricting to the
# feature's classes in SQL (rather than in Python) keeps the grouped output small.
_unpivot = ",\n      ".join(
    f"STRUCT('{f['key']}' AS feature, IF(class IN ({_in(f['classes'])}), {f['expr']}, NULL) AS level)"
    for f in FEATURES
)

SQL = f"""
WITH latest AS ({S.union_dedup(S.SALE_TABLES, EXTRA_COLS)}),
base AS (
  SELECT * EXCEPT(yr),
         CASE WHEN yr BETWEEN 1800 AND EXTRACT(YEAR FROM CURRENT_DATE()) + 1 THEN yr END AS yr
  FROM (
    SELECT {S.REGION} AS region, {S.PROPERTY_CLASS} AS class,
           SAFE_CAST(property_building_constructionYear AS INT64) AS yr,
           {S.SALE_PRICE} AS price, {S.SURFACE} AS surface,
           {S.LISTING_MONTH} AS month,
           -- Land is only meaningful in a plausible range; outside it the median ignores it.
           IF(SAFE_CAST(property_land_surface AS FLOAT64) BETWEEN 20 AND 20000,
              SAFE_CAST(property_land_surface AS FLOAT64), NULL) AS land,
           latest.* EXCEPT(id, property_subtype, property_location_province,
                           property_netHabitableSurface, publication_creationDate,
                           property_building_constructionYear, property_land_surface)
    FROM latest
    WHERE {S.SALE_FILTERS} AND {S.SURFACE_FILTER}
      AND {S.LISTING_MONTH} >= '{WINDOW_FROM}'
  )
  WHERE region != 'Unknown' AND class != 'Multi-unit'
),
long AS (
  SELECT region, class, {ERA} AS era, month, price, surface, land,
         price / surface AS eur_m2, f.feature, f.level
  FROM base, UNNEST([
      {_unpivot}
    ]) AS f
  WHERE f.level IS NOT NULL
)
-- One pass produces the (region, class, era) cells used for premiums and the rollups per
-- region and nationally used for the absolute facade figures. See sql.py on the 1000 bucket
-- medians.
SELECT feature, class, region, era, level, COUNT(*) AS n,
       CAST(APPROX_QUANTILES(eur_m2, 1000)[OFFSET(500)] AS INT64) AS median_eur_m2,
       CAST(APPROX_QUANTILES(price, 1000)[OFFSET(500)] AS INT64) AS median_price,
       CAST(APPROX_QUANTILES(surface, 1000)[OFFSET(500)] AS INT64) AS median_surface,
       CAST(APPROX_QUANTILES(land, 1000)[OFFSET(500)] AS INT64) AS median_land,
       MAX(month) AS max_month
FROM long
GROUP BY GROUPING SETS ((feature, class, region, era, level),
                        (feature, class, region, level),
                        (feature, class, level))
HAVING n >= {MIN_CELL}
"""

rows = bq.query(SQL, label="feature-cells")

max_month = max(r["max_month"] for r in rows)

# cells[(feature, class, region, era)][level] is a result row. era None is a region rollup and
# region None the national rollup (used only for the absolute facade table).
cells: dict[tuple, dict] = {}
for r in rows:
    cells.setdefault((r["feature"], r["class"], r["region"], r["era"]), {})[r["level"]] = r


def weighted(level_rows: list[tuple[dict, dict]]) -> dict | None:
    """Sample-weighted premium of a level over its reference across (level, ref) cell pairs."""
    w = n = 0.0
    for lvl, ref in level_rows:
        if not lvl["median_eur_m2"] or not ref["median_eur_m2"]:
            continue
        w += (lvl["median_eur_m2"] / ref["median_eur_m2"] * 100 - 100) * lvl["n"]
        n += lvl["n"]
    if not n:
        return None
    return {"premium_pct": round(w / n, 1), "n": int(n),
            "n_ref": int(sum(ref["n"] for _, ref in level_rows if ref["median_eur_m2"]))}


features = []
for f in FEATURES:
    out = {"key": f["key"], "label": f["label"], "reference": f["reference"],
           "reference_label": f["levels"][f["reference"]], "classes": f["classes"],
           "absent_is_false": bool(f.get("absent_is_false")), "levels": []}
    for cls in f["classes"]:
        for code, label in f["levels"].items():
            if code == f["reference"]:
                continue
            # Every cell where both the level and the reference clear MIN_CELL.
            pairs = [(levels[code], levels[f["reference"]])
                     for (feat, c, region, era), levels in cells.items()
                     if feat == f["key"] and c == cls and region and era
                     and code in levels and f["reference"] in levels]
            nat = weighted(pairs)
            if not nat:
                continue
            by_region = {}
            for region in REGIONS:
                reg = weighted([(l, r) for l, r in pairs if l["region"] == region])
                if reg:
                    by_region[region] = reg
            out["levels"].append({"level": code, "label": label, "class": cls,
                                  **nat, "by_region": by_region})
    features.append(out)

# Absolute facade figures per region (era-free rollup) and nationally. These are pooled medians
# over the same population, so a bigger house with a lower EUR/m2 is visible as such.
facades_abs = []
for region in REGIONS + [None]:
    levels = cells.get(("facades", "House", region, None), {})
    for code in FEATURES[0]["levels"]:
        r = levels.get(code)
        if not r:
            continue
        facades_abs.append({
            "region": region or "Belgium", "facades": code, "n": r["n"],
            "median_price": r["median_price"], "median_eur_m2": r["median_eur_m2"],
            "median_surface": r["median_surface"], "median_land": r["median_land"],
        })

bq.emit({
    "features": features,
    "facades_abs": facades_abs,
    "window": f"{WINDOW_FROM} to {max_month}",
    "min_cell": MIN_CELL,
    "note": ("Each premium compares the median asking EUR/m2 of a feature level against the "
             "reference level within the same region, property class and construction era, "
             "then sample-weights across cells by the level's count. Cells where either side "
             f"has fewer than {MIN_CELL} listings are dropped. Premiums are per square metre: "
             "a feature that comes with more floor space (more facades, a garden) can raise "
             "the price of a home while lowering its EUR/m2, which is why absolute medians "
             "are given for facades. For garden, terrace, attic, basement and indoor parking "
             "the source never records an explicit no, so a blank is read as absent; for the "
             "other flags a blank is unknown and skipped."),
})
