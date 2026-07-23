const modules = [
  {
    name: "波动率指标",
    hint: "VIX 与美债波动率",
    fields: [
      { key: "vix", label: "VIX", suffix: "", step: 0.1 },
      { key: "vixChange5d", label: "VIX 5日变化", suffix: "点", step: 0.1 },
      { key: "move", label: "MOVE Index", suffix: "", step: 0.1 }
    ]
  },
  {
    name: "股市回撤指标",
    hint: "指数深度与市场广度",
    fields: [
      { key: "spyDrawdown", label: "SPY drawdown", suffix: "%", step: 0.1 },
      { key: "qqqDrawdown", label: "QQQ drawdown", suffix: "%", step: 0.1 },
      { key: "rspSpyRel60d", label: "RSP/SPY 60日相对表现", suffix: "%", step: 0.1 }
    ]
  },
  {
    name: "情绪指标",
    hint: "贪婪、看跌与期权保护",
    fields: [
      { key: "fearGreed", label: "Fear & Greed Index", suffix: "", step: 1 },
      { key: "aaiiBearish", label: "AAII Bearish %", suffix: "%", step: 0.1 },
      { key: "putCall", label: "Put/Call Ratio", suffix: "", step: 0.01 }
    ]
  },
  {
    name: "信用市场指标",
    hint: "高收益债与信用利差",
    fields: [
      { key: "hygRet20d", label: "HYG 20日回报", suffix: "%", step: 0.1 },
      { key: "jnkRet20d", label: "JNK 20日回报", suffix: "%", step: 0.1 },
      { key: "hyOas", label: "High Yield OAS", suffix: "%", step: 0.01 },
      { key: "hyOasChange20d", label: "HY OAS 20日扩大", suffix: "bp", step: 1 },
      { key: "igOas", label: "Investment Grade OAS", suffix: "%", step: 0.01 },
      { key: "igOasChange20d", label: "IG OAS 20日扩大", suffix: "bp", step: 1 }
    ]
  },
  {
    name: "系统性风险指标",
    hint: "美元、利率、金融条件与银行股",
    fields: [
      { key: "dxyChange20d", label: "DXY 20日变化", suffix: "%", step: 0.1 },
      { key: "tenYYield", label: "10Y Treasury Yield", suffix: "%", step: 0.01 },
      { key: "tenYChange20d", label: "10Y Yield 20日变化", suffix: "bp", step: 1 },
      { key: "realTenY", label: "10Y Real Yield", suffix: "%", step: 0.01 },
      { key: "realTenYChange20d", label: "10Y Real Yield 20日变化", suffix: "bp", step: 1 },
      { key: "nfci", label: "NFCI", suffix: "", step: 0.01 },
      { key: "kreRel20d", label: "KRE vs SPY 20日相对表现", suffix: "%", step: 0.1 }
    ]
  }
];

const sourceLinks = {
  vix: {
    label: "Cboe VIX",
    url: "https://www.cboe.com/tradable_products/vix/"
  },
  vixChange5d: {
    label: "Cboe VIX",
    url: "https://www.cboe.com/tradable_products/vix/"
  },
  move: {
    label: "Yahoo ^MOVE",
    url: "https://finance.yahoo.com/quote/%5EMOVE/"
  },
  spyDrawdown: {
    label: "Yahoo SPY",
    url: "https://finance.yahoo.com/quote/SPY/"
  },
  qqqDrawdown: {
    label: "Yahoo QQQ",
    url: "https://finance.yahoo.com/quote/QQQ/"
  },
  rspSpyRel60d: {
    label: "Yahoo RSP",
    url: "https://finance.yahoo.com/quote/RSP/"
  },
  fearGreed: {
    label: "CNN F&G",
    url: "https://www.cnn.com/markets/fear-and-greed"
  },
  aaiiBearish: {
    label: "AAII",
    url: "https://www.aaii.com/sentimentsurvey"
  },
  putCall: {
    label: "Cboe Stats",
    url: "https://www.cboe.com/us/options/market_statistics/daily/"
  },
  hygRet20d: {
    label: "Yahoo HYG",
    url: "https://finance.yahoo.com/quote/HYG/"
  },
  jnkRet20d: {
    label: "Yahoo JNK",
    url: "https://finance.yahoo.com/quote/JNK/"
  },
  hyOas: {
    label: "FRED HY OAS",
    url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2"
  },
  hyOasChange20d: {
    label: "FRED HY OAS",
    url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2"
  },
  igOas: {
    label: "FRED IG OAS",
    url: "https://fred.stlouisfed.org/series/BAMLC0A0CM"
  },
  igOasChange20d: {
    label: "FRED IG OAS",
    url: "https://fred.stlouisfed.org/series/BAMLC0A0CM"
  },
  dxyChange20d: {
    label: "Yahoo DXY",
    url: "https://finance.yahoo.com/quote/DX-Y.NYB/"
  },
  tenYYield: {
    label: "FRED DGS10",
    url: "https://fred.stlouisfed.org/series/DGS10"
  },
  tenYChange20d: {
    label: "FRED DGS10",
    url: "https://fred.stlouisfed.org/series/DGS10"
  },
  realTenY: {
    label: "FRED DFII10",
    url: "https://fred.stlouisfed.org/series/DFII10"
  },
  realTenYChange20d: {
    label: "FRED DFII10",
    url: "https://fred.stlouisfed.org/series/DFII10"
  },
  nfci: {
    label: "FRED NFCI",
    url: "https://fred.stlouisfed.org/series/NFCI"
  },
  kreRel20d: {
    label: "Yahoo KRE",
    url: "https://finance.yahoo.com/quote/KRE/"
  }
};

let activePreset = "live";
let liveSnapshot = null;
let latestHistory = null;
let latestSignal = null;
let dashboardState = { mode: "loading", snapshot: null, history: null };
let historyRangeDays = 90;

