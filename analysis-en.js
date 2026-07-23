const ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";
const DAILY_EVIDENCE_ENDPOINT = "data/daily_evidence.json";
const HORIZONS = [5, 10, 20, 60];

let analysisPayload = null;
let signalPayload = null;
let dailyEvidencePayload = null;
let activeHorizon = 20;
let dailyRangeDays = 90;
let resizeTimer = null;

const containers = {
  kpis: document.querySelector("#analysis-kpis"),
  decisionMeta: document.querySelector("#decision-meta"),
  decisionCurrent: document.querySelector("#decision-current"),
  decisionChart: document.querySelector("#decision-chart"),
  methodCopy: document.querySelector("#method-copy"),
  trendMeta: document.querySelector("#trend-meta"),
  trend: document.querySelector("#trend-chart"),
  bucket: document.querySelector("#bucket-chart"),
  regime: document.querySelector("#regime-chart"),
  rolling: document.querySelector("#rolling-chart"),
  scoreStrip: document.querySelector("#score-strip-chart"),
  module: document.querySelector("#module-chart"),
  notes: document.querySelector("#analysis-notes"),
  dailyMeta: document.querySelector("#daily-evidence-meta"),
  dailyKpis: document.querySelector("#daily-evidence-kpis"),
  dailyMarket: document.querySelector("#daily-market-chart"),
  dailyRisk: document.querySelector("#daily-risk-chart"),
};

const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function svgEl(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function clearNode(node) {
  if (node) node.innerHTML = "";
}

function fmtPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toFixed(digits)}%`;
}

function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(digits);
}

function weightedAverage(items, metric) {
  let total = 0;
  let weight = 0;
  items.forEach((item) => {
    const value = item?.[metric];
    const rows = item?.usableRows || item?.rows || 0;
    if (typeof value === "number" && rows > 0) {
      total += value * rows;
      weight += rows;
    }
  });
  return weight ? total / weight : null;
}

function weightedRate(items, metric) {
  return weightedAverage(items, metric);
}

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

function extent(values, pad = 0.08) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) return [0, 1];
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const extra = (max - min) * pad;
  return [min - extra, max + extra];
}

function pathFrom(points) {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

function drawGrid(svg, x, y, width, height, ticks, yScale, labels = true) {
  const group = svgEl("g", { class: "chart-grid" });
  ticks.forEach((tick) => {
    const py = yScale(tick);
    group.appendChild(svgEl("line", { x1: x, x2: x + width, y1: py, y2: py }));
    if (labels) {
      const text = svgEl("text", { x: x - 8, y: py + 4, class: "chart-label", "text-anchor": "end" });
      text.textContent = String(tick);
      group.appendChild(text);
    }
  });
  svg.appendChild(group);
}

function makeSvg(container, height = 330) {
  clearNode(container);
  const width = Math.max(340, container.clientWidth || 760);
  const actualHeight = Math.max(height, container.clientHeight || height);
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${actualHeight}`,
    width: "100%",
    height: "100%",
    role: "img",
  });
  container.appendChild(svg);
  return { svg, width, height: actualHeight };
}

function makeTooltip(container) {
  let tooltip = container.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    container.appendChild(tooltip);
  }
  return tooltip;
}

