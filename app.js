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

const presets = {
  normal: {
    vix: 21.8,
    vixChange5d: 3.2,
    move: 108,
    spyDrawdown: -5.2,
    qqqDrawdown: -7.5,
    rspSpyRel60d: -1.2,
    fearGreed: 38,
    aaiiBearish: 41,
    putCall: 0.78,
    hygRet20d: -1.1,
    jnkRet20d: -1.4,
    hyOas: 3.9,
    hyOasChange20d: 28,
    igOas: 1.08,
    igOasChange20d: 12,
    dxyChange20d: 1.3,
    tenYYield: 4.28,
    tenYChange20d: 18,
    realTenY: 1.96,
    realTenYChange20d: 12,
    nfci: -0.22,
    kreRel20d: -3.4
  },
  panic: {
    vix: 31,
    vixChange5d: 8.5,
    move: 126,
    spyDrawdown: -11.5,
    qqqDrawdown: -15.8,
    rspSpyRel60d: -2.7,
    fearGreed: 22,
    aaiiBearish: 52,
    putCall: 0.93,
    hygRet20d: -2.7,
    jnkRet20d: -2.9,
    hyOas: 4.25,
    hyOasChange20d: 55,
    igOas: 1.18,
    igOasChange20d: 21,
    dxyChange20d: 2.1,
    tenYYield: 4.05,
    tenYChange20d: -22,
    realTenY: 1.76,
    realTenYChange20d: -18,
    nfci: -0.08,
    kreRel20d: -5.6
  },
  extreme: {
    vix: 42,
    vixChange5d: 13,
    move: 151,
    spyDrawdown: -18,
    qqqDrawdown: -24,
    rspSpyRel60d: -3.8,
    fearGreed: 12,
    aaiiBearish: 64,
    putCall: 1.05,
    hygRet20d: -2.8,
    jnkRet20d: -3,
    hyOas: 4.45,
    hyOasChange20d: 62,
    igOas: 1.22,
    igOasChange20d: 24,
    dxyChange20d: 2.4,
    tenYYield: 3.72,
    tenYChange20d: -48,
    realTenY: 1.42,
    realTenYChange20d: -34,
    nfci: -0.02,
    kreRel20d: -6.3
  },
  systemic: {
    vix: 38,
    vixChange5d: 11.5,
    move: 181,
    spyDrawdown: -16,
    qqqDrawdown: -21,
    rspSpyRel60d: -6.8,
    fearGreed: 16,
    aaiiBearish: 58,
    putCall: 0.98,
    hygRet20d: -6.4,
    jnkRet20d: -6.9,
    hyOas: 6.7,
    hyOasChange20d: 172,
    igOas: 1.92,
    igOasChange20d: 78,
    dxyChange20d: 5.6,
    tenYYield: 4.62,
    tenYChange20d: 64,
    realTenY: 2.26,
    realTenYChange20d: 47,
    nfci: 0.58,
    kreRel20d: -18
  },
  overheated: {
    vix: 13.4,
    vixChange5d: -1.1,
    move: 88,
    spyDrawdown: -0.8,
    qqqDrawdown: -1.3,
    rspSpyRel60d: -4.9,
    fearGreed: 82,
    aaiiBearish: 24,
    putCall: 0.5,
    hygRet20d: 1.3,
    jnkRet20d: 1.2,
    hyOas: 3.3,
    hyOasChange20d: -18,
    igOas: 0.95,
    igOasChange20d: -8,
    dxyChange20d: -0.6,
    tenYYield: 4.18,
    tenYChange20d: -5,
    realTenY: 1.88,
    realTenYChange20d: -7,
    nfci: -0.48,
    kreRel20d: 1.6
  }
};

