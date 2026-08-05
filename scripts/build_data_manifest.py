#!/usr/bin/env python3
"""Write cache versions for static dashboard data assets."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "asset_manifest.json"
ASSETS = (
    "latest.json",
    "history.json",
    "allocation_signal.json",
    "regime_model_analysis_summary.json",
    "regime_model_quant_analysis.json",
    "daily_evidence.json",
    "news_index.json",
    "news_index_en.json",
)


def version(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def main() -> None:
    payload = {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "assets": {f"data/{name}": value for name in ASSETS if (value := version(DATA / name))},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} | assets={len(payload['assets'])}")


if __name__ == "__main__":
    main()
