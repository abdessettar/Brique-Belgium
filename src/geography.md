<style>
/* Geography only. */
.geo-scatter svg text { font-family: "Libre Franklin", "Helvetica Neue", Arial, sans-serif; }
</style>

```js
import {PAGE, INK_1, INK_2, INK_3, GRID, REGION_COLOR, REGION_TEXT, REGIONS} from "./components/palette.js";
import {eur, eurK, eurM2, eurM2Short, num, pct, pctWord, plural, times, fixed, median, monthName, sentence} from "./components/sentences.js";
import {STYLE, MARGINS, valueAxisY} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote} from "./components/figure.js";
import {communeMap, classify} from "./components/choropleth.js";
import {yearbook} from "./components/table.js";
```

```js
const communes = FileAttachment("data/communes.json").json();
const geo = FileAttachment("data/communes.geo.json").json();
const trends = FileAttachment("data/trends.json").json();
```

```js
const summary = communes.summary;
const FIRST = "2023-01";
const LAST = d3.max(trends.sale, (d) => d.month);
const PANEL = `listings, ${monthName(FIRST)} to ${monthName(LAST)}, each counted once at its latest observation`;

/* Commune names: the boundary file carries the official commune name; the listings spell the
   locality of the largest postal code, sometimes in capitals. The official name is used wherever
   the boundary file has it, so the map lists, the table and the scatter agree. */
const PARTICLES = new Set(["de", "den", "der", "du", "des", "la", "le", "les", "l", "d", "sur", "aux", "au", "en", "ten", "ter", "op", "van", "et", "sous", "lez", "lès"]);
function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().split(/([ \-'’])/).map((part, i, parts) => {
    if (/^[ \-'’]$/.test(part) || !part) return part;
    const first = parts.slice(0, i).every((p) => /^[ \-'’]$/.test(p) || !p);
    return !first && PARTICLES.has(part) ? part : part.charAt(0).toUpperCase() + part.slice(1);
  }).join("");
}
const geoName = new Map(geo.features.map((f) => [+f.properties.nis, f.properties.name]));
const nameOf = (r) => geoName.get(+r.nis) ?? titleCase(r.locality);
const rows = communes.communes.map((r) => ({...r, name: nameOf(r)}));
const finite = (v) => v != null && Number.isFinite(v);
```

<p class="kicker">Commune level · asking prices</p>

# Geography

<div class="row top">
<div class="main">
<p class="lede">Every commune with a usable sample, ranked and mapped. Gross rental yield is shown only where both the buy and rent sides clear ${num(summary.min_side_sample)} listings; ${num(summary.n_with_yield)} of ${num(summary.n_communes)} communes qualify.</p>
</div>
<aside class="side">${standingNote()}${sidenote("Method", html`A commune's figure is the sample-weighted rollup of the medians of its postal codes, not a pooled median of every listing in it. Communes are the ${num(summary.n_communes)} of 1 January 2025.`)}</aside>
</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">Communes</p>

## The map

<p class="lede">Four layers on one map. Price per square metre and demand are magnitudes, drawn light to dark in brick; gross yield and the gap between asking and recorded prices are signed, drawn in bluestone below the pivot and brick above it, with mortar for the communes nearest the pivot. Hover a commune, or tap it to pin, and its figures appear in the panel beside the map.</p>

