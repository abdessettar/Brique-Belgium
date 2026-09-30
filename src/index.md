---
title: The market
---

<style>
/* Front page only. */
.fp-table td.name svg { margin-right: 7px; vertical-align: 1px; }
.fp-table { margin-top: 8px; }
.fp-strip svg text { font-family: "Libre Franklin", "Helvetica Neue", Arial, sans-serif; }
@media (max-width: 480px) { .fp-controls form > label { display: none; } }
</style>

```js
import {REGIONS, REGION_COLOR, REGION_TEXT, INK_1, INK_2, INK_3, PAGE} from "./components/palette.js";
import {eur, eurK, rent, num, pct, pctWord, aboveBelow, plural, monthName, monthShort, window as windowText, monthDate, addMonths, monthsBetween, yoy, fixed} from "./components/sentences.js";
import {STYLE, h, marginRight, MARGINS, shortName, hatch, gapMarks, timeAxisX, valueAxisY, niceTicks, pointerRule, endDots, endLabels, dodgeLabels, finishAxes, withGaps, dated, lastOf, monthTip} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote, swatch, rangeRule, ledgerCell, ledger, na} from "./components/figure.js";
```

```js
const kpis = FileAttachment("data/kpis.json").json();
const trends = FileAttachment("data/trends.json").json();
const coverage = FileAttachment("data/coverage.json").json();
```

```js
const WINDOW = kpis.window;
const GAP_MONTHS = trends.dead_months;
const FIRST = "2023-01";
const LAST = d3.max(trends.sale, (d) => d.month);
const ALL_MONTHS = monthsBetween(FIRST, LAST);
const X_DOMAIN = [monthDate(FIRST), monthDate(addMonths(LAST, 1))];
const curMonths = monthsBetween(...WINDOW.current);
const deadInWindow = GAP_MONTHS.filter((m) => curMonths.includes(m));
const observedInWindow = curMonths.length - deadInWindow.length;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n) => WORDS[n] ?? num(n);
const house = kpis.kpis.find((k) => k.class === "House");
const apt = kpis.kpis.find((k) => k.class === "Apartment");
const byMonth = (a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0);
const good = (rows, y) => rows.filter((r) => !r.low_confidence && r[y] != null).sort(byMonth);
```

<p class="kicker">Belgium · asking prices</p>

# The market in ${monthName(WINDOW.current[1])}

<div class="row top">
<div class="main">
<p class="lede">Brique reads what sellers ask for homes in Belgium, commune by commune. This issue covers listings observed from ${windowText(WINDOW.current)} and compares them with the twelve months before, ${windowText(WINDOW.prior)}.</p>
</div>
<aside class="side">${standingNote()}</aside>
</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">The ledger</p>

## The market in eight figures

<p class="lede">Two rows, four measures. Each figure is the median of every listing observed in the window; the rule beneath it spans the twelve-month range of the national monthly series, with a brick tick at the latest month and a grey tick at the same month a year earlier.</p>

```js
// National monthly series: the three region medians combined with sample weights, months flagged
// low confidence left out so the range reads the observed market only.
function national(rows, y) {
  return d3.rollup(good(rows, y), (v) => d3.sum(v, (r) => r[y] * r.n) / d3.sum(v, (r) => r.n), (r) => r.month);
}
function seriesFor(cls) {
  const sale = trends.sale.filter((r) => r.class === cls);
  const rentRows = trends.rent.filter((r) => r.class === cls);
  const price = national(sale, "median_price");
  const m2 = national(sale, "median_eur_m2");
  const rents = national(rentRows, "median_rent");
  const yld = new Map();
  for (const [m, p] of price) if (rents.has(m)) yld.set(m, (12 * rents.get(m)) / p * 100);
  return {price, m2, rents, yld};
}
function ruleOf(series, format, label = "\u00a0") {
  const months = curMonths.filter((m) => series.has(m));
  if (!months.length) return null;
  const vals = months.map((m) => series.get(m));
  const last = months.at(-1);
  return rangeRule({min: d3.min(vals), max: d3.max(vals), current: series.get(last), prior: series.get(addMonths(last, -12)) ?? null, format, label});
}
const pctFmt = (v) => fixed(v, 2) + "%";
function ledgerRow(k, s) {
  return {
    head: k.class === "House" ? "Houses" : "Apartments",
    cells: [
      ledgerCell({label: "Median asking price", value: eur(k.median_price), sub: `${yoy(k.median_price_yoy)} · ${plural(k.n_sale, "listing")}`, rule: ruleOf(s.price, eur, "twelve-month range")}),
      ledgerCell({label: "Price per m²", value: html`${eur(k.median_eur_m2)}<small>/m²</small>`, sub: yoy(k.median_eur_m2_yoy), rule: ruleOf(s.m2, eur)}),
      ledgerCell({label: "Median rent", value: html`${eur(k.median_rent)}<small>/mo</small>`, sub: `${yoy(k.median_rent_yoy)} · ${plural(k.n_rent, "rental")}`, rule: ruleOf(s.rents, eur)}),
      ledgerCell({label: "Gross yield", value: html`${fixed(k.gross_yield_pct, 2)}<small>%</small>`, sub: yoy(k.gross_yield_yoy), rule: ruleOf(s.yld, pctFmt)})
    ]
  };
}
display(ledger([ledgerRow(house, seriesFor("House")), ledgerRow(apt, seriesFor("Apartment"))]));
```

