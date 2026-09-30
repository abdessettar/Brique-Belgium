<style>
/* Anatomy only. */
.an-dots svg text { font-family: "Libre Franklin", "Helvetica Neue", Arial, sans-serif; }
.an-dots .an-tab { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1; }
.an-ws { margin: 0 0 8px; }
.an-ws form { margin: 0; }
#observablehq-main .an-ws form:has(input[type="checkbox"]) > div { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 8px; }
@media (max-width: 1023.98px) {
  /* The worksheet is filled in before the bill is read, so it keeps the reading order on one column. */
  .an-pair > .text-5-first { order: 1; }
  .an-pair > .chart-7-last { order: 2; }
}
.an-ws .ctl-label { align-self: start; padding-top: 5px; }
.an-ws .ctl-label.an-top { padding-top: 0; }
.an-facade-table { margin-top: 6px; }
</style>

```js
import {PAGE, INK_1, INK_2, INK_3, HAIRLINE, MORTAR, BRICK, DIVERGING_7, REGIONS, CLASSES, inkOn} from "./components/palette.js";
import {eur, eurM2, num, pct, pctWord, aboveBelow, plural, monthName, window as monthWindow} from "./components/sentences.js";
import {STYLE, hatch} from "./components/chrome.js";
import {kicker, headline, caption, source, sidenote, standingNote, swatch, hatchSwatch} from "./components/figure.js";
import {miniTable, receipt} from "./components/table.js";
```

```js
const features = FileAttachment("data/features.json").json();
const trends = FileAttachment("data/trends.json").json();
const budget = FileAttachment("data/budget.json").json();
```

