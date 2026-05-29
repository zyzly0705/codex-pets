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

function resolveSpineTimelineAssets(spritePath, effectId, timeline) {
  if (!timeline?.spine || !spritePath) return timeline;
  const effectDir = path.join(path.dirname(spritePath), 'effects', effectId);
  timeline.spine = { ...timeline.spine };
  if (timeline.spine.skeleton) {
    timeline.spine.skeletonUrl = toFileUrl(path.join(effectDir, timeline.spine.skeleton));
  }
  if (timeline.spine.atlas) {
    timeline.spine.atlasUrl = toFileUrl(path.join(effectDir, timeline.spine.atlas));
  }
  return timeline;
}

function resolveAutoRigPartPath({ spritePath, effectId, effectDir, partFile }) {
  if (!partFile) return '';
  if (path.isAbsolute(partFile)) return partFile;

  const packagePrefix = `assets/yoyo/effects/${effectId}/`;
  if (partFile.startsWith(packagePrefix)) {
    return path.join(effectDir, partFile.slice(packagePrefix.length));
  }

  const repoRoot = path.resolve(path.dirname(spritePath), '..', '..');
  const repoRelativePath = path.resolve(repoRoot, partFile);
  if (fs.existsSync(repoRelativePath)) return repoRelativePath;

  const effectRelativePath = path.resolve(effectDir, partFile);
  if (fs.existsSync(effectRelativePath)) return effectRelativePath;

  return path.resolve(path.dirname(effectDir), partFile);
}

function resolveAutoRigTimelineAssets(spritePath, effectId, timeline) {
  if (!timeline?.rig || !spritePath) return timeline;
  const effectDir = path.join(path.dirname(spritePath), 'effects', effectId);
  const rigPath = path.join(effectDir, timeline.rig);
  if (!fs.existsSync(rigPath)) {
    return {
      ...timeline,
      rigError: `Missing rig: ${rigPath}`,
    };
  }
  try {
    const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
    return {
      ...timeline,
      rigUrl: toFileUrl(rigPath),
      rigData: {
        ...rig,
        parts: (rig.parts || []).map((part) => {
          const partPath = resolveAutoRigPartPath({
            spritePath,
            effectId,
            effectDir,
            partFile: part.file,
          });
          return {
            ...part,
            url: toFileUrl(partPath),
          };
        }),
      },
    };
  } catch (error) {
    return {
      ...timeline,
      rigError: error.message,
    };
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
  let effectTimeline = loadEffectTimeline(spritePath, effectId);
  effectTimeline = resolveSpineTimelineAssets(spritePath, effectId, effectTimeline);
  effectTimeline = resolveAutoRigTimelineAssets(spritePath, effectId, effectTimeline);
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

function triggerFinalArtEffect(deps, effectId, manualType = effectId) {
  runPixiEffect({
    ...deps,
    effectType: 'auto-rig-action',
    effectId,
    logPrefix: `${String(effectId).replace(/-/g, '_')}_effect`,
    manualType,
    manualDuration: 3600,
    closeAfter: 4400,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.72 - overlayBounds.y,
      },
      arenaCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.70 - overlayBounds.y,
      },
    }),
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

function triggerCookEffect(deps) {
  runPixiEffect({
    ...deps,
    effectType: 'cook-pot',
    effectId: 'cook-pot',
    logPrefix: 'cook_effect',
    manualType: 'cook',
    manualDuration: 5400,
    closeAfter: 6200,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.70 - overlayBounds.y,
      },
      arenaCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.76 - overlayBounds.y,
      },
    }),
  });
}

function triggerWatchTvEffect(deps) {
  runPixiEffect({
    ...deps,
    effectType: 'spine-action',
    effectId: 'watch-tv',
    logPrefix: 'watch_tv_effect',
    manualType: 'watchTv',
    manualDuration: 5600,
    closeAfter: 6400,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.72 - overlayBounds.y,
      },
      arenaCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.70 - overlayBounds.y,
      },
    }),
  });
}

function triggerPlaySwitchEffect(deps) {
  runPixiEffect({
    ...deps,
    effectType: 'spine-action',
    effectId: 'play-switch',
    logPrefix: 'play_switch_effect',
    manualType: 'playSwitch',
    manualDuration: 5600,
    closeAfter: 6400,
    getCenters: ({ mainBounds, overlayBounds }) => ({
      sourceCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.72 - overlayBounds.y,
      },
      arenaCenter: {
        x: mainBounds.x + mainBounds.width / 2 - overlayBounds.x,
        y: mainBounds.y + mainBounds.height * 0.70 - overlayBounds.y,
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
  deps.ipcMain.handle('effect:cook', () => {
    triggerCookEffect(deps);
  });
  deps.ipcMain.handle('effect:watch-tv', () => {
    triggerWatchTvEffect(deps);
  });
  deps.ipcMain.handle('effect:play-switch', () => {
    triggerPlaySwitchEffect(deps);
  });
  deps.ipcMain.handle('effect:final-art', (_event, effectId) => {
    triggerFinalArtEffect(deps, effectId);
  });
}

module.exports = {
  registerEffectsIpc,
  resolveAutoRigPartPath,
  resolveAutoRigTimelineAssets,
  triggerCookEffect,
  triggerCloneEffect,
  triggerFinalArtEffect,
  triggerFullscreenEffect,
  triggerGiantEffect,
  triggerPlaySwitchEffect,
  triggerWatchTvEffect,
};
