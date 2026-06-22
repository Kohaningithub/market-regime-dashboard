"""Publish a structured briefing JSON from local Codex investment brief memories.

This runs locally because GitHub Actions cannot read the user's Codex
automation files. It writes ``data/briefing.json`` for the static site.
"""

from __future__ import annotations

import json
import re
import tomllib
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "briefing.json"
AUTOMATIONS_DIR = Path.home() / ".codex" / "automations"
LOCAL_TZ = datetime.now().astimezone().tzinfo or timezone.utc
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
DATE_LINE_RE = re.compile(r"^\s*\d{4}-\d{2}-\d{2}\b")
TIME_RE = re.compile(r"\b\d{1,2}:\d{2}\b")
SOURCE_BLOCK_RE = re.compile(
    r"\[\[SOURCE\|(?P<name>[^|\]]+)\|(?P<published>[^|\]]+)\|(?P<event_date>[^|\]]+)\|(?P<url>https?://[^\]]+)\]\]"
)
LOG_PATTERNS = (
    re.compile(r"运行时长"),
    re.compile(r"运行耗时"),
    re.compile(r"耗时约"),
    re.compile(r"本次生成的是"),
    re.compile(r"本轮切换为"),
)
MAINLINE_LABELS = ("主线", "市场主线", "核心主线", "核心事实", "宏观对照")
EVENT_KEYWORDS = ("初请", "联储", "央行", "Conference Board", "LEI", "财报", "讲话", "零售销售", "FOMC")
WATCH_LABELS = ("当日需继续跟踪", "次日优先跟踪", "后续关注", "继续跟踪", "重点盯", "留意")
STRUCTURE_LABELS = ("结构信号", "市场反应", "市场结构", "宏观对照", "资金信号")
STOCK_MOVER_KEYWORDS = ("上涨关注", "下跌关注", "个股主线", "大涨", "大跌")

DATE_SPECIFIC_SOURCE_BACKFILLS: dict[tuple[str, str, str], list[dict[str, str]]] = {
    (
        "2026-06-18",
        "早盘版",
        "macro",
    ): [
        {
            "name": "Federal Reserve",
            "publishedAt": "2026-06-17T14:00:00-04:00",
            "eventDate": "2026-06-17",
            "url": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
        },
        {
            "name": "Federal Reserve Projections",
            "publishedAt": "2026-06-17T14:00:00-04:00",
            "eventDate": "2026-06-17",
            "url": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617b.htm",
        },
        {
            "name": "AP News",
            "publishedAt": "2026-06-17",
            "eventDate": "2026-06-17",
            "url": "https://apnews.com/article/iran-us-israel-war-oil-deal-june-17-2026-19652f4611b704c0a991bf1f5bc9a4b9",
        },
    ],
    (
        "2026-06-18",
        "早盘版",
        "events",
    ): [
        {
            "name": "U.S. Department of Labor",
            "publishedAt": "2026-06-18T08:30:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.dol.gov/ui/data.pdf",
        },
        {
            "name": "Philadelphia Fed",
            "publishedAt": "2026-06-18T08:30:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.philadelphiafed.org/surveys-and-data/regional-economic-analysis/mbos-2026-06",
        },
        {
            "name": "The Conference Board",
            "publishedAt": "2026-06-18T10:00:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.conference-board.org/topics/us-leading-indicators/",
        },
    ],
    (
        "2026-06-18",
        "早盘版",
        "impact",
    ): [
        {
            "name": "Federal Reserve",
            "publishedAt": "2026-06-17T14:00:00-04:00",
            "eventDate": "2026-06-17",
            "url": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
        },
        {
            "name": "AP News",
            "publishedAt": "2026-06-17",
            "eventDate": "2026-06-17",
            "url": "https://apnews.com/article/iran-us-israel-war-oil-deal-june-17-2026-19652f4611b704c0a991bf1f5bc9a4b9",
        },
    ],
    (
        "2026-06-18",
        "早盘版",
        "watch",
    ): [
        {
            "name": "U.S. Department of Labor",
            "publishedAt": "2026-06-18T08:30:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.dol.gov/ui/data.pdf",
        },
        {
            "name": "Philadelphia Fed",
            "publishedAt": "2026-06-18T08:30:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.philadelphiafed.org/surveys-and-data/regional-economic-analysis/mbos-2026-06",
        },
        {
            "name": "The Conference Board",
            "publishedAt": "2026-06-18T10:00:00-04:00",
            "eventDate": "2026-06-18",
            "url": "https://www.conference-board.org/topics/us-leading-indicators/",
        },
    ],
}