const form = document.querySelector("#metric-form");
const regimeInternal = document.querySelector("#regime-internal");
const regimeChange = document.querySelector("#regime-change");
const liveMeta = document.querySelector("#live-meta");
const dataQuality = document.querySelector("#data-quality");
const recentUpdatesMeta = document.querySelector("#recent-updates-meta");
const recentUpdates = document.querySelector("#recent-updates");
const historyMeta = document.querySelector("#history-meta");
const historySummary = document.querySelector("#history-summary");
const historyStats = document.querySelector("#history-stats");
const historyStrip = document.querySelector("#history-strip");
const historyRangeButtons = Array.from(document.querySelectorAll(".history-range-button"));
const allocationSignalTitle = document.querySelector("#allocation-signal-title");
const allocationSignalReason = document.querySelector("#allocation-signal-reason");
const allocationSignalMeta = document.querySelector("#allocation-signal-meta");
const allocationOpportunity = document.querySelector("#allocation-opportunity");
const allocationRisk = document.querySelector("#allocation-risk");
const allocationPressure = document.querySelector("#allocation-pressure");
const allocationPressureNote = document.querySelector("#allocation-pressure-note");
const allocationOpportunityMeter = document.querySelector("#allocation-opportunity-meter");
const allocationRiskMeter = document.querySelector("#allocation-risk-meter");
const allocationGuidance = document.querySelector("#allocation-guidance");
const riskBudgetGuidance = document.querySelector("#risk-budget-guidance");
const watchGuidance = document.querySelector("#watch-guidance");
const CLIENT_POLL_MS = 120000;
const STALE_SNAPSHOT_MINUTES = 1440;
const STATIC_SNAPSHOT_ENDPOINT = "data/latest.json";
const HISTORY_ENDPOINT = "data/history.json";
const ALLOCATION_SIGNAL_ENDPOINT = "data/allocation_signal.json";
const STATIC_TIMEOUT_MS = 8000;
const ET_TIMEZONE = "America/New_York";
const SCORE_MAX = {
  volatility: 8,
  credit: 18,
  sentiment: 8
};

function thresholdScore(value, rules, direction = "above") {
  return rules.reduce((score, threshold) => {
    if (direction === "above" && value > threshold) return score + 1;
    if (direction === "below" && value < threshold) return score + 1;
    return score;
  }, 0);
}

function buildForm() {
  if (!form) return;
  form.innerHTML = modules
    .map((module) => {
      const fields = module.fields
        .map((field) => {
          const source = sourceLinks[field.key];
          return `
            <div class="field">
              <div class="field-label-row">
                <label for="${field.key}">${field.label}${field.suffix ? ` (${field.suffix})` : ""}</label>
                ${
                  source
                    ? `<a class="source-link" href="${source.url}" target="_blank" rel="noopener" title="${source.label}">Source</a>`
                    : ""
                }
              </div>
              <input id="${field.key}" name="${field.key}" type="number" step="${field.step}" inputmode="decimal" readonly aria-readonly="true" />
              <small id="${field.key}-meta" class="field-meta"></small>
            </div>
          `;
        })
        .join("");
      return `
        <fieldset class="module-block">
          <div class="module-title">
            <h3>${module.name}</h3>
            <span>${module.hint}</span>
          </div>
          <div class="input-grid">${fields}</div>
        </fieldset>
      `;
    })
    .join("");

}

function setValues(values) {
  Object.entries(values).forEach(([key, value]) => {
    const input = document.querySelector(`#${key}`);
    if (input) input.value = value;
  });
}

function getValues() {
  const values = {};
  modules.flatMap((module) => module.fields).forEach((field) => {
    const input = document.querySelector(`#${field.key}`);
    values[field.key] = Number(input?.value || 0);
  });
  return values;
}

function addTrigger(triggers, severity, text) {
  triggers.push({ severity, text });
}

