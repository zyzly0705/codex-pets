const { BrowserWindow, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { toFileUrl } = require('./pets');

function loadEffectTimeline(spritePath, effectId) {
  if (!spritePath) return null;
  const manifestPath = path.join(path.dirname(spritePath), 'effects', effectId, 'timeline.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { id: effectId, error: error.message };
  }
}

function notifyManualEffect(getMainWindow, type, duration) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('effect:manual', { type, duration });
  }
}

function triggerFullscreenEffect(type) {
  const display = screen.getPrimaryDisplay();
  const effectWin = new BrowserWindow({
    x: 0,
    y: 0,
    width: display.size.width,
    height: display.size.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  effectWin.setIgnoreMouseEvents(true);
  effectWin.setAlwaysOnTop(true, 'screen-saver');
  effectWin.loadFile(path.join(__dirname, '..', 'effect.html'), { query: { type } });
  setTimeout(() => {
    if (!effectWin.isDestroyed()) effectWin.close();
  }, 6000);
}

function createEffectOverlay({ getMainWindow, appendDebugLog, logPrefix, duration }) {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const mainBounds = mainWindow.getBounds();
  const effectDisplay = screen.getDisplayMatching(mainBounds);
  const overlayBounds = effectDisplay.workArea;
  const { width, height } = overlayBounds;
  appendDebugLog(`${logPrefix}_triggered`, {
    mainBounds,
    displayBounds: effectDisplay.bounds,
    overlayBounds,
  });

  const effectWin = new BrowserWindow({
    width,
    height,
    x: overlayBounds.x,
    y: overlayBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const enforcedBounds = { x: overlayBounds.x, y: overlayBounds.y, width, height };
  effectWin.setBounds(enforcedBounds, false);
  effectWin.setIgnoreMouseEvents(true);
  effectWin.setAlwaysOnTop(true, 'screen-saver');
  effectWin.webContents.on('console-message', (_event, level, message) => {
    appendDebugLog(`${logPrefix}_console`, { level, message });
  });
  effectWin.webContents.on('render-process-gone', (_event, details) => {
    appendDebugLog(`${logPrefix}_gone`, details);
  });
  effectWin.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendDebugLog(`${logPrefix}_load_failed`, { errorCode, errorDescription, validatedURL });
  });
  effectWin.once('ready-to-show', () => {
    effectWin.setBounds(enforcedBounds, false);
    appendDebugLog(`${logPrefix}_ready_to_show`, effectWin.getBounds());
  });
  effectWin.loadFile(path.join(__dirname, '..', 'pixi-effect-stage.html'));
  setTimeout(() => {
    if (!effectWin.isDestroyed()) effectWin.close();
  }, duration);
  return { effectWin, mainBounds, overlayBounds };
}

function runPixiEffect({
  getMainWindow,
  appendDebugLog,
  getActiveSpritesheetPath,
  getActiveEffectLayers,
  getData,
  effectType,
  effectId,
  logPrefix,
  manualType,
  manualDuration,
  closeAfter,
  getCenters,
}) {
  const overlay = createEffectOverlay({ getMainWindow, appendDebugLog, logPrefix, duration: closeAfter });
  if (!overlay) return;
  const { effectWin, mainBounds, overlayBounds } = overlay;
  notifyManualEffect(getMainWindow, manualType, manualDuration);
  effectWin.once('closed', () => {
    notifyManualEffect(getMainWindow, manualType, 0);
    appendDebugLog(`${logPrefix}_closed`, {});
  });

  const spritePath = getActiveSpritesheetPath();
  const spriteUrl = toFileUrl(spritePath);
  const outfitLayerSources = getActiveEffectLayers(getData);
  const effectTimeline = loadEffectTimeline(spritePath, effectId);
  const centers = getCenters({ mainBounds, overlayBounds });
  appendDebugLog(`${logPrefix}_assets`, {
    spritePath,
    outfitLayerCount: outfitLayerSources.length,
    effectTimeline: effectTimeline?.id || null,
    ...centers,
  });

  effectWin.webContents.once('did-finish-load', () => {
    appendDebugLog(`${logPrefix}_loaded`, {});
    effectWin.webContents.executeJavaScript(`startPixiEffect(${JSON.stringify({
      effectType,
      spriteSrc: spriteUrl,
      layerSources: outfitLayerSources,
      timeline: effectTimeline,
      petSize: { w: mainBounds.width, h: mainBounds.height },
      ...centers,
    })});`)
      .then(() => {
        appendDebugLog(`${logPrefix}_started`, {});
      })
      .catch((error) => {
        appendDebugLog(`${logPrefix}_start_failed`, { message: error.message, stack: error.stack });
      });
  });
}

function triggerCloneEffect(deps) {
  runPixiEffect({
    ...deps,
    effectType: 'clone',
    effectId: 'clone-heart',
    logPrefix: 'clone_effect',
    manualType: 'clone',
    manualDuration: 2400,
    closeAfter: 5800,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.64 - overlayBounds.y,
      },
    }),
  });
}

function triggerGiantEffect(deps) {
  runPixiEffect({
    ...deps,
    effectType: 'dharma',
    effectId: 'dharma-manifest',
    logPrefix: 'giant_effect',
    manualType: 'giant',
    manualDuration: 4600,
    closeAfter: 7500,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.66 - overlayBounds.y,
      },
      arenaCenter: {
        x: overlayBounds.width / 2,
        y: overlayBounds.height / 2,
      },
    }),
  });
}

function registerEffectsIpc(deps) {
  deps.ipcMain.handle('effect:fullscreen', async (_event, type) => {
    triggerFullscreenEffect(type);
  });
  deps.ipcMain.handle('effect:clone', () => {
    triggerCloneEffect(deps);
  });
  deps.ipcMain.handle('effect:giant', () => {
    triggerGiantEffect(deps);
  });
}

module.exports = {
  registerEffectsIpc,
  triggerCloneEffect,
  triggerFullscreenEffect,
  triggerGiantEffect,
};
