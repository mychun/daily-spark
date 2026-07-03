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

function fitPopupSize() {
  requestAnimationFrame(() => {
    const height = Math.ceil(popupCardEl.getBoundingClientRect().height);
    window.electronAPI.resizePopup(height);
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