<p class="ledger-caption">${windowText(WINDOW.current)} against ${windowText(WINDOW.prior)}. Medians are of the listings observed in each window; the ${word(deadInWindow.length)} months with no listings recorded fall inside the current window, so its medians rest on ${word(observedInWindow)} observed months.</p>

</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">Prices</p>

## Price per square metre

<p class="lede">Monthly medians for houses and apartments, by region. Price per square metre is the measure that travels: it removes most of the difference between a Walloon farmhouse and a Brussels maisonette, and it is what the rest of the bulletin uses when it compares places.</p>

<div class="fig-controls fp-controls">

```js
const measure = view(Inputs.radio(
  new Map([["Price per m²", "median_eur_m2"], ["Asking price", "median_price"], ["Indexed to January 2023", "index_eur_m2"]]),
  {label: "Show", value: "median_eur_m2"}
));
```

</div>

```js
const SPEC = {
  median_eur_m2: {unit: "€ PER M²", tickFormat: eurK, prose: (v) => eur(v) + " per square metre", cell: (v) => eur(v) + "/m²", column: "Latest, €/m²"},
  median_price: {unit: "€ ASKING PRICE", tickFormat: eurK, prose: eur, cell: eur, column: "Latest, €"},
  index_eur_m2: {unit: "INDEX, JANUARY 2023 = 100", tickFormat: (v) => String(v), prose: (v) => "an index of " + fixed(v, 1), cell: (v) => fixed(v, 1), column: "Latest, index"}
};
const spec = SPEC[measure];
const REGION_ORDER = ["Brussels", "Flanders", "Wallonia"];

/** The line figure every time chart on this page is built from. */
function lineFigure({rows, y, id, width, unit, tickFormat, format, regions = REGIONS}) {
  const observed = dated(good(rows, y).filter((d) => regions.includes(d.region)));
  const order = REGION_ORDER.filter((r) => regions.includes(r));
  const gapped = d3.groups(observed, (d) => d.region).flatMap(([, rs]) => withGaps(rs, {y, allMonths: ALL_MONTHS}));
  const last = lastOf(observed, "region", {y});
  // The domain is niced so the top tick can be dropped (its label would sit under the unit at the
  // top left), and the tick count shrinks until no two labels print the same.
  const [lo, hi] = d3.extent(observed, (d) => d[y]);
  const {domain, ticks} = niceTicks(lo, hi, {count: Math.max(4, Math.round(h(width) / 60)), tickFormat});
  const svg = Plot.plot({
    width, height: h(width), ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain, label: null, axis: null, zero: false},
    color: {type: "identity"},
    marks: [
      ...valueAxisY(unit, {tickFormat, ticks}),
      ...gapMarks(GAP_MONTHS, id),
      Plot.line(gapped, {x: "date", y, z: "region", stroke: (d) => REGION_COLOR[d.region], strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      endDots(last, {y, fill: (d) => REGION_COLOR[d.region]}),
      endLabels(last, {y, text: (d) => shortName(d.region, width), fill: (d) => REGION_TEXT[d.region]}),
      pointerRule(observed),
      monthTip(observed, {y, series: "region", order, format, title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  dodgeLabels(svg);
  finishAxes(svg);
  return svg;
}

/** The latest month in which every listed region is observed, the values there, and the latest
 *  month of any region (so the prose can say when the two differ). */
function latestCommon(rows, y, regions = REGION_ORDER) {
  const g = good(rows, y).filter((d) => regions.includes(d.region));
  const counts = d3.rollup(g, (v) => new Set(v.map((d) => d.region)).size, (d) => d.month);
  const m = d3.max(Array.from(counts).filter(([, n]) => n === regions.length), ([m]) => m);
  const at = (region) => g.find((d) => d.month === m && d.region === region)?.[y];
  return {month: m, latest: d3.max(g, (d) => d.month), regions, Brussels: at("Brussels"), Flanders: at("Flanders"), Wallonia: at("Wallonia")};
}
const allOf = (regions) => (regions.length === 3 ? "all three regions" : "both regions");

function levelHeadline(rows, y, noun, verb, fmt, regions = REGION_ORDER) {
  const c = latestCommon(rows, y, regions);
  if (!c.month) return `${noun[0].toUpperCase()}${noun.slice(1)} have no month in which ${allOf(regions)} are observed.`;
  const [lead, ...rest] = regions;
  const others = rest.map((r) => `${aboveBelow(c[lead], c[r])} ${r}`).join(" and ");
  return `${lead} ${noun} ${verb} ${fmt(c[lead])} in ${monthName(c.month)}, ${others}.`;
}
/** One sentence for the text column when the headline's month is not the latest month drawn. */
function comparedAt(rows, y, regions = REGION_ORDER) {
  const c = latestCommon(rows, y, regions);
  if (!c.month || c.month === c.latest) return "";
  return ` The headline compares the regions at ${monthName(c.month)}, the latest month in which ${allOf(regions)} are observed; the table gives each region its own latest month.`;
}
function indexHeadline(rows, y, noun) {
  const c = latestCommon(rows, y);
  if (!c.month) return `${noun} have no month in which all three regions are observed.`;
  return `Brussels ${noun} per square metre stand at ${Math.round(c.Brussels)} in ${monthName(c.month)} against 100 in January 2023; Flanders at ${Math.round(c.Flanders)}, Wallonia at ${Math.round(c.Wallonia)}.`;
}
function priceHeadline(rows, noun) {
  return measure === "index_eur_m2" ? indexHeadline(rows, measure, noun.replace(/s$/, " prices"))
    : levelHeadline(rows, measure, noun, "ask", spec.prose);
}

/** Each region's latest observed value and its change on the value twelve months earlier. */
function yearChange(rows, y, regions = REGIONS) {
  const g = good(rows, y);
  return regions.map((region) => {
    const rs = g.filter((d) => d.region === region);
    const last = rs.at(-1);
    if (!last) return {region, month: null, value: null, change: null};
    const prev = rs.find((d) => d.month === addMonths(last.month, -12));
    return {region, month: last.month, value: last[y], change: prev ? (last[y] / prev[y] - 1) * 100 : null};
  });
}
const rose = (v) => (v > 0.05 ? "rose" : v < -0.05 ? "fell" : "held");
function changeParagraph(ch, noun, fmt) {
  const known = ch.filter((d) => d.change != null).sort((a, b) => b.change - a.change);
  const unknown = ch.filter((d) => d.change == null);
  if (!known.length) return "No region has an observed value twelve months earlier to compare with.";
  const [top, ...rest] = known;
  const lead = top.change > 0.05
    ? `${top.region} ${noun} rose most on the year: ${fmt(top.value)} in ${monthName(top.month)}, ${pctWord(top.change)} more than in ${monthName(addMonths(top.month, -12))}.`
    : `No region rose on the year. ${top.region} ${noun} ${rose(top.change)} ${top.change < -0.05 ? "least" : ""}: ${fmt(top.value)} in ${monthName(top.month)}, ${pctWord(Math.abs(top.change))} ${top.change < 0 ? "less" : "more"} than in ${monthName(addMonths(top.month, -12))}.`.replace(/\s+:/, ":");
  const others = rest.map((d) => (rose(d.change) === "held" ? `${d.region} held level` : `${d.region} ${rose(d.change)} ${pctWord(Math.abs(d.change))}`));
  const restMonths = [...new Set(rest.map((d) => d.month))];
  const toMonth = restMonths.length === 1 && restMonths[0] !== top.month ? `, measured to ${monthName(restMonths[0])}` : "";
  const tail = others.length ? ` ${others.join(" and ")}${toMonth}.` : "";
  const missing = unknown.length ? ` ${unknown.map((d) => d.region).join(" and ")} ${unknown.length === 1 ? "has" : "have"} no observed value twelve months earlier.` : "";
  return lead + tail + missing;
}
function changeTable(ch, fmt, column) {
  return html`<table class="fp-table">
    <thead><tr><th>Region</th><th>Month</th><th class="r">${column}</th><th class="r">On the year</th></tr></thead>
    <tbody>${ch.map((d) => html`<tr>
      <td class="name">${swatch(REGION_COLOR[d.region])}${d.region}</td>
      <td>${d.month ? monthShort(d.month) : na()}</td>
      <td class="r">${d.value != null ? fmt(d.value) : na()}</td>
      <td class="r">${d.change != null ? pct(d.change, 1, true) : na()}</td>
    </tr>`)}</tbody>
  </table>`;
}
```

