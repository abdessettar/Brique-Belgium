<style>
/* Affordability only. */
.aff-controls { grid-template-columns: 112px minmax(0, 1fr); }
.aff-controls .ctl-label { line-height: 1.3; }
.aff-controls form input[type="range"] { width: 150px; }
.aff-strip svg text, .aff-budget svg text { font-family: "Libre Franklin", "Helvetica Neue", Arial, sans-serif; }
/* The worksheet drives the statement, so on narrow screens it stays above it. */
@media (max-width: 1023.98px) {
  #fig-2-1 .fig-pair > .text-5-first { order: 1; }
  #fig-2-1 .fig-pair > .chart-7-last { order: 2; }
}
</style>

```js
import {REGIONS, REGION_COLOR, REGION_TEXT, CLASSES, CLASS_COLOR, INK_1, INK_2, INK_3, PAGE, GRID, BRICK, BLUESTONE} from "./components/palette.js";
import {eur, eurK, rent, num, pct, pctWord, fixed, plural, range, median, monthName} from "./components/sentences.js";
import {STYLE, h, marginRight, MARGINS, shortName, hatch, valueAxisY} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote, legend} from "./components/figure.js";
import {communeMap, DEFAULT_READOUT} from "./components/choropleth.js";
import {receipt} from "./components/table.js";
import {RULES_AS_OF, registrationDuty, notaryEstimate, statement, rentVsBuy, rentVsBuyBand, crossing} from "./components/duty.js";
```

```js
const communes = FileAttachment("data/communes.json").json();
const geo = FileAttachment("data/communes.geo.json").json();
const income = FileAttachment("data/income.json").json();
const budget = FileAttachment("data/budget.json").json();
```

```js
// Commune names as the listings spell them are sometimes in capitals; the map's own names are
// the official ones, so they are preferred, and the listing spelling is title-cased as a fallback.
const PARTICLES = new Set(["ten", "op", "den", "de", "aan", "en", "la", "le", "les", "sur", "lez"]);
const titleCase = (s) => String(s ?? "").toLowerCase().split(/(\s+|-|'|’)/).map((part, i) =>
  /^(\s+|-|'|’)$/.test(part) || (i > 0 && PARTICLES.has(part)) ? part : part.charAt(0).toUpperCase() + part.slice(1)).join("");
const geoName = new Map(geo.features.map((f) => [+f.properties.nis, f.properties.name]));
const incomeByNis = new Map(income.communes.map((r) => [+r.nis, r]));
const MIN_SALE = communes.summary.min_side_sample;
const joined = communes.communes.map((r) => {
  const inc = incomeByNis.get(+r.nis);
  const ok = inc?.median_income > 0 && r.median_price > 0 && r.n_sale >= MIN_SALE;
  return {
    ...r,
    name: geoName.get(+r.nis) ?? titleCase(r.locality),
    median_income: inc?.median_income ?? null,
    merged: Boolean(inc?.merged_from),
    years_of_income: ok ? r.median_price / inc.median_income : null
  };
});
const qualifying = joined.filter((d) => d.years_of_income != null);
const ADJ = {Flanders: "Flemish", Wallonia: "Walloon", Brussels: "Brussels"};
const NOUN = {House: "house", Apartment: "apartment"};
const NOUNS = {House: "houses", Apartment: "apartments"};
```

<p class="kicker">Income, buying costs and what a budget buys</p>

# Affordability

<div class="row top">
<div class="main">
<p class="lede">How many years of a commune's median tax declaration its median home asks, what buying costs against renting, and what a budget buys where.</p>
</div>
<aside class="side">${standingNote()}${sidenote("Income", html`Income is Statbel's median net taxable income per tax declaration, income year ${income.year}, joined to 2026 asking prices; the ratio is upward biased by two years of income growth and is a market ratio, not a household one. Communes merged on 1 January 2025 carry a declaration-weighted estimate. Source: ${income.source}.`)}</aside>
</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">Price to income</p>

## Years of a tax declaration

<p class="lede">The median asking price of a commune's homes divided by the median income on a tax declaration there. A declaration is one person or one couple filing together, so it sits nearer one salary than one household: the price-to-income multiple usually quoted divides by a household's whole income and comes out around half of this. Both are medians of a place, so the ratio says how far the local market sits from the local purse, not whether any one household can buy.</p>

