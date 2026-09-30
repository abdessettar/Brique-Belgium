<style>
/* Every listing only: a worksheet beside the results. */
.xp > .col-9 { grid-column: span 9; min-width: 0; }
.xp-side { border-top: 1px solid var(--hairline); padding-top: 28px; }
.xp-side > details > summary { display: none; }
.xp-side .controls { margin-bottom: 16px; }
.xp-side .controls form > div { display: flex; width: 100%; min-width: 0; }
.xp-side .controls input[type="range"] { flex: 1 1 40px; width: auto; min-width: 40px; }
.xp-side .controls input[type="number"] { flex: none; width: 8ch; }
.xp-side .controls select { width: 100%; }
.xp-match { font-size: 12.5px; line-height: 1.5; color: var(--ink-3); border-top: 1px solid var(--hairline); padding-top: 8px; margin: 0; font-variant-numeric: tabular-nums; }
.xp-match strong { color: var(--ink-1); font-weight: 500; }
.xp .section-num { position: static; display: inline-block; font-size: 26px; vertical-align: baseline; margin: 0 10px 6px 0; }
.xp > .col-9 > .section:first-child { margin-top: 0; }
.xp-empty .xp-data { display: none; }
.xp .summary-item { box-sizing: border-box; }
.xp .fig-legend { margin: 0 0 10px; }
.xp-legend-label { color: var(--ink-3); }
@media (min-width: 1024px) {
  .xp > .xp-side { position: sticky; top: 24px; }
}
@media (max-width: 1023.98px) {
  .xp > .xp-side, .xp > .col-9 { grid-column: 1 / -1; }
  .xp > .xp-side { position: static; }
  .xp-side .controls { grid-template-columns: 96px minmax(0, 360px); }
}
@media (max-width: 479.98px) {
  .xp-side { padding-top: 0; border-top: 0; }
  .xp-side > details > summary {
    display: block; list-style: none; cursor: pointer;
    font: 500 13px/1.4 var(--text); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-1);
    border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); padding: 10px 0;
  }
  .xp-side > details > summary::-webkit-details-marker { display: none; }
  .xp-side > details > summary::before { content: "▸"; display: inline-block; width: 16px; color: var(--ink-3); }
  .xp-side > details[open] > summary::before { content: "▾"; }
  .xp-side > details[open] > summary { border-bottom: 0; }
  .xp-side .xp-sheet-kicker { display: none; }
  .xp-side .controls { margin-top: 14px; grid-template-columns: 80px minmax(0, 1fr); }
}
</style>

```js
import {PAGE, INK_1, INK_2, INK_3, GRID, CLASSES, CLASS_COLOR, REGION_COLOR, BRICK_8} from "./components/palette.js";
import {eur, eurK, eurM2, rent, num, plural, aboveBelow, range, monthName} from "./components/sentences.js";
import {STYLE, h, marginRight, MARGINS, valueAxisY} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote, legend, summaryLine} from "./components/figure.js";
import {yearbook} from "./components/table.js";
import {thin, quantileSorted} from "./components/arrow.js";
```

```js
const saleTable = FileAttachment("data/listings-sale.parquet").parquet();
const rentTable = FileAttachment("data/listings-rent.parquet").parquet();
```

