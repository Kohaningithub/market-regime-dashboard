# Market Allocation Signal 最终版研究报告

生成日期：2026-07-23  
样本区间：2021-07-26 至 2026-07-23，共 1,254 个交易日  
当前快照日期：2026-07-23  
主要数据文件：`data/latest.json`、`data/regime_model_quant_analysis.json`、`data/allocation_signal.json`

## 1. 执行摘要

本工具的目标是把跨市场指标转化为一个可执行的仓位信号：`ADD`、`ADD_SMALL`、`HOLD`、`REDUCE`。它不是预测明天涨跌，而是帮助投资者判断当前是否有足够强的边际去加仓，是否应维持原计划，或是否应降低一部分风险敞口。

截至 2026-07-23，最终信号为：

**HOLD / 维持。**

当前 Opportunity Score 为 `27.13`，Risk Score 为 `0.00`。VIX `18.77`，SPY 回撤 `-2.22%`，QQQ 回撤 `-6.50%`，Fear & Greed `43`，AAII Bearish `42.3%`，HY OAS `2.69%`，IG OAS `0.78%`，NFCI `-0.55`。市场有轻微回撤和部分情绪压力，但信用和系统性风险稳定，因此还不是高胜率加仓窗口，也没有减仓信号。

## 2. 最终信号逻辑

仓位信号分两条线：

1. **Opportunity Score**  
   衡量是否出现值得加仓的价格折扣和恐慌窗口。主要来自 SPY/QQQ 回撤、恐慌情绪、波动释放，以及信用稳定度。

2. **Risk Score**  
   衡量是否需要降低风险预算。主要来自信用利差、HYG/JNK、NFCI、DXY、银行股相对表现和实现波动率。

最终规则不是“压力越高越买”或“压力越高越减仓”。更合理的解释是：

- 回撤 + 恐慌 + 信用稳定 = 加仓机会。
- 普通波动 + 信用稳定 = 维持。
- 情绪偏热 = 不追高或再平衡，不等同于减仓。
- 信用压力 + 高波动 + 尚未充分出清 = 减仓。

### 2.1 分数计算方式

两个分数都使用 0-100 区间。每个分项先按公式计算，再按分项上限封顶，最后总分再封顶到 0-100。

**Opportunity Score**

`Opportunity Score = clamp(drawdownOpportunity + sentimentOpportunity + volatilityOpportunity + creditStabilityBonus, 0, 100)`

| 分项 | 上限 | 计算方式 | 含义 |
|---|---:|---|---|
| Drawdown opportunity | 30 | `min(30, max(0, -SPY drawdown) * 2.2 + max(0, -QQQ drawdown) * 0.35)` | SPY/QQQ 回撤越深，价格折扣越明显，机会分越高。 |
| Sentiment opportunity | 25 | `min(25, sentimentPressure * 3 + max(0, 40 - FearGreed) * 0.55 + max(0, AAII bearish - 40) * 0.28 + max(0, PutCall - 0.75) * 12)` | 恐慌情绪在信用稳定时有反向意义。 |
| Volatility opportunity | 20 | `min(20, volatilityPressure * 2.2 + max(0, VIX - 20) * 0.65 + max(0, VIX 5D change) * 0.65 + max(0, MOVE - 120) * 0.15)` | 温和波动释放可提高机会分，但单靠恐慌不能无限推高加仓信号。 |
| Credit stability bonus | 15 | `max(0, 15 - creditPressure * 4 - max(0, HY OAS - 4.5) * 4 - max(0, NFCI) * 7)` | 信用和金融条件稳定时才给机会分加分。 |

**Risk Score**

`Risk Score = clamp(creditRisk + volatilityRisk + trendRisk + overheatRisk + dataPenalty, 0, 100)`