```js
const LAYERS = {years_of_income: {label: "Years of a tax declaration", kind: "sequential", breaks: [7, 8, 9, 10, 12, 15], format: (v) => fixed(v, 1), unit: "years"}};
const READOUT = [
  ...DEFAULT_READOUT.filter((r) => r.key === "median_price" || r.key === "n_sale"),
  {label: "Median income", key: "median_income", format: eur},
  {label: "Years of a declaration", key: "years_of_income", format: (v) => fixed(v, 1)}
];
const yearsMedian = median(qualifying.map((d) => d.years_of_income));
const NATIONAL = {
  median_price: median(qualifying.map((d) => d.median_price)),
  n_sale: d3.sum(qualifying, (d) => d.n_sale),
  median_income: income.national.median_income,
  years_of_income: yearsMedian
};
const cheapest = d3.least(qualifying, (d) => d.years_of_income);
const dearest = d3.greatest(qualifying, (d) => d.years_of_income);
const h11 = `A median home costs ${fixed(yearsMedian, 1)} years of a median tax declaration in the median commune, ${fixed(cheapest.years_of_income, 1)} in ${cheapest.name} and ${fixed(dearest.years_of_income, 1)} in ${dearest.name}.`;
```

<figure class="fig" id="fig-1-1">
${kicker("1.1", "Years of a median tax declaration asked by the median home, by commune")}
${headline(h11)}
<div class="fig-chart">

```js
display(resize((width) => communeMap({geo, rows: joined, layers: LAYERS, layer: "years_of_income", width, id: "fig-1-1", readout: READOUT, national: NATIONAL})));
```

</div>
${caption(`Each commune is filled by the years of its median declared income that its median asking price represents, in brick from light for under seven years to dark for fifteen years and over; the class ranges and commune counts are in the column beside the map. Hover a commune, or tap it to pin, and the panel prints its price, income and ratio; at rest it prints the national figures. Hatched communes have fewer than ${num(MIN_SALE)} sale listings and carry no ratio.`)}
${source(`Source: listings, every commune with at least ${num(MIN_SALE)} sale listings, each listing counted once at its latest observation; ${income.source}, median net taxable income per declaration. ${num(qualifying.length)} of ${num(joined.length)} communes carry a ratio.`)}
</figure>

```js
const regionMedians = REGIONS.map((region) => ({region, value: median(qualifying.filter((d) => d.region === region).map((d) => d.years_of_income)), n: qualifying.filter((d) => d.region === region).length}))
  .filter((d) => d.value != null);
const rmSorted = [...regionMedians].sort((a, b) => a.value - b.value);
const [rmLow, ...rmRest] = rmSorted;
const overClauses = rmRest.map((d, i) => `half of ${ADJ[d.region]} communes ${i === 0 ? "cost " : ""}over ${fixed(d.value, 1)}`);
const h12 = `Half of ${ADJ[rmLow.region]} communes cost under ${fixed(rmLow.value, 1)} years of a median declaration; ${overClauses.join(" and ")}.`;
// Deterministic jitter from the NIS code, so a dot sits in the same place on every render.
const jitter = (nis) => { let x = (nis * 2654435761) % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((x >>> 8) % 1000) / 1000 - 0.5; };
const ROW = 40;
```

<figure class="fig" id="fig-1-2">
${kicker("1.2", "Years of a median tax declaration, every commune by region")}
${headline(h12)}
<div class="fig-chart aff-strip">

```js
display(resize((width) => {
  const rows = REGIONS.filter((r) => regionMedians.some((m) => m.region === r));
  const idx = new Map(rows.map((r, i) => [r, i]));
  const marginLeft = width > 480 ? 78 : 44, marginTop = 28, marginBottom = 30, mr = 16;
  const height = marginTop + rows.length * ROW + marginBottom;
  const y = (d) => idx.get(d.region) + jitter(+d.nis) * 0.56;
  const xmax = d3.max(qualifying, (d) => d.years_of_income);
  const svg = Plot.plot({
    width, height, marginLeft, marginTop, marginBottom, marginRight: mr, style: STYLE,
    x: {domain: [0, Math.ceil(xmax / 5) * 5], label: null, axis: null},
    y: {domain: [rows.length - 0.5, -0.5], label: null, axis: null},
    marks: [
      Plot.text(["YEARS OF A DECLARATION"], {frameAnchor: "top-left", dx: 0, dy: -16, text: (d) => d, fill: INK_3, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em", textAnchor: "start"}),
      Plot.axisY({ticks: rows.map((r, i) => i), tickFormat: (i) => shortName(rows[i], width), tickSize: 0, tickPadding: 10, label: null, fill: (i) => REGION_TEXT[rows[i]], fontSize: 12.5, fontWeight: 500}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({tickSize: 4, tickPadding: 6, label: null, fontSize: 12.5, fill: INK_2}),
      Plot.dot(qualifying, {x: "years_of_income", y, r: 3, fill: (d) => REGION_COLOR[d.region], stroke: PAGE, strokeWidth: 0.75}),
      Plot.ruleX(regionMedians, {x: "value", y1: (d) => idx.get(d.region) - 0.5, y2: (d) => idx.get(d.region) + 0.5, stroke: INK_1, strokeWidth: 1}),
      // The median value sits at the top end of its tick, clear of the dots.
      Plot.text(regionMedians, {x: "value", y: (d) => idx.get(d.region) - 0.5, text: (d) => fixed(d.value, 1), dx: 4, dy: -2, lineAnchor: "bottom", textAnchor: "start", fill: INK_1, fontSize: 12, fontWeight: 500, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke", fontVariant: "tabular-nums"}),
      Plot.tip(qualifying, Plot.pointer({x: "years_of_income", y, maxRadius: 12, title: (d) => `${d.name}\n${d.province}\n${fixed(d.years_of_income, 1)} years of a declaration\n${eur(d.median_price)} asked, ${eur(d.median_income)} declared`}))
    ]
  });
  return svg;
}));
```