function setTooltip(container, tooltip, html, x, y) {
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  const box = container.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(x + 12, box.width - tip.width - 8));
  const top = Math.max(8, Math.min(y + 12, box.height - tip.height - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip) {
  tooltip.style.display = "none";
}

function renderKpis() {
  const data = analysisPayload;
  const bucket0 = data.bucketAnalysis["0"]?.horizons[String(activeHorizon)];
  const bucket12 = data.bucketAnalysis["1-2"]?.horizons[String(activeHorizon)];
  const high = data.bucketAnalysis["5+"]?.horizons[String(activeHorizon)];
  const lowReturn = weightedAverage([bucket0, bucket12], "avgReturn");
  const lowWinRate = weightedRate([bucket0, bucket12], "winRate");
  const highReturn = high?.avgReturn ?? null;
  const highWinRate = high?.winRate ?? null;
  const highVol = high?.avgRealizedVol ?? null;
  containers.kpis.innerHTML = `
    <article class="analysis-kpi">
      <span>${activeHorizon}D high-score average return</span>
      <strong>${fmtPct(highReturn)}</strong>
      <p>Score 5+ sample · win rate ${fmtPct((highWinRate ?? 0) * 100, 0)}</p>
    </article>
    <article class="analysis-kpi">
      <span>${activeHorizon}D low-score average return</span>
      <strong>${fmtPct(lowReturn)}</strong>
      <p>Score 0-2 sample · win rate ${fmtPct((lowWinRate ?? 0) * 100, 0)}</p>
    </article>
    <article class="analysis-kpi">
      <span>Score correlation with 20D volatility</span>
      <strong>${fmtNum(data.headline.scoreTotalVol20Spearman, 2)}</strong>
      <p>Spearman rank correlation</p>
    </article>
    <article class="analysis-kpi">
      <span>Average input coverage</span>
      <strong>${fmtPct(data.meta.avgCompleteness * 100, 1)}</strong>
      <p>High-score ${activeHorizon}D annualized volatility ${fmtPct(highVol)}</p>
    </article>
  `;
}

function actionText(action) {
  if (action === "ADD") return "ADD";
  if (action === "ADD_SMALL") return "ADD SMALL";
  if (action === "REDUCE") return "REDUCE";
  return "HOLD";
}

function englishActionReason(action) {
  if (action === "ADD") return "Opportunity is strong while credit and volatility risks remain controlled.";
  if (action === "ADD_SMALL") return "An investable opportunity is emerging, but confirmation remains incomplete.";
  if (action === "REDUCE") return "Credit, liquidity, and volatility conditions indicate a shrinking risk budget.";
  return "There is neither a high-conviction add window nor a systemic reduce signal.";
}

function renderDecision() {
  if (!signalPayload) return;
  const current = signalPayload.currentSignal;
  const actionClass = current.action === "REDUCE" ? "reduce" : current.action === "ADD" || current.action === "ADD_SMALL" ? "add" : "hold";
  containers.decisionMeta.textContent = `${current.asOf || "--"} | market state ${current.marketState || "--"}`;
  containers.decisionCurrent.innerHTML = `
    <article class="decision-card decision-card-main decision-action-${actionClass}">
      <span>Current action</span>
      <strong>${actionText(current.action)}</strong>
      <p>${englishActionReason(current.action)}</p>
    </article>
    <article class="decision-card">
      <span>Opportunity score</span>
      <strong>${fmtNum(current.opportunityScore, 1)}</strong>
      <p>Drawdown ${fmtPct(current.keyInputs?.spyDrawdown)} · Fear & Greed ${fmtNum(current.keyInputs?.fearGreed, 0)}</p>
    </article>
    <article class="decision-card">
      <span>Risk score</span>
      <strong>${fmtNum(current.riskScore, 1)}</strong>
      <p>Credit ${fmtNum(current.keyInputs?.creditScore, 0)} · HY OAS ${fmtNum(current.keyInputs?.hyOas, 2)}</p>
    </article>
    <article class="decision-card">
      <span>Key market state</span>
      <strong>VIX ${fmtNum(current.keyInputs?.vix, 1)}</strong>
      <p>20D realized volatility ${fmtPct(current.keyInputs?.spyRealizedVol20dTrailing)}</p>
    </article>
  `;
  renderDecisionChart();
}

function renderDecisionChart() {
  const container = containers.decisionChart;
  const { svg, width, height } = makeSvg(container, 300);
  const summary = signalPayload.historicalActionSummary;
  const order = ["ADD", "ADD_SMALL", "HOLD", "REDUCE"].filter((action) => summary[action]);
  const rows = order.map((action) => ({ action, label: actionText(action), ...summary[action] }));
  const margin = { top: 24, right: 50, bottom: 58, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const [minY, maxY] = extent(rows.flatMap((row) => [row.avgSpyRet20dFwd, row.avgMaxDrawdown20dFwd, 0]), 0.18);
  const y = scaleLinear(minY, maxY, margin.top + plotH, margin.top);
  const band = plotW / rows.length;
  drawGrid(svg, margin.left, margin.top, plotW, plotH, [Math.floor(minY), 0, Math.ceil(maxY)], y);
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: y(0), y2: y(0), class: "zero-line" }));
  rows.forEach((row, index) => {
    const cx = margin.left + band * index + band / 2;
    const barW = Math.min(50, band * 0.34);
    const y0 = y(0);
    const yRet = y(row.avgSpyRet20dFwd || 0);
    const yDd = y(row.avgMaxDrawdown20dFwd || 0);
    svg.appendChild(
      svgEl("rect", {
        x: cx - barW - 3,
        y: Math.min(y0, yRet),
        width: barW,
        height: Math.max(1, Math.abs(y0 - yRet)),
        rx: 5,
        class: row.avgSpyRet20dFwd >= 0 ? "bar-return" : "bar-drawdown",
      })
    );
    svg.appendChild(
      svgEl("rect", {
        x: cx + 3,
        y: Math.min(y0, yDd),
        width: barW,
        height: Math.max(1, Math.abs(y0 - yDd)),
        rx: 5,
        class: "bar-drawdown",
      })
    );
    const label = svgEl("text", { x: cx, y: margin.top + plotH + 21, class: "chart-label", "text-anchor": "middle" });
    label.textContent = row.label;
    svg.appendChild(label);
    const count = svgEl("text", { x: cx, y: margin.top + plotH + 39, class: "chart-label", "text-anchor": "middle" });
    count.textContent = `${row.usableRows} obs`;
    svg.appendChild(count);
  });
  const note = svgEl("text", { x: margin.left, y: 16, class: "chart-label" });
  note.textContent = "Average 20D return and maximum drawdown after each action";
  svg.appendChild(note);
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<span class="legend-teal"><i></i>20D return</span><span class="legend-red"><i></i>20D max drawdown</span>`;
  container.appendChild(legend);
}

function renderMethod() {
  const data = analysisPayload;
  containers.methodCopy.textContent =
    `The model is threshold- and rank-based. The main analysis uses score-bucket event studies, bootstrap confidence bands, and Spearman rank correlation to limit small-sample overfitting. ` +
    `The sample covers ${data.meta.startDate} through ${data.meta.endDate}, or ${data.meta.rows} trading days.`;
  containers.trendMeta.textContent = `${data.meta.startDate} - ${data.meta.endDate}`;
  containers.notes.textContent =
    `Put/Call history is missing for ${fmtPct(data.meta.putCallMissingShare * 100, 0)} of the sample; ` +
    `average HY/IG OAS missingness is ${fmtPct(data.meta.oasMissingShare * 100, 1)}. ` +
    `Use scoreInputCompleteness when filtering results rather than interpreting early low credit scores as fully stable credit.`;
}

function contiguousRegimeSegments(series) {
  const segments = [];
  let start = 0;
  for (let index = 1; index <= series.length; index += 1) {
    if (index === series.length || series[index].regime !== series[start].regime) {
      segments.push({ start, end: index - 1, regime: series[start].regime });
      start = index;
    }
  }
  return segments;
}

function renderTrendChart() {
  const container = containers.trend;
  const { svg, width, height } = makeSvg(container, 420);
  const tooltip = makeTooltip(container);
  const data = analysisPayload.timeSeries;
  const margin = { top: 24, right: 54, bottom: 46, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const spyBase = data[0]?.spyClose || 1;
  const normalized = data.map((row) => ({ ...row, spyIndex: (row.spyClose / spyBase) * 100 }));
  const xScale = scaleLinear(0, normalized.length - 1, margin.left, margin.left + plotW);
  const [spyMin, spyMax] = extent(normalized.map((row) => row.spyIndex), 0.06);
  const scoreMax = Math.max(8, ...normalized.map((row) => row.scoreTotal || 0));
  const ySpy = scaleLinear(spyMin, spyMax, margin.top + plotH, margin.top);
  const yScore = scaleLinear(0, scoreMax, margin.top + plotH, margin.top);

  contiguousRegimeSegments(normalized).forEach((segment) => {
    const x1 = xScale(segment.start);
    const x2 = xScale(segment.end);
    svg.appendChild(
      svgEl("rect", {
        x: x1,
        y: margin.top,
        width: Math.max(1, x2 - x1),
        height: plotH,
        class: `regime-band-${segment.regime}`,
      })
    );
  });

  const spyTicks = [Math.round(spyMin), Math.round((spyMin + spyMax) / 2), Math.round(spyMax)];
  drawGrid(svg, margin.left, margin.top, plotW, plotH, spyTicks, ySpy);

  const spyPath = pathFrom(normalized.map((row, index) => ({ x: xScale(index), y: ySpy(row.spyIndex) })));
  const scorePath = pathFrom(normalized.map((row, index) => ({ x: xScale(index), y: yScore(row.scoreTotal) })));
  svg.appendChild(svgEl("path", { d: spyPath, class: "chart-spy" }));
  svg.appendChild(svgEl("path", { d: scorePath, class: "chart-score-line" }));

  const scoreAxis = svgEl("g", { class: "chart-axis" });
  [0, Math.round(scoreMax / 2), scoreMax].forEach((tick) => {
    const py = yScore(tick);
    const text = svgEl("text", { x: width - margin.right + 8, y: py + 4, class: "chart-label" });
    text.textContent = tick.toFixed(0);
    scoreAxis.appendChild(text);
  });
  svg.appendChild(scoreAxis);

  const axis = svgEl("g", { class: "chart-axis" });
  const dateTickIndexes = [0, Math.floor(normalized.length * 0.25), Math.floor(normalized.length * 0.5), Math.floor(normalized.length * 0.75), normalized.length - 1];
  dateTickIndexes.forEach((index) => {
    const x = xScale(index);
    axis.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotH, y2: margin.top + plotH + 5 }));
    const label = svgEl("text", { x, y: margin.top + plotH + 22, class: "chart-label", "text-anchor": "middle" });
    label.textContent = normalized[index].date.slice(0, 7);
    axis.appendChild(label);
  });
  svg.appendChild(axis);

  const leftLabel = svgEl("text", { x: margin.left, y: 15, class: "chart-label" });
  leftLabel.textContent = "SPY index";
  svg.appendChild(leftLabel);
  const rightLabel = svgEl("text", { x: width - margin.right - 10, y: 15, class: "chart-label", "text-anchor": "end" });
  rightLabel.textContent = "Score";
  svg.appendChild(rightLabel);

  const crosshair = svgEl("line", { y1: margin.top, y2: margin.top + plotH, class: "zero-line", opacity: "0" });
  svg.appendChild(crosshair);
  svg.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const xInSvg = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.max(0, Math.min(normalized.length - 1, Math.round(((xInSvg - margin.left) / plotW) * (normalized.length - 1))));
    const row = normalized[index];
    const x = xScale(index);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.setAttribute("opacity", "1");
    setTooltip(
      container,
      tooltip,
      `<strong>${row.date}</strong>SPY ${fmtNum(row.spyClose, 2)}<br>Score ${row.scoreTotal}<br>Regime ${row.regime}<br>20D fwd ${fmtPct(row.spyRet20dFwd)}`,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  });
  svg.addEventListener("pointerleave", () => {
    crosshair.setAttribute("opacity", "0");
    hideTooltip(tooltip);
  });

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<span class="legend-blue"><i></i>SPY</span><span class="legend-amber"><i></i>Total score</span>`;
  container.appendChild(legend);
}

