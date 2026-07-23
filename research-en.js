const ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";

const actionLabels = {
  ADD: "Add",
  ADD_SMALL: "Add selectively",
  HOLD: "Hold",
  REDUCE: "Reduce",
};

const actionReasons = {
  ADD: "Market stress is offering a potential entry discount while the credit gate remains stable.",
  ADD_SMALL: "Opportunity is improving, but the evidence is not broad enough for a full allocation increase.",
  HOLD: "Neither opportunity nor risk has crossed a decisive threshold.",
  REDUCE: "Risk conditions have deteriorated enough to justify a lower risk budget.",
};

const indicatorRows = [
  {
    module: "Volatility",
    indicators: "VIX, 5D VIX change, MOVE, SPY 20D realized volatility",
    reason: "Measures demand for equity and rate hedges. A rapid rise often signals deleveraging and tighter risk budgets.",
    role: "Tests whether stress is spreading and whether fear has created a sufficiently attractive entry discount.",
  },
  {
    module: "Drawdown and trend",
    indicators: "SPY/QQQ drawdown, RSP/SPY",
    reason: "Shows whether prices have corrected meaningfully and whether gains or losses are concentrated in a few index heavyweights.",
    role: "Drawdowns raise the opportunity score; broken trends and weaker breadth raise the risk score.",
  },
  {
    module: "Sentiment",
    indicators: "CNN Fear & Greed, AAII bearish share, put/call ratio",
    reason: "Fear can be contrarian over a medium horizon, but it is unreliable when used alone.",
    role: "Supports adding risk only when credit is stable; otherwise it remains secondary evidence.",
  },
  {
    module: "Credit and liquidity",
    indicators: "HYG/JNK, HY OAS, IG OAS, DXY, NFCI, KRE/SPY",
    reason: "Broadening credit stress is usually closer to systemic risk than equity volatility alone.",
    role: "The primary risk gate. Fear does not become an add signal while credit is deteriorating.",
  },
  {
    module: "Rate environment",
    indicators: "10Y yield, real 10Y yield, MOVE",
    reason: "Rates and real yields affect valuation discounting, duration assets, and transmission into credit.",
    role: "Provides macro context and explains volatility, but does not trigger an action by itself.",
  },
];

const limits = [
  "The sample covers roughly five years, including a tightening cycle, bear market, banking stress, and several rebound windows, but not every long-run regime.",
  "The 20D and 60D forward-return windows overlap. Results show empirical tendencies rather than independent-sample statistical significance.",
  "Reduce signals are relatively rare. They should be read as lower the risk budget, trim, or hedge, not as an automatic exit.",
  "Public Cboe equity put/call history does not provide complete five-year coverage through the current collection method; the gap is disclosed.",
  "FRED credit spreads and NFCI update with T+1 or weekly lags and are not intraday risk switches.",
  "The model uses SPY as the market proxy and does not represent a specific portfolio's sector, duration, cash-flow, or tax constraints.",
  "The allocation signal is decision support, not personalized investment advice. Portfolio objectives, valuation, earnings, and risk tolerance still govern execution.",
];

