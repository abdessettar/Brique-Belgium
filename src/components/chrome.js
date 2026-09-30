/**
 * Axes, gridlines, gap bands and labels shared by every chart.
 *
 * Conventions: 1.75px lines with no smoothing, one 3px dot at the last observed point,
 * horizontal hairline grid only, no y spine (tick labels sit above their gridline at the left
 * edge, the unit written once at the top), a hatched band wherever nothing was observed, and
 * direct labels at line ends that are dodged apart after render so they never overlap.
 */
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {INK_1, INK_2, INK_3, GRID, HATCH, PAGE} from "./palette.js";
import {monthDate, addMonths} from "./sentences.js";

/** Plot's style option for every chart on the site. */
export const STYLE = {
  fontFamily: '"Libre Franklin", "Helvetica Neue", Arial, sans-serif',
  fontSize: "12.5px",
  color: INK_2,
  background: "transparent",
  overflow: "visible"
};

/** Chart height by column width: 420 on desktop, 340 on tablets, 300 on phones. */
export const h = (width) => (width > 760 ? 420 : width > 480 ? 340 : 300);

/** Right margin for direct labels; phones get shorter labels and less room. */
export const marginRight = (width) => (width > 480 ? 88 : 64);

/** Shared margins so every time figure on a page lines up and the hatch reads as one fold. The
 *  top margin leaves room for the unit label above the top tick label. */
export const MARGINS = {marginLeft: 8, marginTop: 40, marginBottom: 30};

/** Shorten region names on phones; the caption always carries the full name. */
export const shortName = (name, width) =>
  width > 480 ? name : ({Flanders: "Fl.", Wallonia: "Wal.", Brussels: "Bru.", House: "Houses", Apartment: "Apts"}[name] ?? name);

/** Adds the site's hatch pattern to a rendered SVG. Call inside resize() after Plot renders, with an
 *  id unique to the figure, and use the returned url as a fill. A pattern in a hidden shared SVG
 *  does not paint in every browser, so it is injected per figure. */
export function hatch(root, id, stroke = HATCH) {
  const svg = root?.tagName === "svg" ? root : root?.querySelector?.("svg");
  if (!svg || svg.querySelector(`#${id}`)) return `url(#${id})`;
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");
  const pattern = document.createElementNS(ns, "pattern");
  pattern.setAttribute("id", id);
  pattern.setAttribute("width", "6");
  pattern.setAttribute("height", "6");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M0 6 L6 0");
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", "0.8");
  pattern.appendChild(path);
  defs.appendChild(pattern);
  svg.insertBefore(defs, svg.firstChild);
  return `url(#${id})`;
}

/** Contiguous month keys folded into [{x1, x2, months}] bands (x2 is the first day after the band). */
export function monthBands(months) {
  const sorted = [...new Set(months)].sort();
  const bands = [];
  for (const m of sorted) {
    const last = bands.at(-1);
    if (last && addMonths(last.to, 1) === m) { last.to = m; last.months++; }
    else bands.push({from: m, to: m, months: 1});
  }
  return bands.map((b) => ({...b, x1: monthDate(b.from), x2: monthDate(addMonths(b.to, 1))}));
}

/** The marks for the unobserved months: a hatched band spanning the plot height, labelled once.
 *  `id` must be unique per figure and the same id passed to hatch() after render. */
export function gapMarks(gapMonths, id, {label = "NO LISTINGS RECORDED", labelled = true} = {}) {
  const bands = monthBands(gapMonths);
  // A rect with only x channels spans the full plot height; giving it infinite y channels makes
  // Plot drop the mark entirely.
  const marks = [Plot.rect(bands, {x1: "x1", x2: "x2", fill: `url(#${id})`})];
  if (labelled) {
    marks.push(Plot.text(bands.filter((b) => b.months >= 2).slice(0, 1), {
      x: (b) => new Date((+b.x1 + +b.x2) / 2), frameAnchor: "middle", rotate: -90, text: () => label,
      fill: INK_3, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.1em"
    }));
  }
  return marks;
}

/** The x axis for a monthly series: a baseline, short ticks, the year at each January in ink,
 *  the other quarters in muted ink. */
