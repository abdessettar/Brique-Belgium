/**
 * The commune map: 565 communes drawn on the page itself, no frame, no water, no basemap.
 *
 * Fills are stepped classes, never a continuous ramp: seven quantile classes on the brick
 * sequential for magnitudes, seven classes on the bluestone to brick diverging list for signed
 * measures with the mortar class straddling the pivot. Communes without a sample wear the site's
 * hatch. Communes are separated by 0.5px page-colour strokes; province, region and national
 * outlines are drawn on top from a topology built once per geo object.
 *
 * The map has no tooltip. Beside it (a 7/5 split from 1024px, stacked below) sit the readout
 * panel, which shows the national figures at rest and the hovered or pinned commune's figures,
 * the class column legend with break values and commune counts, and the Highest ten and Lowest
 * ten lists. Hover and pin are handled inside the component with plain DOM updates; the pinned
 * commune survives a re-render for the same `id`.
 *
 * The layer selector is not rendered here: the page renders it and passes the active key in.
 */
import * as d3 from "npm:d3";
import {html} from "npm:htl";
import {topology} from "npm:topojson-server";
import {feature, mesh, merge} from "npm:topojson-client";
import {PAGE, INK_1, INK_2, INK_3, HAIRLINE, BRICK, BRICK_7, BRICK_8, DIVERGING_7} from "./palette.js";
import {range, num, median, eur, eurM2Short, rentShort, pct} from "./sentences.js";
import {hatch} from "./chrome.js";
import {hatchSwatch, na, shown} from "./figure.js";

const FRANKLIN = '"Libre Franklin", "Helvetica Neue", Arial, sans-serif';
const BESLEY = '"Besley", Georgia, "Times New Roman", serif';

/** The readout rows used by Geography; Affordability appends income and years of income. */
export const DEFAULT_READOUT = [
  {label: "Median asking price", key: "median_price", format: eur},
  {label: "Price per m²", key: "median_eur_m2", format: eurM2Short},
  {label: "Median rent", key: "median_rent", format: rentShort},
  {label: "Gross yield", key: "gross_yield_pct", format: (v) => pct(v, 2)},
  {label: "Recorded sale price", key: "official_median_price", format: eur},
  {label: "Asking against recorded", key: "asking_vs_official_pct", format: (v) => pct(v, 1, true)},
  {label: "Listings", key: "n_sale", format: num}
];

const finite = (v) => v != null && Number.isFinite(v);

/**
 * Class breaks for a layer. `values` is the array of numbers (nulls allowed, they count as
 * missing); `spec` is the layer spec: {kind: "sequential" | "diverging", pivot, breaks}.
 *
 * Sequential: seven quantile classes on BRICK_7, or fixed inner `breaks` (6 breaks give 7 classes
 * on BRICK_7; 7 breaks give 8 classes on BRICK_8; any other count samples BRICK_7 by index).
 * Diverging: seven classes on DIVERGING_7 centred on the pivot ("median" or a number), with
 * symmetric widths on each side taken from the 1/7, 3/7 and 5/7 quantiles of the absolute
 * deviation, so the mortar class is the near-pivot band and every class holds about a seventh.
 *
 * Returns {kind, pivot, breaks, colors, classes, missing, indexOf(v), colorOf(v), labelOf(i, format)}
 * where classes = [{index, color, lo, hi, count}] from the lowest class up.
 */
