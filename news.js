const IS_EN = document.documentElement.lang.toLowerCase().startsWith("en");
const NEWS_INDEX_ENDPOINT = document.body.dataset.newsIndex || "data/news_index.json";
const copy = (zh, en) => (IS_EN ? en : zh);

const archiveList = document.querySelector("#news-archive-list");
const readerHeader = document.querySelector("#news-reader-header");
const readerBody = document.querySelector("#news-reader-body");
const statusCopy = document.querySelector("#news-status-copy");
const editionFilter = document.querySelector("#edition-filter");
const calendarGrid = document.querySelector("#news-calendar-grid");
const calendarMonthLabel = document.querySelector("#calendar-month");
const calendarPrev = document.querySelector("#calendar-prev");
const calendarNext = document.querySelector("#calendar-next");
const calendarClear = document.querySelector("#calendar-clear");

let newsIndex = [];
let selectedId = null;
let selectedDate = null;
let calendarMonth = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function inlineMarkdown(value) {
  const tokens = [];
  const tokenFor = (html) => {
    const token = `NEWSHTMLTOKEN${tokens.length}END`;
    tokens.push(html);
    return token;
  };

  let text = String(value ?? "");
  text = text.replace(
    /\[\[SOURCE\|([^|\]]+)\|([^|\]]+)\|([^|\]]+)\|(https?:\/\/[^\]]+)\]\]/g,
    (_, name, published, eventDate, url) => {
      const href = safeUrl(url);
      const label = `${name} · ${published} · event ${eventDate}`;
      return tokenFor(
        href
          ? `<a class="source-chip" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
          : `<span class="source-chip">${escapeHtml(label)}</span>`
      );
    }
  );
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
    const href = safeUrl(url);
    return href
      ? tokenFor(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`)
      : label;
  });

  text = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  tokens.forEach((html, index) => {
    text = text.replace(`NEWSHTMLTOKEN${index}END`, html);
  });
  return text;
}