</div>
${caption(`One dot per commune, placed along the years-of-income axis and scattered a little within its region's row so the dots do not stack: Flanders in brick, Wallonia in Soignies bluestone, Brussels in Grand Place gilt. The short ink tick in each row is the regional median, with its value printed beside it. Point at a dot to name the commune.`)}
${source(`Source: listings and ${income.source}. ${plural(qualifying.length, "commune")} with at least ${num(MIN_SALE)} sale listings and a published median income.`)}
</figure>
</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">The notary's statement</p>

## Rent or buy

<p class="lede">What it costs to buy the median home in each region once the registration duty and the notary are paid, set out the way a Belgian notary itemises the bill, and what the same money would have rented. Change the price, the deposit, the rate and the term; the statement and the figure below follow.</p>

```js
const regionLadder = (region, cls) => budget.ladder.find((r) => r.level === "region" && r.province === region && r.class === cls);
const regionRent = (region, cls) => budget.rent.find((r) => r.level === "region" && r.province === region && r.class === cls);
const defaultPrice = Math.round((regionLadder(wbRegion, wbClass)?.median_price ?? 300000) / 1000) * 1000;
```

```js
const st = statement({price: wbPrice, region: wbRegion, mainHome: wbMain, depositPct: wbDeposit, ratePct: wbRate, years: wbYears});
const wbRent = regionRent(wbRegion, wbClass)?.median_rent ?? null;
const h21 = `Buying a ${eur(wbPrice)} ${NOUN[wbClass]} in ${wbRegion} costs ${eur(st.mortgage.cashAtSigning)} at signing and ${eur(st.mortgage.monthly)} a month; renting one costs ${wbRent != null ? rent(wbRent) : "an amount not observed"}.`;
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", `The notary's statement, ${NOUN[wbClass]} in ${wbRegion}`)}
${headline(h21)}
<div class="fig-pair">
<div class="text-5-first">
<div class="controls aff-controls">
<div class="ctl-label">Region</div>

```js
const wbRegion = view(Inputs.radio(REGIONS, {value: "Flanders"}));
```

<div class="ctl-label">Type</div>

```js
const wbClass = view(Inputs.radio(CLASSES, {value: "House"}));
```

<div class="ctl-label">Asking price, €</div>

```js
const wbPrice = view(Inputs.range([100000, 1500000], {step: 1000, value: defaultPrice}));
```

<div class="ctl-label">Deposit, %</div>

```js
const wbDeposit = view(Inputs.range([0, 40], {step: 5, value: 20}));
```

<div class="ctl-label">Rate, % a year</div>

```js
const wbRate = view(Inputs.range([1.5, 6], {step: 0.1, value: 3.4}));
```

<div class="ctl-label">Term, years</div>

```js
const wbYears = view(Inputs.radio([15, 20, 25, 30], {value: 25, format: (v) => String(v)}));
```

<div class="ctl-label">Sole main home</div>

```js
const wbMain = view(Inputs.toggle({value: true}));
```

</div>
<p>The bank lends against the price only, so the duty and the notary are paid in cash on top of the deposit. The price opens at the median asking price of a ${NOUN[wbClass]} in ${wbRegion}, ${eur(regionLadder(wbRegion, wbClass)?.median_price)}, and resets to it when the region or the type changes.</p>
</div>
<div class="chart-7-last">