```js
const LAYERS = {
  median_eur_m2: {label: "Price per m²", kind: "sequential", format: eurM2Short, unit: "€/m²"},
  gross_yield_pct: {label: "Gross yield", kind: "diverging", pivot: "median", format: (v) => pct(v, 2), unit: "yield %"},
  asking_vs_official_pct: {label: "Asking against recorded", kind: "diverging", pivot: 0, format: (v) => pct(v, 1, true), unit: "%"},
  median_views_per_day: {label: "Demand", kind: "sequential", format: (v) => fixed(v, 0), unit: "views/day"}
};
const LAYER_SUBJECT = {
  median_eur_m2: "Median asking price per m², by commune",
  gross_yield_pct: "Gross rental yield, by commune",
  asking_vs_official_pct: "Asking price against the last recorded sale price, by commune",
  median_views_per_day: "Listing page views per day per listing, by commune"
};
const LAYER_CAPTION = {
  median_eur_m2: "Median asking price per square metre of habitable surface, in seven quantile classes from light brick for the cheapest seventh of communes to dark brick for the dearest; each class holds about the same number of communes and the legend prints its range. Hatched communes have no usable sample.",
  gross_yield_pct: "Twelve months of median asking rent divided by median asking price, shown only where both sides clear the sample floor. Seven classes centred on the median commune: bluestone for yields below it, mortar for the communes nearest it, brick for yields above it. A high yield is mostly a low price. Hatched communes have no usable sample on one side or the other.",
  asking_vs_official_pct: "The current median asking price against the median price recorded at sale in the first half of 2025, as a percentage of the recorded price. Seven classes centred on zero: bluestone where sellers ask less than the last recorded price, mortar where the two are close, brick where they ask more. Hatched communes have no recorded price. Section 3 explains why the two are not strictly comparable.",
  median_views_per_day: "Listing page views per day per listing, the median of the commune's sale listings; views are shown on this layer and nowhere else. Seven quantile classes from light brick for the least viewed seventh of communes to dark brick for the most viewed. Hatched communes have no usable sample."
};
```

```js
const layerSpec = LAYERS[layer];
const cls = classify(rows.map((r) => r[layer]), layerSpec);
const valued = rows.filter((r) => finite(r[layer])).sort((a, b) => d3.descending(a[layer], b[layer]) || d3.ascending(a.name, b.name));
const top = valued[0], bottom = valued.at(-1);
const medianCommune = median(rows.map((r) => r[layer]));
const h11 = !top ? "No commune has a usable sample on this layer."
  : layer === "median_eur_m2" ? `${top.name} asks ${eurM2(top[layer])}, ${times(top[layer] / bottom[layer])} ${bottom.name} at ${eur(bottom[layer])}.`
  : layer === "gross_yield_pct" ? `${top.name} yields ${pctWord(top[layer], 2)} gross against a median commune of ${pctWord(medianCommune, 2)}; ${bottom.name} yields ${fixed(bottom[layer], 2)}.`
  : layer === "asking_vs_official_pct" ? `Sellers ask above the last recorded sale price in ${pctWord(100 * valued.filter((r) => r[layer] > 0).length / valued.length, 0)} of the ${num(valued.length)} communes with a recorded price.`
  : `Listings in ${top.name} draw ${plural(Math.round(top[layer]), "view")} a day; the median commune draws ${num(medianCommune)}.`;
```

<figure class="fig" id="fig-1-1">
${kicker("1.1", LAYER_SUBJECT[layer])}
${headline(h11)}
<div class="fig-controls">

```js
const layer = view(Inputs.radio(Object.keys(LAYERS), {label: "Layer", value: "median_eur_m2", format: (k) => LAYERS[k].label}));
```

</div>
<div class="fig-chart">

```js
display(resize((width) => communeMap({geo, rows, layers: LAYERS, layer, width, id: "fig-1-1"})));
```

</div>
${caption(`${LAYER_CAPTION[layer]} At rest the panel shows the median commune on each measure, not a national figure; the Highest ten and Lowest ten are ranked on the layer shown.`)}
${source(`Source: ${PANEL}. Recorded sale prices: Statbel, first half of 2025. Commune boundaries: Opendatasoft georef, 2025 communes.`)}
</figure>
</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">Ranked</p>

## Every commune

<p class="lede">The yearbook: one row per commune, sortable, with the sample behind every figure. The minimum listings control drops the thinnest communes; the yield columns stay empty where the rent side is too small to carry a median.</p>

```js
const SORTS = new Map([
  ["Gross yield, high to low", {key: "gross_yield_pct", dir: -1}],
  ["Gross yield, low to high", {key: "gross_yield_pct", dir: 1}],
  ["Price per m², high to low", {key: "median_eur_m2", dir: -1}],
  ["Price per m², low to high", {key: "median_eur_m2", dir: 1}],
  ["Listings", {key: "n_sale", dir: -1}]
]);
```

