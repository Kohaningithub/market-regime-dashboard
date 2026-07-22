const ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const DECISION_ENDPOINT = "data/regime_model_decision_v2.json";
const LATEST_ENDPOINT = "data/latest.json";

const actionLabels = {
  ADD: "加仓",
  ADD_SMALL: "小幅分批加仓",
  HOLD: "维持",
  SELL: "减仓/卖出一部分",
};

const indicatorRows = [
  {
    module: "波动",
    indicators: "VIX、VIX 5D 变化、MOVE",
    reason: "衡量权益和利率市场的避险需求。波动快速上行通常代表仓位去杠杆和风险预算收缩。",
    role: "原始压力分；v2 同时进入机会分和风险分。",
  },
  {
    module: "回撤和趋势",
    indicators: "SPY/QQQ drawdown、RSP/SPY、SPY 20D trailing vol",
    reason: "识别价格是否已经充分调整，以及上涨是否过度集中在少数权重股。",
    role: "v2 机会分的核心输入，也用于趋势风险识别。",
  },
  {
    module: "情绪",
    indicators: "CNN Fear & Greed、AAII Bearish、Put/Call",
    reason: "恐慌情绪在中期经常对应反向机会，但单独使用会过早或过晚。",
    role: "原始情绪分；v2 中提高 opportunity，但不自动触发买入。",
  },
  {
    module: "信用和流动性",
    indicators: "HYG/JNK、HY OAS、IG OAS、DXY、NFCI、KRE/SPY",
    reason: "信用压力扩散通常比单纯股市波动更接近系统性风险。",
    role: "v2 risk gate。信用不稳时，高恐慌分不直接转为加仓。",
  },
  {
    module: "利率环境",
    indicators: "10Y、real 10Y、MOVE",
    reason: "利率和实际利率影响估值折现、久期资产和信用压力的传导。",
    role: "辅助解释宏观背景；当前不作为单独动作触发器。",
  },
];

const limits = [
  "样本只有 5 年，包含 2022 加息熊市和若干快速反弹窗口，但不覆盖完整长期周期。",
  "Cboe 公开 equity put/call 历史在当前抓取方式下无法覆盖完整 5 年，因此历史缺失率需要单独披露。",
  "FRED 信用利差和 NFCI 存在 T+1 或周频特征，不能当作盘中实时风险开关。",
  "模型用 SPY 作为市场代理，不等同于具体组合、行业、久期、现金流和税务约束。",
  "打分规则是决策辅助，不是自动交易系统；需要结合估值、盈利、政策事件和组合风险预算。",
  "v2 规则来自历史回放和经济含义校准，仍可能过拟合；未来应加入 out-of-sample 和 walk-forward 验证。",
];

function $(selector) {
  return document.querySelector(selector);
}

function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(digits);
}

function fmtPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toFixed(digits)}%`;
}

function fmtRate(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function fmtDateTime(isoText) {
  if (!isoText) return "--";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return isoText;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function oldScoreText(scores = {}) {
  const total = (scores.volatility || 0) + (scores.credit || 0) + (scores.sentiment || 0);
  return `${total} (${scores.volatility || 0}/${scores.credit || 0}/${scores.sentiment || 0})`;
}

function renderCurrent(decision, latest) {
  const current = decision.currentDecision;
  $("#research-current-title").textContent = `${current.stance || actionLabels[current.action] || current.action} | ${current.asOf}`;
  $("#current-reason").textContent = current.reason || "当前没有可显示的模型解释。";
  $("#current-opportunity").textContent = fmtNum(current.opportunityScore, 1);
  $("#current-risk").textContent = fmtNum(current.riskScore, 1);
  $("#current-old-score").textContent = oldScoreText(latest.scores);
}

function renderSnapshot(analysis, decision) {
  const meta = analysis.meta;
  $("#snapshot-list").innerHTML = `
    <div><dt>样本区间</dt><dd>${meta.startDate} - ${meta.endDate}</dd></div>
    <div><dt>交易日样本</dt><dd>${meta.rows}</dd></div>
    <div><dt>平均输入覆盖率</dt><dd>${fmtRate(meta.avgCompleteness)}</dd></div>
    <div><dt>数据生成时间</dt><dd>${fmtDateTime(decision.generatedAt)}</dd></div>
  `;
}

function renderFindings(analysis, decision) {
  const headline = analysis.headline;
  const current = decision.currentDecision;
  const cards = [
    {
      label: "分数更擅长解释什么",
      value: fmtNum(headline.scoreTotalVol20Spearman, 2),
      copy: `Score 与未来 20D 波动的 Spearman 相关；未来 20D 收益相关只有 ${fmtNum(
        headline.scoreTotalReturn20Spearman,
        2
      )}。`,
    },
    {
      label: "高压力后的平均反弹",
      value: fmtPct(headline.highScoreAvgReturn20),
      copy: `Score 5+ 后续 20D 胜率 ${fmtRate(headline.highScoreWinRate20)}，但伴随更高实现波动。`,
    },
    {
      label: "当前 v2 动作",
      value: current.stance || actionLabels[current.action],
      copy: `机会分 ${fmtNum(current.opportunityScore, 1)}，风险分 ${fmtNum(current.riskScore, 1)}。`,
    },
    {
      label: "核心方法变化",
      value: "拆分机会/风险",
      copy: "高压力不直接等于卖出；信用稳定时可能是加仓窗口，信用恶化时才优先防守。",
    },
  ];
  $("#finding-grid").innerHTML = cards
    .map(
      (card) => `
        <article class="finding-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.copy}</p>
        </article>
      `
    )
    .join("");
}

function renderIndicators() {
  $("#indicator-table").innerHTML = indicatorRows
    .map(
      (row) => `
        <tr>
          <td><strong>${row.module}</strong></td>
          <td>${row.indicators}</td>
          <td>${row.reason}</td>
          <td>${row.role}</td>
        </tr>
      `
    )
    .join("");
}

function renderEvidence(analysis, decision) {
  const meta = analysis.meta;
  const headline = analysis.headline;
  const add = decision.historicalActionSummary.ADD;
  const sell = decision.historicalActionSummary.SELL;
  const cards = [
    {
      label: "ADD 历史回放",
      value: fmtPct(add.avgSpyRet20dFwd),
      copy: `${add.usableRows} 个可用样本，20D 胜率 ${fmtRate(add.winRate20d)}。`,
    },
    {
      label: "SELL 历史回放",
      value: fmtPct(sell.avgSpyRet20dFwd),
      copy: `${sell.usableRows} 个可用样本，样本少，更多用于风险警报而非收益预测。`,
    },
    {
      label: "高分 vs 低分",
      value: `${fmtPct(headline.highScoreAvgReturn20)} / ${fmtPct(headline.lowScoreAvgReturn20)}`,
      copy: "20D 平均收益，高分组更高，但也更波动。",
    },
    {
      label: "数据缺口",
      value: `${fmtRate(meta.putCallMissingShare)} / ${fmtRate(meta.oasMissingShare)}`,
      copy: "分别为 Put/Call 和 OAS 历史缺失率，解释结果时必须保留。",
    },
  ];
  $("#evidence-grid").innerHTML = cards
    .map(
      (card) => `
        <article class="evidence-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.copy}</p>
        </article>
      `
    )
    .join("");
}

function renderActionTable(decision) {
  const order = ["ADD", "ADD_SMALL", "HOLD", "SELL"];
  $("#action-table").innerHTML = order
    .map((action) => {
      const row = decision.historicalActionSummary[action];
      return `
        <tr>
          <td><strong>${actionLabels[action]}</strong><small>${action}</small></td>
          <td class="numeric">${row.usableRows}</td>
          <td class="numeric">${fmtPct(row.avgSpyRet20dFwd)}</td>
          <td class="numeric">${fmtRate(row.winRate20d)}</td>
          <td class="numeric">${fmtPct(row.avgSpyRet60dFwd)}</td>
          <td class="numeric">${fmtPct(row.avgMaxDrawdown20dFwd)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderLimits() {
  $("#limit-list").innerHTML = limits.map((item) => `<li>${item}</li>`).join("");
}

async function init() {
  try {
    const [analysisResponse, decisionResponse, latestResponse] = await Promise.all([
      fetch(`${ANALYSIS_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${DECISION_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${LATEST_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (!analysisResponse.ok) throw new Error(`analysis HTTP ${analysisResponse.status}`);
    if (!decisionResponse.ok) throw new Error(`decision HTTP ${decisionResponse.status}`);
    if (!latestResponse.ok) throw new Error(`latest HTTP ${latestResponse.status}`);
    const [analysis, decision, latest] = await Promise.all([
      analysisResponse.json(),
      decisionResponse.json(),
      latestResponse.json(),
    ]);
    renderCurrent(decision, latest);
    renderSnapshot(analysis, decision);
    renderFindings(analysis, decision);
    renderIndicators();
    renderEvidence(analysis, decision);
    renderActionTable(decision);
    renderLimits();
  } catch (error) {
    $(".research-page").innerHTML = `
      <section class="research-panel">
        <p class="eyebrow">Load Error</p>
        <h2>研究数据未加载成功</h2>
        <p>${error.message}</p>
      </section>
    `;
  }
}

init();