function stripFrontMatter(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.slice(1).findIndex((line) => line.trim() === "---");
  return end < 0 ? lines : lines.slice(end + 2);
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderMarkdown(markdown) {
  const lines = stripFrontMatter(markdown);
  const html = [];
  let listType = null;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      closeList();
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(
        `<div class="news-table-wrap"><table><thead><tr>${headers
          .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeList();
      html.push("<hr />");
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    closeList();
    if (line.startsWith(">")) {
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
    } else {
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  closeList();
  return html.join("");
}

function editionLabel(edition) {
  return edition === "close" ? copy("收盘版", "Close") : copy("早盘版", "Morning");
}

function formatTimestamp(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(IS_EN ? "en-US" : "zh-CN", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function parseDateKey(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKeyFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function monthStartFor(value) {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function addMonths(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function sameMonth(left, right) {
  return (
    left &&
    right &&
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

function formatMonth(date) {
  if (!date) return "--";
  return new Intl.DateTimeFormat(IS_EN ? "en-US" : "zh-CN", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  }).format(date);
}

function entriesByDate() {
  return newsIndex.reduce((groups, entry) => {
    if (!entry.date) return groups;
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date).push(entry);
    return groups;
  }, new Map());
}

function visibleEntries() {
  const filter = editionFilter.value;
  return newsIndex.filter((entry) => {
    const editionMatch = filter === "all" || entry.edition === filter;
    const dateMatch = !selectedDate || entry.date === selectedDate;
    return editionMatch && dateMatch;
  });
}

function activeEditionName() {
  if (editionFilter.value === "morning") return copy("早盘", "morning");
  if (editionFilter.value === "close") return copy("收盘", "close");
  return copy("全部", "all");
}

function activeDateName() {
  return selectedDate ? selectedDate : copy("全部日期", "all dates");
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonthLabel) return;
  if (!newsIndex.length) {
    calendarMonthLabel.textContent = "--";
    calendarGrid.innerHTML = `<div class="calendar-empty">${copy("暂无归档日期", "No archived dates")}</div>`;
    return;
  }

  const grouped = entriesByDate();
  if (!calendarMonth) {
    calendarMonth = monthStartFor(newsIndex[0]?.date) || new Date();
  }

  calendarMonthLabel.textContent = formatMonth(calendarMonth);
  const year = calendarMonth.getUTCFullYear();
  const month = calendarMonth.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(`<span class="calendar-cell is-empty"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    const key = dateKeyFromUtc(date);
    const entries = grouped.get(key) || [];
    const editions = new Set(entries.map((entry) => entry.edition));
    const dots = ["morning", "close"]
      .filter((edition) => editions.has(edition))
      .map((edition) => `<i class="edition-dot ${edition}"></i>`)
      .join("");
    const hasEntries = entries.length > 0;
    cells.push(`
      <button
        class="calendar-cell${hasEntries ? " has-entries" : ""}${key === selectedDate ? " is-selected" : ""}"
        type="button"
        data-date="${key}"
        ${hasEntries ? "" : "disabled"}
        aria-label="${escapeHtml(`${key} ${entries.length ? `${entries.length} ${copy("份简报", "briefs")}` : copy("暂无简报", "no briefs")}`)}"
      >
        <span class="day-number">${day}</span>
        <span class="day-dots">${dots}</span>
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
  calendarGrid.querySelectorAll("[data-date]:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => selectDate(button.dataset.date));
  });
}

async function selectDate(date) {
  selectedDate = date;
  const nextMonth = monthStartFor(date);
  if (nextMonth && !sameMonth(calendarMonth, nextMonth)) calendarMonth = nextMonth;
  editionFilter.value = "all";
  renderCalendar();
  renderArchive();
  const entries = visibleEntries();
  if (entries.length) await selectEntry(entries[0].id);
}

async function clearDateFilter() {
  selectedDate = null;
  renderCalendar();
  renderArchive();
  const entries = visibleEntries();
  if (entries.length) await selectEntry(entries[0].id);
}

function renderArchive() {
  const entries = visibleEntries();
  if (!entries.length) {
    const fallback = newsIndex.length
      ? copy(
          `${activeDateName()} 没有${activeEditionName()}简报；可切换日期或版本查看其他归档。`,
          `No ${activeEditionName()} briefs for ${activeDateName()}; switch date or edition to read another archive.`
        )
      : copy("还没有已发布简报。", "No published briefs are available yet.");
    archiveList.innerHTML = `<div class="news-empty">${fallback}</div>`;
    return;
  }
  const scope = selectedDate
    ? copy(`${selectedDate} 的已归档推送`, `Archived pushes for ${selectedDate}`)
    : copy("全部已归档推送", "All archived pushes");
  archiveList.innerHTML = `<div class="archive-scope">${scope}</div>` + entries
    .map(
      (entry) => `
        <button class="archive-item${entry.id === selectedId ? " is-active" : ""}" type="button" data-news-id="${escapeHtml(entry.id)}">
          <span class="archive-item-meta">
            <span class="edition-pill"><i class="edition-dot ${escapeHtml(entry.edition)}"></i>${editionLabel(entry.edition)}</span>
            <span>${escapeHtml(entry.date)}</span>
          </span>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.summary || (IS_EN ? `${entry.wordCount || 0} characters · ${entry.sourceCount || 0} sources` : `${entry.wordCount || 0} 字 · ${entry.sourceCount || 0} 个来源`))}</p>
        </button>
      `
    )
    .join("");

  archiveList.querySelectorAll("[data-news-id]").forEach((button) => {
    button.addEventListener("click", () => selectEntry(button.dataset.newsId));
  });
}

async function selectEntry(id) {
  const entry = newsIndex.find((item) => item.id === id);
  if (!entry) return;
  selectedId = entry.id;
  renderArchive();
  readerHeader.innerHTML = `
    <p class="eyebrow">${editionLabel(entry.edition)} · ${escapeHtml(entry.date)}</p>
    <h2>${escapeHtml(entry.title)}</h2>
    <p>${escapeHtml(entry.summary || copy("完整市场简报与来源归档。", "Complete market brief and source archive."))}</p>
    <div class="reader-meta">
      <span>${copy("发布", "Published")} ${escapeHtml(formatTimestamp(entry.generatedAt))} ET</span>
      <span>${entry.wordCount || 0} ${copy("字", "characters")}</span>
      <span>${entry.sourceCount || 0} ${copy("个来源块", "source blocks")}</span>
    </div>
  `;
  readerBody.innerHTML = `<div class="news-empty">${copy("正在读取完整简报...", "Loading the complete brief...")}</div>`;
  try {
    const response = await fetch(entry.path, { cache: "default" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    readerBody.innerHTML = renderMarkdown(await response.text());
  } catch (error) {
    readerBody.innerHTML = `<div class="news-empty">${copy("完整简报未加载成功：", "The complete brief could not be loaded: ")}${escapeHtml(error.message)}</div>`;
  }
}

async function init() {
  try {
    const response = await dashboardDataFetch(NEWS_INDEX_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    newsIndex = Array.isArray(payload.entries) ? payload.entries : [];
    editionFilter.value = "all";
    selectedDate = newsIndex[0]?.date || null;
    calendarMonth = monthStartFor(selectedDate) || null;
    statusCopy.textContent = newsIndex.length
      ? copy(
          `已归档 ${newsIndex.length} 份完整简报，覆盖 ${payload.coverage?.start || "--"} 至 ${payload.coverage?.end || "--"}。`,
          `${newsIndex.length} complete briefs archived, covering ${payload.coverage?.start || "--"} through ${payload.coverage?.end || "--"}.`
        )
      : copy(
          "页面与发布管道已就绪，等待下一次早盘或收盘简报写入。",
          "The publishing pipeline is ready and waiting for the next morning or close brief."
        );
    renderCalendar();
    renderArchive();
    if (newsIndex.length) await selectEntry(newsIndex[0].id);
  } catch (error) {
    statusCopy.textContent = copy("新闻索引暂未加载成功。", "The news index is temporarily unavailable.");
    archiveList.innerHTML = `<div class="news-empty">${copy("等待发布器生成新闻索引：", "Waiting for the publisher to generate the news index: ")}${escapeHtml(error.message)}</div>`;
  }
}

editionFilter.addEventListener("change", () => {
  renderArchive();
  const entries = visibleEntries();
  if (entries.length && !entries.some((entry) => entry.id === selectedId)) {
    selectEntry(entries[0].id);
  } else if (!entries.length) {
    selectedId = null;
    readerHeader.innerHTML = `
      <p class="eyebrow">${copy("暂无该版本", "No matching edition")}</p>
      <h2>${copy("这个筛选下还没有简报", "No briefs for this filter")}</h2>
      <p>${copy("切换到“全部”可以查看已经归档的其他版本。", "Switch to All to read the currently archived editions.")}</p>
    `;
    readerBody.innerHTML = "";
  }
});

calendarPrev?.addEventListener("click", () => {
  if (!calendarMonth) return;
  calendarMonth = addMonths(calendarMonth, -1);
  renderCalendar();
});

calendarNext?.addEventListener("click", () => {
  if (!calendarMonth) return;
  calendarMonth = addMonths(calendarMonth, 1);
  renderCalendar();
});

calendarClear?.addEventListener("click", () => {
  clearDateFilter();
});

init();