```js
const saleHouses = trends.sale.filter((r) => r.class === "House");
const saleApts = trends.sale.filter((r) => r.class === "Apartment");
const h21 = priceHeadline(saleHouses, "houses");
const h22 = priceHeadline(saleApts, "apartments");
const ch21 = yearChange(saleHouses, measure);
const ch22 = yearChange(saleApts, measure);
const measureName = {median_eur_m2: "Price per square metre", median_price: "Asking price", index_eur_m2: "Index of price per square metre"}[measure];
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", `${measureName}, houses`)}
${headline(h21)}
<div class="fig-pair">
<div class="chart-7">

```js
display(resize((width) => lineFigure({rows: saleHouses, y: measure, id: "nodata-fig-2-1", width, unit: spec.unit, tickFormat: spec.tickFormat, format: spec.cell})));
```

</div>
<div class="text-5">
<p>${changeParagraph(ch21, "houses", spec.prose)}${comparedAt(saleHouses, measure)}</p>
<p class="panel-title">Change on the year by region</p>
${changeTable(ch21, spec.cell, spec.column)}
</div>
</div>
${caption("Monthly medians of listings first published in the month. Flanders in brick, Wallonia in Soignies bluestone, Brussels in Grand Place gilt. A dot marks the last observed month of each line. Hatched months have no data.")}
${source(`Source: listings, ${monthName(FIRST)} to ${monthName(LAST)}. Medians of months with a usable sample; months with too few listings are left out and the line breaks. Hatched months have no data.`)}
</figure>

<figure class="fig" id="fig-2-2">
${kicker("2.2", `${measureName}, apartments`)}
${headline(h22)}
<div class="fig-pair">
<div class="text-5-first">
<p>${changeParagraph(ch22, "apartments", spec.prose)}${comparedAt(saleApts, measure)}</p>
<p class="panel-title">Change on the year by region</p>
${changeTable(ch22, spec.cell, spec.column)}
</div>
<div class="chart-7-last">

```js
display(resize((width) => lineFigure({rows: saleApts, y: measure, id: "nodata-fig-2-2", width, unit: spec.unit, tickFormat: spec.tickFormat, format: spec.cell})));
```

</div>
</div>
${caption("Same measure and colours as Figure 2.1: Flanders in brick, Wallonia in bluestone, Brussels in gilt. Apartments are priced on habitable surface, so a small city flat and a large suburban one sit on the same footing. Hatched months have no data.")}
${source(`Source: listings, ${monthName(FIRST)} to ${monthName(LAST)}. Medians of months with a usable sample; months with too few listings are left out and the line breaks. Hatched months have no data.`)}
</figure>

</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">Rents</p>

## Rents

<p class="lede">Median asking rent per month, by region, from rental listings. Apartments make up most of what is offered to rent; houses to rent are fewer, and outside the cities the monthly sample is thin.</p>

```js
const rentApts = trends.rent.filter((r) => r.class === "Apartment");
const rentHouses = trends.rent.filter((r) => r.class === "House");
const h31 = levelHeadline(rentApts, "median_rent", "apartments", "rent for", rent);
const DRAWN_32 = ["Flanders", "Wallonia"];
const h32 = levelHeadline(rentHouses, "median_rent", "houses", "rent for", rent, DRAWN_32);
const ch31 = yearChange(rentApts, "median_rent");
const ch32 = yearChange(rentHouses, "median_rent", DRAWN_32);
const rentFmt = (v) => eur(v) + "/mo";
const lastRentMonth = d3.max(good(rentHouses, "median_rent"), (d) => d.month);
const houseRentTotal = d3.sum(rentHouses.filter((d) => d.month === lastRentMonth), (d) => d.n);
const houseSaleTotal = d3.sum(saleHouses.filter((d) => d.month === lastRentMonth), (d) => d.n);
// Brussels houses to rent: how often the month clears the confident sample, and the latest that did.
const bxlRent = rentHouses.filter((d) => d.region === "Brussels").sort(byMonth);
const bxlGood = bxlRent.filter((d) => !d.low_confidence && d.median_rent != null);
const bxlLast = bxlGood.at(-1);
const bxlNow = bxlRent.find((d) => d.month === lastRentMonth);
const bxlNote = bxlLast
  ? `Brussels is not drawn: houses to rent there clear the ${num(trends.confident_sample)} listings a month the bulletin asks for before it draws a median in only ${word(bxlGood.length)} of ${num(bxlRent.length)} months, most recently ${monthName(bxlLast.month)}, when ${plural(bxlLast.n, "listing")} put the median at ${rent(bxlLast.median_rent)}${bxlNow ? `; in ${monthName(bxlNow.month)} it had ${plural(bxlNow.n, "listing")}` : ""}.`
  : `Brussels is not drawn: no month has enough houses to rent to carry a median.`;
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", "Median asking rent, apartments")}
${headline(h31)}
<div class="fig-pair">
<div class="chart-7">

