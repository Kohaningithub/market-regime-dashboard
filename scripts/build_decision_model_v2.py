#!/usr/bin/env python3
"""Build a calibrated decision layer for add/hold/reduce actions."""

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
HISTORY_FILE = ROOT / "data" / "regime_model_history_5y.csv"
LATEST_FILE = ROOT / "data" / "latest.json"
OUT_JSON = ROOT / "data" / "regime_model_decision_v2.json"
OUT_CSV = ROOT / "data" / "regime_model_decision_v2_history.csv"


def nz(mapping: dict[str, Any] | pd.Series, key: str, default: float = 0) -> float:
    value = mapping.get(key, default)
    if value is None:
        return default
    try:
        if pd.isna(value):
            return default
    except TypeError:
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def calculate_decision_scores(row: dict[str, Any] | pd.Series) -> dict[str, Any]:
    volatility_score = nz(row, "volatilityScore", nz(row, "volatility"))
    credit_score = nz(row, "creditScore", nz(row, "credit"))
    sentiment_score = nz(row, "sentimentScore", nz(row, "sentiment"))

    vix = nz(row, "vix")
    vix_change_5d = nz(row, "vixChange5d")
    move = nz(row, "move")
    spy_drawdown = nz(row, "spyDrawdown")
    qqq_drawdown = nz(row, "qqqDrawdown")
    fear_greed = nz(row, "fearGreed", 50)
    aaii_bearish = nz(row, "aaiiBearish", 40)
    put_call = row.get("putCall", np.nan)
    put_call_value = nz(row, "putCall", 0.75)

    hy_oas = nz(row, "hyOas")
    hy_oas_change_20d = nz(row, "hyOasChange20d")
    ig_oas = nz(row, "igOas")
    ig_oas_change_20d = nz(row, "igOasChange20d")
    dxy_change_20d = nz(row, "dxyChange20d")
    nfci = nz(row, "nfci")
    kre_rel_20d = nz(row, "kreRel20d")
    hyg_ret_20d = nz(row, "hygRet20d")
    jnk_ret_20d = nz(row, "jnkRet20d")
    rsp_spy_rel_60d = nz(row, "rspSpyRel60d")
    trailing_vol = nz(row, "spyRealizedVol20dTrailing", 14)
    completeness = nz(row, "scoreInputCompleteness", 1)

    drawdown_component = min(30, max(0, -spy_drawdown) * 2.2 + max(0, -qqq_drawdown) * 0.35)
    sentiment_component = min(
        25,
        sentiment_score * 3
        + max(0, 40 - fear_greed) * 0.55
        + max(0, aaii_bearish - 40) * 0.28
        + (0 if pd.isna(put_call) else max(0, put_call_value - 0.75) * 12),
    )
    volatility_component = min(
        20,
        volatility_score * 2.2
        + max(0, vix - 20) * 0.65
        + max(0, vix_change_5d) * 0.65
        + max(0, move - 120) * 0.15,
    )
    credit_stability_bonus = max(0, 15 - credit_score * 4 - max(0, hy_oas - 4.5) * 4 - max(0, nfci) * 7)
    opportunity_score = clamp(
        drawdown_component + sentiment_component + volatility_component + credit_stability_bonus
    )

    credit_risk = min(
        42,
        credit_score * 9
        + max(0, hy_oas - 4.5) * 7
        + max(0, hy_oas_change_20d - 75) * 0.08
        + max(0, ig_oas - 1.25) * 8
        + max(0, ig_oas_change_20d - 25) * 0.1
        + max(0, nfci) * 12
        + max(0, -kre_rel_20d - 8) * 1.5
        + max(0, dxy_change_20d - 3) * 5,
    )
    volatility_risk = min(
        28,
        max(0, trailing_vol - 14) * 1.1
        + volatility_score * 2
        + max(0, vix - 25) * 1.2
        + max(0, vix_change_5d - 5) * 1.3,
    )
    trend_risk = min(
        18,
        max(0, -hyg_ret_20d - 3) * 2
        + max(0, -jnk_ret_20d - 3) * 2
        + max(0, -rsp_spy_rel_60d - 5)
        + max(0, -spy_drawdown - 12) * 0.7,
    )
    overheat_risk = min(
        12,
        max(0, fear_greed - 70) * 0.4
        + max(0, 16 - vix) * 0.5
        + (4 if spy_drawdown >= -2 and fear_greed >= 70 else 0),
    )
    data_penalty = max(0, (1 - completeness) * 10)
    risk_score = clamp(credit_risk + volatility_risk + trend_risk + overheat_risk + data_penalty)

    if (
        credit_score >= 1
        and trailing_vol >= 18
        and spy_drawdown >= -10
        and risk_score >= 35
    ) or (
        credit_score >= 2
        and trailing_vol >= 22
        and spy_drawdown >= -15
        and risk_score >= 45
    ):
        action = "SELL"
        stance = "减仓/卖出一部分"
        reason = "信用压力与高波动同步出现，且市场尚未充分出清，历史上后续 20-60 日风险收益较差。"
    elif opportunity_score >= 70 and risk_score <= 55 and spy_drawdown <= -10 and credit_score <= 2:
        action = "ADD"
        stance = "加仓"
        reason = "恐慌和回撤足够深，同时信用风险未失控，历史上该组合的反弹概率和收益更好。"
    elif opportunity_score >= 55 and risk_score <= 50 and spy_drawdown <= -5 and credit_score <= 2:
        action = "ADD_SMALL"
        stance = "小幅分批加仓/维持偏加"
        reason = "机会信号已经出现，但历史优势不如深度恐慌场景，适合小步执行。"
    elif overheat_risk >= 8 and opportunity_score < 35:
        action = "HOLD"
        stance = "维持/再平衡，不追高"
        reason = "过热本身不是有效卖出信号，但不适合主动追涨。"
    else:
        action = "HOLD"
        stance = "维持"
        reason = "缺少高胜率加仓窗口，也没有足够强的减仓信号。"

    return {
        "opportunityScore": round(opportunity_score, 2),
        "riskScore": round(risk_score, 2),
        "action": action,
        "stance": stance,
        "reason": reason,
        "components": {
            "drawdownOpportunity": round(drawdown_component, 2),
            "sentimentOpportunity": round(sentiment_component, 2),
            "volatilityOpportunity": round(volatility_component, 2),
            "creditStabilityBonus": round(credit_stability_bonus, 2),
            "creditRisk": round(credit_risk, 2),
            "volatilityRisk": round(volatility_risk, 2),
            "trendRisk": round(trend_risk, 2),
            "overheatRisk": round(overheat_risk, 2),
            "dataPenalty": round(data_penalty, 2),
        },
    }


