/**
 * The yearbook table, the small ruled table and the receipt.
 *
 * Every table on the site is a ruled table on the bare page: Libre Franklin 13px tabular, a caps
 * header with a 1px ink rule beneath, hairline row rules, no zebra, no hover fill, no radius, no
 * box. Units live in the header ("MEDIAN €", "€/M²", "YIELD %"), never in the cells. A missing
 * value prints as a middle dot. The name column is heavier ink; a rank column, when present, is
 * set in Besley so it reads as a numeral in the margin rather than as data.
 *
 * yearbook()  the big commune table: 25 rows and a "Show all 555" text link that expands in place.
 * miniTable() a compact ruled table beside a chart: no rank, no limit.
 * receipt()   the notary's statement and "Build a price": ruled lines, a double rule, a big total.
 *
 * The component injects its own CSS once (style[data-brique="table"]); pages need nothing else.
 */
import {html} from "npm:htl";
import {PAGE, INK_1, INK_2, INK_3, HAIRLINE, BRICK} from "./palette.js";
import {swatch, na} from "./figure.js";
import {num} from "./sentences.js";

const FRANKLIN = '"Libre Franklin", "Helvetica Neue", Arial, sans-serif';
const BESLEY = '"Besley", "Iowan Old Style", Georgia, serif';

export const CSS = `
/* ---- yearbook table ---- */
.yb-wrap { margin: 0; }
.yb-box { position: relative; }
.yb-scroll { overflow-x: visible; }
.yb-box::after { content: none; }
table.yb {
  width: 100%; border-collapse: separate; border-spacing: 0; margin: 0;
  font-family: ${FRANKLIN}; font-size: 13px; line-height: 1.3; color: ${INK_1};
  font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1;
  border: 0; background: transparent;
}
table.yb thead th {
  position: sticky; top: 0; z-index: 1; background: ${PAGE};
  font-family: ${FRANKLIN}; font-size: 11.5px; font-weight: 500; line-height: 1.25;
  text-transform: uppercase; letter-spacing: 0.10em; color: ${INK_3};
  text-align: right; vertical-align: bottom;
  padding: 0 0 7px 14px; border: 0; border-bottom: 1px solid ${INK_2};
}
table.yb thead th:first-child { padding-left: 0; }
table.yb thead th.yb-left { text-align: left; }
table.yb thead th.yb-rank { width: 2.5ch; }
table.yb tbody td {
  padding: 7px 0 7px 14px; text-align: right; vertical-align: baseline;
  border: 0; border-bottom: 1px solid ${HAIRLINE}; color: ${INK_1}; background: transparent;
}
table.yb tbody td:first-child { padding-left: 0; }
table.yb tbody td.yb-left { text-align: left; }
table.yb tbody td.yb-text { color: ${INK_2}; }
table.yb tbody td.yb-name { font-weight: 500; color: ${INK_1}; }
table.yb tbody td.yb-rank { font-family: ${BESLEY}; font-weight: 400; font-size: 13px; color: ${INK_3}; text-align: right; padding-right: 2px; font-variant-numeric: lining-nums proportional-nums; }
table.yb tbody tr:hover td { background: transparent; }
table.yb tbody tr[hidden] { display: none; }
table.yb .swatch { display: inline-block; vertical-align: 1px; margin-right: 8px; flex: none; }
table.yb .na { color: ${INK_3}; }
table.yb .yb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
table.yb.yb-mini { width: 100%; }
table.yb.yb-mini tbody td { padding-top: 6px; padding-bottom: 6px; }
.yb-more {
  display: inline-block; margin: 12px 0 0; padding: 0; border: 0; background: none; cursor: pointer;
  font-family: ${FRANKLIN}; font-size: 13px; line-height: 1.4; color: ${INK_1};
  text-decoration: underline; text-decoration-color: ${BRICK}; text-decoration-thickness: 1px; text-underline-offset: 3px;
}
.yb-more:hover { color: ${INK_1}; background: none; }
.yb-more:focus-visible { outline: 1px solid ${INK_1}; outline-offset: 2px; }
@media (max-width: 759.98px) {
  .yb-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .yb-box::after {
    content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 24px; pointer-events: none;
    background: linear-gradient(to right, ${PAGE}00, ${PAGE});
  }
  .yb-box.yb-end::after { content: none; }
  table.yb { width: auto; min-width: 100%; }
  table.yb thead th, table.yb tbody td { white-space: nowrap; }
  table.yb thead th { position: static; }
}

/* ---- receipt ---- */
.rc { margin: 0; font-family: ${FRANKLIN}; font-size: 13px; line-height: 1.35; color: ${INK_1}; }
table.rc-table {
  width: 100%; border-collapse: separate; border-spacing: 0; margin: 0; border: 0; background: transparent;
  font-family: ${FRANKLIN}; font-size: 13px; color: ${INK_1};
  font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1;
}
table.rc-table td { padding: 8px 0; border: 0; border-bottom: 1px solid ${HAIRLINE}; vertical-align: baseline; background: transparent; }
table.rc-table td.rc-label { text-align: left; color: ${INK_1}; padding-right: 16px; }
table.rc-table td.rc-value { text-align: right; white-space: nowrap; color: ${INK_1}; }
table.rc-table .rc-desc { display: block; font-size: 12.5px; line-height: 1.4; color: ${INK_3}; margin-top: 2px; max-width: 46ch; font-variant-numeric: lining-nums proportional-nums; font-feature-settings: "lnum" 1; }
table.rc-table tr.rc-rule td { padding: 0; border: 0; }
table.rc-table .rc-double { height: 2px; border-top: 1px solid ${INK_1}; border-bottom: 1px solid ${INK_1}; margin-top: 8px; }
table.rc-table tr.rc-last td { border-bottom: 0; }
table.rc-table tr.rc-total td { border: 0; padding: 10px 0 0; vertical-align: baseline; }
table.rc-table tr.rc-total td.rc-label {
  padding-right: 16px; font-size: 11.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; color: ${INK_3};
}
table.rc-table tr.rc-total td.rc-value {
  font-family: ${BESLEY}; font-weight: 400; font-size: 34px; line-height: 1; letter-spacing: -0.01em; color: ${INK_1};
  font-variant-numeric: lining-nums proportional-nums; font-feature-settings: "lnum" 1;
}
table.rc-table tr:hover td { background: transparent; }
.rc-foot { margin: 10px 0 0; font-size: 12.5px; line-height: 1.45; color: ${INK_2}; max-width: 66ch; }
.rc .na { color: ${INK_3}; }
`;

