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
  triggerCookEffect,
  triggerCloneEffect,
  triggerFinalArtEffect,
  triggerGiantEffect,
  triggerPlaySwitchEffect,
  triggerWatchTvEffect,
} = require('./main/effects');
const { setupAutoUpdater } = require('./main/updater');
const { startNotificationScheduler } = require('./main/notifications');
logSessionStart();

const DESKTOP_RUN_TEST_ENABLED = process.env.YOYO_TEST_DESKTOP_RUN === '1';
const APP_WIDTH = BEHAVIOR_DEBUG_ENABLED && !DESKTOP_RUN_TEST_ENABLED ? 560 : 200;
const APP_HEIGHT = BEHAVIOR_DEBUG_ENABLED && !DESKTOP_RUN_TEST_ENABLED ? 360 : 260;

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
    triggerCookEffect: () => triggerCookEffect(effectDeps()),
    triggerCloneEffect: () => triggerCloneEffect(effectDeps()),
    triggerCareEffect: (effectId, actionId) => triggerFinalArtEffect(effectDeps(), effectId, actionId),
    triggerGiantEffect: () => triggerGiantEffect(effectDeps()),
    triggerPlaySwitchEffect: () => triggerPlaySwitchEffect(effectDeps()),
    triggerWatchTvEffect: () => triggerWatchTvEffect(effectDeps()),
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
  if (process.env.YOYO_TEST_COOK === '1') {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) triggerCookEffect(effectDeps());
    }, 2500);
  }
  if (process.env.YOYO_TEST_WATCH_TV === '1') {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) triggerWatchTvEffect(effectDeps());
    }, 2500);
  }
  if (process.env.YOYO_TEST_PLAY_SWITCH === '1') {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) triggerPlaySwitchEffect(effectDeps());
    }, 2500);
  }
  if (process.env.YOYO_TEST_FINAL_ART) {
    setTimeout(() => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        triggerFinalArtEffect(effectDeps(), process.env.YOYO_TEST_FINAL_ART, 'testFinalArt');
      }
    }, 2500);
  }
  if (process.env.YOYO_TEST_OPEN_HOME === '1' || process.argv.includes('--open-home')) {
    setTimeout(() => {
      openHome();
    }, 1200);
  }
  if (process.env.YOYO_TEST_OPEN_SETTINGS === '1' || process.argv.includes('--open-settings')) {
    setTimeout(() => {
      openSettings();
    }, 1200);
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
