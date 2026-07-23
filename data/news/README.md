# Complete news briefs

Automation output is stored as UTF-8 Markdown using one of these filenames:

- `YYYY-MM-DD_morning.md`
- `YYYY-MM-DD_close.md`

Each report may start with this optional front matter:

```yaml
---
title: 2026-07-23 早盘投资动态简报
summary: 当天最重要的市场主线
generatedAt: 2026-07-23T08:46:00-04:00
---
```

Run `python scripts/build_news_index.py` after adding or replacing a report.