```js
const MIN_CELL = features.min_cell ?? 25;
const [W_FROM, W_TO] = String(features.window).split(" to ");
const SOURCE_WINDOW = monthWindow([W_FROM, W_TO]);
const byKey = new Map(features.features.map((f) => [f.key, f]));
const FONT = STYLE.fontFamily;

/** The chart's families, in reading order. A family with one key is a categorical feature whose
 *  reference is a level of its own; a family with several keys is a set of yes-or-no features
 *  that share one reference row, "none of these". */
const FAMILIES = [
  {name: "Facades", keys: ["facades"]},
  {name: "Condition", keys: ["condition"]},
  {name: "Outdoors", keys: ["garden", "terrace", "parking", "pool"], reference: "None of these"},
  {name: "Building", keys: ["lift", "heatpump", "solar", "glazing", "aircon", "fireplace"], reference: "None of these"},
  {name: "Heating", keys: ["heating"]},
  {name: "Kitchen", keys: ["kitchen"]},
  {name: "Age", keys: ["newbuild"], referenceLabel: "Resale"}
];
/** Where the reference row sits among a categorical feature's levels. */
const REF_AT = {facades: 0, condition: 3, heating: 0, kitchen: 2, newbuild: 0};
/** Features whose reference is doubtful enough to be marked on the chart. */
const CARE = new Set(["parking", "glazing"]);
/** Features kept off the chart and stated in the footnotes instead. */
const OMITTED = ["attic", "basement"];

/** How a level reads inside a sentence. */
const PHRASE = {
  "facades|3": "a third facade", "facades|4": "a fourth facade",
  "condition|TO_RESTORE": "needing restoration", "condition|TO_RENOVATE": "needing renovation",
  "condition|TO_BE_DONE_UP": "needing doing up", "condition|JUST_RENOVATED": "a fresh renovation", "condition|AS_NEW": "as new condition",
  "garden|True": "a garden", "terrace|True": "a terrace", "parking|True": "indoor parking", "pool|True": "a swimming pool",
  "lift|True": "a lift", "heatpump|True": "a heat pump", "solar|True": "solar panels", "glazing|True": "double glazing",
  "aircon|True": "air conditioning", "fireplace|True": "a fireplace",
  "heating|FUELOIL": "fuel oil heating", "heating|ELECTRIC": "electric heating", "heating|PELLET": "pellet heating", "heating|WOOD": "wood heating",
  "kitchen|NOT_INSTALLED": "no fitted kitchen", "kitchen|SEMI_EQUIPPED": "a semi equipped kitchen", "kitchen|HYPER_EQUIPPED": "a hyper equipped kitchen",
  "newbuild|True": "a new build"
};
const phrase = (r) => PHRASE[r.id] ?? r.label.toLowerCase();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const article = (cls) => (cls === "House" ? "a" : "an");
const nounOf = (cls) => (cls === "House" ? "house" : "apartment");
const pluralOf = (cls) => (cls === "House" ? "houses" : "apartments");

/** The rows of Figure 1.1 for a class, grouped by family. */
function groupsFor(cls) {
  const out = [];
  for (const fam of FAMILIES) {
    const feats = fam.keys.map((k) => byKey.get(k)).filter((f) => f && f.classes.includes(cls));
    if (!feats.length) continue;
    const rows = [];
    if (fam.reference) rows.push({id: `${fam.name}|ref`, family: fam.name, label: fam.reference, ref: true});
    for (const f of feats) {
      const levels = f.levels.filter((l) => l.class === cls).map((l) => ({
        id: `${f.key}|${l.level}`, family: fam.name, key: f.key, level: l.level, label: l.label,
        v: l.premium_pct, n: l.n, nRef: l.n_ref, refLabel: f.reference_label.toLowerCase(), byRegion: l.by_region ?? {},
        care: CARE.has(f.key), thin: l.premium_pct == null || l.n < MIN_CELL
      }));
      if (fam.keys.length === 1) {
        const at = REF_AT[f.key] ?? 0;
        levels.splice(at, 0, {id: `${f.key}|ref`, family: fam.name, key: f.key, level: f.reference, label: fam.referenceLabel ?? f.reference_label, ref: true});
      }
      rows.push(...levels);
    }
    out.push({family: fam.name, rows});
  }
  return out;
}
const flat = (groups) => groups.flatMap((g) => g.rows);

/** A 72 by 48 line elevation: the house's exposed facades in brick, its neighbours dashed. */
function elevation(count) {
  const n = +count;
  const leftNb = n <= 3, rightNb = n === 2;
  const brick = (d) => svg`<path d=${d} fill="none" stroke=${BRICK} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const dash = (d) => svg`<path d=${d} fill="none" stroke=${INK_3} stroke-width="1" stroke-dasharray="3 2" stroke-linejoin="round"/>`;
  return svg`<g aria-hidden="true">
    <line x1="1" x2="71" y1="44.5" y2="44.5" stroke=${INK_3} stroke-width="1"/>
    ${brick("M24 20 L36 9 L48 20")}
    ${brick("M24 44 L48 44")}
    ${brick("M33 44 L33 33 L39 33 L39 44")}
    ${leftNb ? dash("M24 20 L24 44") : brick("M24 20 L24 44")}
    ${rightNb ? dash("M48 20 L48 44") : brick("M48 20 L48 44")}
    ${leftNb ? dash("M2 44 L2 24 L13 14 L24 24") : ""}
    ${rightNb ? dash("M70 44 L70 24 L59 14 L48 24") : ""}
  </g>`;
}
```

<p class="kicker">What features cost · sale listings since January 2024</p>

# Anatomy of a price

<div class="row top">
<div class="main">
<p class="lede">Every premium is measured within cells of region, property class and construction era against a stated reference, then weighted by sample across cells, so geography and age are held still. Premiums are in price per square metre and describe associations in asking prices, not causes.</p>
</div>
<aside class="side">${standingNote()}${sidenote("Method", html`A feature level is compared with its reference inside each cell of region, class and construction era; a cell in which either side has fewer than ${num(MIN_CELL)} listings is dropped before the cell premiums are weighted by sample into one figure. Listings observed from ${SOURCE_WINDOW}.`)}</aside>
</div>

<section class="section" id="s1">
<span class="section-num">1</span><p class="kicker">Premiums</p>

## The bill of a house

<p class="lede">A Belgian house is described by its number of facades before anything else: two for a terraced house, three for a semi, four for a detached one. The chart prices that and every other feature the listings record, one row each, against a reference drawn hollow.</p>

```js
const groups11 = groupsFor(cls);
const rows11 = flat(groups11);
const cand11 = rows11.filter((r) => !r.ref && !r.thin && !r.care);
const pos11 = cand11.filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
const neg11 = cand11.filter((r) => r.v < 0).sort((a, b) => a.v - b.v);
const h11 = (() => {
  if (pos11.length < 2 || !neg11.length) return `Too few ${pluralOf(cls)} carry the features needed to rank them.`;
  const r0 = Math.round(pos11[0].v), r1 = Math.round(pos11[1].v), r2 = Math.round(-neg11[0].v);
  return `${cap(phrase(pos11[0]))} adds ${r0} percent to ${article(cls)} ${nounOf(cls)}'s price per square metre; ${phrase(pos11[1])} adds ${r1 === r0 ? "as much" : String(r1)}; ${phrase(neg11[0])} takes ${r2} away.`;
})();
const rowById = (id) => rows11.find((r) => r.id === id);
```

```js
/** Figure 1.1: one SVG, every row placed by hand so facade rows can carry their elevation. */
function dotChart(width) {
  const id = "nodata-fig-1-1";
  const narrow = width < 560;
  const labelW = narrow ? 118 : 156, valueW = 56, nW = narrow ? 74 : 66, careW = narrow ? 0 : 104;
  const rowH = 24, facadeH = 52, careH = narrow ? 38 : rowH, titleH = 18, groupGap = 20, headH = narrow ? 44 : 28;
  // On a phone the column heads and the zero rule's label share a line only if they collide, so
  // the label drops to a second line there.
  const headY = 12, zeroLabelY = narrow ? 28 : 12, zeroTop = narrow ? 34 : 18;
  const xValueEnd = width - careW - nW, xNEnd = width - careW;
  const track0 = labelW + 12, track1 = xValueEnd - valueW - 8;
  let y = headH;
  const placed = [], titles = [];
  groups11.forEach((g, gi) => {
    if (gi) y += groupGap;
    titles.push({name: g.family, y: y + titleH - 5});
    y += titleH;
    g.rows.forEach((r, i) => {
      const hgt = r.key === "facades" ? facadeH : r.care && narrow ? careH : rowH;
      placed.push({...r, y0: y, y1: y + hgt, yc: y + hgt / 2, first: i === 0});
      y += hgt;
    });
  });
  const H = y + 2;
  const vals = placed.filter((r) => !r.ref && !r.thin).map((r) => r.v);
  const lo = Math.min(0, d3.min(vals) ?? 0) - 3, hi = Math.max(0, d3.max(vals) ?? 0) + 3;
  const x = d3.scaleLinear([lo, hi], [track0, track1]);
  const x0 = x(0);
  const scale = narrow ? 0.72 : 1;
  const labelX = (r) => (r.key === "facades" ? 72 * scale + 8 : 0);
  const rowTitle = (r) => r.ref
    ? `${r.label}: the reference`
    : `${r.label}: ${pct(r.v, 1, true)} per m² against ${r.refLabel}, ${plural(r.n, "listing")} against ${num(r.nRef)}`;
  const row = (r) => svg`<g>
    <title>${rowTitle(r)}</title>
    ${r.first ? svg`<line x1="0" x2=${width} y1=${r.y0 + 0.5} y2=${r.y0 + 0.5} stroke=${HAIRLINE} stroke-width="1"/>` : ""}
    <line x1="0" x2=${width} y1=${r.y1 + 0.5} y2=${r.y1 + 0.5} stroke=${HAIRLINE} stroke-width="1"/>
    ${r.key === "facades" ? svg`<g transform="translate(0,${r.yc - 24 * scale}) scale(${scale})">${elevation(r.level)}</g>` : ""}
    <text x=${labelX(r)} y=${r.care && narrow ? r.yc - 5 : r.yc} dy="0.35em" fill=${INK_1} font-size="13">${r.label}</text>
    ${r.care && narrow ? svg`<text x="0" y=${r.yc + 9} dy="0.35em" fill=${INK_3} font-size="11.5">read with care</text>` : ""}
    ${r.ref ? svg`<g>
        <circle cx=${x0} cy=${r.yc} r="3" fill="none" stroke=${INK_1} stroke-width="1.25"/>
        <text x=${xValueEnd} y=${r.yc} dy="0.35em" text-anchor="end" fill=${INK_3} font-size="12">reference</text>
      </g>`
    : r.thin ? svg`<g>
        <rect x=${x0} y=${r.yc - 9} width="60" height="18" fill="url(#${id})"/>
        <text x=${x0 + 66} y=${r.yc} dy="0.35em" fill=${INK_3} font-size="12">too few listings</text>
      </g>`
    : svg`<g>
        <circle cx=${x(r.v)} cy=${r.yc} r="3" fill=${INK_1} />
        <text class="an-tab" x=${xValueEnd} y=${r.yc} dy="0.35em" text-anchor="end" fill=${INK_1} font-size="12">${pct(r.v, 1, true)}</text>
        <text class="an-tab" x=${xNEnd} y=${r.yc} dy="0.35em" text-anchor="end" fill=${INK_3} font-size="12">${num(r.n)}</text>
        ${r.care && !narrow ? svg`<text x=${xNEnd + 14} y=${r.yc} dy="0.35em" fill=${INK_3} font-size="11.5">read with care</text>` : ""}
      </g>`}
  </g>`;
  const el = svg`<svg width=${width} height=${H} viewBox="0 0 ${width} ${H}" style="display:block;overflow:visible;font-family:${FONT}" aria-label="Premium per square metre by feature, ${pluralOf(cls)}">
    <text x=${x0} y=${zeroLabelY} text-anchor="middle" fill=${INK_3} font-size="12">same as reference</text>
    <text x=${xValueEnd} y=${headY} text-anchor="end" fill=${INK_3} font-size="11.5" font-weight="500" letter-spacing="0.1em">PREMIUM</text>
    <text x=${xNEnd} y=${headY} text-anchor="end" fill=${INK_3} font-size="11.5" font-weight="500" letter-spacing="0.1em">LISTINGS</text>
    <line x1=${x0 + 0.5} x2=${x0 + 0.5} y1=${zeroTop} y2=${H} stroke=${INK_2} stroke-width="1"/>
    ${titles.map((t) => svg`<text x="0" y=${t.y} fill=${INK_3} font-size="11.5" font-weight="500" letter-spacing="0.12em">${t.name.toUpperCase()}</text>`)}
    ${placed.map(row)}
  </svg>`;
  hatch(el, id);
  return el;
}
```

```js
// The other half of the facade story: per square metre a fourth facade is worth a fifth, per home far more.
const fab = (region, f) => features.facades_abs.find((d) => d.region === region && d.facades === f);
const be2 = fab("Belgium", "2"), be3 = fab("Belgium", "3"), be4 = fab("Belgium", "4");
const facadeTable = miniTable({
  columns: [
    {label: "Facades", key: "facades", format: (v) => `${v} facades`},
    {label: "Median €", key: "median_price", format: eur},
    {label: "€/m²", key: "median_eur_m2", format: eur},
    {label: "Living m²", key: "median_surface", format: num},
    {label: "Land m²", key: "median_land", format: num}
  ],
  rows: [be2, be3, be4]
});
const lift = rowById("lift|True"), terrace = rowById("terrace|True"), garden = rowById("garden|True"), pool = rowById("pool|True");
const hyper = rowById("kitchen|HYPER_EQUIPPED"), renov = rowById("condition|TO_RENOVATE"), asNew = rowById("condition|AS_NEW");
const gain = (r, digits = 0) => (r == null || r.thin ? "n/a" : Math.abs(r.v) < 0.5 ? "nothing" : `${pctWord(Math.abs(r.v), digits)}${r.v < 0 ? " less" : ""}`);
```

<figure class="fig" id="fig-1-1">
${kicker("1.1", `Premium on asking price per m² by feature, ${pluralOf(cls)}`)}
${headline(h11)}
<div class="fig-controls">

```js
const cls = view(Inputs.radio(CLASSES, {label: "Type", value: "House"}));
```

</div>
<div class="fig-pair">
<div class="chart-7 fig-chart an-dots">

```js
display(resize((width) => dotChart(width)));
```

</div>
<div class="text-5">
${cls === "House" ? html`
<p>The facade count sets the shape of a Belgian house and much of its price. Per square metre a fourth facade adds ${pctWord(rowById("facades|4").v, 0)} to a terraced house of the same region and era; per home the gap is wider, because detached houses are larger and stand on more land. Across Belgium a detached house asks a median ${eur(be4.median_price)} against ${eur(be2.median_price)} for a terraced one, on ${num(be4.median_surface)} square metres of living space against ${num(be2.median_surface)} and on ${(be4.median_land / be2.median_land).toFixed(1)} times the land.</p>
<p class="panel-title">Houses by facade count, Belgium</p>
<div class="an-facade-table">${facadeTable}</div>
<p>Condition is the widest lever on the chart: a house that needs renovation asks ${pctWord(Math.abs(renov.v), 0)} less per square metre than one in good condition of the same region and era, and an as new one ${pctWord(asNew.v, 0)} more. A hyper equipped kitchen adds ${pctWord(hyper.v, 0)}, close to the whole gap between good and as new.</p>`
: html`
<p>Apartments have no facades to count; the lift takes their place as the feature a listing states first. A lift adds ${pctWord(lift.v, 0)} to the price per square metre of an apartment in the same region and era, more than a garden (${gain(garden)}) and more than a terrace (${gain(terrace)}), which most apartments have and which therefore separates little.</p>
<p>Condition works as it does for houses: an apartment that needs renovation asks ${pctWord(Math.abs(renov.v), 0)} less per square metre than one in good condition, an as new one ${pctWord(asNew.v, 0)} more. A swimming pool on an apartment listing usually means a shared pool in the building, and the ${plural(pool.n, "listing")} that carry one ask ${pctWord(pool.v, 0)} more.</p>`}
</div>
</div>
${caption(`Each row is one feature level. The dot is the premium on asking price per square metre against the row's reference, measured inside cells of region, class and construction era and weighted by sample; to the right of the vertical rule the feature asks more, to the left less. Hollow circles are references: two facades, good condition, gas heating, an installed kitchen, a resale, or none of the family's features. The value and the number of listings carrying the feature are printed at the right; a row marked read with care rests on a reference the listings record poorly, which the footnotes explain.`)}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Within-cell premiums against the reference, sample weighted across ${num(d3.sum(rows11.filter((r) => !r.ref && !r.thin), (r) => r.n))} ${nounOf(cls)} listings carrying a feature.`)}
</figure>

