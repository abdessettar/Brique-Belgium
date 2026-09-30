/**
 * Number, date and phrase formatting for everything the site prints.
 *
 * Style: the euro sign precedes with no space (€399,000); en-GB comma grouping; "percent" is
 * the word inside a sentence and "%" in tables, axes and sublines; negative values use the true
 * minus (U+2212), never a hyphen; ranges are written "X to Y" and no dash of any kind is ever
 * emitted. Month keys are "YYYY-MM" strings as the loaders emit them.
 */

export const MINUS = "−";
const GB = "en-GB";

const isNil = (v) => v == null || Number.isNaN(v);

/** Hyphen-minus to true minus, for any number that was already formatted. */
export const minus = (s) => String(s).replace(/-/g, MINUS);

/** €399,000 */
export const eur = (v) => (isNil(v) ? "n/a" : minus("€" + Math.round(v).toLocaleString(GB)));

/** Compact euro for axes and small labels: €850, €2.4k, €250k, €1.2M. */
export function eurK(v) {
  if (isNil(v)) return "n/a";
  const a = Math.abs(v);
  const s = a >= 1e6 ? "€" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M"
    : a >= 1e4 ? "€" + Math.round(a / 1e3) + "k"
    : a >= 1e3 ? "€" + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
    : "€" + Math.round(a);
  return v < 0 ? MINUS + s : s;
}

/** 68,151 */
export const num = (v) => (isNil(v) ? "n/a" : minus(Math.round(v).toLocaleString(GB)));

/** 6.4% (sign only when asked): pct(6.4) = "6.4%", pct(-0.3, 1, true) = "−0.3%", pct(2, 1, true) = "+2.0%" */
export function pct(v, digits = 1, signed = false) {
  if (isNil(v)) return "n/a";
  const s = Math.abs(v).toFixed(digits) + "%";
  return v < 0 ? MINUS + s : signed && v > 0 ? "+" + s : s;
}

/** "6.4 percent" for prose. */
export const pctWord = (v, digits = 1) => (isNil(v) ? "n/a" : (v < 0 ? MINUS : "") + Math.abs(v).toFixed(digits) + " percent");

/** A number with a fixed number of decimals and a true minus. */
export const fixed = (v, digits = 1) => (isNil(v) ? "n/a" : minus(v.toFixed(digits)));

/** "7.3 times" */
export const times = (v, digits = 1) => (isNil(v) ? "n/a" : v.toFixed(digits) + " times");

/** "1 listing", "68,151 listings" */
export const plural = (n, one, many = one + "s") => `${num(n)} ${Math.round(n) === 1 ? one : many}`;

/** "€2,410 to €2,790" */
export const range = (a, b, fmt = eur) => `${fmt(a)} to ${fmt(b)}`;

/** "€2,242 per m²" in prose, "€2,242/m²" in data. */
export const eurM2 = (v) => (isNil(v) ? "n/a" : eur(v) + " per m²");
export const eurM2Short = (v) => (isNil(v) ? "n/a" : eur(v) + "/m²");

/** "€1,275 a month" in prose, "€1,275/mo" in data. */
export const rent = (v) => (isNil(v) ? "n/a" : eur(v) + " a month");
export const rentShort = (v) => (isNil(v) ? "n/a" : eur(v) + "/mo");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "September 2026" from "2026-09" */
export const monthName = (m) => (m ? `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}` : "n/a");
/** "Sep 2026" */
export const monthShort = (m) => (m ? `${MONTHS_SHORT[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}` : "n/a");
/** "October 2025 to September 2026" */
export const window = ([from, to]) => `${monthName(from)} to ${monthName(to)}`;

/** A month key to a UTC date at the first of the month, for time scales. */
export const monthDate = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1));
/** The month key of a date. */
export const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
/** Month arithmetic on keys: addMonths("2026-09", -12) = "2025-09". */
export function addMonths(m, n) {
  const i = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
/** Every month key from a to b inclusive. */
export function monthsBetween(a, b) {
  const out = [];
  for (let m = a; m <= b; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Year on year change as words for a ledger subline: "▲ 6.4% on the year". */
export function yoy(v, {digits = 1} = {}) {
  if (isNil(v)) return "no comparison";
  if (Math.abs(v) < 0.05) return "unchanged on the year";
  return `${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(digits)}% on the year`;
}

/** "41 percent above" / "12 percent below" / "level with", for a ratio a / b. */
export function aboveBelow(a, b, digits = 0) {
  if (isNil(a) || isNil(b) || !b) return "n/a";
  const d = (a / b - 1) * 100;
  if (Math.abs(d) < 0.5) return "level with";
  return `${Math.abs(d).toFixed(digits)} percent ${d > 0 ? "above" : "below"}`;
}

/** "more than" / "less than" phrasing for a signed percentage. */
export const moreLess = (v, digits = 0) =>
  isNil(v) ? "n/a" : Math.abs(v) < 0.5 ? "about the same as" : `${Math.abs(v).toFixed(digits)} percent ${v > 0 ? "more than" : "less than"}`;

/** "one in nine", "a third", "half", "two in five", or the percent when nothing idiomatic fits. */
export function share(v) {
  if (isNil(v)) return "n/a";
  const p = v * 100;
  if (Math.abs(p - 50) < 2) return "half";
  if (Math.abs(p - 33.3) < 2) return "a third";
  if (Math.abs(p - 25) < 2) return "a quarter";
  if (Math.abs(p - 66.7) < 2) return "two thirds";
  if (Math.abs(p - 75) < 2) return "three quarters";
  if (p < 20 && p > 4) {
    const n = Math.round(100 / p);
    return `one in ${n}`;
  }
  return `${Math.round(p)} percent`;
}

/** Sentence case for a label that arrives in caps from a loader. */
export const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** The last month of a series that is not flagged low_confidence. */
export function lastGood(rows, key = "month") {
  let best = null;
  for (const r of rows) if (!r.low_confidence && (best == null || r[key] > best)) best = r[key];
  return best;
}

/** The middle value of a numeric array, ignoring nulls. */
export function median(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) / 2;
  return v[Math.floor(i)] === undefined ? null : (v[Math.floor(i)] + v[Math.ceil(i)]) / 2;
}