const indicatorRows = [
  ["VIX", "Yahoo Finance ^VIX / Cboe VIX", "最新收盘或最新可得值", ">20、>25、>35、>45", "波动率指标", "30天隐含波动率，衡量美股期权市场恐慌程度。", "提高 Volatility Panic Score；>35 支持极端恐慌判断。"],
  ["VIX 5日变化", "Yahoo Finance ^VIX / Cboe VIX", "VIX(t) - VIX(t-5)", ">5点、>10点", "波动率指标", "衡量恐慌升温速度，过滤慢性高波动。", "快速上升会把正常回调推向恐慌回调或极端恐慌。"],
  ["MOVE Index", "Yahoo Finance ^MOVE / ICE BofA MOVE Index", "最新收盘或最新可得值", ">120、>160、>180", "波动率指标", "美债隐含波动率，衡量利率市场是否失序。", "高值提高 Volatility Score；>160配合信用恶化触发防守模式。"],
  ["SPY drawdown", "Yahoo Finance SPY", "SPY / 252日高点 - 1", "<-5%、<-10%、<-20%", "股市回撤指标", "衡量美股大盘从近一年高点回撤深度。", "定义回调深度，配合信用压力决定是否可抄底。"],
  ["QQQ drawdown", "Yahoo Finance QQQ", "QQQ / 252日高点 - 1", "<-8%、<-15%、<-25%", "股市回撤指标", "衡量成长股和科技权重资产的风险偏好。", "QQQ深跌但信用稳定时偏恐慌回调或极端恐慌。"],
  ["RSP/SPY 60日相对表现", "Yahoo Finance RSP and SPY", "(RSP/SPY)(t) / (RSP/SPY)(t-60) - 1", "<-3%、<-6%", "股市回撤指标", "等权指数相对市值加权指数，衡量上涨集中度。", "走弱时提示广度恶化；高情绪下触发过热风险。"],
  ["S&P 500估值分位", "暂未接入稳定公开源", "未来可接入 Forward P/E 历史分位或估值综合分位", "当前不参与自动评分", "股市回撤指标", "估值属于慢变量，但当前公开免密钥源稳定性不足。", "自动版暂不使用，避免把占位值伪装成实时测量。"],
  ["Fear & Greed Index", "CNN Fear & Greed Index；失败时使用proxy", "CNN官方0-100分；proxy由VIX、SPY、Put/Call、HYG、RSP/SPY、AAII合成", "<40、<25、<15；>75提示贪婪", "情绪指标", "综合动量、广度、期权、信用、波动和避险需求。", "低值提高 Sentiment Fear Score；高值触发 Overheated Risk。"],
  ["AAII Bearish %", "AAII Sentiment Survey", "看跌投资者占比", ">40%、>50%、>60%", "情绪指标", "散户投资者悲观程度，极端高值常具反向含义。", "提高 Sentiment Fear Score，支持恐慌或极端恐慌判断。"],
  ["Put/Call Ratio", "Cboe Daily Market Statistics", "Put成交量 / Call成交量；有历史源时用10日均值，无历史源时用Cboe当前日值", ">0.75、>0.90；<0.55提示贪婪", "情绪指标", "保护性需求或投机偏好变化。", "高值加恐惧分；低值加过热提示。"],
  ["HYG 20日回报", "Yahoo Finance HYG", "HYG(t) / HYG(t-20) - 1", "<-3%、<-5%", "信用市场指标", "高收益债ETF价格压力。", "显著下跌提高 Credit Stress Score，防守模式权重上升。"],
  ["JNK 20日回报", "Yahoo Finance JNK", "JNK(t) / JNK(t-20) - 1", "<-3%、<-5%", "信用市场指标", "高收益债ETF第二确认信号。", "与HYG共振时优先检查系统性风险。"],
  ["High Yield OAS", "FRED BAMLH0A0HYM2 / ICE BofA", "最新值", ">4.5%、>6%", "信用市场指标", "垃圾债信用利差，衡量违约和流动性补偿。", "高值提高 Credit Stress Score；防守模式权重上升。"],
  ["HY OAS 20日扩大", "FRED BAMLH0A0HYM2 / ICE BofA", "(HY OAS(t) - HY OAS(t-20)) * 100bp", ">75bp、>150bp", "信用市场指标", "衡量高收益债信用压力恶化速度。", "快速扩大是防守模式核心触发信号。"],
  ["Investment Grade OAS", "FRED BAMLC0A0CM / ICE BofA", "最新值", ">1.25%、>1.75%", "信用市场指标", "投资级债信用利差，衡量压力是否扩散到优质信用。", "IG也走坏时，防守优先级上升。"],
  ["IG OAS 20日扩大", "FRED BAMLC0A0CM / ICE BofA", "(IG OAS(t) - IG OAS(t-20)) * 100bp", ">25bp、>60bp", "信用市场指标", "衡量投资级信用压力恶化速度。", "快速扩大说明压力开始扩散，强化防守模式。"],
  ["DXY 20日变化", "Yahoo Finance DX-Y.NYB", "DXY(t) / DXY(t-20) - 1", ">3%、>5%", "系统性风险指标", "美元快速走强常代表全球美元流动性压力或避险需求。", "配合信用恶化时强化防守模式。"],
  ["10Y Treasury Yield", "FRED DGS10", "最新值", "水平本身不单独打分", "系统性风险指标", "名义利率水平，用来解释利率冲击或避险买债方向。", "和信用、美元、MOVE组合解释。"],
  ["10Y Yield 20日变化", "FRED DGS10", "(10Y(t) - 10Y(t-20)) * 100bp", ">50bp；或快速下行且信用利差扩大", "系统性风险指标", "衡量名义利率冲击速度。", "辅助解释成长股压力和系统性风险。"],
  ["10Y Real Yield", "FRED DFII10", "最新值", "水平本身不单独打分", "系统性风险指标", "实际利率水平，对长久期成长资产影响较大。", "解释QQQ压力，辅助恐慌回调或防守判断。"],
  ["10Y Real Yield 20日变化", "FRED DFII10", "(10Y Real Yield(t) - 10Y Real Yield(t-20)) * 100bp", ">40bp", "系统性风险指标", "衡量实际利率收紧速度。", "实际利率快速上升时提高成长股压力解释权重。"],
  ["NFCI", "FRED NFCI / Chicago Fed", "周度金融条件指数", ">0、>0.5；4周明显上升", "系统性风险指标", "正值代表金融条件紧于历史平均。", ">0时提高 Credit Stress Score，防守模式权重上升。"],
  ["KRE vs SPY 20日相对表现", "Yahoo Finance KRE and SPY", "(KRE/SPY)(t) / (KRE/SPY)(t-20) - 1", "<-8%、<-15%", "系统性风险指标", "区域银行相对大盘表现，监测银行体系压力。", "大幅跑输是 Defensive Mode 重要触发器。"]
];