```js
const atticH = byKey.get("attic")?.levels.find((l) => l.class === "House");
const basementH = byKey.get("basement")?.levels.find((l) => l.class === "House");
const basementA = byKey.get("basement")?.levels.find((l) => l.class === "Apartment");
const glazingH = byKey.get("glazing")?.levels.find((l) => l.class === "House");
const glazingA = byKey.get("glazing")?.levels.find((l) => l.class === "Apartment");
const absentFalse = features.features.filter((f) => f.absent_is_false).map((f) => f.label.toLowerCase());
```

<div class="footnotes">
<p>Two features are kept off the chart. An attic reads as ${pct(atticH?.premium_pct, 1, true)} on a house and a basement as ${pct(basementH?.premium_pct, 1, true)} on a house and ${pct(basementA?.premium_pct, 1, true)} on an apartment, but the listings never record an explicit no for either, so every blank is read as absent and the reference mixes homes without one with homes that did not say. The same reading applies to ${absentFalse.slice(0, -1).join(", ")} and ${absentFalse.at(-1)}, which is why indoor parking is marked read with care.</p>
<p>Double glazing is marked for the opposite reason: almost every listing says yes, so the reference is the ${num(glazingH?.n_ref)} houses and ${num(glazingA?.n_ref)} apartments that explicitly say no, a small and unusual group, and the premium says more about those homes than about the glazing.</p>
<p>Premiums are per square metre. A feature that comes with more floor space, such as a fourth facade or a garden, can raise the price of a home while lowering its price per square metre, which is why the facade table beside the chart carries absolute medians as well.</p>
</div>
</section>