export function classify(values, spec = {}) {
  const v = values.filter(finite).sort(d3.ascending);
  const kind = spec.kind === "diverging" ? "diverging" : "sequential";
  let breaks, colors, pivot = null;
  if (kind === "diverging") {
    pivot = spec.pivot == null || spec.pivot === "median" ? d3.median(v) ?? 0 : +spec.pivot;
    const dev = v.map((x) => Math.abs(x - pivot)).sort(d3.ascending);
    const [t1, t2, t3] = [1 / 7, 3 / 7, 5 / 7].map((q) => (dev.length ? d3.quantileSorted(dev, q) : q));
    breaks = [pivot - t3, pivot - t2, pivot - t1, pivot + t1, pivot + t2, pivot + t3];
    colors = DIVERGING_7;
  } else if (spec.breaks?.length) {
    breaks = [...spec.breaks].map(Number).sort(d3.ascending);
    const n = breaks.length + 1;
    colors = n === 7 ? BRICK_7 : n === 8 ? BRICK_8 : d3.range(n).map((i) => BRICK_7[Math.round((i * 6) / Math.max(1, n - 1))]);
  } else {
    breaks = d3.range(1, 7).map((i) => (v.length ? d3.quantileSorted(v, i / 7) : i));
    colors = BRICK_7;
  }
  const indexOf = (x) => (finite(x) ? d3.bisectRight(breaks, x) : -1);
  const colorOf = (x) => (finite(x) ? colors[indexOf(x)] : null);
  const classes = colors.map((color, index) => ({
    index, color, lo: index === 0 ? -Infinity : breaks[index - 1], hi: index === colors.length - 1 ? Infinity : breaks[index], count: 0
  }));
  for (const x of v) classes[indexOf(x)].count++;
  const missing = values.length - v.length;
  const labelOf = (i, format = (x) => x) => {
    const c = classes[i];
    return i === 0 ? `under ${format(c.hi)}` : i === classes.length - 1 ? `${format(c.lo)} and over` : range(c.lo, c.hi, format);
  };
  return {kind, pivot, breaks, colors, classes, missing, indexOf, colorOf, labelOf};
}

/* Outlines and province shapes, built once per geo object. */
const shapes = new WeakMap();
function shapesOf(geo) {
  let s = shapes.get(geo);
  if (s) return s;
  const topo = topology({communes: geo}, 1e5);
  const object = topo.objects.communes;
  const features = feature(topo, object).features;
  const provinces = new Map();
  for (const g of object.geometries) {
    const p = g.properties.province;
    if (!provinces.has(p)) provinces.set(p, {name: p, region: g.properties.region, geometries: []});
    provinces.get(p).geometries.push(g);
  }
  for (const p of provinces.values()) p.geometry = merge(topo, p.geometries);
  const regions = new Map();
  for (const g of object.geometries) {
    const r = g.properties.region;
    if (!regions.has(r)) regions.set(r, {name: r, geometries: []});
    regions.get(r).geometries.push(g);
  }
  for (const r of regions.values()) r.geometry = merge(topo, r.geometries);
  s = {
    features,
    national: mesh(topo, object, (a, b) => a === b),
    regionLines: mesh(topo, object, (a, b) => a.properties.region !== b.properties.region),
    provinceLines: mesh(topo, object, (a, b) => a.properties.province !== b.properties.province),
    provinces: [...provinces.values()],
    regions
  };
  shapes.set(geo, s);
  return s;
}

/* Hand-tuned label offsets in px at a 690px map, scaled with the map. Brussels has no province
 * label: the region name carries it and its nineteen communes leave no room. */
const PROVINCE_OFFSET = {
  "West Flanders": [0, -6], "East Flanders": [-4, 0], "Antwerp": [8, 0], "Limburg": [0, 6],
  "Flemish Brabant": [66, 8], "Walloon Brabant": [24, 20], "Hainaut": [10, -4], "Namur": [-6, 0],
  "Liege": [6, 10], "Luxembourg": [0, 0]
};
const PROVINCE_LABEL = {Liege: "Liège"};

/* Pinned commune per figure id, so a resize re-render keeps the pin. */
const pinned = new Map();