const scoreRules = [
  [
    "Volatility Panic Score",
    "VIX >20 +1，>25 再+1，>35 再+1，>45 再+1；VIX 5日变化 >5点 +1，>10点 再+1；MOVE >120 +1，>160 再+1。",
    "0-2 温和，3-4 恐慌，5+ 极端恐慌。"
  ],
  [
    "Credit Stress Score",
    "HYG/JNK 20日跌幅 <-3% 各+1，<-5% 各再+1；HY OAS >4.5% +1，>6% 再+1，20日扩大>75bp +1，>150bp 再+1；IG OAS >1.25% +1，>1.75% 再+1，20日扩大>25bp +1，>60bp 再+1；DXY 20日>3% +1，>5% 再+1；NFCI>0 +1，>0.5 再+1；KRE/SPY 20日<-8% +1，<-15% 再+1。",
    "0-2 稳定，3-5 观察，6+ 系统性风险优先。"
  ],
  [
    "Sentiment Fear Score",
    "Fear & Greed <40 +1，<25 再+1，<15 再+1；AAII Bearish >40% +1，>50% 再+1，>60% 再+1；Put/Call 当前值或10日均值 >0.75 +1，>0.90 再+1。",
    "0-2 正常，3-4 恐惧，5+ 极端悲观。"
  ]
];

