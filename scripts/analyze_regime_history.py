#!/usr/bin/env python3
"""Quantitative analysis layer for the Market Regime Model backfill."""

from __future__ import annotations

import argparse
import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "regime_model_history_5y.csv"
DEFAULT_OUTPUT = ROOT / "data" / "regime_model_quant_analysis.json"
HORIZONS = [5, 10, 20, 60]
SCORE_BUCKETS = [
    ("0", -0.1, 0.9),
    ("1-2", 0.9, 2.9),
    ("3-4", 2.9, 4.9),
    ("5+", 4.9, 99),
]
REGIME_ORDER = ["normal", "panic", "extreme", "defensive"]
REGIME_LABELS = {
    "normal": "Normal",
    "panic": "Panic",
    "extreme": "Extreme",
    "defensive": "Systemic",
}


def json_safe(value: Any) -> Any:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.date().isoformat()
    return value


def rounded(value: Any, digits: int = 4) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), digits)


def bootstrap_ci(values: pd.Series, iterations: int = 1500, seed: int = 17) -> tuple[float | None, float | None]:
    clean = values.dropna().to_numpy(dtype="float64")
    if len(clean) < 12:
        return None, None
    rng = np.random.default_rng(seed)
    means = np.empty(iterations)
    for idx in range(iterations):
        sample = rng.choice(clean, size=len(clean), replace=True)
        means[idx] = np.nanmean(sample)
    low, high = np.nanpercentile(means, [5, 95])
    return round(float(low), 4), round(float(high), 4)


def summarize_group(frame: pd.DataFrame, horizon: int, seed_offset: int = 0) -> dict[str, Any]:
    ret_col = f"spyRet{horizon}dFwd"
    vol_col = f"spyRealizedVol{horizon}dFwd"
    dd_col = f"spyMaxDrawdown{horizon}dFwd" if horizon in {20, 60} else "spyMaxDrawdown20dFwd"
    returns = frame[ret_col].dropna()
    vols = frame[vol_col].dropna()
    drawdowns = frame[dd_col].dropna() if dd_col in frame else pd.Series(dtype="float64")
    ci_low, ci_high = bootstrap_ci(returns, seed=17 + seed_offset + horizon)
    return {
        "rows": int(len(frame)),
        "usableRows": int(len(returns)),
        "avgReturn": rounded(returns.mean()),
        "medianReturn": rounded(returns.median()),
        "returnCiLow": ci_low,
        "returnCiHigh": ci_high,
        "winRate": rounded((returns > 0).mean()) if len(returns) else None,
        "lossRate": rounded((returns < 0).mean()) if len(returns) else None,
        "avgRealizedVol": rounded(vols.mean()),
        "avgMaxDrawdown": rounded(drawdowns.mean()),
        "tailDrawdownP10": rounded(drawdowns.quantile(0.1)) if len(drawdowns) else None,
    }