```js
// The chosen market's columns, read once into flat arrays so every filter change is a tight loop.
// Numbers become Float64Array with NaN for a missing value; words become small integer codes.
const table = deal === "sale" ? saleTable : rentTable;
const N = table.numRows;
function numeric(name) {
  const v = table.getChild(name);
  const out = new Float64Array(N);
  if (v.nullCount === 0) { out.set(v.toArray()); return out; }
  for (let i = 0; i < N; i++) { const x = v.get(i); out[i] = x == null ? NaN : x; }
  return out;
}
function coded(name) {
  const v = table.getChild(name);
  const keys = [], lookup = new Map(), codes = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    const s = v.get(i) ?? "";
    let c = lookup.get(s);
    if (c === undefined) { c = keys.length; keys.push(s); lookup.set(s, c); }
    codes[i] = c;
  }
  return {codes, keys, code: (s) => lookup.get(s) ?? -2};
}
const price = numeric("price");
const surface = numeric("surface");
const eurPerM2 = numeric("eur_m2");
const bedrooms = numeric("bedrooms");
const region = coded("region");
const cls = coded("class");
const epc = coded("epc");
const locality = coded("locality");
const province = coded("province");
const monthV = table.getChild("month");
let monthMin = "9999-99", monthMax = "0000-00";
for (let i = 0; i < N; i++) { const m = monthV.get(i); if (m < monthMin) monthMin = m; if (m > monthMax) monthMax = m; }
const OBSERVED = `${monthName(monthMin)} to ${monthName(monthMax)}`;
```

```js
// Commune names as the listings spell them, merged across spellings (ANTWERPEN, Antwerpen and
// antwerpen are one commune) and printed in title case that keeps the particles: Sint-Joost-ten-Node,
// Braine-l'Alleud, Heist-op-den-Berg, La Louvière.
const PARTICLES = new Set(["ten", "de", "den", "der", "van", "op", "aan", "sur", "en", "le", "la", "les", "du", "des", "et", "au", "aux", "lez", "lès", "l", "d", "s"]);
function titleCase(s) {
  return s.toLowerCase().replace(/[^\s\-'’()]+/g, (w, offset) => (offset > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}
const stripPostal = (k) => k.replace(/^\d{4}\s*(-\s*)?/, "").trim();
const normOf = (k) => stripPostal(k).toLowerCase().replace(/[\s'’]+/g, " ").replace(/\s*-\s*/g, "-");
const localityNorm = locality.keys.map(normOf);
const localityDisplay = new Map();
locality.keys.forEach((k, c) => {
  const n = localityNorm[c];
  if (!n) return;
  // Every spelling is recast rather than trusted. One commune can reach the listings in a dozen
  // forms, mixed case among them: Molenbeek-Saint-Jean also arrives as MOLENBEEK-SAINT-JEAN and
  // as Molenbeek-saint-jean, and taking whichever mixed-case form appeared first printed the
  // wrong one. The separators of the first spelling seen are kept so hyphens are not invented.
  if (!localityDisplay.has(n)) localityDisplay.set(n, {name: titleCase(stripPostal(k))});
});
```

```js
// One pass produces the index set every figure reuses, and the two class subsets with it.
const nActive = [fRegion !== "All", fClass !== "All", fEpc !== "All", fBeds > 0, fPrice < priceCap].filter(Boolean).length;
const wantRegion = fRegion === "All" ? null : region.code(fRegion);
const wantClass = fClass === "All" ? null : cls.code(fClass);
const wantEpc = fEpc === "All" ? null : epc.code(fEpc);
const codeHouse = cls.code("House"), codeApt = cls.code("Apartment");
const idx = [], idxHouse = [], idxApt = [];
for (let i = 0; i < N; i++) {
  if (price[i] > fPrice) continue;
  if (fBeds > 0 && !(bedrooms[i] >= fBeds)) continue;
  if (wantRegion !== null && region.codes[i] !== wantRegion) continue;
  if (wantClass !== null && cls.codes[i] !== wantClass) continue;
  if (wantEpc !== null && epc.codes[i] !== wantEpc) continue;
  idx.push(i);
  if (cls.codes[i] === codeHouse) idxHouse.push(i); else if (cls.codes[i] === codeApt) idxApt.push(i);
}
const byClass = {House: idxHouse, Apartment: idxApt};

/** The finite values of a column over an index set, sorted, as a typed array. */
function sortedOf(arr, ids) {
  const out = new Float64Array(ids.length);
  let k = 0;
  for (const i of ids) { const v = arr[i]; if (v === v) out[k++] = v; }
  return out.subarray(0, k).sort();
}
const q = (sorted, p) => (sorted.length ? quantileSorted(sorted, p) : null);
const sortedPrice = sortedOf(price, idx);
const sortedM2 = sortedOf(eurPerM2, idx);
const sortedSurface = sortedOf(surface, idx);
const stats = {n: idx.length, price: q(sortedPrice, 0.5), m2: q(sortedM2, 0.5), surface: q(sortedSurface, 0.5), p99: q(sortedPrice, 0.99)};
```

