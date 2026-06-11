from __future__ import annotations

import json
import queue
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_data import build_snapshot  # noqa: E402


CACHE_SECONDS = 120
BUILD_TIMEOUT_SECONDS = 25
_CACHE: dict[str, Any] = {"snapshot": None, "timestamp": 0.0}


def fallback_snapshot(error: Exception) -> dict[str, Any] | None:
    path = ROOT / "data" / "latest.json"
    if not path.exists():
        return None

    snapshot = json.loads(path.read_text(encoding="utf-8"))
    notes = list(snapshot.get("notes") or [])
    notes.insert(0, f"Vercel live API fallback: {error}")
    snapshot["notes"] = notes
    snapshot["apiStatus"] = "fallback"
    return snapshot


def build_snapshot_with_timeout() -> dict[str, Any]:
    result: queue.Queue[tuple[str, Any]] = queue.Queue(maxsize=1)

    def run() -> None:
        try:
            result.put(("ok", build_snapshot()))
        except Exception as error:
            result.put(("error", error))

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    try:
        status, payload = result.get(timeout=BUILD_TIMEOUT_SECONDS)
    except queue.Empty as error:
        raise TimeoutError(f"Live data build exceeded {BUILD_TIMEOUT_SECONDS}s") from error

    if status == "error":
        raise payload
    return payload


def get_snapshot() -> dict[str, Any]:
    now = time.time()
    cached = _CACHE.get("snapshot")
    if cached and now - float(_CACHE.get("timestamp", 0)) < CACHE_SECONDS:
        return cached

    try:
        snapshot = build_snapshot_with_timeout()
        snapshot["apiStatus"] = "live"
    except Exception as error:  # Keep the public dashboard usable when one source fails.
        snapshot = fallback_snapshot(error)
        if snapshot is None:
            raise

    _CACHE["snapshot"] = snapshot
    _CACHE["timestamp"] = now
    return snapshot


class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "s-maxage=120, stale-while-revalidate=300")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_json(200, {"ok": True})

    def do_GET(self) -> None:
        try:
            self.send_json(200, get_snapshot())
        except Exception as error:
            self.send_json(
                500,
                {
                    "apiStatus": "error",
                    "error": str(error),
                    "message": "Unable to build market snapshot.",
                },
            )
