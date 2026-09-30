import {existsSync, readFileSync} from "node:fs";
import {createHash} from "node:crypto";

// Loaders need requests / cryptography / pyarrow, which live in the project venv rather than the system
// interpreter. Fall back to python3 so a fresh checkout fails with a clear ImportError instead of
// a confusing "interpreter not found".
const PYTHON = existsSync(".venv/bin/python") ? "./.venv/bin/python" : "python3";

/**
 * Build time, which is also the refresh time: `scripts/refresh.sh` clears the loader
 * cache and rebuilds, so every page is rendered from a fresh pull in the same run.
 *
 * Stamped in Brussels time with the zone shown, rather than the build machine's local time or
 * UTC. A Belgian reader seeing "14:14" should not have to work out which clock it refers to.
 */
function refreshedAt() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels"
  }).format(new Date()).replace(" at ", ", ") + " Brussels time";
}

/**
 * The issue. A bulletin is numbered, so each refresh belongs to an issue: the last month of the
 * headline window, counted from January 2023 as No. 1 (so September 2026 is No. 45). The month is
 * read from the KPI loader's cache when it exists; a clean rebuild runs the config before the
 * loaders, in which case the current Brussels month is used, which is the same month in practice
 * because the listings run up to the day of the refresh. Two refreshes in one month are the same
 * issue; the refresh timestamp is printed separately.
 */
function issue() {
  let month;
  try {
    month = JSON.parse(readFileSync("src/.observablehq/cache/data/kpis.json", "utf8")).window.current[1];
  } catch {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {year: "numeric", month: "2-digit", timeZone: "Europe/Brussels"}).formatToParts(now);
    month = `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
  }
  const [y, m] = month.split("-").map(Number);
  const number = (y - 2023) * 12 + m;
  const name = new Intl.DateTimeFormat("en-GB", {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(Date.UTC(y, m - 1, 1)));
  return {number, month, name, line: `No. ${number}, ${name}`};
}
const ISSUE = issue();
const REFRESHED = refreshedAt();

/** One list drives the nav, the colophon and the page metadata. */
const PAGES = [
  {name: "Front page", path: "/index"},
  {name: "Geography", path: "/geography"},
  {name: "Affordability", path: "/affordability"},
  {name: "Anatomy", path: "/anatomy"},
  {name: "Supply", path: "/supply"},
  {name: "Energy", path: "/energy"},
  {name: "Every listing", path: "/explorer"},
  {name: "Notes", path: "/methodology"}
];

/** The brick mark: three courses of stretcher bond, the joints left as page. */
const MARK = (w, h) =>
  `<svg class="brick-mark" width="${w}" height="${h}" viewBox="0 0 24 18" aria-hidden="true" fill="#8f2f1c"><rect x="0" y="0" width="11" height="5"/><rect x="12" y="0" width="12" height="5"/><rect x="0" y="6" width="5" height="5"/><rect x="6" y="6" width="11" height="5"/><rect x="18" y="6" width="6" height="5"/><rect x="0" y="12" width="11" height="5"/><rect x="12" y="12" width="12" height="5"/></svg>`;

const FAVICON = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='#f3eee4'/><g fill='#8f2f1c' transform='translate(4 7)'><rect x='0' y='0' width='11' height='5'/><rect x='12' y='0' width='12' height='5'/><rect x='0' y='6' width='5' height='5'/><rect x='6' y='6' width='11' height='5'/><rect x='18' y='6' width='6' height='5'/><rect x='0' y='12' width='11' height='5'/><rect x='12' y='12' width='12' height='5'/></g></svg>`
);

/**
 * The masthead, rendered per page so the current page can be marked at build time rather than
 * with a client-side script. Framework hands the current page's path in.
 */
function header({path}) {
  const links = PAGES.map(({name, path: p}) => {
    const href = p === "/index" ? "/" : p;
    const active = p === path || (p === "/index" && (path === "/" || path === "/index"));
    return `<a href="${href}"${active ? ' aria-current="page"' : ""}>${name}</a>`;
  }).join("");
  return `<div class="masthead">
    <a class="masthead-brand" href="/">${MARK(24, 18)}<span><span class="wordmark">Brique</span><span class="masthead-descriptor">Belgium Real Estate Market · A Market Snapshot</span></span></a>
    <div class="masthead-issue"><div class="issue-line">${ISSUE.line}</div><div class="refresh-line">Refreshed ${REFRESHED}</div></div>
  </div>
  <nav class="nav" aria-label="Pages">${links}</nav>`;
}

