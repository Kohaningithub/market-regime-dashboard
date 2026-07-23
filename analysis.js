const ANALYSIS_ENDPOINT = "data/regime_model_quant_analysis.json";
const SIGNAL_ENDPOINT = "data/allocation_signal.json";
const HORIZONS = [5, 10, 20, 60];

let analysisPayload = null;
let signalPayload = null;
let activeHorizon = 20;
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
      <span>${activeHorizon}D 高分组平均收益</span>
      <strong>${fmtPct(highReturn)}</strong>
      <p>Score 5+ 样本，胜率 ${fmtPct((highWinRate ?? 0) * 100, 0)}</p>
    </article>
    <article class="analysis-kpi">
      <span>${activeHorizon}D 低分组平均收益</span>
      <strong>${fmtPct(lowReturn)}</strong>
      <p>Score 0-2 样本，胜率 ${fmtPct((lowWinRate ?? 0) * 100, 0)}</p>
    </article>
    <article class="analysis-kpi">
      <span>Score 与 20D 波动相关</span>
      <strong>${fmtNum(data.headline.scoreTotalVol20Spearman, 2)}</strong>
      <p>Spearman 秩相关</p>
    </article>
    <article class="analysis-kpi">
      <span>平均输入覆盖率</span>
      <strong>${fmtPct(data.meta.avgCompleteness * 100, 1)}</strong>
      <p>高分组 ${activeHorizon}D 年化波动 ${fmtPct(highVol)}</p>
    </article>
  `;
}

function actionText(action) {
  if (action === "ADD") return "加仓";
  if (action === "ADD_SMALL") return "小幅分批加仓";
  if (action === "REDUCE") return "减仓";
  return "维持";
}

function renderDecision() {
  if (!signalPayload) return;
  const current = signalPayload.currentSignal;
  const actionClass = current.action === "REDUCE" ? "reduce" : current.action === "ADD" || current.action === "ADD_SMALL" ? "add" : "hold";
  containers.decisionMeta.textContent = `${current.asOf || "--"} | market state ${current.marketState || "--"}`;
  containers.decisionCurrent.innerHTML = `
    <article class="decision-card decision-card-main decision-action-${actionClass}">
      <span>当前动作</span>
      <strong>${current.stance || actionText(current.action)}</strong>
      <p>${current.reason || ""}</p>
    </article>
    <article class="decision-card">
      <span>机会分</span>
      <strong>${fmtNum(current.opportunityScore, 1)}</strong>
      <p>回撤 ${fmtPct(current.keyInputs?.spyDrawdown)} · Fear & Greed ${fmtNum(current.keyInputs?.fearGreed, 0)}</p>
    </article>
    <article class="decision-card">
      <span>风险分</span>
      <strong>${fmtNum(current.riskScore, 1)}</strong>
      <p>Credit ${fmtNum(current.keyInputs?.creditScore, 0)} · HY OAS ${fmtNum(current.keyInputs?.hyOas, 2)}</p>
    </article>
    <article class="decision-card">
      <span>关键市场状态</span>
      <strong>VIX ${fmtNum(current.keyInputs?.vix, 1)}</strong>
      <p>20D 实现波动 ${fmtPct(current.keyInputs?.spyRealizedVol20dTrailing)}</p>
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
  note.textContent = "每个动作后的 20D 平均收益与平均最大回撤";
  svg.appendChild(note);
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<span class="legend-teal"><i></i>20D 收益</span><span class="legend-red"><i></i>20D 最大回撤</span>`;
  container.appendChild(legend);
}

function renderMethod() {
  const data = analysisPayload;
  containers.methodCopy.textContent =
    `模型分数是阈值型和排序型，主分析使用分数桶事件研究、bootstrap 置信带和 Spearman 秩相关，避免用小样本过度拟合。样本区间 ${data.meta.startDate} 至 ${data.meta.endDate}，` +
    `共 ${data.meta.rows} 个交易日。`;
  containers.trendMeta.textContent = `${data.meta.startDate} - ${data.meta.endDate}`;
  containers.notes.textContent =
    `Put/Call 历史缺失率 ${fmtPct(data.meta.putCallMissingShare * 100, 0)}；` +
    `HY/IG OAS 平均缺失率 ${fmtPct(data.meta.oasMissingShare * 100, 1)}。` +
    `因此分析更适合用 scoreInputCompleteness 做过滤或分组，而不是把早期低信用分直接理解为信用完全稳定。`;
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
  legend.innerHTML = `<span class="legend-blue"><i></i>SPY</span><span class="legend-amber"><i></i>总分</span>`;
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
  title.textContent = `${activeHorizon}D 未来平均收益，误差线为 90% bootstrap 区间`;
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
  legend.innerHTML = `<span class="legend-teal"><i></i>${activeHorizon}D 收益</span><span class="legend-red"><i></i>${activeHorizon}D 波动</span>`;
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
  legend.innerHTML = `<span class="legend-teal"><i></i>总分 vs 20D 收益</span><span class="legend-red"><i></i>总分 vs 20D 波动</span>`;
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
  note.textContent = "柱形深浅反映该分数下的样本数量";
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
  note.textContent = "Spearman 秩相关；颜色越深代表排序关系越强";
  svg.appendChild(note);
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
}

function bindControls() {
  document.querySelectorAll("[data-horizon]").forEach((button) => {
    button.addEventListener("click", () => {
      activeHorizon = Number(button.dataset.horizon) || 20;
      document.querySelectorAll("[data-horizon]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderAll();
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
    const [analysisResponse, signalResponse] = await Promise.all([
      fetch(`${ANALYSIS_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${SIGNAL_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (!analysisResponse.ok) throw new Error(`analysis HTTP ${analysisResponse.status}`);
    if (!signalResponse.ok) throw new Error(`signal HTTP ${signalResponse.status}`);
    analysisPayload = await analysisResponse.json();
    signalPayload = await signalResponse.json();
    bindControls();
    renderAll();
  } catch (error) {
    document.querySelector(".analysis-page").innerHTML = `
      <section class="analysis-method">
        <div>
          <p class="eyebrow">Load Error</p>
          <h2>分析数据未加载成功</h2>
          <p class="analysis-copy">${error.message}</p>
        </div>
      </section>
    `;
  }
}

init();