```js
// Words for the selection, so every headline describes what is actually on the page.
const SALE = deal === "sale";
const dealWord = SALE ? "for sale" : "to rent";
const classNoun = {All: ["home", "homes"], House: ["house", "houses"], Apartment: ["apartment", "apartments"]}[fClass];
const epcWord = fEpc === "All" ? "" : `${fEpc} rated `;
const regionWord = fRegion === "All" ? "" : ` in ${fRegion}`;
const bedsWord = fBeds > 0 ? ` with ${fBeds} or more bedroom${fBeds === 1 ? "" : "s"}` : "";
const capWord = fPrice < priceCap ? ` asking up to ${eur(fPrice)}${SALE ? "" : " a month"}` : "";
const priceWord = (v) => (SALE ? eur(v) : rent(v));
const plural2 = (c) => (c === "House" ? "houses" : "apartments");
const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const selection = (n) => `${num(n)} ${epcWord}${classNoun[n === 1 ? 0 : 1]} ${dealWord}${regionWord}${bedsWord}${capWord}`;
const h1 = stats.n === 0 ? "No listing matches these filters."
  : stats.n === 1 ? `The one ${epcWord}${classNoun[0]} ${dealWord}${regionWord}${bedsWord}${capWord} asks ${priceWord(stats.price)}.`
  : `Half of the ${selection(stats.n)} ask ${priceWord(stats.price)} or less.`;
```

```js
// An empty selection hides the figures; on phones the worksheet folds into its summary.
{
  const results = document.getElementById("xp-results");
  if (results) results.classList.toggle("xp-empty", stats.n === 0);
  const sheet = document.getElementById("xp-sheet");
  if (sheet && !sheet.dataset.bound) {
    sheet.dataset.bound = "1";
    const mq = matchMedia("(max-width: 479.98px)");
    const apply = () => { sheet.open = !mq.matches; };
    apply();
    mq.addEventListener("change", apply);
  }
}
```

<p class="kicker">Every listing observed in the last 24 months</p>

# Every listing

<div class="row top">
<div class="main">
<p class="lede">Every listing observed in the last 24 months, ${num(N)} ${dealWord}, filtered as you type. Set the worksheet and the summary, the two figures and the commune table redraw from the listings that match.</p>
</div>
<aside class="side">${standingNote()}
${sidenote("In the browser", html`The listings are loaded once and filtered on this page; nothing is sent anywhere. A wide selection takes a moment to redraw.`)}</aside>
</div>

<div class="row top xp">
<div class="col-3 xp-side">
<details id="xp-sheet" open>
<summary>Filters, ${nActive} active</summary>
<p class="kicker xp-sheet-kicker">Worksheet</p>
<div class="controls">
<div class="ctl-label">Market</div>

```js
const deal = view(Inputs.radio(new Map([["For sale", "sale"], ["To rent", "rent"]]), {value: "sale"}));
```

<div class="ctl-label">Region</div>

```js
const fRegion = view(Inputs.select(["All", "Flanders", "Wallonia", "Brussels"], {value: "All"}));
```

<div class="ctl-label">Type</div>

```js
const fClass = view(Inputs.select(new Map([["All", "All"], ["House", "House"], ["Apartment", "Apartment"]]), {value: "All"}));
```

<div class="ctl-label">EPC</div>

```js
const fEpc = view(Inputs.select(["All", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"], {value: "All"}));
```

<div class="ctl-label">Bedrooms, at least</div>

```js
const fBeds = view(Inputs.range([0, 6], {step: 1, value: 0}));
```

<div class="ctl-label">${deal === "sale" ? "Price, at most" : "Rent, at most"}</div>

