const ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";

const actionLabels = {
  ADD: "加仓",
  ADD_SMALL: "小幅分批加仓",
  HOLD: "维持",
  REDUCE: "减仓",
};

const indicatorRows = [
  {
    module: "波动",
    indicators: "VIX、VIX 5D 变化、MOVE、SPY 20D realized vol",
    reason: "衡量权益和利率市场的避险需求。波动快速上行通常代表去杠杆和风险预算收缩。",
    role: "判断风险是否扩散，也判断恐慌是否已经形成可分批加仓的价格折扣。",
  },
  {
    module: "回撤和趋势",
    indicators: "SPY/QQQ drawdown、RSP/SPY",
    reason: "识别价格是否已经充分调整，以及上涨或下跌是否过度集中在少数权重股。",
    role: "回撤主要提高机会分；趋势破坏和市场宽度恶化会提高风险分。",
  },
  {
    module: "情绪",
    indicators: "CNN Fear & Greed、AAII Bearish、Put/Call",
    reason: "恐慌情绪在中期常有反向意义，但单独使用容易过早或过晚。",
    role: "在信用稳定时提高加仓机会；在信用恶化时只作为风险环境的补充证据。",
  },
  {
    module: "信用和流动性",
    indicators: "HYG/JNK、HY OAS、IG OAS、DXY、NFCI、KRE/SPY",
    reason: "信用压力扩散通常比单纯股市波动更接近系统性风险。",
    role: "最重要的风险门槛。信用不稳时，恐慌不能直接转化为加仓。",
  },
  {
    module: "利率环境",
    indicators: "10Y、real 10Y、MOVE",
    reason: "利率和实际利率影响估值折现、久期资产和信用压力传导。",
    role: "作为宏观背景和波动解释变量，不作为单独动作触发器。",
  },
];

const limits = [
  "样本覆盖约 5 年，包含加息周期、熊市、银行压力和若干反弹窗口，但仍不能代表所有长期市场环境。",
  "20D/60D 前瞻收益窗口彼此重叠，因此统计结果是经验倾向，不是严格独立样本显著性检验。",
  "减仓信号样本较少，应理解为降低风险预算、减持一部分或对冲，不是机械清仓。",
  "Cboe 公开 equity put/call 历史在当前抓取方式下无法覆盖完整 5 年，历史分析需披露该缺口。",
  "FRED 信用利差和 NFCI 存在 T+1 或周频特征，不能当作盘中实时风险开关。",
  "模型以 SPY 作为市场代理，不等同于具体组合、行业、久期、现金流和税务约束。",
  "仓位信号是决策辅助，不是个性化投资建议；执行前仍需结合组合目标、估值、盈利和风险承受能力。",
];

function $(selector) {
  return document.querySelector(selector);
}

