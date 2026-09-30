<style>
/* Page-specific: two sidenotes share the aside column beside the standfirst. */
.supply-aside { grid-column: 10 / span 3; min-width: 0; }
.supply-multiple { row-gap: 28px; }
@media (max-width: 1023.98px) {
  .supply-aside { grid-column: 1 / -1; }
}
</style>

<p class="kicker">New listings · by month of first publication</p>

# Supply

```js
const trends = FileAttachment("data/trends.json").json();
const supply = FileAttachment("data/supply.json").json();
const coverage = FileAttachment("data/coverage.json").json();
```

```js
import {INK_1, INK_2, INK_3, PAGE, REGIONS, REGION_COLOR, REGION_TEXT} from "./components/palette.js";
import {num, pct, pctWord, moreLess, share, plural, monthName, monthShort, monthDate, addMonths, monthsBetween} from "./components/sentences.js";
import {STYLE, marginRight, MARGINS, hatch, monthBands, gapMarks, timeAxisX, valueAxisY, finishAxes, refLineY, pointerRule, endDots, withGaps, dated, monthTip} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote} from "./components/figure.js";
```

<div class="row top"><div class="main"><p class="lede">How much new stock reaches the market each month, where it comes from and what kind of property it is. Every listing is counted once, in the month it was first published, so the lines show when property came to market rather than when it was last seen.</p></div><div class="supply-aside">${standingNote()}${sidenote("Counts", "Counts reflect months with usable data; shares do not depend on how much was observed.")}</div></div>

```js
// Shared time frame: every time figure on this page spans January 2023 to the month after the
// last month in the data, so the hatched band sits at the same x on every panel.
const GAP_MONTHS = trends.dead_months;
const ALL_MONTHS = [...new Set(trends.sale.map((d) => d.month))].sort();
const FIRST = ALL_MONTHS[0];
const LAST = ALL_MONTHS.at(-1);
const MONTHS = monthsBetween(FIRST, LAST);
const X_DOMAIN = [monthDate(FIRST), monthDate(addMonths(LAST, 1))];
const SOURCE_WINDOW = `${monthName(FIRST)} to ${monthName(LAST)}`;

// The month still in progress: the last month, when it was observed on fewer days than a full
// month. Counts leave it out; shares keep it, since a share does not depend on how much was seen.
const inProgress = (() => {
  const m = coverage.months.at(-1);
  return m && m.quality !== "good" ? m.month : null;
})();

const FW = ["Flanders", "Wallonia"];
const REGION_ADJ = {Flanders: "Flemish", Wallonia: "Walloon", Brussels: "Brussels"};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pctTick = (d) => pct(d * 100, 0);
// A share under one percent reads as "almost none" rather than "0 percent" or "1 percent".
const shareWord = (v) => (v * 100 < 1 ? "almost none" : share(v));

// Panel heights: the four-up volume panels are shallower than the share panels.
const hv = (width) => (width > 480 ? 260 : 220);
const hs = (width) => (width > 480 ? 320 : 260);

// Every y scale keeps headroom above its top tick, so the unit written at the top left never
// touches a tick label. Ticks stop at the nice maximum; the domain runs a little past it.
function yScale(max, {count = 4, headroom = 1.18} = {}) {
  const top = d3.nice(0, max, count)[1] || 1;
  return {top, domain: [0, top * headroom], ticks: d3.ticks(0, top, count)};
}


// A list of months in prose: runs of consecutive months become "May 2024 to July 2024".
function monthList(months) {
  const parts = monthBands(months).map((b) => (b.months > 1 ? `${monthName(b.from)} to ${monthName(b.to)}` : monthName(b.from)));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
}
```