function renderBucketChart() {
  const container = containers.bucket;
  const { svg, width, height } = makeSvg(container, 330);
  const tooltip = makeTooltip(container);
  const margin = { top: 24, right: 22, bottom: 58, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const rows = Object.entries(analysisPayload.bucketAnalysis).map(([bucket, item]) => ({
    bucket,
    ...item.horizons[String(activeHorizon)],
    avgCompleteness: item.avgCompleteness,
  }));
  const values = rows.flatMap((row) => [row.avgReturn, row.returnCiLow, row.returnCiHigh, 0]);
  const [minY, maxY] = extent(values, 0.16);
  const y = scaleLinear(minY, maxY, margin.top + plotH, margin.top);
  const band = plotW / rows.length;
  drawGrid(svg, margin.left, margin.top, plotW, plotH, [Math.floor(minY), 0, Math.ceil(maxY)], y);
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: y(0), y2: y(0), class: "zero-line" }));

  rows.forEach((row, index) => {
    const cx = margin.left + band * index + band / 2;
    const barW = Math.min(58, band * 0.48);
    const y0 = y(0);
    const yValue = y(row.avgReturn || 0);
    const rect = svgEl("rect", {
      x: cx - barW / 2,
      y: Math.min(y0, yValue),
      width: barW,
      height: Math.max(1, Math.abs(y0 - yValue)),
      rx: 5,
      class: row.avgReturn >= 0 ? "bar-return" : "bar-drawdown",
    });
    svg.appendChild(rect);
    if (typeof row.returnCiLow === "number" && typeof row.returnCiHigh === "number") {
      svg.appendChild(svgEl("line", { x1: cx, x2: cx, y1: y(row.returnCiLow), y2: y(row.returnCiHigh), class: "ci-line" }));
      svg.appendChild(svgEl("line", { x1: cx - 9, x2: cx + 9, y1: y(row.returnCiLow), y2: y(row.returnCiLow), class: "ci-line" }));
      svg.appendChild(svgEl("line", { x1: cx - 9, x2: cx + 9, y1: y(row.returnCiHigh), y2: y(row.returnCiHigh), class: "ci-line" }));
    }
    const label = svgEl("text", { x: cx, y: margin.top + plotH + 20, class: "chart-label", "text-anchor": "middle" });
    label.textContent = row.bucket;
    svg.appendChild(label);
    const win = svgEl("text", { x: cx, y: margin.top + plotH + 38, class: "chart-label", "text-anchor": "middle" });
    win.textContent = `${fmtPct((row.winRate || 0) * 100, 0)} win`;
    svg.appendChild(win);
    rect.addEventListener("pointermove", (event) => {
      const box = svg.getBoundingClientRect();
      setTooltip(
        container,
        tooltip,
        `<strong>Score ${row.bucket}</strong>${activeHorizon}D avg ${fmtPct(row.avgReturn)}<br>CI ${fmtPct(row.returnCiLow)} to ${fmtPct(row.returnCiHigh)}<br>Vol ${fmtPct(row.avgRealizedVol)}<br>Rows ${row.usableRows}`,
        event.clientX - box.left,
        event.clientY - box.top
      );
    });
    rect.addEventListener("pointerleave", () => hideTooltip(tooltip));
  });

  const title = svgEl("text", { x: margin.left, y: 16, class: "chart-label" });
  title.textContent = `${activeHorizon}D forward average return with 90% bootstrap intervals`;
  svg.appendChild(title);
}

