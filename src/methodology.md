<style>
/* The reading measure: prose in a section sits in the first eight columns, tables a little wider. */
#observablehq-main .section > :is(p, dl, .lede) { max-width: min(66ch, 792px); }
#observablehq-main .notes-table, #observablehq-main .notes-example { width: 100%; max-width: 792px; margin: 18px 0 22px; }
.notes-table td:last-child, .notes-table th:last-child { padding-right: 0; }
.notes-table td.bound { color: var(--ink-1); white-space: nowrap; }
.notes-table td.rule { color: var(--ink-1); }
.notes-example td:last-child, .notes-example th:last-child { padding-right: 0; }
.notes-scroll { overflow-x: auto; }
.notes-material { white-space: nowrap; }
.notes-material .swatch { vertical-align: middle; margin: 0 7px 0 1px; }
dl.glossary { margin: 12px 0 0; }
.calendar { margin: 0; }
.calendar svg { display: block; max-width: 100%; overflow: visible; }
@media (max-width: 479.98px) { .notes-table td.bound { white-space: normal; } }
</style>

<p class="kicker">Notes</p>

# Notes on the figures

```js
const coverage = FileAttachment("data/coverage.json").json();
const communes = FileAttachment("data/communes.json").json();
const epc = FileAttachment("data/epc.json").json();
const income = FileAttachment("data/income.json").json();
```

```js
import {INK_1, INK_2, INK_3, PAGE, BRICK, BLUESTONE, GILT} from "./components/palette.js";
import {num, eur, eurM2Short, pct, pctWord, plural, monthName} from "./components/sentences.js";
import {STYLE, hatch} from "./components/chrome.js";
import {kicker, headline, caption, source, standingNote, swatch, hatchSwatch} from "./components/figure.js";
```

<div class="row top"><div class="main"><p class="lede">Every figure in this bulletin is an asking price, a rent asked, or a ratio of the two, read from property listings and summarised by the median. These notes say what was counted, what was left out, how the months with nothing recorded are drawn, and what each term means. They are numbered so that a figure elsewhere can refer to them.</p></div>${standingNote()}</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">The listings</p>

## What the data is

<p class="lede">The bulletin reads listings, not deeds. A listing records what a seller advertised and for how long it was advertised, not what a buyer paid.</p>

Each listing is observed on many days while it is on the market. It is counted once, at its latest observation, so a property that stayed on the market for a year and was seen two hundred times is one listing with one price. About 1.5 million distinct listings lie behind roughly 6 million observations, and every median on the site is taken over the listings, never over the observations.

A listing's month is the month it came to market, taken from the listing's own publication date, so the time axis shows when properties were offered and not when they happened to be looked at.

Four segments are covered: houses and apartments, for sale and to rent. Recorded sale prices, the prices buyers actually paid, come from Statbel for the first half of 2025 and appear on [Geography](./geography), where asking and recorded medians are set side by side commune by commune. Nowhere else on the site is a price anything other than an asking price.

</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">Days observed</p>

## Coverage

<p class="lede">Listings were not observed every day. The calendar below shows, month by month, on how many days they were, and the four months on which nothing was recorded at all.</p>

