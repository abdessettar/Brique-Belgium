<p class="kicker">Energy performance certificates · sale listings</p>

# Energy

```js
import {PAGE, INK_1, INK_2, INK_3, BRICK_7, REGIONS, CLASSES, EPC_BANDS, EPC_COLOR, inkOn} from "./components/palette.js";
import {eur, eurM2, eurM2Short, num, pct, pctWord, fixed, plural, range, times, monthName, monthDate, addMonths, monthsBetween, window as monthWindow} from "./components/sentences.js";
import {STYLE, h, marginRight, MARGINS, hatch, gapMarks, timeAxisX, bandAxisX, valueAxisY, pointerRule, monthTip} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote, legend} from "./components/figure.js";
```

```js
const epc = FileAttachment("data/epc.json").json();
const trends = FileAttachment("data/trends.json").json();
```

```js
const GAP_MONTHS = trends.dead_months;
const MIX_FIRST = d3.min(epc.mix, (d) => d.month);
const MIX_LAST = d3.max(epc.mix, (d) => d.month);
const MIX_MONTHS = monthsBetween(MIX_FIRST, MIX_LAST);
const X_DOMAIN = [monthDate(MIX_FIRST), monthDate(addMonths(MIX_LAST, 1))];
const SOURCE_WINDOW = monthWindow([MIX_FIRST, MIX_LAST]);
const certifiedAll = d3.sum(epc.mix, (d) => d.n);
const uncertifiedShare = d3.sum(epc.mix.filter((d) => d.epc === "Unknown"), (d) => d.n) / certifiedAll;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const few = (n) => WORDS[n] ?? num(n);
```

<div class="row top"><div class="main"><p class="lede">Belgium's energy performance certificate runs from A++, the tightest envelope, to G, the leakiest. It is a commercial fact as much as an environmental one: Flanders obliges the buyer of an E or F rated home to bring it up to D within five years of purchase. The figures on this page are asking prices of sale listings that carry a certificate, ${pctWord(100 - 100 * uncertifiedShare, 0)} of the listings observed.</p></div>${standingNote()}</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">Premium</p>

## The green premium

<p class="lede">A raw comparison of asking prices across bands would mostly restate geography and building age, because the well rated stock is newer and sits in dearer places. The premium below is measured inside cells that hold those two things fixed.</p>

```js
const premium = epc.premium.filter((p) => EPC_BANDS.includes(p.band));
const byBand = new Map(premium.map((p) => [p.band, p]));
const topBand = byBand.get("A++"), bottomBand = byBand.get("G");
const h11 = `An ${topBand.band} home asks ${pctWord(Math.abs(topBand.premium_vs_D_pct), 0)} ${topBand.premium_vs_D_pct >= 0 ? "more" : "less"} per m² than a D rated one in the same region, class and era; a ${bottomBand.band} home asks ${pctWord(Math.abs(bottomBand.premium_vs_D_pct), 0)} ${bottomBand.premium_vs_D_pct >= 0 ? "more" : "less"}.`;
const spreadPts = topBand.premium_vs_D_pct - bottomBand.premium_vs_D_pct;
const monotone = premium.every((p, i) => i === 0 || p.premium_vs_D_pct <= premium[i - 1].premium_vs_D_pct);
// The rungs of the ladder: what each step down the certificate costs, in points of price per m².
const steps = premium.slice(1).map((p, i) => ({from: premium[i].band, to: p.band, pts: premium[i].premium_vs_D_pct - p.premium_vs_D_pct}));
const widest = d3.greatest(steps, (s) => s.pts);
const close = steps.filter((s) => s !== widest && s.pts < 3);
const rest = steps.filter((s) => s !== widest && !close.includes(s));
const pointsWord = (v) => (Math.abs(v - 0.5) < 0.05 ? "half a point" : v < 0.95 ? `${fixed(v, 1)} of a point` : plural(v, "point"));
const closeText = close.length
  ? close.map((s, i) => (i === 0 ? `${s.from} and ${s.to} are ${pointsWord(s.pts)} apart` : `${s.from} and ${s.to} ${pointsWord(s.pts)}`)).join(" and ") + `, ${close.length === 1 ? "a pair" : "pairs"} the market barely tells apart`
  : "";
const restText = rest.length
  ? `the other ${rest.length === 1 ? "step costs" : `${few(rest.length)} steps cost`} ${num(d3.min(rest, (s) => s.pts))} to ${num(d3.max(rest, (s) => s.pts))} points each`
  : "";
const stepsText = [`the widest is from ${widest.from} to ${widest.to}, ${pointsWord(widest.pts)}`, closeText, restText].filter(Boolean).join("; ");
```