/** Inject the stylesheet once per document. */
export function style() {
  if (typeof document === "undefined") return;
  if (document.head.querySelector('style[data-brique="table"]')) return;
  const el = document.createElement("style");
  el.setAttribute("data-brique", "table");
  el.textContent = CSS;
  document.head.appendChild(el);
}

const isNil = (v) => v == null || (typeof v === "number" && Number.isNaN(v));

/** One cell's content: the middle dot for a missing value, the formatted value otherwise. */
function cellContent(col, row) {
  const v = col.key == null ? row : typeof col.key === "function" ? col.key(row) : row[col.key];
  let out;
  if (isNil(v)) out = null;
  else out = col.format ? col.format(v, row) : v;
  if (isNil(out) || out === "n/a" || out === "") out = na();
  const sw = col.swatch ? col.swatch(row) : null;
  return sw ? [swatch(sw), out] : out;
}

function cellClass(col, i, base) {
  const left = col.align === "left" || (col.align == null && col.name);
  const cls = [base];
  if (left) cls.push("yb-left");
  if (col.name) cls.push("yb-name");
  else if (left && base === "yb-td") cls.push("yb-text");
  if (col.className) cls.push(col.className);
  return cls.join(" ");
}

function headerRow(columns, rank) {
  return html`<tr>${rank ? html`<th class="yb-rank" scope="col"><span class="yb-sr">Rank</span></th>` : ""}${columns.map((c, i) => html`<th scope="col" class="${cellClass(c, i, "yb-th")}" title=${c.title ?? null}>${c.label}</th>`)}</tr>`;
}

function bodyRow(columns, row, i, {rank, key, hidden}) {
  const k = key == null ? null : typeof key === "function" ? key(row) : row[key];
  const tr = html`<tr data-key=${k ?? null} hidden=${hidden || null}>${rank ? html`<td class="yb-rank">${num(i + 1)}</td>` : ""}${columns.map((c, j) => html`<td class="${cellClass(c, j, "yb-td")}">${cellContent(c, row)}</td>`)}</tr>`;
  return tr;
}

/** Mark the scroll box so the fade disappears once the reader has scrolled to the end. */
function watchScroll(box, scroller) {
  const update = () => {
    const end = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
    box.classList.toggle("yb-end", end);
  };
  scroller.addEventListener("scroll", update, {passive: true});
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(update).observe(scroller);
  update();
}