```js
display(receipt({
  lines: [
    {label: "Asking price", value: eur(wbPrice)},
    {label: "Registration duty", description: st.duty.description, value: eur(st.duty.amount)},
    {label: "Notary fees and deed costs", description: st.fees.description, value: eur(st.fees.amount)},
    {label: "Cash at signing", description: `${eur(st.mortgage.deposit)} deposit (${pctWord(wbDeposit, 0)} of the price) plus duty and fees`, value: eur(st.mortgage.cashAtSigning)},
    {label: "Loan amount", description: `${pctWord(st.mortgage.ltv, 0)} of the price at ${pctWord(wbRate, 1)} a year over ${wbYears} years; ${eur(st.mortgage.totalInterest)} of interest over the term`, value: eur(st.mortgage.loan)}
  ],
  total: {label: "Monthly repayment", value: eur(st.mortgage.monthly)},
  foot: `Median asking rent for ${wbClass === "House" ? "a house" : "an apartment"} in ${wbRegion}: ${wbRent != null ? rent(wbRent) : "not observed"}. Rules as of ${RULES_AS_OF}. Indicative: new build is bought with 21 percent VAT instead of duty and is excluded here.`
}));
```

</div>
</div>
${caption(`Read the statement from the top: the price, the regional duty with its rule printed beneath it, the notary's estimate, then what the buyer hands over at signing and what the bank lends. The monthly repayment is a fixed-rate annuity on the loan. The rent beneath it is the median asked for the same type in the same region over the last two years.`)}
${source(`Source: duty rules of the three regions as of ${RULES_AS_OF}; notary scale of the Royal Decree of 16 December 1950, approximated; rents from rental listings, ${monthName(budget.window.from)} to ${monthName(budget.window.to)}.`)}
</figure>

```js
const INDEX_LOW = 1.5, INDEX_HIGH = 3, INDEX_MID = 2;
const rbOpts = {price: wbPrice, depositPct: wbDeposit, ratePct: wbRate, years: wbYears, duty: st.duty.amount ?? 0, fees: st.fees.amount, rent: wbRent ?? 0};
const rb = rentVsBuyBand(rbOpts, [INDEX_LOW, INDEX_HIGH]);
const rbMid = rentVsBuy({...rbOpts, indexationPct: INDEX_MID});
const crossHigh = crossing(rb.high), crossLow = crossing(rb.low), crossMid = crossing(rbMid);
const crossYears = [crossHigh, crossLow].filter((v) => v != null);
const crossWords = crossYears.length === 0 ? null
  : crossYears.length === 2 && crossHigh !== crossLow ? `${Math.min(...crossYears)} to ${Math.max(...crossYears)} years`
  : crossYears.length === 2 ? `${crossHigh} years`
  : `${crossYears[0]} years`;
const endBuy = rbMid.at(-1).buy, endRent = rbMid.at(-1).rent;
const endDiff = Math.abs(endBuy - endRent);
const good = (w) => html`<span class="verdict-good">${w}</span>`;
const bad = (w) => html`<span class="verdict-bad">${w}</span>`;
const h22 = wbRent == null
  ? html`No median rent is observed for ${NOUNS[wbClass]} in ${wbRegion}, so renting cannot be set against buying here.`
  : crossWords == null
    ? html`Renting stays ${good("cheaper")} over ${wbYears} years: ${eur(endRent)} in rent at 2 percent indexation against ${eur(endBuy)} to buy, ${eur(endDiff)} less.`
    : crossMid != null
      ? html`Buying overtakes renting after ${crossWords} and is ${good("cheaper")} by ${eur(endDiff)} over ${wbYears} years at 2 percent rent indexation.`
      : html`Buying overtakes renting after ${crossWords} only at 3 percent rent indexation; at 2 percent renting stays ${good("cheaper")} by ${eur(endDiff)} over ${wbYears} years, so buying is ${bad("dearer")}.`;
```

<figure class="fig" id="fig-2-2">
${kicker("2.2", `Cumulative cost of renting against buying over ${wbYears} years`)}
${headline(h22)}
<div class="fig-chart">

