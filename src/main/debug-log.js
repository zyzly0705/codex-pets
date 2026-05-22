const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const BEHAVIOR_DEBUG_ENABLED = process.env.YOYO_BEHAVIOR_DEBUG === '1';
const debugLogDir = path.join(app.getPath('userData'), 'logs');
const debugLogPath = path.join(debugLogDir, 'yoyo-debug.jsonl');

function appendDebugLog(type, payload) {
  if (!BEHAVIOR_DEBUG_ENABLED) return;
  try {
    fs.mkdirSync(debugLogDir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      type,
      payload,
    });
    fs.appendFileSync(debugLogPath, `${line}\n`);
  } catch (e) {
    console.error('[DebugLog] 写入失败:', e.message);
  }
}

function registerDebugIpc({ ipcMain }) {
  ipcMain.handle('debug:behavior-enabled', () => BEHAVIOR_DEBUG_ENABLED);
  ipcMain.handle('debug:log-path', () => debugLogPath);
  ipcMain.on('debug:log', (_event, type, payload) => appendDebugLog(type, payload));
}

function logSessionStart() {
  if (!BEHAVIOR_DEBUG_ENABLED) return;
  appendDebugLog('session_start', {
    pid: process.pid,
    version: app.getVersion(),
  });
}

module.exports = {
  BEHAVIOR_DEBUG_ENABLED,
  appendDebugLog,
  debugLogPath,
  logSessionStart,
  registerDebugIpc,
};
