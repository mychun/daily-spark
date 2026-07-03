const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getQuotes: () => ipcRenderer.invoke("get-quotes"),
  saveQuotes: (quotes) => ipcRenderer.invoke("save-quotes", quotes),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  exportQuotes: () => ipcRenderer.invoke("export-quotes"),
  importQuotes: () => ipcRenderer.invoke("import-quotes"),
  previewPopup: (quote) => ipcRenderer.invoke("preview-popup", quote),
  closePopup: () => ipcRenderer.invoke("close-popup"),
  getPopupQuote: () => ipcRenderer.invoke("get-popup-quote"),
  resizePopup: (contentHeight) => ipcRenderer.invoke("resize-popup", contentHeight),
  onUpdateQuote: (callback) => ipcRenderer.on("update-quote", (_event, quote) => callback(quote)),
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
});