export function timeAxisX({width = 1000} = {}) {
  const fmtQ = d3.utcFormat("%b");
  const quarters = width > 600 ? "3 months" : "6 months";
  return [
    Plot.frame({anchor: "bottom", stroke: INK_3}),
    Plot.axisX({
      ticks: quarters, tickSize: 4, tickPadding: 6, label: null,
      tickFormat: (d) => (d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : width > 600 ? fmtQ(d) : ""),
      fontSize: 12.5, fill: (d) => (d.getUTCMonth() === 0 ? INK_1 : INK_3),
      fontWeight: (d) => (d.getUTCMonth() === 0 ? 500 : 400)
    })
  ];
}

/** Category axis for ordinal x (bands): baseline plus centred labels, no tick marks. */
export function bandAxisX(options = {}) {
  return [Plot.frame({anchor: "bottom", stroke: INK_3}), Plot.axisX({tickSize: 0, tickPadding: 8, label: null, fill: INK_2, ...options})];
}

/** The y axis: hairline grid, no spine, tick labels sitting above their gridline at the left edge,
 *  and the unit written once at the top left. Use with MARGINS (marginLeft 8, marginTop 40).
 *
 *  The labels carry a page-colour halo because they sit at the same left edge where every series
 *  starts, so without it the line is drawn straight through its own axis. Pass the axis last in
 *  the marks array (or let the caller draw it after the fills) so the halo sits over the ink. */