```js
const sortSpec = SORTS.get(sortBy);
const eligible = rows.filter((r) => r.n_sale >= minSample);
const ranked = [...eligible].sort((a, b) => {
  const av = a[sortSpec.key], bv = b[sortSpec.key];
  if (!finite(av) && !finite(bv)) return d3.ascending(a.name, b.name);
  if (!finite(av)) return 1;
  if (!finite(bv)) return -1;
  return sortSpec.dir * (av - bv) || d3.ascending(a.name, b.name);
});
const withValue = ranked.filter((r) => finite(r[sortSpec.key]));
const first = withValue[0], last = withValue.at(-1);
const VERB = {gross_yield_pct: ["yields most", "least"], median_eur_m2: ["asks most per square metre", "least"], n_sale: ["carries the most listings", "the fewest"]};
const h21 = !first ? `No commune clears ${num(minSample)} listings.`
  : withValue.length === 1 ? `${plural(eligible.length, "commune")} ${eligible.length === 1 ? "clears" : "clear"} ${num(minSample)} listings; only ${first.name} carries the sorted figure.`
  : `${plural(eligible.length, "commune")} ${eligible.length === 1 ? "clears" : "clear"} ${num(minSample)} listings; ${sortSpec.dir < 0 ? first.name : last.name} ${VERB[sortSpec.key][0]}, ${sortSpec.dir < 0 ? last.name : first.name} ${VERB[sortSpec.key][1]}.`;
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", "Every commune with a usable sample")}
${headline(h21)}
<div class="fig-controls">

```js
const sortBy = view(Inputs.select([...SORTS.keys()], {label: "Sort", value: "Gross yield, high to low"}));
```

```js
const minSample = view(Inputs.range([30, 1000], {step: 10, value: 100, label: "Minimum listings"}));
```

</div>

```js
display(yearbook({
  columns: [
    {label: "Commune", key: "name", name: true, swatch: (r) => REGION_COLOR[r.region]},
    {label: "Province", key: "province", align: "left"},
    {label: "Listings", key: "n_sale", format: num},
    {label: "Median €", key: "median_price", format: eur},
    {label: "€/m²", key: "median_eur_m2", format: eur},
    {label: "Rent €/mo", key: "median_rent", format: eur},
    {label: "Yield %", key: "gross_yield_pct", format: (v) => fixed(v, 2)},
    {label: "Recorded €", key: "official_median_price", format: eur, title: "Median recorded sale price, first half of 2025"},
    {label: "Asking vs recorded %", key: "asking_vs_official_pct", format: (v) => pct(v, 1, true)}
  ],
  rows: ranked, limit: 25, key: "nis"
}));
```

${caption(`Communes with at least ${num(minSample)} sale listings, sorted ${sortBy.charAt(0).toLowerCase() + sortBy.slice(1)}. The swatch before the name is the region: Flanders in brick, Wallonia in bluestone, Brussels in gilt. Gross yield is twelve months of median asking rent over the median asking price and is left blank where the rent side has fewer than ${num(summary.min_side_sample)} listings; a middle dot marks a figure that is not available. The recorded price is the median sale price of the first half of 2025.`)}
${source(`Source: ${PANEL}. Recorded sale prices: Statbel, first half of 2025.`)}
</figure>
</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">Recorded sales</p>

## Asking against recorded

<p class="lede">Statbel records what homes sold for; the listings record what sellers asked. Set one against the other, commune by commune, and the diagonal is where the two agree.</p>

```js
const SCATTER_FLOOR = 100;
const scatter = rows.filter((r) => finite(r.official_median_price) && finite(r.median_price) && r.n_sale >= SCATTER_FLOOR)
  .map((r) => ({...r, gap: (r.median_price / r.official_median_price - 1) * 100}));