```js
display(resize((width) => lineFigure({rows: rentApts, y: "median_rent", id: "nodata-fig-3-1", width, unit: "€ PER MONTH", tickFormat: eurK, format: rentFmt})));
```

</div>
<div class="text-5">
<p>${changeParagraph(ch31, "apartments", rent)}${comparedAt(rentApts, "median_rent")}</p>
<p class="panel-title">Change on the year by region</p>
${changeTable(ch31, rentFmt, "Latest, €/mo")}
</div>
</div>
${caption("Monthly medians of apartments offered to rent, first published in the month. Flanders in brick, Wallonia in Soignies bluestone, Brussels in Grand Place gilt. Hatched months have no data.")}
${source(`Source: rental listings, ${monthName(FIRST)} to ${monthName(LAST)}. Medians of months with a usable sample. Hatched months have no data.`)}
</figure>

<figure class="fig" id="fig-3-2">
${kicker("3.2", "Median asking rent, houses, Flanders and Wallonia")}
${headline(h32)}
<div class="fig-pair">
<div class="text-5-first">
<p>${changeParagraph(ch32, "houses", rent)}</p>
<p class="panel-title">Change on the year by region</p>
${changeTable(ch32, rentFmt, "Latest, €/mo")}
${sidenote("Read with care", html`Rental listings are fewer than sale listings, and the house rental market is thin outside the cities. In ${monthName(lastRentMonth)} houses to rent came to ${plural(houseRentTotal, "listing")} across the three regions, against ${plural(houseSaleTotal, "listing")} for sale. ${bxlNote}`)}
</div>
<div class="chart-7-last">

