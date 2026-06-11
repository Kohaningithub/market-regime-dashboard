# Market Regime Dashboard

公开静态网站，用五类指标判断美股当前风险状态。网站默认读取 `data/latest.json`，由 GitHub Actions 定时更新：

- 波动率指标
- 股市回撤指标
- 情绪指标
- 信用市场指标
- 系统性风险指标

核心输出：

- Volatility Panic Score
- Credit Stress Score
- Sentiment Fear Score
- 四种市场场景分类
- Overheated Risk 覆盖提示

## Local preview

实时数据模式需要通过静态服务器预览：

```powershell
python scripts/update_data.py
python -m http.server 4173 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:4173/`。

## GitHub Pages

这个项目不需要构建步骤，GitHub Pages 可以直接从 `main` 分支根目录发布。

生产数据接入建议：

1. GitHub Actions 拉取 FRED、Yahoo Finance、Cboe、AAII 数据。
2. Actions 生成并提交公开 `data/latest.json`。
3. 前端读取 JSON，避免在浏览器暴露 API key。

当前限制：

- CNN Fear & Greed endpoint 会拒绝自动请求，因此自动版使用 proxy 并在页面标记为 estimated。
- Cboe 免费历史 Put/Call CSV 当前只到 2019，因此自动版使用 Cboe Daily Market Statistics 当前日 Equity Put/Call。
- 估值分位暂无无密钥稳定数据源，自动版使用中性占位值，避免误触发过热。
