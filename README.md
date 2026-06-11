# Market Regime Dashboard

美股市场状态判断工具。前端展示当前市场属于正常回调、恐慌回调、极端恐慌、系统性风险或过热风险中的哪一种，并把结论拆成波动率、回撤、情绪、信用和系统性风险五类指标。

## Vercel Architecture

推荐部署到 Vercel。

- Frontend: `index.html`, `styles.css`, `app.js`
- Live API: `api/market-data.py`
- API cache: 120 秒
- API fallback: 如果实时抓取失败，返回 `data/latest.json` 并在页面标注 fallback

前端读取顺序：

1. `/api/market-data`
2. `data/latest.json`

所以同一份代码也能在 GitHub Pages 上运行，只是 GitHub Pages 没有服务端 API，会回退到静态快照。

## Data Sources

- Yahoo Finance chart endpoint: VIX, SPY, QQQ, HYG, JNK, KRE, RSP, DXY, MOVE
- FRED: High Yield OAS, Investment Grade OAS, 10Y Treasury Yield, 10Y Real Yield, NFCI
- CNN Fear & Greed official dataviz endpoint
- AAII Sentiment Survey
- Cboe Daily Market Statistics

## Local Preview

静态回退预览：

```powershell
python scripts/update_data.py
python -m http.server 4173 --bind 127.0.0.1
```

Vercel API 本地预览需要 Vercel CLI：

```powershell
npm i -g vercel
vercel dev
```

## Deployment

在 Vercel 导入这个 GitHub repo，Framework Preset 选 `Other`，Build Command 留空，Output Directory 留空。

或使用 CLI：

```powershell
vercel --prod
```

## Known Limits

- 公共免费数据源并非 tick-by-tick 数据，FRED 和 NFCI 本身存在日频或周频延迟。
- Vercel API 以 120 秒为缓存周期，适合作为准实时市场状态工具。
- 估值分位暂无无密钥稳定数据源，当前使用中性占位值，避免误触发过热。
