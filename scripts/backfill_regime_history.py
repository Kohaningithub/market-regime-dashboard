#!/usr/bin/env python3
"""Backfill five-year Market Regime Model history.

The live updater only saves snapshots after the dashboard is deployed. This
script reconstructs daily historical inputs, applies the same scoring rules,
and writes analysis-ready CSV/JSON outputs.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

try:
    import numpy as np
    import pandas as pd
except ImportError as exc:  # pragma: no cover - runtime guard
    raise SystemExit(
        "backfill_regime_history.py requires pandas and numpy. "
        "Install them or run with the Codex bundled Python runtime."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_CSV = DATA_DIR / "regime_model_history_5y.csv"
OUT_JSON = DATA_DIR / "regime_model_history_5y.json"
OUT_SUMMARY = DATA_DIR / "regime_model_analysis_summary.json"
USER_AGENT = "Mozilla/5.0 market-regime-backfill/1.0"
AAII_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36"
)
CNN_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)
REGIME_TITLES = {
    "normal": "Normal / Mild Pullback",
    "panic": "Panic Pullback",
    "extreme": "Extreme Panic",
    "defensive": "Systemic Stress",
}
FRED_IDS = {
    "hyOas": "BAMLH0A0HYM2",
    "igOas": "BAMLC0A0CM",
    "tenYYield": "DGS10",
    "realTenY": "DFII10",
    "nfci": "NFCI",
}
YAHOO_SYMBOLS = {
    "vix": "^VIX",
    "move": "^MOVE",
    "spy": "SPY",
    "qqq": "QQQ",
    "hyg": "HYG",
    "jnk": "JNK",
    "kre": "KRE",
    "rsp": "RSP",
    "dxy": "DX-Y.NYB",
}
VOL_SCORE_INPUTS = ["vix", "vixChange5d", "move"]
CREDIT_SCORE_INPUTS = [
    "hygRet20d",
    "jnkRet20d",
    "hyOas",
    "hyOasChange20d",
    "igOas",
    "igOasChange20d",
    "dxyChange20d",
    "nfci",
    "kreRel20d",
]
SENTIMENT_SCORE_INPUTS = ["fearGreed", "aaiiBearish", "putCall"]
ALL_SCORE_INPUTS = VOL_SCORE_INPUTS + CREDIT_SCORE_INPUTS + SENTIMENT_SCORE_INPUTS


@dataclass
class SourceStatus:
    name: str
    status: str
    detail: str


def fetch_bytes(
    url: str,
    timeout: int = 35,
    retries: int = 2,
    headers: dict[str, str] | None = None,
) -> bytes:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        request_headers.update(headers)
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers=request_headers)
            with urlopen(request, timeout=timeout) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"Fetch failed for {url}: {last_error}")


def fetch_text(
    url: str,
    timeout: int = 35,
    retries: int = 2,
    headers: dict[str, str] | None = None,
) -> str:
    return fetch_bytes(url, timeout=timeout, retries=retries, headers=headers).decode("utf-8", errors="replace")


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        parsed = float(value)
        return None if math.isnan(parsed) else parsed
    text = str(value).strip().replace(",", "").replace("%", "")
    if not text or text == ".":
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    return None if math.isnan(parsed) else parsed


def parse_date(value: Any) -> pd.Timestamp | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return pd.Timestamp(parsed).normalize()


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, float(value)))


def scale_inverse(value: float, low_good: float, high_bad: float) -> float:
    return clamp(100 - ((value - low_good) / (high_bad - low_good) * 100))


def scale_direct(value: float, low_bad: float, high_good: float) -> float:
    return clamp((value - low_bad) / (high_good - low_bad) * 100)


def threshold_score(value: Any, thresholds: list[float], direction: str = "above") -> int:
    if value is None or pd.isna(value):
        return 0
    numeric = float(value)
    score = 0
    for threshold in thresholds:
        if direction == "above" and numeric > threshold:
            score += 1
        if direction == "below" and numeric < threshold:
            score += 1
    return score


def yahoo_series(symbol: str, start: date, end: date) -> pd.Series:
    period1 = int(datetime.combine(start, datetime.min.time(), tzinfo=UTC).timestamp())
    period2 = int(datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC).timestamp())
    encoded = quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?period1={period1}&period2={period2}&interval=1d&events=history"
    )
    payload = json.loads(fetch_text(url))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        raise RuntimeError(f"No Yahoo chart result for {symbol}")

    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    adjclose = ((indicators.get("adjclose") or [{}])[0].get("adjclose") or [])
    close = ((indicators.get("quote") or [{}])[0].get("close") or [])
    values = adjclose if any(value is not None for value in adjclose) else close

    rows: list[tuple[pd.Timestamp, float]] = []
    for timestamp, raw_value in zip(timestamps, values):
        value = parse_float(raw_value)
        if value is None:
            continue
        as_of = pd.Timestamp(datetime.fromtimestamp(int(timestamp), UTC).date())
        rows.append((as_of, value))
    if not rows:
        raise RuntimeError(f"No Yahoo prices for {symbol}")

    series = pd.Series({day: value for day, value in rows}, dtype="float64").sort_index()
    series = series[~series.index.duplicated(keep="last")]
    return series


def fred_series(series_id: str, start: date, end: date) -> pd.Series:
    url = (
        f"https://fred.stlouisfed.org/graph/fredgraph.csv"
        f"?id={series_id}&cosd={start.isoformat()}&coed={end.isoformat()}"
    )
    text = fetch_text(url, timeout=20, retries=2)
    reader = csv.DictReader(io.StringIO(text))
    rows: list[tuple[pd.Timestamp, float]] = []
    for row in reader:
        value = parse_float(row.get(series_id))
        if value is None:
            continue
        parsed = parse_date(row.get("observation_date"))
        if parsed is not None:
            rows.append((parsed, value))
    if not rows:
        raise RuntimeError(f"No FRED data for {series_id}")
    series = pd.Series({day: value for day, value in rows}, dtype="float64").sort_index()
    series = series[~series.index.duplicated(keep="last")]
    return series


def align_to_index(series: pd.Series, index: pd.DatetimeIndex, ffill: bool = True) -> pd.Series:
    aligned = series.reindex(series.index.union(index)).sort_index()
    if ffill:
        aligned = aligned.ffill()
    return aligned.reindex(index)


def load_aaii_from_local_csv(path: Path) -> pd.Series | None:
    if not path.exists():
        return None
    frame = pd.read_csv(path)
    date_col = next((col for col in frame.columns if col.lower() in {"date", "reported_date", "reported date"}), None)
    bearish_col = next((col for col in frame.columns if "bearish" in col.lower()), None)
    if not date_col or not bearish_col:
        raise RuntimeError(f"{path} must include date and bearish columns")
    frame["date"] = pd.to_datetime(frame[date_col], errors="coerce").dt.normalize()
    frame["bearish"] = pd.to_numeric(frame[bearish_col], errors="coerce")
    frame.loc[frame["bearish"].between(0, 1, inclusive="both"), "bearish"] *= 100
    frame = frame.dropna(subset=["date", "bearish"])
    if frame.empty:
        return None
    return pd.Series(frame["bearish"].to_numpy(), index=frame["date"], dtype="float64").sort_index()


def fetch_aaii_xls_history() -> pd.Series:
    try:
        import xlrd  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "xlrd is not installed; install xlrd or save AAII history as data/aaii_sentiment.csv"
        ) from exc

    url = "https://www.aaii.com/files/surveys/sentiment.xls"
    content = fetch_bytes(
        url,
        timeout=30,
        retries=2,
        headers={
            "User-Agent": AAII_USER_AGENT,
            "Referer": "https://www.aaii.com/sentimentsurvey/sent_results",
            "Accept": "application/vnd.ms-excel,application/octet-stream,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with tempfile.NamedTemporaryFile(suffix=".xls", delete=False) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    try:
        frame = pd.read_excel(temp_path, sheet_name="SENTIMENT", header=3)
    finally:
        try:
            temp_path.unlink()
        except OSError:
            pass

    columns = {str(col).strip().lower(): col for col in frame.columns}
    date_col = columns.get("date") or columns.get("reported date") or frame.columns[0]
    bearish_col = columns.get("bearish")
    if bearish_col is None:
        bearish_col = next((col for col in frame.columns if "bearish" in str(col).lower()), None)
    if bearish_col is None:
        raise RuntimeError("Unable to find Bearish column in AAII workbook")

    frame["date"] = pd.to_datetime(frame[date_col], errors="coerce").dt.normalize()
    frame["bearish"] = pd.to_numeric(frame[bearish_col], errors="coerce")
    frame.loc[frame["bearish"].between(0, 1, inclusive="both"), "bearish"] *= 100
    frame = frame.dropna(subset=["date", "bearish"])
    if frame.empty:
        raise RuntimeError("AAII workbook did not contain usable history")
    return pd.Series(frame["bearish"].to_numpy(), index=frame["date"], dtype="float64").sort_index()


def fetch_aaii_recent_html() -> pd.Series:
    html = fetch_text("https://www.aaii.com/sentimentsurvey/sent_results")
    pattern = re.compile(
        r"([A-Z][a-z]{2})\s+(\d{1,2})\s+"
        r"([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%",
        re.MULTILINE,
    )
    today = date.today()
    rows: list[tuple[pd.Timestamp, float]] = []
    last_seen: pd.Timestamp | None = None
    for month, day_text, _bullish, _neutral, bearish in pattern.findall(html):
        parsed = pd.to_datetime(f"{month} {day_text} {today.year}", errors="coerce")
        if pd.isna(parsed):
            continue
        parsed = pd.Timestamp(parsed).normalize()
        if parsed.date() > today + timedelta(days=10):
            parsed = parsed.replace(year=parsed.year - 1)
        if last_seen is not None and parsed > last_seen:
            parsed = parsed.replace(year=parsed.year - 1)
        last_seen = parsed
        rows.append((parsed, float(bearish)))
    if not rows:
        raise RuntimeError("Unable to parse recent AAII sentiment table")
    return pd.Series({day: value for day, value in rows}, dtype="float64").sort_index()


def load_aaii_history(statuses: list[SourceStatus]) -> pd.Series:
    local = load_aaii_from_local_csv(DATA_DIR / "aaii_sentiment.csv")
    if local is not None:
        statuses.append(SourceStatus("aaiiBearish", "ok", "Loaded data/aaii_sentiment.csv"))
        return local
    try:
        series = fetch_aaii_xls_history()
        statuses.append(SourceStatus("aaiiBearish", "ok", "AAII official sentiment.xls"))
        return series
    except RuntimeError as exc:
        try:
            series = fetch_aaii_recent_html()
            statuses.append(
                SourceStatus(
                    "aaiiBearish",
                    "partial",
                    f"AAII official workbook unavailable; parsed recent webpage only. {exc}",
                )
            )
            return series
        except RuntimeError as html_exc:
            statuses.append(
                SourceStatus(
                    "aaiiBearish",
                    "missing",
                    f"Unable to load AAII history. {exc}; {html_exc}",
                )
            )
            return pd.Series(dtype="float64")


def fetch_cboe_equity_put_call(statuses: list[SourceStatus]) -> pd.Series:
    url = "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/equitypc.csv"
    try:
        text = fetch_text(url, timeout=20, retries=1)
    except RuntimeError as exc:
        statuses.append(SourceStatus("putCall", "missing", f"Cboe equitypc.csv fetch failed. {exc}"))
        return pd.Series(dtype="float64")

    header_at = text.find("DATE,CALL,PUT,TOTAL,P/C Ratio")
    if header_at < 0:
        statuses.append(SourceStatus("putCall", "missing", "Cboe equitypc.csv did not include expected header"))
        return pd.Series(dtype="float64")
    reader = csv.DictReader(io.StringIO(text[header_at:]))
    rows: list[tuple[pd.Timestamp, float]] = []
    for row in reader:
        parsed = parse_date(row.get("DATE"))
        value = parse_float(row.get("P/C Ratio"))
        if parsed is not None and value is not None:
            rows.append((parsed, value))
    series = pd.Series({day: value for day, value in rows}, dtype="float64").sort_index()
    if series.empty:
        statuses.append(SourceStatus("putCall", "missing", "Cboe equitypc.csv had no usable rows"))
    else:
        statuses.append(
            SourceStatus(
                "putCall",
                "partial",
                f"Cboe equitypc.csv only covers {series.index.min().date()} to {series.index.max().date()}",
            )
        )
    return series


def fetch_cnn_fear_greed(start: date, statuses: list[SourceStatus]) -> pd.Series:
    url = f"https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{start.isoformat()}"
    try:
        payload = json.loads(
            fetch_text(
                url,
                timeout=20,
                retries=1,
                headers={
                    "User-Agent": CNN_USER_AGENT,
                    "Accept": "application/json,text/plain,*/*",
                    "Referer": "https://www.cnn.com/markets/fear-and-greed",
                    "Origin": "https://www.cnn.com",
                },
            )
        )
    except RuntimeError as exc:
        statuses.append(SourceStatus("fearGreed", "estimated", f"CNN endpoint unavailable; using proxy. {exc}"))
        return pd.Series(dtype="float64")

    history = payload.get("fear_and_greed_historical") or {}
    rows: list[tuple[pd.Timestamp, float]] = []
    for item in history.get("data") or []:
        raw_date = item.get("x") or item.get("date") or item.get("timestamp")
        raw_value = item.get("y") or item.get("score") or item.get("value")
        value = parse_float(raw_value)
        if value is None:
            continue
        parsed: pd.Timestamp | None
        if isinstance(raw_date, (int, float)) and raw_date > 10_000_000_000:
            parsed = pd.Timestamp(datetime.fromtimestamp(raw_date / 1000, UTC).date())
        elif isinstance(raw_date, (int, float)):
            parsed = pd.Timestamp(datetime.fromtimestamp(raw_date, UTC).date())
        else:
            parsed = parse_date(raw_date)
        if parsed is not None:
            rows.append((parsed, value))

    if not rows:
        statuses.append(SourceStatus("fearGreed", "estimated", "CNN response had no usable history; using proxy"))
        return pd.Series(dtype="float64")
    statuses.append(SourceStatus("fearGreed", "ok", "CNN Fear & Greed historical endpoint"))
    return pd.Series({day: value for day, value in rows}, dtype="float64").sort_index()


def build_frame(start: date, end: date, fetch_start: date, statuses: list[SourceStatus]) -> pd.DataFrame:
    yahoo: dict[str, pd.Series] = {}
    for name, symbol in YAHOO_SYMBOLS.items():
        yahoo[name] = yahoo_series(symbol, fetch_start, end)
        statuses.append(
            SourceStatus(name, "ok", f"Yahoo Finance {symbol}: {yahoo[name].index.min().date()} to {yahoo[name].index.max().date()}")
        )

    index = yahoo["spy"].loc[pd.Timestamp(fetch_start) : pd.Timestamp(end)].index
    frame = pd.DataFrame(index=index)
    frame.index.name = "date"

    for name, series in yahoo.items():
        frame[f"{name}Close" if name in {"spy", "qqq", "hyg", "jnk", "kre", "rsp", "dxy"} else name] = align_to_index(
            series, index
        )

    fred: dict[str, pd.Series] = {}
    for name, series_id in FRED_IDS.items():
        try:
            fred[name] = fred_series(series_id, fetch_start, end)
            statuses.append(
                SourceStatus(name, "ok", f"FRED {series_id}: {fred[name].index.min().date()} to {fred[name].index.max().date()}")
            )
            frame[name] = align_to_index(fred[name], index)
        except RuntimeError as exc:
            statuses.append(SourceStatus(name, "missing", f"FRED {series_id} unavailable. {exc}"))
            frame[name] = np.nan

    aaii = load_aaii_history(statuses)
    frame["aaiiBearish"] = align_to_index(aaii, index) if not aaii.empty else np.nan

    put_call = fetch_cboe_equity_put_call(statuses)
    frame["putCall"] = align_to_index(put_call, index) if not put_call.empty else np.nan
    frame.loc[frame.index > pd.Timestamp("2019-10-04"), "putCall"] = np.nan

    frame["vixChange5d"] = frame["vix"] - frame["vix"].shift(5)
    frame["move"] = frame["move"]
    frame["spyDrawdown"] = (frame["spyClose"] / frame["spyClose"].rolling(252, min_periods=20).max() - 1) * 100
    frame["qqqDrawdown"] = (frame["qqqClose"] / frame["qqqClose"].rolling(252, min_periods=20).max() - 1) * 100
    frame["rspSpyRel60d"] = ((frame["rspClose"] / frame["spyClose"]) / (frame["rspClose"] / frame["spyClose"]).shift(60) - 1) * 100
    frame["hygRet20d"] = (frame["hygClose"] / frame["hygClose"].shift(20) - 1) * 100
    frame["jnkRet20d"] = (frame["jnkClose"] / frame["jnkClose"].shift(20) - 1) * 100
    frame["hyOasChange20d"] = frame["hyOas"].diff(20) * 100
    frame["igOasChange20d"] = frame["igOas"].diff(20) * 100
    frame["dxyChange20d"] = (frame["dxyClose"] / frame["dxyClose"].shift(20) - 1) * 100
    frame["tenYChange20d"] = frame["tenYYield"].diff(20) * 100
    frame["realTenYChange20d"] = frame["realTenY"].diff(20) * 100
    frame["kreRel20d"] = ((frame["kreClose"] / frame["spyClose"]) / (frame["kreClose"] / frame["spyClose"]).shift(20) - 1) * 100

    cnn_fear_greed = fetch_cnn_fear_greed(start, statuses)
    if not cnn_fear_greed.empty:
        frame["fearGreed"] = align_to_index(cnn_fear_greed, index)
        frame["fearGreedSource"] = "cnn"
    else:
        frame["fearGreed"] = build_fear_greed_proxy(frame)
        frame["fearGreedSource"] = "proxy"

    return frame.loc[pd.Timestamp(start) : pd.Timestamp(end)].copy()


def build_fear_greed_proxy(frame: pd.DataFrame) -> pd.Series:
    components = pd.DataFrame(index=frame.index)
    components["vix"] = frame["vix"].apply(lambda value: scale_inverse(value, 12, 45) if pd.notna(value) else np.nan)
    components["spyDrawdown"] = frame["spyDrawdown"].apply(
        lambda value: scale_direct(value, -22, 0) if pd.notna(value) else np.nan
    )
    components["hygRet20d"] = frame["hygRet20d"].apply(lambda value: scale_direct(value, -8, 2) if pd.notna(value) else np.nan)
    components["rspSpyRel60d"] = frame["rspSpyRel60d"].apply(
        lambda value: scale_direct(value, -8, 3) if pd.notna(value) else np.nan
    )
    if "aaiiBearish" in frame:
        components["aaiiBearish"] = frame["aaiiBearish"].apply(
            lambda value: scale_inverse(value, 25, 65) if pd.notna(value) else np.nan
        )
    if "putCall" in frame and frame["putCall"].notna().any():
        components["putCall"] = frame["putCall"].apply(
            lambda value: scale_inverse(value, 0.5, 1.1) if pd.notna(value) else np.nan
        )
    return components.mean(axis=1).round(0)


def has_systemic_cluster(row: pd.Series, credit_score: int) -> bool:
    cluster_signals = [
        row.get("hygRet20d", np.nan) <= -5,
        row.get("jnkRet20d", np.nan) <= -5,
        row.get("hyOasChange20d", np.nan) >= 75,
        row.get("igOasChange20d", np.nan) >= 25,
        row.get("dxyChange20d", np.nan) >= 3,
        row.get("nfci", np.nan) > 0,
        row.get("kreRel20d", np.nan) <= -8,
        row.get("move", np.nan) >= 160,
    ]
    return credit_score >= 4 and sum(bool(signal) for signal in cluster_signals) >= 3


def classify(row: pd.Series, scores: dict[str, int]) -> tuple[str, bool]:
    overheated = (
        row.get("fearGreed", np.nan) > 75
        and row.get("putCall", np.nan) < 0.55
        and row.get("rspSpyRel60d", np.nan) < -3
    )
    if scores["credit"] >= 6 or has_systemic_cluster(row, scores["credit"]):
        return "defensive", bool(overheated)
    if (
        scores["credit"] <= 3
        and (scores["volatility"] >= 5 or row.get("vix", np.nan) >= 35 or scores["sentiment"] >= 5)
        and (row.get("spyDrawdown", np.nan) <= -12 or row.get("qqqDrawdown", np.nan) <= -18)
    ):
        return "extreme", bool(overheated)
    if (
        scores["credit"] <= 3
        and scores["volatility"] >= 3
        and scores["sentiment"] >= 3
        and (row.get("spyDrawdown", np.nan) <= -8 or row.get("qqqDrawdown", np.nan) <= -12)
    ):
        return "panic", bool(overheated)
    return "normal", bool(overheated)


def apply_scores(frame: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for as_of, row in frame.iterrows():
        volatility = (
            threshold_score(row.get("vix"), [20, 25, 35, 45])
            + threshold_score(row.get("vixChange5d"), [5, 10])
            + threshold_score(row.get("move"), [120, 160])
        )
        credit = (
            threshold_score(row.get("hygRet20d"), [-3, -5], "below")
            + threshold_score(row.get("jnkRet20d"), [-3, -5], "below")
            + threshold_score(row.get("hyOas"), [4.5, 6])
            + threshold_score(row.get("hyOasChange20d"), [75, 150])
            + threshold_score(row.get("igOas"), [1.25, 1.75])
            + threshold_score(row.get("igOasChange20d"), [25, 60])
            + threshold_score(row.get("dxyChange20d"), [3, 5])
            + threshold_score(row.get("nfci"), [0, 0.5])
            + threshold_score(row.get("kreRel20d"), [-8, -15], "below")
        )
        sentiment = (
            threshold_score(row.get("fearGreed"), [40, 25, 15], "below")
            + threshold_score(row.get("aaiiBearish"), [40, 50, 60])
            + threshold_score(row.get("putCall"), [0.75, 0.9])
        )
        scores = {"volatility": volatility, "credit": credit, "sentiment": sentiment}
        regime, overheated = classify(row, scores)
        rows.append(
            {
                "date": as_of.date().isoformat(),
                "volatilityScore": volatility,
                "creditScore": credit,
                "sentimentScore": sentiment,
                "scoreTotal": volatility + credit + sentiment,
                "regime": regime,
                "regimeTitle": REGIME_TITLES[regime],
                "overheated": overheated,
            }
        )
    scored = pd.DataFrame(rows).set_index(pd.to_datetime([row["date"] for row in rows]))
    scored.index.name = "date"
    return pd.concat([frame, scored.drop(columns=["date"])], axis=1)


def add_score_coverage(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["volInputsAvailable"] = out[VOL_SCORE_INPUTS].notna().sum(axis=1)
    out["creditInputsAvailable"] = out[CREDIT_SCORE_INPUTS].notna().sum(axis=1)
    out["sentimentInputsAvailable"] = out[SENTIMENT_SCORE_INPUTS].notna().sum(axis=1)
    out["scoreInputsAvailable"] = out[ALL_SCORE_INPUTS].notna().sum(axis=1)
    out["scoreInputCompleteness"] = out["scoreInputsAvailable"] / len(ALL_SCORE_INPUTS)
    return out


def add_forward_market_stats(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    daily_log_return = np.log(out["spyClose"] / out["spyClose"].shift(1))
    daily_pct_return = out["spyClose"].pct_change() * 100
    out["spyRealizedVol20dTrailing"] = daily_pct_return.rolling(20).std() * math.sqrt(252)

    for horizon in [5, 10, 20, 60]:
        out[f"spyRet{horizon}dFwd"] = (out["spyClose"].shift(-horizon) / out["spyClose"] - 1) * 100
        future_logs = daily_log_return.shift(-1).iloc[::-1].rolling(horizon, min_periods=horizon).std().iloc[::-1]
        out[f"spyRealizedVol{horizon}dFwd"] = future_logs * math.sqrt(252) * 100

    closes = out["spyClose"].to_numpy(dtype="float64")
    for horizon in [20, 60]:
        drawdowns: list[float] = []
        for idx, current in enumerate(closes):
            window = closes[idx + 1 : idx + horizon + 1]
            if len(window) < horizon or not np.isfinite(current):
                drawdowns.append(np.nan)
                continue
            drawdowns.append((np.nanmin(window) / current - 1) * 100)
        out[f"spyMaxDrawdown{horizon}dFwd"] = drawdowns
    return out


def round_numeric(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    for column in out.columns:
        if pd.api.types.is_float_dtype(out[column]):
            out[column] = out[column].round(4)
    return out


def json_safe(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.date().isoformat()
    return value


def record_frame(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for as_of, row in frame.iterrows():
        record = {"date": as_of.date().isoformat()}
        record.update({column: json_safe(value) for column, value in row.items()})
        records.append(record)
    return records


def corr_pair(frame: pd.DataFrame, x_col: str, y_col: str) -> float | None:
    subset = frame[[x_col, y_col]].dropna()
    if len(subset) < 20 or subset[x_col].nunique() < 2 or subset[y_col].nunique() < 2:
        return None
    return round(float(subset[x_col].corr(subset[y_col])), 4)


def summarize_group(group: pd.DataFrame) -> dict[str, Any]:
    def mean(col: str) -> float | None:
        values = group[col].dropna()
        return None if values.empty else round(float(values.mean()), 4)

    def median(col: str) -> float | None:
        values = group[col].dropna()
        return None if values.empty else round(float(values.median()), 4)

    returns20 = group["spyRet20dFwd"].dropna()
    return {
        "rows": int(len(group)),
        "rowsWith20dForward": int(len(returns20)),
        "avgSpyRet20dFwd": mean("spyRet20dFwd"),
        "medianSpyRet20dFwd": median("spyRet20dFwd"),
        "winRate20dFwd": None if returns20.empty else round(float((returns20 > 0).mean()), 4),
        "avgSpyRet60dFwd": mean("spyRet60dFwd"),
        "avgRealizedVol20dFwd": mean("spyRealizedVol20dFwd"),
        "avgMaxDrawdown20dFwd": mean("spyMaxDrawdown20dFwd"),
    }


def build_summary(frame: pd.DataFrame, statuses: list[SourceStatus], start: date, end: date) -> dict[str, Any]:
    source_status = [status.__dict__ for status in statuses]
    score_columns = ["volatilityScore", "creditScore", "sentimentScore", "scoreTotal"]
    target_columns = [
        "spyRet5dFwd",
        "spyRet10dFwd",
        "spyRet20dFwd",
        "spyRet60dFwd",
        "spyRealizedVol20dFwd",
        "spyMaxDrawdown20dFwd",
    ]
    correlations = {
        score: {target: corr_pair(frame, score, target) for target in target_columns}
        for score in score_columns
    }

    bucket_labels = pd.cut(
        frame["scoreTotal"],
        bins=[-0.1, 0.9, 2.9, 4.9, 99],
        labels=["0", "1-2", "3-4", "5+"],
    )
    by_score_bucket = {
        str(label): summarize_group(frame.loc[bucket_labels == label])
        for label in bucket_labels.cat.categories
        if not frame.loc[bucket_labels == label].empty
    }
    by_regime = {
        str(regime): summarize_group(group)
        for regime, group in frame.groupby("regime", dropna=False)
    }
    by_credit_score = {
        str(int(score)): summarize_group(group)
        for score, group in frame.groupby("creditScore", dropna=False)
    }

    missing_share = {
        column: round(float(frame[column].isna().mean()), 4)
        for column in ["fearGreed", "aaiiBearish", "putCall", "hyOas", "igOas", "nfci"]
        if column in frame
    }

    return {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "rows": int(len(frame)),
        "sourceStatus": source_status,
        "missingShare": missing_share,
        "correlations": correlations,
        "byScoreBucket": by_score_bucket,
        "byRegime": by_regime,
        "byCreditScore": by_credit_score,
        "notes": [
            "Scores use the dashboard threshold rules.",
            "Fear & Greed uses CNN history when available; otherwise a proxy from VIX, SPY drawdown, HYG, RSP/SPY, AAII, and Put/Call.",
            "Cboe public equity put/call ratio CSV currently stops at 2019-10-04, so the five-year backfill usually has missing Put/Call.",
            "Forward return and volatility columns are ex-post analysis targets, not inputs to the score.",
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill historical market regime model data.")
    parser.add_argument("--years", type=int, default=5, help="Number of years to keep in the output.")
    parser.add_argument("--end-date", type=str, default=date.today().isoformat(), help="Inclusive output end date.")
    parser.add_argument("--csv", type=Path, default=OUT_CSV, help="Output CSV path.")
    parser.add_argument("--json", type=Path, default=OUT_JSON, help="Output JSON path.")
    parser.add_argument("--summary", type=Path, default=OUT_SUMMARY, help="Output summary JSON path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    end = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    start = end - timedelta(days=365 * args.years)
    fetch_start = start - timedelta(days=430)
    statuses: list[SourceStatus] = []

    frame = build_frame(start, end, fetch_start, statuses)
    frame = add_score_coverage(frame)
    frame = apply_scores(frame)
    frame = add_forward_market_stats(frame)
    frame = round_numeric(frame)

    args.csv.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.csv, index_label="date")

    history_payload = {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "rows": int(len(frame)),
        "records": record_frame(frame),
    }
    args.json.write_text(json.dumps(history_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = build_summary(frame, statuses, start, end)
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Wrote {args.csv.relative_to(ROOT)} ({len(frame)} rows), "
        f"{args.json.relative_to(ROOT)}, and {args.summary.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"backfill_regime_history.py failed: {exc}", file=sys.stderr)
        raise