function renderRegimeChart() {
  const container = containers.regime;
  const { svg, width, height } = makeSvg(container, 330);
  const margin = { top: 24, right: 50, bottom: 52, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const rows = Object.entries(analysisPayload.regimeAnalysis).map(([key, item]) => ({
    key,
    label: item.label,
    ...item.horizons[String(activeHorizon)],
  }));
  const returnExtent = extent(rows.flatMap((row) => [row.avgReturn, 0]), 0.18);
  const volExtent = extent(rows.map((row) => row.avgRealizedVol), 0.08);
  const yRet = scaleLinear(returnExtent[0], returnExtent[1], margin.top + plotH, margin.top);
  const yVol = scaleLinear(Math.max(0, volExtent[0]), volExtent[1], margin.top + plotH, margin.top);
  const band = plotW / rows.length;
  drawGrid(svg, margin.left, margin.top, plotW, plotH, [Math.floor(returnExtent[0]), 0, Math.ceil(returnExtent[1])], yRet);
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: yRet(0), y2: yRet(0), class: "zero-line" }));

  const volPoints = [];
  rows.forEach((row, index) => {
    const cx = margin.left + band * index + band / 2;
    const barW = Math.min(52, band * 0.45);
    const y0 = yRet(0);
    const yValue = yRet(row.avgReturn || 0);
    svg.appendChild(
      svgEl("rect", {
        x: cx - barW / 2,
        y: Math.min(y0, yValue),
        width: barW,
        height: Math.max(1, Math.abs(y0 - yValue)),
        rx: 5,
        class: row.avgReturn >= 0 ? "bar-return" : "bar-drawdown",
      })
    );
    const label = svgEl("text", { x: cx, y: margin.top + plotH + 22, class: "chart-label", "text-anchor": "middle" });
    label.textContent = row.label;
    svg.appendChild(label);
    const count = svgEl("text", { x: cx, y: margin.top + plotH + 39, class: "chart-label", "text-anchor": "middle" });
    count.textContent = `${row.usableRows} obs`;
    svg.appendChild(count);
    volPoints.push({ x: cx, y: yVol(row.avgRealizedVol), value: row.avgRealizedVol });
  });
  svg.appendChild(svgEl("path", { d: pathFrom(volPoints), class: "chart-vol-line" }));
  volPoints.forEach((point) => {
    svg.appendChild(svgEl("circle", { cx: point.x, cy: point.y, r: 4, fill: "var(--red)" }));
  });
  [Math.round(volExtent[1]), Math.round((volExtent[1] + Math.max(0, volExtent[0])) / 2)].forEach((tick) => {
    const label = svgEl("text", { x: width - margin.right + 8, y: yVol(tick) + 4, class: "chart-label" });
    label.textContent = `${tick}%`;
    svg.appendChild(label);
  });
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<span class="legend-teal"><i></i>${activeHorizon}D return</span><span class="legend-red"><i></i>${activeHorizon}D volatility</span>`;
  container.appendChild(legend);
}

function renderRollingChart() {
  const container = containers.rolling;
  const { svg, width, height } = makeSvg(container, 330);
  const data = analysisPayload.rolling.filter((row) => row.return20 !== null && row.vol20 !== null);
  const margin = { top: 24, right: 24, bottom: 44, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = scaleLinear(0, data.length - 1, margin.left, margin.left + plotW);
  const y = scaleLinear(-1, 1, margin.top + plotH, margin.top);
  drawGrid(svg, margin.left, margin.top, plotW, plotH, [-1, -0.5, 0, 0.5, 1], y);
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: y(0), y2: y(0), class: "zero-line" }));
  svg.appendChild(svgEl("path", { d: pathFrom(data.map((row, index) => ({ x: x(index), y: y(row.return20) }))), class: "chart-return-line" }));
  svg.appendChild(svgEl("path", { d: pathFrom(data.map((row, index) => ({ x: x(index), y: y(row.vol20) }))), class: "chart-vol-line" }));
  [0, Math.floor(data.length / 2), data.length - 1].forEach((index) => {
    const label = svgEl("text", { x: x(index), y: margin.top + plotH + 22, class: "chart-label", "text-anchor": "middle" });
    label.textContent = data[index].date.slice(0, 7);
    svg.appendChild(label);
  });
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<span class="legend-teal"><i></i>Total score vs 20D return</span><span class="legend-red"><i></i>Total score vs 20D volatility</span>`;
  container.appendChild(legend);
}

