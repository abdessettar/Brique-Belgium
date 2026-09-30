/**
 * The parts of a figure, shared by every page.
 *
 * A figure reads top to bottom: kicker ("FIGURE 2.1 · PRICE PER SQUARE METRE"), a headline sentence
 * computed from the data, an optional control row, the chart on the bare page, a caption that says
 * how to read it and names the colours in words, and a source line. Numbers are typed in the
 * markdown, never counted at runtime, so cross-references cannot drift when a cell re-renders.
 */
import {html, svg} from "npm:htl";
import {INK_1, INK_3, BRICK, HATCH} from "./palette.js";
import {num} from "./sentences.js";

/** "FIGURE 2.1 · SUBJECT" */
export const kicker = (number, subject) =>
  html`<p class="fig-kicker"><span class="fig-num">Figure ${number}</span><span class="fig-dot">·</span><span>${subject}</span></p>`;

/** The finding, as a sentence in the display face. */
export const headline = (text) => html`<p class="fig-headline">${text}</p>`;

/** How to read the figure; accepts a string or an htl fragment. */
export const caption = (content) => html`<p class="fig-caption">${content}</p>`;

/** The source line under a hairline. */
export const source = (content) => html`<p class="fig-source">${content}</p>`;

/** A sidenote with a run-in label. Place inside <aside class="side"> or use as the aside itself. */
export const sidenote = (label, content) => html`<aside class="side"><span class="side-label">${label}</span>${content}</aside>`;

/** The standing note that opens every page. */
export const standingNote = () => sidenote("Asking prices", html`Asking prices, not sale prices. These are what sellers advertise, not what buyers paid. <a href="./geography">Geography</a> compares them with recorded sale prices, commune by commune.`);

/** A brick-proportioned swatch (12 by 5) for legends and table rows. */
export const swatch = (color) => svg`<svg class="swatch" width="12" height="5" viewBox="0 0 12 5" aria-hidden="true"><rect width="12" height="5" fill="${color}" stroke="${INK_1}" stroke-width="0.5"/></svg>`;

/** A hatched swatch meaning "not observed". */
export const hatchSwatch = (w = 22, hgt = 10) => svg`<svg class="swatch" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" aria-hidden="true"><defs><pattern id="sw-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="${HATCH}" stroke-width="0.8"/></pattern></defs><rect width="${w}" height="${hgt}" fill="url(#sw-hatch)" stroke="${INK_1}" stroke-width="0.5"/></svg>`;

/** A one-line legend for figures with more than four series: [[label, color], ...]. */
export const legend = (items) =>
  html`<p class="fig-legend">${items.map(([label, color]) => html`<span class="fig-legend-item">${swatch(color)}${label}</span>`)}</p>`;

/**
 * The range rule that replaces a sparkline in the Ledger: a 1px line spanning the twelve-month
 * minimum to maximum, a brick tick at the current value, a muted tick at the year-earlier value,
 * and the ends printed. `format` renders the printed ends.
 */
export function rangeRule({min, max, current, prior, format = (v) => v, label = "twelve-month range"}) {
  const span = max - min || 1;
  const px = (v) => 2 + (98 - 2) * Math.min(1, Math.max(0, (v - min) / span));
  return html`<div class="range-rule">
    <div class="range-label">${label}</div>
    ${svg`<svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
      <line x1="2" y1="9" x2="98" y2="9" stroke="${INK_3}" stroke-width="1" vector-effect="non-scaling-stroke"/>
      ${prior != null ? svg`<line x1="${px(prior)}" y1="5" x2="${px(prior)}" y2="13" stroke="${INK_3}" stroke-width="1" vector-effect="non-scaling-stroke"/>` : ""}
      ${current != null ? svg`<line x1="${px(current)}" y1="3" x2="${px(current)}" y2="14" stroke="${BRICK}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ""}
    </svg>`}
    <div class="range-ends"><span>${format(min)}</span><span>${format(max)}</span></div>
  </div>`;
}

/** One Ledger cell: label, big figure, subline, range rule. */
export function ledgerCell({label, value, sub, rule}) {
  return html`<div class="ledger-cell">
    <div class="ledger-label">${label}</div>
    <div class="ledger-value">${value}</div>
    ${sub ? html`<div class="ledger-sub">${sub}</div>` : ""}
    ${rule ?? ""}
  </div>`;
}

/** The Ledger: rows of cells with a row head. rows = [{head, cells: [ledgerCell...]}] */
export function ledger(rows) {
  return html`<div class="ledger">${rows.map((r) => html`<div class="ledger-row"><div class="ledger-head">${r.head}</div>${r.cells}</div>`)}</div>`;
}

/** A single ruled line of summary figures (the Explorer summary): [{value, label}] */
export const summaryLine = (items) =>
  html`<div class="summary-line">${items.map((it) => html`<div class="summary-item"><div class="summary-value">${it.value}</div><div class="summary-label">${it.label}</div></div>`)}</div>`;

/** Middle dot for a missing table value. */
export const na = () => html`<span class="na">·</span>`;

/** A count of rows shown, for table captions. */
export const shown = (n, total, what = "communes") => `${num(n)} of ${num(total)} ${what}`;

/** A brick mark, the stretcher bond. Used in the masthead and colophon; pages should not need it. */
export const brickMark = (w = 24, hgt = 18) =>
  svg`<svg class="brick-mark" width="${w}" height="${hgt}" viewBox="0 0 24 18" aria-hidden="true" fill="${BRICK}"><rect x="0" y="0" width="11" height="5"/><rect x="12" y="0" width="12" height="5"/><rect x="0" y="6" width="5" height="5"/><rect x="6" y="6" width="11" height="5"/><rect x="18" y="6" width="6" height="5"/><rect x="0" y="12" width="11" height="5"/><rect x="12" y="12" width="12" height="5"/></svg>`;