<figure class="fig" id="fig-1-1">
${kicker("1.1", "Asking price per m² against D rated stock, by band")}
${headline(h11)}
<div class="fig-pair">
<div class="text-5-first">
<p>Each band is compared with D rated stock of the same region, property class and construction era, so a 2010 or later A rated apartment in Brussels is set against a 2010 or later D rated apartment in Brussels, not against the country. The cell premiums are then weighted by their sample into one figure per band.</p>
<p>The ladder is ${monotone ? "monotone" : "nearly monotone"}: ${monotone ? "every step down the certificate costs asking price, with no inversion" : "almost every step down the certificate costs asking price"}. Between the best and worst bands lie ${num(spreadPts)} percentage points of price per square metre. The steps are not even: ${stepsText}.</p>
${sidenote("Method", html`Cells with fewer than 25 listings are dropped before weighting. A premium is a difference in what sellers ask, not a measured renovation return.`)}
</div>
<div class="chart-7-last">

```js
display(resize((width) => {
  const step = 32, barH = 18, marginTop = 12, marginBottom = 12, marginLeft = 40, mr = 8;
  const height = EPC_BANDS.length * step + marginTop + marginBottom;
  const vals = premium.map((d) => d.premium_vs_D_pct);
  const lo = Math.min(0, d3.min(vals)), hi = Math.max(0, d3.max(vals));
  const plotW = width - marginLeft - mr;
  const k = (hi - lo) / Math.max(1, plotW - 80); // data units per pixel once 40px is reserved beyond each end
  const domain = [lo - 40 * k, hi + 40 * k];
  const refLen = 12 * k;
  const ref = premium.filter((d) => d.band === "D");
  const bars = premium.filter((d) => d.band !== "D");
  const label = (d) => pct(d.premium_vs_D_pct, 0, true);
  return Plot.plot({
    width, height, marginTop, marginBottom, marginLeft, marginRight: mr, style: STYLE,
    x: {domain, label: null, axis: null},
    y: {domain: EPC_BANDS, label: null, axis: null, padding: 1 - barH / step},
    marks: [
      Plot.axisY({tickSize: 0, tickPadding: 10, label: null, fontSize: 12.5, fontWeight: 600, fill: INK_1}),
      Plot.barX(bars, {x: "premium_vs_D_pct", y: "band", fill: (d) => EPC_COLOR[d.band]}),
      Plot.barX(ref, {x1: 0, x2: refLen, y: "band", fill: "none", stroke: INK_1, strokeWidth: 1.25}),
      Plot.ruleX([0], {stroke: INK_2, strokeWidth: 1}),
      Plot.text(bars.filter((d) => d.premium_vs_D_pct >= 0), {x: "premium_vs_D_pct", y: "band", text: label, dx: 6, textAnchor: "start", fill: INK_1, fontSize: 12, fontVariant: "tabular-nums"}),
      Plot.text(bars.filter((d) => d.premium_vs_D_pct < 0), {x: "premium_vs_D_pct", y: "band", text: label, dx: -6, textAnchor: "end", fill: INK_1, fontSize: 12, fontVariant: "tabular-nums"}),
      Plot.text(ref, {x: refLen, y: "band", text: () => "reference", dx: 6, textAnchor: "start", fill: INK_3, fontSize: 12}),
      Plot.tip(premium, Plot.pointer({x: "premium_vs_D_pct", y: "band", title: (d) => `${d.band}\n${d.band === "D" ? "reference" : pct(d.premium_vs_D_pct, 1, true) + " against D"}\n${plural(d.n, "listing")}`}))
    ]
  });
}));
```