def add_score_bucket(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["scoreBucket"] = pd.cut(
        out["scoreTotal"],
        bins=[bucket[1] for bucket in SCORE_BUCKETS] + [SCORE_BUCKETS[-1][2]],
        labels=[bucket[0] for bucket in SCORE_BUCKETS],
        include_lowest=True,
        right=True,
    )
    return out


def rank_corr(frame: pd.DataFrame, x_col: str, y_col: str) -> float | None:
    subset = frame[[x_col, y_col]].dropna()
    if len(subset) < 30 or subset[x_col].nunique() < 2:
        return None
    return rounded(subset[x_col].rank().corr(subset[y_col].rank()))


def pearson_corr(frame: pd.DataFrame, x_col: str, y_col: str) -> float | None:
    subset = frame[[x_col, y_col]].dropna()
    if len(subset) < 30 or subset[x_col].nunique() < 2:
        return None
    return rounded(subset[x_col].corr(subset[y_col]))


def rolling_corr(frame: pd.DataFrame, window: int = 252) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx in range(window - 1, len(frame)):
        window_frame = frame.iloc[idx - window + 1 : idx + 1]
        rows.append(
            {
                "date": frame.iloc[idx]["date"],
                "return20": rank_corr(window_frame, "scoreTotal", "spyRet20dFwd"),
                "vol20": rank_corr(window_frame, "scoreTotal", "spyRealizedVol20dFwd"),
                "completeness": rounded(window_frame["scoreInputCompleteness"].mean()),
            }
        )
    return rows


def exact_score_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for score, group in frame.groupby("scoreTotal"):
        returns = group["spyRet20dFwd"].dropna()
        if returns.empty:
            continue
        rows.append(
            {
                "score": int(score),
                "rows": int(len(group)),
                "avgReturn20": rounded(returns.mean()),
                "medianReturn20": rounded(returns.median()),
                "winRate20": rounded((returns > 0).mean()),
                "avgVol20": rounded(group["spyRealizedVol20dFwd"].mean()),
                "avgDrawdown20": rounded(group["spyMaxDrawdown20dFwd"].mean()),
            }
        )
    return rows


def bucket_analysis(frame: pd.DataFrame) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for label, _low, _high in SCORE_BUCKETS:
        group = frame[frame["scoreBucket"].astype(str) == label]
        if group.empty:
            continue
        payload[label] = {
            "rows": int(len(group)),
            "avgScore": rounded(group["scoreTotal"].mean()),
            "avgCompleteness": rounded(group["scoreInputCompleteness"].mean()),
            "horizons": {
                str(horizon): summarize_group(group, horizon, seed_offset=sum(ord(ch) for ch in label))
                for horizon in HORIZONS
            },
        }
    return payload


def regime_analysis(frame: pd.DataFrame) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for regime in REGIME_ORDER:
        group = frame[frame["regime"] == regime]
        if group.empty:
            continue
        payload[regime] = {
            "label": REGIME_LABELS.get(regime, regime),
            "rows": int(len(group)),
            "avgScore": rounded(group["scoreTotal"].mean()),
            "avgCompleteness": rounded(group["scoreInputCompleteness"].mean()),
            "horizons": {
                str(horizon): summarize_group(group, horizon, seed_offset=sum(ord(ch) for ch in regime))
                for horizon in HORIZONS
            },
        }
    return payload


def score_module_correlations(frame: pd.DataFrame) -> dict[str, Any]:
    score_cols = ["volatilityScore", "creditScore", "sentimentScore", "scoreTotal"]
    target_cols = {
        "return20": "spyRet20dFwd",
        "return60": "spyRet60dFwd",
        "vol20": "spyRealizedVol20dFwd",
        "drawdown20": "spyMaxDrawdown20dFwd",
    }
    return {
        score_col: {
            target_name: {
                "spearman": rank_corr(frame, score_col, target_col),
                "pearson": pearson_corr(frame, score_col, target_col),
            }
            for target_name, target_col in target_cols.items()
        }
        for score_col in score_cols
    }


def time_series(frame: pd.DataFrame) -> list[dict[str, Any]]:
    fields = [
        "date",
        "spyClose",
        "scoreTotal",
        "volatilityScore",
        "creditScore",
        "sentimentScore",
        "regime",
        "scoreInputCompleteness",
        "spyRet20dFwd",
        "spyRealizedVol20dFwd",
        "spyMaxDrawdown20dFwd",
    ]
    return [
        {field: json_safe(row[field]) for field in fields}
        for _, row in frame[fields].iterrows()
    ]


def build_payload(frame: pd.DataFrame) -> dict[str, Any]:
    frame = add_score_bucket(frame)
    valid20 = frame.dropna(subset=["spyRet20dFwd"])
    high_score = valid20[valid20["scoreTotal"] >= 5]
    low_score = valid20[valid20["scoreTotal"] <= 1]
    latest = frame.iloc[-1]
    return {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": {
            "selected": "Score-bucket event study with bootstrap confidence bands, Spearman rank correlation, and 252-trading-day rolling stability checks",
            "reason": "The regime model is ordinal and threshold-based; this keeps the analysis interpretable and avoids overfitting a small, overlapping forward-return sample.",
            "primaryTarget": "SPY forward return, realized volatility, and max drawdown over 5/10/20/60 trading days",
        },
        "meta": {
            "rows": int(len(frame)),
            "startDate": str(frame["date"].iloc[0]),
            "endDate": str(frame["date"].iloc[-1]),
            "latestScore": int(latest["scoreTotal"]),
            "latestRegime": str(latest["regime"]),
            "latestCompleteness": rounded(latest["scoreInputCompleteness"]),
            "avgCompleteness": rounded(frame["scoreInputCompleteness"].mean()),
            "putCallMissingShare": rounded(frame["putCall"].isna().mean()) if "putCall" in frame else None,
            "oasMissingShare": rounded(frame[["hyOas", "igOas"]].isna().mean().mean()),
        },
        "headline": {
            "scoreTotalReturn20Spearman": rank_corr(frame, "scoreTotal", "spyRet20dFwd"),
            "scoreTotalVol20Spearman": rank_corr(frame, "scoreTotal", "spyRealizedVol20dFwd"),
            "scoreTotalDrawdown20Spearman": rank_corr(frame, "scoreTotal", "spyMaxDrawdown20dFwd"),
            "highScoreAvgReturn20": rounded(high_score["spyRet20dFwd"].mean()),
            "lowScoreAvgReturn20": rounded(low_score["spyRet20dFwd"].mean()),
            "highScoreWinRate20": rounded((high_score["spyRet20dFwd"] > 0).mean()),
            "lowScoreWinRate20": rounded((low_score["spyRet20dFwd"] > 0).mean()),
        },
        "bucketAnalysis": bucket_analysis(frame),
        "regimeAnalysis": regime_analysis(frame),
        "exactScoreRows": exact_score_rows(frame),
        "moduleCorrelations": score_module_correlations(frame),
        "rolling": rolling_corr(frame),
        "timeSeries": time_series(frame),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze historical regime model data.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    frame = pd.read_csv(args.input)
    frame["date"] = pd.to_datetime(frame["date"]).dt.date.astype(str)
    payload = build_payload(frame)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output.relative_to(ROOT)} | rows={payload['meta']['rows']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
