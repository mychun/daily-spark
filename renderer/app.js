const todayQuoteEl = document.getElementById("todayQuote");
const todayAuthorEl = document.getElementById("todayAuthor");
const quoteListEl = document.getElementById("quoteList");
const quoteCountEl = document.getElementById("quoteCount");
const emptyStateEl = document.getElementById("emptyState");
const addForm = document.getElementById("addForm");
const newQuoteEl = document.getElementById("newQuote");
const newAuthorEl = document.getElementById("newAuthor");
const btnRefresh = document.getElementById("btnRefresh");
const btnImport = document.getElementById("btnImport");
const btnExport = document.getElementById("btnExport");
const btnPreview = document.getElementById("btnPreview");
const remindTimeEl = document.getElementById("remindTime");
const enableRemindEl = document.getElementById("enableRemind");
const autoStartEl = document.getElementById("autoStart");
const notifyStatusEl = document.getElementById("notifyStatus");

let quotes = [];
let settings = { remindTime: "09:00", enabled: true, autoStart: true };
let currentQuote = null;

function normalizeLineBreaks(text) {
  return (text || "").replace(/\\n/g, "\n");
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getQuoteOfDay() {
  if (!quotes.length) return null;
  const today = getTodayString();
  const seed = today.split("-").reduce((a, b) => a + parseInt(b, 10), 0);
  return quotes[seed % quotes.length];
}

function getRandomQuote() {
  if (!quotes.length) return null;
  const candidates = currentQuote
    ? quotes.filter((q) => q.id !== currentQuote.id)
    : quotes;
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function displayQuote(quote) {
  currentQuote = quote;
  if (!quote) {
    todayQuoteEl.textContent = "还没有激励语句，快添加一条吧！";
    todayAuthorEl.textContent = "";
    return;
  }
  todayQuoteEl.textContent = normalizeLineBreaks(quote.text);
  todayAuthorEl.textContent = quote.author || "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderQuoteList() {
  quoteCountEl.textContent = quotes.length;
  quoteListEl.innerHTML = "";

  if (!quotes.length) {
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;

  quotes.forEach((q) => {
    const li = document.createElement("li");
    li.className = "quote-item";
    li.innerHTML = `
      <div class="quote-item-content">
        <p class="quote-item-text">${escapeHtml(normalizeLineBreaks(q.text))}</p>
        ${q.author ? `<p class="quote-item-author">— ${escapeHtml(q.author)}</p>` : ""}
      </div>
      <div class="quote-item-actions">
        <button class="btn-icon-only delete" data-id="${q.id}" title="删除">🗑️</button>
      </div>
    `;
    quoteListEl.appendChild(li);
  });

  quoteListEl.querySelectorAll(".btn-icon-only.delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuote(btn.dataset.id));
  });
}

async function saveQuotes() {
  await window.electronAPI.saveQuotes(quotes);
}

async function saveSettings() {
  const saved = await window.electronAPI.saveSettings(settings);
  if (saved) settings = { ...settings, ...saved };
  updateSettingsUI();
}

function updateSettingsUI() {
  remindTimeEl.value = settings.remindTime || "09:00";
  enableRemindEl.checked = !!settings.enabled;
  autoStartEl.checked = !!settings.autoStart;

  if (settings.enabled) {
    notifyStatusEl.textContent = `每天 ${settings.remindTime} 将在屏幕中央弹出激励提醒 🔔`;
  } else {
    notifyStatusEl.textContent = "提醒已关闭，可开启后每天在屏幕中央弹窗";
  }
}

function showToast(message, isError = false) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    (document.querySelector(".app-shell") || document.body).appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function addQuote(text, author) {
  const trimmed = normalizeLineBreaks(text).trim();
  if (!trimmed) return;
  quotes.unshift({
    id: crypto.randomUUID(),
    text: trimmed,
    author: (author || "").trim(),
  });
  await saveQuotes();
  renderQuoteList();
  displayQuote(getQuoteOfDay());
  showToast("语句已添加 ✨");
}

async function deleteQuote(id) {
  quotes = quotes.filter((q) => q.id !== id);
  await saveQuotes();
  renderQuoteList();
  displayQuote(getQuoteOfDay());
  showToast("已删除");
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addQuote(newQuoteEl.value, newAuthorEl.value);
  newQuoteEl.value = "";
  newAuthorEl.value = "";
  newQuoteEl.focus();
});

btnRefresh.addEventListener("click", () => {
  const next = getRandomQuote();
  if (!next) {
    showToast(quotes.length === 1 ? "只有一条语句，无法切换" : "还没有语句");
    return;
  }
  displayQuote(next);
});

btnPreview.addEventListener("click", () => {
  window.electronAPI.previewPopup(currentQuote);
});

btnExport.addEventListener("click", async () => {
  const result = await window.electronAPI.exportQuotes();
  if (result?.ok) showToast(result.message || "导出成功 📤");
  else if (result?.message) showToast(result.message, true);
});

btnImport.addEventListener("click", async () => {
  const result = await window.electronAPI.importQuotes();
  if (result?.ok) {
    quotes = result.quotes || quotes;
    renderQuoteList();
    displayQuote(getQuoteOfDay());
    showToast(result.message || "导入成功 📥");
  } else if (result?.message) {
    showToast(result.message, true);
  }
});

enableRemindEl.addEventListener("change", async () => {
  if (remindTimeEl.value) settings.remindTime = remindTimeEl.value;
  settings.enabled = enableRemindEl.checked;
  await saveSettings();
  if (settings.enabled) {
    showToast(`每日 ${settings.remindTime} 屏幕弹窗提醒已开启`);
  }
});

autoStartEl.addEventListener("change", async () => {
  settings.autoStart = autoStartEl.checked;
  await saveSettings();
  showToast(settings.autoStart ? "已开启开机自启" : "已关闭开机自启");
});

async function saveRemindTime() {
  if (!remindTimeEl.value) return;
  settings.remindTime = remindTimeEl.value;
  await saveSettings();
  showToast(`提醒时间已设为 ${settings.remindTime}`);
}

let saveTimeTimer = null;
remindTimeEl.addEventListener("input", () => {
  if (remindTimeEl.value) {
    settings.remindTime = remindTimeEl.value;
    updateSettingsUI();
  }
  clearTimeout(saveTimeTimer);
  saveTimeTimer = setTimeout(saveRemindTime, 400);
});
remindTimeEl.addEventListener("change", saveRemindTime);

async function init() {
  quotes = await window.electronAPI.getQuotes();
  settings = await window.electronAPI.getSettings();
  displayQuote(getQuoteOfDay());
  renderQuoteList();
  updateSettingsUI();

  // 弹窗弹出时，同步更新主窗口显示的文案
  window.electronAPI.onUpdateQuote((quote) => {
    displayQuote(quote);
  });
}

init();

document.getElementById("btnMinimize")?.addEventListener("click", () => {
  window.electronAPI.windowMinimize();
});

document.getElementById("btnClose")?.addEventListener("click", () => {
  window.electronAPI.windowClose();
});