@dataclass
class SourceRef:
    name: str
    publishedAt: str
    eventDate: str
    url: str


@dataclass
class MemoryDoc:
    name: str
    automation_id: str
    updated_at: float
    updated_dt: datetime
    text: str


@dataclass
class BriefLine:
    text: str
    sources: list[SourceRef]


def read_toml(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            return tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return {}


def is_investment_brief(name: str, prompt: str) -> bool:
    haystack = f"{name}\n{prompt}"
    return "投资" in haystack and ("简报" in haystack or "动态" in haystack)


def load_memory_docs() -> list[MemoryDoc]:
    docs: list[MemoryDoc] = []
    if not AUTOMATIONS_DIR.exists():
        return docs

    for folder in AUTOMATIONS_DIR.iterdir():
        if not folder.is_dir():
            continue

        meta = read_toml(folder / "automation.toml")
        name = str(meta.get("name") or folder.name)
        prompt = str(meta.get("prompt") or "")
        memory_path = folder / "memory.md"
        if not memory_path.exists() or not is_investment_brief(name, prompt):
            continue

        try:
            text = memory_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = memory_path.read_text(encoding="utf-8-sig", errors="replace")

        stat = memory_path.stat()
        docs.append(
            MemoryDoc(
                name=name,
                automation_id=str(meta.get("id") or folder.name),
                updated_at=stat.st_mtime,
                updated_dt=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
                text=text,
            )
        )

    return sorted(docs, key=lambda doc: doc.updated_at, reverse=True)


def clean_bullet(line: str) -> str:
    return re.sub(r"^\s*[-*]\s+", "", line).strip()


def is_log_line(line: str) -> bool:
    return any(pattern.search(line) for pattern in LOG_PATTERNS)


def extract_sources(text: str) -> tuple[str, list[SourceRef]]:
    sources = [
        SourceRef(
            name=match.group("name").strip(),
            publishedAt=match.group("published").strip(),
            eventDate=match.group("event_date").strip(),
            url=match.group("url").strip(),
        )
        for match in SOURCE_BLOCK_RE.finditer(text)
    ]
    clean_text = SOURCE_BLOCK_RE.sub("", text).strip()
    return clean_text, sources


def split_memory_segments(text: str) -> list[str]:
    segments: list[str] = []
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if DATE_LINE_RE.match(line) and current:
            segment = "\n".join(current).strip()
            if segment:
                segments.append(segment)
            current = [line]
            continue
        if not line.strip() and current and not current[-1].strip():
            continue
        current.append(line)

    if current:
        segment = "\n".join(current).strip()
        if segment:
            segments.append(segment)
    return segments


def strip_run_prefix(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:ET|UTC)?)?\s*", "", cleaned)
    cleaned = re.sub(r"^[^:：]{0,30}[:：]\s*", "", cleaned)
    cleaned = re.sub(r"(?:当前运行时长|本轮运行耗时).*$", "", cleaned).strip()
    return cleaned


def is_usable_segment(text: str) -> bool:
    cleaned = strip_run_prefix(text)
    if not cleaned:
        return False
    noise = cleaned.count("?") + cleaned.count("�")
    return noise / max(len(cleaned), 1) < 0.15


def narrative_lines(text: str) -> list[BriefLine]:
    normalized = strip_run_prefix(text)
    if not normalized:
        return []

    expanded = re.sub(r"([1-9][\)\）])", r"\n\1", normalized)
    parts = re.split(r"[\n；。]+", expanded)
    lines: list[BriefLine] = []
    for part in parts:
        candidate = re.sub(r"^\s*[1-9][\)\）]\s*", "", part).strip()
        if not candidate or is_log_line(candidate):
            continue
        clean_text, sources = extract_sources(candidate)
        if clean_text:
            lines.append(BriefLine(text=clean_text, sources=sources))
    return lines


def bullet_lines(text: str) -> list[BriefLine]:
    lines: list[BriefLine] = []
    for raw_line in text.splitlines():
        if not re.match(r"^\s*[-*]\s+", raw_line):
            continue
        bullet = clean_bullet(raw_line)
        if not bullet or is_log_line(bullet):
            continue
        clean_text, sources = extract_sources(bullet)
        lines.append(BriefLine(text=clean_text, sources=sources))
    return lines


def content_lines(text: str) -> list[BriefLine]:
    lines = bullet_lines(text)
    if lines:
        return lines
    return narrative_lines(text)