const gapMedian = median(scatter.map((r) => r.gap));
const gapTop = d3.greatest(scatter, (r) => r.gap), gapBottom = d3.least(scatter, (r) => r.gap);
const labelled = [...scatter].sort((a, b) => d3.descending(Math.abs(a.median_price - a.official_median_price), Math.abs(b.median_price - b.official_median_price))).slice(0, 6);
const aboveShare = scatter.filter((r) => r.gap > 0).length / scatter.length;
const labelledBrussels = labelled.filter((r) => r.region === "Brussels").length;
const WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const labelledNote = labelledBrussels === labelled.length ? "all of them are in Brussels"
  : labelledBrussels === 0 ? "none of them is in Brussels"
  : `${WORDS[labelledBrussels]} of them ${labelledBrussels === 1 ? "is" : "are"} in Brussels`;
const h31 = `Asking prices sit a median ${pctWord(Math.abs(gapMedian), 1)} ${gapMedian >= 0 ? "above" : "below"} recorded sale prices; ${gapTop.name} asks ${pctWord(gapTop.gap, 0)} more, ${gapBottom.name} ${pctWord(Math.abs(gapBottom.gap), 0)} less.`;
const REGION_ORDER = ["Flanders", "Wallonia", "Brussels"];
const scatterOrdered = REGION_ORDER.flatMap((region) => scatter.filter((r) => r.region === region));

