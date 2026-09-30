"""Build income_by_commune.csv from the two Statbel fiscal income publications.

Inputs (both free downloads, see README.md next to this file):
  * TF_PSNL_INC_TAX_MUNTY.txt   pipe separated open data, one row per commune per income year,
                                 carries counts, totals and residents but no median
  * fiscYYYY_C_NL.xlsx           the "per gemeente" workbook, whose sheet "Totaal" carries
                                 "Mediaan inkomen per aangifte" per NIS code

Only the latest income year in the txt is kept, and the xlsx must be the workbook for that same
year (the script checks the "Inkomstenjaar YYYY" header on the sheet). The workbook is read with
zipfile and xml.etree so this runs on a bare interpreter, no openpyxl.

A national row (nis 1000, the NIS code Statbel uses for "België") is written as well, because it
is the only place a true national median exists: a median cannot be rebuilt from commune medians.

Usage:
  python3 lib/statbel/build_income_csv.py TF_PSNL_INC_TAX_MUNTY.txt fisc2023_C_NL.xlsx
"""
from __future__ import annotations

import csv
import pathlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

OUT = pathlib.Path(__file__).resolve().parent / "income_by_commune.csv"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "p": "http://schemas.openxmlformats.org/package/2006/relationships"}
NATIONAL_NIS = 1000

FIELDS = ["nis", "name_nl", "name_fr", "year", "declarations",
          "avg_income_per_declaration", "median_income_per_declaration", "residents"]


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def _col_index(ref: str) -> int:
    """Zero based column index of a cell reference: 'B8' gives 1."""
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_sheet(xlsx: pathlib.Path, sheet_name: str) -> list[list]:
    """Return the rows of one worksheet as lists of python values (str, float or None)."""
    with zipfile.ZipFile(xlsx) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = {rel.get("Id"): rel.get("Target")
                for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall("p:Relationship", NS)}
        target = None
        for s in wb.find("m:sheets", NS):
            if s.get("name") == sheet_name:
                target = rels[s.get(f"{{{NS['r']}}}id")]
        if target is None:
            raise SystemExit(f"sheet {sheet_name!r} not found in {xlsx}")
        path = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
        root = ET.fromstring(z.read(path))
    rows = []
    for row in root.find("m:sheetData", NS):
        values: list = []
        for c in row.findall("m:c", NS):
            idx = _col_index(c.get("r"))
            while len(values) <= idx:
                values.append(None)
            t = c.get("t")
            v = c.find("m:v", NS)
            if v is None and t != "inlineStr":
                continue  # styled but empty cell
            if t == "s":
                values[idx] = shared[int(v.text)]
            elif t == "inlineStr":
                values[idx] = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
            elif v is not None:
                values[idx] = float(v.text) if t != "str" else v.text
        rows.append(values)
    return rows


def read_medians(xlsx: pathlib.Path) -> tuple[int, dict[int, float]]:
    rows = read_sheet(xlsx, "Totaal")
    year = None
    header_i = None
    for i, r in enumerate(rows[:12]):
        for v in r:
            if isinstance(v, str) and (m := re.fullmatch(r"Inkomstenjaar (\d{4})", v.strip())):
                year = int(m.group(1))
        if r and r[0] == "Administratieve Eenheid":
            header_i = i
    if year is None or header_i is None:
        raise SystemExit("could not find 'Inkomstenjaar YYYY' and the header row on sheet Totaal")
    header = rows[header_i]
    nis_col = header.index("NIS code")
    med_col = header.index("Mediaan inkomen per aangifte")
    medians: dict[int, float] = {}
    for r in rows[header_i + 1:]:
        if len(r) <= med_col or not isinstance(r[nis_col], str) or not re.fullmatch(r"\d{5}", r[nis_col]):
            continue
        nis = int(r[nis_col])
        # Regions, provinces and arrondissements share the sheet (codes ending in 000, plus the
        # German speaking community 03001 and the two Brabant provinces 20001/20002). Communes
        # are the rest; the national row 01000 is kept on purpose.
        if nis != NATIONAL_NIS and (nis % 1000 == 0 or nis in (3001, 20001, 20002)):
            continue
        if isinstance(r[med_col], (int, float)):
            medians[nis] = float(r[med_col])
    return year, medians


def main(txt: pathlib.Path, xlsx: pathlib.Path) -> None:
    with open(txt, encoding="utf-8-sig") as fh:
        raw = list(csv.DictReader(fh, delimiter="|"))
    year = max(int(r["CD_YEAR"]) for r in raw)
    xl_year, medians = read_medians(xlsx)
    if xl_year != year:
        raise SystemExit(f"txt latest income year is {year} but the xlsx is for {xl_year}")

    out = []
    tot_decl = tot_inc = tot_res = 0
    for r in raw:
        if int(r["CD_YEAR"]) != year:
            continue
        nis = int(r["CD_MUNTY_REFNIS"])
        decl = int(r["MS_NBR_NON_ZERO_INC"])
        inc = float(r["MS_TOT_NET_TAXABLE_INC"])
        res = int(r["MS_TOT_RESIDENTS"])
        tot_decl += decl; tot_inc += inc; tot_res += res
        out.append({
            "nis": nis, "name_nl": r["TX_MUNTY_DESCR_NL"], "name_fr": r["TX_MUNTY_DESCR_FR"],
            "year": year, "declarations": decl,
            "avg_income_per_declaration": round(inc / decl) if decl else "",
            "median_income_per_declaration": medians.get(nis, ""),
            "residents": res,
        })
    missing = [o["nis"] for o in out if o["median_income_per_declaration"] == ""]
    if missing:
        log(f"  warning: no median for {len(missing)} communes: {missing}")
    if NATIONAL_NIS not in medians:
        raise SystemExit("national row (NIS 01000) with a median not found on sheet Totaal")
    out.append({
        "nis": NATIONAL_NIS, "name_nl": "België", "name_fr": "Belgique", "year": year,
        "declarations": tot_decl, "avg_income_per_declaration": round(tot_inc / tot_decl),
        "median_income_per_declaration": medians[NATIONAL_NIS], "residents": tot_res,
    })
    out.sort(key=lambda o: o["nis"])
    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    log(f"  wrote {OUT} : {len(out) - 1} communes + national row, income year {year}, "
        f"{len(medians) - 1} commune medians from {xlsx.name}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