function calculateScores(values) {
  const triggers = [];

  const volatility =
    thresholdScore(values.vix, [20, 25, 35, 45]) +
    thresholdScore(values.vixChange5d, [5, 10]) +
    thresholdScore(values.move, [120, 160]);

  if (values.vix > 35) addTrigger(triggers, "danger", `VIX ${values.vix.toFixed(1)} 高于35，市场进入极端波动区。`);
  else if (values.vix > 25) addTrigger(triggers, "warning", `VIX ${values.vix.toFixed(1)} 高于25，恐慌明显升温。`);
  else if (values.vix > 20) addTrigger(triggers, "info", `VIX ${values.vix.toFixed(1)} 高于20，属于温和风险释放。`);
  if (values.vixChange5d > 10) addTrigger(triggers, "danger", `VIX 5日上升 ${values.vixChange5d.toFixed(1)} 点，恐慌速度很快。`);
  else if (values.vixChange5d > 5) addTrigger(triggers, "warning", `VIX 5日上升 ${values.vixChange5d.toFixed(1)} 点，短期避险需求抬升。`);
  if (values.move > 160) addTrigger(triggers, "danger", `MOVE ${values.move.toFixed(1)} 高于160，美债波动率异常。`);
  else if (values.move > 120) addTrigger(triggers, "warning", `MOVE ${values.move.toFixed(1)} 高于120，利率市场波动升温。`);

  const sentiment =
    thresholdScore(values.fearGreed, [40, 25, 15], "below") +
    thresholdScore(values.aaiiBearish, [40, 50, 60]) +
    thresholdScore(values.putCall, [0.75, 0.9]);

  if (values.fearGreed < 15) addTrigger(triggers, "danger", `Fear & Greed ${values.fearGreed.toFixed(0)}，情绪极端悲观。`);
  else if (values.fearGreed < 25) addTrigger(triggers, "warning", `Fear & Greed ${values.fearGreed.toFixed(0)}，市场处于恐惧区。`);
  if (values.aaiiBearish > 60) addTrigger(triggers, "danger", `AAII Bearish ${values.aaiiBearish.toFixed(1)}%，散户极端悲观。`);
  else if (values.aaiiBearish > 50) addTrigger(triggers, "warning", `AAII Bearish ${values.aaiiBearish.toFixed(1)}%，看跌比例偏高。`);
  if (values.putCall > 0.9) addTrigger(triggers, "warning", `Put/Call ${values.putCall.toFixed(2)} 高于0.90，保护性需求较强。`);

  const credit =
    thresholdScore(values.hygRet20d, [-3, -5], "below") +
    thresholdScore(values.jnkRet20d, [-3, -5], "below") +
    thresholdScore(values.hyOas, [4.5, 6]) +
    thresholdScore(values.hyOasChange20d, [75, 150]) +
    thresholdScore(values.igOas, [1.25, 1.75]) +
    thresholdScore(values.igOasChange20d, [25, 60]) +
    thresholdScore(values.dxyChange20d, [3, 5]) +
    thresholdScore(values.nfci, [0, 0.5]) +
    thresholdScore(values.kreRel20d, [-8, -15], "below");

  if (values.hygRet20d < -5 || values.jnkRet20d < -5) addTrigger(triggers, "danger", "HYG/JNK 20日跌幅超过5%，高收益债价格压力显著。");
  else if (values.hygRet20d < -3 || values.jnkRet20d < -3) addTrigger(triggers, "warning", "HYG/JNK 20日跌幅超过3%，信用风险开始升温。");
  if (values.hyOasChange20d > 150) addTrigger(triggers, "danger", `HY OAS 20日扩大 ${values.hyOasChange20d.toFixed(0)} bp，信用利差快速失控。`);
  else if (values.hyOasChange20d > 75) addTrigger(triggers, "warning", `HY OAS 20日扩大 ${values.hyOasChange20d.toFixed(0)} bp，信用利差明显恶化。`);
  if (values.igOasChange20d > 60) addTrigger(triggers, "danger", `IG OAS 20日扩大 ${values.igOasChange20d.toFixed(0)} bp，压力扩散至投资级信用。`);
  else if (values.igOasChange20d > 25) addTrigger(triggers, "warning", `IG OAS 20日扩大 ${values.igOasChange20d.toFixed(0)} bp，优质信用也在承压。`);
  if (values.dxyChange20d > 5) addTrigger(triggers, "danger", `DXY 20日上涨 ${values.dxyChange20d.toFixed(1)}%，美元流动性压力很强。`);
  else if (values.dxyChange20d > 3) addTrigger(triggers, "warning", `DXY 20日上涨 ${values.dxyChange20d.toFixed(1)}%，美元避险需求抬升。`);
  if (values.nfci > 0.5) addTrigger(triggers, "danger", `NFCI ${values.nfci.toFixed(2)} 高于0.5，金融条件显著收紧。`);
  else if (values.nfci > 0) addTrigger(triggers, "warning", `NFCI ${values.nfci.toFixed(2)} 高于0，金融条件紧于均值。`);
  if (values.kreRel20d < -15) addTrigger(triggers, "danger", `KRE相对SPY 20日跑输 ${Math.abs(values.kreRel20d).toFixed(1)}%，银行股压力突出。`);
  else if (values.kreRel20d < -8) addTrigger(triggers, "warning", `KRE相对SPY 20日跑输 ${Math.abs(values.kreRel20d).toFixed(1)}%，银行板块走弱。`);

  if (values.spyDrawdown < -15 || values.qqqDrawdown < -20) {
    addTrigger(triggers, "danger", `SPY回撤 ${values.spyDrawdown.toFixed(1)}%，QQQ回撤 ${values.qqqDrawdown.toFixed(1)}%，指数跌幅很深。`);
  } else if (values.spyDrawdown < -8 || values.qqqDrawdown < -12) {
    addTrigger(triggers, "warning", `SPY回撤 ${values.spyDrawdown.toFixed(1)}%，QQQ回撤 ${values.qqqDrawdown.toFixed(1)}%，市场回调较深。`);
  } else if (values.spyDrawdown < -3 || values.qqqDrawdown < -5) {
    addTrigger(triggers, "info", `SPY回撤 ${values.spyDrawdown.toFixed(1)}%，QQQ回撤 ${values.qqqDrawdown.toFixed(1)}%，属于普通调整区间。`);
  }

  return { volatility, sentiment, credit, triggers };
}

function hasSystemicCluster(values, creditScore) {
  const clusterSignals = [
    values.hygRet20d <= -5,
    values.jnkRet20d <= -5,
    values.hyOasChange20d >= 75,
    values.igOasChange20d >= 25,
    values.dxyChange20d >= 3,
    values.nfci > 0,
    values.kreRel20d <= -8,
    values.move >= 160
  ].filter(Boolean).length;

  return creditScore >= 4 && clusterSignals >= 3;
}

function classify(values, scores) {
  const systemicCluster = hasSystemicCluster(values, scores.credit);
  const overheated =
    values.fearGreed > 75 &&
    values.putCall < 0.55 &&
    values.rspSpyRel60d < -3;

  if (scores.credit >= 6 || systemicCluster) {
    return {
      key: "defensive",
      title: "Systemic Stress",
      summary:
        "信用压力优先级最高。股市下跌同时伴随信用、银行、美元或美债波动恶化时，先降低风险敞口，不急着抄底。",
      tone: "danger",
      overheated
    };
  }

  if (
    scores.credit <= 3 &&
    (scores.volatility >= 5 || values.vix >= 35 || scores.sentiment >= 5) &&
    (values.spyDrawdown <= -12 || values.qqqDrawdown <= -18)
  ) {
    return {
      key: "extreme",
      title: "Extreme Panic",
      summary:
        "波动率和情绪已经极端，但信用市场尚未失控。可以开始关注抄底窗口，执行上仍应分批和控制仓位。",
      tone: "danger",
      overheated
    };
  }

  if (
    scores.credit <= 3 &&
    scores.volatility >= 3 &&
    scores.sentiment >= 3 &&
    (values.spyDrawdown <= -8 || values.qqqDrawdown <= -12)
  ) {
    return {
      key: "panic",
      title: "Panic Pullback",
      summary:
        "市场情绪进入恐惧区，指数回调较深，但信用和美元流动性尚未出现失序信号。适合按计划分批加仓。",
      tone: "warning",
      overheated
    };
  }

  return {
    key: "normal",
    title: "Normal / Mild Pullback",
    summary:
      "信用市场稳定，波动率未进入失控区。若指数只是普通调整，可以维持正常定投和再平衡纪律。",
    tone: "calm",
    overheated
  };
}