```js
display(resize((width) => lineFigure({rows: rentHouses, y: "median_rent", id: "nodata-fig-3-2", width, unit: "€ PER MONTH", tickFormat: eurK, format: rentFmt, regions: DRAWN_32})));
```

</div>
</div>
${caption("Monthly medians of houses offered to rent. Flanders in brick, Wallonia in bluestone. Brussels is not drawn: its monthly sample is too thin for a line, and the note beside the chart gives its figure. Hatched months have no data.")}
${source(`Source: rental listings, ${monthName(FIRST)} to ${monthName(LAST)}. Medians of months with a usable sample. Hatched months have no data.`)}
</figure>

</section>

<section class="section" id="s4">
<span class="section-num">4</span><p class="kicker">Yield</p>

## Gross rental yield

<p class="lede">The ledger's last column divides one asking price by another. It is a ratio of two markets, not the return on any one property, and it is read here as a way of comparing places rather than as a promise.</p>

<div class="row top">
<div class="main">
<p class="formula">gross yield = 12 × median asking rent ÷ median asking price</p>
<p>At the figures above, a typical Belgian house asking ${eur(house.median_price)} and renting for ${rent(house.median_rent)} returns ${pctWord(house.gross_yield_pct, 2)} a year before any costs; a typical apartment asking ${eur(apt.median_price)} and renting for ${rent(apt.median_rent)} returns ${pctWord(apt.gross_yield_pct, 2)}.</p>
<p>The ratio leaves out everything that follows the purchase: registration duty, notary fees, maintenance, months without a tenant and tax on the rent. It is also a market ratio, not a per-property return. The house that rents for ${rent(house.median_rent)} is not the house that asks ${eur(house.median_price)}; the two medians come from different listings in the same class and window.</p>
<p>A higher yield is not a better investment. Yields run high where prices are low, so the map of yields is largely the map of cheap communes, and a cheap commune can be cheap for reasons a tenant will notice. <a href="./geography">Geography</a> maps gross yield commune by commune, with the sample behind each figure.</p>
</div>
${sidenote("Registration duty", html`For a sole main home in 2025 the duty on the purchase is 2 percent in Flanders, 3 percent in Wallonia and 12.5 percent in Brussels, before notary fees and the reliefs each region attaches. <a href="./affordability">Affordability</a> itemises the cost of buying commune by commune.`)}
</div>