function renderScoreStripChart() {
  const container = containers.scoreStrip;
  const { svg, width, height } = makeSvg(container, 330);
  const rows = analysisPayload.exactScoreRows;
  const margin = { top: 24, right: 22, bottom: 56, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = scaleLinear(0, Math.max(...rows.map((row) => row.score)), margin.left, margin.left + plotW);
  const [minY, maxY] = extent(rows.flatMap((row) => [row.avgReturn20, 0]), 0.16);
  const y = scaleLinear(minY, maxY, margin.top + plotH, margin.top);
  drawGrid(svg, margin.left, margin.top, plotW, plotH, [Math.floor(minY), 0, Math.ceil(maxY)], y);
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: y(0), y2: y(0), class: "zero-line" }));
  rows.forEach((row) => {
    const cx = x(row.score);
    const y0 = y(0);
    const yValue = y(row.avgReturn20 || 0);
    const barW = Math.max(7, Math.min(22, plotW / rows.length / 1.8));
    svg.appendChild(
      svgEl("rect", {
        x: cx - barW / 2,
        y: Math.min(y0, yValue),
        width: barW,
        height: Math.max(1, Math.abs(y0 - yValue)),
        rx: 4,
        class: row.avgReturn20 >= 0 ? "bar-return" : "bar-drawdown",
        opacity: Math.max(0.35, Math.min(1, row.rows / 80)),
      })
    );
    const label = svgEl("text", { x: cx, y: margin.top + plotH + 21, class: "chart-label", "text-anchor": "middle" });
    label.textContent = row.score;
    svg.appendChild(label);
  });
  const note = svgEl("text", { x: margin.left, y: 16, class: "chart-label" });
  note.textContent = "Bar opacity reflects the number of observations at each score";
  svg.appendChild(note);
}

