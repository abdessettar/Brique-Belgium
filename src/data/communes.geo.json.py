"""Belgian commune boundaries, simplified for the web.

Source is Opendatasoft's georef-belgium-municipality (565 features, carrying the NIS/INS code as
mun_code), the same 565 communes the listing aggregates roll up to, so the join is on code and
needs no name matching.

The raw export is 18 MB. It is reduced by simplifying every ring (Ramer-Douglas-Peucker) and
rounding coordinates to 4 decimals, about 11 m, well under a pixel at national zoom.

The download is cached under data-cache/ so rebuilds do not fetch it again.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data-cache" / "be-communes-raw.geojson"
URL = ("https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
       "georef-belgium-municipality/exports/geojson"
       "?select=mun_code,mun_name_fr,mun_name_nl,geo_shape")

EPSILON = 0.0012   # degrees, about 130 m
DECIMALS = 4
TARGET_BYTES = 500 * 1024


def log(msg):
    print(msg, file=sys.stderr)


def fetch() -> dict:
    CACHE.parent.mkdir(exist_ok=True)
    if not CACHE.exists():
        log(f"downloading commune geometry to {CACHE.name}")
        with urllib.request.urlopen(URL, timeout=180) as r, open(CACHE, "wb") as fh:
            fh.write(r.read())
    return json.loads(CACHE.read_text())


def perpendicular_distance(pt, a, b):
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    px, py = x1 + t * dx, y1 + t * dy
    return ((x - px) ** 2 + (y - py) ** 2) ** 0.5


def rdp(points, eps):
    """Iterative Ramer-Douglas-Peucker. A recursive version overflows the stack on dense rings."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        worst, worst_i = 0.0, None
        for i in range(lo + 1, hi):
            d = perpendicular_distance(points[i], points[lo], points[hi])
            if d > worst:
                worst, worst_i = d, i
        if worst > eps and worst_i is not None:
            keep[worst_i] = True
            stack.append((lo, worst_i))
            stack.append((worst_i, hi))
    return [p for p, k in zip(points, keep) if k]


def signed_area(ring):
    """Shoelace. Positive means counter-clockwise in lon/lat."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        total += x1 * y2 - x2 * y1
    return total / 2


def rewind(rings):
    """Flip ring winding to the order d3-geo expects.

    The source follows RFC 7946 (counter-clockwise exterior rings). d3-geo works on the sphere
    and expects the opposite, so it reads an RFC 7946 ring as the whole globe minus the commune
    and the map renders as a solid rectangle. The telltale sign is geoPath().bounds() returning
    the full projection extent for a small polygon.
    """
    out = []
    for i, ring in enumerate(rings):
        area = signed_area(ring)
        # exterior (i == 0) must be clockwise for d3; holes counter-clockwise
        wants_ccw = i > 0
        if (area > 0) != wants_ccw:
            ring = ring[::-1]
        out.append(ring)
    return out


def simplify_ring(ring, eps):
    out = rdp(ring, eps)
    # A polygon ring needs at least 4 positions and must stay closed.
    if len(out) < 4:
        out = ring[:: max(1, len(ring) // 4)]
    if out[0] != out[-1]:
        out.append(out[0])
    return [[round(x, DECIMALS), round(y, DECIMALS)] for x, y in out]


def simplify_geometry(geom, eps):
    t = geom["type"]
    if t == "Polygon":
        rings = [simplify_ring(r, eps) for r in geom["coordinates"]]
        rings = [r for r in rings if len(r) >= 4]
        return {"type": "Polygon", "coordinates": rewind(rings)} if rings else None
    if t == "MultiPolygon":
        polys = []
        for poly in geom["coordinates"]:
            rings = [simplify_ring(r, eps) for r in poly]
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                polys.append(rewind(rings))
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return None


# NIS codes encode the province in their leading digits, so region and province can be attached
# without a second dataset. The map dissolves these into region and province outlines.
_PROVINCE = {
    "1": "Antwerp", "21": "Brussels", "23": "Flemish Brabant", "24": "Flemish Brabant",
    "25": "Walloon Brabant", "3": "West Flanders", "4": "East Flanders", "5": "Hainaut",
    "6": "Liege", "7": "Limburg", "8": "Luxembourg", "9": "Namur",
}
_FLANDERS = {"Antwerp", "Flemish Brabant", "West Flanders", "East Flanders", "Limburg"}


def province_of(nis: int) -> str:
    code = str(nis)
    return _PROVINCE.get(code[:2]) or _PROVINCE.get(code[:1]) or "Unknown"


def region_of(nis: int) -> str:
    prov = province_of(nis)
    return "Brussels" if prov == "Brussels" else "Flanders" if prov in _FLANDERS else "Wallonia"


def first(value):
    """Opendatasoft wraps several fields in single-element lists."""
    if isinstance(value, list):
        return value[0] if value else None
    return value


raw = fetch()
features = []
dropped = 0
for f in raw["features"]:
    props = f.get("properties", {})
    code = first(props.get("mun_code"))
    geom = f.get("geometry") or props.get("geo_shape", {}).get("geometry")
    if not code or not geom:
        dropped += 1
        continue
    simple = simplify_geometry(geom, EPSILON)
    if simple is None:
        dropped += 1
        continue
    nis = int(code)
    features.append({
        "type": "Feature",
        "properties": {
            "nis": nis,
            "name": first(props.get("mun_name_fr")) or first(props.get("mun_name_nl")),
            "province": province_of(nis),
            "region": region_of(nis),
        },
        "geometry": simple,
    })

out = {"type": "FeatureCollection", "features": features}
payload = json.dumps(out, separators=(",", ":"))

# Simplify further until the file fits the target size.
eps = EPSILON
while len(payload.encode()) > TARGET_BYTES and eps < 0.02:
    eps *= 1.6
    for feat, src in zip(features, raw["features"]):
        geom = src.get("geometry") or src["properties"].get("geo_shape", {}).get("geometry")
        s = simplify_geometry(geom, eps)
        if s:
            feat["geometry"] = s
    payload = json.dumps(out, separators=(",", ":"))

log(f"{len(features)} communes, {dropped} dropped, epsilon {eps:.4f}, "
    f"{len(payload.encode()) / 1024:.0f} KB")
sys.stdout.write(payload)
