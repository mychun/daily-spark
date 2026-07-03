const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { randomUUID } = require("crypto");

const DEFAULT_QUOTES = [
  { id: randomUUID(), text: "每一个不曾起舞的日子，都是对生命的辜负。", author: "尼采" },
  { id: randomUUID(), text: "你今天的努力，是幸运的伏笔。", author: "" },
  { id: randomUUID(), text: "星光不问赶路人，时光不负有心人。", author: "" },
  { id: randomUUID(), text: "纵有狂风拔地起，我亦乘风破万里。", author: "" },
  { id: randomUUID(), text: "行动是治愈恐惧的良药，而犹豫、拖延将不断滋养恐惧。", author: "罗宾·夏玛" },
  { id: randomUUID(), text: "成功不是终点，失败也并非末日，重要的是继续前进的勇气。", author: "丘吉尔" },
  { id: randomUUID(), text: "生活不是等待风暴过去，而是学会在雨中翩翩起舞。", author: "" },
  { id: randomUUID(), text: "你的潜力远超你的想象，相信自己，勇往直前。", author: "" },
];

function getDataPath() {
  return path.join(app.getPath("userData"), "daily-spark-data.json");
}

function loadData() {
  const filePath = getDataPath();
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      let lastShown = data.lastShown || null;
      if (typeof lastShown === "string" && lastShown) {
        lastShown = { date: lastShown, remindTime: "09:00" };
      }
      return {
        quotes: data.quotes?.length ? data.quotes : [...DEFAULT_QUOTES],
        settings: {
          remindTime: "09:00",
          enabled: true,
          autoStart: true,
          ...data.settings,
        },
        lastShown,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    quotes: [...DEFAULT_QUOTES],
    settings: { remindTime: "09:00", enabled: true, autoStart: true },
    lastShown: null,
  };
}

function saveData(data) {
  const filePath = getDataPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeLineBreaks(text) {
  return (text || "").replace(/\\n/g, "\n");
}

function getQuoteOfDay(quotes) {
  if (!quotes.length) return null;
  const today = getTodayString();
  const seed = today.split("-").reduce((a, b) => a + parseInt(b, 10), 0);
  return quotes[seed % quotes.length];
}

function getRandomQuote(quotes) {
  if (!quotes.length) return null;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function getRemindTime(settings) {
  const raw = settings?.remindTime || "09:00";
  const parts = raw.split(":");
  return `${String(parts[0]).padStart(2, "0")}:${String(parts[1] || "0").padStart(2, "0")}`;
}

function normalizeLastShown(lastShown) {
  if (!lastShown) return null;
  if (typeof lastShown === "string") {
    return { date: lastShown, remindTime: null };
  }
  if (lastShown.date) {
    return {
      date: lastShown.date,
      remindTime: lastShown.remindTime ? getRemindTime({ remindTime: lastShown.remindTime }) : null,
    };
  }
  return null;
}

function shouldShowReminder(lastShown, settings) {
  const today = getTodayString();
  const remindTime = getRemindTime(settings);
  const last = normalizeLastShown(lastShown);

  if (!last || last.date !== today) return true;

  // 旧版只记日期：若用户改了提醒时间，允许新时间再次触发
  if (!last.remindTime) return false;

  return last.remindTime !== remindTime;
}

function createLastShown(settings) {
  return {
    date: getTodayString(),
    remindTime: getRemindTime(settings),
  };
}

function isRemindTimeInFuture(settings, now = new Date()) {
  const remindTime = getRemindTime(settings);
  const [h, m] = remindTime.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = h * 60 + m;
  return currentMinutes < targetMinutes;
}

module.exports = {
  loadData,
  saveData,
  getTodayString,
  getRemindTime,
  normalizeLastShown,
  shouldShowReminder,
  createLastShown,
  isRemindTimeInFuture,
  normalizeLineBreaks,
  getQuoteOfDay,
  getRandomQuote,
  DEFAULT_QUOTES,
};