<section class="section" id="s2">
<span class="section-num">2</span><p class="kicker">The receipt</p>

## Build a price

<p class="lede">Choose a region, a type and a set of features, and the receipt applies each premium in turn to the median price per square metre of the reference home. It is an arithmetic of associations, itemised the way a notary itemises costs, and its total is an indication rather than a valuation.</p>

```js
const byMonth = (a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0);
const LEVEL_LABEL = (key) => {
  const f = byKey.get(key);
  const m = new Map(f.levels.map((l) => [l.level, l.label]));
  m.set(f.reference, f.reference_label);
  return m;
};
/** Level codes for a categorical feature in this class, with the reference in its place. */
function levelCodes(key, cls) {
  const f = byKey.get(key);
  const codes = [...new Set(f.levels.filter((l) => l.class === cls).map((l) => l.level))];
  codes.splice(REF_AT[key] ?? 0, 0, f.reference);
  return codes;
}
/** The regional premium for a level, falling back to the national figure. */
function premiumFor(key, level, cls, region) {
  const l = byKey.get(key)?.levels.find((d) => d.class === cls && d.level === level);
  if (!l) return null;
  const reg = l.by_region?.[region];
  if (reg && reg.premium_pct != null && reg.n >= MIN_CELL) return {v: reg.premium_pct, scope: region, n: reg.n};
  if (l.premium_pct != null && l.n >= MIN_CELL) return {v: l.premium_pct, scope: "national", n: l.n};
  return null;
}
function baselineFor(cls, region) {
  if (cls === "House") {
    const r = fab(region, "2");
    return {value: r.median_eur_m2, description: `Median asking price per m² of 2 facade houses in ${region}, ${SOURCE_WINDOW}`};
  }
  const rows = trends.sale.filter((d) => d.region === region && d.class === "Apartment" && !d.low_confidence && d.median_eur_m2 != null).sort(byMonth);
  const last = rows.at(-1);
  return {value: last.median_eur_m2, description: `Median asking price per m² of apartments in ${region}, ${monthName(last.month)}`};
}
function surfaceFor(cls, region) {
  if (cls === "House") return Math.round(fab(region, "2").median_surface / 5) * 5;
  const levels = budget.budgets.filter((d) => d.level === "region" && d.province === region && d.class === "Apartment");
  const modal = d3.greatest(levels, (d) => d.n);
  return modal ? Math.round(modal.median_surface / 5) * 5 : 90;
}
const EXTRA_KEYS = ["garden", "terrace", "parking", "pool", "lift", "heatpump", "solar", "glazing", "aircon", "fireplace", "newbuild"];
const WS_LABEL = {facades: "Facades", condition: "Condition", heating: "Heating", kitchen: "Kitchen", extras: "Features", surface: "Surface, m²"};
```

