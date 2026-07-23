const SNAPSHOT_ENDPOINT = "data/latest.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";
const ET_TIMEZONE = "America/New_York";

const metricGroups = [
  {
    title: "Volatility",
    hint: "Equity and Treasury-market stress",
    keys: ["vix", "vixChange5d", "move"],
  },
  {
    title: "Drawdown & breadth",
    hint: "Index depth and participation",
    keys: ["spyDrawdown", "qqqDrawdown", "rspSpyRel60d"],
  },
  {
    title: "Sentiment",
    hint: "Fear, bearishness and option protection",
    keys: ["fearGreed", "aaiiBearish", "putCall"],
  },
  {
    title: "Credit & liquidity",
    hint: "Spreads, dollar pressure and financial conditions",
    keys: ["hygRet20d", "jnkRet20d", "hyOas", "igOas", "dxyChange20d", "nfci", "kreRel20d"],
  },
  {
    title: "Rates",
    hint: "Nominal and real discount rates",
    keys: ["tenYYield", "tenYChange20d", "realTenY", "realTenYChange20d"],
  },
];

const metricLabels = {
  vix: ["VIX", ""],
  vixChange5d: ["VIX 5-day change", " pts"],
  move: ["MOVE", ""],
  spyDrawdown: ["SPY drawdown", "%"],
  qqqDrawdown: ["QQQ drawdown", "%"],
  rspSpyRel60d: ["RSP vs SPY, 60-day", "%"],
  fearGreed: ["Fear & Greed", ""],
  aaiiBearish: ["AAII bearish", "%"],
  putCall: ["Equity put/call", ""],
  hygRet20d: ["HYG 20-day return", "%"],
  jnkRet20d: ["JNK 20-day return", "%"],
  hyOas: ["HY OAS", "%"],
  igOas: ["IG OAS", "%"],
  dxyChange20d: ["DXY 20-day change", "%"],
  nfci: ["NFCI", ""],
  kreRel20d: ["KRE vs SPY, 20-day", "%"],
  tenYYield: ["10Y Treasury yield", "%"],
  tenYChange20d: ["10Y yield, 20-day change", " bp"],
  realTenY: ["10Y real yield", "%"],
  realTenYChange20d: ["10Y real yield, 20-day change", " bp"],
};

