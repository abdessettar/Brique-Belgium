# Brique

Asking prices for houses and apartments across Belgium, from January 2023 onward, for all 565
communes.

**Live site: https://belgian-real-estate-market.pages.dev**

## Pages

| Page | Content |
|---|---|
| Front page | Headline prices, rents and gross yields by region, with year on year change |
| Geography | Commune map and table: price per m², yield, asking against recorded sale prices |
| Affordability | Years of income per home, purchase costs, renting against buying, what a budget buys |
| Anatomy | What individual features add to the price per m² |
| Supply | New listings per month, new build share, the share of affordable listings |
| Energy | Price premium by EPC band and the energy rating of the stock over time |
| Every listing | The last 24 months of listings, filterable in the browser |
| Notes | Method, cleaning rules and definitions |

## How it works

The site is static and built with [Observable Framework](https://observablehq.com/framework/).
At build time, Python data loaders query a BigQuery warehouse of listings and write aggregated
JSON plus two Parquet files of individual listings. The browser does the rest; there is no
backend.

```
lib/            BigQuery client, shared SQL cleaning rules, listing extract
lib/statbel/    Statbel income per commune and the script that builds it
src/data/       one loader per dataset
src/components/ charts, maps, tables, formatting, registration duty rules
src/*.md        the pages
scripts/        post build checks and the refresh script
```

The listing data is private, so the site cannot be rebuilt from this repository alone.

## About the data

- **Asking prices, not transaction prices.** A listing records what the seller asked for.
- **Deduplicated.** Listings are observed repeatedly; every figure uses the latest observation
  of each listing.
- **Uneven coverage.** No data was collected from December 2025 to March 2026, and collection
  varied in other months. The site relies on medians and shares, which are robust to this, and
  shows missing months as gaps rather than interpolating.

## Sources

- Listings: Immoweb. Not redistributed in this repository.
- Recorded sale prices: Statbel, median sale price per commune, first half of 2025.
- Fiscal income: Statbel, fiscal statistics of income, income year 2023
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Included in `lib/statbel/`.
- Commune boundaries: Opendatasoft, georef-belgium-municipality.

## License

The code is released under the [MIT License](LICENSE). This does not cover the listing data,
which remains subject to its source's terms, or the Statbel data, which is licensed under
CC BY 4.0. The bundled Besley and Libre Franklin fonts are licensed under the
[SIL Open Font License 1.1](src/fonts/OFL.txt).
