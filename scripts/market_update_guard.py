"""Skip redundant scheduled dashboard refreshes once a market window is fresh."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LATEST = ROOT / "data" / "latest.json"
ET = ZoneInfo("America/New_York")
WINDOW_STARTS = {
    "morning": time(9, 40),
    "close": time(16, 40),
}


def parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(ET)


def is_window_fresh(latest_file: Path, window: str, now: datetime) -> bool:
    if window not in WINDOW_STARTS or not latest_file.exists():
        return False

    try:
        payload = json.loads(latest_file.read_text(encoding="utf-8"))
        generated_et = parse_timestamp(str(payload["generatedAt"]))
    except (KeyError, OSError, ValueError, json.JSONDecodeError):
        return False

    now_et = now.astimezone(ET)
    return (
        generated_et.date() == now_et.date()
        and generated_et.time().replace(tzinfo=None) >= WINDOW_STARTS[window]
    )


def classify_schedule(schedule: str) -> str:
    if not schedule:
        return "manual"
    fields = schedule.split()
    if len(fields) != 5:
        raise ValueError(f"Unsupported cron schedule: {schedule}")
    # GitHub cron allows lists and ranges (for example, "13-15"). Every
    # current range belongs to one logical window, so its first hour is enough
    # to classify the retry.
    hour = int(fields[1].split(",", 1)[0].split("-", 1)[0])
    weekday = fields[4]
    if weekday == "0":
        return "history"
    return "morning" if hour < 18 else "close"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schedule", default="", help="GitHub event schedule string; empty means manual.")
    parser.add_argument("--latest", type=Path, default=DEFAULT_LATEST)
    parser.add_argument("--now", help="Optional ISO timestamp for deterministic tests.")
    parser.add_argument("--github-output", type=Path, help="Write decision fields for GitHub Actions.")
    parser.add_argument(
        "--force-history",
        action="store_true",
        help="Run the full historical calibration during a manual refresh.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    now = parse_timestamp(args.now) if args.now else datetime.now(ET)
    window = classify_schedule(args.schedule)
    # All analysis visualizations consume the five-year history, so refresh it
    # after each confirmed close instead of leaving charts stale until Sunday.
    refresh_history = window in {"close", "history"} or args.force_history
    full_history = window == "history" or args.force_history
    now_et = now.astimezone(ET)
    within_window = window not in WINDOW_STARTS or now_et.time().replace(tzinfo=None) >= WINDOW_STARTS[window]
    should_run = window in {"manual", "history"} or (within_window and not is_window_fresh(args.latest, window, now))

    decision = {
        "window": window,
        "should_run": str(should_run).lower(),
        "refresh_history": str(refresh_history).lower(),
        "full_history": str(full_history).lower(),
    }
    if args.github_output:
        args.github_output.parent.mkdir(parents=True, exist_ok=True)
        with args.github_output.open("a", encoding="utf-8") as handle:
            for key, value in decision.items():
                handle.write(f"{key}={value}\n")

    print(
        f"Market update decision | window={window} | should_run={decision['should_run']} | "
        f"refresh_history={decision['refresh_history']} | full_history={decision['full_history']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
