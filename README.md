# Market Allocation Signal

Investor-facing U.S. equity allocation tool for deciding whether the current market backdrop favors adding risk, holding the current plan, or reducing exposure.

## Website Pages

- Chinese: `index.html`, `news.html`, `analysis.html`, and `research.html`.
- English: `index-en.html`, `news-en.html`, `analysis-en.html`, and `research-en.html`.
- Both editions share the same market datasets and model calculations. Each page provides a direct language switch.
- News briefs are generated and archived independently in both languages.

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
- `scripts/build_news_index.py` indexes Chinese briefs from `data/news/` and English briefs from `data/news-en/`.
- `scripts/validate_news_archive.py` blocks publication unless both language editions are complete and indexed.
- The frontend reads saved static JSON only; it does not fetch external market sources from the browser.

Market data is collected during the U.S. morning session and after the cash close. Each window has staggered retry schedules because GitHub scheduled jobs can be delayed; a freshness guard skips redundant retries after the first successful refresh. The current snapshot is rebuilt on every required run, while the expensive five-year calibration is refreshed weekly or on demand. Complete morning and close briefs are written locally by the two Codex brief automations, and the News publisher retries after each edition so a slower report generation cannot miss the publication window.

## Local Preview

```powershell
python scripts/update_data.py
python scripts/build_allocation_signal.py
python scripts/build_daily_evidence.py
python scripts/build_news_index.py
python scripts/validate_news_archive.py
python -m http.server 4173 --bind 127.0.0.1
```

The weekly calibration additionally runs:

```powershell
python scripts/backfill_regime_history.py --years 5
python scripts/analyze_regime_history.py
python scripts/build_allocation_signal.py
python scripts/build_daily_evidence.py
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