function dataUrl(endpoint) {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set("t", Date.now());
  return url.toString();
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pressureScoreText(scores = {}) {
  const total = (scores.volatility || 0) + (scores.credit || 0) + (scores.sentiment || 0);
  return `${total} (${scores.volatility || 0}/${scores.credit || 0}/${scores.sentiment || 0})`;
}

function renderCurrent(signal) {
  const current = signal.currentSignal;
  $("#research-current-title").textContent = `${current.stance || actionLabels[current.action] || current.action} | ${current.asOf}`;
  $("#current-reason").textContent = current.reason || "当前没有可显示的模型解释。";
  $("#current-opportunity").textContent = fmtNum(current.opportunityScore, 1);
  $("#current-risk").textContent = fmtNum(current.riskScore, 1);
  $("#current-pressure").textContent = pressureScoreText(current.pressureScores);
}

function renderSnapshot(analysis, signal) {
  const meta = analysis.meta;
  $("#snapshot-list").innerHTML = `
    <div><dt>样本区间</dt><dd>${meta.startDate} - ${meta.endDate}</dd></div>
    <div><dt>交易日样本</dt><dd>${meta.rows}</dd></div>
    <div><dt>平均输入覆盖率</dt><dd>${fmtRate(meta.avgCompleteness)}</dd></div>
    <div><dt>数据生成时间</dt><dd>${fmtDateTime(signal.generatedAt)}</dd></div>
  `;
}

function renderFindings(analysis, signal) {
  const headline = analysis.headline;
  const current = signal.currentSignal;
  const cards = [
    {
      label: "当前仓位信号",
      value: current.stance || actionLabels[current.action],
      copy: `机会分 ${fmtNum(current.opportunityScore, 1)}，风险分 ${fmtNum(current.riskScore, 1)}。`,
    },
    {
      label: "信号最擅长识别",
      value: fmtNum(headline.scoreTotalVol20Spearman, 2),
      copy: `压力分与未来 20D 波动的 Spearman 相关；未来 20D 收益相关为 ${fmtNum(
        headline.scoreTotalReturn20Spearman,
        2
      )}。`,
    },
    {
      label: "高压力后的反弹倾向",
      value: fmtPct(headline.highScoreAvgReturn20),
      copy: `高压力组后续 20D 胜率 ${fmtRate(headline.highScoreWinRate20)}，但波动也更高。`,
    },
    {
      label: "最终使用原则",
      value: "先看信用门槛",
      copy: "恐慌和回撤只有在信用稳定时才支持加仓；信用恶化时优先降低风险预算。",
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

function scoreGroupLabel(groupKey) {
  return groupKey === "opportunityScore" ? "Opportunity Score" : "Risk Score";
}

function renderScoreConstruction(signal) {
  const construction = signal.method?.scoreConstruction;
  const components = signal.currentSignal?.components || {};
  if (!construction) {
    $("#score-construction-scale").textContent = "当前数据文件尚未包含分数公式说明。";
    $("#score-formula-table").innerHTML = "";
    $("#score-component-breakdown").innerHTML = "";
    return;
  }

  $("#score-construction-scale").textContent =
    construction.scale || "两个分数都是 0-100 分，先计算各分项，再按上限封顶。";
  $("#opportunity-formula").textContent = construction.opportunityScore?.formula || "--";
  $("#risk-formula").textContent = construction.riskScore?.formula || "--";

  const rows = ["opportunityScore", "riskScore"].flatMap((groupKey) => {
    const group = construction[groupKey] || {};
    return (group.components || []).map((component) => ({
      group: scoreGroupLabel(groupKey),
      ...component,
      current: components[component.key],
    }));
  });

  $("#score-component-breakdown").innerHTML = rows
    .map((row) => {
      const current = Number(row.current || 0);
      const cap = Number(row.cap || 100);
      return `
        <article class="score-component-card">
          <span>${escapeHtml(row.group)}</span>
          <strong>${fmtNum(current, 2)}</strong>
          <p>${escapeHtml(row.label)} / cap ${fmtNum(cap, 0)}</p>
          <meter min="0" max="${cap}" value="${Math.max(0, Math.min(cap, current))}"></meter>
        </article>
      `;
    })
    .join("");

  $("#score-formula-table").innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.group)}</strong></td>
          <td>${escapeHtml(row.label)}</td>
          <td class="numeric">${fmtNum(row.cap, 0)}</td>
          <td class="numeric">${fmtNum(row.current, 2)}</td>
          <td>${escapeHtml(row.formula)}</td>
          <td>${escapeHtml(row.interpretation)}</td>
        </tr>
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

function renderEvidence(analysis, signal) {
  const meta = analysis.meta;
  const headline = analysis.headline;
  const add = signal.historicalActionSummary.ADD;
  const reduce = signal.historicalActionSummary.REDUCE;
  const cards = [
    {
      label: "加仓历史回放",
      value: fmtPct(add.avgSpyRet20dFwd),
      copy: `${add.usableRows} 个可用样本，20D 胜率 ${fmtRate(add.winRate20d)}。`,
    },
    {
      label: "减仓历史回放",
      value: fmtPct(reduce.avgSpyRet20dFwd),
      copy: `${reduce.usableRows} 个可用样本，样本少，更适合作为风险预算警报。`,
    },
    {
      label: "高压力 vs 低压力",
      value: `${fmtPct(headline.highScoreAvgReturn20)} / ${fmtPct(headline.lowScoreAvgReturn20)}`,
      copy: "20D 平均收益。高压力组更高，但对应更高实现波动。",
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

function renderActionTable(signal) {
  const order = ["ADD", "ADD_SMALL", "HOLD", "REDUCE"];
  $("#action-table").innerHTML = order
    .map((action) => {
      const row = signal.historicalActionSummary[action];
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
    const [analysisResponse, signalResponse] = await Promise.all([
      fetch(dataUrl(ANALYSIS_ENDPOINT), { cache: "no-store" }),
      fetch(dataUrl(SIGNAL_ENDPOINT), { cache: "no-store" }),
    ]);
    if (!analysisResponse.ok) throw new Error(`analysis HTTP ${analysisResponse.status}`);
    if (!signalResponse.ok) throw new Error(`signal HTTP ${signalResponse.status}`);
    const [analysis, signal] = await Promise.all([analysisResponse.json(), signalResponse.json()]);
    renderCurrent(signal);
    renderSnapshot(analysis, signal);
    renderFindings(analysis, signal);
    renderScoreConstruction(signal);
    renderIndicators();
    renderEvidence(analysis, signal);
    renderActionTable(signal);
    renderLimits();
  } catch (error) {
    $(".research-page").innerHTML = `
      <section class="research-panel">
        <p class="eyebrow">Load Error</p>
        <h2>信号数据未加载成功</h2>
        <p>${error.message}</p>
      </section>
    `;
  }
}

init();
