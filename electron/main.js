const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  screen,
  nativeImage,
  nativeTheme,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const {
  loadData,
  saveData,
  getTodayString,
  getRemindTime,
  shouldShowReminder,
  createLastShown,
  isRemindTimeInFuture,
  normalizeLastShown,
  normalizeLineBreaks,
  getQuoteOfDay,
  getRandomQuote,
} = require("./store");

const isDev = !app.isPackaged;
let mainWindow = null;
let popupWindow = null;
let tray = null;
let checkTimer = null;
let appData = null;

const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");
const POPUP_WIDTH = 620;
const POPUP_MIN_HEIGHT = 360;
const POPUP_SCREEN_MARGIN = 40;

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getRendererPath(file) {
  return path.join(__dirname, "..", "renderer", file);
}

function centerWindow(win) {
  const bounds = win.getBounds();
  const { workArea } = screen.getPrimaryDisplay();
  const x = Math.round(workArea.x + (workArea.width - bounds.width) / 2);
  const y = Math.round(workArea.y + (workArea.height - bounds.height) / 2);
  win.setPosition(x, y);
}

function applyAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: process.execPath,
    args: isDev ? [path.resolve(process.argv[1])] : [],
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    title: "每日激励 · Daily Spark",
    icon: ICON_PATH,
    frame: false,
    movable: true,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(getRendererPath("index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

let pendingPopupQuote = null;

function createPopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    return popupWindow;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const initialHeight = workArea.height - POPUP_SCREEN_MARGIN * 2;

  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: initialHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    movable: true,
    show: false,
    focusable: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.on("closed", () => {
    popupWindow = null;
  });

  return popupWindow;
}

function getReminderQuote() {
  const last = normalizeLastShown(appData.lastShown);
  const today = getTodayString();
  const remindTime = getRemindTime(appData.settings);

  // 同一天修改提醒时间后再次触发，换一条不同的激励语
  if (last?.date === today && last.remindTime && last.remindTime !== remindTime) {
    const daily = getQuoteOfDay(appData.quotes);
    const others = appData.quotes.filter((q) => q.id !== daily?.id);
    return getRandomQuote(others.length ? others : appData.quotes);
  }

  return getQuoteOfDay(appData.quotes);
}

function showQuotePopup(quote) {
  if (!quote) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
    popupWindow = null;
  }

  pendingPopupQuote = quote;
  const win = createPopupWindow();

  win.loadFile(getRendererPath("popup.html"));

  // 通知主窗口同步更新显示的文案
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-quote", quote);
  }
}

function resizePopupWindow(contentHeight) {
  if (!popupWindow || popupWindow.isDestroyed()) return POPUP_MIN_HEIGHT;

  const { workArea } = screen.getPrimaryDisplay();
  const maxHeight = workArea.height - POPUP_SCREEN_MARGIN * 2;
  const height = Math.min(
    Math.max(Math.ceil(contentHeight), POPUP_MIN_HEIGHT),
    maxHeight
  );

  popupWindow.setSize(POPUP_WIDTH, height);
  centerWindow(popupWindow);

  if (!popupWindow.isVisible()) {
    popupWindow.show();
    popupWindow.focus();
  }

  return height;
}

function markReminderShown() {
  appData.lastShown = createLastShown(appData.settings);
  saveData(appData);
}

function checkDailyReminder() {
  if (!appData?.settings?.enabled) return;

  const now = new Date();
  const remindTime = getRemindTime(appData.settings);
  const [h, m] = remindTime.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = h * 60 + m;

  if (currentMinutes >= targetMinutes && shouldShowReminder(appData.lastShown, appData.settings)) {
    const quote = getReminderQuote();
    if (quote) {
      showQuotePopup(quote);
      markReminderShown();
    }
  }
}

function startReminderScheduler() {
  if (checkTimer) clearInterval(checkTimer);
  checkDailyReminder();
  // 每 5 秒检查一次，避免 30 秒轮询错过或延迟触发
  checkTimer = setInterval(checkDailyReminder, 5_000);
}

