"""Publish a compact daily market dataset for the Evidence page."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INPUT_FILE = ROOT / "data" / "allocation_signal_history.csv"
LIVE_HISTORY_FILE = ROOT / "data" / "history.json"
OUT_FILE = ROOT / "data" / "daily_evidence.json"

NUMERIC_FIELDS = (
    "spyClose",
    "qqqClose",
    "vix",
    "move",
    "hyOas",
    "igOas",
    "tenYYield",
    "realTenY",
    "fearGreed",
    "spyDrawdown",
    "qqqDrawdown",
    "rspSpyRel60d",
    "scoreInputCompleteness",
    "volatilityScore",
    "creditScore",
    "sentimentScore",
    "scoreTotal",
    "opportunityScore",
    "riskScore",
)

TEXT_FIELDS = (
    "date",
    "regime",
    "regimeTitle",
    "allocationAction",
    "allocationStance",
)


def number_or_none(value: str | None) -> float | int | None:
    if value is None or value.strip() == "":
        return None
    number = float(value)
    return int(number) if number.is_integer() else round(number, 4)


def build_row(raw: dict[str, str]) -> dict[str, Any]:
    row: dict[str, Any] = {field: raw.get(field) or None for field in TEXT_FIELDS}
    row.update({field: number_or_none(raw.get(field)) for field in NUMERIC_FIELDS})
    return row


def live_history_rows() -> list[dict[str, Any]]:
    """Add confirmed close snapshots published since the weekly model refresh."""
    try:
        history = json.loads(LIVE_HISTORY_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    rows: list[dict[str, Any]] = []
    for entry in history.get("dailyHistory", []) if isinstance(history, dict) else []:
        if not isinstance(entry, dict) or not entry.get("asOf"):
            continue
        scores = entry.get("scores") if isinstance(entry.get("scores"), dict) else {}
        rows.append(
            {
                "date": entry["asOf"],
                "regime": entry.get("regime"),
                "regimeTitle": entry.get("regimeTitle"),
                "allocationAction": entry.get("allocationAction") or "HOLD",
                "allocationStance": entry.get("allocationStance") or "维持",
                "spyClose": entry.get("spyClose"),
                "qqqClose": entry.get("qqqClose"),
                "vix": entry.get("vix"),
                "move": entry.get("move"),
                "hyOas": entry.get("hyOas"),
                "igOas": entry.get("igOas"),
                "tenYYield": entry.get("tenYYield"),
                "realTenY": entry.get("realTenY"),
                "fearGreed": entry.get("fearGreed"),
                "spyDrawdown": entry.get("spyDrawdown"),
                "qqqDrawdown": entry.get("qqqDrawdown"),
                "rspSpyRel60d": entry.get("rspSpyRel60d"),
                "scoreInputCompleteness": entry.get("scoreInputCompleteness"),
                "volatilityScore": scores.get("volatility"),
                "creditScore": scores.get("credit"),
                "sentimentScore": scores.get("sentiment"),
                "scoreTotal": sum(value or 0 for value in scores.values()),
                "opportunityScore": entry.get("opportunityScore"),
                "riskScore": entry.get("riskScore"),
            }
        )
    return rows


def build_payload() -> dict[str, Any]:
    with INPUT_FILE.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [build_row(row) for row in csv.DictReader(handle)]
    merged = {row["date"]: row for row in rows if row.get("date")}
    model_end = max(merged) if merged else ""
    # The weekly model history has the complete metric set. Append only later
    # confirmed closes so the evidence page stays current between calibrations.
    merged.update({row["date"]: row for row in live_history_rows() if row["date"] > model_end})
    rows = [merged[key] for key in sorted(merged)]

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    latest = rows[-1] if rows else None
    return {
        "generatedAt": generated_at,
        "coverage": {
            "start": rows[0]["date"] if rows else None,
            "end": rows[-1]["date"] if rows else None,
            "tradingDays": len(rows),
        },
        "latest": latest,
        "series": rows,
        "definitions": {
            "dailyFrequency": "One row per U.S. trading day after the scheduled close update.",
            "pressureScore": "volatilityScore + creditScore + sentimentScore.",
            "breadth": "RSP minus SPY 60-day relative return; positive values indicate broader equal-weight leadership.",
            "drawdown": "Percentage distance from the trailing high for SPY or QQQ.",
        },
        "sources": [
            {"name": "Yahoo Finance", "fields": "SPY, QQQ, VIX, MOVE and ETF market prices"},
            {"name": "Federal Reserve Economic Data (FRED)", "fields": "HY/IG OAS and Treasury yields"},
            {"name": "CNN Fear & Greed", "fields": "fearGreed"},
            {"name": "Model pipeline", "fields": "scores, regime and allocation action"},
        ],
    }


def main() -> None:
    payload = build_payload()
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT_FILE.relative_to(ROOT)} | "
        f"tradingDays={payload['coverage']['tradingDays']} | end={payload['coverage']['end']}"
    )


if __name__ == "__main__":
    main()