export function valueAxisY(unit, {tickFormat, ticks, grid = true} = {}) {
  return [
    grid ? Plot.gridY({stroke: GRID, strokeWidth: 1, ticks}) : null,
    Plot.axisY({
      anchor: "left", tickSize: 0, textAnchor: "start", dx: 0, dy: -8, label: null,
      tickFormat, ticks, fill: INK_2, lineAnchor: "bottom",
      textStroke: PAGE, textStrokeWidth: 3
    }),
    // The unit sits 28px above the frame, clear of the top tick label, which hangs 8px above it.
    unit ? Plot.text([unit], {frameAnchor: "top-left", dx: 0, dy: -28, text: (d) => d, fill: INK_3, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em", textAnchor: "start"}) : null
  ].filter(Boolean);
}

/** Tick values for a value axis, chosen so nothing collides and nothing repeats.
 *
 *  Two problems this solves. The top tick label would sit under the unit label written above the
 *  frame, so it is dropped. And a short range with a coarse formatter can print the same label
 *  twice (a rent series stepping 50 euros printed "EUR 1.1k" three times), so the tick count is
 *  reduced until every formatted label is distinct. Returns {domain, ticks} for the y scale. */
export function niceTicks(lo, hi, {count = 6, tickFormat = String} = {}) {
  const [d0, d1] = d3.nice(lo, hi, count);
  for (let n = count; n >= 3; n--) {
    const all = d3.ticks(d0, d1, n);
    const inner = all.filter((t) => t > d0 && t < d1);
    if (!inner.length) continue;
    const labels = inner.map(tickFormat);
    if (new Set(labels).size === labels.length) return {domain: [d0, d1], ticks: inner};
  }
  return {domain: [d0, d1], ticks: d3.ticks(d0, d1, 3).filter((t) => t > d0 && t < d1)};
}

/** A dashed reference line with its meaning written on it: the even split, the national figure. */
export function refLineY(y, label, {dx = 0, dy = -6, anchor = "right"} = {}) {
  return [
    Plot.ruleY([y], {stroke: INK_3, strokeWidth: 1, strokeDasharray: "3 3"}),
    label ? Plot.text([label], {y, frameAnchor: anchor, text: (d) => d, dx, dy, fill: INK_3, fontSize: 12, textAnchor: anchor === "left" ? "start" : "end"}) : null
  ].filter(Boolean);
}

/** The pointer rule: a dashed vertical that follows the pointer on time series. */
export const pointerRule = (data, x = "date") => Plot.ruleX(data, Plot.pointerX({x, stroke: INK_3, strokeDasharray: "3 3"}));

/** End marker: a filled 3px dot at the last observed point of each series. */
export const endDots = (last, {x = "date", y, fill}) => Plot.dot(last, {x, y, r: 3, fill, stroke: PAGE, strokeWidth: 1.5});

/** Direct labels at the right end of each series. Pass className so dodgeLabels() can find them. */
export function endLabels(last, {x = "date", y, text, fill, className = "endlabel", dx = 10, fontSize = 12.5}) {
  return Plot.text(last, {
    x, y, text, fill, dx, textAnchor: "start", fontSize, fontWeight: 500, className,
    stroke: PAGE, strokeWidth: 3, paintOrder: "stroke"
  });
}

/** Settle the axes after render. Call inside resize() once Plot.plot has returned, alongside
 *  hatch() and dodgeLabels(). Two things Plot cannot express in the marks array:
 *
 *  1. The y tick labels sit at the left edge, where every time series starts, so the line is drawn
 *     over its own axis. They cannot simply be placed last in the marks array because the
 *     gridlines travel with them and would then sit on top of the data. Instead the label group is
 *     moved to the end of the plot after render, so the grid stays under the ink and the labels
 *     (which carry a page-colour halo) sit over it.
 *  2. The first x tick sits on the frame edge, so its centred label hangs into the page gutter.
 *     Plot takes textAnchor as a constant for a whole axis, not per tick, so the leftmost and
 *     rightmost labels are re-anchored here. */
export function finishAxes(root) {
  const svg = root?.tagName === "svg" ? root : root?.querySelector?.("svg");
  if (!svg) return;

  for (const g of svg.querySelectorAll('g[aria-label~="y-axis"][aria-label*="label"]')) {
    g.parentNode?.appendChild(g);
  }

  const width = +svg.getAttribute("width") || svg.clientWidth;
  for (const text of svg.querySelectorAll('g[aria-label*="x-axis tick label"] text')) {
    let box;
    try { box = text.getBBox(); } catch { continue; }
    if (!box?.width) continue;
    const m = /translate\(([-\d.]+)/.exec(text.parentNode?.getAttribute("transform") || text.getAttribute("transform") || "");
    const x = m ? +m[1] : box.x + box.width / 2;
    if (x - box.width / 2 < 2) text.setAttribute("text-anchor", "start");
    else if (width && x + box.width / 2 > width - 2) text.setAttribute("text-anchor", "end");
  }
}

/** Push labels apart vertically after render so no two sit closer than `gap` pixels. Works on any
 *  Plot text mark given a className; call inside resize() after Plot.plot returns. */
export function dodgeLabels(root, className = "endlabel", gap = 14) {
  const svg = root?.tagName === "svg" ? root : root?.querySelector?.("svg");
  if (!svg) return;
  const texts = Array.from(svg.querySelectorAll(`g.${className} text`));
  const items = texts.map((el) => {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(el.getAttribute("transform") || "");
    return m ? {el, x: +m[1], y: +m[2]} : null;
  }).filter(Boolean).sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
  }
  // Re-centre the group so the dodge spreads both ways rather than only downwards.
  if (items.length > 1) {
    const original = texts.map((el) => +(/translate\([-\d.]+,([-\d.]+)\)/.exec(el.getAttribute("transform") || "")?.[1] ?? 0));
    const shift = (d3.mean(items, (d) => d.y) - d3.mean(original)) / 2;
    for (const it of items) it.y -= shift;
  }
  for (const it of items) it.el.setAttribute("transform", `translate(${it.x},${it.y})`);
}

/** Split a series at the unobserved months so lines break instead of bridging the hatch: inserts a
 *  null-y row for every missing month between the first and last observed month. */
export function withGaps(rows, {key = "month", y, allMonths}) {
  const present = new Map(rows.map((r) => [r[key], r]));
  return allMonths.map((m) => present.get(m) ?? {...rows[0], [key]: m, [y]: null, date: monthDate(m), _gap: true});
}

/** Rows of a monthly series with a Date for the time scale. */
export const dated = (rows, key = "month") => rows.map((r) => ({...r, date: monthDate(r[key])}));

/** Last row of each series by a key, for end dots and labels. */
export function lastOf(rows, by, {y} = {}) {
  const out = new Map();
  for (const r of rows) if (y == null || r[y] != null) out.set(r[by], r);
  return Array.from(out.values());
}

/** Tooltip for a time series: one tip for the month, every series listed in fixed order. */
export function monthTip(rows, {x = "date", y, series, order, format, title}) {
  return Plot.tip(rows, Plot.pointerX({
    x, y,
    title: (d) => {
      const at = rows.filter((r) => r[x]?.getTime?.() === d[x]?.getTime?.() && r[y] != null);
      const lines = (order ?? [...new Set(at.map((r) => r[series]))])
        .map((s) => at.find((r) => r[series] === s)).filter(Boolean)
        .map((r) => `${r[series]}\t${format(r[y], r)}`);
      return [title ? title(d) : "", ...lines].filter(Boolean).join("\n");
    }
  }));
}