| 分项 | 上限 | 计算方式 | 含义 |
|---|---:|---|---|
| Credit risk | 42 | `min(42, creditPressure * 9 + max(0, HY OAS - 4.5) * 7 + max(0, HY OAS 20D change - 75bp) * 0.08 + max(0, IG OAS - 1.25) * 8 + max(0, IG OAS 20D change - 25bp) * 0.1 + max(0, NFCI) * 12 + max(0, -KRE/SPY 20D relative - 8) * 1.5 + max(0, DXY 20D change - 3) * 5)` | 最大风险桶，反映信用利差、金融条件、美元压力和银行股相对表现。 |
| Volatility risk | 28 | `min(28, max(0, SPY trailing 20D realized vol - 14) * 1.1 + volatilityPressure * 2 + max(0, VIX - 25) * 1.2 + max(0, VIX 5D change - 5) * 1.3)` | 衡量波动是否高到需要收缩组合风险预算。 |
| Trend risk | 18 | `min(18, max(0, -HYG 20D return - 3) * 2 + max(0, -JNK 20D return - 3) * 2 + max(0, -RSP/SPY 60D relative - 5) + max(0, -SPY drawdown - 12) * 0.7)` | 捕捉信用 ETF 下跌、市场宽度恶化和深度回撤。 |
| Overheat risk | 12 | `min(12, max(0, FearGreed - 70) * 0.4 + max(0, 16 - VIX) * 0.5 + 4 if SPY drawdown >= -2 and FearGreed >= 70)` | 识别拥挤乐观；它主要代表不追高，不单独触发减仓。 |
| Data penalty | 10 | `max(0, (1 - scoreInputCompleteness) * 10)` | 输入缺失时提高谨慎程度。 |

当前 2026-07-23 的分项贡献为：Drawdown opportunity `7.16`，Sentiment opportunity `3.64`，Volatility opportunity `1.33`，Credit stability bonus `15.00`，合计 Opportunity Score `27.13`；Credit risk、Volatility risk、Trend risk、Overheat risk 和 Data penalty 均为 `0.00`，因此 Risk Score 为 `0.00`。

## 3. 指标库

| 模块 | 指标 | 角色 |
|---|---|---|
| 波动 | VIX、VIX 5D 变化、MOVE、SPY realized vol | 判断避险需求和风险预算是否收缩 |
| 回撤和趋势 | SPY drawdown、QQQ drawdown、RSP/SPY | 判断价格折扣、成长股压力和市场宽度 |
| 情绪 | Fear & Greed、AAII Bearish、Put/Call | 在信用稳定时识别反向加仓机会 |
| 信用和流动性 | HYG/JNK、HY OAS、IG OAS、DXY、NFCI、KRE/SPY | 仓位风险门槛，决定恐慌是否可以转化为加仓 |
| 利率环境 | 10Y、real 10Y、MOVE | 解释宏观背景和估值折现压力 |

## 4. 数据支持

### 4.1 压力指标更擅长解释波动

| 关系 | Spearman 相关 |
|---|---:|
| 压力分与未来 20D SPY 收益 | 0.1688 |
| 压力分与未来 20D SPY 实现波动率 | 0.5064 |
| 压力分与未来 20D 最大回撤 | -0.0821 |

结论：压力指标对未来波动的解释力强于对方向收益的解释力。因此最终工具不把压力分直接当作买卖方向，而是把它拆入机会和风险两条线。

### 4.2 高压力环境常有反弹机会，但波动更高

| 压力组 | 20D 平均收益 | 20D 胜率 |
|---|---:|---:|
| 低压力组 | +0.75% | 63.9% |
| 高压力组 | +3.01% | 70.8% |

结论：高压力不应被机械解读为减仓。若信用稳定，高压力更可能代表分批加仓窗口；但由于后续波动更高，执行上仍应分批。

### 4.3 动作回放

| 动作 | 可用样本 | 20D 平均收益 | 20D 胜率 | 60D 平均收益 | 20D 平均最大回撤 |
|---|---:|---:|---:|---:|---:|
| ADD | 34 | +5.26% | 82.4% | +6.54% | -2.59% |
| ADD_SMALL | 84 | +2.69% | 64.3% | +4.12% | -3.59% |
| HOLD | 1,059 | +0.82% | 64.5% | +3.09% | -2.47% |
| REDUCE | 17 | -0.74% | 35.3% | -1.60% | -5.21% |