<figure class="fig" id="fig-2-1">
${kicker("2.1", `Estimated asking price per m² of ${article(wsClass)} ${nounOf(wsClass)} in ${wsRegion}, from its features`)}
${headline(h21)}
<div class="fig-controls">

```js
const wsRegion = view(Inputs.radio(REGIONS, {label: "Region", value: "Flanders"}));
```

```js
const wsClass = view(Inputs.radio(CLASSES, {label: "Type", value: "House"}));
```

</div>
<div class="fig-pair an-pair">
<div class="text-5-first">

```js
const ws = view((() => {
  const inputs = {};
  if (wsClass === "House") {
    const lab = LEVEL_LABEL("facades");
    inputs.facades = Inputs.select(levelCodes("facades", wsClass), {value: "4", format: (d) => lab.get(d)});
  }
  for (const key of ["condition", "heating", "kitchen"]) {
    const lab = LEVEL_LABEL(key);
    const value = key === "condition" ? "AS_NEW" : byKey.get(key).reference;
    inputs[key] = Inputs.select(levelCodes(key, wsClass), {value, format: (d) => lab.get(d)});
  }
  const extras = EXTRA_KEYS.filter((k) => byKey.get(k)?.classes.includes(wsClass));
  inputs.extras = Inputs.checkbox(extras, {value: ["garden", "heatpump"].filter((k) => extras.includes(k)), format: (k) => byKey.get(k).label});
  inputs.surface = Inputs.range([30, 400], {step: 5, value: surfaceFor(wsClass, wsRegion)});
  return Inputs.form(inputs, {
    template: (ins) => html`<div class="an-ws controls">${Object.entries(ins).flatMap(([k, el]) => [html`<div class="ctl-label ${k === "extras" ? "" : "an-top"}">${WS_LABEL[k]}</div>`, el])}</div>`
  });
})());
```