function renderModuleChart() {
  const container = containers.module;
  const { svg, width, height } = makeSvg(container, 330);
  const modules = [
    ["volatilityScore", "Vol"],
    ["creditScore", "Credit"],
    ["sentimentScore", "Sentiment"],
    ["scoreTotal", "Total"],
  ];
  const targets = [
    ["return20", "20D Ret"],
    ["return60", "60D Ret"],
    ["vol20", "20D Vol"],
    ["drawdown20", "20D DD"],
  ];
  const margin = { top: 44, right: 20, bottom: 42, left: 82 };
  const cellW = (width - margin.left - margin.right) / targets.length;
  const cellH = (height - margin.top - margin.bottom) / modules.length;
  targets.forEach(([_, label], index) => {
    const text = svgEl("text", { x: margin.left + cellW * index + cellW / 2, y: 22, class: "chart-label", "text-anchor": "middle" });
    text.textContent = label;
    svg.appendChild(text);
  });
  modules.forEach(([moduleKey, moduleLabel], rowIndex) => {
    const y = margin.top + cellH * rowIndex;
    const rowLabel = svgEl("text", { x: margin.left - 10, y: y + cellH / 2 + 4, class: "chart-label", "text-anchor": "end" });
    rowLabel.textContent = moduleLabel;
    svg.appendChild(rowLabel);
    targets.forEach(([targetKey], colIndex) => {
      const value = analysisPayload.moduleCorrelations[moduleKey][targetKey].spearman;
      const opacity = value === null ? 0.08 : Math.max(0.12, Math.min(0.82, Math.abs(value)));
      const fill = value >= 0 ? "var(--teal)" : "var(--red)";
      const group = svgEl("g", { class: "heat-cell" });
      group.appendChild(
        svgEl("rect", {
          x: margin.left + cellW * colIndex + 4,
          y: y + 4,
          width: cellW - 8,
          height: cellH - 8,
          rx: 6,
          fill,
          opacity,
        })
      );
      const text = svgEl("text", {
        x: margin.left + cellW * colIndex + cellW / 2,
        y: y + cellH / 2,
      });
      text.textContent = value === null ? "--" : value.toFixed(2);
      group.appendChild(text);
      svg.appendChild(group);
    });
  });
  const note = svgEl("text", { x: margin.left, y: height - 13, class: "chart-label" });
  note.textContent = "Spearman rank correlation; darker cells indicate a stronger relationship";
  svg.appendChild(note);
}

