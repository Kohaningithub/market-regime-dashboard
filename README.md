# Market Regime Dashboard

公开静态网站，用五类指标判断美股当前风险状态：

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

直接打开 `index.html` 即可预览。也可以用任何静态服务器托管当前目录。

## GitHub Pages

这个项目不需要构建步骤，GitHub Pages 可以直接从 `main` 分支根目录发布。

生产数据接入建议：

1. 用 GitHub Actions 定时拉取 FRED、Cboe、AAII、ETF价格和商业行情源。
2. 在 Actions 中生成公开 `data/latest.json`。
3. 前端读取 JSON，避免在浏览器暴露 API key。
