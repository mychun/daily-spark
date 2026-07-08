const popupCardEl = document.getElementById("popupCard");
const popupQuoteEl = document.getElementById("popupQuote");
const popupAuthorEl = document.getElementById("popupAuthor");
const btnClose = document.getElementById("btnClose");
const btnConfirm = document.getElementById("btnConfirm");

function normalizeLineBreaks(text) {
  return (text || "").replace(/\\n/g, "\n");
}

function showQuote(quote) {
  if (!quote?.text) {
    popupQuoteEl.textContent = "暂无激励语句";
    popupAuthorEl.textContent = "";
    return;
  }
  popupQuoteEl.textContent = normalizeLineBreaks(quote.text);
  popupAuthorEl.textContent = quote.author || "";
}

function measurePopupHeight() {
  // offsetHeight 含边框；额外缓冲避免透明窗口底部裁切
  return popupCardEl.offsetHeight + 4;
}

function fitPopupSize() {
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      document.documentElement.classList.remove("popup-overflow");
      document.body.classList.remove("popup-overflow");
      const naturalHeight = measurePopupHeight();
      const actualHeight = await window.electronAPI.resizePopup(naturalHeight);

      if (actualHeight < naturalHeight) {
        document.documentElement.classList.add("popup-overflow");
        document.body.classList.add("popup-overflow");
      }
    });
  });
}

function closePopup() {
  window.electronAPI.closePopup();
}

btnClose.addEventListener("click", closePopup);
btnConfirm.addEventListener("click", closePopup);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Enter") closePopup();
});

async function init() {
  const quote = await window.electronAPI.getPopupQuote();
  showQuote(quote);
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  fitPopupSize();
}

init();
