const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;
let homeWindow = null;

function createMainWindow({ appWidth, appHeight, appendDebugLog }) {
  const primary = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    width: appWidth,
    height: appHeight,
    x: primary.x + primary.width - appWidth - 24,
    y: primary.y + primary.height - appHeight - 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    paintWhenInitiallyHidden: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setBackgroundColor('#00000000');
  const showTransparentWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.showInactive();
    appendDebugLog('window_ready_shown', { transparent: true });
  };
  mainWindow.once('ready-to-show', showTransparentWindow);
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(showTransparentWindow, 60);
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appendDebugLog('render_process_gone', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    appendDebugLog('renderer_unresponsive', {});
  });
  mainWindow.on('closed', () => {
    appendDebugLog('window_closed', {});
    mainWindow = null;
  });
  mainWindow.on('close', (event) => {
    appendDebugLog('window_close_requested', { isQuitting: app.isQuitting });
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      appendDebugLog('window_hidden_to_tray', {});
    }
  });
  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 360,
    height: 480,
    resizable: false,
    title: 'Yoyo 设置',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function openHome() {
  if (homeWindow) {
    homeWindow.focus();
    return;
  }
  // 桌宠回家：打开小屋时隐藏桌宠
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  homeWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 900,
    minHeight: 640,
    title: 'Yoyo 小屋',
    backgroundColor: '#f8f5ef',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  homeWindow.loadFile(path.join(__dirname, '..', 'home.html'));
  homeWindow.on('closed', () => {
    homeWindow = null;
    // 小屋关闭：桌宠重新出现
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
}

function registerWindowIpc({ ipcMain, getData, saveData, setData, DEFAULT_DATA, appWidth, appHeight }) {
  ipcMain.handle('window:get-bounds', () => {
    const workArea = screen.getPrimaryDisplay().workArea;
    const bounds = mainWindow.getBounds();
    return { bounds, workArea };
  });
  ipcMain.handle('window:move-by', (_event, delta) => {
    const bounds = mainWindow.getBounds();
    const workArea = screen.getPrimaryDisplay().workArea;
    const nextX = Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, bounds.x + delta.x));
    const nextY = Math.max(workArea.y, Math.min(workArea.y + workArea.height - bounds.height, bounds.y + delta.y));
    mainWindow.setBounds({ ...bounds, x: nextX, y: nextY }, false);
    return mainWindow.getBounds();
  });
  ipcMain.handle('window:set-ignore-mouse', (_event, ignore) => {
    mainWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });
  ipcMain.handle('settings:load', () => getData().settings);
  ipcMain.handle('home:open', () => {
    openHome();
    return { ok: true };
  });
  ipcMain.handle('settings:save', (_, settings) => {
    getData().settings = settings;
    saveData();
    app.setLoginItemSettings({ openAtLogin: settings.autoStart !== false });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-changed', settings);
    }
  });
  ipcMain.handle('settings:reset', () => {
    setData({ ...DEFAULT_DATA });
    saveData();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-reset');
    }
  });
  ipcMain.handle('preferences:reset-behavior', () => {
    const petData = getData();
    petData.memory.preference = {
      ...DEFAULT_DATA.memory.preference,
      lastDecayDate: new Date().toISOString().slice(0, 10),
    };
    saveData();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('behavior-preferences-reset');
    }
    return { ok: true };
  });
  ipcMain.handle('stats:get', () => {
    const petData = getData();
    const growth = petData.growth;
    const memory = petData.memory;
    const firstDay = petData.firstDay || Date.now();
    return {
      xp: growth.xp || 0,
      level: growth.level || 1,
      path: growth.path || null,
      consecutiveDays: memory.consecutiveDays || 0,
      companionDays: Math.floor((Date.now() - firstDay) / 86400000),
      relationship: petData.relationship || null,
      dailyMemory: petData.dailyMemory || null,
      dailyCards: petData.dailyCards || [],
      companionPlan: petData.companionPlan || null,
    };
  });
  ipcMain.handle('pet:setPosition', (_event, pos) => {
    mainWindow.setBounds({
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: appWidth,
      height: appHeight
    }, false);
    return mainWindow.getBounds();
  });
  ipcMain.handle('pet:getPosition', () => mainWindow.getBounds());
}

module.exports = {
  createMainWindow,
  getMainWindow,
  openHome,
  openSettings,
  registerWindowIpc,
};
