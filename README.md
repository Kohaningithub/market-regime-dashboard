# Market Allocation Signal

Investor-facing U.S. equity allocation tool for deciding whether the current market backdrop favors adding risk, holding the current plan, or reducing exposure.

## Website Pages

- `index.html`: final allocation dashboard with the current ADD / ADD_SMALL / HOLD / REDUCE signal.
- `analysis.html`: evidence page showing historical action replay, score buckets, rolling relationships, and regime risk/return.
- `research.html`: method and limits page explaining indicators, decision rules, data support, and model limitations.

## Data Update Model

Recommended deployment is GitHub Pages + GitHub Actions.

- `scripts/update_data.py` generates `data/latest.json` and `data/history.json`.
- `scripts/backfill_regime_history.py` rebuilds the five-year indicator history.
- `scripts/analyze_regime_history.py` generates `data/regime_model_quant_analysis.json`.
- `scripts/build_allocation_signal.py` generates `data/allocation_signal.json` and `data/allocation_signal_history.csv`.
- The frontend reads saved static JSON only; it does not fetch external market sources from the browser.

## Local Preview

```powershell
python scripts/update_data.py
python scripts/backfill_regime_history.py --years 5
python scripts/analyze_regime_history.py
python scripts/build_allocation_signal.py
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Data Sources

- Yahoo Finance chart endpoint: VIX, MOVE, SPY, QQQ, HYG, JNK, KRE, RSP, DXY.
- FRED: HY OAS, IG OAS, 10Y Treasury Yield, 10Y Real Yield, NFCI.
- CNN Fear & Greed official dataviz endpoint.
- AAII Sentiment Survey.
- Cboe Daily Market Statistics.

## Known Limits

- Public no-key data sources are not tick-by-tick.
- FRED credit/yield data is often T+1.
- NFCI is weekly.
- Put/Call has current data but lacks a reliable five-year public history in the current pipeline.
- The signal is decision support, not personalized investment advice.
