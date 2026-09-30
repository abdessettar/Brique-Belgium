#!/usr/bin/env node
// Post-build checks on the rendered pages, run by `npm run build` after `observable build`.
//
// 1. House style bans em dashes, en dashes and their relatives in anything a reader sees. The
//    headline sentences are generated at runtime from data, so the pages are also checked at the
//    source, but this catches copy that reached dist/ through any other route.
// 2. Internal plumbing must never be named on a page.
// 3. Nothing may exceed Cloudflare Pages' 25 MiB per-file limit (refresh.sh checks this too, but
//    a plain `npm run build` should fail just as loudly).
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join} from "node:path";

const DIST = "dist";
const DASHES = /[\u2010-\u2015]/g;
const PLUMBING = /\b(scraper|scraped|scrape|BigQuery|parquet)\b/gi;
const LIMIT = 25 * 1024 * 1024;

/**
 * The text a reader actually sees: script and style blocks dropped, then every remaining tag,
 * so attribute values cannot trip the check. A library filename in a preload link is not copy,
 * and neither is a CSS selector.
 */
function copyOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
}

let failed = false;
const pages = readdirSync(DIST).filter((f) => f.endsWith(".html"));
for (const page of pages) {
  const html = readFileSync(join(DIST, page), "utf8");
  const visible = copyOf(html);
  const dashes = visible.match(DASHES);
  if (dashes) { failed = true; console.error(`${page}: ${dashes.length} dash character(s) in copy`); }
  const plumbing = visible.match(PLUMBING);
  if (plumbing) { failed = true; console.error(`${page}: plumbing named in copy: ${[...new Set(plumbing)].join(", ")}`); }
}
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (s.size > LIMIT) { failed = true; console.error(`${p} is ${(s.size / 1048576).toFixed(1)} MiB, over the 25 MiB limit`); }
  }
}
walk(DIST);
if (failed) process.exit(1);
console.log(`check-dist: ${pages.length} pages clean`);