```js
const cal = coverage.months.map((m) => {
  const year = +m.month.slice(0, 4), mo = +m.month.slice(5, 7);
  const dim = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  return {month: m.month, year, m: mo, days: m.days_observed, dim, frac: Math.min(1, m.days_observed / dim)};
});
const years = [...new Set(cal.map((d) => d.year))];
const observedDays = d3.sum(cal, (d) => d.days);
const calendarDays = (() => {
  const f = cal[0], l = cal.at(-1);
  return Math.round((Date.UTC(l.year, l.m, 1) - Date.UTC(f.year, f.m - 1, 1)) / 864e5);
})();
const gapMonths = coverage.gap_months;
const fullMonths = cal.filter((d) => d.days >= d.dim).length;
const thinnest = cal.filter((d) => d.days > 0).reduce((a, b) => (b.frac < a.frac ? b : a));
const h21 = `Listings were observed on ${num(observedDays)} of ${num(calendarDays)} days.`;
// A day count is printed on INK_2 drawn at the month's opacity over the page. The crossover
// where page-colour ink overtakes dark ink on that blend is about 0.7; either side of it every
// month clears 3.7:1, where a luminance test on the blend left the mid tones below 3:1.
const textOn = (frac) => (frac > 0.7 ? PAGE : INK_1);
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", "Coverage calendar")}
${headline(h21)}
<div class="fig-pair"><div class="chart-7 calendar">

```js
display(resize((width) => {
  // The grid fills its column rather than sitting at a fixed size in an empty block.
  const cell = Math.max(26, Math.min(52, Math.floor((width - 48) / 12)));
  const ml = 44, mt = 26;
  const svg = Plot.plot({
    width: ml + 12 * cell + 4,
    height: mt + years.length * cell + 4,
    marginLeft: ml, marginTop: mt, marginRight: 4, marginBottom: 4,
    style: STYLE,
    x: {domain: d3.range(1, 13), padding: 0, label: null, axis: null},
    y: {domain: years, padding: 0, label: null, axis: null},
    marks: [
      Plot.axisX({anchor: "top", tickSize: 0, tickPadding: 7, label: null, fill: INK_3, fontSize: 11.5, fontWeight: 500,
        tickFormat: (m) => "JFMAMJJASOND"[m - 1]}),
      Plot.axisY({tickSize: 0, tickPadding: 10, label: null, fill: INK_1, fontSize: 12.5, fontWeight: 500, tickFormat: (y) => String(y)}),
      Plot.cell(cal.filter((d) => d.days > 0), {x: "m", y: "year", fill: INK_2, fillOpacity: (d) => d.frac, inset: 0.5}),
      Plot.cell(cal.filter((d) => d.days === 0), {x: "m", y: "year", fill: "url(#nodata-fig-2-1)", inset: 0.5}),
      Plot.text(cal.filter((d) => d.days > 0), {x: "m", y: "year", text: (d) => String(d.days), fill: (d) => textOn(d.frac), fontSize: cell >= 36 ? 12.5 : 11.5,
        fontVariant: "tabular-nums"}),
      Plot.tip(cal, Plot.pointer({x: "m", y: "year", title: (d) => `${monthName(d.month)}\n${d.days === 0 ? "No listings recorded" : `Observed on ${plural(d.days, "day")} of ${d.dim}`}`}))
    ]
  });
  hatch(svg, "nodata-fig-2-1");
  return svg;
}));
```

</div><div class="text-5">

<p>A month with listings observed on every day is drawn in full ink; ${monthName(thinnest.month)}, the thinnest month with any listings at all, was observed on ${plural(thinnest.days, "day")} of ${thinnest.dim} and is drawn at ${pctWord(100 * thinnest.frac, 0)} of that. ${num(fullMonths)} of the ${num(cal.length)} months are complete. From ${monthName(gapMonths[0])} to ${monthName(gapMonths.at(-1))} nothing was recorded on any day, and those four months are hatched here and on every time chart in the bulletin.</p>

<p>The unevenness does not touch a median. The middle asking price of two thousand listings is the middle asking price whether they were seen on eleven days or thirty, provided the days are not chosen by price, and there is no reason they would be. The same holds for a share of listings, a price per square metre and a yield, which are all ratios within the month. Those figures carry the bulletin.</p>

<p>A count of listings is different. It measures how many days there were to see them as much as how many there were, so wherever a count appears it is read with this calendar, and a month with few observed days is read as thinly observed, not as quiet.</p>

</div></div>
${caption("Years run down the page and months across it; each cell prints the number of days in the month on which listings were observed, and is filled in ink in proportion to that number. Hatched months have no data.")}
${source(`Source: listings, ${monthName(cal[0].month)} to ${monthName(cal.at(-1).month)}. A day counts when at least one listing was observed on it.`)}
</figure>

<div class="footnotes">
<p>The four unobserved months are drawn as one hatched band on every time chart, labelled once. Lines break at the band and are never bridged across it, so no reading is ever an interpolation. Where a month's sample is too thin to trust, the point is dropped and the line breaks in the same way.</p>
</div>

</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">What was left out</p>

## Cleaning rules

<p class="lede">A few bounds are applied to every figure before anything is counted. They remove the entries that are not a dwelling at a price, and they trim the ends of the distribution where a misplaced digit would otherwise move a median.</p>

<table class="notes-table">
<thead><tr><th>Rule</th><th class="r">Bound</th></tr></thead>
<tbody>
<tr><td>Sale prices, trimmed at the 1st and 99th percentile</td><td class="r bound">€80,000 to €2,150,000</td></tr>
<tr><td>Monthly rent asked</td><td class="r bound">€300 to €15,000</td></tr>
<tr><td>Habitable surface, applied only where a figure per square metre is computed</td><td class="r bound">11 to 2,000 m²</td></tr>
<tr><td>Life annuity sales and plots sold with an obligation to build</td><td class="r bound">excluded</td></tr>
<tr><td>Multi-unit stock, apartment blocks and mixed use buildings, because it is priced per building and not per dwelling</td><td class="r bound">excluded</td></tr>
<tr><td>Construction year, populated in 64 percent of listings</td><td class="r bound">not required</td></tr>
</tbody>
</table>

The property class is read from the listing's own subtype. Houses are the listings marked house, villa, mansion, town house, bungalow, country cottage, farmhouse, chalet, manor house or castle; apartments are those marked apartment, duplex, triplex, penthouse, studio, loft, ground floor flat, service flat or student room. The heading a listing was published under is not used, because it is not reliable: a good number of apartments are published under houses.

</section>

<section class="section" id="s4">
<span class="section-num">4</span><p class="kicker">Rent against price</p>

## Gross rental yield


<p class="lede">The gross yield is the year's rent asked for a property, as a share of the price asked for a property like it. It is a ratio of two medians, not the return on any one property.</p>

<p class="formula">gross yield = 12 × median asking rent ÷ median asking price</p>

```js
const minSide = communes.summary.min_side_sample;
const yieldLine = `${num(communes.summary.n_with_yield)} of ${num(communes.summary.n_communes)} communes qualify.`;
```

It is computed per commune, and per property class within a commune, only where both sides carry at least ${plural(minSide, "listing")}: ${minSide} for sale and ${minSide} to rent. ${yieldLine} The rest are hatched on the map and left blank in the tables.

The figure is a market ratio and not an investment return. The rent median and the sale median come from different properties, so the yield describes a place, not a flat that could be bought. It is gross: it ignores the registration duty and notary costs of buying, maintenance, months without a tenant, management and tax, each of which lowers the return an owner would actually see.

</section>

<section class="section" id="s5">
<span class="section-num">5</span><p class="kicker">Comparing like with like</p>

## Within-cell premiums


<p class="lede">Energy and Anatomy both report how much more, per square metre, a listing with a feature asks than one without it. Comparing the two groups directly across the whole country would mostly restate geography and building age, so the comparison is made inside cells.</p>

A cell is one region, one property class and one construction era. Inside each cell the median price per square metre of listings with the feature is set against the median for the reference level in the same cell: the D band for energy certificates, three facades for a house's facades, and so on. The cell premiums are then averaged across cells, each weighted by the number of listings that carried the feature in it, so a cell of forty listings does not count as much as a cell of four thousand. A cell with fewer than 25 listings on either side is dropped before weighting, and a feature whose remaining cells are too thin is drawn as a hatched row with the words "too few listings".

```js
const ERA = {"Pre-1945": "built before 1945", "1945-1969": "built 1945 to 1969", "1970-1989": "built 1970 to 1989", "1990-2009": "built 1990 to 2009", "2010+": "built 2010 or later", "Unknown": "year unknown"};
const exampleCells = [["Flanders", "House", "1945-1969"], ["Wallonia", "Apartment", "2010+"], ["Brussels", "Apartment", "2010+"]].map(([region, cls, era]) => {
  const find = (b) => epc.cells.find((c) => c.region === region && c.class === cls && c.era === era && c.epc === b);
  const ref = find("D"), feat = find("A");
  return {cell: `${region}, ${cls.toLowerCase()}s, ${ERA[era]}`, ref, feat, premium: (feat.median_eur_m2 / ref.median_eur_m2 - 1) * 100};
});
```

<div class="notes-scroll"><table class="notes-example">
<thead><tr><th>Cell</th><th class="r">D band (reference)</th><th class="r">A band</th><th class="r">Premium</th></tr></thead>
<tbody>${exampleCells.map((d) => html`<tr><td class="name">${d.cell}</td><td class="r">${eurM2Short(d.ref.median_eur_m2)}</td><td class="r">${eurM2Short(d.feat.median_eur_m2)}</td><td class="r">${pct(d.premium, 1, true)}</td></tr>`)}</tbody>
</table></div>

<div class="footnotes">
<p>A worked example for the A band against the D band, in three cells. The premium a page reports for the A band is the weighted mean of every such cell; the three shown here are chosen so that each region appears once. The D band listings in each row are the reference and never carry a premium themselves.</p>
</div>

</section>

<section class="section" id="s6">
<span class="section-num">6</span><p class="kicker">Income, duty and fees</p>

## Affordability definitions


<p class="lede">Affordability sets an asking price against what the people of a commune declare as income, and then against what buying costs once the duty and the notary are paid.</p>

Income is Statbel's median net taxable income per tax declaration, from ${income.source}. A declaration is one person or one couple filing jointly, so the figure sits between one earner and one household, and at a national median of ${eur(income.national.median_income)} it lands nearer the earner. This matters for the ratio: the price-to-income multiple usually quoted divides by a household's whole income and comes out around half of what the <a href="./affordability">Affordability</a> page reports. The figure is before tax, and zero income declarations are left out.

The years-of-income ratio divides an asking price observed in 2026 by an income declared for 2023, the latest year published. The two years of income growth in between are not in the denominator, so the ratio is biased upward by that much, and it is a market ratio: the price of the median listing over the income of the median declaration, not the burden on any household that is actually buying. The ${plural(income.summary.n_merged, "commune")} merged on 1 January 2025 carry an estimate, the declaration-weighted mean of their predecessors' medians; their average income is exact.

<table class="notes-table">
<thead><tr><th>Registration duty</th><th class="r">Sole main home</th><th class="r">Other purchase</th></tr></thead>
<tbody>
<tr><td class="name">Flanders</td><td class="r bound">2%</td><td class="r bound">12%</td></tr>
<tr><td class="name">Wallonia</td><td class="r bound">3%</td><td class="r bound">12.5%</td></tr>
<tr><td class="name">Brussels</td><td class="r bound">12.5%, first €200,000 exempt</td><td class="r bound">12.5%</td></tr>
</tbody>
</table>

The rules are those in force on 1 January 2025. The Brussels exemption applies only when the price is under €600,000. New build is bought with 21 percent VAT on the building instead of registration duty and is excluded from the calculator. Notary fees and deed costs are an estimate, a fixed sum plus a small share of the price, and the actual bill depends on the deed.

</section>

<section class="section" id="s7">
<span class="section-num">7</span><p class="kicker">Terms</p>

## Glossary

<dl class="glossary">
<dt>Asking price</dt>
<dd>The price a seller advertises a property at. It is what the listing says, not what the buyer paid; Belgian sale prices usually settle below it.</dd>
<dt>Commune</dt>
<dd>The Belgian municipality, gemeente in Dutch and commune in French. There are 565 since the mergers of 1 January 2025. A listing is placed in its commune by postal code.</dd>
<dt>Province</dt>
<dd>One of the ten provinces: Antwerp, East Flanders, West Flanders, Flemish Brabant and Limburg in Flanders; Hainaut, Liège, Luxembourg, Namur and Walloon Brabant in Wallonia. Brussels belongs to no province.</dd>
<dt>Region</dt>
<dd>Flanders, Wallonia or the Brussels Capital Region, the three federated regions. Each sets its own registration duty and its own energy certificate.</dd>
<dt>EPC</dt>
<dd>The energy performance certificate every listing must carry, EPC in Flanders and PEB in Wallonia and Brussels, graded from A++ to G. The bands are set on different scales in the three regions, which is one reason premiums are computed within a region.</dd>
<dt>2, 3 and 4 facades</dt>
<dd>The Belgian way of describing a house by how many of its walls are free. A 2 facade house is terraced, with neighbours on both sides; a 3 facade house is semi-detached; a 4 facade house is detached.</dd>
<dt>Registration duty</dt>
<dd>The regional tax paid on the purchase of an existing property, as a share of the price. New build is bought with VAT instead.</dd>
<dt>Gross yield</dt>
<dd>Twelve months of the median rent asked, divided by the median price asked, in the same commune and property class. See note 4.</dd>
<dt>Median</dt>
<dd>The middle value: half the listings ask more and half ask less. It is used everywhere instead of the average because a handful of exceptional properties would otherwise move the figure.</dd>
<dt>Trimmed</dt>
<dd>Cut off at both ends. Sale prices below €80,000 or above €2,150,000, the 1st and 99th percentiles, are left out of every figure rather than pulled back to the bound, so a price typed with a digit too many cannot move a median.</dd>
</dl>

</section>

<section class="section" id="s8">
<span class="section-num">8</span><p class="kicker">Conventions</p>

## Colour and type

<p class="lede">Colour on these pages is material, and one hatch means one thing everywhere.</p>

<p>The three regions are drawn in the materials of their buildings: <span class="notes-material">${swatch(BRICK)} Flanders in fired brick,</span> <span class="notes-material">${swatch(BLUESTONE)} Wallonia in Soignies bluestone,</span> <span class="notes-material">${swatch(GILT)} Brussels in Grand Place gilt.</span> Where houses and apartments are compared instead of regions, houses take the brick and apartments the bluestone. The three were checked against each other on the page colour: the closest pair, gilt against brick, is 17.4 units apart under deuteranopia and 19.8 in normal vision, and every mark on the page reads at a contrast of at least 3.26 to 1. Gilt is a mark colour only; wherever Brussels appears as a word it is set in a darker gilt that clears the contrast for text.</p>

<p>Energy bands are thermal rather than green and red: the insulated bands A++ to C in shades of bluestone, D in mortar, the neutral reference, and E to G in shades of brick. The adjacent pairs at the top and bottom of the scale sit near the limit of what colour vision separates, so the letter of the band is always printed on or beside its mark.</p>

<p><span class="notes-material">${hatchSwatch()} Hatching</span> means not observed, and it means it everywhere: the four months from ${monthName(gapMonths[0])} to ${monthName(gapMonths.at(-1))} on every time chart, a commune without enough listings on a map, a cell under the sample floor in a matrix, a row under the floor in a ladder. A blank is never drawn as a zero.</p>

<p>Two typefaces with separate jobs. Besley, a Clarendon, sets what the bulletin says: the titles, the headline sentences over each figure and the big figures of the ledger. Libre Franklin sets what it counts: every sentence and every number in a table, on an axis or in a note, with tabular figures so that columns align. Percent is a word in a sentence and a sign in a table; a negative number takes the true minus; a range is written as one value to another.</p>

</section>

<section class="section" id="s9">
<span class="section-num">9</span><p class="kicker">Terms</p>

## No advice

<p class="lede">This bulletin reports a market. It does not counsel anyone on what to do about it.</p>

<p>Nothing here is investment, financial, legal or tax advice, and nothing in it recommends buying, selling or letting any property. A yield, a premium and a years-of-income ratio are descriptions of a market, computed from what sellers asked. They are not forecasts, not valuations of any particular property, and not a statement that any purchase would be sound.</p>

<p>The figures are estimates. They come from listings, which are written by sellers and their agents and are not verified here; they are trimmed and deduplicated as section 3 describes, but they will still contain errors, omissions and properties that never sold at the price asked. Months with little or no observation are marked, and the reasons a figure can mislead are set out throughout these notes. Everything is published as it is, without warranty of any kind, and no liability is accepted for any loss or decision arising from it.</p>

<p>Anyone weighing a real property should verify every figure against the deed, the certificate and the cadastre, and take advice from a notary, a mortgage lender, a surveyor or a tax adviser as the case requires. The registration duty and notary costs on the <a href="./affordability">Affordability</a> page are an indication of the rules in force on 1 January 2025 and a simplification of them; they are not a quotation, and the rules change.</p>

</section>