```js
const priceCap = deal === "sale" ? 2150000 : 15000;
const fPrice = view(Inputs.range([0, priceCap], {step: deal === "sale" ? 10000 : 100, value: priceCap}));
```

</div>
<p class="xp-match"><strong>${num(stats.n)}</strong> of ${num(N)} listings match.</p>
</details>
</div>
<div class="col-9" id="xp-results">
<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">This selection</p>

## This selection

<p class="lede">Four figures for the listings that match the worksheet, each computed from every matching listing, and the spread of their asking ${SALE ? "prices" : "rents"}.</p>

${headline(h1)}
<div class="xp-data">
${summaryLine([
  {value: num(stats.n), label: "listings"},
  {value: eur(stats.price), label: SALE ? "median asking price" : "median rent a month"},
  {value: stats.m2 == null ? "n/a" : eur(stats.m2) + "/m²", label: SALE ? "median per m²" : "median rent per m²"},
  {value: stats.surface == null ? "n/a" : num(stats.surface) + " m²", label: "median surface"}
])}
</div>

```js
// Figure 1.1: the histogram is counted from every matching listing, not a subset, so the y axis
// is a true count. The top one percent of prices is cut so the bulk is readable.
const histClasses = CLASSES.filter((c) => byClass[c].length > 0);
const classSorted = Object.fromEntries(histClasses.map((c) => [c, sortedOf(price, byClass[c])]));
const classMedian = Object.fromEntries(histClasses.map((c) => [c, q(classSorted[c], 0.5)]));
const histStep = SALE ? 50000 : 100;
const histHi = stats.n ? Math.max(Math.ceil(stats.p99 / histStep) * histStep, sortedPrice[0] + histStep) : histStep;
const histLo = stats.n ? Math.floor(sortedPrice[0] / histStep) * histStep : 0;
const histCut = stats.n ? sortedPrice.length - d3.bisectLeft(sortedPrice, histHi) : 0;
const h11 = stats.n === 0 ? "No listing matches these filters."
  : histClasses.length === 2
    ? `${sentenceCase(plural2("House"))} ${dealWord}${regionWord} ask ${priceWord(classMedian.House)} at the median, ${aboveBelow(classMedian.House, classMedian.Apartment)} apartments at ${priceWord(classMedian.Apartment)}.`
    : `${sentenceCase(plural2(histClasses[0]))} ${dealWord}${regionWord} ask ${priceWord(classMedian[histClasses[0]])} at the median; a quarter ask ${priceWord(q(classSorted[histClasses[0]], 0.25))} or less and a quarter ${priceWord(q(classSorted[histClasses[0]], 0.75))} or more.`;
```

<figure class="fig xp-data" id="fig-1-1">
${kicker("1.1", `Asking ${SALE ? "prices" : "rents"}, ${histClasses.length === 2 ? "houses and apartments" : plural2(histClasses[0] ?? "House")}`)}
${headline(h11)}
<div class="fig-chart">