```js
// One month is usable for a count when every region in the panel clears the sample floor;
// otherwise the month dips because a region fell below the floor, not because supply fell.
function monthlyTotals(src, cls, regions) {
  const rows = trends[src].filter((d) => d.class === cls && !d.low_confidence && regions.includes(d.region));
  const byMonth = d3.rollup(rows, (v) => ({n: d3.sum(v, (d) => d.n), regions: new Set(v.map((d) => d.region)).size}), (d) => d.month);
  return Array.from(byMonth, ([month, o]) => ({month, n: o.n, regions: o.regions}))
    .filter((d) => d.regions === regions.length && d.month !== inProgress)
    .sort((a, b) => a.month.localeCompare(b.month));
}

// The latest month that has a usable month twelve months earlier to compare with.
function latestPair(rows) {
  const by = new Map(rows.map((d) => [d.month, d.n]));
  for (let i = rows.length - 1; i >= 0; i--) {
    const m = rows[i].month;
    const p = addMonths(m, -12);
    if (by.has(p)) return {month: m, n: by.get(m), prior: p, priorN: by.get(p), change: (by.get(m) / by.get(p) - 1) * 100, isLatest: i === rows.length - 1};
  }
  return null;
}

// "fewer" for things that are counted.
const fewer = (v) => moreLess(v).replace("less than", "fewer than");

const PANELS = [
  {id: "a", label: "Houses for sale", src: "sale", cls: "House", regions: REGIONS},
  {id: "b", label: "Apartments for sale", src: "sale", cls: "Apartment", regions: REGIONS},
  {id: "c", label: "Houses to rent", src: "rent", cls: "House", regions: FW, note: "Flanders and Wallonia"},
  {id: "d", label: "Apartments to rent", src: "rent", cls: "Apartment", regions: REGIONS}
].map((p) => {
  const rows = dated(monthlyTotals(p.src, p.cls, p.regions)).map((r) => ({...r, series: p.label}));
  const peak = d3.greatest(rows, (d) => d.n);
  return {
    ...p, rows, peak,
    gapped: withGaps(rows, {y: "n", allMonths: MONTHS}),
    last: rows.at(-1),
    pair: latestPair(rows)
  };
});
```

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">Volume</p>

## New listings each month

<p class="lede">Four counts, one for each market: houses and apartments, for sale and to rent. A month is drawn only when every region in the panel clears the sample floor, and the month still in progress is left out until it is complete.</p>

```js
// "42 percent fewer than August 2025"; the comparison is a year-earlier pair of usable months.
const vs = (p) => `${fewer(p.change)} ${monthName(p.prior)}`;
const tail = (p) => fewer(p.change).replace(/ than$| as$/, "");

const h11 = (() => {
  const [sh, sa] = PANELS.map((p) => p.pair);
  if (!sh || !sa) return `${monthName(PANELS[0].last?.month)} is the latest month with usable counts; no year-earlier month is observed to compare it with.`;
  // When both sale counts move the same way the month is said once: "42 and 41 percent fewer than August 2025".
  const sameWay = sh.month === sa.month && Math.sign(sh.change) === Math.sign(sa.change) && Math.abs(sh.change) >= 0.5 && Math.abs(sa.change) >= 0.5;
  const sale = sh.month === sa.month
    ? `${monthName(sh.month)} brought ${plural(sh.n, "house")} and ${plural(sa.n, "apartment")} to market for sale, ${sameWay ? `${num(Math.abs(sh.change))} and ${vs(sa)}` : `${tail(sh)} and ${vs(sa)}`}.`
    : `${monthName(sh.month)} brought ${plural(sh.n, "house")} to market for sale, ${vs(sh)}; ${monthName(sa.month)} brought ${plural(sa.n, "apartment")}, ${vs(sa)}.`;
  const late = [sh, sa].some((p) => !p.isLatest) ? " The latest month has no observed year-earlier month, so the comparison uses the latest pair." : "";
  return sale + late;
})();

// The rental comparison, named by month, for the caption.
const rentals = (() => {
  const [, , rh, ra] = PANELS.map((p) => p.pair);
  if (!rh || !ra) return "";
  return rh.month === ra.month
    ? `In ${monthName(rh.month)} houses to rent ran ${vs(rh)}, apartments to rent ${tail(ra)}.`
    : `Houses to rent in ${monthName(rh.month)} ran ${vs(rh)}; apartments to rent in ${monthName(ra.month)} ${vs(ra)}.`;
})();

// Months in which Brussels houses to rent clear the sample floor, for the footnote.
const bruRentHouse = trends.rent.filter((d) => d.region === "Brussels" && d.class === "House" && !d.low_confidence).length;
```

<figure class="fig" id="fig-1-1">
${kicker("1.1", "New listings by month, four markets")}
${headline(h11)}