function createTray() {
  let icon = nativeImage.createFromPath(ICON_PATH);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("每日激励");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "打开设置",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: "预览今日弹窗",
      click: () => {
        const quote = getQuoteOfDay(appData.quotes) || getRandomQuote(appData.quotes);
        showQuotePopup(quote);
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function parseImportData(raw, filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();

  function normalizeQuote(item) {
    if (!item) return null;
    const text = normalizeLineBreaks(item.text || item.content || item.quote || "").trim();
    if (!text) return null;
    return {
      id: randomUUID(),
      text,
      author: (item.author || item.source || "").trim(),
    };
  }

  if (ext === "json" || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeQuote).filter(Boolean);
    }
    if (parsed.quotes && Array.isArray(parsed.quotes)) {
      return parsed.quotes.map(normalizeQuote).filter(Boolean);
    }
    throw new Error("JSON 格式不正确");
  }

  if (ext === "csv") {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",");
        return normalizeQuote({ text: parts[0], author: parts[1] || "" });
      })
      .filter(Boolean);
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => normalizeQuote({ text, author: "" }))
    .filter(Boolean);
}

function setupIPC() {
  ipcMain.handle("get-quotes", () => appData.quotes);

  ipcMain.handle("save-quotes", (_event, quotes) => {
    appData.quotes = quotes;
    saveData(appData);
    return true;
  });

  ipcMain.handle("get-settings", () => appData.settings);

  ipcMain.handle("save-settings", (_event, settings) => {
    const oldEnabled = appData.settings.enabled;
    const oldRemindTime = appData.settings.remindTime;
    appData.settings = { ...appData.settings, ...settings };
    appData.settings.remindTime = getRemindTime(appData.settings);

    const justEnabled = settings.enabled && !oldEnabled;
    const timeChanged = oldRemindTime !== appData.settings.remindTime;

    // 重新开启或修改提醒时间时：若新时间今日已过，标记已处理，避免立即补弹
    if ((justEnabled || timeChanged) && !isRemindTimeInFuture(appData.settings)) {
      appData.lastShown = createLastShown(appData.settings);
    }

    saveData(appData);
    applyAutoStart(appData.settings.autoStart);
    startReminderScheduler();
    return { ...appData.settings };
  });

  ipcMain.handle("export-quotes", async () => {
    if (!appData.quotes.length) {
      return { ok: false, message: "没有可导出的语句" };
    }

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "导出激励语句",
      defaultPath: `每日激励_${getTodayString()}.json`,
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (canceled || !filePath) return { ok: false };

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      quotes: appData.quotes.map(({ text, author }) => ({ text, author })),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true, message: "导出成功" };
  });

  ipcMain.handle("import-quotes", async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: "导入激励语句",
      filters: [
        { name: "支持的文件", extensions: ["json", "txt", "csv"] },
        { name: "所有文件", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (canceled || !filePaths.length) return { ok: false };

    try {
      const filePath = filePaths[0];
      const raw = fs.readFileSync(filePath, "utf-8");
      const imported = parseImportData(raw, path.basename(filePath));
      if (!imported.length) {
        return { ok: false, message: "文件中没有有效语句" };
      }
      appData.quotes = [...imported, ...appData.quotes];
      saveData(appData);
      return { ok: true, message: `成功导入 ${imported.length} 条语句`, quotes: appData.quotes };
    } catch (err) {
      return { ok: false, message: "导入失败：" + err.message };
    }
  });

  ipcMain.handle("preview-popup", (_event, quote) => {
    const popupQuote =
      quote ||
      getQuoteOfDay(appData.quotes) ||
      getRandomQuote(appData.quotes);
    showQuotePopup(popupQuote);
    return true;
  });

  ipcMain.handle("get-popup-quote", () => pendingPopupQuote);

  ipcMain.handle("resize-popup", (_event, contentHeight) => {
    return resizePopupWindow(contentHeight);
  });

  ipcMain.handle("close-popup", () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.hide();
    }
  });

  ipcMain.handle("window-minimize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle("window-close", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    appData = loadData();

    // 首次启动或今日尚未弹过，且提醒时间已过：不补弹，等到次日设定时间
    if (
      appData.settings.enabled &&
      shouldShowReminder(appData.lastShown, appData.settings) &&
      !isRemindTimeInFuture(appData.settings)
    ) {
      appData.lastShown = createLastShown(appData.settings);
      saveData(appData);
    }

    applyAutoStart(appData.settings.autoStart);
    setupIPC();
    createMainWindow();
    createTray();
    startReminderScheduler();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });

  app.on("window-all-closed", () => {
    /* 保持后台运行，通过托盘退出 */
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    if (checkTimer) clearInterval(checkTimer);
  });
}