<p>Every premium is taken from Figure 3.1 for the chosen region; where the region has too few listings for a feature the national figure stands in and the line says so. The reference levels, ${wsClass === "House" ? "two facades, " : ""}good condition, gas heating and an installed kitchen, add no line, because they are the home the baseline describes.</p>
</div>
<div class="chart-7-last">

```js
const base = baselineFor(wsClass, wsRegion);
const picks = [];
if (wsClass === "House" && ws.facades !== "2") picks.push(["facades", ws.facades]);
for (const key of ["condition", "heating", "kitchen"]) if (ws[key] !== byKey.get(key).reference) picks.push([key, ws[key]]);
for (const k of ws.extras ?? []) picks.push([k, "True"]);
let running = base.value;
const lines = [{label: "Baseline", description: base.description, value: eur(base.value)}];
const applied = [];
for (const [key, level] of picks) {
  const f = byKey.get(key);
  const l = f.levels.find((d) => d.class === wsClass && d.level === level);
  const p = premiumFor(key, level, wsClass, wsRegion);
  if (!l || !p) { lines.push({label: l?.label ?? level, description: `Too few listings in ${wsRegion} and nationally to price this feature`, value: null}); continue; }
  const delta = running * (p.v / 100);
  running += delta;
  applied.push({key, level, id: `${key}|${level}`, label: l.label, v: p.v});
  lines.push({
    label: l.label,
    description: `${pct(p.v, 1, true)} against ${f.reference_label.toLowerCase()}${p.scope === "national" ? `, national figure: too few listings in ${wsRegion}` : ` in ${wsRegion}`}`,
    value: (delta >= 0 ? "+" : "") + eur(delta)
  });
}
const total = running;
const homePrice = total * ws.surface;
const list = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const h21 = (() => {
  // "As new" and "just renovated" sit before the noun; "to renovate" and "in good condition" after it.
  const adj = {AS_NEW: "as new", JUST_RENOVATED: "just renovated"}[ws.condition];
  const post = {GOOD: "in good condition", TO_RESTORE: "to restore", TO_RENOVATE: "to renovate", TO_BE_DONE_UP: "to be done up"}[ws.condition];
  const head = wsClass === "House"
    ? `A ${ws.facades} facade${adj ? `, ${adj}` : ""} house${post ? ` ${post}` : ""}`
    : `An ${adj ? `${adj} ` : ""}apartment${post ? ` ${post}` : ""}`;
  const withs = applied.filter((a) => a.key !== "facades" && a.key !== "condition").map((a) => PHRASE[a.id] ?? a.label.toLowerCase());
  const tail = withs.length ? ` with ${list(withs)}` : "";
  return `${head}${tail} in ${wsRegion} asks about ${eur(total)} per square metre, ${aboveBelow(total, base.value)} the baseline.`;
})();
display(receipt({
  lines,
  total: {label: "Estimated price per m²", value: eur(total)},
  foot: `For ${num(ws.surface)} m²: ${eur(homePrice)}. Premiums are combined multiplicatively, which treats them as independent; they are not, so the total is indicative.`
}));
```