const scenarios = [
  {
    title: "正常或温和回调",
    posture: "维持计划",
    rule: "Credit Stress Score <= 2，VIX温和升高，指数只是小幅回撤，信用市场稳定。",
    meaning: "市场更像普通调整，而不是流动性或信用危机。",
    action: "可以维持正常定投、再平衡和质量资产配置。"
  },
  {
    title: "恐慌回调",
    posture: "分批加仓",
    rule: "Credit Stress Score <= 3，同时 Volatility 与 Sentiment 进入恐慌区，SPY/QQQ回撤较深。",
    meaning: "风险偏好明显转弱，但信用和美元流动性尚未出现失序信号。",
    action: "适合用预设计划分批加仓，避免一次性打满。"
  },
  {
    title: "极端恐慌",
    posture: "寻找机会",
    rule: "Credit Stress Score <= 3，但 VIX、MOVE 或情绪指标极端，指数明显下跌。",
    meaning: "恐慌程度接近反向机会区，但还没有进入系统性信用压力。",
    action: "关注抄底窗口，仍然用分层现金和风控执行。"
  },
  {
    title: "系统性风险",
    posture: "先防守",
    rule: "Credit Stress Score >= 6，或信用、银行、美元、美债流动性出现多点共振恶化。",
    meaning: "这类下跌可能不是单纯情绪杀跌，而是融资和流动性压力。",
    action: "优先降低风险敞口，等待信用压力稳定后再考虑加仓。"
  },
  {
    title: "过热风险",
    posture: "避免追高",
    rule: "Fear & Greed > 75，Put/Call < 0.55，且上涨集中度偏高。",
    meaning: "市场可能已经过度乐观，且上涨主要集中在少数权重资产上。",
    action: "减少杠杆和追高，考虑再平衡、获利回收和提高安全边际。"
  }
];

let activePreset = "live";
let liveSnapshot = null;

const form = document.querySelector("#metric-form");
const presetButtons = Array.from(document.querySelectorAll(".preset-button"));
const resetButton = document.querySelector("#reset-button");
const liveMeta = document.querySelector("#live-meta");
const dataQuality = document.querySelector("#data-quality");
const historyMeta = document.querySelector("#history-meta");
const historySummary = document.querySelector("#history-summary");
const historyStats = document.querySelector("#history-stats");
const historyStrip = document.querySelector("#history-strip");
const briefingMeta = document.querySelector("#briefing-meta");
const briefingSummary = document.querySelector("#briefing-summary");
const briefingList = document.querySelector("#briefing-list");
const libraryTabs = Array.from(document.querySelectorAll(".library-tab"));
const CLIENT_POLL_MS = 120000;
const BRIEFING_POLL_MS = 300000;
const STALE_SNAPSHOT_MINUTES = 1440;
const STATIC_SNAPSHOT_ENDPOINT = "data/latest.json";
const HISTORY_ENDPOINT = "data/history.json";
const BRIEFING_ENDPOINT = "data/briefing.json";
const STATIC_TIMEOUT_MS = 8000;
const HISTORY_WINDOW = 180;

function thresholdScore(value, rules, direction = "above") {
  return rules.reduce((score, threshold) => {
    if (direction === "above" && value > threshold) return score + 1;
    if (direction === "below" && value < threshold) return score + 1;
    return score;
  }, 0);
}

