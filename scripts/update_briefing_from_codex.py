"""Publish a compact briefing JSON from local Codex investment brief memories.

This is intended for the local Codex automation publisher. GitHub Actions
cannot see the user's local Codex automation files, so this script runs locally
and writes data/briefing.json for the static site to read.
"""

from __future__ import annotations

import json
import re
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "briefing.json"
AUTOMATIONS_DIR = Path.home() / ".codex" / "automations"
KEYWORDS = ("投资", "简报", "动态")


@dataclass
class MemoryDoc:
    name: str
    automation_id: str
    updated_at: float
    text: str


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
        docs.append(
            MemoryDoc(
                name=name,
                automation_id=str(meta.get("id") or folder.name),
                updated_at=memory_path.stat().st_mtime,
                text=text,
            )
        )

    return sorted(docs, key=lambda doc: doc.updated_at, reverse=True)


def clean_bullet(line: str) -> str:
    return re.sub(r"^\s*[-*]\s+", "", line).strip()


def bullet_lines(text: str) -> list[str]:
    bullets = [clean_bullet(line) for line in text.splitlines() if re.match(r"^\s*[-*]\s+", line)]
    return [
        bullet
        for bullet in bullets
        if not bullet.lower().startswith(("runtime:", "run time:", "generated at:", "last updated:"))
    ]


def title_for(text: str) -> str:
    pairs = [
        ("mainline", "市场主线"),
        ("主线", "市场主线"),
        ("Macro", "宏观数据"),
        ("宏观", "宏观数据"),
        ("Market reaction", "市场反应"),
        ("市场反应", "市场反应"),
        ("gainers", "上涨线索"),
        ("大涨", "上涨线索"),
        ("laggards", "风险信号"),
        ("大跌", "风险信号"),
        ("Structure", "市场结构"),
        ("资金", "市场结构"),
        ("Hidden", "隐藏信号"),
        ("隐藏", "隐藏信号"),
        ("Follow-up", "后续关注"),
        ("跟踪", "后续关注"),
    ]
    lowered = text.lower()
    for needle, title in pairs:
        if needle.lower() in lowered:
            return title
    if "：" in text:
        return text.split("：", 1)[0][:18]
    if ":" in text:
        return text.split(":", 1)[0][:18]
    return text[:18]


def impact_for(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ("ppi", "cpi", "jobless", "10y", "ust", "rates", "yield", "初请", "通胀", "利率")):
        return "影响利率路径、估值折现和成长股风险偏好。"
    if any(token in lowered for token in ("ai", "semiconductor", "semi", "tech", "oracle", "nvda", "smci", "半导体", "科技")):
        return "影响科技成长主线和高 beta 风险偏好。"
    if any(token in lowered for token in ("oil", "wti", "brent", "iran", "energy", "油", "伊朗", "能源")):
        return "影响通胀预期、能源板块和避险需求。"
    if any(token in lowered for token in ("credit", "spread", "hyg", "jnk", "etf", "option", "flow", "信用", "期权", "资金")):
        return "帮助验证风险偏好是否扩散到信用和市场结构。"
    if any(token in lowered for token in ("risk", "drawdown", "跌", "弱势", "压力")):
        return "提示需要观察风险是否从个股扩散到行业或宏观层面。"
    return "作为定性背景，辅助解释量化指标的变化。"


def build_briefing() -> dict[str, Any]:
    docs = load_memory_docs()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    source_docs = docs[:2]
    bullets: list[tuple[MemoryDoc, str]] = []
    for doc in source_docs:
        bullets.extend((doc, bullet) for bullet in bullet_lines(doc.text))

    items = [
        {
            "title": title_for(text),
            "detail": text,
            "impact": impact_for(text),
            "sourceLabel": doc.name,
            "sourceUrl": "",
        }
        for doc, text in bullets[:6]
    ]

    summary = "等待每日投资简报写入最新线索。"
    if items:
        summary = items[0]["detail"]

    return {
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "asOf": now.date().isoformat(),
        "source": "Codex 每日投资简报",
        "sourceAutomationIds": [doc.automation_id for doc in source_docs],
        "summary": summary,
        "items": items,
    }


def main() -> None:
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    briefing = build_briefing()
    OUT_FILE.write_text(json.dumps(briefing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)} | items={len(briefing['items'])}")


if __name__ == "__main__":
    main()