```js
display(resize((width) => {
  const height = h(width);
  const count = Math.max(4, Math.round(height / 60));
  const ymax = d3.max([rb.band.at(-1).buy, rb.band.at(-1).rentHigh]);
  const [lo, hi] = d3.nice(0, ymax, count);
  const ticks = d3.ticks(lo, hi, count).filter((t) => t > lo && t < hi);
  const mid = rbMid.map((d) => ({year: d.year, rent: d.rent}));
  // The crossing is annotated where the buy line meets the rent path that crosses first.
  const crossPath = crossHigh != null ? rb.high : crossLow != null ? rb.low : null;
  const crossYear = crossHigh ?? crossLow;
  const crossPoint = crossPath ? crossPath.find((d) => d.year === crossYear) : null;
  const anno = crossPoint ? [{year: crossPoint.year, value: crossPoint.buy, text: `buying overtakes renting after ${crossWords}`}] : [];
  const annoLeft = crossPoint && crossPoint.year > wbYears * 0.55;
  const last = [
    {year: wbYears, value: rb.buy.at(-1).buy, label: "Buying", color: BRICK},
    {year: wbYears, value: mid.at(-1).rent, label: "Renting", color: BLUESTONE}
  ];
  const svg = Plot.plot({
    width, height, ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: [0, wbYears], label: null, axis: null},
    y: {domain: [lo, hi], label: null, axis: null},
    marks: [
      ...valueAxisY("€ PAID SO FAR", {tickFormat: eurK, ticks}),
      Plot.areaY(rb.band, {x: "year", y1: "rentLow", y2: "rentHigh", fill: BLUESTONE, fillOpacity: 0.12, curve: "linear"}),
      Plot.line(mid, {x: "year", y: "rent", stroke: BLUESTONE, strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      Plot.line(rb.buy, {x: "year", y: "buy", stroke: BRICK, strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      Plot.dot(last, {x: "year", y: "value", r: 3, fill: "color", stroke: PAGE, strokeWidth: 1.5}),
      Plot.text(last, {x: "year", y: "value", text: "label", fill: "color", dx: 10, textAnchor: "start", fontSize: 12.5, fontWeight: 500, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke", className: "endlabel"}),
      Plot.dot(anno, {x: "year", y: "value", r: 3.5, fill: INK_1, stroke: PAGE, strokeWidth: 1.5}),
      Plot.link(anno, {x1: "year", y1: "value", x2: "year", y2: (d) => d.value + (hi - lo) * 0.16, stroke: INK_2, strokeWidth: 0.75}),
      Plot.text(anno, {x: "year", y: (d) => d.value + (hi - lo) * 0.16, text: "text", dy: -8, dx: annoLeft ? 4 : -4, textAnchor: annoLeft ? "end" : "start", fill: INK_1, fontSize: 12, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({ticks: wbYears >= 25 ? 5 : 4, tickSize: 4, tickPadding: 6, label: null, fontSize: 12.5, fill: INK_2, tickFormat: (v) => (v === 0 ? "Signing" : `Year ${v}`)}),
      Plot.ruleX(rb.band, Plot.pointerX({x: "year", stroke: INK_3, strokeDasharray: "3 3"})),
      Plot.tip(rb.band, Plot.pointerX({x: "year", y: "buy", title: (d) => `Year ${d.year}\nBuying\t${eur(d.buy)}\nRenting at 2%\t${eur(mid[d.year].rent)}\nRenting, 1.5% to 3%\t${range(d.rentLow, d.rentHigh, eurK)}`}))
    ]
  });
  // The buy line starts where the tick labels sit, so they get a page-colour halo.
  for (const t of svg.querySelectorAll('g[aria-label="y-axis tick label"] text')) {
    t.setAttribute("stroke", PAGE);
    t.setAttribute("stroke-width", "3");
    t.setAttribute("paint-order", "stroke");
  }
  // The two end labels sit at the same x; push them apart if the lines end close together.
  const texts = Array.from(svg.querySelectorAll("g.endlabel text"));
  if (texts.length === 2) {
    const ys = texts.map((t) => +(/translate\([-\d.]+,([-\d.]+)\)/.exec(t.getAttribute("transform") || "")?.[1] ?? 0));
    if (Math.abs(ys[0] - ys[1]) < 14) {
      const order = ys[0] < ys[1] ? [0, 1] : [1, 0];
      const m = (ys[0] + ys[1]) / 2;
      texts[order[0]].setAttribute("transform", texts[order[0]].getAttribute("transform").replace(/,([-\d.]+)\)/, `,${m - 7})`));
      texts[order[1]].setAttribute("transform", texts[order[1]].getAttribute("transform").replace(/,([-\d.]+)\)/, `,${m + 7})`));
    }
  }
  return svg;
}));
```

</div>
${caption(`Money paid out, year by year. Buying, in brick, starts at the cash handed over at signing and climbs by twelve repayments a year. Renting, in bluestone, starts at nothing and climbs by the rent, indexed each year; the solid line assumes 2 percent a year and the shaded band runs from 1.5 to 3 percent. Where the brick line crosses into the band, buying has cost less than renting from that year on. Nothing else is counted: no maintenance, insurance or property tax on the buyer's side, no capital appreciation or resale, and no return on the deposit had it been kept; duty and fees are paid in cash.`)}
${source(`Source: the statement above; rent indexation assumptions 1.5, 2 and 3 percent a year. Belgian rents follow the health index, of which 2 percent is the long run average.`)}
</figure>