/** The colophon. */
function footer() {
  const links = PAGES.map(({name, path: p}) => `<li><a href="${p === "/index" ? "/" : p}">${name}</a></li>`).join("");
  return `<div class="colophon">
    <div><p class="kicker">About this bulletin</p><p>Asking prices from property listings, not realised transactions. A panel of listings, each counted once at its latest observation. Medians and shares carry the bulletin; counts are read with the coverage note.</p></div>
    <div><p class="kicker">Sources</p><p>Listings on Immoweb, January 2023 to ${ISSUE.name}. Recorded sale prices: Statbel, first half of 2025. Fiscal income: Statbel, income year 2023, median net taxable income per declaration. Commune boundaries: Opendatasoft georef, 2025 communes.</p></div>
    <div><p class="kicker">Colophon</p><p>Set in Besley and Libre Franklin. Flanders is drawn in brick, Wallonia in Soignies bluestone, Brussels in Grand Place gilt; hatching marks what was not observed. Charts in Observable Plot; built with Observable Framework. Code under the MIT licence.</p></div>
    <div><p class="kicker">This issue</p><p>${ISSUE.line}.<br>Refreshed ${REFRESHED}.</p><ul>${links}</ul></div>
  </div>
  <p class="colophon-notice"><span class="kicker">No advice</span>Brique reports what sellers ask and what can be derived from it. It is not investment, financial, legal or tax advice, and nothing in it recommends buying, selling or letting any property. The figures are estimates drawn from listings, they may be incomplete or wrong, and they are published without warranty of any kind. No liability is accepted for any decision taken on them. Anyone making a property decision should verify the figures independently and take professional advice.</p>
  <p class="closing-line">Une brique dans le ventre.</p>
  <div class="closing-mark">${MARK(48, 36)}</div>`;
}

/**
 * Self-hosted type. Framework copies files referenced from the head (link[href]) into dist/_file
 * with a content hash in the name, but it does not parse CSS, so the @font-face rules are written
 * here with the same hash Framework applies. In preview the file is served unhashed under /_file/.
 */
const PREVIEW = process.argv.includes("preview");
const FONTS = [
  {family: "Besley", file: "besley.woff2", weight: "400 900", style: "normal", preload: true},
  {family: "Besley", file: "besley-italic.woff2", weight: "400 900", style: "italic"},
  {family: "Libre Franklin", file: "libre-franklin.woff2", weight: "100 900", style: "normal", preload: true},
  {family: "Libre Franklin", file: "libre-franklin-italic.woff2", weight: "100 900", style: "italic"}
];
function fontFaces() {
  const links = [];
  const rules = [];
  for (const f of FONTS) {
    const src = `src/fonts/${f.file}`;
    if (!existsSync(src)) continue;
    const hash = createHash("sha256").update(readFileSync(src)).digest("hex").slice(0, 8);
    const dot = f.file.lastIndexOf(".");
    const url = PREVIEW ? `/_file/fonts/${f.file}` : `/_file/fonts/${f.file.slice(0, dot)}.${hash}${f.file.slice(dot)}`;
    links.push(`<link rel="${f.preload ? "preload" : "prefetch"}" as="font" type="font/woff2" crossorigin href="/fonts/${f.file}">`);
    rules.push(`@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url("${url}") format("woff2")}`);
  }
  return links.join("") + `<style>${rules.join("")}</style>`;
}

export default {
  title: "Brique",
  root: "src",
  interpreters: {".py": [PYTHON]},
  theme: ["air"],
  globalStylesheets: [],
  sidebar: false,
  toc: false,
  pager: false,
  header,
  footer,
  pages: PAGES.map(({name, path}) => ({name, path})),
  head: fontFaces()
    + '<link rel="stylesheet" href="/theme.css">'
    + `<link rel="icon" type="image/svg+xml" href="${FAVICON}">`
    + '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
    + '<meta name="description" content="Brique, a bulletin of asking prices for houses and apartments across Belgium: prices, rents, yields, affordability and what features cost, commune by commune.">'
};