结论：强加仓窗口历史表现最好，但样本不多，且出现在高波动环境。减仓窗口样本更少，应作为风险预算警报，而不是机械清仓指令。

## 5. 当前判断

| 项目 | 当前值 |
|---|---:|
| 最终仓位信号 | HOLD / 维持 |
| Opportunity Score | 27.13 |
| Risk Score | 0.00 |
| Volatility Pressure | 0 |
| Credit Pressure | 0 |
| Sentiment Pressure | 1 |
| VIX | 18.77 |
| VIX 5D 变化 | +2.04 |
| MOVE | 70.88 |
| SPY drawdown | -2.22% |
| QQQ drawdown | -6.50% |
| Fear & Greed | 43 |
| AAII Bearish | 42.3% |
| Put/Call | 0.67 |
| HY OAS | 2.69% |
| IG OAS | 0.78% |
| NFCI | -0.55 |
| DXY 20D 变化 | -0.21% |
| KRE/SPY 20D 相对收益 | -0.76% |

当前解释：

- 回撤仍偏浅：SPY 回撤 `-2.22%`，QQQ 回撤 `-6.50%`，价格折扣不够深。
- 情绪略偏谨慎：AAII Bearish 高于 40%，但 Fear & Greed 仍在中性区间。
- 信用稳定：HY OAS、IG OAS、NFCI 均未显示系统性压力。
- 波动未失控：VIX 和 MOVE 都低于主要风险阈值。

因此，当前最合理动作是维持现有配置、定投和再平衡纪律；继续观察回撤是否加深、恐慌是否升温，以及信用压力是否扩散。

## 6. 使用方式

### ADD

当机会分高、风险分可控、SPY 已有较深回撤且信用压力不高时触发。适合分批增加权益风险敞口。

### ADD_SMALL

当机会信号已经出现但条件未完全成熟时触发。适合小幅加快定投或再平衡，不适合一次性重仓。

### HOLD

默认状态。没有足够强的加仓边际，也没有系统性减仓信号。适合维持既定配置纪律。

### REDUCE

当信用压力与高波动同步出现时触发。适合降低一部分风险敞口、对冲，或优先处理高 beta、杠杆和流动性较弱的仓位。

## 7. Limitations

1. 样本约 5 年，不代表所有长期市场环境。
2. 前瞻 20D/60D 收益窗口重叠，统计结果应视为经验倾向。
3. REDUCE 样本只有 17 个，不能过度拟合。
4. Put/Call 当前可用，但缺乏可靠 5 年公开历史。
5. HY/IG OAS 和 NFCI 存在数据延迟或频率限制。
6. 模型以 SPY 为市场代理，不等同于具体组合。
7. 未纳入稳定公开估值分位，估值仍需独立判断。
8. 本工具是决策辅助，不是个性化投资建议，也不保证收益。

## 8. 复现命令

```powershell
python scripts/update_data.py
python scripts/backfill_regime_history.py --years 5 --end-date 2026-07-23
python scripts/analyze_regime_history.py
python scripts/build_allocation_signal.py
python -m http.server 4174 --bind 127.0.0.1
```

## 9. 数据源

| 数据 | 来源 |
|---|---|
| SPY、QQQ、HYG、JNK、KRE、RSP、DXY、VIX、MOVE | Yahoo Finance chart endpoint |
| HY OAS | https://fred.stlouisfed.org/series/BAMLH0A0HYM2 |
| IG OAS | https://fred.stlouisfed.org/series/BAMLC0A0CM |
| 10Y Treasury Yield | https://fred.stlouisfed.org/series/DGS10 |
| 10Y Real Yield | https://fred.stlouisfed.org/series/DFII10 |
| NFCI | https://fred.stlouisfed.org/series/NFCI |
| Fear & Greed | https://www.cnn.com/markets/fear-and-greed |
| AAII Sentiment | https://www.aaii.com/sentimentsurvey/sent_results |
| Cboe Put/Call | https://www.cboe.com/us/options/market_statistics/daily/ |