function scatterFigure(width) {
  // A square plot area, so a euro on each axis is the same number of pixels and the diagonal
  // runs at 45 degrees.
  const marginLeft = MARGINS.marginLeft, marginTop = MARGINS.marginTop, marginBottom = 30, mr = 12;
  const plotW = width - marginLeft - mr, plotH = plotW;
  const height = plotH + marginTop + marginBottom;
  const hi = d3.nice(0, d3.max(scatter, (r) => Math.max(r.median_price, r.official_median_price)), 5)[1];
  const domain = [0, hi];
  const ticks = d3.ticks(0, hi, 5).filter((t) => t > 0 && t < hi);
  const kx = plotW / hi, ky = plotH / hi; // px per euro on each axis
  // Label positions: away from the diagonal, in data units so the leaders re-render with the plot.
  const off = 26;
  // On a narrow plot the long Brussels names are shortened ("Woluwe-St-Pierre") and every label
  // is kept inside the plot: a right-running label whose end would pass the edge starts earlier,
  // so its leader shortens rather than the name being cut.
  const narrow = plotW < 480;
  const labels = labelled.map((r) => {
    const above = r.gap > 0;
    const label = narrow ? r.name.replace(/\b(Saint|Sint)-/g, "St-") : r.name;
    const est = 6 + label.length * 6.4; // px, Franklin 12px
    let lx = r.official_median_price + (above ? -off : off) / kx;
    if (above) lx = Math.max(lx, est / kx); else lx = Math.min(lx, (plotW + mr - est) / kx);
    return {...r, label, lx, ly: r.median_price + (above ? off : -off) / ky, anchor: above ? "end" : "start"};
  });
  // Dodge labels on the same side that would sit closer than 15px apart vertically.
  for (const side of ["end", "start"]) {
    const group = labels.filter((l) => l.anchor === side).sort((a, b) => d3.ascending(a.ly, b.ly));
    for (let i = 1; i < group.length; i++) {
      const minGap = 15 / ky;
      if (Math.abs(group[i].lx - group[i - 1].lx) * kx < 90 && group[i].ly - group[i - 1].ly < minGap) group[i].ly = group[i - 1].ly + minGap;
    }
  }
  const tipText = (r) => `${r.name}, ${r.province}\nAsking\t${eur(r.median_price)}\nRecorded\t${eur(r.official_median_price)}\nGap\t${pct(r.gap, 1, true)}\nListings\t${num(r.n_sale)}`;
  const svg = Plot.plot({
    width, height, marginLeft, marginTop, marginBottom, marginRight: mr, style: STYLE,
    x: {domain, label: null, axis: null},
    y: {domain, label: null, axis: null},
    marks: [
      Plot.gridX({stroke: GRID, strokeWidth: 1, ticks}),
      ...valueAxisY("MEDIAN ASKING PRICE", {tickFormat: eurK, ticks}),
      Plot.frame({anchor: "bottom", stroke: INK_3}),
      Plot.axisX({ticks, tickSize: 4, tickPadding: 6, label: null, tickFormat: eurK, fill: INK_2}),
      Plot.text(["RECORDED SALE PRICE"], {frameAnchor: "bottom-right", dx: 0, dy: -8, text: (d) => d, fill: INK_3, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em", textAnchor: "end", lineAnchor: "bottom"}),
      Plot.line([[0, 0], [hi, hi]], {stroke: INK_3, strokeWidth: 1, strokeDasharray: "3 3"}),
      Plot.text([[hi * 0.86, hi * 0.86]], {text: () => "asking equals recorded", rotate: -45, dy: -9, fill: INK_3, fontSize: 12, textAnchor: "middle"}),
      Plot.dot(scatterOrdered, {x: "official_median_price", y: "median_price", r: 4, fill: (d) => REGION_COLOR[d.region], fillOpacity: 0.8, stroke: PAGE, strokeWidth: 0.6}),
      Plot.link(labels, {x1: "official_median_price", y1: "median_price", x2: "lx", y2: "ly", stroke: INK_2, strokeWidth: 0.75}),
      Plot.text(labels.filter((l) => l.anchor === "end"), {x: "lx", y: "ly", text: "label", textAnchor: "end", dx: -3, fill: INK_1, fontSize: 12, fontWeight: 500, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"}),
      Plot.text(labels.filter((l) => l.anchor === "start"), {x: "lx", y: "ly", text: "label", textAnchor: "start", dx: 3, fill: INK_1, fontSize: 12, fontWeight: 500, stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"}),
      Plot.tip(scatter, Plot.pointer({x: "official_median_price", y: "median_price", title: tipText, maxRadius: 24}))
    ]
  });
  return svg;
}
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", "Median asking price against median recorded sale price, by commune")}
${headline(h31)}
<div class="fig-pair">
<div class="chart-7 geo-scatter">

```js
display(resize((width) => scatterFigure(width)));
```

</div>
<div class="text-5">
<p>Each dot is a commune with at least ${num(SCATTER_FLOOR)} sale listings and a recorded price, ${num(scatter.length)} in all. The recorded price is the median of what homes in the commune sold for in the first half of 2025, across every type of property Statbel counts; the asking price is the median of what sellers currently ask, and the two are weighted differently by type and size. A commune where flats sell and houses are advertised will sit above the diagonal without a single seller asking too much.</p>
<p>Read the chart for the relative divergence between communes, not for an absolute premium. ${sentence(`${pctWord(100 * aboveShare, 0)} of the communes drawn sit above the diagonal`)}; the ${WORDS[labelled.length]} communes farthest from the diagonal in euros are named, and ${labelledNote}, where the recorded median is carried by houses and the listings are mostly flats.</p>
${sidenote("Read with care", html`The recorded series is a different period and a different population from the listings. Statbel's figure is the first half of 2025 and covers completed transactions of every type; the asking figure is the current stock of listings. The gap is an indication of how far advertised prices sit from settled ones in that commune, not a measure of overpricing, and a small commune can move a long way on a handful of sales.`)}
</div>
</div>
${caption("Recorded sale price along the bottom, asking price up the side, both in euros on the same scale, so the dashed diagonal is where asking equals recorded. Dots above it are communes where sellers ask more than the last recorded median; below it, less. Flanders in brick, Wallonia in Soignies bluestone, Brussels in Grand Place gilt. Hover a dot for the commune's figures.")}
${source(`Source: ${PANEL}; communes with at least ${num(SCATTER_FLOOR)} sale listings. Recorded sale prices: Statbel, first half of 2025, median of all property types.`)}
</figure>

<div class="footnotes">
<p>${communes.note}</p>
<p>The recorded price is Statbel's median sale price per commune for the first half of 2025, all property types together; the gap in Figures 1.1, 2.1 and 3.1 is the current median asking price against that figure, as a percentage of it. Communes without a recorded price are hatched on the map and print a middle dot in the table.</p>
</div>
</section>