function dailyWindow() {
  const series = Array.isArray(dailyEvidencePayload?.series) ? dailyEvidencePayload.series : [];
  if (!series.length) return [];
  const latest = new Date(`${series[series.length - 1].date}T00:00:00Z`).getTime();
  const cutoff = latest - dailyRangeDays * 86400000;
  return series.filter((row) => new Date(`${row.date}T00:00:00Z`).getTime() >= cutoff);
}

function dailyActionLabel(action) {
  if (action === "ADD") return "ADD";
  if (action === "ADD_SMALL") return "ADD SMALL";
  if (action === "REDUCE") return "REDUCE";
  return "HOLD";
}

function renderDailyKpis() {
  if (!containers.dailyKpis || !dailyEvidencePayload?.latest) return;
  const latest = dailyEvidencePayload.latest;
  containers.dailyKpis.innerHTML = `
    <article class="daily-evidence-kpi">
      <span>Latest trading day</span>
      <strong>${latest.date || "--"}</strong>
      <p>SPY ${fmtNum(latest.spyClose, 2)} · drawdown ${fmtPct(latest.spyDrawdown)}</p>
    </article>
    <article class="daily-evidence-kpi">
      <span>Volatility state</span>
      <strong>VIX ${fmtNum(latest.vix, 1)}</strong>
      <p>MOVE ${fmtNum(latest.move, 1)} · QQQ drawdown ${fmtPct(latest.qqqDrawdown)}</p>
    </article>
    <article class="daily-evidence-kpi">
      <span>Credit and rates</span>
      <strong>HY OAS ${fmtNum(latest.hyOas, 2)}</strong>
      <p>10Y ${fmtPct(latest.tenYYield, 2)} · IG OAS ${fmtNum(latest.igOas, 2)}</p>
    </article>
    <article class="daily-evidence-kpi">
      <span>Model action</span>
      <strong>${dailyActionLabel(latest.allocationAction)}</strong>
      <p>Opportunity ${fmtNum(latest.opportunityScore, 0)} · Risk ${fmtNum(latest.riskScore, 0)}</p>
    </article>
  `;
}

function renderDailyLineChart(container, rows, series, options = {}) {
  if (!container) return;
  const { svg, width, height } = makeSvg(container, 320);
  if (rows.length < 2) {
    const note = svgEl("text", { x: 24, y: 42, class: "chart-label" });
    note.textContent = "Waiting for at least two trading days of data.";
    svg.appendChild(note);
    return;
  }

  const tooltip = makeTooltip(container);
  const margin = { top: 24, right: 24, bottom: 46, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = scaleLinear(0, rows.length - 1, margin.left, margin.left + plotW);
  const values = rows.flatMap((row) => series.map((item) => item.value(row))).filter(Number.isFinite);
  const [minY, maxY] = options.fixedDomain || extent(values.concat(options.includeZero ? [0] : []), 0.12);
  const y = scaleLinear(minY, maxY, margin.top + plotH, margin.top);
  const ticks = options.ticks || [minY, (minY + maxY) / 2, maxY];
  drawGrid(svg, margin.left, margin.top, plotW, plotH, ticks.map((tick) => Number(tick.toFixed(1))), y);
  if (minY < 0 && maxY > 0) {
    svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left + plotW, y1: y(0), y2: y(0), class: "zero-line" }));
  }

  series.forEach((item) => {
    const points = rows
      .map((row, index) => {
        const value = item.value(row);
        return { x: x(index), y: Number.isFinite(value) ? y(value) : Number.NaN, row, index };
      })
      .filter((point) => Number.isFinite(point.y));
    svg.appendChild(svgEl("path", { d: pathFrom(points), class: item.className }));
  });

  [0, Math.floor((rows.length - 1) / 2), rows.length - 1].forEach((index) => {
    const label = svgEl("text", { x: x(index), y: margin.top + plotH + 24, class: "chart-label", "text-anchor": "middle" });
    label.textContent = rows[index].date.slice(5);
    svg.appendChild(label);
  });

  rows.forEach((row, index) => {
    const target = svgEl("rect", {
      x: x(index) - Math.max(4, plotW / rows.length / 2),
      y: margin.top,
      width: Math.max(8, plotW / rows.length),
      height: plotH,
      fill: "transparent",
    });
    target.addEventListener("mouseenter", (event) => {
      const details = series
        .map((item) => `${item.label}: ${item.format ? item.format(item.raw ? item.raw(row) : item.value(row)) : fmtNum(item.value(row), 1)}`)
        .join("<br>");
      setTooltip(container, tooltip, `<strong>${row.date}</strong>${details}`, event.offsetX, event.offsetY);
    });
    target.addEventListener("mousemove", (event) => {
      tooltip.style.left = `${Math.min(event.offsetX + 12, container.clientWidth - 180)}px`;
    });
    target.addEventListener("mouseleave", () => hideTooltip(tooltip));
    svg.appendChild(target);
  });

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = series.map((item) => `<span class="${item.legendClass}"><i></i>${item.label}</span>`).join("");
  container.appendChild(legend);
}