export const MAP_CSS = `
.map-figure{display:grid;grid-template-columns:minmax(0,1fr);row-gap:32px;color:${INK_1};font-family:${FRANKLIN};font-size:13px;line-height:1.4;font-variant-numeric:lining-nums}
.map-figure.map-l{grid-template-columns:7fr 5fr;column-gap:24px;row-gap:0}
.map-figure *{box-sizing:border-box}
.map-map{min-width:0}
.map-svg{display:block;max-width:100%;height:auto;cursor:default}
.map-fills path{stroke:${PAGE};stroke-width:0.5}
.map-side{min-width:0;display:flex;flex-direction:column;gap:28px}
.map-kicker{font-size:11.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:${INK_3};margin:0}
.map-readout{min-height:260px}
.map-name{font-family:${BESLEY};font-weight:500;font-size:22px;line-height:1.15;letter-spacing:0;color:${INK_1};margin:4px 0 0}
.map-sub{font-size:12.5px;color:${INK_3};margin:2px 0 10px}
.map-rows{margin:0;padding:0;list-style:none;border-top:1px solid ${HAIRLINE}}
.map-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid ${HAIRLINE};font-size:13px}
.map-row dt{margin:0;color:${INK_2};font-weight:400}
.map-row dd{margin:0;color:${INK_1};font-feature-settings:"tnum" 1,"lnum" 1;text-align:right;white-space:nowrap}
.map-row .na{color:${INK_3}}
.map-pinline{margin:8px 0 0;font-size:12.5px;min-height:18px;color:${INK_3}}
.map-pinline[hidden]{visibility:hidden;display:block!important}
.map-pin{appearance:none;background:none;border:0;padding:0;margin:0;font:inherit;font-size:12.5px;color:${INK_1};cursor:pointer;text-decoration:underline;text-decoration-color:${BRICK};text-decoration-thickness:1px;text-underline-offset:3px}
.map-pin:focus-visible{outline:1px solid ${INK_1};outline-offset:2px}
.map-legend-head{display:flex;justify-content:space-between;gap:12px;padding-bottom:5px;border-bottom:1px solid ${INK_2}}
.map-classes{margin:0;padding:0;list-style:none}
.map-class{display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:10px;align-items:center;padding:4px 0;border-bottom:1px solid ${HAIRLINE};font-size:12.5px;font-feature-settings:"tnum" 1,"lnum" 1}
.map-class .swatch{display:block}
.map-class-range{color:${INK_1}}
.map-class-count{color:${INK_3};text-align:right}
.map-pivot{margin:6px 0 0;font-size:11.5px;color:${INK_3}}
.map-lists{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:28px}
.map-figure.map-s .map-lists{grid-template-columns:minmax(0,1fr)}
.map-list{min-width:0}
.map-list table{width:100%;border-collapse:collapse;font-size:13px;font-feature-settings:"tnum" 1,"lnum" 1}
.map-list th{font-size:11.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.10em;color:${INK_3};text-align:left;padding:0 0 5px;border-bottom:1px solid ${INK_2}}
.map-list th.map-value{text-align:right}
.map-list td{padding:4px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:baseline}
.map-list tr.map-on td{border-bottom-color:${BRICK}}
.map-list td.map-rank{font-family:${BESLEY};font-weight:400;font-size:13px;color:${INK_3};width:3.2ch;padding-right:6px;white-space:nowrap}
.map-list td.map-commune{font-weight:500;color:${INK_1};padding-right:8px}
.map-list td.map-province{font-size:12.5px;color:${INK_3};padding-right:8px}
.map-list span.map-province{display:block;font-size:12.5px;font-weight:400;color:${INK_3};line-height:1.3}
.map-list td.map-value{text-align:right;color:${INK_1};white-space:nowrap}
.map-list tr.map-on .map-cname{text-decoration:underline;text-decoration-color:${BRICK};text-decoration-thickness:1px;text-underline-offset:3px}
`;

function ensureStyle() {
  if (typeof document === "undefined" || document.head.querySelector('style[data-brique="map"]')) return;
  const style = document.createElement("style");
  style.dataset.brique = "map";
  style.textContent = MAP_CSS;
  document.head.appendChild(style);
}

/**
 * communeMap({geo, rows, layers, layer, width, id, readout, national, lists, onLayer})
 *
 * geo      the FeatureCollection from data/communes.geo.json (properties nis, name, region, province)
 * rows     commune rows keyed by `nis` (data/communes.json communes, or an already joined array)
 * layers   ordered object of layer specs: {key: {label, kind, pivot, breaks, format, unit}}
 * layer    the active key in `layers`
 * width    the figure width from resize(); the 7/5 split applies from 1024px
 * id       unique per figure (default "map"); scopes the hatch pattern and the pin memory
 * readout  [{label, key, format}] rows for the readout panel (default DEFAULT_READOUT)
 * national optional object with the same keys, printed at rest; else medians across communes
 * lists    render the Highest ten and Lowest ten lists (default true)
 * onLayer  optional callback receiving the classification summary after render
 *
 * Returns a <div class="map-figure"> with a `.summary` property ({key, spec, classes, breaks,
 * pivot, missing, ranked}) so pages can write the headline from the same breaks.
 */