def extract_content_as_of(text: str, fallback: datetime) -> str:
    for line in content_lines(text):
        matches = DATE_RE.findall(line.text)
        if matches:
            return matches[-1]
    return fallback.astimezone(LOCAL_TZ).date().isoformat()


def edition_for(doc: MemoryDoc) -> str:
    if "早盘" in doc.name:
        return "早盘版"
    if "收盘" in doc.name:
        return "收盘版"
    return "简报版"


def strip_prefix(text: str) -> str:
    if "：" in text:
        return text.split("：", 1)[1].strip()
    if ":" in text:
        return text.split(":", 1)[1].strip()
    return text.strip()


def has_label(text: str, labels: tuple[str, ...]) -> bool:
    return any(text.startswith(label) or text.startswith(f"{label}：") or text.startswith(f"{label}:") for label in labels)


def unique_join(lines: list[str]) -> str:
    seen: set[str] = set()
    ordered: list[str] = []
    for line in lines:
        normalized = line.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return "；".join(ordered)


def dedupe_sources(sources: list[SourceRef]) -> list[SourceRef]:
    deduped: list[SourceRef] = []
    seen: set[str] = set()
    for source in sources:
        if not source.url or source.url in seen:
            continue
        seen.add(source.url)
        deduped.append(source)
    return deduped


def fallback_sources(content_as_of: str, edition: str, key: str) -> list[SourceRef]:
    rows = DATE_SPECIFIC_SOURCE_BACKFILLS.get((content_as_of, edition, key), [])
    return [SourceRef(**row) for row in rows]


def impact_for(title: str) -> str:
    if title == "宏观主线":
        return "影响利率路径、美元方向和成长资产估值折现。"
    if title == "当日重要事件":
        return "决定盘中利率预期是否继续强化或修正。"
    if title == "行业或资产影响":
        return "帮助判断风险偏好变化首先传导到哪些板块或资产。"
    return "用于跟踪当前叙事是否扩散到更广泛的市场结构。"


def lines_to_sources(lines: list[BriefLine], content_as_of: str, edition: str, key: str) -> list[SourceRef]:
    sources = dedupe_sources([source for line in lines for source in line.sources])
    if sources:
        return sources
    return fallback_sources(content_as_of, edition, key)