function buildForm() {
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
              <input id="${field.key}" name="${field.key}" type="number" step="${field.step}" inputmode="decimal" />
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

  form.addEventListener("input", () => {
    activePreset = "manual";
    presetButtons.forEach((button) => button.classList.remove("is-active"));
    updateDashboard({ mode: "manual" });
  });
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
    values[field.key] = Number(input.value);
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
      title: "系统性风险",
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
      title: "极端恐慌",
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
      title: "恐慌回调",
      summary:
        "市场情绪进入恐惧区，指数回调较深，但信用和美元流动性尚未出现失序信号。适合按计划分批加仓。",
      tone: "warning",
      overheated
    };
  }

  return {
    key: "normal",
    title: "正常或温和回调",
    summary:
      "信用市场稳定，波动率未进入失控区。若指数只是普通调整，可以维持正常定投和再平衡纪律。",
    tone: "calm",
    overheated
  };
}

function labelForScore(type, score) {
  if (type === "credit") {
    if (score >= 6) return "系统性风险优先";
    if (score >= 3) return "信用压力观察";
    return "信用市场稳定";
  }
  if (type === "vol") {
    if (score >= 5) return "极端恐慌";
    if (score >= 3) return "恐慌升温";
    return "温和波动";
  }
  if (score >= 5) return "极端悲观";
  if (score >= 3) return "恐惧区间";
  return "情绪正常";
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

function renderHistory(history) {
  if (!historyMeta || !historySummary || !historyStats || !historyStrip) return;
  const entries = Array.isArray(history?.entries) ? history.entries : [];

  if (!entries.length) {
    historyMeta.textContent = "状态历史暂不可用";
    historySummary.textContent = "等待 GitHub Actions 累积首批历史快照。";
    historyStats.innerHTML = "";
    historyStrip.innerHTML = `<div class="history-empty">历史文件还没有有效快照。</div>`;
    return;
  }

  const windowed = entries.slice(-HISTORY_WINDOW);
  const streak = getHistoryStreak(entries);
  const lastChange = getLastRegimeChange(entries);
  const current = entries[entries.length - 1];

  historyMeta.textContent = `最近 ${windowed.length} 次快照 | 当前状态已持续 ${streak.snapshots} 次快照 / ${streak.tradingDays} 个交易日`;
  historySummary.textContent = lastChange
    ? `最近一次状态变化发生在 ${formatDateTime(lastChange.at)}，由 ${lastChange.from} 转为 ${lastChange.to}。`
    : `当前历史序列中尚未出现状态切换，最新状态为 ${current.regimeTitle || current.regime}。`;

  historyStats.innerHTML = `
    <article class="history-stat">
      <span>当前状态</span>
      <strong>${current.regimeTitle || current.regime}</strong>
      <p>数据日期 ${current.asOf || "--"}</p>
    </article>
    <article class="history-stat">
      <span>状态持续</span>
      <strong>${streak.tradingDays} 天</strong>
      <p>共 ${streak.snapshots} 次已保存快照</p>
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
      const title = `${entry.asOf || "--"} | ${entry.regimeTitle || entry.regime} | SPY ${typeof entry.spyClose === "number" ? entry.spyClose.toFixed(2) : "--"} | Drawdown ${typeof entry.spyDrawdown === "number" ? entry.spyDrawdown.toFixed(1) : "--"}% | V/C/S ${entry.scores?.volatility ?? "--"}/${entry.scores?.credit ?? "--"}/${entry.scores?.sentiment ?? "--"}`;
      return `<div class="history-bar regime-${entry.regime}${index === windowed.length - 1 ? " is-current" : ""}" style="height:${height}px" title="${escapeHtml(title)}"></div>`;
    })
    .join("");
}

function renderHistoryError(error) {
  if (!historyMeta || !historySummary || !historyStats || !historyStrip) return;
  historyMeta.textContent = "状态历史暂不可用";
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

  if (context.mode === "manual") {
    liveMeta.textContent = "Manual Override | 你正在手动调整指标，分类会即时重算。";
    return;
  }

  if (context.mode === "preset") {
    liveMeta.textContent = "Scenario Preset | 当前是情景演示数据，不代表实时市场。";
    return;
  }

  liveMeta.textContent = "Latest Snapshot | 正在读取最近一次市场快照...";
}

function renderDataQuality(snapshot) {
  if (!dataQuality) return;
  if (!snapshot) {
    dataQuality.innerHTML = `<div class="data-quality-item">当前为预设或手动模式。</div>`;
    return;
  }

  const notes = (snapshot.notes || []).filter((note) => !String(note).startsWith("model:"));
  const ageMinutes = snapshotAgeMinutes(snapshot);
  const freshnessItems = [
    `<div class="data-quality-item"><strong>Refresh</strong> GitHub Actions 每天美东 8:00、12:00、15:00 生成快照；浏览器每 2 分钟重新读取最近一次文件。</div>`
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

  renderList("vol-contributors", contributors.vol, `未触发主要波动率压力阈值，Volatility Panic = ${scores.volatility}。`);
  renderList("credit-contributors", contributors.credit, `信用压力阈值基本未触发，Credit Stress = ${scores.credit}。`);
  renderList("sentiment-contributors", contributors.sentiment, `情绪压力阈值触发有限，Sentiment Fear = ${scores.sentiment}。`);
}

function renderInvestmentImplications(regime, scores, values) {
  const implications = investmentImplications(regime, scores, values);
  document.querySelector("#primary-action").textContent = implications.primary;
  document.querySelector("#allocation-cue").textContent = implications.allocation;
  document.querySelector("#watch-cue").textContent = implications.watch;
}

function renderStatus(values, scores, regime, context = {}) {
  document.querySelector("#regime-title").textContent = regime.title;
  document.querySelector("#regime-summary").textContent = regime.summary;
  const overheatedBanner = document.querySelector("#overheated-banner");
  const showOverheated = Boolean(regime.overheated);
  overheatedBanner.hidden = !showOverheated;
  overheatedBanner.classList.toggle("is-visible", showOverheated);
  overheatedBanner.style.display = showOverheated ? "flex" : "none";
  overheatedBanner.setAttribute("aria-hidden", String(!showOverheated));
  renderLiveMeta(context);

  document.querySelector("#vol-score").textContent = scores.volatility;
  document.querySelector("#credit-score").textContent = scores.credit;
  document.querySelector("#sentiment-score").textContent = scores.sentiment;

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
  ctx.fillText("Credit Stress", width / 2 - 40, height - 14);
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

function renderTables() {
  document.querySelector("#score-rules-body").innerHTML = scoreRules
    .map(
      (row) => `
        <tr>
          <td><strong>${row[0]}</strong></td>
          <td>${row[1]}</td>
          <td>${row[2]}</td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#scenario-grid").innerHTML = scenarios
    .map(
      (scenario) => `
        <article class="scenario-card">
          <h3>${scenario.title}</h3>
          <em>${scenario.posture}</em>
          <p>${scenario.rule}</p>
          <p>${scenario.meaning}</p>
          <strong>${scenario.action}</strong>
        </article>
      `
    )
    .join("");

  document.querySelector("#indicator-table-body").innerHTML = indicatorRows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${cell}</td>`).join("")}
        </tr>
      `
    )
    .join("");
}