</div>
</div>
${caption("Read each bar from the zero line: to the right, the band asks more per square metre than D rated stock of the same region, class and era; to the left, less. The colours are thermal: bluestone for the insulated bands A++ to C, mortar for D, brick for E to G. D is drawn hollow because it is the reference, not a finding. Bar labels are rounded to the point; the text gives the steps to the half point.")}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Within-cell premiums against D, sample weighted across ${num(d3.sum(premium, (d) => d.n))} certified listings.`)}
</figure>
</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">Mix</p>

## How the stock is rated

<p class="lede">The certificate mix of what is offered for sale moves with what gets built and what gets renovated. The bands here are shares of certified listings only, so they sum to 100 percent in every month.</p>

```js
const STACK = [...EPC_BANDS].reverse(); // G at the foot of the stack, A++ at the top
const mixRows = epc.mix.filter((d) => d.region === mixRegion && d.epc !== "Unknown" && !GAP_MONTHS.includes(d.month));
const mixTotal = d3.rollup(mixRows, (v) => d3.sum(v, (d) => d.n), (d) => d.month);
const mixCount = d3.rollup(mixRows, (v) => d3.sum(v, (d) => d.n), (d) => d.month, (d) => d.epc);
const stacked = [];
for (const m of MIX_MONTHS) {
  const total = mixTotal.get(m);
  let y0 = 0;
  for (const b of STACK) {
    if (!total) { stacked.push({month: m, date: monthDate(m), epc: b, n: null, share: null, y1: null, y2: null}); continue; }
    const n = mixCount.get(m)?.get(b) ?? 0;
    const share = (100 * n) / total;
    stacked.push({month: m, date: monthDate(m), epc: b, n, share, y1: y0, y2: y0 + share});
    y0 += share;
  }
}
const observedMonths = MIX_MONTHS.filter((m) => mixTotal.get(m));
const mixFirstMonth = observedMonths[0], mixLastMonth = observedMonths.at(-1);
const aOrBetter = (m) => d3.sum(stacked.filter((d) => d.month === m && ["A++", "A+", "A"].includes(d.epc)), (d) => d.share);
const aNow = aOrBetter(mixLastMonth), aThen = aOrBetter(mixFirstMonth);
const aMove = aNow - aThen > 0.5 ? "up from" : aThen - aNow > 0.5 ? "down from" : "unchanged from";
const h21 = `In ${mixRegion} ${pctWord(aNow, 0)} of certified listings are rated A or better, ${aMove} ${pctWord(aThen, 0)} in ${monthName(mixFirstMonth)}.`;
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", `Share of certified sale listings by band, ${mixRegion}`)}
${headline(h21)}
<div class="fig-controls">

```js
const mixRegion = view(Inputs.radio(REGIONS, {label: "Region", value: "Flanders"}));
```

</div>
${legend(EPC_BANDS.map((b) => [b, EPC_COLOR[b]]))}
<div class="fig-chart">