function investmentImplications(regime, scores, values) {
  if (regime.key === "defensive") {
    return {
      primary: "先防守，不急着抄底",
      allocation: "降低高 beta、杠杆和低质量信用敞口",
      watch: "HY/IG OAS、HYG/JNK、KRE、DXY 是否稳定"
    };
  }

  if (regime.key === "extreme") {
    return {
      primary: "关注抄底窗口",
      allocation: "用现金分层买入，保留后续弹药",
      watch: "信用利差是否保持稳定，VIX 是否见顶回落"
    };
  }

  if (regime.key === "panic") {
    return {
      primary: "按计划分批加仓",
      allocation: "优先宽基、质量股和长期核心仓位",
      watch: "恐慌是否扩散到信用市场和银行股"
    };
  }

  if (regime.overheated) {
    return {
      primary: "避免追高",
      allocation: "控制杠杆，考虑再平衡和获利回收",
      watch: "Fear & Greed、Put/Call、RSP/SPY 广度"
    };
  }

  if (values.spyDrawdown < -3 || values.qqqDrawdown < -5 || scores.volatility > 0) {
    return {
      primary: "维持定投和再平衡",
      allocation: "不用因为普通回调改变长期计划",
      watch: "VIX 是否继续上行，信用分数是否抬头"
    };
  }

  return {
    primary: "维持目标配置",
    allocation: "按既定再平衡规则执行，暂不主动提高风险暴露",
    watch: "上涨集中度和情绪过热信号"
  };
}