const componentCopy = {
  drawdown20: {
    label: "20-day drawdown",
    formula: "Increasing contribution as the 20-day SPY drawdown deepens.",
    interpretation: "Larger pullbacks improve prospective entry prices.",
  },
  drawdown60: {
    label: "60-day drawdown",
    formula: "Increasing contribution as the 60-day SPY drawdown deepens.",
    interpretation: "Captures corrections that persist beyond a short volatility event.",
  },
  vixLevel: {
    label: "VIX level",
    formula: "Contribution rises as VIX moves through elevated stress bands.",
    interpretation: "Measures the level of equity-option demand for protection.",
  },
  fearGreed: {
    label: "Fear & Greed",
    formula: "Contribution rises as the index moves toward extreme fear.",
    interpretation: "Treats intense pessimism as contrarian evidence.",
  },
  aaiiBearish: {
    label: "AAII bearish sentiment",
    formula: "Contribution rises as the bearish share exceeds normal levels.",
    interpretation: "Adds survey-based evidence of investor pessimism.",
  },
  vixChange5d: {
    label: "5-day VIX change",
    formula: "Contribution rises with a rapid five-day volatility increase.",
    interpretation: "Detects an accelerating shock rather than only a high level.",
  },
  creditStress: {
    label: "Credit stress",
    formula: "Combines high-yield and investment-grade spread deterioration.",
    interpretation: "Raises risk when stress moves beyond equities into funding markets.",
  },
  breadthStress: {
    label: "Breadth stress",
    formula: "Contribution rises as equal-weight performance weakens versus cap weight.",
    interpretation: "Flags narrowing leadership and fragile index-level strength.",
  },
  rateStress: {
    label: "Rate volatility",
    formula: "Contribution rises with elevated Treasury-market volatility.",
    interpretation: "Captures instability in the discount-rate environment.",
  },
  liquidityStress: {
    label: "Liquidity stress",
    formula: "Contribution rises with tighter financial conditions and dollar strength.",
    interpretation: "Tests whether macro liquidity is reinforcing market stress.",
  },
};

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
  return date.toLocaleString("en-US", {
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
  $("#research-current-title").textContent = `${actionLabels[current.action] || current.action} | ${current.asOf}`;
  $("#current-reason").textContent = actionReasons[current.action] || "No model explanation is available.";
  $("#current-opportunity").textContent = fmtNum(current.opportunityScore, 1);
  $("#current-risk").textContent = fmtNum(current.riskScore, 1);
  $("#current-pressure").textContent = pressureScoreText(current.pressureScores);
}

function renderSnapshot(analysis, signal) {
  const meta = analysis.meta;
  $("#snapshot-list").innerHTML = `
    <div><dt>Sample period</dt><dd>${meta.startDate} - ${meta.endDate}</dd></div>
    <div><dt>Trading-day observations</dt><dd>${meta.rows}</dd></div>
    <div><dt>Average input coverage</dt><dd>${fmtRate(meta.avgCompleteness)}</dd></div>
    <div><dt>Data generated</dt><dd>${fmtDateTime(signal.generatedAt)}</dd></div>
  `;
}

function renderFindings(analysis, signal) {
  const headline = analysis.headline;
  const current = signal.currentSignal;
  const cards = [
    {
      label: "Current allocation signal",
      value: actionLabels[current.action] || current.action,
      copy: `Opportunity ${fmtNum(current.opportunityScore, 1)}; risk ${fmtNum(current.riskScore, 1)}.`,
    },
    {
      label: "Strongest model relationship",
      value: fmtNum(headline.scoreTotalVol20Spearman, 2),
      copy: `Spearman correlation between pressure and subsequent 20D volatility; the 20D return correlation is ${fmtNum(
        headline.scoreTotalReturn20Spearman,
        2
      )}.`,
    },
    {
      label: "Rebound tendency after high stress",
      value: fmtPct(headline.highScoreAvgReturn20),
      copy: `The subsequent 20D win rate is ${fmtRate(headline.highScoreWinRate20)}, with higher volatility.`,
    },
    {
      label: "Core operating rule",
      value: "Check credit first",
      copy: "Fear and drawdown support adding risk only when credit is stable; deteriorating credit takes priority.",
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
    $("#score-construction-scale").textContent = "The current data file does not include formula metadata.";
    $("#score-formula-table").innerHTML = "";
    $("#score-component-breakdown").innerHTML = "";
    return;
  }

  $("#score-construction-scale").textContent =
    "Both scores use a 0-100 scale. Component contributions are calculated first, then capped.";
  $("#opportunity-formula").textContent =
    "Drawdown + volatility level + contrarian sentiment, subject to the credit gate.";
  $("#risk-formula").textContent =
    "Volatility acceleration + credit stress + weak breadth + rate and liquidity stress.";

  const rows = ["opportunityScore", "riskScore"].flatMap((groupKey) => {
    const group = construction[groupKey] || {};
    return (group.components || []).map((component) => {
      const translated = componentCopy[component.key] || {};
      return {
        group: scoreGroupLabel(groupKey),
        ...component,
        ...translated,
        current: components[component.key],
      };
    });
  });

  $("#score-component-breakdown").innerHTML = rows
    .map((row) => {
      const current = Number(row.current || 0);
      const cap = Number(row.cap || 100);
      return `
        <article class="score-component-card">
          <span>${escapeHtml(row.group)}</span>
          <strong>${fmtNum(current, 2)}</strong>
          <p>${escapeHtml(row.label || row.key)} / cap ${fmtNum(cap, 0)}</p>
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
          <td>${escapeHtml(row.label || row.key)}</td>
          <td class="numeric">${fmtNum(row.cap, 0)}</td>
          <td class="numeric">${fmtNum(row.current, 2)}</td>
          <td>${escapeHtml(row.formula || "See model definition")}</td>
          <td>${escapeHtml(row.interpretation || "Contributes to the aggregate score.")}</td>
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
  if (!$("#evidence-grid")) return;
  const meta = analysis.meta;
  const headline = analysis.headline;
  const add = signal.historicalActionSummary.ADD;
  const reduce = signal.historicalActionSummary.REDUCE;
  const cards = [
    {
      label: "Historical add outcomes",
      value: fmtPct(add.avgSpyRet20dFwd),
      copy: `${add.usableRows} usable observations; 20D win rate ${fmtRate(add.winRate20d)}.`,
    },
    {
      label: "Historical reduce outcomes",
      value: fmtPct(reduce.avgSpyRet20dFwd),
      copy: `${reduce.usableRows} usable observations. The small sample is better treated as a risk-budget warning.`,
    },
    {
      label: "High stress vs low stress",
      value: `${fmtPct(headline.highScoreAvgReturn20)} / ${fmtPct(headline.lowScoreAvgReturn20)}`,
      copy: "Average 20D returns. High-stress observations produced stronger rebounds but also higher realized volatility.",
    },
    {
      label: "Data gaps",
      value: `${fmtRate(meta.putCallMissingShare)} / ${fmtRate(meta.oasMissingShare)}`,
      copy: "Historical missing shares for put/call and OAS, respectively; both constrain interpretation.",
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
  if (!$("#action-table")) return;
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
        <h2>Signal data could not be loaded</h2>
        <p>${error.message}</p>
      </section>
    `;
  }
}

init();