```js
display(resize((width) => {
  const id = "nodata-fig-2-1";
  const height = h(width);
  const marginLeft = 38; // the stack fills the frame, so the percent ticks sit outside it
  const plotH = height - MARGINS.marginTop - MARGINS.marginBottom;
  const last = stacked.filter((d) => d.month === mixLastMonth && d.share != null);
  const lettered = last.filter((d) => ((d.y2 - d.y1) * plotH) / 100 >= 14);
  const svg = Plot.plot({
    width, height, ...MARGINS, marginLeft, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain: [0, 100], label: null, axis: null},
    marks: [
      ...valueAxisY("SHARE OF CERTIFIED LISTINGS", {grid: false, ticks: []}),
      ...gapMarks(GAP_MONTHS, id),
      Plot.areaY(stacked, {x: "date", y1: "y1", y2: "y2", z: "epc", fill: (d) => EPC_COLOR[d.epc], stroke: PAGE, strokeWidth: 0.75, curve: "linear"}),
      Plot.axisY({anchor: "left", tickSize: 0, tickPadding: 6, textAnchor: "end", label: null, ticks: [0, 25, 50, 75, 100], tickFormat: (d) => pct(d, 0), fill: INK_2}),
      Plot.text(lettered, {
        x: "date", y: (d) => (d.y1 + d.y2) / 2, text: "epc", dx: -8, textAnchor: "end",
        fill: (d) => inkOn(EPC_COLOR[d.epc]), stroke: (d) => EPC_COLOR[d.epc], strokeWidth: 2, paintOrder: "stroke",
        fontSize: 12, fontWeight: 600
      }),
      pointerRule(stacked.filter((d) => d.epc === "A++" && d.share != null)),
      monthTip(stacked.filter((d) => d.share != null), {y: "y2", series: "epc", order: EPC_BANDS, format: (v, r) => pct(r.share, 1), title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  return svg;
}));
```

</div>
${caption(`Each band's thickness is its share of the certified listings offered for sale in ${mixRegion} that month, stacked from G at the foot to A++ at the top: bluestone for the insulated bands A++ to C, mortar for D, brick for E to G. The letter is printed inside a band where it is thick enough; read the thin ones from the legend, in the same order. Hatched months have no data.`)}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Shares are of listings with a known band; listings without a certificate are excluded. Hatched months have no data.`)}
</figure>
</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">Era and band</p>

## By era

<p class="lede">The same certificate means different things on different buildings. A pre-war house rated A has been rebuilt from the inside; a 2010 or later house rated A was born that way. The matrix prices every combination of construction era and band that has enough listings to stand on.</p>

```js
const ERAS = ["Pre-1945", "1945-1969", "1970-1989", "1990-2009", "2010+", "Unknown"];
const ERA_LABEL = {"Pre-1945": "Pre-1945", "1945-1969": "1945 to 1969", "1970-1989": "1970 to 1989", "1990-2009": "1990 to 2009", "2010+": "2010 or later", "Unknown": "Era unknown"};
const ERA_PROSE = {"Pre-1945": "pre-1945", "1945-1969": "1945 to 1969", "1970-1989": "1970 to 1989", "1990-2009": "1990 to 2009", "2010+": "2010 or later", "Unknown": "unknown era"};
const cells = epc.cells.filter((d) => d.class === eraClass && d.region === eraRegion && EPC_BANDS.includes(d.epc));
const quantile = d3.scaleQuantile().domain(cells.map((d) => d.median_eur_m2)).range(BRICK_7);
const cellFill = (d) => quantile(d.median_eur_m2);
const classItems = BRICK_7.map((c) => {
  const vs = cells.filter((d) => cellFill(d) === c).map((d) => d.median_eur_m2);
  return vs.length ? [range(d3.min(vs), d3.max(vs), eur), c] : null;
}).filter(Boolean);
const present = new Set(cells.map((d) => d.era + "|" + d.epc));
const missing = ERAS.flatMap((era) => EPC_BANDS.filter((epc) => !present.has(era + "|" + epc)).map((epc) => ({era, epc})));
const HEADLINE_FLOOR = 500;
const solid = (d) => d.era !== "Unknown" && d.n >= HEADLINE_FLOOR;
const eligible = cells.filter(solid);
const dearest = d3.greatest(eligible, (d) => d.median_eur_m2), cheapest = d3.least(eligible, (d) => d.median_eur_m2);
const noun = eraClass === "House" ? "house" : "apartment";
const h31 = dearest && cheapest && dearest !== cheapest
  ? `A ${ERA_PROSE[dearest.era]} ${dearest.epc} rated ${noun} in ${eraRegion} asks ${eurM2(dearest.median_eur_m2)}, ${times(dearest.median_eur_m2 / cheapest.median_eur_m2)} a ${ERA_PROSE[cheapest.era]} ${cheapest.epc} rated one.`
  : `Too few ${noun} listings in ${eraRegion} carry both a certificate and a construction era to compare eras.`;
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", `Median asking price per m² by construction era and band, ${eraClass === "House" ? "houses" : "apartments"} in ${eraRegion}`)}
${headline(h31)}
<div class="fig-controls">

