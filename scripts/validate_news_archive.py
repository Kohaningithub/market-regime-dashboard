"""Validate complete News reports and their generated archive index."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from .build_news_index import (
        FILE_RE,
        NEWS_DIR,
        OUT_FILE,
        SOURCE_RE,
        compact_text,
        parse_front_matter,
    )
except ImportError:
    from build_news_index import (
        FILE_RE,
        NEWS_DIR,
        OUT_FILE,
        SOURCE_RE,
        compact_text,
        parse_front_matter,
    )


ET = ZoneInfo("America/New_York")
SECTION_RE = re.compile(r"^#{1,3}\s*(?P<number>10|[1-9])(?:[.)、]|\s)", re.MULTILINE)
REQUIRED_FRONT_MATTER = ("title", "summary", "generatedAt")


def validate_generated_at(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def validate_report(path: Path) -> list[str]:
    errors: list[str] = []
    match = FILE_RE.match(path.name)
    if not match:
        return [f"{path.name}: filename must be YYYY-MM-DD_morning.md or YYYY-MM-DD_close.md"]

    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as error:
        return [f"{path.name}: cannot read report ({error})"]

    metadata, body = parse_front_matter(text)
    for key in REQUIRED_FRONT_MATTER:
        if not metadata.get(key):
            errors.append(f"{path.name}: missing front matter field {key}")
    if metadata.get("generatedAt") and not validate_generated_at(metadata["generatedAt"]):
        errors.append(f"{path.name}: generatedAt is not valid ISO 8601")

    if "Dashboard Context" not in body:
        errors.append(f"{path.name}: missing Dashboard Context")
    sections = {int(item) for item in SECTION_RE.findall(body)}
    missing_sections = sorted(set(range(1, 11)) - sections)
    if missing_sections:
        errors.append(f"{path.name}: missing numbered sections {missing_sections}")

    source_count = len(SOURCE_RE.findall(body))
    if source_count < 4:
        errors.append(f"{path.name}: expected at least 4 machine-readable source blocks, found {source_count}")
    if len(compact_text(body)) < 1000:
        errors.append(f"{path.name}: report is too short to be a complete brief")
    if "不构成投资建议" not in body:
        errors.append(f"{path.name}: missing investment-advice disclaimer")
    return errors


def validate_index(report_paths: list[Path]) -> list[str]:
    if not OUT_FILE.exists():
        return ["data/news_index.json is missing"]
    try:
        payload = json.loads(OUT_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"data/news_index.json is invalid ({error})"]

    expected_ids = {path.stem for path in report_paths}
    actual_ids = {entry.get("id") for entry in payload.get("entries", [])}
    if expected_ids == actual_ids:
        return []
    return [
        "news index mismatch: "
        f"missing={sorted(expected_ids - actual_ids)} extra={sorted(actual_ids - expected_ids)}"
    ]


def expected_current_report() -> Path:
    now = datetime.now(ET)
    edition = "morning" if now.hour < 14 else "close"
    return NEWS_DIR / f"{now.date().isoformat()}_{edition}.md"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path, help="Validate one report without checking the archive index.")
    parser.add_argument(
        "--require-current-window",
        action="store_true",
        help="Require today's morning report before 14:00 ET or close report after 14:00 ET.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.file:
        report_paths = [args.file.resolve()]
        errors = validate_report(report_paths[0])
    else:
        report_paths = sorted(path for path in NEWS_DIR.glob("*.md") if FILE_RE.match(path.name))
        errors = [error for path in report_paths for error in validate_report(path)]
        errors.extend(validate_index(report_paths))

    if args.require_current_window:
        expected = expected_current_report()
        if not expected.exists():
            errors.append(f"required report is missing: {expected.name}")
        elif expected not in report_paths:
            errors.extend(validate_report(expected))

    if errors:
        print("News archive validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"News archive validation passed | reports={len(report_paths)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
