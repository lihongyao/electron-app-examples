const { app, ipcMain, dialog, BrowserWindow } = require("electron");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

let mainWindow;
let lastNetworkStatus = null;
let networkChangeTimeout = null;
let domain = loadConfig().domain_local;

// 1. 设置单实例逻辑（只允许打开一个进程）
setupSingleInstance();

// 2. 应用启动/初始化应用逻辑
app.whenReady().then(() => {
  // -- 设置 macOS Dock 图标
  if (process.platform === "darwin") {
    app.dock.setIcon(path.join(__dirname, "./assets/logo.png"));
  }

  // -- 开机自启动
  // (() => {
  //   // 1. 检查是否是开机自启动
  //   const isAutoStart = process.argv.includes("--autostart");
  //   // 2. 设置开机自启动
  //   setupAutoLaunch(true);
  //   // 3. 根据是否开机自启动创建窗口
  //   if (isAutoStart) {
  //     console.log("App started automatically. Delaying launch...");
  //     setTimeout(createMainWindow, 1 * 60 * 1000); // 延迟1分钟启动
  //   } else {
  //     createMainWindow();
  //   }
  // })();

  createMainWindow();
});

// 3. 关闭所有窗口时退出应用
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 4. macOS 专用：当应用图标被点击且没有窗口存在时，创建主窗口
app.on("activate", () => {
  if (!BrowserWindow.getAllWindows().length) createMainWindow();
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// IPC通信示例
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ipcMain.handle("ping", (_, payload) => {
  console.log("Received ping from renderer:", payload);
  return "pong";
});
// -- 网络变化
ipcMain.on("network-status", (event, isOnline) => {
  // 如果当前网络状态和上次相同，直接返回
  if (lastNetworkStatus === isOnline) return;
  if (networkChangeTimeout) clearTimeout(networkChangeTimeout);
  networkChangeTimeout = setTimeout(() => {
    console.log(`Network status: ${isOnline ? "Online" : "Offline"}`);
    if (mainWindow) {
      if (isOnline) {
        mainWindow.loadURL(domain);
      } else {
        mainWindow.loadFile("./offline.html");
      }
    }
    lastNetworkStatus = isOnline;
  }, 300);
});
// -- 打开软键盘
ipcMain.on("open-osk", (event) => {
  exec("C:\\Windows\\System32\\osk.exe", (error) => {
    if (error) {
      console.error("Failed to launch OSK:", error);
    } else {
      console.log("OSK launched successfully");
    }
  });
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// 辅助函数
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * 设置只允许启用一个进程
 * @param {*} app
 */
function setupSingleInstance() {
  // -- 尝试获取单实例锁
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    // -- 如果没能获取锁，说明已有另一个实例在运行，退出应用
    dialog.showErrorBox("应用已运行", "当前应用已在运行中，请检查任务栏。");
    app.quit();
  } else {
    // -- 当运行第二个实例时，聚焦到主窗口
    app.on("second-instance", (event, commandLine, workingDirectory) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length) {
        const mainWindow = windows[0];
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
  }
}

/**
 * 创建主窗口
 */

function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    // -- 窗口尺寸相关
    width: 1920,
    height: 1080,
    minWidth: 1880,
    minHeight: 1000,
    maxWidth: 1920,
    maxHeight: 1080,
    // -- 是否允许窗口进入全屏模式
    fullscreenable: true,
    // -- 指定窗口的 width 和 height 是内容区域（网页部分）大小
    // -- 还是窗口的整体大小（包含边框和标题栏）
    useContentSize: true,
    // -- 是否自动隐藏菜单栏
    autoHideMenuBar: true,
    // -- 是否允许用户调整窗口大小
    resizable: true,
    // -- 启动时是否以全屏模式打开窗口
    fullscreen: false,
    // -- 是否显示窗口的边框和标题栏，false 表示移除边框
    // frame: false,
    // thickFrame: true,
    // -- 标题栏样式
    titleBarStyle: "default",
    // -- 指定窗口图标
    icon: path.join(__dirname, "./assets/logo.png"),
    // -- 定义在渲染进程中加载网页时的一些行为和安全选项
    webPreferences: {
      // -- 预加载
      preload: path.join(__dirname, "./preload.js"),
      // -- 启用上下文隔离，使得渲染进程无法直接访问主进程的内容。可以提升安全性
      contextIsolation: true,
      // -- 允许在渲染进程中使用 Node.js API，开启这个选项会带来安全风险
      nodeIntegration: false,
      // -- 禁用同源策略
      webSecurity: false,
      // 禁用缩放行为
      zoomFactor: 1.0,
    },
  });

  // -- 最大化窗口，但不会覆盖任务栏
  mainWindow.maximize();
  // -- 将窗口居中
  mainWindow.center();
  // -- 禁止缩放
  disableZoom(mainWindow);

  // -- 加载网页
  // 1. 本地文件：mainWindow.loadFile();
  // 2. 在线链接：mainWindow.loadURL();

  // 🚩 测试环境：https://hischool-dev.xingzheai.cn/login
  // 🚩 私有环境：https://hischool-local.xingzheai.cn/login
  // 🚩 生产环境：https://hischool.xingzheai.cn/
  // 🚩 开发环境：http://172.20.50.142:3000/login

  // 3. 从配置文件中加载在线链接
  console.log("domain >>", domain);
  mainWindow.loadURL(domain);

  // -- 打开开发者工具（可选）
  // mainWindow.webContents.openDevTools();

  mainWindow.on("close", (e) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["是", "否"],
      title: "确认",
      message: "您确定要关闭应用程序吗？",
      icon: path.join(__dirname, "./assets/logo.png"),
    });
    if (choice === 1) e.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * 开机自启动
 * @param {*} enable
 */
function setupAutoLaunch(enable) {
  console.log("__setupAutoLaunch__");
  // -- 需求：win32 支持开机自启动
  if (process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath("exe"),
      args: ["--autostart"],
    });
    console.log(`开机自启动已${enable ? "启用" : "禁用"}`);
  }
  console.log(`当前开机自启动状态: ${app.getLoginItemSettings().openAtLogin} (平台: ${process.platform})`);
}

/**
 * 加载配置文件
 * @returns 配置对象 {domain: string}
 */
function loadConfig() {
  console.log("__loadConfig__");
  const jsonFilePath = path.join(__dirname, "./config.json");
  try {
    const jsonData = fs.readFileSync(jsonFilePath, "utf-8");
    return JSON.parse(jsonData);
  } catch (error) {
    console.error("Failed to load configuration:", error);
    return {};
  }
}

/**
 * 禁止用户缩放网页
 * @param {*} mainWindow
 */
function disableZoom(mainWindow) {
  console.log("__disableZoom__");
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(1);
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && (input.key === "+" || input.key === "-")) {
      event.preventDefault();
    }
  });
}