```js
display(resize((width) => {
  if (width < 10 || !stats.n) return html`<span></span>`;
  const edges = d3.ticks(histLo, histHi, 44);
  if (edges[0] > histLo) edges.unshift(histLo);
  if (edges.at(-1) < histHi) edges.push(histHi);
  const nb = edges.length - 1;
  const counts = Object.fromEntries(histClasses.map((c) => [c, new Float64Array(nb)]));
  for (const c of histClasses) {
    const arr = counts[c];
    for (const i of byClass[c]) {
      const p = price[i];
      if (p >= histHi) continue;
      let k = d3.bisectRight(edges, p) - 1;
      if (k >= nb) k = nb - 1;
      if (k >= 0) arr[k]++;
    }
  }
  const rects = [], tips = [];
  for (let k = 0; k < nb; k++) {
    let y0 = 0;
    const tip = {x1: edges[k], x2: edges[k + 1], total: 0};
    for (const c of histClasses) {
      const n = counts[c][k];
      rects.push({x1: edges[k], x2: edges[k + 1], y1: y0, y2: y0 + n, class: c, n});
      tip[c] = n;
      y0 += n;
    }
    tip.total = y0;
    tips.push(tip);
  }
  const peak = d3.max(rects, (d) => d.y2) || 1;
  const count = Math.max(4, Math.round(h(width) / 60));
  const [, hi] = d3.nice(0, peak * 1.08, count);
  const ticks = d3.ticks(0, hi, count).filter((t) => t > 0 && t < hi);
  // The class medians are ruled in the class colour and named in ink in the margin above the
  // frame, the lower one to the left of its rule and the upper one to the right, so the two
  // labels never meet and never sit on a bar.
  const meds = histClasses.map((c) => ({class: c, x: classMedian[c]})).sort((a, b) => a.x - b.x);
  const medLabel = (d) => `${plural2(d.class)} ${eur(d.x)}`;
  const nearRight = (d) => (d.x - histLo) / (histHi - histLo) > 0.72;
  const leftOf = meds.length === 2 ? [meds[0]] : meds.filter(nearRight);
  const rightOf = meds.length === 2 ? [meds[1]] : meds.filter((d) => !nearRight(d));
  const labelStyle = {frameAnchor: "top", dy: -6, lineAnchor: "bottom", text: medLabel, fill: INK_1, fontSize: 12, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"};
  return Plot.plot({
    width, height: h(width), ...MARGINS, marginRight: 12, style: STYLE,
    x: {domain: [histLo, histHi], label: null, axis: null},
    y: {domain: [0, hi], label: null, axis: null},
    marks: [
      ...valueAxisY("LISTINGS", {tickFormat: num, ticks}),
      Plot.rect(rects.filter((d) => d.class === histClasses[0]), {x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: (d) => CLASS_COLOR[d.class], insetLeft: 0.5, insetRight: 0.5, insetTop: histClasses.length === 2 ? 1 : 0}),
      histClasses.length === 2 ? Plot.rect(rects.filter((d) => d.class === histClasses[1]), {x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: (d) => CLASS_COLOR[d.class], insetLeft: 0.5, insetRight: 0.5}) : null,
      Plot.ruleX(meds, {x: "x", stroke: (d) => CLASS_COLOR[d.class], strokeWidth: 1}),
      Plot.text(leftOf, {x: "x", dx: -5, textAnchor: "end", ...labelStyle}),
      Plot.text(rightOf, {x: "x", dx: 5, textAnchor: "start", ...labelStyle}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({ticks: width > 600 ? 8 : 4, tickSize: 4, tickPadding: 6, label: null, tickFormat: eurK, fill: INK_2}),
      Plot.tip(tips, Plot.pointerX({
        x: (d) => (d.x1 + d.x2) / 2, y: "total", maxRadius: 40,
        title: (d) => [range(d.x1, d.x2, eur), ...histClasses.map((c) => `${plural2(c)}\t${num(d[c])}`)].join("\n")
      }))
    ]
  });
}));
```

</div>
${caption(`Each bar counts the matching listings asking within a band of ${SALE ? "about " + eurK(histStep) : eur(histStep) + " a month"}, houses in brick stacked under apartments in bluestone. A vertical rule marks each class's median in the class colour, with the figure printed above it in ink. ${histCut > 0 ? `The ${plural(histCut, "listing")} above ${eur(histHi)}, the top one percent of the selection, are not drawn.` : ""}`)}
${source(`Source: ${SALE ? "sale" : "rental"} listings, ${OBSERVED}. Counts of every listing that matches the worksheet.`)}
</figure>
</section>

<section class="section xp-data" id="s2">
<span class="section-num">2</span><p class="kicker">Surface</p>

## Price against surface

<p class="lede">Each listing placed by its habitable surface and its asking ${SALE ? "price" : "rent"}, counted into hexagonal cells. The dashed diagonal is the selection's median ${SALE ? "price" : "rent"} per square metre; cells above it are dearer for their size, cells below it cheaper.</p>