function updateDashboard(context = {}) {
  const values = getValues();
  const scores = calculateScores(values);
  const regime = classify(values, scores);

  renderStatus(values, scores, regime, context);
  renderTriggers(scores, regime);
  renderDataQuality(context.snapshot);
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
    renderHistory(await fetchStaticJson(HISTORY_ENDPOINT));
  } catch (error) {
    if (options.silent) return;
    renderHistoryError(error);
  }
}

function renderBriefing(briefing) {
  if (!briefingMeta || !briefingSummary || !briefingList) return;
  const itemCount = Array.isArray(briefing.items) ? briefing.items.length : 0;
  briefingMeta.textContent = `更新 ${formatDateTime(briefing.generatedAt)} | ${briefing.source || "每日投资简报"} | ${itemCount} 条线索`;
  briefingSummary.textContent = briefing.summary || "今日暂无简报摘要。";
  const items = (briefing.items || []).slice(0, 6);
  if (!items.length) {
    briefingList.innerHTML = `<article class="briefing-card"><h3>等待更新</h3><p>简报发布器还没有写入有效线索。</p><strong>影响：不改变当前模型分数。</strong></article>`;
    return;
  }

  briefingList.innerHTML = items
    .map((item) => {
      const sourceLink = item.sourceUrl
        ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(item.sourceLabel || "Source")}</a>`
        : escapeHtml(item.sourceLabel || "");
      return `
        <article class="briefing-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.detail)}</p>
          <strong>投资含义：${escapeHtml(item.impact || "观察其对风险偏好、利率和信用的影响。")}</strong>
          ${sourceLink ? `<div class="source-meta">${sourceLink}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderBriefingError(error) {
  if (!briefingMeta || !briefingSummary || !briefingList) return;
  briefingMeta.textContent = "每日投资简报暂不可用";
  briefingSummary.textContent = `等待简报发布器写入 data/briefing.json。错误：${error.message}`;
  briefingList.innerHTML = `
    <article class="briefing-card">
      <h3>简报数据未就绪</h3>
      <p>市场状态模型仍会读取最新指标；这里只影响“今日影响线索”模块。</p>
      <strong>投资含义：先以量化状态和触发信号为准。</strong>
    </article>
  `;
}

async function loadBriefing(options = {}) {
  try {
    renderBriefing(await fetchStaticJson(BRIEFING_ENDPOINT));
  } catch (error) {
    if (options.silent) return;
    renderBriefingError(error);
  }
}

function applyLiveSnapshot(snapshot) {
  liveSnapshot = snapshot;
  setValues(liveSnapshot.values);
  applyFieldMeta(liveSnapshot.fieldMeta);
  activePreset = "live";
  presetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.preset === "live"));
  updateDashboard({ mode: "live", snapshot: liveSnapshot });
}

async function loadLiveData(options = {}) {
  if (!options.silent) renderLiveMeta({ mode: "loading" });
  try {
    applyLiveSnapshot(await fetchLatestSnapshot());
  } catch (error) {
    if (options.silent) {
      console.warn("Live data refresh failed", error);
      return;
    }
    liveSnapshot = null;
    activePreset = "normal";
    presetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.preset === "normal"));
    setValues(presets.normal);
    updateDashboard({ mode: "preset" });
    if (liveMeta) {
      liveMeta.classList.add("is-error");
      liveMeta.textContent = `Latest Snapshot 暂不可用，已显示正常回调预设。错误：${error.message}`;
    }
  }
}

function selectPreset(name) {
  activePreset = name;
  presetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.preset === name));
  if (name === "live") {
    loadLiveData();
    return;
  }
  setValues(presets[name]);
  updateDashboard({ mode: "preset" });
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => selectPreset(button.dataset.preset));
});

if (resetButton) {
  resetButton.addEventListener("click", () => {
    if (activePreset === "live" || activePreset === "manual") {
      loadLiveData();
      loadHistory();
      loadBriefing();
      return;
    }
    selectPreset(activePreset);
    loadHistory();
    loadBriefing();
  });
}

libraryTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    libraryTabs.forEach((tab) => {
      const selected = tab.dataset.tab === target;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    document.querySelectorAll(".library-pane").forEach((pane) => {
      const selected = pane.id === `library-${target}`;
      pane.classList.toggle("is-active", selected);
      pane.hidden = !selected;
    });
  });
});

buildForm();
renderTables();
loadLiveData();
loadHistory();
loadBriefing();

setInterval(() => {
  if (activePreset === "live") {
    loadLiveData({ silent: true });
    loadHistory({ silent: true });
  }
}, CLIENT_POLL_MS);

setInterval(() => {
  loadBriefing({ silent: true });
}, BRIEFING_POLL_MS);
