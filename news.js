const NEWS_INDEX_ENDPOINT = "data/news_index.json";

const archiveList = document.querySelector("#news-archive-list");
const readerHeader = document.querySelector("#news-reader-header");
const readerBody = document.querySelector("#news-reader-body");
const statusCopy = document.querySelector("#news-status-copy");
const editionFilter = document.querySelector("#edition-filter");

let newsIndex = [];
let selectedId = null;

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
  return edition === "close" ? "收盘版" : "早盘版";
}

function formatTimestamp(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function visibleEntries() {
  const filter = editionFilter.value;
  return newsIndex.filter((entry) => filter === "all" || entry.edition === filter);
}

function renderArchive() {
  const entries = visibleEntries();
  if (!entries.length) {
    archiveList.innerHTML = `<div class="news-empty">当前筛选下还没有已发布简报。</div>`;
    return;
  }
  archiveList.innerHTML = entries
    .map(
      (entry) => `
        <button class="archive-item${entry.id === selectedId ? " is-active" : ""}" type="button" data-news-id="${escapeHtml(entry.id)}">
          <span class="archive-item-meta">
            <span class="edition-pill"><i class="edition-dot ${escapeHtml(entry.edition)}"></i>${editionLabel(entry.edition)}</span>
            <span>${escapeHtml(entry.date)}</span>
          </span>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.summary || `${entry.wordCount || 0} 字 · ${entry.sourceCount || 0} 个来源`)}</p>
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
    <p>${escapeHtml(entry.summary || "完整市场简报与来源归档。")}</p>
    <div class="reader-meta">
      <span>发布 ${escapeHtml(formatTimestamp(entry.generatedAt))} ET</span>
      <span>${entry.wordCount || 0} 字</span>
      <span>${entry.sourceCount || 0} 个来源块</span>
    </div>
  `;
  readerBody.innerHTML = `<div class="news-empty">正在读取完整简报...</div>`;
  try {
    const response = await fetch(`${entry.path}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    readerBody.innerHTML = renderMarkdown(await response.text());
  } catch (error) {
    readerBody.innerHTML = `<div class="news-empty">完整简报未加载成功：${escapeHtml(error.message)}</div>`;
  }
}

async function init() {
  try {
    const response = await fetch(`${NEWS_INDEX_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    newsIndex = Array.isArray(payload.entries) ? payload.entries : [];
    statusCopy.textContent = newsIndex.length
      ? `已归档 ${newsIndex.length} 份完整简报，覆盖 ${payload.coverage?.start || "--"} 至 ${payload.coverage?.end || "--"}。`
      : "页面与发布管道已就绪，等待下一次早盘或收盘简报写入。";
    renderArchive();
    if (newsIndex.length) await selectEntry(newsIndex[0].id);
  } catch (error) {
    statusCopy.textContent = "新闻索引暂未加载成功。";
    archiveList.innerHTML = `<div class="news-empty">等待发布器生成 data/news_index.json：${escapeHtml(error.message)}</div>`;
  }
}

editionFilter.addEventListener("change", () => {
  renderArchive();
  const entries = visibleEntries();
  if (entries.length && !entries.some((entry) => entry.id === selectedId)) {
    selectEntry(entries[0].id);
  }
});

init();
