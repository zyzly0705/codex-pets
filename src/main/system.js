const { screen, systemPreferences, powerMonitor } = require('electron');
const { execSync } = require('child_process');

let windowManager = null;
try {
  windowManager = require('node-window-manager');
} catch {
  // node-window-manager 不可用，将使用 macOS 原生 API 降级。
}

let windowScanCache = null;
let windowScanCacheTime = 0;
const WINDOW_SCAN_CACHE_TTL = 300;

function initGlobalKeyboardHook({ getMainWindow, appendDebugLog }) {
  if (process.env.YOYO_ENABLE_UIOHOOK !== '1') {
    console.log('[uiohook] 默认关闭；如需启用请设置 YOYO_ENABLE_UIOHOOK=1');
    return;
  }
  try {
    const { uIOhook } = require('uiohook-napi');
    let lastKeyTime = 0;
    uIOhook.on('keydown', () => {
      const now = Date.now();
      if (now - lastKeyTime < 500) return;
      lastKeyTime = now;
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        appendDebugLog('keyboard_activity', { source: 'uiohook' });
        win.webContents.send('keyboard:activity');
      }
    });
    uIOhook.start();
    appendDebugLog('keyboard_hook_started', { enabled: true });
  } catch (e) {
    console.log('[uiohook] 不可用，键盘响应功能禁用:', e.message);
    appendDebugLog('keyboard_hook_failed', { message: e.message });
  }
}

function scanWindowsViaNodeWM(selfBounds) {
  if (!windowManager) return null;
  try {
    const windows = windowManager.windowManager.getWindows();
    return windows
      .filter((w) => {
        const bounds = w.getBounds();
        if (bounds.width < 100 || bounds.height < 50) return false;
        if (
          selfBounds &&
          bounds.x === selfBounds.x && bounds.y === selfBounds.y &&
          bounds.width === selfBounds.width && bounds.height === selfBounds.height
        ) {
          return false;
        }
        return true;
      })
      .map((w) => {
        const bounds = w.getBounds();
        return {
          id: w.id,
          title: w.getTitle() || '',
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        };
      });
  } catch {
    return null;
  }
}

function scanWindowsViaMacOS(selfBounds) {
  if (process.platform !== 'darwin') return null;
  try {
    const script = [
      'ObjC.import("CoreGraphics");',
      'var list = ObjC.deepUnwrap($.CGWindowListCopyWindowInfo(',
      '  (1<<0)|(1<<4), 0));',
      'var r = [];',
      'for (var i = 0; i < list.length; i++) {',
      '  var w = list[i];',
      '  if (w.kCGWindowLayer !== 0) continue;',
      '  var b = w.kCGWindowBounds;',
      '  if (!b || b.Width < 100 || b.Height < 50) continue;',
      '  r.push({id:w.kCGWindowNumber,title:w.kCGWindowOwnerName||"",',
      '    bounds:{x:b.X,y:b.Y,width:b.Width,height:b.Height}});',
      '}',
      'JSON.stringify(r);'
    ].join(' ');
    const output = execSync(`osascript -l JavaScript -e '${script}'`, {
      encoding: 'utf8',
      timeout: 3000
    });
    const windows = JSON.parse(output.trim());
    return windows.filter((w) => {
      if (
        selfBounds &&
        Math.abs(w.bounds.x - selfBounds.x) < 5 &&
        Math.abs(w.bounds.y - selfBounds.y) < 5 &&
        Math.abs(w.bounds.width - selfBounds.width) < 5 &&
        Math.abs(w.bounds.height - selfBounds.height) < 5
      ) {
        return false;
      }
      return true;
    });
  } catch {
    return null;
  }
}

function scanWindows(getMainWindow) {
  const now = Date.now();
  if (windowScanCache && (now - windowScanCacheTime) < WINDOW_SCAN_CACHE_TTL) {
    return windowScanCache;
  }

  let hasAccessibility = true;
  if (process.platform === 'darwin') {
    try {
      hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
    } catch {
      hasAccessibility = false;
    }
  }

  const selfBounds = getMainWindow().getBounds();
  let windows = null;
  if (hasAccessibility) {
    windows = scanWindowsViaNodeWM(selfBounds);
  }
  if (!windows) {
    windows = scanWindowsViaMacOS(selfBounds);
  }

  const result = {
    ok: Boolean(windows),
    hasAccessibility,
    windows: windows || []
  };
  windowScanCache = result;
  windowScanCacheTime = now;
  return result;
}

function registerSystemIpc({ ipcMain, getMainWindow }) {
  ipcMain.handle('mouse:getPosition', () => screen.getCursorScreenPoint());
  ipcMain.handle('windows:scan', () => scanWindows(getMainWindow));
}

function initPowerMonitor({ getMainWindow }) {
  powerMonitor.on('unlock-screen', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('system:resume');
    }
  });
  powerMonitor.on('resume', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('system:resume');
    }
  });
}

function startKeyboardTest({ getMainWindow, appendDebugLog }) {
  if (process.env.YOYO_TEST_KEYBOARD !== '1') return;
  let sent = 0;
  const timer = setInterval(() => {
    const win = getMainWindow();
    if (!win || win.isDestroyed() || sent >= 5) {
      clearInterval(timer);
      return;
    }
    sent += 1;
    appendDebugLog('keyboard_activity', { source: 'test', sent });
    win.webContents.send('keyboard:activity');
  }, 700);
}

function startActiveWindowDetection({ getMainWindow }) {
  function checkActiveWindow() {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    try {
      let title = '';
      if (windowManager && windowManager.windowManager) {
        try {
          const activeWin = windowManager.windowManager.getActiveWindow();
          if (activeWin) {
            title = activeWin.getTitle() || '';
          }
        } catch {
          // getActiveWindow 不可用，降级。
        }
      }
      if (!title && process.platform === 'darwin') {
        try {
          title = execSync(
            `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
            { encoding: 'utf8', timeout: 3000 }
          ).trim();
        } catch {
          // 获取失败，忽略。
        }
      }
      const isWPS = /wps/i.test(title);
      win.webContents.send('active-app-changed', { isWPS, title });
    } catch {
      // 检测失败不影响主流程。
    }
  }

  setInterval(checkActiveWindow, 30000);
  setTimeout(checkActiveWindow, 5000);
}

function startBusyDetection({ getMainWindow }) {
  let busyContinuousMinutes = 0;
  let lastBusyReminderTime = 0;
  const BUSY_CHECK_INTERVAL = 60000;
  const BUSY_THRESHOLD_MINUTES = 60;
  const BUSY_IDLE_THRESHOLD = 30;
  const BUSY_REMINDER_COOLDOWN = 1800000;

  setInterval(() => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds < BUSY_IDLE_THRESHOLD) {
      busyContinuousMinutes++;
    } else {
      busyContinuousMinutes = 0;
    }
    if (busyContinuousMinutes >= BUSY_THRESHOLD_MINUTES) {
      const now = Date.now();
      if (now - lastBusyReminderTime > BUSY_REMINDER_COOLDOWN) {
        lastBusyReminderTime = now;
        busyContinuousMinutes = 0;
        win.webContents.send('system:busy-reminder');
      }
    }
  }, BUSY_CHECK_INTERVAL);
}

module.exports = {
  initGlobalKeyboardHook,
  initPowerMonitor,
  registerSystemIpc,
  startActiveWindowDetection,
  startBusyDetection,
  startKeyboardTest,
};