</div>
</div>
${caption(`The baseline is the median asking price per square metre of the reference home in the chosen region: for houses a 2 facade house observed since ${monthName(W_FROM)}, for apartments the latest observed month. Each chosen feature multiplies the running figure by one plus its regional premium, and the line prints what that step adds or takes away in euros per square metre. The surface slider starts at the median living surface of the reference home in the region.`)}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Premiums as in Figure 3.1; the baseline for apartments is the regional monthly median from the trend series.`)}
</figure>
</section>

<section class="section" id="s3">
<span class="section-num">3</span><p class="kicker">By region</p>

## Where features matter most

<p class="lede">The national premium hides three markets. The same feature is measured in each region separately, cells of class and era still held fixed, and the matrix prints the three figures side by side on a diverging fill.</p>

```js
const HEADLINE_FLOOR = 500;
const groups31 = groupsFor(matClass);
const rows31 = flat(groups31).filter((r) => !r.ref);
const cells31 = rows31.flatMap((r) => REGIONS.map((region) => {
  const b = r.byRegion?.[region];
  const ok = b && b.premium_pct != null && b.n >= MIN_CELL;
  return {id: r.id, label: r.label, region, v: ok ? b.premium_pct : null, n: b?.n ?? 0, thin: !ok, care: r.care};
}));
const fillOf = (v) => (v < -10 ? DIVERGING_7[1] : v < -2 ? DIVERGING_7[2] : v <= 2 ? DIVERGING_7[3] : v <= 10 ? DIVERGING_7[4] : DIVERGING_7[5]);
const CLASS_ITEMS = [["below −10%", DIVERGING_7[1]], ["−10% to −2%", DIVERGING_7[2]], ["within 2 points of zero", DIVERGING_7[3]], ["+2% to +10%", DIVERGING_7[4]], ["above +10%", DIVERGING_7[5]]];
const yDomain31 = groups31.flatMap((g) => [`title|${g.family}`, ...g.rows.filter((r) => !r.ref).map((r) => r.id)]);
const label31 = new Map(rows31.map((r) => [r.id, r.label]));
const spread = rows31.map((r) => {
  const cs = cells31.filter((c) => c.id === r.id && !c.thin && c.n >= HEADLINE_FLOOR);
  if (cs.length < 3 || r.care) return null;
  const hi = d3.greatest(cs, (c) => c.v), lo = d3.least(cs, (c) => c.v);
  return {row: r, hi, lo, spread: hi.v - lo.v};
}).filter(Boolean);
const widest = d3.greatest(spread, (d) => d.spread);
// Which of the two large regions prices features more strongly, counted over rows priced in both.
const pairs31 = rows31.map((r) => [r.byRegion?.Flanders, r.byRegion?.Wallonia]).filter(([f, w]) => f && w && f.n >= MIN_CELL && w.n >= MIN_CELL);
const walWider = pairs31.filter(([f, w]) => Math.abs(w.premium_pct) > Math.abs(f.premium_pct)).length;
const widerRegion = walWider * 2 >= pairs31.length ? "Wallonia" : "Flanders";
const narrowerRegion = widerRegion === "Wallonia" ? "Flanders" : "Wallonia";
const widerCount = widerRegion === "Wallonia" ? walWider : pairs31.length - walWider;
/** "adds 12 percent in Brussels and 4 percent in Wallonia", the verb repeated only when the sign changes. */
function worthBoth(hi, lo) {
  const r = (v) => Math.round(Math.abs(v));
  const sign = (v) => (v >= 0.5 ? 1 : v <= -0.5 ? -1 : 0);
  const verb = (s, v) => (s > 0 ? `adds ${r(v)} percent` : s < 0 ? `takes ${r(v)} percent away` : "adds nothing");
  const sh = sign(hi.v), sl = sign(lo.v);
  const first = `${verb(sh, hi.v)} in ${hi.region}`;
  if (sh === sl && sh !== 0) return `${first} and ${r(lo.v)} percent in ${lo.region}`;
  return `${first} and ${verb(sl, lo.v)} in ${lo.region}`;
}
const h31 = widest
  ? `${cap(phrase(widest.row))} ${worthBoth(widest.hi, widest.lo)}.`
  : `No feature of ${pluralOf(matClass)} is observed in all three regions with ${num(HEADLINE_FLOOR)} listings or more.`;
