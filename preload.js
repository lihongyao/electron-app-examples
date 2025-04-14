const { contextBridge, ipcRenderer } = require("electron");

/**
 * 定义 app 全局变量
 * 绑定方法或属性，在网页中可通过 window.app 访问
 */
contextBridge.exposeInMainWorld("app", {
  // -- 暴露变量
  name: "AI音乐创作系统",
  // -- 暴露函数
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // -- 进程通信
  ping: (payload) => ipcRenderer.invoke("ping", payload),
  openOSK: () => ipcRenderer.send("open-osk"),
});

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };
  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});

// -- 监听网络状态变化
window.addEventListener("online", () => {
  ipcRenderer.send("network-status", true); // 网络恢复
});
window.addEventListener("offline", () => {
  ipcRenderer.send("network-status", false); // 网络断开
});
// -- 初始网络状态发送给主进程
ipcRenderer.send("network-status", navigator.onLine);