```js
const hexIdx = byClass[hexClass] ?? [];
const hexM2Sorted = sortedOf(eurPerM2, hexIdx);
const hexM2 = q(hexM2Sorted, 0.5);
const perM2 = (v) => `${eur(v)} per square metre${SALE ? "" : " a month"}`;
const h21 = !hexIdx.length ? `No ${hexClass.toLowerCase()} matches these filters.`
  : hexM2 == null ? `${sentenceCase(plural2(hexClass))} ${dealWord}${regionWord} carry no habitable surface to price by.`
  : `${sentenceCase(plural2(hexClass))} ${dealWord}${regionWord} ask ${perM2(hexM2)} at the median; half of them fall between ${eur(q(hexM2Sorted, 0.25))} and ${eur(q(hexM2Sorted, 0.75))}.`;
const X_MAX = SALE ? 500 : 300;
const yStep = SALE ? 50000 : 100;
const hexSortedPrice = sortedOf(price, hexIdx);
const Y_CAP = hexIdx.length ? Math.ceil(q(hexSortedPrice, 0.99) / yStep) * yStep : yStep;
const HEX_LIMIT = 120000;
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", `Asking ${SALE ? "price" : "rent"} against habitable surface, ${plural2(hexClass)}`)}
${headline(h21)}
<div class="fig-controls">

```js
const hexClass = view(Inputs.radio(fClass === "All" ? CLASSES : [fClass], {label: "Type", value: fClass === "All" ? "House" : fClass}));
```

</div>
<div class="fig-chart">

```js
display(resize((width) => {
  if (width < 10 || !hexIdx.length) return html`<span></span>`;
  const limit = width > 760 ? HEX_LIMIT : HEX_LIMIT / 2;
  const rows = [];
  for (const i of thin(hexIdx, limit)) {
    const s = surface[i], p = price[i];
    if (s > 0 && s <= X_MAX && p <= Y_CAP) rows.push({surface: s, price: p});
  }
  const mr = marginRight(width);
  const frame = {width, height: h(width), ...MARGINS, marginRight: mr, marginBottom: 46};
  const scales = {x: {domain: [0, X_MAX], label: null, axis: null}, y: {domain: [0, Y_CAP], label: null, axis: null}};
  const count = Math.max(4, Math.round(h(width) / 60));
  const ticks = d3.ticks(0, Y_CAP, count).filter((t) => t > 0 && t < Y_CAP);
  // The diagonal leaves the frame through the top when the cap is reached before 500 m², and
  // through the right edge otherwise; its label sits just outside the frame at that point.
  const xEnd = hexM2 ? Math.min(X_MAX, Y_CAP / hexM2) : 0;
  const diag = hexM2 ? [{x: 0, y: 0}, {x: xEnd, y: hexM2 * xEnd}] : [];
  const atTop = hexM2 && xEnd < X_MAX;
  const diagLabel = width > 480 ? eurM2(hexM2) : eur(hexM2) + "/m²";
  const breaks = hexBreaks(rows, frame, scales);
  const colors = hexColors(breaks.length + 1);
  const svg = Plot.plot({
    ...frame, style: STYLE, ...scales,
    color: {type: "threshold", domain: breaks, range: colors},
    marks: [
      Plot.gridX({stroke: GRID, strokeWidth: 1, ticks: width > 600 ? 10 : 5}),
      ...valueAxisY(SALE ? "€ ASKING PRICE" : "€ RENT A MONTH", {tickFormat: eurK, ticks}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({ticks: width > 600 ? 10 : 5, tickSize: 4, tickPadding: 6, label: null, tickFormat: num, fill: INK_2}),
      Plot.text(["HABITABLE SURFACE, M²"], {frameAnchor: "bottom-right", dy: 40, text: (d) => d, fill: INK_3, fontSize: 11.5, fontWeight: 500, textAnchor: "end"}),
      Plot.dot(rows, Plot.hexbin({
        fill: "count",
        title: {reduceIndex: (I) => {
          const ps = new Float64Array(I.length), ss = new Float64Array(I.length);
          I.forEach((i, k) => { ps[k] = rows[i].price; ss[k] = rows[i].surface; });
          ps.sort(); ss.sort();
          return `${plural(I.length, "listing")} in this cell\nmedian ${SALE ? "price" : "rent"}\t${eur(quantileSorted(ps, 0.5))}\nmedian surface\t${num(quantileSorted(ss, 0.5))} m²`;
        }}
      }, {x: "surface", y: "price", binWidth: 14, stroke: PAGE, strokeWidth: 0.5, tip: true})),
      Plot.line(diag, {x: "x", y: "y", stroke: INK_3, strokeWidth: 1, strokeDasharray: "3 3"}),
      hexM2 ? (atTop
        ? Plot.text(diag.slice(1), {x: "x", y: "y", text: () => diagLabel, fill: INK_3, fontSize: 12, textAnchor: xEnd > X_MAX * 0.8 ? "end" : "middle", lineAnchor: "bottom", dy: -5})
        : Plot.text(diag.slice(1), {x: "x", y: "y", text: () => diagLabel, fill: INK_3, fontSize: 12, textAnchor: "start", dx: 6})) : null
    ]
  });
  const lg = legend(hexLegend(breaks, colors));
  lg.prepend(html`<span class="xp-legend-label">Listings per cell</span>`);
  return html`<div>${lg}${svg}</div>`;
}));

/** The largest cell count, read from a dry run of the same hexbin so the classes follow exactly
 *  the cells Plot draws (the bins depend on the plot's pixel geometry). */
function hexMax(rows, frame, scales) {
  let max = 1;
  Plot.plot({...frame, ...scales, marks: [Plot.dot(rows, Plot.hexbin({fill: {reduceIndex: (I) => (max = Math.max(max, I.length), I.length)}}, {x: "surface", y: "price", binWidth: 14}))]});
  return max;
}
/** Log-spaced class breaks on the cell counts, so one dark cell in a city cannot flatten the rest. */
function hexBreaks(rows, frame, scales) {
  const max = hexMax(rows, frame, scales);
  const breaks = [];
  for (let k = 1; k <= 7; k++) {
    const b = Math.round(Math.pow(max, k / 8));
    if (b > (breaks.at(-1) ?? 1)) breaks.push(b);
  }
  return breaks.length ? breaks : [2];
}
/** m colours spread evenly through the brick ramp, light to dark. */
function hexColors(m) {
  if (m >= BRICK_8.length) return BRICK_8;
  return Array.from({length: m}, (_, i) => BRICK_8[Math.round((i * (BRICK_8.length - 1)) / (m - 1))]);
}
function hexLegend(breaks, colors) {
  const items = [];
  let lo = 1;
  breaks.forEach((b, i) => {
    items.push([b - 1 <= lo ? num(lo) : `${num(lo)} to ${num(b - 1)}`, colors[i]]);
    lo = b;
  });
  items.push([`${num(lo)} or more`, colors.at(-1)]);
  return items;
}
```

</div>
${caption(`Habitable surface across, asking ${SALE ? "price" : "rent"} up; each hexagon is a cell of about 14 pixels and its fill is the number of listings inside it, in brick from light for the sparsest cells to dark for the densest, on a logarithmic step so the crowded middle does not wash out the edges. Hover or touch a cell for its count and median. ${sentenceCase(plural2(hexClass))} only; use the tab to switch. Listings without a surface, larger than ${num(X_MAX)} m² or above ${eur(Y_CAP)} are not drawn.`)}
${source(`Source: ${SALE ? "sale" : "rental"} listings, ${OBSERVED}. Drawn from at most ${num(HEX_LIMIT)} of the matching ${plural2(hexClass)}, taken evenly through the selection; the medians in the headline use every one.`)}
</figure>
</section>

<section class="section xp-data" id="s3">
<span class="section-num">3</span><p class="kicker">Communes</p>

## Communes for this filter

<p class="lede">Every commune with at least 20 matching listings, most listings first. The medians are of the matching listings in that commune, not of the commune as a whole.</p>

```js
const MIN_ROWS = 20;
const communes = (() => {
  const groups = new Map();
  for (const i of idx) {
    const n = localityNorm[locality.codes[i]];
    if (!n) continue;
    let g = groups.get(n);
    if (!g) groups.set(n, (g = {key: n, prices: [], m2: [], regions: new Map(), provinces: new Map()}));
    g.prices.push(price[i]);
    if (eurPerM2[i] === eurPerM2[i]) g.m2.push(eurPerM2[i]);
    const r = region.keys[region.codes[i]], p = province.keys[province.codes[i]];
    if (r && r !== "Unknown") g.regions.set(r, (g.regions.get(r) ?? 0) + 1);
    if (p) g.provinces.set(p, (g.provinces.get(p) ?? 0) + 1);
  }
  const mode = (m) => (m.size ? d3.greatest(m, ([, v]) => v)[0] : null);
  return Array.from(groups.values())
    .filter((g) => g.prices.length >= MIN_ROWS)
    .map((g) => ({
      key: g.key, name: localityDisplay.get(g.key)?.name ?? g.key, region: mode(g.regions), province: mode(g.provinces),
      n: g.prices.length, median: q(Float64Array.from(g.prices).sort(), 0.5), m2: g.m2.length ? q(Float64Array.from(g.m2).sort(), 0.5) : null
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
})();
const top = communes[0];
const h31 = !communes.length ? `No commune has ${MIN_ROWS} or more matching listings.`
  : `${top.name} carries the most matching listings, ${num(top.n)} of them at a median of ${priceWord(top.median)}; ${communes.length === 1 ? "no other commune reaches" : `${num(communes.length - 1)} other ${communes.length === 2 ? "commune reaches" : "communes reach"}`} ${MIN_ROWS} listings.`;
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", "Communes with at least 20 matching listings")}
${headline(h31)}
<div class="fig-chart">

```js
display(yearbook({
  columns: [
    {label: "Commune", key: "name", name: true, swatch: (r) => (r.region ? REGION_COLOR[r.region] : null)},
    {label: "Province", key: "province", align: "left"},
    {label: "Listings", key: "n", format: num},
    {label: SALE ? "Median €" : "Rent €/mo", key: "median", format: num},
    {label: SALE ? "€/m²" : "Rent €/m²", key: "m2", format: num}
  ],
  rows: communes, limit: 25, total: communes.length, key: "key"
}));
```

</div>
${caption(`Communes are named as the listings spell them, spellings merged. The swatch before a name gives its region: Flanders in brick, Wallonia in bluestone, Brussels in gilt. ${SALE ? "Median €" : "Rent €/mo"} is the median asking ${SALE ? "price" : "rent"} of the matching listings in the commune; ${SALE ? "€/m²" : "rent €/m²"} is the median of their ${SALE ? "price" : "rent"} per square metre of habitable surface, with a dot where none of them carries a surface.`)}
${source(`Source: ${SALE ? "sale" : "rental"} listings, ${OBSERVED}. ${plural(communes.length, "commune")} with at least ${MIN_ROWS} matching listings; the first 25 are shown.`)}
</figure>

<div class="footnotes">
<p>Asking prices are winsorised before anything is counted: sale prices are kept between €80,000 and €2,150,000 and rents between €300 and €15,000 a month, the first and ninety-ninth percentiles of the observed listings. Apartment blocks and mixed-use buildings are excluded throughout; they are priced per building rather than per dwelling and would distort every median.</p>
<p>The summary figures, the histogram and the commune table use every matching listing. Figure 2.1 draws from at most ${num(HEX_LIMIT)} of them, taken evenly through the selection, so a wide selection stays quick to redraw; its headline medians use every listing. A listing counts once, at its latest observation.</p>
</div>
</section>
</div>
</div>
