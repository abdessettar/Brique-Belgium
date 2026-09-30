"""Collection coverage per month.

No data was collected from 2025-12 to 2026-03, and elsewhere collection ran on 6 to 31 days a
month, so any count based series partly reflects collection rather than the market. Count charts
read this file to flag or break the line where coverage is poor.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "lib"))

import bq
from sql import PROJECT, SALE_TABLES, RENT_TABLES

TABLES = SALE_TABLES + RENT_TABLES

parts = [f"""
SELECT '{t}' AS source,
       SUBSTR(metaDateScraped, 1, 7) AS month,
       COUNT(DISTINCT SUBSTR(metaDateScraped, 1, 10)) AS days_observed,
       COUNT(DISTINCT id) AS listings_seen
FROM `{PROJECT}.raw.{t}`
WHERE metaDateScraped IS NOT NULL AND metaDateScraped != ''
GROUP BY 1, 2""" for t in TABLES]

rows = bq.query("\nUNION ALL\n".join(parts) + "\nORDER BY month, source", label="coverage")

by_month: dict[str, dict] = {}
for r in rows:
    m = by_month.setdefault(r["month"], {"month": r["month"], "days_observed": 0,
                                         "listings_seen": 0, "sources": 0})
    # Max rather than sum: all four tables are collected on the same days.
    m["days_observed"] = max(m["days_observed"], r["days_observed"])
    m["listings_seen"] += r["listings_seen"]
    m["sources"] += 1

months = sorted(by_month.values(), key=lambda r: r["month"])

# Add the months with no rows at all, so the gap is explicit in the output.
if months:
    start, end = months[0]["month"], months[-1]["month"]
    seen = {m["month"] for m in months}
    y, mo = int(start[:4]), int(start[5:])
    filled = []
    while f"{y:04d}-{mo:02d}" <= end:
        key = f"{y:04d}-{mo:02d}"
        filled.append(next(m for m in months if m["month"] == key) if key in seen
                      else {"month": key, "days_observed": 0, "listings_seen": 0, "sources": 0})
        mo = mo + 1 if mo < 12 else 1
        y = y if mo != 1 else y + 1
    months = filled

for m in months:
    d = m["days_observed"]
    m["quality"] = "none" if d == 0 else "poor" if d < 15 else "partial" if d < 25 else "good"

bq.emit({
    "months": months,
    "gap_months": [m["month"] for m in months if m["days_observed"] == 0],
    "note": ("Collection ran on 6 to 31 days per month and stopped entirely between 2025-12 "
             "and 2026-03. Counts in low coverage months reflect collection, not market "
             "activity. Prices and ratios are far less affected."),
})
