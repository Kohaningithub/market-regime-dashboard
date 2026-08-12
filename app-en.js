const SNAPSHOT_ENDPOINT = "data/latest.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";
const QUANT_ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const ET_TIMEZONE = "America/New_York";

let latestSignal = null;
let latestQuantAnalysis = null;

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

function pressureTotal(scores = {}) {
  return Number(scores.volatility || 0) + Number(scores.credit || 0) + Number(scores.sentiment || 0);
}

function scoreBucketKey(score) {
  if (score <= 0) return "0";
  if (score <= 2) return "1-2";
  if (score <= 4) return "3-4";
  return "5+";
}

function signedPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function ratePct(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function plainPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toFixed(digits)}%`;
}

function bucketTone(bucket) {
  if (bucket === "0") return "quiet";
  if (bucket === "1-2") return "mild pressure";
  if (bucket === "3-4") return "rising pressure";
  return "high pressure / panic";
}

function renderHistoricalScoreContext() {
  const current = latestSignal?.currentSignal;
  const pressureNode = $("#current-raw-pressure");
  if (!current || !pressureNode) return;

  const pressure = current.pressureScores || {};
  const total = pressureTotal(pressure);
  const bucket = scoreBucketKey(total);
  const exact = latestQuantAnalysis?.exactScoreRows?.find((row) => Number(row.score) === total);
  const bucketStats = latestQuantAnalysis?.bucketAnalysis?.[bucket];
  const horizon20 = bucketStats?.horizons?.["20"];
  const horizon60 = bucketStats?.horizons?.["60"];

  pressureNode.textContent = String(total);
  $("#current-score-breakdown").textContent = `Volatility ${pressure.volatility || 0} / Credit ${pressure.credit || 0} / Sentiment ${pressure.sentiment || 0}`;
  $("#current-raw-bucket").textContent = `${bucket} bucket · ${bucketTone(bucket)}`;
  $("#current-score-exact").textContent = exact
    ? `Same exact-score sample: ${exact.rows} days; 20D average ${signedPct(exact.avgReturn20)}, SPY positive 20D rate ${ratePct(exact.winRate20)}.`
    : "Exact-score sample is thin; use the neighboring bucket as the primary read-through.";

  const meta = latestQuantAnalysis?.meta || {};
  $("#score-context-meta").textContent = latestQuantAnalysis
    ? `${meta.startDate || "--"} - ${meta.endDate || "--"} | ${meta.rows || "--"} trading days | 20D/60D forward study`
    : "Loading five-year research results...";

  $("#score-context-readthrough").textContent = horizon20
    ? `The current raw pressure score is ${total}, which falls in the ${bucket} (${bucketTone(bucket)}) bucket. Over the last five years, similar readings were followed by an average 20-trading-day SPY return of ${signedPct(horizon20.avgReturn)} with a ${ratePct(horizon20.winRate)} SPY positive 20D rate; the average 60-trading-day return was ${signedPct(horizon60?.avgReturn)}. This is context, not the final trade rule; the final action still comes from Opportunity, Risk, and the credit gate.`
    : "Historical bucket data is still loading; only the latest score is available for now.";

  $("#historical-outcome-grid").innerHTML = horizon20
    ? `
      <article>
        <span>Bucket 20D Avg Return</span>
        <strong>${signedPct(horizon20.avgReturn)}</strong>
        <p>Median ${signedPct(horizon20.medianReturn)}</p>
      </article>
      <article>
        <span>Bucket SPY Positive 20D Rate</span>
        <strong>${ratePct(horizon20.winRate)}</strong>
        <p>Usable sample ${horizon20.usableRows || horizon20.rows || "--"} days</p>
      </article>
      <article>
        <span>Bucket 60D Avg Return</span>
        <strong>${signedPct(horizon60?.avgReturn)}</strong>
        <p>SPY positive 60D rate ${ratePct(horizon60?.winRate)}</p>
      </article>
      <article>
        <span>Forward Risk Profile</span>
        <strong>${signedPct(horizon20.avgMaxDrawdown)}</strong>
        <p>20D avg max drawdown, vol ${plainPct(horizon20.avgRealizedVol)}</p>
      </article>
    `
    : `<article><span>Historical Context</span><strong>--</strong><p>Waiting for research data.</p></article>`;

  $("#score-bucket-compare").innerHTML = ["0", "1-2", "3-4", "5+"]
    .map((key) => {
      const item = latestQuantAnalysis?.bucketAnalysis?.[key];
      const outcome = item?.horizons?.["20"];
      const barWidth = outcome ? Math.max(8, Math.min(100, Math.abs(outcome.avgReturn) * 22)) : 0;
      return `
        <div class="bucket-row${key === bucket ? " is-current" : ""}">
          <div class="bucket-label">${key}</div>
          <div class="bucket-bar-track" aria-hidden="true"><span class="bucket-bar-fill" style="width:${barWidth}%"></span></div>
          <span>20D ${signedPct(outcome?.avgReturn)}</span>
          <span>SPY positive ${ratePct(outcome?.winRate)}</span>
          <span>Sample ${outcome?.usableRows || item?.rows || "--"}</span>
        </div>
      `;
    })
    .join("");
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
  latestSignal = signal;
  const current = signal.currentSignal;
  const copy = actionCopy(current.action);
  $("#allocation-signal-title").textContent = copy.title;
  $("#allocation-signal-reason").textContent = copy.reason;
  $("#allocation-signal-meta").textContent = `As of ${current.asOf} | ${current.marketState || "normal"} market state | generated ${formatEt(signal.generatedAt)} ET`;
  // Keep the displayed precision aligned with the Chinese dashboard.  These
  // scores are fractional model outputs, so integer rounding can look like a
  // disagreement between language versions.
  $("#allocation-opportunity").textContent = formatNumber(current.opportunityScore, 1);
  $("#allocation-risk").textContent = formatNumber(current.riskScore, 1);
  $("#allocation-opportunity-meter").value = current.opportunityScore || 0;
  $("#allocation-risk-meter").value = current.riskScore || 0;
  const pressure = current.pressureScores || {};
  $("#allocation-pressure").textContent = `${pressureTotal(pressure)} (${pressure.volatility || 0}/${pressure.credit || 0}/${pressure.sentiment || 0})`;
  $("#allocation-pressure-note").textContent = "Raw score: volatility / credit / sentiment";
  $("#allocation-guidance").textContent = copy.allocation;
  $("#risk-budget-guidance").textContent = copy.risk;
  $("#watch-guidance").textContent = copy.watch;
  $("#regime-title").textContent = current.marketState === "normal" ? "Normal / Mild Pullback" : current.marketState;
  $("#regime-internal").textContent = `Opportunity ${formatNumber(current.opportunityScore, 1)} · Risk ${formatNumber(current.riskScore, 1)}`;
  $("#regime-change").textContent = `Current action: ${copy.title}`;
  $("#regime-summary").textContent = copy.reason;
  renderPressureCard("vol", pressure.volatility || 0, 8, "Equity and rates volatility pressure.");
  renderPressureCard("credit", pressure.credit || 0, 18, "Credit, liquidity, dollar, and banking pressure.");
  renderPressureCard("sentiment", pressure.sentiment || 0, 8, "Fear, bearishness, and option-protection demand.");
  renderHistoricalScoreContext();
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
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const dataLabel = isWeekend ? "last market session" : "market data date";
  const weekendNote = isWeekend ? " | U.S. markets are closed for the weekend; the next trading-day update is automatic" : "";
  $("#live-meta").textContent = `Latest snapshot | generated ${formatEt(snapshot.generatedAt)} ET | ${dataLabel} ${snapshot.asOf}${weekendNote}`;
  $("#trigger-list").innerHTML = triggerRows(values)
    .map((row) => `<li class="${row.severity}">${escapeHtml(row.text)}</li>`)
    .join("");
  $("#data-quality").innerHTML = `
    <div class="data-quality-item"><strong>Update cadence</strong> One U.S. morning snapshot and one post-close snapshot per U.S. trading weekday.</div>
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
  const response = await dashboardDataFetch(endpoint);
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    const [snapshot, signal, analysis] = await Promise.all([
      loadJson(SNAPSHOT_ENDPOINT),
      loadJson(SIGNAL_ENDPOINT),
      loadJson(QUANT_ANALYSIS_ENDPOINT).catch((error) => ({ error })),
    ]);
    renderSignal(signal);
    if (analysis.error) {
      $("#score-context-meta").textContent = "Historical research unavailable";
      $("#score-context-readthrough").textContent = analysis.error.message;
    } else {
      latestQuantAnalysis = analysis;
      renderHistoricalScoreContext();
    }
    renderSnapshot(snapshot);
  } catch (error) {
    $("#allocation-signal-title").textContent = "Signal unavailable";
    $("#allocation-signal-reason").textContent = error.message;
    $("#live-meta").textContent = "Waiting for the next successful static-data update.";
  }
}

init();