```js
const eraClass = view(Inputs.radio(CLASSES, {label: "Type", value: "House"}));
```

```js
const eraRegion = view(Inputs.radio(REGIONS, {label: "Region", value: "Flanders"}));
```

</div>
<div class="fig-chart">

```js
display(resize((width) => {
  const id = "nodata-fig-3-1";
  const marginLeft = width > 480 ? 100 : 88, mr = 8, marginTop = 8, marginBottom = 30;
  const cellW = (width - marginLeft - mr) / EPC_BANDS.length - 2;
  const kShort = (v) => `${(v / 1000).toFixed(1)}k`; // 2.8k, for cells too narrow to carry the euro figure
  const valueText = (d) => (cellW >= 46 ? eur(d.median_eur_m2) : cellW >= 40 ? num(d.median_eur_m2) : cellW >= 24 ? kShort(d.median_eur_m2) : "");
  const svg = Plot.plot({
    width, height: h(width), marginLeft, marginRight: mr, marginTop, marginBottom, style: STYLE,
    x: {domain: EPC_BANDS, label: null, axis: null, padding: 0},
    y: {domain: ERAS, label: null, axis: null, padding: 0},
    marks: [
      Plot.axisY({tickSize: 0, tickPadding: 10, label: null, fill: INK_2, tickFormat: (e) => ERA_LABEL[e]}),
      ...bandAxisX({fontSize: 12.5, fontWeight: 600, fill: INK_1}),
      Plot.cell(missing, {x: "epc", y: "era", fill: `url(#${id})`, inset: 1}),
      Plot.cell(cells, {x: "epc", y: "era", fill: cellFill, inset: 1}),
      // Values from cells under the headline floor are printed in muted ink so the reader can see which cells the headline may draw on.
      Plot.text(cells, {x: "epc", y: "era", text: valueText, fill: (d) => inkOn(cellFill(d)), fillOpacity: (d) => (solid(d) ? 1 : 0.55), fontSize: 11.5, fontVariant: "tabular-nums"}),
      Plot.tip(cells, Plot.pointer({x: "epc", y: "era", title: (d) => `${ERA_LABEL[d.era]} · ${d.epc}\n${eurM2Short(d.median_eur_m2)}\n${plural(d.n, "listing")}`}))
    ]
  });
  hatch(svg, id);
  return svg;
}));
```

</div>
${legend(classItems)}
${caption(`Rows are construction eras, columns are certificate bands. Each cell is the median asking price per square metre of ${eraClass === "House" ? "houses" : "apartments"} in ${eraRegion} with that era and band, in brick from light for the cheapest seventh of cells to dark for the dearest; the seven classes and their ranges are printed under the matrix in euros per square metre. Hatched cells have fewer than 25 listings and are not priced. The headline compares only cells with a known era and at least ${num(HEADLINE_FLOOR)} listings; the values of thinner cells are printed in muted ink, and a thin cell cannot set the record. On narrow screens the figures are in thousands, so 2.8k is €2,800; the exact figure and the listing count appear on hover or touch.`)}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Medians of ${num(d3.sum(cells, (d) => d.n))} certified ${eraClass === "House" ? "house" : "apartment"} listings in ${eraRegion} with a known band.`)}
</figure>

<div class="footnotes">
<p>The premium in Figure 1.1 is measured against D rated stock of the same region, property class and construction era, then weighted by sample across those cells. That strips out the geography and building age that a raw comparison of certificate against price would mistake for an energy effect. Cells with fewer than 25 listings are dropped before weighting and are hatched in Figure 3.1.</p>
<p>Listings without a certificate, ${pctWord(100 * uncertifiedShare, 0)} of those observed, appear in no figure on this page.</p>
</div>
</section>
