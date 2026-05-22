const { app, ipcMain } = require('electron');
const path = require('path');

const { loadDotEnv } = require('./main/env');
loadDotEnv(path.join(__dirname, '..'));

const {
  DEFAULT_DATA,
  getData,
  loadData,
  registerStoreIpc,
  saveData,
  setData,
} = require('./main/store');
const {
  BEHAVIOR_DEBUG_ENABLED,
  appendDebugLog,
  logSessionStart,
  registerDebugIpc,
} = require('./main/debug-log');
const { registerAiIpc } = require('./main/ai-lines');
const { registerNewsIpc } = require('./main/news');
const {
  ensureBundledPets,
  getActiveEffectLayers,
  getActiveSpritesheetPath,
  listPets,
  registerPetsIpc,
  setActiveSpritesheet,
  userPetsDir,
} = require('./main/pets');
const {
  createMainWindow,
  getMainWindow,
  openHome,
  openSettings,
  registerWindowIpc,
} = require('./main/app-windows');
const { createTray, registerMenuIpc } = require('./main/tray-menu');
const { registerLifeIpc } = require('./main/life');
const { registerWeatherIpc } = require('./main/weather');
const {
  initGlobalKeyboardHook,
  initPowerMonitor,
  registerSystemIpc,
  startActiveWindowDetection,
  startBusyDetection,
  startKeyboardTest,
} = require('./main/system');
const {
  registerEffectsIpc,
  triggerCloneEffect,
  triggerGiantEffect,
} = require('./main/effects');
const { setupAutoUpdater } = require('./main/updater');
const { startNotificationScheduler } = require('./main/notifications');
logSessionStart();

const APP_WIDTH = BEHAVIOR_DEBUG_ENABLED ? 560 : 200;
const APP_HEIGHT = BEHAVIOR_DEBUG_ENABLED ? 360 : 260;

function registerIpc() {
  const deps = {
    ipcMain,
    getData,
    saveData,
    setData,
    DEFAULT_DATA,
    appendDebugLog,
    getMainWindow,
    listPets,
    openHome,
    openSettings,
    appWidth: APP_WIDTH,
    appHeight: APP_HEIGHT,
    getActiveSpritesheetPath,
    getActiveEffectLayers,
    triggerCloneEffect: () => triggerCloneEffect(effectDeps()),
    triggerGiantEffect: () => triggerGiantEffect(effectDeps()),
  };

  registerStoreIpc(deps);
  registerDebugIpc(deps);
  registerAiIpc(deps);
  registerNewsIpc(deps);
  registerPetsIpc(deps);
  registerWindowIpc(deps);
  registerLifeIpc(deps);
  registerSystemIpc(deps);
  registerWeatherIpc(deps);
  registerEffectsIpc(effectDeps());
  registerMenuIpc(deps);
}

function effectDeps() {
  return {
    ipcMain,
    getData,
    appendDebugLog,
    getMainWindow,
    getActiveSpritesheetPath,
    getActiveEffectLayers,
  };
}

app.isQuitting = false;

app.on('before-quit', () => {
  app.isQuitting = true;
  appendDebugLog('before_quit', {});
});

app.on('window-all-closed', (event) => {
  appendDebugLog('window_all_closed', {});
  event.preventDefault();
});

app.whenReady().then(() => {
  loadData();
  ensureBundledPets();
  setActiveSpritesheet(path.join(userPetsDir(), 'yoyo', 'spritesheet.webp'));
  registerIpc();

  createMainWindow({
    appWidth: APP_WIDTH,
    appHeight: APP_HEIGHT,
    appendDebugLog,
  });
  createTray(getMainWindow, openHome);
  initGlobalKeyboardHook({ getMainWindow, appendDebugLog });
  initPowerMonitor({ getMainWindow });
  startKeyboardTest({ getMainWindow, appendDebugLog });
  startActiveWindowDetection({ getMainWindow });
  startBusyDetection({ getMainWindow });
  startNotificationScheduler({ getData, openHome });
  setupAutoUpdater();

  if (process.env.YOYO_TEST_GIANT === '1') {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) triggerGiantEffect(effectDeps());
    }, 2500);
  }
  if (process.env.YOYO_TEST_CLONE === '1') {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) triggerCloneEffect(effectDeps());
    }, 2500);
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });

  app.on('activate', () => {
    if (!getMainWindow()) {
      createMainWindow({
        appWidth: APP_WIDTH,
        appHeight: APP_HEIGHT,
        appendDebugLog,
      });
    }
  });
});