function renderDailyEvidence() {
  if (!containers.dailyMeta) return;
  const rows = dailyWindow();
  if (!dailyEvidencePayload || !rows.length) {
    containers.dailyMeta.textContent = "Daily dataset not yet generated";
    if (containers.dailyKpis) containers.dailyKpis.innerHTML = `<div class="daily-evidence-empty">Waiting for the post-close collector to populate data/daily_evidence.json.</div>`;
    return;
  }

  const coverage = dailyEvidencePayload.coverage || {};
  containers.dailyMeta.textContent = `${rows.length} trading days | full history ${coverage.start || "--"} - ${coverage.end || "--"}`;
  renderDailyKpis();
  renderDailyLineChart(
    containers.dailyMarket,
    rows,
    [
      { label: "SPY drawdown", value: (row) => row.spyDrawdown, format: (value) => fmtPct(value), className: "chart-spy", legendClass: "legend-blue" },
      { label: "QQQ drawdown", value: (row) => row.qqqDrawdown, format: (value) => fmtPct(value), className: "chart-vol-line", legendClass: "legend-red" },
    ],
    { includeZero: true }
  );
  renderDailyLineChart(
    containers.dailyRisk,
    rows,
    [
      { label: "Fear & Greed", value: (row) => row.fearGreed, className: "chart-spy", legendClass: "legend-blue" },
      {
        label: "Pressure index",
        value: (row) => Math.max(0, Math.min(100, Number(row.scoreTotal || 0) * (100 / 24))),
        raw: (row) => row.scoreTotal,
        format: (value) => fmtNum(value, 0),
        className: "chart-vol-line",
        legendClass: "legend-red",
      },
      {
        label: "Breadth index",
        value: (row) => Math.max(0, Math.min(100, 50 + Number(row.rspSpyRel60d || 0) * 5)),
        raw: (row) => row.rspSpyRel60d,
        format: (value) => `${fmtNum(value, 2)}pp`,
        className: "chart-return-line",
        legendClass: "legend-teal",
      },
    ],
    { fixedDomain: [0, 100], ticks: [0, 25, 50, 75, 100] }
  );
}

function renderAll() {
  renderKpis();
  renderDecision();
  renderMethod();
  renderTrendChart();
  renderBucketChart();
  renderRegimeChart();
  renderRollingChart();
  renderScoreStripChart();
  renderModuleChart();
  renderDailyEvidence();
}

function bindControls() {
  document.querySelectorAll("[data-horizon]").forEach((button) => {
    button.addEventListener("click", () => {
      activeHorizon = Number(button.dataset.horizon) || 20;
      document.querySelectorAll("[data-horizon]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderAll();
    });
  });
  document.querySelectorAll("[data-daily-range]").forEach((button) => {
    button.addEventListener("click", () => {
      dailyRangeDays = Number(button.dataset.dailyRange) || 90;
      document.querySelectorAll("[data-daily-range]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderDailyEvidence();
    });
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (analysisPayload) renderAll();
    }, 120);
  });
}

async function init() {
  try {
    const [analysisResponse, signalResponse, dailyResponse] = await Promise.all([
      fetch(`${ANALYSIS_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${SIGNAL_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${DAILY_EVIDENCE_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
    ]);
    if (!analysisResponse.ok) throw new Error(`analysis HTTP ${analysisResponse.status}`);
    if (!signalResponse.ok) throw new Error(`signal HTTP ${signalResponse.status}`);
    analysisPayload = await analysisResponse.json();
    signalPayload = await signalResponse.json();
    dailyEvidencePayload = dailyResponse?.ok ? await dailyResponse.json() : null;
    bindControls();
    renderAll();
  } catch (error) {
    document.querySelector(".analysis-page").innerHTML = `
      <section class="analysis-method">
        <div>
          <p class="eyebrow">Load Error</p>
          <h2>Evidence data could not be loaded</h2>
          <p class="analysis-copy">${error.message}</p>
        </div>
      </section>
    `;
  }
}

init();