/**
 * The yearbook table.
 *
 * columns: [{label, key, align?, format?, swatch?, name?, title?}]
 *   label   header text, sentence case with the unit ("Median €", "€/m²", "Rent €/mo"); CSS sets caps
 *   key     property name or (row) => value
 *   align   "left" or "right" (default right; left when name is set)
 *   format  (value, row) => string or DOM; a null value or "n/a" prints the middle dot
 *   swatch  (row) => colour, drawn as a 12 by 5 brick swatch before the cell text
 *   name    true on the name column (500 ink_1); the first column is taken as the name column when none is marked
 *   title   optional tooltip on the header for a spelled-out unit
 * rows: the data, already sorted by the page.
 * limit: rows shown before the "Show all N" link (default 25; pass Infinity to show everything).
 * total: the count printed in the link (defaults to rows.length).
 * more: the link's verb (default "Show all"); after expanding it reads "Show 25".
 * rank: true prints 1..n in a first column in Besley.
 * key: property name or (row) => id, written to data-key on each row.
 */
export function yearbook({columns, rows, limit = 25, total, more = "Show all", rank = true, key} = {}) {
  style();
  if (!columns.some((c) => c.name)) columns = columns.map((c, i) => (i === 0 ? {...c, name: true, align: c.align ?? "left"} : c));
  const n = rows.length;
  const count = total ?? n;
  const collapsible = n > limit;
  const trs = rows.map((r, i) => bodyRow(columns, r, i, {rank, key, hidden: collapsible && i >= limit}));
  const table = html`<table class="yb"><thead>${headerRow(columns, rank)}</thead><tbody>${trs}</tbody></table>`;
  const scroller = html`<div class="yb-scroll">${table}</div>`;
  const box = html`<div class="yb-box">${scroller}</div>`;
  const wrap = html`<div class="yb-wrap">${box}</div>`;
  if (collapsible) {
    let open = false;
    const button = html`<button type="button" class="yb-more" aria-expanded="false">${more} ${num(count)}</button>`;
    button.addEventListener("click", () => {
      open = !open;
      trs.forEach((tr, i) => { if (i >= limit) tr.hidden = !open; });
      button.textContent = open ? `Show ${num(limit)}` : `${more} ${num(count)}`;
      button.setAttribute("aria-expanded", String(open));
      if (!open) wrap.scrollIntoView?.({block: "nearest"});
    });
    wrap.appendChild(button);
  }
  watchScroll(box, scroller);
  return wrap;
}

/**
 * A compact ruled table beside a chart ("Change on the year by region"): same styles, no rank,
 * no limit, no scroll box. columns and rows as in yearbook().
 */
export function miniTable({columns, rows} = {}) {
  style();
  if (!columns.some((c) => c.name)) columns = columns.map((c, i) => (i === 0 ? {...c, name: true, align: c.align ?? "left"} : c));
  return html`<table class="yb yb-mini"><thead>${headerRow(columns, false)}</thead><tbody>${rows.map((r, i) => bodyRow(columns, r, i, {rank: false}))}</tbody></table>`;
}

/**
 * A receipt: ruled line items, a double rule, a big total.
 *
 * lines: [{label, description?, value}]  value is a formatted string or DOM; null prints the dot
 * total: {label, value}                   value set in Besley 34px under the double rule
 * foot:  optional string or DOM printed under the total in 12.5px ("Rules as of 1 January 2025.")
 */
export function receipt({lines = [], total, foot} = {}) {
  style();
  const value = (v) => (isNil(v) || v === "n/a" ? na() : v);
  const item = (l, i) => html`<tr class=${total && i === lines.length - 1 ? "rc-last" : null}><td class="rc-label">${l.label}${l.description ? html`<span class="rc-desc">${l.description}</span>` : ""}</td><td class="rc-value">${value(l.value)}</td></tr>`;
  // Two rows returned as an array: htl would wrap a two-node template in a span, which a table drops.
  const totalRows = total ? [
    html`<tr class="rc-rule"><td colspan="2"><div class="rc-double"></div></td></tr>`,
    html`<tr class="rc-total"><td class="rc-label">${total.label}</td><td class="rc-value">${value(total.value)}</td></tr>`
  ] : [];
  return html`<div class="rc"><table class="rc-table"><tbody>${lines.map(item)}${totalRows}</tbody></table>${foot ? html`<p class="rc-foot">${foot}</p>` : ""}</div>`;
}
