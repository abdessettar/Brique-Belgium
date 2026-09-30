"""Read-only BigQuery access for Observable Framework data loaders.

Authentication signs a service account JWT and exchanges it for an OAuth token, using only
requests and cryptography. google-cloud-bigquery would pull in a large dependency tree for what
amounts to two REST calls.

Logs go to stderr so that a loader's stdout carries only data.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from typing import Any

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

KEY_PATH = os.environ.get("GCP_SA_KEY", os.path.expanduser("~/.config/immoweb/gcp-sa.json"))
SCOPE = "https://www.googleapis.com/auth/cloud-platform"
_API = "https://bigquery.googleapis.com/bigquery/v2"

# On-demand price per TiB in the EU multi-region, for the cost log line only.
_USD_PER_TIB = 6.25

_bytes_scanned = 0


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def _b64(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def _load_sa() -> dict:
    try:
        with open(KEY_PATH) as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise SystemExit(
            f"Service-account key not found at {KEY_PATH}.\n"
            "Set GCP_SA_KEY, or place the key at ~/.config/immoweb/gcp-sa.json (chmod 600)."
        )


_SA = _load_sa()
PROJECT = _SA["project_id"]


def _token() -> str:
    now = int(time.time())
    header = _b64(json.dumps({"alg": "RS256", "typ": "JWT", "kid": _SA["private_key_id"]}).encode())
    claims = _b64(json.dumps({
        "iss": _SA["client_email"], "scope": SCOPE, "aud": _SA["token_uri"],
        "iat": now, "exp": now + 3600,
    }).encode())
    signing_input = header + b"." + claims
    key = serialization.load_pem_private_key(_SA["private_key"].encode(), password=None)
    sig = _b64(key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256()))
    resp = requests.post(_SA["token_uri"], timeout=30, data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": (signing_input + b"." + sig).decode(),
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


_HEADERS = {"Authorization": f"Bearer {_token()}"}


def _guard(sql: str) -> None:
    """Reject anything but a query. The service account is read only; this fails earlier."""
    head = sql.lstrip().upper()
    if not head.startswith(("SELECT", "WITH")):
        raise ValueError("bq.query accepts SELECT/WITH statements only")


def _coerce(value: Any, field: dict) -> Any:
    """BigQuery REST returns every scalar as a string; restore real types."""
    if value is None:
        return None
    t = field.get("type", "STRING")
    try:
        if t in ("INTEGER", "INT64"):
            return int(value)
        if t in ("FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC"):
            return float(value)
        if t in ("BOOLEAN", "BOOL"):
            return value == "true"
    except (TypeError, ValueError):
        return None
    return value


def dry_run(sql: str) -> int:
    """Return bytes this query would scan, without running it. Free."""
    _guard(sql)
    r = requests.post(f"{_API}/projects/{PROJECT}/jobs", headers=_HEADERS, timeout=60,
                      json={"configuration": {"dryRun": True,
                                              "query": {"query": sql, "useLegacySql": False}}})
    r.raise_for_status()
    return int(r.json()["statistics"]["totalBytesProcessed"])


def query(sql: str, label: str = "query") -> list[dict]:
    """Run a SELECT and return all rows as dicts, following pagination to the end."""
    global _bytes_scanned
    _guard(sql)
    started = time.time()

    r = requests.post(f"{_API}/projects/{PROJECT}/queries", headers=_HEADERS, timeout=600,
                      json={"query": sql, "useLegacySql": False,
                            "timeoutMs": 120_000, "maxResults": 20_000})
    payload = r.json()
    if not r.ok or "error" in payload:
        err = payload.get("error", payload)
        raise RuntimeError(f"[{label}] BigQuery error: {json.dumps(err)[:800]}")

    job_ref = payload["jobReference"]
    fields = payload.get("schema", {}).get("fields", [])
    names = [f["name"] for f in fields]

    rows: list[dict] = []

    def absorb(chunk: dict) -> None:
        for row in chunk.get("rows", []):
            rows.append({n: _coerce(c.get("v"), f)
                         for n, f, c in zip(names, fields, row["f"])})

    # The first response may arrive before the job finishes; poll until it does.
    while not payload.get("jobComplete"):
        time.sleep(1.0)
        payload = requests.get(
            f"{_API}/projects/{PROJECT}/queries/{job_ref['jobId']}",
            headers=_HEADERS, timeout=120,
            params={"location": job_ref.get("location"), "maxResults": 20_000},
        ).json()
        fields = payload.get("schema", {}).get("fields", fields)
        names = [f["name"] for f in fields]

    absorb(payload)
    scanned = int(payload.get("totalBytesProcessed", 0))
    total = int(payload.get("totalRows", len(rows)))
    page_token = payload.get("pageToken")

    while page_token and len(rows) < total:
        nxt = requests.get(
            f"{_API}/projects/{PROJECT}/queries/{job_ref['jobId']}",
            headers=_HEADERS, timeout=300,
            params={"location": job_ref.get("location"), "pageToken": page_token,
                    "maxResults": 20_000},
        ).json()
        absorb(nxt)
        page_token = nxt.get("pageToken")

    _bytes_scanned += scanned
    log(f"  [{label}] {len(rows):,} rows  {scanned / 1e9:.2f} GB scanned  "
        f"${scanned / 1e12 * _USD_PER_TIB:.4f}  {time.time() - started:.1f}s")
    return rows


def total_scanned() -> tuple[float, float]:
    """(GB, USD) accumulated across this process. Used by loaders for a final cost line."""
    return _bytes_scanned / 1e9, _bytes_scanned / 1e12 * _USD_PER_TIB


def emit(obj: Any) -> None:
    """Write a JSON artifact to stdout, then report cumulative cost on stderr."""
    json.dump(obj, sys.stdout, separators=(",", ":"), default=str)
    gb, usd = total_scanned()
    log(f"  emitted, run total {gb:.2f} GB (${usd:.4f})")