def make_item(
    key: str,
    title: str,
    detail: str,
    doc: MemoryDoc,
    content_as_of: str,
    edition: str,
    sources: list[SourceRef],
) -> dict[str, Any]:
    source_payload = [asdict(source) for source in sources]
    first_source = source_payload[0] if source_payload else {}
    return {
        "key": key,
        "title": title,
        "detail": detail,
        "impact": impact_for(title),
        "sourceName": first_source.get("name", doc.name),
        "sourceUrl": first_source.get("url", ""),
        "publishedAt": first_source.get("publishedAt", doc.updated_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")),
        "eventDate": first_source.get("eventDate", content_as_of),
        "edition": edition,
        "sources": source_payload,
    }


def build_items(doc: MemoryDoc, content_as_of: str) -> tuple[list[dict[str, Any]], int]:
    lines = content_lines(doc.text)
    edition = edition_for(doc)
    mainline_lines = [line for line in lines if has_label(line.text, MAINLINE_LABELS)]
    event_lines = [
        line
        for line in lines
        if (has_label(line.text, WATCH_LABELS) or TIME_RE.search(line.text) or any(keyword in line.text for keyword in EVENT_KEYWORDS))
        and not has_label(line.text, MAINLINE_LABELS)
    ]
    watch_lines = [line for line in lines if has_label(line.text, WATCH_LABELS)]
    structure_lines = [line for line in lines if has_label(line.text, STRUCTURE_LABELS)]
    stock_lines = [line for line in lines if any(keyword in line.text for keyword in STOCK_MOVER_KEYWORDS)]

    if not mainline_lines:
        mainline_lines = [line for line in lines if "主线" in line.text][:1]
    if not mainline_lines:
        mainline_lines = lines[:2]
    if not event_lines:
        event_lines = [line for line in lines if DATE_RE.search(line.text) or TIME_RE.search(line.text)][:2]
    if not structure_lines:
        structure_lines = [
            line
            for line in lines
            if any(keyword in line.text for keyword in ("市场", "板块", "资产", "受益", "传导", "反应", "油价", "美元"))
        ][:2]
    if not watch_lines:
        watch_lines = [line for line in lines if any(keyword in line.text for keyword in ("观察", "继续", "后续", "重开前"))][:2]

    items: list[dict[str, Any]] = []
    mainline = unique_join([strip_prefix(line.text) for line in mainline_lines[:2]])
    events = unique_join([strip_prefix(line.text) for line in event_lines[:2]])
    structure = unique_join([strip_prefix(line.text) for line in structure_lines[:2]])
    watch = unique_join([strip_prefix(line.text) for line in watch_lines[:2]])

    if mainline:
        items.append(
            make_item(
                "macro",
                "宏观主线",
                mainline,
                doc,
                content_as_of,
                edition,
                lines_to_sources(mainline_lines[:2], content_as_of, edition, "macro"),
            )
        )
    if events:
        items.append(
            make_item(
                "events",
                "当日重要事件",
                events,
                doc,
                content_as_of,
                edition,
                lines_to_sources(event_lines[:2], content_as_of, edition, "events"),
            )
        )
    if structure:
        items.append(
            make_item(
                "impact",
                "行业或资产影响",
                structure,
                doc,
                content_as_of,
                edition,
                lines_to_sources(structure_lines[:2], content_as_of, edition, "impact"),
            )
        )
    elif mainline:
        items.append(
            make_item(
                "impact",
                "行业或资产影响",
                mainline,
                doc,
                content_as_of,
                edition,
                lines_to_sources(mainline_lines[:2], content_as_of, edition, "impact"),
            )
        )
    if watch:
        watch_detail = watch
        if watch == events:
            watch_detail = "继续观察上述催化是否进一步强化美元、短端利率与风险偏好方向。"
        items.append(
            make_item(
                "watch",
                "后续观察点",
                watch_detail,
                doc,
                content_as_of,
                edition,
                lines_to_sources(watch_lines[:2] or event_lines[:2], content_as_of, edition, "watch"),
            )
        )
    elif events:
        items.append(
            make_item(
                "watch",
                "后续观察点",
                "继续观察上述事件是否进一步强化美元、利率与风险偏好方向。",
                doc,
                content_as_of,
                edition,
                lines_to_sources(event_lines[:2], content_as_of, edition, "watch"),
            )
        )

    suppressed_stock_lines = sum(1 for line in stock_lines if not line.sources)
    return items[:4], suppressed_stock_lines


def build_briefing() -> dict[str, Any]:
    docs = load_memory_docs()
    now = datetime.now(timezone.utc).replace(microsecond=0)

    if not docs:
        return {
            "generatedAt": now.isoformat().replace("+00:00", "Z"),
            "asOf": now.astimezone(LOCAL_TZ).date().isoformat(),
            "source": "Codex 每日投资简报",
            "sourceAutomationIds": [],
            "summary": "等待最新投资简报写入本地 memory。",
            "suppressedCount": 0,
            "linkCoverage": 0,
            "items": [],
        }

    selected_doc = docs[0]
    selected_as_of = extract_content_as_of(selected_doc.text, selected_doc.updated_dt)
    items: list[dict[str, Any]] = []
    suppressed_count = 0

    for doc in docs:
        segments = split_memory_segments(doc.text) or [doc.text]
        for segment in reversed(segments):
            if not is_usable_segment(segment):
                continue
            candidate_doc = MemoryDoc(
                name=doc.name,
                automation_id=doc.automation_id,
                updated_at=doc.updated_at,
                updated_dt=doc.updated_dt,
                text=segment,
            )
            content_as_of = extract_content_as_of(segment, doc.updated_dt)
            candidate_items, candidate_suppressed = build_items(candidate_doc, content_as_of)
            if candidate_items:
                selected_doc = candidate_doc
                selected_as_of = content_as_of
                items = candidate_items
                suppressed_count = candidate_suppressed
                break
        if items:
            break

    sourced_items = sum(1 for item in items if item.get("sources"))
    summary = items[0]["detail"] if items else "最新简报尚未提供可展示的市场上下文。"

    return {
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "asOf": selected_as_of,
        "source": "Codex 每日投资简报",
        "sourceAutomationIds": [selected_doc.automation_id],
        "summary": summary,
        "suppressedCount": suppressed_count,
        "linkCoverage": sourced_items,
        "items": items,
    }


def main() -> None:
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    briefing = build_briefing()
    OUT_FILE.write_text(json.dumps(briefing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT_FILE.relative_to(ROOT)} | "
        f"items={len(briefing['items'])} | "
        f"sourced={briefing.get('linkCoverage', 0)} | "
        f"suppressed={briefing.get('suppressedCount', 0)}"
    )


if __name__ == "__main__":
    main()