function formatDateTime(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function snapshotAgeMinutes(snapshot) {
  if (!snapshot?.generatedAt) return null;
  const parsed = new Date(snapshot.generatedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
}

function formatAge(minutes) {
  if (minutes === null) return "--";
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟前` : `${hours}小时前`;
}

function formatShortDate(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

function formatLongDate(value) {
  if (!value) return "--";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    const direct = new Date(value);
    if (Number.isNaN(direct.getTime())) return value;
    return direct.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatEtTime(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleTimeString("en-US", {
    timeZone: ET_TIMEZONE,
    hour: "numeric",
    minute: "2-digit"
  })} ET`;
}

function rangeLabel(days) {
  if (days === 30) return "1M";
  if (days === 90) return "3M";
  if (days === 180) return "6M";
  if (days === 365) return "1Y";
  return `${days}D`;
}

function historyCollections(history) {
  const legacyEntries = Array.isArray(history?.entries) ? history.entries : [];
  const recent = Array.isArray(history?.recentUpdates) && history.recentUpdates.length ? history.recentUpdates : legacyEntries;
  const dailySource = Array.isArray(history?.dailyHistory) && history.dailyHistory.length ? history.dailyHistory : recent;
  const daily = dailySource.reduce((items, entry) => {
    if (!entry) return items;
    if (items.length && items[items.length - 1].asOf === entry.asOf) {
      items[items.length - 1] = entry;
    } else {
      items.push(entry);
    }
    return items;
  }, []);
  return { recentUpdates: recent, dailyHistory: daily };
}

function windowDailyHistory(entries, days) {
  if (!entries.length) return [];
  const current = entries[entries.length - 1];
  const currentDate = new Date(`${current.asOf}T00:00:00Z`);
  if (Number.isNaN(currentDate.getTime())) return entries;
  const cutoff = currentDate.getTime() - days * 24 * 60 * 60 * 1000;
  const filtered = entries.filter((entry) => {
    const parsed = new Date(`${entry.asOf}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= cutoff;
  });
  return filtered.length ? filtered : entries;
}

function pressureLevel(type, score) {
  if (type === "credit") {
    if (score >= 6) return "High";
    if (score >= 3) return "Moderate";
    return "Low";
  }
  if (type === "vol") {
    if (score >= 5) return "High";
    if (score >= 3) return "Moderate";
    return "Low";
  }
  if (score >= 5) return "High";
  if (score >= 1) return "Moderate";
  return "Low";
}

function labelForScore(type, score) {
  if (type === "credit") {
    if (score >= 6) return "Stressed";
    if (score >= 3) return "Watching";
    return "Stable";
  }
  if (type === "vol") {
    if (score >= 5) return "Stressed";
    if (score >= 3) return "Elevated";
    return "Calm";
  }
  if (score >= 5) return "Extreme fear";
  if (score >= 3) return "Fearful";
  if (score >= 1) return "Cautious";
  return "Neutral";
}

function internalConditionText(scores) {
  return `Internal condition: Credit ${labelForScore("credit", scores.credit).toLowerCase()} · Volatility ${labelForScore("vol", scores.volatility).toLowerCase()} · Sentiment ${labelForScore("sentiment", scores.sentiment).toLowerCase()}`;
}

function countUniqueAsOf(entries) {
  return new Set(entries.map((entry) => entry.asOf).filter(Boolean)).size;
}

function getHistoryStreak(entries) {
  if (!entries.length) return null;
  const current = entries[entries.length - 1];
  const streak = [];

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].regime !== current.regime) break;
    streak.push(entries[index]);
  }

  return {
    current,
    snapshots: streak.length,
    tradingDays: countUniqueAsOf(streak),
    startedAt: streak[streak.length - 1]?.generatedAt || current.generatedAt
  };
}

function getLastRegimeChange(entries) {
  if (entries.length < 2) return null;
  const current = entries[entries.length - 1];
  for (let index = entries.length - 2; index >= 0; index -= 1) {
    if (entries[index].regime !== current.regime) {
      return {
        at: entries[index + 1].generatedAt,
        from: entries[index].regimeTitle || entries[index].regime,
        to: current.regimeTitle || current.regime
      };
    }
  }
  return null;
}

function previousRecentUpdate(snapshot, history) {
  const recent = historyCollections(history).recentUpdates;
  if (recent.length < 2) return null;
  const currentIndex = recent.findIndex((entry) => entry.generatedAt === snapshot?.generatedAt);
  if (currentIndex > 0) return recent[currentIndex - 1];
  return recent[recent.length - 2];
}

function compareWithPrevious(snapshot, history, mode) {
  if (mode !== "live" || !snapshot) {
    return "Compared with previous update: waiting for a saved live snapshot.";
  }
  const previous = previousRecentUpdate(snapshot, history);
  if (!previous) {
    return "Compared with previous update: no prior saved snapshot yet.";
  }

  const messages = [];
  const currentRegimeKey = snapshot.regime?.key || "--";
  const currentRegimeTitle = snapshot.regime?.title || currentRegimeKey;
  const previousRegimeKey = previous.regime || "--";
  const previousRegimeTitle = previous.regimeTitle || previousRegimeKey;

  if (currentRegimeKey === previousRegimeKey) {
    messages.push("regime unchanged");
  } else {
    messages.push(`regime changed from ${previousRegimeTitle} to ${currentRegimeTitle}`);
  }

  const currentScores = snapshot.scores || {};
  const previousScores = previous.scores || {};
  const fearGreedDelta = (snapshot.values?.fearGreed ?? previous.fearGreed ?? 0) - (previous.fearGreed ?? 0);
  const drawdownDelta = (snapshot.values?.spyDrawdown ?? previous.spyDrawdown ?? 0) - (previous.spyDrawdown ?? 0);

  if ((currentScores.sentiment ?? 0) > (previousScores.sentiment ?? 0) || fearGreedDelta <= -5) {
    messages.unshift("sentiment weakened");
  } else if ((currentScores.sentiment ?? 0) < (previousScores.sentiment ?? 0) || fearGreedDelta >= 5) {
    messages.unshift("sentiment improved");
  }

  if ((currentScores.credit ?? 0) > (previousScores.credit ?? 0)) {
    messages.push("credit pressure increased");
  } else if ((currentScores.credit ?? 0) < (previousScores.credit ?? 0)) {
    messages.push("credit pressure eased");
  }

  if ((currentScores.volatility ?? 0) > (previousScores.volatility ?? 0)) {
    messages.push("volatility rose");
  } else if ((currentScores.volatility ?? 0) < (previousScores.volatility ?? 0)) {
    messages.push("volatility eased");
  }

  if (drawdownDelta <= -0.5) {
    messages.push("drawdown deepened");
  } else if (drawdownDelta >= 0.5) {
    messages.push("drawdown narrowed");
  }

  return `Compared with previous update: ${messages.slice(0, 2).join(", ")}.`;
}

function renderRecentUpdates(history) {
  if (!recentUpdatesMeta || !recentUpdates) return;
  const entries = historyCollections(history).recentUpdates;
  if (!entries.length) {
    recentUpdatesMeta.textContent = "盘中快照暂不可用";
    recentUpdates.innerHTML = `<div class="history-empty">等待首批盘中快照写入。</div>`;
    return;
  }

  const windowed = entries.slice(-4);
  recentUpdatesMeta.textContent = `Showing ${windowed.length} saved intraday snapshots`;
  recentUpdates.innerHTML = windowed
    .map((entry, index) => {
      const scoreLabel = `${pressureLevel("sentiment", entry.scores?.sentiment ?? 0)} sentiment`;
      return `
        <article class="recent-update-card${index === windowed.length - 1 ? " is-current" : ""}">
          <div class="recent-update-meta">${escapeHtml(formatEtTime(entry.generatedAt))} · ${escapeHtml(entry.regimeTitle || entry.regime || "--")}</div>
          <strong>${escapeHtml(scoreLabel)}</strong>
          <p>SPY drawdown ${typeof entry.spyDrawdown === "number" ? entry.spyDrawdown.toFixed(1) : "--"}% · Fear & Greed ${typeof entry.fearGreed === "number" ? entry.fearGreed.toFixed(0) : "--"} · Pressure ${entry.scores?.volatility ?? "--"}/${entry.scores?.credit ?? "--"}/${entry.scores?.sentiment ?? "--"}</p>
        </article>
      `;
    })
    .join("");
}

function renderHistory(history) {
  if (!historyMeta || !historySummary || !historyStats || !historyStrip) return;
  const { dailyHistory } = historyCollections(history);
  renderRecentUpdates(history);

  if (!dailyHistory.length) {
    historyMeta.textContent = "日度历史暂不可用";
    historySummary.textContent = "等待 GitHub Actions 累积首批收盘状态。";
    historyStats.innerHTML = "";
    historyStrip.innerHTML = `<div class="history-empty">历史文件还没有有效的日度收盘记录。</div>`;
    return;
  }

  const windowed = windowDailyHistory(dailyHistory, historyRangeDays);
  const streak = getHistoryStreak(dailyHistory);
  const lastChange = getLastRegimeChange(dailyHistory);
  const current = dailyHistory[dailyHistory.length - 1];
  const startedAt = dailyHistory[0]?.asOf;

  historyMeta.textContent = `${rangeLabel(historyRangeDays)} view | ${windowed.length} trading days shown | ${dailyHistory.length} daily closes saved`;
  historySummary.textContent =
    dailyHistory.length < 20
      ? `History collection started ${formatLongDate(startedAt)}. Daily close history is still short, so this chart focuses on saved closing states.`
      : lastChange
        ? `Latest regime change was on ${formatDateTime(lastChange.at)}, from ${lastChange.from} to ${lastChange.to}.`
        : `History collection started ${formatLongDate(startedAt)}. Latest saved regime is ${current.regimeTitle || current.regime}.`;

  historyStats.innerHTML = `
    <article class="history-stat">
      <span>当前状态</span>
      <strong>${current.regimeTitle || current.regime}</strong>
      <p>收盘日期 ${current.asOf || "--"}</p>
    </article>
    <article class="history-stat">
      <span>状态持续</span>
      <strong>${streak.tradingDays} 天</strong>
      <p>同一状态连续 ${streak.tradingDays} 个交易日</p>
    </article>
    <article class="history-stat">
      <span>最近变化</span>
      <strong>${lastChange ? formatShortDate(lastChange.at) : "--"}</strong>
      <p>${lastChange ? `${lastChange.from} → ${lastChange.to}` : "暂无切换"}</p>
    </article>
    <article class="history-stat">
      <span>最新 SPY</span>
      <strong>${typeof current.spyClose === "number" ? current.spyClose.toFixed(2) : "--"}</strong>
      <p>回撤 ${typeof current.spyDrawdown === "number" ? current.spyDrawdown.toFixed(1) : "--"}%</p>
    </article>
  `;

  historyStrip.innerHTML = windowed
    .map((entry, index) => {
      const scoreTotal = (entry.scores?.volatility || 0) + (entry.scores?.credit || 0) + (entry.scores?.sentiment || 0);
      const height = Math.max(18, Math.min(74, 18 + Math.abs(entry.spyDrawdown || 0) * 3 + scoreTotal * 2));
      const title = `${entry.asOf || "--"} | ${entry.regimeTitle || entry.regime} | SPY ${typeof entry.spyClose === "number" ? entry.spyClose.toFixed(2) : "--"} | Drawdown ${typeof entry.spyDrawdown === "number" ? entry.spyDrawdown.toFixed(1) : "--"}% | Pressure ${entry.scores?.volatility ?? "--"}/${entry.scores?.credit ?? "--"}/${entry.scores?.sentiment ?? "--"}`;
      return `<div class="history-bar regime-${entry.regime}${index === windowed.length - 1 ? " is-current" : ""}" style="height:${height}px" title="${escapeHtml(title)}"></div>`;
    })
    .join("");
}

function renderHistoryError(error) {
  if (!historyMeta || !historySummary || !historyStats || !historyStrip) return;
  if (recentUpdatesMeta && recentUpdates) {
    recentUpdatesMeta.textContent = "盘中快照暂不可用";
    recentUpdates.innerHTML = `<div class="history-empty">最近更新尚未加载成功。</div>`;
  }
  historyMeta.textContent = "日度历史暂不可用";
  historySummary.textContent = `等待 data/history.json。错误：${error.message}`;
  historyStats.innerHTML = "";
  historyStrip.innerHTML = `<div class="history-empty">历史状态文件尚未加载成功。</div>`;
}

function renderLiveMeta(context = {}) {
  if (!liveMeta) return;
  liveMeta.classList.remove("is-stale", "is-error");

  if (context.mode === "live" && context.snapshot) {
    const estimatedCount = Object.values(context.snapshot.fieldMeta || {}).filter((item) => item.status !== "ok").length;
    const ageMinutes = snapshotAgeMinutes(context.snapshot);
    const isStale = ageMinutes !== null && ageMinutes > STALE_SNAPSHOT_MINUTES;
    liveMeta.classList.toggle("is-stale", isStale);
    liveMeta.textContent = `Latest Snapshot | 生成 ${formatDateTime(context.snapshot.generatedAt)} | 距今 ${formatAge(ageMinutes)} | 数据日期 ${context.snapshot.asOf} | 估算项 ${estimatedCount}${isStale ? " | Stale: 等待下一次 GitHub 抓取" : ""}`;
    return;
  }

  liveMeta.textContent = "Latest Snapshot | 正在读取最近一次市场快照...";
}

function renderDataQuality(snapshot) {
  if (!dataQuality) return;
  if (!snapshot) {
    dataQuality.innerHTML = `<div class="data-quality-item">当前快照暂不可用，等待下一次自动数据更新。</div>`;
    return;
  }

  const notes = (snapshot.notes || []).filter((note) => !String(note).startsWith("model:"));
  const ageMinutes = snapshotAgeMinutes(snapshot);
  const freshnessItems = [
    `<div class="data-quality-item"><strong>更新节奏</strong> GitHub Actions 每天美东 8:00、12:00、15:00 生成快照；浏览器会自动读取最新静态文件。</div>`
  ];
  if (ageMinutes !== null && ageMinutes > STALE_SNAPSHOT_MINUTES) {
    freshnessItems.push(
      `<div class="data-quality-item warning"><strong>Stale</strong> 当前快照距今 ${formatAge(ageMinutes)}，GitHub 定时抓取可能失败或数据源延迟。</div>`
    );
  }
  const sourceItems = (snapshot.sourceSummary || []).slice(0, 6).map(
    (source) => `<div class="data-quality-item"><strong>Source</strong> ${source}</div>`
  );
  const noteItems = notes.slice(0, 4).map(
    (note) => `<div class="data-quality-item warning"><strong>Note</strong> ${note}</div>`
  );
  if (snapshot.modelMeta?.valuationInScore === false) {
    noteItems.unshift(
      `<div class="data-quality-item warning"><strong>Model</strong> 估值分位暂未接入稳定公开源，本次状态判断不使用占位值。</div>`
    );
  }

  dataQuality.innerHTML = [...freshnessItems, ...sourceItems, ...noteItems].join("");
}

function applyFieldMeta(fieldMeta = {}) {
  Object.entries(fieldMeta).forEach(([key, meta]) => {
    const input = document.querySelector(`#${key}`);
    const metaNode = document.querySelector(`#${key}-meta`);
    if (input) {
      input.title = `${meta.source || "source unknown"} | as of ${meta.asOf || "--"}${meta.note ? ` | ${meta.note}` : ""}`;
      input.dataset.status = meta.status || "ok";
    }
    if (metaNode) {
      const status = meta.status === "estimated" ? "estimated" : "ok";
      metaNode.classList.toggle("is-estimated", status === "estimated");
      metaNode.textContent = `${meta.asOf || "--"} | ${status === "estimated" ? "估算" : "已更新"}`;
    }
  });
}

function contributorList(values) {
  const vol = [];
  if (values.vix > 20) vol.push(`VIX ${values.vix.toFixed(1)} 高于 20`);
  if (values.vixChange5d > 5) vol.push(`VIX 5日变化 ${values.vixChange5d.toFixed(1)} 点`);
  if (values.move > 120) vol.push(`MOVE ${values.move.toFixed(1)} 高于 120`);

  const credit = [];
  if (values.hygRet20d < -3) credit.push(`HYG 20日 ${values.hygRet20d.toFixed(1)}%`);
  if (values.jnkRet20d < -3) credit.push(`JNK 20日 ${values.jnkRet20d.toFixed(1)}%`);
  if (values.hyOas > 4.5 || values.hyOasChange20d > 75) credit.push(`HY OAS ${values.hyOas.toFixed(2)}%，20日 ${values.hyOasChange20d.toFixed(0)} bp`);
  if (values.igOas > 1.25 || values.igOasChange20d > 25) credit.push(`IG OAS ${values.igOas.toFixed(2)}%，20日 ${values.igOasChange20d.toFixed(0)} bp`);
  if (values.dxyChange20d > 3) credit.push(`DXY 20日 ${values.dxyChange20d.toFixed(1)}%`);
  if (values.nfci > 0) credit.push(`NFCI ${values.nfci.toFixed(2)} 高于 0`);
  if (values.kreRel20d < -8) credit.push(`KRE/SPY 20日 ${values.kreRel20d.toFixed(1)}%`);

  const sentiment = [];
  if (values.fearGreed < 40) sentiment.push(`Fear & Greed ${values.fearGreed.toFixed(0)} 低于 40`);
  if (values.aaiiBearish > 40) sentiment.push(`AAII Bearish ${values.aaiiBearish.toFixed(1)}%`);
  if (values.putCall > 0.75) sentiment.push(`Put/Call ${values.putCall.toFixed(2)}`);

  return { vol, credit, sentiment };
}

function renderList(id, items, emptyText) {
  const node = document.querySelector(`#${id}`);
  if (!node) return;
  const list = items.length ? items : [emptyText];
  node.innerHTML = list.map((item) => `<li>${item}</li>`).join("");
}

function renderScoreDetails(values, scores) {
  const contributors = contributorList(values);
  document.querySelector("#vol-detail").textContent =
    "综合衡量美股隐含波动率、波动率变化速度和美债波动率。分数越高，代表避险需求和波动冲击越强。";
  document.querySelector("#credit-detail").textContent =
    "综合衡量高收益债、信用利差、美元流动性、金融条件和银行股相对表现。该分数优先级最高，因为信用压力会直接改变风险预算。";
  document.querySelector("#sentiment-detail").textContent =
    "综合衡量投资者风险偏好、看跌比例和期权保护需求。情绪恐惧在信用稳定时可作为反向参考；若与信用压力同步恶化，则应降低风险预算。";

  renderList("vol-contributors", contributors.vol, `未触发主要波动率压力阈值，Volatility Pressure score = ${scores.volatility}。`);
  renderList("credit-contributors", contributors.credit, `信用压力阈值基本未触发，Credit Pressure score = ${scores.credit}。`);
  renderList("sentiment-contributors", contributors.sentiment, `情绪压力阈值触发有限，Sentiment Fear score = ${scores.sentiment}。`);
}

function renderInvestmentImplications(regime, scores, values) {
  const primaryAction = document.querySelector("#primary-action");
  const allocationCue = document.querySelector("#allocation-cue");
  const watchCue = document.querySelector("#watch-cue");
  if (!primaryAction || !allocationCue || !watchCue) return;
  const signal = latestSignal?.currentSignal;
  if (activePreset === "live" && signal) {
    primaryAction.textContent = signal.stance || allocationActionLabel(signal.action);
    allocationCue.textContent = signal.guidance?.allocation || signal.reason;
    watchCue.textContent = signal.guidance?.watch || "观察信用、波动和回撤是否同步恶化";
    return;
  }
  const implications = investmentImplications(regime, scores, values);
  primaryAction.textContent = implications.primary;
  allocationCue.textContent = implications.allocation;
  watchCue.textContent = implications.watch;
}

function allocationActionLabel(action) {
  if (action === "ADD") return "加仓";
  if (action === "ADD_SMALL") return "小幅分批加仓";
  if (action === "REDUCE") return "减仓";
  return "维持";
}

function pressureCompositeText(scores = {}) {
  const volatility = Number(scores.volatility || 0);
  const credit = Number(scores.credit || 0);
  const sentiment = Number(scores.sentiment || 0);
  return `${volatility + credit + sentiment} (${volatility}/${credit}/${sentiment})`;
}

function renderAllocationSignal(signalPayload) {
  latestSignal = signalPayload;
  const signal = signalPayload?.currentSignal;
  if (!signal || !allocationSignalTitle) return;

  const actionText = signal.stance || allocationActionLabel(signal.action);
  allocationSignalTitle.textContent = actionText;
  allocationSignalReason.textContent = signal.reason || "当前没有可显示的信号解释。";
  allocationSignalMeta.textContent = `Signal | ${signal.asOf || "--"} | ${formatDateTime(signalPayload.generatedAt || signal.generatedAt)}`;

  allocationOpportunity.textContent = Number(signal.opportunityScore || 0).toFixed(1);
  allocationRisk.textContent = Number(signal.riskScore || 0).toFixed(1);
  allocationPressure.textContent = pressureCompositeText(signal.pressureScores);
  allocationPressureNote.textContent = "括号内依次为波动 / 信用 / 情绪压力";
  allocationOpportunityMeter.value = Number(signal.opportunityScore || 0);
  allocationRiskMeter.value = Number(signal.riskScore || 0);

  allocationGuidance.textContent = signal.guidance?.allocation || "--";
  riskBudgetGuidance.textContent = signal.guidance?.riskBudget || "--";
  watchGuidance.textContent = signal.guidance?.watch || "--";

  if (activePreset === "live") {
    const primaryAction = document.querySelector("#primary-action");
    const allocationCue = document.querySelector("#allocation-cue");
    const watchCue = document.querySelector("#watch-cue");
    if (primaryAction) primaryAction.textContent = actionText;
    if (allocationCue) allocationCue.textContent = signal.guidance?.allocation || signal.reason || "--";
    if (watchCue) watchCue.textContent = signal.guidance?.watch || "--";
  }
}

function renderAllocationSignalError(error) {
  if (!allocationSignalTitle) return;
  allocationSignalTitle.textContent = "仓位信号暂不可用";
  allocationSignalReason.textContent = `等待 data/allocation_signal.json。错误：${error.message}`;
  allocationSignalMeta.textContent = "Allocation Signal | 数据未加载成功";
}

function renderStatus(values, scores, regime, context = {}) {
  document.querySelector("#regime-title").textContent = regime.title;
  if (regimeInternal) {
    regimeInternal.textContent = internalConditionText(scores);
  }
  if (regimeChange) {
    regimeChange.textContent = compareWithPrevious(context.snapshot, context.history, context.mode);
  }
  document.querySelector("#regime-summary").textContent = regime.summary;
  const overheatedBanner = document.querySelector("#overheated-banner");
  const showOverheated = Boolean(regime.overheated);
  overheatedBanner.hidden = !showOverheated;
  overheatedBanner.classList.toggle("is-visible", showOverheated);
  overheatedBanner.style.display = showOverheated ? "flex" : "none";
  overheatedBanner.setAttribute("aria-hidden", String(!showOverheated));
  renderLiveMeta(context);

  document.querySelector("#vol-score").textContent = pressureLevel("vol", scores.volatility);
  document.querySelector("#credit-score").textContent = pressureLevel("credit", scores.credit);
  document.querySelector("#sentiment-score").textContent = pressureLevel("sentiment", scores.sentiment);
  document.querySelector("#vol-score-range").textContent = `${scores.volatility} / ${SCORE_MAX.volatility}`;
  document.querySelector("#credit-score-range").textContent = `${scores.credit} / ${SCORE_MAX.credit}`;
  document.querySelector("#sentiment-score-range").textContent = `${scores.sentiment} / ${SCORE_MAX.sentiment}`;

  document.querySelector("#vol-meter").value = scores.volatility;
  document.querySelector("#credit-meter").value = scores.credit;
  document.querySelector("#sentiment-meter").value = scores.sentiment;

  document.querySelector("#vol-label").textContent = labelForScore("vol", scores.volatility);
  document.querySelector("#credit-label").textContent = labelForScore("credit", scores.credit);
  document.querySelector("#sentiment-label").textContent = labelForScore("sentiment", scores.sentiment);
  renderInvestmentImplications(regime, scores, values);
  renderScoreDetails(values, scores);
}

function renderTriggers(scores, regime) {
  const list = document.querySelector("#trigger-list");
  const items = [...scores.triggers];

  if (regime.overheated) {
    items.unshift({
      severity: "warning",
      text: "Overheated Risk：情绪贪婪、Put/Call偏低，且上涨集中度偏高。"
    });
  }

  if (!items.length) {
    items.push({ severity: "info", text: "没有触发显著风险阈值，当前更接近正常市场环境。" });
  }

  list.innerHTML = items
    .slice(0, 10)
    .map((item) => `<li class="${item.severity === "danger" ? "danger" : item.severity === "warning" ? "warning" : ""}">${item.text}</li>`)
    .join("");
}

function drawRiskMap(scores, regime) {
  const canvas = document.querySelector("#risk-canvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const pad = 48;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  const gradient = ctx.createLinearGradient(pad, height - pad, width - pad, pad);
  gradient.addColorStop(0, "#dfeee8");
  gradient.addColorStop(0.45, "#fff2d0");
  gradient.addColorStop(1, "#f0cbc7");
  ctx.fillStyle = gradient;
  ctx.fillRect(pad, pad, plotW, plotH);

  ctx.strokeStyle = "#9fb0bd";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, plotW, plotH);

  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(pad + plotW * 0.55, pad);
  ctx.lineTo(pad + plotW * 0.55, height - pad);
  ctx.moveTo(pad, pad + plotH * 0.45);
  ctx.lineTo(width - pad, pad + plotH * 0.45);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#2f3e49";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("Credit Pressure", width / 2 - 46, height - 14);
  ctx.save();
  ctx.translate(16, height / 2 + 38);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Volatility + Sentiment", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#475866";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("DCA", pad + 10, height - pad - 12);
  ctx.fillText("Panic Buy Zone", pad + 10, pad + 22);
  ctx.fillText("Defensive", width - pad - 92, pad + 22);

  const x = pad + Math.min(scores.credit / 12, 1) * plotW;
  const y = height - pad - Math.min((scores.volatility + scores.sentiment) / 13, 1) * plotH;
  const color = regime.key === "defensive" ? "#a63c34" : regime.key === "panic" ? "#a86610" : regime.key === "extreme" ? "#8d3f7a" : "#1d7c75";

  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();
}

function updateDashboard(context = {}) {
  dashboardState = { ...dashboardState, ...context, history: latestHistory };
  if (dashboardState.mode !== "live") {
    dashboardState.snapshot = null;
  }
  const values = getValues();
  const scores = calculateScores(values);
  const regime = classify(values, scores);

  renderStatus(values, scores, regime, dashboardState);
  renderTriggers(scores, regime);
  renderDataQuality(dashboardState.snapshot);
  drawRiskMap(scores, regime);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchStaticJson(endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${endpoint}${separator}ts=${Date.now()}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), STATIC_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
    const snapshot = await response.json();
    snapshot.clientSource = endpoint;
    return snapshot;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${endpoint} timed out after ${Math.round(STATIC_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchLatestSnapshot() {
  const snapshot = await fetchStaticJson(STATIC_SNAPSHOT_ENDPOINT);
  snapshot.clientSource = STATIC_SNAPSHOT_ENDPOINT;
  return snapshot;
}

async function loadHistory(options = {}) {
  try {
    latestHistory = await fetchStaticJson(HISTORY_ENDPOINT);
    renderHistory(latestHistory);
    updateDashboard({});
  } catch (error) {
    if (options.silent) return;
    renderHistoryError(error);
  }
}

async function loadAllocationSignal(options = {}) {
  if (!options.silent && allocationSignalMeta) {
    allocationSignalMeta.textContent = "Allocation Signal | 正在读取最终信号...";
  }
  try {
    renderAllocationSignal(await fetchStaticJson(ALLOCATION_SIGNAL_ENDPOINT));
  } catch (error) {
    if (options.silent) {
      console.warn("Allocation signal refresh failed", error);
      return;
    }
    renderAllocationSignalError(error);
  }
}

function applyLiveSnapshot(snapshot) {
  liveSnapshot = snapshot;
  setValues(liveSnapshot.values);
  applyFieldMeta(liveSnapshot.fieldMeta);
  activePreset = "live";
  updateDashboard({ mode: "live", snapshot: liveSnapshot });
}

async function loadLiveData(options = {}) {
  if (!options.silent) renderLiveMeta({ mode: "loading" });
  try {
    applyLiveSnapshot(await fetchLatestSnapshot());
  } catch (error) {
    if (options.silent) {
      console.warn("Market data snapshot failed", error);
      return;
    }
    liveSnapshot = null;
    activePreset = "live";
    renderDataQuality(null);
    if (liveMeta) {
      liveMeta.classList.add("is-error");
      liveMeta.textContent = `Latest Snapshot 暂不可用，等待下一次自动快照。错误：${error.message}`;
    }
  }
}

historyRangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    historyRangeDays = Number(button.dataset.range) || 90;
    historyRangeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    if (latestHistory) {
      renderHistory(latestHistory);
    }
  });
});

buildForm();
loadAllocationSignal();
loadLiveData();
loadHistory();

setInterval(() => {
  if (activePreset === "live") {
    loadLiveData({ silent: true });
    loadHistory({ silent: true });
    loadAllocationSignal({ silent: true });
  }
}, CLIENT_POLL_MS);