<div class="footnotes">
<p><strong>Registration duty.</strong> ${registrationDuty(wbPrice, {region: "flanders"}).description}; otherwise ${registrationDuty(wbPrice, {region: "flanders", mainHome: false}).description.replace(/^Flanders, /, "")}. ${registrationDuty(wbPrice, {region: "wallonia"}).description}; otherwise ${registrationDuty(wbPrice, {region: "wallonia", mainHome: false}).description.replace(/^Wallonia, /, "")}. ${registrationDuty(wbPrice, {region: "brussels"}).description}; ${registrationDuty(wbPrice, {region: "brussels", mainHome: false}).description.replace(/^Brussels, /, "").replace(/^general rate/, "otherwise the general rate")}. The Brussels exemption applies only when the price is at most €600,000. The percentages are the mainstream rule for a private buyer of an existing home; renovation rebates, portability of duty paid earlier, protected monuments, social housing, professional buyers and the Flemish energy renovation rate that ended in 2024 are not applied.</p>
<p><strong>Notary and deed.</strong> The statutory notary fee is the same in the three regions and degressive, from 4.56 percent on the first €7,500 down to 0.057 percent above €250,095. Between €150,000 and €700,000 it is within a few percent of the linear approximation used here, €1,500 plus 0.9 percent of the price, to which 21 percent VAT is added; deed, registry and search costs are taken as a flat €1,200 and in practice run €800 to €1,500 depending on the mortgage deed. At ${eur(wbPrice)} the estimate is ${eur(notaryEstimate(wbPrice).amount)}.</p>
<p><strong>Mortgage and exclusions.</strong> The repayment is a fixed-rate annuity with monthly compounding on the price less the deposit; duty and fees are never financed. New build is bought with 21 percent VAT on the building instead of registration duty and is not covered. Figure 2.2 compares outlays only: the buyer's equity, the home's resale value and the renter's returns on the money not spent are all left out, so it is a statement of cash, not of wealth.</p>
</div>
</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">Budget</p>

## What a budget buys

<p class="lede">The same sum buys very different homes across the eleven provinces. For each budget, the figure below reads the median habitable surface of the listings priced within 7.5 percent of it, and the one after it reads how much of each province's market lies at or under it.</p>