def add_decision_history(frame: pd.DataFrame) -> pd.DataFrame:
    decisions = frame.apply(calculate_decision_scores, axis=1, result_type="expand")
    out = frame.copy()
    out["opportunityScoreV2"] = decisions["opportunityScore"]
    out["riskScoreV2"] = decisions["riskScore"]
    out["actionV2"] = decisions["action"]
    out["stanceV2"] = decisions["stance"]
    return out


def summarize_action(group: pd.DataFrame) -> dict[str, Any]:
    usable = group.dropna(subset=["spyRet20dFwd", "spyRet60dFwd", "spyRealizedVol20dFwd", "spyMaxDrawdown20dFwd"])
    if usable.empty:
        return {"rows": int(len(group)), "usableRows": 0}
    return {
        "rows": int(len(group)),
        "usableRows": int(len(usable)),
        "avgOpportunityScore": round(float(group["opportunityScoreV2"].mean()), 2),
        "avgRiskScore": round(float(group["riskScoreV2"].mean()), 2),
        "avgSpyRet20dFwd": round(float(usable["spyRet20dFwd"].mean()), 4),
        "winRate20d": round(float((usable["spyRet20dFwd"] > 0).mean()), 4),
        "avgSpyRet60dFwd": round(float(usable["spyRet60dFwd"].mean()), 4),
        "avgRealizedVol20dFwd": round(float(usable["spyRealizedVol20dFwd"].mean()), 4),
        "avgMaxDrawdown20dFwd": round(float(usable["spyMaxDrawdown20dFwd"].mean()), 4),
    }


