# Market Regime Dashboard

美股市场状态判断工具。页面读取最近一次保存的市场快照，用波动率、回撤、情绪、信用和系统性风险五类指标判断当前属于正常回调、恐慌回调、极端恐慌、系统性风险或过热风险。

## Data Update Model

推荐部署方式是 GitHub Pages + GitHub Actions。

- `scripts/update_data.py` 抓取公开数据源并生成 `data/latest.json` 与 `data/history.json`
- `scripts/backfill_regime_history.py`、`scripts/analyze_regime_history.py`、`scripts/build_decision_model_v2.py` 生成 Quant Analysis 和 Research Method 页面使用的 5 年历史、统计结论和 v2 决策层
- GitHub Actions 每天美东时间 8:00、12:00、15:00 自动运行
- `scripts/update_briefing_from_codex.py` 从本地 Codex 投资简报自动化提取主要线索并生成 `data/briefing.json`
- 前端只读取已保存的静态 JSON，不在用户打开网页时现场抓取外部数据
- 浏览器每 2 分钟重新读取一次市场快照，每 5 分钟重新读取一次简报线索
- 估值分位当前未接入稳定公开免密钥数据源，因此暂不参与自动评分

这样页面打开速度快，也避免公共数据源的 CORS、冷启动和临时阻塞问题。

## Data Sources

- Yahoo Finance chart endpoint: VIX, SPY, QQQ, HYG, JNK, KRE, RSP, DXY, MOVE
- FRED: High Yield OAS, Investment Grade OAS, 10Y Treasury Yield, 10Y Real Yield, NFCI
- CNN Fear & Greed official dataviz endpoint
- AAII Sentiment Survey
- Cboe Daily Market Statistics

## Local Preview

```powershell
python scripts/update_data.py
python scripts/update_briefing_from_codex.py
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Website Pages

- `index.html`: current market dashboard and model library.
- `analysis.html`: charts for score buckets, rolling relationships, regime groups, and v2 action replay.
- `research.html`: standalone research-method tab explaining the methodology, indicator library, scoring rationale, data support, action rules, and limitations.

## Historical Backfill

Run this when you want an analysis-ready five-year history of the model library inputs, scores, regimes, and forward SPY return/volatility targets:

```powershell
python scripts/backfill_regime_history.py --years 5
```

For full AAII historical sentiment, install `xlrd` in the Python environment or provide `data/aaii_sentiment.csv` with date and bearish columns. Without that, the script falls back to the recent AAII webpage.

The script writes:

- `data/regime_model_history_5y.csv`: daily model inputs, score components, regime labels, input-coverage flags, and forward SPY return/volatility fields.
- `data/regime_model_history_5y.json`: the same history as JSON records.
- `data/regime_model_analysis_summary.json`: correlations and grouped forward-return/volatility summaries.

To refresh the quant-analysis data used by `analysis.html`, run:

```powershell
python scripts/analyze_regime_history.py
```

To refresh the calibrated add/hold/reduce decision layer after updating `data/latest.json`, run:

```powershell
python scripts/build_decision_model_v2.py
```

That writes `data/regime_model_decision_v2.json` for the current recommendation and `data/regime_model_decision_v2_history.csv` for historical action replay.

Historical source limits are recorded in the summary file. As of 2026, Cboe's public equity put/call ratio archive stops at 2019-10-04, and FRED's ICE BofA OAS series may only return a rolling recent window unless a licensed/third-party history source is supplied.

## GitHub Actions Schedule

GitHub cron runs in UTC. The workflow runs directly at the three scheduled UTC times below:

- `12:00 UTC` = 8:00 AM America/New_York during US daylight time
- `16:00 UTC` = 12:00 PM America/New_York during US daylight time
- `19:00 UTC` = 3:00 PM America/New_York during US daylight time

GitHub may start scheduled workflows late, so the job does not gate on the actual runtime hour. Whenever the schedule fires, it regenerates `data/latest.json` and appends the latest regime snapshot to `data/history.json`. Manual runs through `workflow_dispatch` always run immediately.

## Briefing Publisher

The briefing file is local-first because GitHub Actions cannot access Codex automation memories on the user's machine. A Codex cron automation can run:

```powershell
python scripts/update_briefing_from_codex.py
git add data/briefing.json
git commit -m "Update market briefing" # only when changed
git push
```

The website reads the latest committed `data/briefing.json`.

## Known Limits

- Public no-key data sources are not tick-by-tick.
- FRED credit/yield data is often T+1.
- NFCI is weekly.
- Valuation percentile is intentionally excluded from automatic scoring until a stable public source is wired in.
