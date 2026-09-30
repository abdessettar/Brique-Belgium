/**
 * Minimal columnar helpers over an Apache Arrow table.
 *
 * The explorer originally used a SQL engine compiled to WebAssembly, but its runtime ships a
 * 38 MiB binary and Cloudflare Pages rejects any single file above 25 MiB. The two listing
 * files here are only 10.6 MiB and 4.3 MiB, so fetching one whole costs less than the engine
 * did, which makes plain columnar filtering both smaller and simpler than SQL.
 */

/** Materialise the columns we filter on into plain JS arrays once, so per-interaction work is a
 *  tight index loop rather than repeated Arrow accessor calls. */
export function toColumns(table, names) {
  const cols = {};
  for (const name of names) {
    const vec = table.getChild(name);
    cols[name] = vec ? vec.toArray() : new Array(table.numRows).fill(null);
  }
  cols._n = table.numRows;
  // Arrow returns string columns as vectors that don't flatten to primitives; read them lazily.
  cols._get = (name, i) => {
    const v = cols[name];
    return v == null ? null : v[i];
  };
  return cols;
}

/** Strings arrive as Arrow vectors; pull them out individually to keep memory flat. */
export function stringColumn(table, name) {
  const vec = table.getChild(name);
  if (!vec) return () => null;
  return (i) => vec.get(i);
}

export function quantileSorted(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function median(values) {
  const clean = [];
  for (const v of values) if (v != null && Number.isFinite(v)) clean.push(v);
  if (!clean.length) return null;
  clean.sort((a, b) => a - b);
  return quantileSorted(clean, 0.5);
}

/** Reservoir-free deterministic thinning: take every nth row. Keeps charts responsive without
 *  the frame-to-frame jitter a random sample would introduce as filters change. */
export function thin(indices, limit) {
  if (indices.length <= limit) return indices;
  const step = indices.length / limit;
  const out = new Array(limit);
  for (let i = 0; i < limit; i++) out[i] = indices[Math.floor(i * step)];
  return out;
}