def current_trailing_vol(history: pd.DataFrame) -> float | None:
    values = history["spyRealizedVol20dTrailing"].dropna()
    return None if values.empty else float(values.iloc[-1])


def build_current_row(latest: dict[str, Any], trailing_vol: float | None) -> dict[str, Any]:
    values = latest.get("values") or {}
    scores = latest.get("scores") or {}
    row = dict(values)
    row.update(
        {
            "volatilityScore": scores.get("volatility", 0),
            "creditScore": scores.get("credit", 0),
            "sentimentScore": scores.get("sentiment", 0),
            "spyRealizedVol20dTrailing": trailing_vol if trailing_vol is not None else 14,
            "scoreInputCompleteness": 1.0,
        }
    )
    return row


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build calibrated decision model v2.")
    parser.add_argument("--history", type=Path, default=HISTORY_FILE)
    parser.add_argument("--latest", type=Path, default=LATEST_FILE)
    parser.add_argument("--output", type=Path, default=OUT_JSON)
    parser.add_argument("--history-output", type=Path, default=OUT_CSV)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    history = pd.read_csv(args.history)
    decision_history = add_decision_history(history)
    decision_history.to_csv(args.history_output, index=False)

    action_summary = {
        action: summarize_action(group)
        for action, group in decision_history.groupby("actionV2")
    }

    latest = json.loads(args.latest.read_text(encoding="utf-8"))
    current_row = build_current_row(latest, current_trailing_vol(history))
    current_decision = calculate_decision_scores(current_row)
    current_decision.update(
        {
            "asOf": latest.get("asOf"),
            "generatedAt": latest.get("generatedAt"),
            "oldScores": latest.get("scores"),
            "oldRegime": latest.get("regime", {}).get("key"),
            "keyInputs": {
                "vix": current_row.get("vix"),
                "spyDrawdown": current_row.get("spyDrawdown"),
                "qqqDrawdown": current_row.get("qqqDrawdown"),
                "fearGreed": current_row.get("fearGreed"),
                "creditScore": current_row.get("creditScore"),
                "hyOas": current_row.get("hyOas"),
                "igOas": current_row.get("igOas"),
                "nfci": current_row.get("nfci"),
                "dxyChange20d": current_row.get("dxyChange20d"),
                "kreRel20d": current_row.get("kreRel20d"),
                "spyRealizedVol20dTrailing": current_row.get("spyRealizedVol20dTrailing"),
            },
        }
    )

    payload = {
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "model": "decision_v2",
        "method": {
            "summary": "Separate opportunity and risk scores, then map to ADD / HOLD / SELL actions.",
            "rationale": [
                "Historical total stress score explained future volatility better than direction.",
                "Add signals require fear/drawdown plus non-systemic credit conditions.",
                "Sell/reduce signals require credit stress and high volatility; overheat alone is treated as a no-chase/rebalance signal, not a sell trigger.",
            ],
        },
        "currentDecision": current_decision,
        "historicalActionSummary": action_summary,
        "rules": {
            "ADD": "opportunityScore >= 70, riskScore <= 55, SPY drawdown <= -10%, creditScore <= 2",
            "ADD_SMALL": "opportunityScore >= 55, riskScore <= 50, SPY drawdown <= -5%, creditScore <= 2",
            "SELL": "credit stress + high trailing volatility while SPY drawdown is not fully flushed, or stronger credit/vol stress before deep capitulation",
            "HOLD": "default when neither add nor sell edge is strong enough",
        },
        "caveats": [
            "This is a decision-support model, not a guarantee or personalized investment advice.",
            "Historical samples for SELL are small, so SELL should be interpreted as reduce risk / hedge / sell a portion, not necessarily liquidate everything.",
            "Put/Call has current live data but lacks a reliable five-year public history, so it is not a major historical calibration driver.",
        ],
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {args.output.relative_to(ROOT)} and {args.history_output.relative_to(ROOT)} | "
        f"current_action={current_decision['action']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
