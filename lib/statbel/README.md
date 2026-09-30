# Statbel fiscal income by commune

`income_by_commune.csv` is an extract of Statbel's fiscal statistics of income, used by
`src/data/income.json.py` for the Affordability page.

## Source

Statbel (Directorate General Statistics, Statistics Belgium), Fiscal statistics of income,
income year 2023. Published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- Open data file `TF_PSNL_INC_TAX_MUNTY`:
  https://statbel.fgov.be/en/open-data/fiscal-statistics-income
- Medians per commune, sheet `Totaal` of
  https://statbel.fgov.be/sites/default/files/files/documents/Huishoudens/10.9%20Fiscale%20inkomens/fisc2023_C_NL.xlsx

## Columns

| Column | Meaning |
|---|---|
| `nis` | NIS commune code. `1000` is the national total. |
| `name_nl`, `name_fr` | Commune name in Dutch and French |
| `year` | Income year (taxes are assessed the following year) |
| `declarations` | Tax declarations with a net taxable income above zero. A joint declaration counts once. |
| `avg_income_per_declaration` | Total net taxable income divided by `declarations` |
| `median_income_per_declaration` | Statbel's median net taxable income per declaration |
| `residents` | Population on 1 January of the assessment year |

The 2023 file predates the 1 January 2025 municipal mergers and lists 581 communes; the loader
folds them into the 565 current ones.

## Rebuilding

```
python3 lib/statbel/build_income_csv.py TF_PSNL_INC_TAX_MUNTY.txt fiscYYYY_C_NL.xlsx
```