const sourceFallbacks = {
  vix: ["Cboe VIX", "https://www.cboe.com/tradable_products/vix/"],
  move: ["Yahoo MOVE", "https://finance.yahoo.com/quote/%5EMOVE/"],
  spyDrawdown: ["Yahoo SPY", "https://finance.yahoo.com/quote/SPY/"],
  qqqDrawdown: ["Yahoo QQQ", "https://finance.yahoo.com/quote/QQQ/"],
  fearGreed: ["CNN Fear & Greed", "https://www.cnn.com/markets/fear-and-greed"],
  aaiiBearish: ["AAII Sentiment", "https://www.aaii.com/sentimentsurvey"],
  putCall: ["Cboe statistics", "https://www.cboe.com/us/options/market_statistics/daily/"],
  hyOas: ["FRED BAMLH0A0HYM2", "https://fred.stlouisfed.org/series/BAMLH0A0HYM2"],
  igOas: ["FRED BAMLC0A0CM", "https://fred.stlouisfed.org/series/BAMLC0A0CM"],
  nfci: ["FRED NFCI", "https://fred.stlouisfed.org/series/NFCI"],
  tenYYield: ["FRED DGS10", "https://fred.stlouisfed.org/series/DGS10"],
  realTenY: ["FRED DFII10", "https://fred.stlouisfed.org/series/DFII10"],
};

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function formatEt(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "--";
  return parsed.toLocaleString("en-US", {
    timeZone: ET_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actionCopy(action) {
  const copy = {
    ADD: {
      title: "ADD",
      reason: "The opportunity set is strong and the credit backdrop remains controlled.",
      allocation: "Add equity exposure in planned tranches, prioritizing broad beta and quality.",
      risk: "Keep dry powder for a deeper drawdown and avoid forcing a single entry point.",
      watch: "Watch whether credit spreads stay contained as volatility normalizes.",
    },
    ADD_SMALL: {
      title: "ADD SMALL",
      reason: "An investable opportunity is emerging, but confirmation is not yet complete.",
      allocation: "Accelerate scheduled contributions or rebalancing modestly.",
      risk: "Avoid a full-size tactical position until credit and breadth confirm.",
      watch: "Watch for deeper price discounts without deterioration in credit.",
    },
    REDUCE: {
      title: "REDUCE",
      reason: "Credit, liquidity, and volatility conditions indicate a shrinking risk budget.",
      allocation: "Reduce the most leveraged, illiquid, and high-beta exposures first.",
      risk: "Portfolio protection takes priority over trying to identify the exact bottom.",
      watch: "Watch HY/IG spreads, bank relative strength, the dollar, and Treasury volatility.",
    },
    HOLD: {
      title: "HOLD",
      reason: "There is neither a high-conviction add window nor a systemic reduce signal.",
      allocation: "Maintain the existing allocation, contribution plan, and rebalance discipline.",
      risk: "Do not change the long-term plan for an ordinary correction.",
      watch: "Watch whether drawdowns deepen, fear rises, or credit stress begins to spread.",
    },
  };
  return copy[action] || copy.HOLD;
}

function pressureLabel(value, max) {
  const ratio = max ? value / max : 0;
  if (ratio >= 0.6) return "High";
  if (ratio >= 0.3) return "Moderate";
  return "Low";
}

function triggerRows(values) {
  const rows = [];
  const add = (severity, text) => rows.push({ severity, text });
  if (values.vix > 25) add("warning", `VIX is ${formatNumber(values.vix)}, indicating elevated equity volatility.`);
  if (values.move > 120) add("warning", `MOVE is ${formatNumber(values.move)}, signaling elevated Treasury volatility.`);
  if (values.spyDrawdown < -10 || values.qqqDrawdown < -12) {
    add("info", `Drawdowns are meaningful: SPY ${formatNumber(values.spyDrawdown)}%, QQQ ${formatNumber(values.qqqDrawdown)}%.`);
  }
  if (values.hyOas > 4.5 || values.igOas > 1.25) {
    add("danger", `Credit spreads are widening: HY ${formatNumber(values.hyOas, 2)}%, IG ${formatNumber(values.igOas, 2)}%.`);
  }
  if (values.fearGreed < 25) add("info", `Fear & Greed is ${formatNumber(values.fearGreed, 0)}, an unusually fearful reading.`);
  if (values.nfci > 0) add("warning", `NFCI is ${formatNumber(values.nfci, 2)}, tighter than its long-run average.`);
  if (!rows.length) add("info", "No major systemic-risk threshold is currently active.");
  return rows;
}

function renderSignal(signal) {
  const current = signal.currentSignal;
  const copy = actionCopy(current.action);
  $("#allocation-signal-title").textContent = copy.title;
  $("#allocation-signal-reason").textContent = copy.reason;
  $("#allocation-signal-meta").textContent = `As of ${current.asOf} | ${current.marketState || "normal"} market state | generated ${formatEt(signal.generatedAt)} ET`;
  $("#allocation-opportunity").textContent = formatNumber(current.opportunityScore, 0);
  $("#allocation-risk").textContent = formatNumber(current.riskScore, 0);
  $("#allocation-opportunity-meter").value = current.opportunityScore || 0;
  $("#allocation-risk-meter").value = current.riskScore || 0;
  const pressure = current.pressureScores || {};
  $("#allocation-pressure").textContent = `${pressure.volatility || 0}/${pressure.credit || 0}/${pressure.sentiment || 0}`;
  $("#allocation-pressure-note").textContent = "Volatility / credit / sentiment pressure";
  $("#allocation-guidance").textContent = copy.allocation;
  $("#risk-budget-guidance").textContent = copy.risk;
  $("#watch-guidance").textContent = copy.watch;
  $("#regime-title").textContent = current.marketState === "normal" ? "Normal / Mild Pullback" : current.marketState;
  $("#regime-internal").textContent = `Opportunity ${formatNumber(current.opportunityScore, 0)} · Risk ${formatNumber(current.riskScore, 0)}`;
  $("#regime-change").textContent = `Current action: ${copy.title}`;
  $("#regime-summary").textContent = copy.reason;
  renderPressureCard("vol", pressure.volatility || 0, 8, "Equity and rates volatility pressure.");
  renderPressureCard("credit", pressure.credit || 0, 18, "Credit, liquidity, dollar, and banking pressure.");
  renderPressureCard("sentiment", pressure.sentiment || 0, 8, "Fear, bearishness, and option-protection demand.");
}

function renderPressureCard(prefix, value, max, detail) {
  $(`#${prefix}-score`).textContent = pressureLabel(value, max);
  $(`#${prefix}-score-range`).textContent = `${value} / ${max}`;
  $(`#${prefix}-meter`).value = value;
  $(`#${prefix}-label`).textContent = value ? "One or more thresholds are active." : "No major threshold is active.";
  $(`#${prefix}-detail`).textContent = detail;
  $(`#${prefix}-contributors`).innerHTML = `<li>${value ? `${value} pressure point${value === 1 ? "" : "s"} currently active.` : "Current inputs remain below the main stress thresholds."}</li>`;
}

function renderSnapshot(snapshot) {
  const values = snapshot.values || {};
  $("#live-meta").textContent = `Latest snapshot | generated ${formatEt(snapshot.generatedAt)} ET | data date ${snapshot.asOf}`;
  $("#trigger-list").innerHTML = triggerRows(values)
    .map((row) => `<li class="${row.severity}">${escapeHtml(row.text)}</li>`)
    .join("");
  $("#data-quality").innerHTML = `
    <div class="data-quality-item"><strong>Update cadence</strong> One post-close collection per U.S. trading weekday.</div>
    <div class="data-quality-item"><strong>Coverage</strong> ${Object.keys(values).length} market inputs in the latest static snapshot.</div>
  `;
  renderMetrics(values, snapshot.fieldMeta || {});
  drawRiskMap(snapshot.scores || {});
}

function renderMetrics(values, fieldMeta) {
  $("#metric-form").innerHTML = metricGroups
    .map(
      (group) => `
        <section class="module-block">
          <div class="module-title"><h3>${group.title}</h3><span>${group.hint}</span></div>
          <div class="input-grid">
            ${group.keys
              .map((key) => {
                const [label, suffix] = metricLabels[key] || [key, ""];
                const meta = fieldMeta[key] || {};
                const fallback = sourceFallbacks[key] || ["Source", "#"];
                const href = meta.url || meta.sourceUrl || fallback[1];
                const sourceLabel = meta.source || meta.sourceName || fallback[0];
                return `
                  <div class="field">
                    <div class="field-label-row">
                      <label>${label}</label>
                      <a class="source-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">Source</a>
                    </div>
                    <input value="${formatNumber(values[key], 2)}${suffix}" readonly aria-label="${label}" />
                    <div class="source-meta">${escapeHtml(meta.asOf || snapshotDate(fieldMeta))} · ${escapeHtml(sourceLabel)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function snapshotDate(fieldMeta) {
  const first = Object.values(fieldMeta).find((item) => item?.asOf);
  return first?.asOf || "--";
}

function drawRiskMap(scores) {
  const canvas = $("#risk-canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f8fafb";
  context.fillRect(0, 0, width, height);
  const rows = [
    ["Volatility", Number(scores.volatility || 0), 8, "#a86610"],
    ["Credit", Number(scores.credit || 0), 18, "#a63c34"],
    ["Sentiment", Number(scores.sentiment || 0), 8, "#1c5384"],
  ];
  rows.forEach(([label, value, max, color], index) => {
    const y = 55 + index * 78;
    context.fillStyle = "#68747d";
    context.font = "600 14px sans-serif";
    context.fillText(label, 24, y);
    context.fillStyle = "#e4e9ec";
    context.fillRect(130, y - 14, width - 170, 18);
    context.fillStyle = color;
    context.fillRect(130, y - 14, (width - 170) * Math.min(1, value / max), 18);
    context.fillStyle = "#1d2730";
    context.fillText(`${value}/${max}`, width - 34, y);
  });
}

async function loadJson(endpoint) {
  const response = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    const [snapshot, signal] = await Promise.all([loadJson(SNAPSHOT_ENDPOINT), loadJson(SIGNAL_ENDPOINT)]);
    renderSignal(signal);
    renderSnapshot(snapshot);
  } catch (error) {
    $("#allocation-signal-title").textContent = "Signal unavailable";
    $("#allocation-signal-reason").textContent = error.message;
    $("#live-meta").textContent = "Waiting for the next successful static-data update.";
  }
}

init();
