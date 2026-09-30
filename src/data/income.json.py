"""Fiscal income per commune, the denominator for "years of income to buy the median home".

Reads lib/statbel/income_by_commune.csv (Statbel, see lib/statbel/README.md) and emits one row per
current commune, keyed on NIS so the Affordability page can join it to communes.json. The CSV is
committed, so this loader needs no credentials.

Two things differ from a straight copy of the CSV:

  * The 2023 income file predates the 1 January 2025 municipal mergers (13 in Flanders, 1 in
    Wallonia), so it carries 581 communes where the site's commune table carries 565. Each merger
    is folded below: declarations, residents and total income are summed over the predecessors and
    the average is recomputed. A median cannot be summed, so a merged commune gets the
    declaration weighted mean of its predecessors' medians and is flagged with "merged_from".
    The predecessors are small, similar neighbours, so the error is small, but it remains an
    estimate.

  * The median is preferred over the average everywhere it exists, because fiscal income is
    right skewed and the average of a commune with a few very high earners overstates what a
    typical household can borrow against. Both are per declaration (roughly per household), not
    per person.
"""
import csv
import json
import pathlib
import sys

CSV = pathlib.Path(__file__).resolve().parents[2] / "lib" / "statbel" / "income_by_commune.csv"
NATIONAL_NIS = 1000  # Statbel's code for the national total, written as a row by the CSV builder

# 1 January 2025 mergers: new NIS code and the predecessor codes as they appear in the 2023 file.
# Antwerp keeps its own code and absorbs Borsbeek as a district; every other merger got a new code.
MERGES_2025 = {
    11002: [11002, 11007],          # Antwerpen (Antwerpen, Borsbeek)
    23106: [23023, 23024, 23032],   # Pajottegem (Galmaarden, Gooik, Herne)
    37021: [37012, 37018],          # Wingene (Ruiselede, Wingene)
    37022: [37007, 37015],          # Tielt (Meulebeke, Tielt)
    44086: [44012, 44048],          # Nazareth-De Pinte (De Pinte, Nazareth)
    44087: [44034, 44073],          # Lochristi (Lochristi, Wachtebeke)
    44088: [44040, 44043],          # Merelbeke-Melle (Melle, Merelbeke)
    46029: [44045, 46014],          # Lokeren (Moerbeke, Lokeren)
    46030: [11056, 46003, 46013],   # Beveren-Kruibeke-Zwijndrecht (Zwijndrecht, Beveren, Kruibeke)
    71071: [71057, 71069],          # Tessenderlo-Ham (Tessenderlo, Ham)
    71072: [71022, 73040],          # Hasselt (Hasselt, Kortessem)
    73110: [73006, 73032],          # Bilzen-Hoeselt (Bilzen, Hoeselt)
    73111: [73009, 73083],          # Tongeren-Borgloon (Borgloon, Tongeren)
    82039: [82003, 82005],          # Bastogne (Bastogne, Bertogne)
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def num(s: str):
    return float(s) if s not in ("", None) else None


rows = {}
with open(CSV, encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        rows[int(r["nis"])] = {
            "year": int(r["year"]),
            "declarations": int(r["declarations"]),
            "avg": num(r["avg_income_per_declaration"]),
            "median": num(r["median_income_per_declaration"]),
            "residents": int(r["residents"]),
        }

national_row = rows.pop(NATIONAL_NIS)
years = {r["year"] for r in rows.values()}
assert len(years) == 1, f"expected one income year in the CSV, found {sorted(years)}"
YEAR = years.pop()
log(f"  read {len(rows)} communes for income year {YEAR}")

# Fold predecessor communes into their 2025 successors. The CSV holds the rounded average rather
# than the total, so the total is rebuilt as avg * declarations; the rounding error this carries
# is under one euro per declaration and vanishes in the recomputed average.
absorbed = set()
merged = {}
for new_nis, olds in MERGES_2025.items():
    present = [o for o in olds if o in rows]
    if len(present) != len(olds):
        # The file already uses post 2025 codes (or a code is unexpectedly missing): leave it.
        log(f"  merge {new_nis}: predecessors {sorted(set(olds) - set(present))} not in file, skipped")
        continue
    parts = [rows[o] for o in present]
    decl = sum(p["declarations"] for p in parts)
    total = sum(p["avg"] * p["declarations"] for p in parts)
    med_parts = [p for p in parts if p["median"] is not None]
    median = (sum(p["median"] * p["declarations"] for p in med_parts)
              / sum(p["declarations"] for p in med_parts)) if med_parts else None
    merged[new_nis] = {
        "year": YEAR, "declarations": decl, "avg": total / decl, "median": median,
        "residents": sum(p["residents"] for p in parts), "merged_from": present,
    }
    absorbed.update(present)

for nis in absorbed:
    rows.pop(nis)
rows.update(merged)
log(f"  folded {len(absorbed)} pre-2025 communes into {len(merged)} successors, {len(rows)} communes")

communes = []
for nis in sorted(rows):
    r = rows[nis]
    row = {
        "nis": nis,
        "declarations": r["declarations"],
        "avg_income": round(r["avg"]),
        "median_income": round(r["median"]) if r["median"] is not None else None,
        "residents": r["residents"],
    }
    if "merged_from" in r:
        row["merged_from"] = r["merged_from"]
    communes.append(row)

# Declaration weighted average across communes equals the national total divided by the national
# declaration count, so it should reproduce the national row up to rounding; check that it does.
w_decl = sum(c["declarations"] for c in communes)
w_avg = sum(c["avg_income"] * c["declarations"] for c in communes) / w_decl
if abs(w_avg - national_row["avg"]) > 5:
    log(f"  warning: weighted average {w_avg:.0f} differs from national row {national_row['avg']:.0f}")

national = {
    "avg_income": round(national_row["avg"]),
    # Statbel's own national median (all declarations pooled), taken from the per commune
    # workbook. It cannot be derived from commune medians, which is why the CSV carries a
    # national row.
    "median_income": round(national_row["median"]) if national_row["median"] is not None else None,
    "declarations": national_row["declarations"],
    "residents": national_row["residents"],
}

out = {
    "year": YEAR,
    "communes": communes,
    "national": national,
    "source": f"Statbel, fiscal statistics of income, income year {YEAR}",
    "licence": "CC BY 4.0",
    "note": ("Income is total net taxable income per tax declaration (one person, or one couple "
             "filing jointly), so it is closer to household than to personal income, and it is "
             "before tax. Zero income declarations are excluded. Communes merged on 1 January "
             "2025 carry a merged_from list; their average is exact, their median is the "
             "declaration weighted mean of the predecessors' medians and is therefore an "
             f"estimate. Income year {YEAR} is compared with asking prices observed later, so "
             "the ratio slightly overstates the burden in a rising income environment."),
    "summary": {
        "n_communes": len(communes),
        "n_merged": len(merged),
        "n_with_median": sum(1 for c in communes if c["median_income"] is not None),
    },
}
json.dump(out, sys.stdout, separators=(",", ":"))
log(f"  emitted {len(communes)} communes, national median {national['median_income']}, "
    f"national average {national['avg_income']}")