```js
function volumePanel(p, width) {
  const id = `nodata-fig-1-1-${p.id}`;
  const height = hv(width);
  const y = yScale(p.peak.n);
  const plotH = height - MARGINS.marginTop - MARGINS.marginBottom;
  // The peak is named above its point with a short vertical leader; a peak at the left edge gets
  // a diagonal leader to the upper right so the label clears the tick labels.
  const f = (+p.peak.date - +X_DOMAIN[0]) / (+X_DOMAIN[1] - +X_DOMAIN[0]);
  const atLeft = f < 0.12;
  const peakText = (d) => `${num(d.n)} in ${monthShort(d.month)}`;
  const lead = {x1: p.peak.date, y1: p.peak.n, x2: atLeft ? monthDate(addMonths(p.peak.month, 4)) : p.peak.date, y2: p.peak.n + 14 * (y.domain[1] / plotH)};
  const svg = Plot.plot({
    width, height, ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain: y.domain, label: null, axis: null},
    marks: [
      ...valueAxisY("NEW LISTINGS", {ticks: y.ticks, tickFormat: num}),
      ...gapMarks(GAP_MONTHS, id, {labelled: p.id === "a"}),
      Plot.line(p.gapped, {x: "date", y: "n", stroke: INK_1, strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      Plot.link([lead], {x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: INK_2, strokeWidth: 0.75}),
      Plot.text([p.peak], {x: () => lead.x2, y: () => lead.y2, dx: atLeft ? 4 : 0, dy: atLeft ? 4 : -7, text: peakText, fill: INK_1, fontSize: 12, textAnchor: atLeft ? "start" : f > 0.88 ? "end" : "middle", stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"}),
      endDots([p.last], {y: "n", fill: INK_1}),
      pointerRule(p.rows),
      monthTip(p.rows, {y: "n", series: "series", format: (v) => num(v), title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  finishAxes(svg);
  return svg;
}
```

<div class="fig-pair supply-multiple">
<div class="half"><p class="panel-title">${PANELS[0].label}</p><div class="fig-chart">

```js
display(resize((width) => volumePanel(PANELS[0], width)));
```

</div></div>
<div class="half"><p class="panel-title">${PANELS[1].label}</p><div class="fig-chart">

```js
display(resize((width) => volumePanel(PANELS[1], width)));
```

</div></div>
<div class="half"><p class="panel-title">${PANELS[2].label} · ${PANELS[2].note}</p><div class="fig-chart">

```js
display(resize((width) => volumePanel(PANELS[2], width)));
```

</div></div>
<div class="half"><p class="panel-title">${PANELS[3].label}</p><div class="fig-chart">

```js
display(resize((width) => volumePanel(PANELS[3], width)));
```

</div></div>
</div>

${caption(`${rentals} Each panel counts the listings first published in a month, in ink, with its own scale; the busiest month is named. Lines run only through months with usable data in every region the panel covers, so they break where a region fell below the sample floor as well as across the hatched months. Houses to rent are counted for Flanders and Wallonia. ${inProgress ? monthName(inProgress) + " is still in progress and is not yet counted." : ""} Hatched months have no data.`)}
${source(`Source: listings, ${SOURCE_WINDOW}. Counts by month of first publication, months with a usable sample. Hatched months have no data.`)}
</figure>

<div class="footnotes">
<p>Brussels houses to rent clear the sample floor in ${bruRentHouse} of ${ALL_MONTHS.length} months, so that panel counts Flanders and Wallonia; the other three panels count all three regions.</p>
</div>
</section>

```js
// Regional shares are recomputed from summed counts, never averaged, so a large region cannot be
// outweighed by a small one; a month needs all three regions, else it is left as a gap.
function regionMix(cls) {
  const rows = trends.sale.filter((d) => d.class === cls && !d.low_confidence);
  const byMonth = d3.rollup(rows, (v) => new Map(v.map((d) => [d.region, d.n])), (d) => d.month);
  const out = [];
  for (const m of MONTHS) {
    const r = byMonth.get(m);
    const ok = !!r && REGIONS.every((g) => r.has(g));
    const total = ok ? d3.sum(REGIONS, (g) => r.get(g)) : 0;
    let y0 = 0;
    for (const g of REGIONS) {
      const s = ok ? r.get(g) / total : null;
      out.push({month: m, date: monthDate(m), region: g, share: s, n: ok ? r.get(g) : null, y1: ok ? y0 : null, y2: ok ? y0 + s : null, ok});
      if (ok) y0 += s;
    }
  }
  return out;
}
const MIX = {House: regionMix("House"), Apartment: regionMix("Apartment")};
const mixLastMonth = (cls) => MIX[cls].filter((d) => d.ok).at(-1).month;
// Months the houses panel leaves out beyond the hatched band and the month in progress.
const houseBreaks = [...new Set(MIX.House.filter((d) => !d.ok && !GAP_MONTHS.includes(d.month) && d.month !== inProgress).map((d) => d.month))];
```

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">Regional mix</p>