```js
const PROVINCE_LABEL = {Liege: "Liège"};
const provName = (p) => PROVINCE_LABEL[p] ?? p;
const MIN_CELL = budget.min_sample;
const bRows = budget.budgets.filter((r) => r.level === "province" && r.budget === bLevel && r.n >= MIN_CELL);
const bBelgium = budget.budgets.filter((r) => r.level === "country" && r.budget === bLevel && r.n >= MIN_CELL);
const PROVINCES = [...new Set(budget.budgets.filter((r) => r.level === "province").map((r) => r.province))];
const surfaceOf = (prov, cls) => bRows.find((r) => r.province === prov && r.class === cls)?.median_surface ?? null;
const provOrder = [...PROVINCES].sort((a, b) => d3.descending(surfaceOf(a, "House") ?? -1, surfaceOf(b, "House") ?? -1) || d3.descending(surfaceOf(a, "Apartment") ?? -1, surfaceOf(b, "Apartment") ?? -1) || d3.ascending(a, b));
const bMissing = provOrder.map((province) => ({province, classes: CLASSES.filter((c) => surfaceOf(province, c) == null)})).filter((d) => d.classes.length);
function extremes(cls) {
  const rs = bRows.filter((r) => r.class === cls);
  if (!rs.length) return null;
  return {hi: d3.greatest(rs, (r) => r.median_surface), lo: d3.least(rs, (r) => r.median_surface)};
}
const exH = extremes("House"), exA = extremes("Apartment");
const m2 = (v) => `${num(v)} m²`;
const h31 = [
  exH ? `For ${eur(bLevel)} the median house is ${m2(exH.hi.median_surface)} in ${provName(exH.hi.province)} and ${m2(exH.lo.median_surface)} in ${provName(exH.lo.province)}` : `For ${eur(bLevel)} no province has enough houses to price`,
  exA ? `the median apartment ${m2(exA.hi.median_surface)} in ${provName(exA.hi.province)} and ${num(exA.lo.median_surface)} in ${provName(exA.lo.province)}.` : "no province has enough apartments to price."
].join("; ");
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", `Median habitable surface of listings priced at ${eur(bLevel)}, by province`)}
${headline(h31)}
<div class="fig-controls">

```js
const bLevel = view(Inputs.radio(budget.budget_levels, {label: "Budget", value: 350000, format: eurK}));
```

</div>
${legend([["Houses", CLASS_COLOR.House], ["Apartments", CLASS_COLOR.Apartment]])}
<div class="fig-chart aff-budget">

```js
display(resize((width) => {
  const id = "nodata-fig-3-1";
  const narrow = width <= 480;
  const step = 30, marginTop = narrow ? 52 : 36, marginBottom = 30, marginLeft = narrow ? 96 : 118, mr = 56;
  const height = provOrder.length * step + marginTop + marginBottom;
  const xmax = d3.max([...bRows, ...bBelgium], (d) => d.median_surface) ?? 100;
  const domain = [0, Math.ceil((xmax * 1.08) / 20) * 20];
  const plotW = width - marginLeft - mr;
  const k = domain[1] / plotW; // data units per pixel
  // Labels sit on the outer side of each pair: the smaller value to the left, the larger to the right.
  const labelled = bRows.map((r) => {
    const other = surfaceOf(r.province, r.class === "House" ? "Apartment" : "House");
    const left = other != null && r.median_surface < other;
    return {...r, left};
  });
  const leftLabels = labelled.filter((d) => d.left), rightLabels = labelled.filter((d) => !d.left);
  const bHouse = bBelgium.filter((d) => d.class === "House"), bApt = bBelgium.filter((d) => d.class === "Apartment");
  const belgiumText = (d) => `Belgium, ${NOUNS[d.class]} ${m2(d.median_surface)}`;
  const labelOpts = {y: "province", x: "median_surface", text: (d) => m2(d.median_surface), fill: INK_1, fontSize: 12, fontVariant: "tabular-nums", stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"};
  const hatchLen = 36 * k;
  const svg = Plot.plot({
    width, height, marginTop, marginBottom, marginLeft, marginRight: mr, style: STYLE,
    x: {domain, label: null, axis: null},
    y: {domain: provOrder, label: null, axis: null, padding: 0},
    marks: [
      Plot.axisY({tickSize: 0, tickPadding: 10, label: null, fill: INK_2, fontSize: 12.5, tickFormat: provName}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({tickSize: 4, tickPadding: 6, label: null, fontSize: 12.5, fill: INK_2, tickFormat: (v) => `${v} m²`}),
      Plot.rect(bMissing, {x1: 0, x2: hatchLen, y: "province", insetTop: (step - 18) / 2, insetBottom: (step - 18) / 2, fill: `url(#${id})`}),
      Plot.text(bMissing, {x: hatchLen, y: "province", text: (d) => `too few listings, ${d.classes.map((c) => NOUNS[c]).join(" and ")}`, dx: 6, textAnchor: "start", fill: INK_3, fontSize: 12}),
      Plot.ruleX(bBelgium, {x: "median_surface", stroke: INK_3, strokeWidth: 1, strokeDasharray: "3 3"}),
      // The Belgium labels sit above the first row: on wide charts each reads outward from its rule;
      // on phones the house label would run off the right edge, so it takes a second line, reading left.
      Plot.text(bHouse, {x: "median_surface", frameAnchor: "top", dy: narrow ? -24 : -8, lineAnchor: "bottom", text: belgiumText, fill: INK_3, fontSize: 12, textAnchor: narrow ? "end" : "start", dx: narrow ? -4 : 4}),
      Plot.text(bApt, {x: "median_surface", frameAnchor: "top", dy: -8, lineAnchor: "bottom", text: belgiumText, fill: INK_3, fontSize: 12, textAnchor: narrow ? "start" : "end", dx: narrow ? 4 : -4}),
      Plot.dot(labelled, {x: "median_surface", y: "province", r: 5, fill: (d) => CLASS_COLOR[d.class], stroke: PAGE, strokeWidth: 2}),
      Plot.text(leftLabels, {...labelOpts, dx: -10, textAnchor: "end"}),
      Plot.text(rightLabels, {...labelOpts, dx: 10, textAnchor: "start"}),
      Plot.tip(labelled, Plot.pointer({x: "median_surface", y: "province", title: (d) => `${provName(d.province)}, ${NOUNS[d.class]} at ${eur(bLevel)}\nMedian surface\t${m2(d.median_surface)}\nMiddle half\t${d.p25_surface} to ${d.p75_surface} m²\nBedrooms\t${d.median_bedrooms}\nYear built\t${d.median_year_built ?? "n/a"}\nRated A or B\t${pct(100 * d.share_epc_ab, 0)}\nListings\t${num(d.n)}`}))
    ]
  });
  hatch(svg, id);
  return svg;
}));
```

</div>
${caption(`Provinces are ordered by what a house buys. Each row carries two dots: houses in brick, apartments in bluestone, at the median habitable surface of the listings asking within 7.5 percent of ${eur(bLevel)}, with the figure printed beside each dot. The dashed rules are the Belgian medians for the same budget. A hatched row marks a province and type with fewer than ${num(MIN_CELL)} such listings. Point at a dot for the middle half of surfaces, bedrooms, year built and the share rated A or B.`)}
${source(`Source: sale listings, ${monthName(budget.window.from)} to ${monthName(budget.window.to)}, each counted once at its latest observation; listings with a plausible habitable surface only.`)}
</figure>

```js
const ladderRows = budget.ladder.filter((r) => r.level === "province");
const reach = (cls) => ladderRows.filter((r) => r.class === cls).map((r) => ({province: r.province, share: r.share_under[String(bLevel)] ?? null, n: r.n})).filter((d) => d.share != null).sort((a, b) => d3.descending(a.share, b.share));
const reachH = reach("House"), reachA = reach("Apartment");
const reachSentence = (rows, noun) => rows.length ? `${pctWord(100 * rows[0].share, 0)} of ${noun} in ${provName(rows[0].province)} are within reach and ${pctWord(100 * rows.at(-1).share, 0)} in ${provName(rows.at(-1).province)}` : `no province has enough ${noun} to say`;
const h32 = `At ${eur(bLevel)}, ${reachSentence(reachH, "houses")}; for apartments the range runs from ${reachA.length ? `${pctWord(100 * reachA[0].share, 0)} in ${provName(reachA[0].province)} to ${pctWord(100 * reachA.at(-1).share, 0)} in ${provName(reachA.at(-1).province)}` : "nothing observed"}.`;

function reachPanel(rows, cls, width) {
  const bar = 18, gap = 6, marginTop = 6, marginBottom = 28, marginLeft = width > 400 ? 118 : 100, mr = 48;
  const height = rows.length * (bar + gap) + marginTop + marginBottom;
  return Plot.plot({
    width, height, marginTop, marginBottom, marginLeft, marginRight: mr, style: STYLE,
    x: {domain: [0, 1], label: null, axis: null},
    y: {domain: rows.map((d) => d.province), label: null, axis: null, padding: gap / (bar + gap)},
    marks: [
      Plot.axisY({tickSize: 0, tickPadding: 10, label: null, fill: INK_2, fontSize: 12.5, tickFormat: provName}),
      Plot.barX(rows, {x: "share", y: "province", fill: CLASS_COLOR[cls]}),
      Plot.ruleX([0], {stroke: INK_2, strokeWidth: 1}),
      Plot.text(rows, {x: "share", y: "province", text: (d) => pct(100 * d.share, 0), dx: 6, textAnchor: "start", fill: INK_1, fontSize: 12, fontVariant: "tabular-nums"}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({ticks: [0, 0.25, 0.5, 0.75, 1], tickSize: 4, tickPadding: 6, label: null, fontSize: 12.5, fill: INK_3, tickFormat: (v) => pct(100 * v, 0)}),
      Plot.tip(rows, Plot.pointer({x: "share", y: "province", title: (d) => `${provName(d.province)}, ${NOUNS[cls]}\n${pct(100 * d.share, 1)} at or under ${eur(bLevel)}\n${plural(d.n, "listing")} in the province`}))
    ]
  });
}
```

<figure class="fig" id="fig-3-2">
${kicker("3.2", `Share of the market asking ${eur(bLevel)} or less, by province`)}
${headline(h32)}
<div class="fig-pair">
<div class="half">
<p class="panel-title">Houses</p>

```js
display(resize((width) => reachPanel(reachH, "House", width)));
```

</div>
<div class="half">
<p class="panel-title">Apartments</p>

```js
display(resize((width) => reachPanel(reachA, "Apartment", width)));
```

</div>
</div>
${caption(`How much of the market is within reach. Each bar is the share of a province's sale listings asking ${eur(bLevel)} or less, houses in brick on the left and apartments in bluestone on the right, each panel ordered from the most to the least within reach. The budget selector above Figure 3.1 sets both figures.`)}
${source(`Source: sale listings, ${monthName(budget.window.from)} to ${monthName(budget.window.to)}, each counted once at its latest observation. Shares are of every listing in the province and type.`)}
</figure>

<div class="footnotes">
<p>Within reach means an asking price at or under the budget, before duty, notary and any negotiation. Budgets are nominal euros over the ${monthName(budget.window.from)} to ${monthName(budget.window.to)} window and are not adjusted for inflation. The surface figures of Figure 3.1 describe the listings asking within 7.5 percent either side of the budget, so neighbouring budgets overlap a little from ${eur(350000)} up; a province and type with fewer than ${num(MIN_CELL)} such listings is hatched. Province and Belgium figures are medians over listings, not averages over provinces; Brussels is its own province and region and appears once.</p>
</div>
</section>
