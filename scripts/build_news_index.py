"""Build the static News archive index from complete Markdown briefs."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
NEWS_DIR = ROOT / "data" / "news"
OUT_FILE = ROOT / "data" / "news_index.json"
FILE_RE = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})_(?P<edition>morning|close)\.md$")
SOURCE_RE = re.compile(r"\[\[SOURCE\|[^|\]]+\|[^|\]]+\|[^|\]]+\|https?://[^\]]+\]\]")
HEADING_RE = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)
MARKUP_RE = re.compile(r"[*_`>#|\[\]()]")


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    lines = text.replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return {}, text

    metadata: dict[str, str] = {}
    end = None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end = index
            break
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"').strip("'")
    if end is None:
        return {}, text
    return metadata, "\n".join(lines[end + 1 :]).strip()


def compact_text(value: str) -> str:
    value = SOURCE_RE.sub("", value)
    value = MARKUP_RE.sub("", value)
    return re.sub(r"\s+", " ", value).strip()


def extract_title(body: str, date: str, edition: str, metadata: dict[str, str]) -> str:
    if metadata.get("title"):
        return metadata["title"]
    match = HEADING_RE.search(body)
    if match:
        return compact_text(match.group(1))
    label = "早盘" if edition == "morning" else "收盘"
    return f"{date} {label}投资动态简报"


def extract_summary(body: str, metadata: dict[str, str]) -> str:
    if metadata.get("summary"):
        return metadata["summary"]
    for raw_line in body.splitlines():
        line = compact_text(raw_line)
        if not line or line.lower() == "dashboard context":
            continue
        line = re.sub(r"^-\s*", "", line)
        line = re.sub(r"^(?:宏观主线|市场主线)[:：]\s*", "", line)
        if len(line) >= 24:
            return f"{line[:116]}{'…' if len(line) > 116 else ''}"
    return "完整市场简报与来源归档。"


def iso_generated_at(path: Path, metadata: dict[str, str]) -> str:
    raw = metadata.get("generatedAt") or metadata.get("generated_at")
    if raw:
        return raw
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_entry(path: Path) -> dict[str, Any] | None:
    match = FILE_RE.match(path.name)
    if not match:
        return None
    text = path.read_text(encoding="utf-8-sig")
    metadata, body = parse_front_matter(text)
    date = match.group("date")
    edition = match.group("edition")
    clean_body = compact_text(body)
    return {
        "id": path.stem,
        "date": date,
        "edition": edition,
        "title": extract_title(body, date, edition, metadata),
        "summary": extract_summary(body, metadata),
        "generatedAt": iso_generated_at(path, metadata),
        "path": path.relative_to(ROOT).as_posix(),
        "wordCount": len(clean_body),
        "sourceCount": len(SOURCE_RE.findall(body)),
    }


def build_index() -> dict[str, Any]:
    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    entries = [entry for path in NEWS_DIR.glob("*.md") if (entry := build_entry(path))]
    entries.sort(key=lambda entry: (entry["date"], entry["edition"] == "close", entry["generatedAt"]), reverse=True)
    dates = sorted({entry["date"] for entry in entries})
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "generatedAt": now,
        "entries": entries,
        "coverage": {
            "start": dates[0] if dates else None,
            "end": dates[-1] if dates else None,
            "dates": len(dates),
            "reports": len(entries),
        },
    }


def main() -> None:
    payload = build_index()
    if OUT_FILE.exists():
        try:
            current = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            current = {}
        if current.get("entries") == payload["entries"] and current.get("coverage") == payload["coverage"]:
            print(f"Unchanged {OUT_FILE.relative_to(ROOT)} | reports={payload['coverage']['reports']}")
            return
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)} | reports={payload['coverage']['reports']}")


if __name__ == "__main__":
    main()