</section>

<section class="section" id="s5">
<span class="section-num">5</span><p class="kicker">What was observed</p>

## Coverage

<p class="lede">Listings were not recorded every day. The strip shows how much of each month was observed, and the same four hatched months appear on every time chart in this issue.</p>

```js
const daysIn = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const covMonths = [...coverage.months].sort(byMonth);
const daysObserved = d3.sum(covMonths, (d) => d.days_observed);
const daysTotal = d3.sum(covMonths, (d) => daysIn(d.month));
const unobserved = covMonths.filter((d) => d.days_observed === 0).map((d) => d.month);
const h51 = `Listings were observed on ${num(daysObserved)} of ${num(daysTotal)} days; ${unobserved.length ? `the ${word(unobserved.length)} months from ${monthName(unobserved[0])} to ${monthName(unobserved.at(-1))} were not observed at all.` : "every month was observed on at least one day."}`;

function coverageStrip(width) {
  const n = covMonths.length;
  const cw = width / n;
  const top = 26, cellH = 14, H = 60;
  const el = svg`<svg width=${width} height=${H} viewBox="0 0 ${width} ${H}" style="display:block;overflow:visible;font-size:12.5px" aria-label="Days observed per month">
    ${covMonths.map((d, i) => {
      const share = d.days_observed / daysIn(d.month);
      const x = i * cw;
      return share === 0
        ? svg`<rect x=${x} y=${top} width=${Math.max(cw - 1, 1)} height=${cellH} fill="url(#nodata-fig-5-1)"><title>${monthName(d.month)}: not observed</title></rect>`
        : svg`<rect x=${x} y=${top} width=${Math.max(cw - 1, 1)} height=${cellH} fill=${INK_2} fill-opacity=${Math.max(0.12, share)}><title>${monthName(d.month)}: ${d.days_observed} of ${daysIn(d.month)} days</title></rect>`;
    })}
    ${covMonths.map((d, i) => d.month.endsWith("-01")
      ? svg`<g><line x1=${i * cw} x2=${i * cw} y1=${top - 6} y2=${top} stroke=${INK_3} stroke-width="1"/><text x=${i * cw + 3} y=${top - 10} fill=${INK_1} font-weight="500">${d.month.slice(0, 4)}</text></g>`
      : "")}
    <line x1="0" x2=${width} y1=${top + cellH + 0.5} y2=${top + cellH + 0.5} stroke=${INK_3} stroke-width="1"/>
    <text x="0" y=${H - 2} fill=${INK_3} font-size="11.5px">${monthShort(covMonths[0].month)}</text>
    <text x=${width} y=${H - 2} fill=${INK_3} font-size="11.5px" text-anchor="end">${monthShort(covMonths.at(-1).month)}</text>
  </svg>`;
  hatch(el, "nodata-fig-5-1");
  return el;
}
```

<figure class="fig" id="fig-5-1">
${kicker("5.1", "Days observed, by month")}
${headline(h51)}
<div class="fig-chart fp-strip">

```js
display(resize((width) => coverageStrip(width)));
```

</div>
${caption(html`One cell per month from ${monthName(covMonths[0].month)} to ${monthName(covMonths.at(-1).month)}. The darker the cell, the more days of the month on which listings were observed; hatched cells were not observed at all. Counts in thinly observed months reflect how much was observed, not the market; medians and shares tolerate the unevenness, which is why they carry the bulletin. <a href="./methodology">Notes</a> explains the coverage in full.`)}
${source(`Source: listings, ${monthName(covMonths[0].month)} to ${monthName(covMonths.at(-1).month)}. A day counts as observed when at least one listing was recorded on it.`)}
</figure>

</section>