export function communeMap({geo, rows = [], layers, layer, width = 1200, id = "map", readout = DEFAULT_READOUT, national, lists = true, onLayer} = {}) {
  ensureStyle();
  const spec = layers?.[layer] ?? {label: layer, kind: "sequential", format: (v) => num(v)};
  const format = spec.format ?? ((v) => num(v));
  const byNis = new Map(rows.map((r) => [+r.nis, r]));
  const s = shapesOf(geo);
  const features = s.features;
  const valueOf = (f) => byNis.get(+f.properties.nis)?.[layer];
  const nameOf = (f) => f.properties.name ?? byNis.get(+f.properties.nis)?.locality ?? String(f.properties.nis);
  const cls = classify(features.map(valueOf), spec);
  const valued = features.filter((f) => finite(valueOf(f)));
  const ranked = valued.map((f) => ({nis: +f.properties.nis, name: nameOf(f), province: f.properties.province, region: f.properties.region, value: valueOf(f), row: byNis.get(+f.properties.nis)}))
    .sort((a, b) => d3.descending(a.value, b.value) || d3.ascending(a.name, b.name));
  ranked.forEach((r, i) => (r.rank = i + 1));

  /* Layout */
  const wide = width >= 1024;
  const GAP = 24;
  const mapCol = wide ? Math.round((width - GAP) * 7 / 12) : width;
  const regionNames = mapCol >= 640;
  const provinceNames = mapCol >= 520;
  const inset = 4;
  const marginRight = regionNames ? 8 : 0;
  const marginBottom = regionNames ? 26 : 0;
  const marginTop = 2;
  const probe = d3.geoMercator().fitWidth(1000, geo);
  const [[bx0, by0], [bx1, by1]] = d3.geoPath(probe).bounds(geo);
  const aspect = (by1 - by0) / (bx1 - bx0);
  let innerW = mapCol - inset * 2 - marginRight;
  let height = Math.round(innerW * aspect) + inset * 2 + marginTop + marginBottom;
  if (height > 640) {
    height = 640;
    innerW = Math.round((640 - inset * 2 - marginTop - marginBottom) / aspect);
  }
  const svgW = innerW + inset * 2 + marginRight;
  const projection = d3.geoMercator().fitExtent([[inset, inset + marginTop], [inset + innerW, height - inset - marginBottom]], geo);
  const path = d3.geoPath(projection);
  const k = innerW / 690;

  /* The map */
  const svg = d3.create("svg").attr("class", "map-svg").attr("width", svgW).attr("height", height).attr("viewBox", `0 0 ${svgW} ${height}`)
    .attr("role", "img").attr("aria-label", `Map of Belgian communes by ${spec.label ?? layer}`);
  const hatchUrl = hatch(svg.node(), `nodata-${id}`);
  const fills = svg.append("g").attr("class", "map-fills");
  fills.selectAll("path").data(features).join("path")
    .attr("d", path)
    .attr("data-nis", (f) => f.properties.nis)
    .attr("fill", (f) => cls.colorOf(valueOf(f)) ?? hatchUrl);
  const lines = svg.append("g").attr("class", "map-lines").attr("fill", "none").attr("pointer-events", "none").attr("stroke-linejoin", "round");
  lines.append("path").attr("d", path(s.provinceLines)).attr("stroke", INK_3).attr("stroke-width", 0.6);
  lines.append("path").attr("d", path(s.regionLines)).attr("stroke", INK_2).attr("stroke-width", 1);
  lines.append("path").attr("d", path(s.national)).attr("stroke", INK_1).attr("stroke-width", 1.2);
  const hi = svg.append("path").attr("class", "map-hi").attr("fill", "none").attr("stroke", INK_1).attr("stroke-width", 1.2).attr("stroke-linejoin", "round").attr("pointer-events", "none");
  const labels = svg.append("g").attr("class", "map-labels").attr("pointer-events", "none");
  if (provinceNames) {
    for (const p of s.provinces) {
      if (p.name === "Brussels") continue;
      const [cx, cy] = path.centroid(p.geometry);
      const [dx, dy] = PROVINCE_OFFSET[p.name] ?? [0, 0];
      labels.append("text")
        .attr("x", cx + dx * k).attr("y", cy + dy * k)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("font-family", FRANKLIN).attr("font-size", 11.5).attr("font-weight", 500).attr("letter-spacing", "0.10em")
        .attr("fill", INK_1).attr("stroke", PAGE).attr("stroke-width", 2).attr("paint-order", "stroke").attr("stroke-linejoin", "round")
        .text((PROVINCE_LABEL[p.name] ?? p.name).toUpperCase());
    }
  }
  if (regionNames) {
    const regionText = (x, y, text, anchor = "start") => labels.append("text")
      .attr("x", x).attr("y", y).attr("text-anchor", anchor)
      .attr("font-family", BESLEY).attr("font-style", "italic").attr("font-size", 15).attr("fill", INK_2).text(text);
    const [fx, fy] = projection([2.72, 51.41]);
    regionText(fx, fy, "Flanders");
    const [wx, wy] = projection([5.75, 49.43]);
    regionText(wx, wy, "Wallonia", "middle");
    const bru = s.regions.get("Brussels");
    if (bru) {
      const [[x0, y0], [x1, y1]] = path.bounds(bru.geometry);
      const cy = (y0 + y1) / 2;
      const [, ly] = projection([6.4, 51.04]);
      const lx = svgW - 2;
      regionText(lx, ly, "Brussels", "end");
      labels.append("line").attr("x1", lx - 62 * Math.min(1, k)).attr("y1", ly - 5).attr("x2", x1 - 1).attr("y2", cy)
        .attr("stroke", INK_2).attr("stroke-width", 0.75);
    }
  }

  /* Readout */
  const atRest = new Map(readout.map((r) => [r.key, national && r.key in national ? national[r.key] : median(rows.map((x) => x[r.key]))]));
  const nationalOf = (key) => atRest.get(key);
  const kicker = html`<p class="map-kicker">Belgium</p>`;
  const name = html`<p class="map-name">${national ? "National figures" : "Median commune"}</p>`;
  const mapped = () => `${shown(valued.length, features.length)} mapped on this layer`;
  const sub = html`<p class="map-sub">${mapped()}</p>`;
  const cells = readout.map((r) => {
    const dd = html`<dd>`;
    return {r, dd, li: html`<div class="map-row"><dt>${r.label}</dt>${dd}</div>`};
  });
  const printInto = (dd, v, fmt) => {
    dd.replaceChildren(finite(v) ? fmt(v) : na());
  };
  const pinButton = html`<button type="button" class="map-pin">Pinned, clear</button>`;
  const pinline = html`<p class="map-pinline" hidden>${pinButton}</p>`;
  const readoutEl = html`<div class="map-readout">${kicker}${name}${sub}<dl class="map-rows">${cells.map((c) => c.li)}</dl>${pinline}</div>`;

  const showNational = () => {
    kicker.textContent = "Belgium";
    name.textContent = national ? "National figures" : "Median commune";
    sub.textContent = mapped();
    for (const {r, dd} of cells) printInto(dd, nationalOf(r.key), r.format ?? num);
  };
  const showCommune = (f) => {
    const row = byNis.get(+f.properties.nis);
    kicker.textContent = f.properties.region ?? row?.region ?? "";
    name.textContent = nameOf(f);
    sub.textContent = f.properties.province ?? row?.province ?? "";
    for (const {r, dd} of cells) printInto(dd, row?.[r.key], r.format ?? num);
  };
  showNational();

  /* Legend */
  const legendRows = [...cls.classes].reverse().map((c) => html`<li class="map-class">
    ${html`<svg class="swatch" width="22" height="10" viewBox="0 0 22 10" aria-hidden="true"><rect x="0.25" y="0.25" width="21.5" height="9.5" fill="${c.color}" stroke="${INK_1}" stroke-width="0.5"/></svg>`}
    <span class="map-class-range">${cls.labelOf(c.index, format)}</span>
    <span class="map-class-count">${num(c.count)}</span>
  </li>`);
  legendRows.push(html`<li class="map-class">${hatchSwatch(22, 10)}<span class="map-class-range">no usable sample</span><span class="map-class-count">${num(cls.missing)}</span></li>`);
  const legendEl = html`<div class="map-legend">
    <!-- The label alone: the class ranges under it are formatted with the unit where the measure
         needs one, and the ranked lists below carry it as their value column head, so repeating
         it here printed "Price per m², €/m²". -->
    <div class="map-legend-head"><p class="map-kicker">${spec.label ?? layer}</p><p class="map-kicker">Communes</p></div>
    <ul class="map-classes">${legendRows}</ul>
    ${cls.kind === "diverging" ? html`<p class="map-pivot">Mortar class centred on the pivot, ${format(cls.pivot)}.</p>` : ""}
  </div>`;

  /* Lists */
  const rowEls = new Map();
  const sideCol = wide ? width - GAP - mapCol : width;
  const listCol = width < 480 ? width : (sideCol - GAP) / 2;
  const narrowLists = listCol < 300;
  const listTable = (title, items) => html`<div class="map-list"><table>
    <thead><tr><th colspan="${narrowLists ? 2 : 3}">${title}</th><th class="map-value">${spec.unit ?? "Value"}</th></tr></thead>
    <tbody>${items.map((r) => {
      const tr = narrowLists
        ? html`<tr data-nis="${r.nis}"><td class="map-rank">${num(r.rank)}</td><td class="map-commune"><span class="map-cname">${r.name}</span><span class="map-province">${r.province}</span></td><td class="map-value">${format(r.value)}</td></tr>`
        : html`<tr data-nis="${r.nis}"><td class="map-rank">${num(r.rank)}</td><td class="map-commune"><span class="map-cname">${r.name}</span></td><td class="map-province">${r.province}</td><td class="map-value">${format(r.value)}</td></tr>`;
      if (!rowEls.has(r.nis)) rowEls.set(r.nis, []);
      rowEls.get(r.nis).push(tr);
      return tr;
    })}</tbody>
  </table></div>`;
  const listsEl = lists ? html`<div class="map-lists">${listTable("Highest ten", ranked.slice(0, 10))}${listTable("Lowest ten", ranked.slice(-10).reverse())}</div>` : "";

  /* Hover and pin, plain DOM */
  const featureOf = new Map(features.map((f) => [+f.properties.nis, f]));
  let current = null;
  let pin = pinned.get(id) ?? null;
  if (pin != null && !featureOf.has(pin)) pin = null;
  const paint = (nis) => {
    for (const trs of rowEls.values()) for (const tr of trs) tr.classList.remove("map-on");
    if (nis == null) {
      hi.attr("d", null);
      showNational();
    } else {
      const f = featureOf.get(nis);
      hi.attr("d", path(f));
      showCommune(f);
      for (const tr of rowEls.get(nis) ?? []) tr.classList.add("map-on");
    }
    pinline.hidden = pin == null;
  };
  const hover = (nis) => {
    current = nis;
    paint(pin ?? nis);
  };
  const setPin = (nis) => {
    pin = nis;
    if (nis == null) pinned.delete(id); else pinned.set(id, nis);
    paint(pin ?? current);
  };
  const nisOf = (target) => {
    const el = target?.closest?.("[data-nis]");
    return el ? +el.dataset.nis : null;
  };
  fills.on("pointerover", (e) => hover(nisOf(e.target)));
  fills.on("pointerleave", () => hover(null));
  fills.on("click", (e) => {
    const nis = nisOf(e.target);
    if (nis == null) return;
    setPin(pin === nis ? null : nis);
  });
  pinButton.addEventListener("click", () => setPin(null));
  if (listsEl) {
    listsEl.addEventListener("pointerover", (e) => { const n = nisOf(e.target); if (n != null) hover(n); });
    listsEl.addEventListener("pointerleave", () => hover(null));
    listsEl.addEventListener("click", (e) => { const n = nisOf(e.target); if (n != null) setPin(pin === n ? null : n); });
  }
  paint(pin);

  const el = html`<div class="map-figure ${wide ? "map-l" : ""} ${width < 480 ? "map-s" : ""}" data-layer="${layer}">
    <div class="map-map">${svg.node()}</div>
    <div class="map-side">${readoutEl}${legendEl}${listsEl}</div>
  </div>`;
  el.summary = {key: layer, spec, classes: cls.classes, breaks: cls.breaks, pivot: cls.pivot, missing: cls.missing, ranked};
  el.hover = hover;
  el.pin = setPin;
  onLayer?.(el.summary);
  return el;
}
