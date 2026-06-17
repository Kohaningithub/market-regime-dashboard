#!/usr/bin/env python3
"""Generate data/latest.json for the Market Regime Dashboard.

The script intentionally uses public, no-key endpoints so it can run from
GitHub Actions and publish a static JSON snapshot to GitHub Pages.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
import sys
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "latest.json"
HISTORY_FILE = ROOT / "data" / "history.json"
MAX_HISTORY_ENTRIES = 1200
USER_AGENT = "Mozilla/5.0 market-regime-dashboard/1.0"
CNN_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)


@dataclass
class DataPoint:
    value: float
    as_of: str
    source: str
    status: str = "ok"
    note: str | None = None


def fetch_text(url: str, timeout: int = 35, retries: int = 3, headers: dict[str, str] | None = None) -> str:
    last_error: Exception | None = None
    request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        request_headers.update(headers)
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers=request_headers)
            with urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"Fetch failed for {url}: {last_error}")


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if math.isnan(float(value)):
            return None
        return float(value)
    text = str(value).strip().replace(",", "").replace("%", "")
    if not text or text == ".":
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    if math.isnan(parsed):
        return None
    return parsed


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def round_value(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def fred_series(series_id: str, start_days: int = 150) -> list[tuple[str, float]]:
    start = (date.today() - timedelta(days=start_days)).isoformat()
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}"
    text = fetch_text(url)
    rows: list[tuple[str, float]] = []
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        value = parse_float(row.get(series_id))
        if value is not None:
            rows.append((row["observation_date"], value))
    if not rows:
        raise RuntimeError(f"No FRED data for {series_id}")
    return rows


def yahoo_series(symbol: str, range_: str = "1y") -> list[tuple[str, float]]:
    encoded = quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range={range_}&interval=1d&events=history"
    data = json.loads(fetch_text(url))
    result = (data.get("chart", {}).get("result") or [None])[0]
    if not result:
        raise RuntimeError(f"No Yahoo chart result for {symbol}")

    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    adjclose = ((indicators.get("adjclose") or [{}])[0].get("adjclose") or [])
    close = ((indicators.get("quote") or [{}])[0].get("close") or [])
    values = adjclose if any(value is not None for value in adjclose) else close

    rows: list[tuple[str, float]] = []
    for timestamp, raw_value in zip(timestamps, values):
        value = parse_float(raw_value)
        if value is None:
            continue
        as_of = datetime.fromtimestamp(int(timestamp), UTC).date().isoformat()
        rows.append((as_of, value))

    if not rows:
        raise RuntimeError(f"No Yahoo prices for {symbol}")
    return rows


def latest(rows: list[tuple[str, float]]) -> tuple[str, float]:
    return rows[-1]


def previous(rows: list[tuple[str, float]], periods: int) -> tuple[str, float]:
    if len(rows) <= periods:
        return rows[0]
    return rows[-1 - periods]


def pct_return(rows: list[tuple[str, float]], periods: int) -> float:
    _, now = latest(rows)
    _, then = previous(rows, periods)
    return (now / then - 1) * 100


def drawdown_from_high(rows: list[tuple[str, float]], lookback: int = 252) -> float:
    recent = rows[-lookback:] if len(rows) >= lookback else rows
    _, now = latest(recent)
    high = max(value for _, value in recent)
    return (now / high - 1) * 100


def relative_return(a_rows: list[tuple[str, float]], b_rows: list[tuple[str, float]], periods: int) -> float:
    count = min(len(a_rows), len(b_rows))
    if count <= periods:
        periods = max(count - 1, 1)
    a_now = a_rows[-1][1]
    b_now = b_rows[-1][1]
    a_then = a_rows[-1 - periods][1]
    b_then = b_rows[-1 - periods][1]
    return ((a_now / b_now) / (a_then / b_then) - 1) * 100


def threshold_score(value: float, thresholds: list[float], direction: str = "above") -> int:
    score = 0
    for threshold in thresholds:
        if direction == "above" and value > threshold:
            score += 1
        if direction == "below" and value < threshold:
            score += 1
    return score


def scale_inverse(value: float, low_good: float, high_bad: float) -> float:
    return clamp(100 - ((value - low_good) / (high_bad - low_good) * 100))


def scale_direct(value: float, low_bad: float, high_good: float) -> float:
    return clamp((value - low_bad) / (high_good - low_bad) * 100)


def fetch_aaii_bearish() -> DataPoint:
    html = fetch_text("https://www.aaii.com/sentimentsurvey/sent_results")
    row_pattern = re.compile(
        r'<td[^>]*class="tableTxt"[^>]*>\s*([A-Z][a-z]{2}\s+\d{1,2})\s*</td>\s*'
        r'<td[^>]*class="tableTxt"[^>]*>\s*([\d.]+)%?\s*</td>\s*'
        r'<td[^>]*class="tableTxt"[^>]*>\s*([\d.]+)%?\s*</td>\s*'
        r'<td[^>]*class="tableTxt"[^>]*>\s*([\d.]+)%?\s*</td>',
        re.IGNORECASE | re.DOTALL,
    )
    match = row_pattern.search(html)
    if not match:
        raise RuntimeError("Unable to parse AAII sentiment table")

    date_text, _bullish, _neutral, bearish = match.groups()
    today = date.today()
    parsed = datetime.strptime(f"{date_text} {today.year}", "%b %d %Y").date()
    if parsed > today + timedelta(days=10):
        parsed = parsed.replace(year=today.year - 1)

    return DataPoint(
        value=float(bearish),
        as_of=parsed.isoformat(),
        source="AAII Sentiment Survey",
    )


def fetch_put_call_ratio() -> DataPoint:
    html = fetch_text("https://www.cboe.com/markets/us/options/market-statistics/daily/")
    match = re.search(r'EQUITY PUT/CALL RATIO\\",\\"value\\":\\"([0-9.]+)\\"', html)
    if not match:
        match = re.search(r'EQUITY PUT/CALL RATIO.{0,200}?([0-9]+\\.[0-9]+)', html)
    if not match:
        raise RuntimeError("Unable to parse Cboe equity put/call ratio")
    return DataPoint(
        value=float(match.group(1)),
        as_of=date.today().isoformat(),
        source="Cboe Daily Market Statistics",
        note="Current daily equity put/call ratio; public Cboe history endpoint currently stops at 2019.",
    )


def fetch_cnn_fear_greed() -> DataPoint:
    data = json.loads(
        fetch_text(
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            headers={
                "User-Agent": CNN_USER_AGENT,
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://www.cnn.com/markets/fear-and-greed",
                "Origin": "https://www.cnn.com",
            },
        )
    )
    current = data.get("fear_and_greed") or {}
    score = parse_float(current.get("score"))
    if score is None:
        raise RuntimeError("CNN Fear & Greed response did not include a numeric score")

    timestamp = current.get("timestamp") or datetime.now(UTC).replace(microsecond=0).isoformat()
    return DataPoint(
        value=round_value(score, 0),
        as_of=str(timestamp),
        source="CNN Fear & Greed Index",
        note=None,
    )


def fear_greed_proxy(values: dict[str, float], aaii: float, put_call: float) -> DataPoint:
    components = [
        scale_inverse(values["vix"], 12, 45),
        scale_direct(values["spyDrawdown"], -22, 0),
        scale_inverse(put_call, 0.5, 1.1),
        scale_direct(values["hygRet20d"], -8, 2),
        scale_direct(values["rspSpyRel60d"], -8, 3),
        scale_inverse(aaii, 25, 65),
    ]
    proxy = sum(components) / len(components)
    return DataPoint(
        value=round_value(proxy, 0),
        as_of=date.today().isoformat(),
        source="Fear & Greed proxy",
        status="estimated",
        note="CNN endpoint blocks automated requests; proxy blends VIX, SPY drawdown, Put/Call, HYG, RSP/SPY, and AAII.",
    )


def calculate_scores(values: dict[str, float]) -> dict[str, int]:
    volatility = (
        threshold_score(values["vix"], [20, 25, 35, 45])
        + threshold_score(values["vixChange5d"], [5, 10])
        + threshold_score(values["move"], [120, 160])
    )

    sentiment = (
        threshold_score(values["fearGreed"], [40, 25, 15], "below")
        + threshold_score(values["aaiiBearish"], [40, 50, 60])
        + threshold_score(values["putCall"], [0.75, 0.9])
    )

    credit = (
        threshold_score(values["hygRet20d"], [-3, -5], "below")
        + threshold_score(values["jnkRet20d"], [-3, -5], "below")
        + threshold_score(values["hyOas"], [4.5, 6])
        + threshold_score(values["hyOasChange20d"], [75, 150])
        + threshold_score(values["igOas"], [1.25, 1.75])
        + threshold_score(values["igOasChange20d"], [25, 60])
        + threshold_score(values["dxyChange20d"], [3, 5])
        + threshold_score(values["nfci"], [0, 0.5])
        + threshold_score(values["kreRel20d"], [-8, -15], "below")
    )

    return {"volatility": volatility, "credit": credit, "sentiment": sentiment}


def has_systemic_cluster(values: dict[str, float], credit_score: int) -> bool:
    cluster_signals = [
        values["hygRet20d"] <= -5,
        values["jnkRet20d"] <= -5,
        values["hyOasChange20d"] >= 75,
        values["igOasChange20d"] >= 25,
        values["dxyChange20d"] >= 3,
        values["nfci"] > 0,
        values["kreRel20d"] <= -8,
        values["move"] >= 160,
    ]
    return credit_score >= 4 and sum(cluster_signals) >= 3


def classify(values: dict[str, float], scores: dict[str, int]) -> dict[str, Any]:
    overheated = (
        values["fearGreed"] > 75
        and values["putCall"] < 0.55
        and values["rspSpyRel60d"] < -3
    )

    if scores["credit"] >= 6 or has_systemic_cluster(values, scores["credit"]):
        return {
            "key": "defensive",
            "title": "系统性风险",
            "summary": "信用压力优先级最高。股市下跌同时伴随信用、银行、美元或美债波动恶化时，先降低风险敞口，不急着抄底。",
            "tone": "danger",
            "overheated": overheated,
        }

    if (
        scores["credit"] <= 3
        and (scores["volatility"] >= 5 or values["vix"] >= 35 or scores["sentiment"] >= 5)
        and (values["spyDrawdown"] <= -12 or values["qqqDrawdown"] <= -18)
    ):
        return {
            "key": "extreme",
            "title": "极端恐慌",
            "summary": "波动率和情绪已经极端，但信用市场尚未失控。可以开始关注抄底窗口，执行上仍应分批和控制仓位。",
            "tone": "danger",
            "overheated": overheated,
        }

    if (
        scores["credit"] <= 3
        and scores["volatility"] >= 3
        and scores["sentiment"] >= 3
        and (values["spyDrawdown"] <= -8 or values["qqqDrawdown"] <= -12)
    ):
        return {
            "key": "panic",
            "title": "恐慌回调",
            "summary": "市场情绪进入恐惧区，指数回调较深，但信用和美元流动性尚未出现失序信号。适合按计划分批加仓。",
            "tone": "warning",
            "overheated": overheated,
        }

    return {
        "key": "normal",
        "title": "正常或温和回调",
        "summary": "信用市场稳定，波动率未进入失控区。若指数只是普通调整，可以维持正常定投和再平衡纪律。",
        "tone": "calm",
        "overheated": overheated,
    }


def data_point(value: float, as_of: str, source: str, status: str = "ok", note: str | None = None) -> DataPoint:
    return DataPoint(round_value(value), as_of, source, status, note)


def load_history() -> dict[str, Any]:
    if not HISTORY_FILE.exists():
        return {"generatedAt": None, "entries": []}

    try:
        raw = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"generatedAt": None, "entries": []}

    if isinstance(raw, list):
        entries = raw
        generated_at = None
    elif isinstance(raw, dict):
        entries = raw.get("entries") or []
        generated_at = raw.get("generatedAt")
    else:
        return {"generatedAt": None, "entries": []}

    clean_entries = [entry for entry in entries if isinstance(entry, dict)]
    return {"generatedAt": generated_at, "entries": clean_entries}


def build_history_entry(snapshot: dict[str, Any], spy_close: float) -> dict[str, Any]:
    estimated_count = sum(1 for meta in snapshot.get("fieldMeta", {}).values() if meta.get("status") != "ok")
    return {
        "generatedAt": snapshot["generatedAt"],
        "asOf": snapshot["asOf"],
        "regime": snapshot["regime"]["key"],
        "regimeTitle": snapshot["regime"]["title"],
        "scores": snapshot["scores"],
        "spyClose": round_value(spy_close, 2),
        "spyDrawdown": snapshot["values"]["spyDrawdown"],
        "qqqDrawdown": snapshot["values"]["qqqDrawdown"],
        "fearGreed": snapshot["values"]["fearGreed"],
        "rspSpyRel60d": snapshot["values"]["rspSpyRel60d"],
        "estimatedCount": estimated_count,
        "valuationInScore": bool(snapshot.get("modelMeta", {}).get("valuationInScore")),
    }


def write_history(snapshot: dict[str, Any], spy_close: float) -> dict[str, Any]:
    history = load_history()
    entries = history["entries"]
    entry = build_history_entry(snapshot, spy_close)

    if entries and entries[-1].get("generatedAt") == entry["generatedAt"]:
        entries[-1] = entry
    else:
        entries.append(entry)

    if len(entries) > MAX_HISTORY_ENTRIES:
        entries = entries[-MAX_HISTORY_ENTRIES:]

    payload = {
        "generatedAt": snapshot["generatedAt"],
        "entries": entries,
    }
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def build_snapshot() -> tuple[dict[str, Any], float]:
    notes: list[str] = []
    fields: dict[str, DataPoint] = {}

    fred_ids = {
        "hyOas": "BAMLH0A0HYM2",
        "igOas": "BAMLC0A0CM",
        "tenYYield": "DGS10",
        "realTenY": "DFII10",
        "nfci": "NFCI",
    }
    fred = {name: fred_series(series_id) for name, series_id in fred_ids.items()}

    yahoo_symbols = {
        "vix": "^VIX",
        "spy": "SPY",
        "qqq": "QQQ",
        "hyg": "HYG",
        "jnk": "JNK",
        "kre": "KRE",
        "rsp": "RSP",
        "dxy": "DX-Y.NYB",
        "move": "^MOVE",
    }
    yahoo = {name: yahoo_series(symbol) for name, symbol in yahoo_symbols.items()}

    vix_date, vix_value = latest(yahoo["vix"])
    fields["vix"] = data_point(vix_value, vix_date, "Yahoo Finance ^VIX / Cboe VIX")
    fields["vixChange5d"] = data_point(
        vix_value - previous(yahoo["vix"], 5)[1],
        vix_date,
        "Yahoo Finance ^VIX / Cboe VIX",
    )

    move_date, move_value = latest(yahoo["move"])
    fields["move"] = data_point(move_value, move_date, "Yahoo Finance ^MOVE / ICE BofA MOVE Index")

    spy_date, spy_value = latest(yahoo["spy"])
    qqq_date, _qqq_value = latest(yahoo["qqq"])
    fields["spyDrawdown"] = data_point(drawdown_from_high(yahoo["spy"]), spy_date, "Yahoo Finance SPY")
    fields["qqqDrawdown"] = data_point(drawdown_from_high(yahoo["qqq"]), qqq_date, "Yahoo Finance QQQ")
    fields["rspSpyRel60d"] = data_point(
        relative_return(yahoo["rsp"], yahoo["spy"], 60),
        latest(yahoo["rsp"])[0],
        "Yahoo Finance RSP/SPY",
    )

    fields["hygRet20d"] = data_point(pct_return(yahoo["hyg"], 20), latest(yahoo["hyg"])[0], "Yahoo Finance HYG")
    fields["jnkRet20d"] = data_point(pct_return(yahoo["jnk"], 20), latest(yahoo["jnk"])[0], "Yahoo Finance JNK")

    hy_date, hy_oas = latest(fred["hyOas"])
    fields["hyOas"] = data_point(hy_oas, hy_date, "FRED BAMLH0A0HYM2 / ICE BofA")
    fields["hyOasChange20d"] = data_point(
        (hy_oas - previous(fred["hyOas"], 20)[1]) * 100,
        hy_date,
        "FRED BAMLH0A0HYM2 / ICE BofA",
    )

    ig_date, ig_oas = latest(fred["igOas"])
    fields["igOas"] = data_point(ig_oas, ig_date, "FRED BAMLC0A0CM / ICE BofA")
    fields["igOasChange20d"] = data_point(
        (ig_oas - previous(fred["igOas"], 20)[1]) * 100,
        ig_date,
        "FRED BAMLC0A0CM / ICE BofA",
    )

    fields["dxyChange20d"] = data_point(pct_return(yahoo["dxy"], 20), latest(yahoo["dxy"])[0], "Yahoo Finance DX-Y.NYB")

    ten_y_date, ten_y = latest(fred["tenYYield"])
    fields["tenYYield"] = data_point(ten_y, ten_y_date, "FRED DGS10")
    fields["tenYChange20d"] = data_point(
        (ten_y - previous(fred["tenYYield"], 20)[1]) * 100,
        ten_y_date,
        "FRED DGS10",
    )

    real_date, real_y = latest(fred["realTenY"])
    fields["realTenY"] = data_point(real_y, real_date, "FRED DFII10")
    fields["realTenYChange20d"] = data_point(
        (real_y - previous(fred["realTenY"], 20)[1]) * 100,
        real_date,
        "FRED DFII10",
    )

    nfci_date, nfci = latest(fred["nfci"])
    fields["nfci"] = data_point(nfci, nfci_date, "FRED NFCI / Chicago Fed")
    fields["kreRel20d"] = data_point(
        relative_return(yahoo["kre"], yahoo["spy"], 20),
        latest(yahoo["kre"])[0],
        "Yahoo Finance KRE/SPY",
    )

    try:
        fields["aaiiBearish"] = fetch_aaii_bearish()
    except RuntimeError as exc:
        fields["aaiiBearish"] = DataPoint(
            40,
            date.today().isoformat(),
            "Fallback neutral AAII value",
            "estimated",
            str(exc),
        )

    try:
        fields["putCall"] = fetch_put_call_ratio()
    except RuntimeError as exc:
        fields["putCall"] = DataPoint(
            0.75,
            date.today().isoformat(),
            "Fallback neutral put/call value",
            "estimated",
            str(exc),
        )

    values = {key: point.value for key, point in fields.items()}
    try:
        fields["fearGreed"] = fetch_cnn_fear_greed()
    except RuntimeError as exc:
        proxy = fear_greed_proxy(values, values["aaiiBearish"], values["putCall"])
        proxy.note = f"{proxy.note} CNN fetch failed: {exc}"
        fields["fearGreed"] = proxy
    values = {key: point.value for key, point in fields.items()}

    for key, point in fields.items():
        if point.status != "ok" or point.note:
            notes.append(f"{key}: {point.note or point.status}")
    notes.append(
        "model: Valuation percentile is unavailable from a stable public no-key source and is excluded from live scoring."
    )

    scores = calculate_scores(values)
    regime = classify(values, scores)

    field_meta = {
        key: {
            "asOf": point.as_of,
            "source": point.source,
            "status": point.status,
            **({"note": point.note} if point.note else {}),
        }
        for key, point in fields.items()
    }

    latest_as_of = max(point.as_of[:10] for point in fields.values())
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    return {
        "generatedAt": generated_at,
        "asOf": latest_as_of,
        "mode": "live",
        "values": values,
        "scores": scores,
        "regime": regime,
        "fieldMeta": field_meta,
        "notes": notes,
        "modelMeta": {
            "valuationInScore": False,
            "valuationStatus": "unavailable",
            "historyEndpoint": "data/history.json",
        },
        "sourceSummary": [
            "FRED: credit OAS, Treasury yields, NFCI",
            "Yahoo Finance chart endpoint: ETFs, DXY, MOVE",
            "Cboe daily market statistics: current equity put/call ratio",
            "AAII public sentiment survey page: weekly bearish percentage",
            "CNN Fear & Greed Index official endpoint, with proxy fallback if CNN blocks requests",
        ],
    }, spy_value


def main() -> int:
    snapshot, spy_close = build_snapshot()
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    history = write_history(snapshot, spy_close)
    print(
        f"Wrote {OUT_FILE.relative_to(ROOT)} | regime={snapshot['regime']['key']} | "
        f"V={snapshot['scores']['volatility']} C={snapshot['scores']['credit']} S={snapshot['scores']['sentiment']} | "
        f"history={len(history['entries'])}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"update_data.py failed: {exc}", file=sys.stderr)
        raise
