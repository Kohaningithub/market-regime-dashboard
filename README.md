# Market Regime Dashboard

美股市场状态判断工具。页面读取最近一次保存的市场快照，用波动率、回撤、情绪、信用和系统性风险五类指标判断当前属于正常回调、恐慌回调、极端恐慌、系统性风险或过热风险。

## Data Update Model

推荐部署方式是 GitHub Pages + GitHub Actions。

- `scripts/update_data.py` 抓取公开数据源并生成 `data/latest.json`
- GitHub Actions 每天美东时间 8:00、12:00、15:00 自动运行
- `scripts/update_briefing_from_codex.py` 从本地 Codex 投资简报自动化提取主要线索并生成 `data/briefing.json`
- 前端只读取 `data/latest.json` 和 `data/briefing.json`，不在用户打开网页时现场抓取数据
- 浏览器每 2 分钟重新读取一次市场快照，每 5 分钟重新读取一次简报线索

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

## GitHub Actions Schedule

GitHub cron runs in UTC. The workflow runs directly at the three scheduled UTC times below:

- `12:00 UTC` = 8:00 AM America/New_York during US daylight time
- `16:00 UTC` = 12:00 PM America/New_York during US daylight time
- `19:00 UTC` = 3:00 PM America/New_York during US daylight time

GitHub may start scheduled workflows late, so the job does not gate on the actual runtime hour. Whenever the schedule fires, it generates `data/latest.json` and commits it when values changed. Manual runs through `workflow_dispatch` always run immediately.

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
- Valuation percentile currently uses a neutral placeholder because there is no stable no-key source wired in.