## Where it comes from

<p class="lede">The share of each month's new listings for sale that comes from each region. Shares are summed from counts and do not depend on how many listings were observed, which makes them the steadier read of the two.</p>

```js
const h21 = (() => {
  // Each class is read at its own last good month, the month its band, end and names run to.
  const at = (cls, g) => MIX[cls].find((d) => d.month === mixLastMonth(cls) && d.region === g)?.share;
  return `Flanders supplies ${pctWord(at("House", "Flanders") * 100, 0)} of new houses and ${pctWord(at("Apartment", "Flanders") * 100, 0)} of new apartments; Brussels ${pctWord(at("House", "Brussels") * 100, 0)} and ${pctWord(at("Apartment", "Brussels") * 100, 0)}.`;
})();
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", "Regional share of new listings for sale")}
${headline(h21)}

```js
function mixPanel(cls, width) {
  const id = `nodata-fig-2-1-${cls.toLowerCase()}`;
  const rows = MIX[cls];
  const height = hs(width);
  const plotH = height - MARGINS.marginTop - MARGINS.marginBottom;
  const lastM = mixLastMonth(cls);
  const y = yScale(1, {count: 2, headroom: 1.12});
  // A band carries its name only where it is at least 14px thick and the last run of observed
  // months is wide enough to hold the word; otherwise the caption names it.
  const okMonths = new Set(rows.filter((d) => d.ok).map((d) => d.month));
  let run = 0;
  for (let m = lastM; okMonths.has(m); m = addMonths(m, -1)) run++;
  const pxPerMonth = (width - MARGINS.marginLeft - marginRight(width)) / MONTHS.length;
  const ends = run * pxPerMonth < 64 ? [] : rows.filter((d) => d.month === lastM && (d.y2 - d.y1) / y.domain[1] * plotH >= 14);
  const svg = Plot.plot({
    width, height, ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain: y.domain, label: null, axis: null},
    marks: [
      ...valueAxisY("SHARE OF NEW LISTINGS", {ticks: y.ticks, tickFormat: pctTick, grid: false}),
      ...gapMarks(GAP_MONTHS, id, {labelled: cls === "House"}),
      Plot.areaY(rows, {x: "date", y1: "y1", y2: "y2", z: "region", fill: (d) => REGION_COLOR[d.region], stroke: PAGE, strokeWidth: 0.75, curve: "linear"}),
      // The stack covers the whole plot, so only three tick labels are printed over it.
      Plot.text(ends, {x: "date", y: (d) => (d.y1 + d.y2) / 2, text: "region", textAnchor: "end", dx: -8, fill: PAGE, fontSize: 12, fontWeight: 600, stroke: (d) => REGION_COLOR[d.region], strokeWidth: 2, paintOrder: "stroke"}),
      pointerRule(rows.filter((d) => d.ok && d.region === "Flanders")),
      monthTip(rows.filter((d) => d.ok), {y: "y2", series: "region", order: [...REGIONS].reverse(), format: (v, r) => `${pct(r.share * 100, 0)} (${num(r.n)})`, title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  finishAxes(svg);
  return svg;
}
```

<div class="fig-pair">
<div class="half"><p class="panel-title">Houses</p><div class="fig-chart">

```js
display(resize((width) => mixPanel("House", width)));
```

</div></div>
<div class="half"><p class="panel-title">Apartments</p><div class="fig-chart">

```js
display(resize((width) => mixPanel("Apartment", width)));
```

</div></div>
</div>

${caption("Bands stack to 100 percent of the month's new listings for sale, in the same order in both panels: Flanders in brick at the bottom, Wallonia in bluestone in the middle, Brussels in gilt at the top. A band carries its name at its right end where there is room for it. Bands break where a region fell below the sample floor, which for houses is Brussels in several months, and across the hatched months. Hatched months have no data.")}
${source(`Source: listings, ${SOURCE_WINDOW}. Shares of counts by month of first publication, months with a usable sample in all three regions. Hatched months have no data.`)}
</figure>

<div class="footnotes">
<p>The houses panel has no month in ${monthList(houseBreaks)}: Brussels houses fell below the sample floor in those months, so the breaks mark thin observation, not a change in the market.</p>
</div>
</section>

```js
// Share of a month's new listings that are houses, over a fixed set of regions, both classes
// required to clear the floor so the share is always taken over the same ground.
function houseShare(src, regions) {
  const rows = trends[src].filter((d) => !d.low_confidence && regions.includes(d.region));
  const by = d3.rollup(rows, (v) => d3.rollup(v, (w) => new Set(w.map((d) => d.region)).size === regions.length ? d3.sum(w, (d) => d.n) : null, (d) => d.class), (d) => d.month);
  const out = [];
  for (const m of MONTHS) {
    const r = by.get(m);
    const house = r?.get("House") ?? null;
    const apt = r?.get("Apartment") ?? null;
    const ok = house != null && apt != null;
    out.push({month: m, date: monthDate(m), share: ok ? house / (house + apt) : null, house, apt, series: "Houses"});
  }
  return out;
}
const BALANCE = [
  {id: "sale", title: "For sale", rows: houseShare("sale", REGIONS), noun: "new listings for sale"},
  {id: "rent", title: "To rent · Flanders and Wallonia", rows: houseShare("rent", FW), noun: "new rental listings"}
].map((b) => ({...b, good: b.rows.filter((d) => d.share != null)}));
```

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">Balance</p>

## Houses against apartments

<p class="lede">What kind of property is offered: the share of each month's new listings that are houses rather than apartments, for sale and to rent. The balance moves with what gets built and with which owners choose to sell or let.</p>

```js
const h31 = `Houses make up ${pctWord(BALANCE[0].good.at(-1).share * 100, 0)} of ${BALANCE[0].noun} and ${pctWord(BALANCE[1].good.at(-1).share * 100, 0)} of ${BALANCE[1].noun}.`;
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", "Share of new listings that are houses")}
${headline(h31)}

```js
function balancePanel(b, width) {
  const id = `nodata-fig-3-1-${b.id}`;
  const y = yScale(1, {headroom: 1.12});
  const svg = Plot.plot({
    width, height: hs(width), ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain: y.domain, label: null, axis: null},
    marks: [
      ...valueAxisY("SHARE THAT ARE HOUSES", {ticks: y.ticks, tickFormat: pctTick}),
      ...gapMarks(GAP_MONTHS, id, {labelled: b.id === "sale"}),
      ...refLineY(0.5, null),
      Plot.text(["even split"], {x: () => monthDate(GAP_MONTHS[0]), y: () => 0.5, text: (d) => d, textAnchor: "end", dx: -6, dy: 14, fill: INK_3, fontSize: 12}),
      Plot.line(b.rows, {x: "date", y: "share", stroke: INK_1, strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      endDots([b.good.at(-1)], {y: "share", fill: INK_1}),
      pointerRule(b.good),
      monthTip(b.good, {y: "share", series: "series", format: (v, r) => `${pct(v * 100, 0)} (${num(r.house)} of ${num(r.house + r.apt)})`, title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  finishAxes(svg);
  return svg;
}
```

<div class="fig-pair">
<div class="half"><p class="panel-title">${BALANCE[0].title}</p><div class="fig-chart">

```js
display(resize((width) => balancePanel(BALANCE[0], width)));
```

</div></div>
<div class="half"><p class="panel-title">${BALANCE[1].title}</p><div class="fig-chart">

```js
display(resize((width) => balancePanel(BALANCE[1], width)));
```

</div></div>
</div>

${caption("One line in ink per panel: the share of the month's new listings that are houses. Above the dashed even split, houses outnumber apartments; below it, apartments do. The rental panel covers Flanders and Wallonia, where both classes clear the sample floor every month. Hatched months have no data.")}
${source(`Source: listings, ${SOURCE_WINDOW}. Shares of counts by month of first publication, months with a usable sample for both classes. Hatched months have no data.`)}
</figure>
</section>

```js
// One series per region from the supply rows, for a chosen class and a share function.
function regionSeries(cls, valueOf) {
  return REGIONS.map((g) => {
    const rows = dated(supply.rows.filter((d) => d.class === cls && d.region === g && !d.low_confidence && d.n > 0))
      .map((d) => ({...d, share: valueOf(d), series: g}))
      .sort((a, b) => a.month.localeCompare(b.month));
    return {region: g, rows, gapped: withGaps(rows, {y: "share", allMonths: MONTHS}), last: rows.at(-1)};
  });
}
const niceMax = (series) => d3.max(series, (s) => d3.max(s.rows, (d) => d.share)) ?? 0;
const ranked = (series) => series.filter((s) => s.last).sort((a, b) => b.last.share - a.last.share);

function regionPanel(s, id, width, {yMax, unit, format}) {
  const y = yScale(yMax, {headroom: 1.12});
  const first = s.region === REGIONS[0];
  const svg = Plot.plot({
    width, height: hs(width), ...MARGINS, marginRight: marginRight(width), style: STYLE,
    x: {domain: X_DOMAIN, label: null, axis: null},
    y: {domain: y.domain, label: null, axis: null},
    marks: [
      // The unit is written once, on the first panel; the three share one scale.
      ...valueAxisY(first ? unit : null, {ticks: y.ticks, tickFormat: pctTick}),
      ...gapMarks(GAP_MONTHS, id, {labelled: first}),
      Plot.line(s.gapped, {x: "date", y: "share", stroke: REGION_COLOR[s.region], strokeWidth: 1.75, curve: "linear", strokeLinejoin: "round"}),
      endDots([s.last], {y: "share", fill: REGION_COLOR[s.region]}),
      pointerRule(s.rows),
      monthTip(s.rows, {y: "share", series: "series", format, title: (d) => monthName(d.month)}),
      ...timeAxisX({width})
    ]
  });
  hatch(svg, id);
  finishAxes(svg);
  return svg;
}

const panelTitle = (g) => html`<p class="panel-title" style="color:${REGION_TEXT[g]}">${g}</p>`;
const CLASS_NOUN = {House: "houses", Apartment: "apartments"};
```

<section class="section" id="s4">
<span class="section-num">4</span><p class="kicker">New build</p>

## New build

<p class="lede">Newly built property is a market of its own: it sells at different price points, carries different tax treatment and follows construction activity rather than owners deciding to move. The share of each month's new listings for sale that is newly built, by region.</p>

```js
const NB = regionSeries(nbClass, (d) => d.n_newbuild / d.n);
const nbMax = niceMax(NB);
const h41 = (() => {
  const [hi, mid, lo] = ranked(NB);
  if (!hi || !mid || !lo) return `No region has a usable month for new ${CLASS_NOUN[nbClass]}.`;
  const s = shareWord(hi.last.share);
  const of = s.startsWith("one in") ? "" : "of ";
  const verb = s.startsWith("one in") ? "is" : "are";
  return `In ${hi.region} ${s} ${of}new ${CLASS_NOUN[nbClass]} ${verb} newly built; in ${mid.region} ${shareWord(mid.last.share)}, in ${lo.region} ${shareWord(lo.last.share)}.`;
})();
```

<figure class="fig" id="fig-4-1">
${kicker("4.1", `Share of new ${CLASS_NOUN[nbClass]} for sale that are newly built`)}
${headline(h41)}
<div class="fig-controls">

```js
const nbClass = view(Inputs.radio(new Map([["Houses", "House"], ["Apartments", "Apartment"]]), {label: "Type", value: "House"}));
```

</div>

<div class="fig-pair">
<div class="third">${panelTitle("Flanders")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(NB[0], "nodata-fig-4-1-fl", width, {yMax: nbMax, unit: "SHARE NEWLY BUILT", format: (v, r) => `${pct(v * 100, 1)} (${num(r.n_newbuild)} of ${num(r.n)})`})));
```

</div></div>
<div class="third">${panelTitle("Wallonia")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(NB[1], "nodata-fig-4-1-wal", width, {yMax: nbMax, unit: "SHARE NEWLY BUILT", format: (v, r) => `${pct(v * 100, 1)} (${num(r.n_newbuild)} of ${num(r.n)})`})));
```

</div></div>
<div class="third">${panelTitle("Brussels")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(NB[2], "nodata-fig-4-1-bru", width, {yMax: nbMax, unit: "SHARE NEWLY BUILT", format: (v, r) => `${pct(v * 100, 1)} (${num(r.n_newbuild)} of ${num(r.n)})`})));
```

</div></div>
</div>

${caption(`Three panels on one scale, so the heights compare: Flanders in brick, Wallonia in bluestone, Brussels in gilt. Each line is the share of the month's new ${CLASS_NOUN[nbClass]} for sale advertised as newly built, from the latest month in which the region clears the sample floor. Lines break where a month falls below the floor. Hatched months have no data.`)}
${source(`Source: listings, ${SOURCE_WINDOW}. Shares of counts by month of first publication, months with a usable sample. Hatched months have no data.`)}
</figure>
</section>

<section class="section" id="s5">
<span class="section-num">5</span><p class="kicker">Entry level</p>

## What new supply costs

<p class="lede">Whether entry-level property still reaches the market: the share of each month's new listings for sale asking less than a fixed price point, by region.</p>

```js
const AF = regionSeries(afClass, (d) => d[afPoint] / d.n);
const afMax = niceMax(AF);
const afEur = {under_200k: "€200,000", under_250k: "€250,000", under_300k: "€300,000"}[afPoint];
const afShort = {under_200k: "€200k", under_250k: "€250k", under_300k: "€300k"}[afPoint];
const h51 = (() => {
  const [hi, mid, lo] = ranked(AF);
  if (!hi || !mid || !lo) return `No region has a usable month for new ${CLASS_NOUN[afClass]}.`;
  const s = shareWord(hi.last.share);
  const t = shareWord(mid.last.share);
  const rest = `in ${mid.region} ${t} ${t.startsWith("one in") ? "does" : "do"}, in ${lo.region} ${shareWord(lo.last.share)}.`;
  // "A third of new Walloon houses ask under" and "One in 11 new Walloon houses asks under" lead
  // with the fraction; a bare percent is introduced by the region so the sentence never opens
  // with a digit.
  if (/^\d/.test(s)) return `In ${hi.region} ${s} of new ${CLASS_NOUN[afClass]} ask under ${afEur}; ${rest}`;
  if (s.startsWith("one in")) return `${cap(s)} new ${REGION_ADJ[hi.region]} ${CLASS_NOUN[afClass]} asks under ${afEur}; ${rest}`;
  return `${cap(s)} of new ${REGION_ADJ[hi.region]} ${CLASS_NOUN[afClass]} ask under ${afEur}; ${rest}`;
})();
const afFormat = (v, r) => `${pct(v * 100, 1)} (${num(r[afPoint])} of ${num(r.n)})`;
```

<figure class="fig" id="fig-5-1">
${kicker("5.1", `Share of new ${CLASS_NOUN[afClass]} for sale asking under ${afShort}`)}
${headline(h51)}
<div class="fig-controls">

```js
const afClass = view(Inputs.radio(new Map([["Houses", "House"], ["Apartments", "Apartment"]]), {label: "Type", value: "House"}));
```

```js
const afPoint = view(Inputs.radio(new Map([["€200k", "under_200k"], ["€250k", "under_250k"], ["€300k", "under_300k"]]), {label: "Price point", value: "under_250k"}));
```

</div>

<div class="fig-pair">
<div class="third">${panelTitle("Flanders")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(AF[0], "nodata-fig-5-1-fl", width, {yMax: afMax, unit: `SHARE UNDER ${afShort}`, format: afFormat})));
```

</div></div>
<div class="third">${panelTitle("Wallonia")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(AF[1], "nodata-fig-5-1-wal", width, {yMax: afMax, unit: `SHARE UNDER ${afShort}`, format: afFormat})));
```

</div></div>
<div class="third">${panelTitle("Brussels")}<div class="fig-chart">

```js
display(resize((width) => regionPanel(AF[2], "nodata-fig-5-1-bru", width, {yMax: afMax, unit: `SHARE UNDER ${afShort}`, format: afFormat})));
```

</div></div>
</div>

${caption(`Three panels on one scale: Flanders in brick, Wallonia in bluestone, Brussels in gilt. Each line is the share of the month's new ${CLASS_NOUN[afClass]} for sale asking less than ${afEur}, read from the latest month in which the region clears the sample floor. Lines break where a month falls below the floor. Hatched months have no data.`)}
${source(`Source: listings, ${SOURCE_WINDOW}. Shares of counts by month of first publication, months with a usable sample. Hatched months have no data.`)}
</figure>

<div class="footnotes">
<p>The price points are fixed in nominal euros across the whole period. Asking prices have risen since January 2023, so part of any decline in the share under a threshold reflects price inflation rather than a change in what is offered.</p>
</div>
</section>
