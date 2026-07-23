# Market Allocation Signal

Investor-facing U.S. equity allocation tool for deciding whether the current market backdrop favors adding risk, holding the current plan, or reducing exposure.

## Website Pages

- `index.html`: investor dashboard focused on the current ADD / ADD_SMALL / HOLD / REDUCE signal, score readout, core market state, key drivers, compact market context, and read-only input snapshot.
- `news.html`: complete twice-daily morning and close news briefs with date/edition archive and source links.
- `analysis.html`: evidence page showing daily collected market data, historical action replay, score buckets, rolling relationships, and regime risk/return.
- `research.html`: method and limits page explaining score construction, indicator rationale, decision rules, sources, and model limitations.

## Score Construction

The final model separates entry opportunity from risk-budget pressure:

- `Opportunity Score = drawdownOpportunity + sentimentOpportunity + volatilityOpportunity + creditStabilityBonus`, capped to 0-100.
- `Risk Score = creditRisk + volatilityRisk + trendRisk + overheatRisk + dataPenalty`, capped to 0-100.

The full component formulas, caps, and current component contributions are generated into `data/allocation_signal.json` under `method.scoreConstruction` and displayed on `research.html`.

## Data Update Model

Recommended deployment is GitHub Pages + GitHub Actions.

- `scripts/update_data.py` generates `data/latest.json` and `data/history.json`.
- `scripts/backfill_regime_history.py` rebuilds the five-year indicator history.
- `scripts/analyze_regime_history.py` generates `data/regime_model_quant_analysis.json`.
- `scripts/build_allocation_signal.py` generates `data/allocation_signal.json` and `data/allocation_signal_history.csv`.
- `scripts/build_daily_evidence.py` generates the daily Evidence dataset at `data/daily_evidence.json`.
- `scripts/build_news_index.py` indexes complete Markdown briefs from `data/news/` into `data/news_index.json`.
- `scripts/validate_news_archive.py` blocks publication when a report is incomplete or missing from the index.
- The frontend reads saved static JSON only; it does not fetch external market sources from the browser.

Market data is collected once per U.S. trading weekday after the cash close. Complete morning and close briefs are written locally by the two Codex brief automations. Each brief has a later conditional retry, while the News publisher validates and attempts publication twice per edition window. Repeated runs are idempotent when nothing changed.

## Local Preview

```powershell
python scripts/update_data.py
python scripts/backfill_regime_history.py --years 5
python scripts/analyze_regime_history.py
python scripts/build_allocation_signal.py
python scripts/build_daily_evidence.py
python scripts/build_news_index.py
python scripts/validate_news_archive.py
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