```

<figure class="fig" id="fig-3-1">
${kicker("3.1", `Premium on asking price per m² by feature and region, ${pluralOf(matClass)}`)}
${headline(h31)}
<div class="fig-controls">

```js
const matClass = view(Inputs.radio(CLASSES, {label: "Type", value: "House"}));
```

</div>
${html`<p class="fig-legend">${CLASS_ITEMS.map(([label, color]) => html`<span class="fig-legend-item">${swatch(color)}${label}</span>`)}<span class="fig-legend-item">${hatchSwatch(12, 5)}fewer than ${num(MIN_CELL)} listings</span></p>`}
<div class="fig-pair">
<div class="chart-7 fig-chart">

```js
display(resize((width) => {
  const id = "nodata-fig-3-1";
  const narrow = width < 560;
  const marginLeft = narrow ? 112 : 150, mr = 4, marginTop = 26, marginBottom = 6, rowH = 24;
  const height = yDomain31.length * rowH + marginTop + marginBottom;
  const titles = groups31.map((g) => ({id: `title|${g.family}`, name: g.family.toUpperCase()}));
  const priced = cells31.filter((c) => !c.thin), thin = cells31.filter((c) => c.thin);
  const svgEl = Plot.plot({
    width, height, marginLeft, marginRight: mr, marginTop, marginBottom, style: STYLE,
    x: {domain: REGIONS, label: null, axis: null},
    y: {domain: yDomain31, label: null, axis: null, padding: 0},
    marks: [
      Plot.axisX({anchor: "top", tickSize: 0, tickPadding: 8, label: null, fill: INK_1, fontWeight: 500, fontSize: 12.5}),
      Plot.axisY({ticks: rows31.map((r) => r.id), tickSize: 0, tickPadding: 10, label: null, fill: INK_1, fontSize: 12.5, tickFormat: (d) => label31.get(d) ?? ""}),
      Plot.text(titles, {y: "id", frameAnchor: "left", dx: -marginLeft, dy: 3, text: "name", textAnchor: "start", fill: INK_3, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em"}),
      Plot.cell(thin, {x: "region", y: "id", fill: `url(#${id})`, inset: 1}),
      Plot.cell(priced, {x: "region", y: "id", fill: (d) => fillOf(d.v), inset: 1}),
      Plot.text(priced, {x: "region", y: "id", text: (d) => pct(d.v, 1, true), fill: (d) => inkOn(fillOf(d.v)), fontSize: 12, fontVariant: "tabular-nums"}),
      Plot.text(thin, {x: "region", y: "id", text: () => "too few", fill: INK_3, fontSize: 12}),
      Plot.tip(cells31, Plot.pointer({x: "region", y: "id", title: (d) => `${d.label} · ${d.region}\n${d.thin ? "fewer than " + num(MIN_CELL) + " listings" : pct(d.v, 1, true) + " per m²"}${d.thin ? "" : "\n" + plural(d.n, "listing")}`}))
    ]
  });
  hatch(svgEl, id);
  return svgEl;
}));
```

</div>
<div class="text-5">
<p>${widest ? `${cap(phrase(widest.row))} is the feature whose value differs most between regions among those observed at least ${num(HEADLINE_FLOOR)} times in each: ${widest.spread.toFixed(0)} points separate ${widest.hi.region} from ${widest.lo.region}.` : ""} ${widerRegion} prices features more strongly than ${narrowerRegion} on ${num(widerCount)} of the ${num(pairs31.length)} rows priced in both${widerRegion === "Wallonia" ? ", which is what a cheaper market does: the same feature is a larger share of a smaller price" : ""}.</p>
<p>Brussels is the thin column. Its ${pluralOf(matClass)} are fewer and its cells smaller, so a Brussels figure on a rare feature rests on a few dozen listings and moves with them; the hatched cells are the ones that fell under the floor of ${num(MIN_CELL)} entirely.</p>
${sidenote("Read with care", html`Indoor parking and double glazing keep their marks from Figure 1.1: the first rests on a reference in which a blank means no, the second on a small reference of homes that explicitly say no. They are printed for completeness and left out of the headline.`)}
</div>
</div>
${caption(`Rows are the feature levels of Figure 1.1, columns the three regions. Each cell prints the premium on asking price per square metre against the row's reference, measured within cells of class and construction era inside that region: bluestone where the feature takes value away, mortar within two points of zero, brick where it adds, in two steps each way. Hatched cells have fewer than ${num(MIN_CELL)} listings in the region and are not priced.`)}
${source(`Source: sale listings, ${SOURCE_WINDOW}. Regional within-cell premiums, sample weighted across the region's cells.`)}
</figure>

<div class="footnotes">
<p>A cell of region, class and construction era enters a premium only when both the feature level and its reference have at least ${num(MIN_CELL)} listings in it; the regional figure weights the surviving cells by the level's count. The headline of Figure 3.1 considers only features with at least ${num(HEADLINE_FLOOR)} listings in each region, so a thin cell cannot set the record.</p>
<p>Only listings observed from ${SOURCE_WINDOW} enter, so price drift inside a cell is small.</p>
<p>A blank is not read the same way for every feature. For ${absentFalse.slice(0, -1).join(", ")} and ${absentFalse.at(-1)} the listings never record an explicit no, so a blank is read as absent and the reference includes homes that simply did not say; for every other feature a blank is unknown and the listing is left out of that comparison.</p>
</div>
</section>
