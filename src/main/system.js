const { screen, systemPreferences, powerMonitor, shell, desktopCapturer } = require('electron');
const { execFileSync, execSync } = require('child_process');

let windowManager = null;
try {
  windowManager = require('node-window-manager');
} catch {
  // node-window-manager 不可用，将使用 macOS 原生 API 降级。
}

let windowScanCache = null;
let windowScanCacheTime = 0;
const WINDOW_SCAN_CACHE_TTL = 300;
let macOSPermissionPaneOpened = false;

function shouldRequestMacOSPermissions() {
  return process.platform === 'darwin' && process.env.YOYO_REQUEST_MACOS_PERMISSIONS === '1';
}

function getScreenRecordingStatus() {
  if (process.platform !== 'darwin') return null;
  if (typeof systemPreferences.getMediaAccessStatus !== 'function') return null;
  try {
    return systemPreferences.getMediaAccessStatus('screen');
  } catch {
    return null;
  }
}

function probeSystemEventsAccess() {
  if (process.platform !== 'darwin') return { ok: false, status: null };
  try {
    const output = execFileSync('osascript', [
      '-e',
      'tell application "System Events" to get count of application processes',
    ], {
      encoding: 'utf8',
      timeout: 2500,
    }).trim();
    return { ok: true, status: 'granted', count: Number(output) || 0 };
  } catch (error) {
    return {
      ok: false,
      status: 'denied-or-timeout',
      message: error?.message || String(error),
    };
  }
}

function openMacOSPermissionPanes(appendDebugLog, payload) {
  if (!shouldRequestMacOSPermissions() || macOSPermissionPaneOpened) return;
  macOSPermissionPaneOpened = true;
  appendDebugLog('macos_permission_prompt', payload);
  desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
    .then((sources) => {
      appendDebugLog('macos_screen_capture_probe', {
        ok: true,
        count: sources.length,
        screenRecordingStatus: getScreenRecordingStatus(),
      });
    })
    .catch((error) => {
      appendDebugLog('macos_screen_capture_probe', {
        ok: false,
        message: error?.message || String(error),
        screenRecordingStatus: getScreenRecordingStatus(),
      });
    });
  const systemEventsProbe = probeSystemEventsAccess();
  appendDebugLog('macos_system_events_probe', {
    ...systemEventsProbe,
    systemEventsStatus: systemEventsProbe.status,
  });
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  setTimeout(() => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  }, 700);
  setTimeout(() => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation');
  }, 1200);
}

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

function isSelfWindow(bounds, selfBounds) {
  return Boolean(
    selfBounds &&
    Math.abs(bounds.x - selfBounds.x) < 5 &&
    Math.abs(bounds.y - selfBounds.y) < 5 &&
    Math.abs(bounds.width - selfBounds.width) < 5 &&
    Math.abs(bounds.height - selfBounds.height) < 5
  );
}

function scanWindowsViaSystemEvents(selfBounds) {
  if (process.platform !== 'darwin') return null;
  try {
    const selfX = Math.round(selfBounds?.x ?? -99999);
    const selfY = Math.round(selfBounds?.y ?? -99999);
    const selfWidth = Math.round(selfBounds?.width ?? -1);
    const selfHeight = Math.round(selfBounds?.height ?? -1);
    const script = `
tell application "System Events"
  repeat with p in (application processes whose visible is true)
    repeat with w in windows of p
      try
        set winPos to position of w
        set winSize to size of w
        set winName to name of w as text
        set isSelfWindow to ((item 1 of winPos) >= ${selfX - 5} and (item 1 of winPos) <= ${selfX + 5} and (item 2 of winPos) >= ${selfY - 5} and (item 2 of winPos) <= ${selfY + 5} and (item 1 of winSize) >= ${selfWidth - 5} and (item 1 of winSize) <= ${selfWidth + 5} and (item 2 of winSize) >= ${selfHeight - 5} and (item 2 of winSize) <= ${selfHeight + 5})
        if item 1 of winSize > 100 and item 2 of winSize > 50 and winName is not "Yoyo" and isSelfWindow is false then
          return (name of p as text) & "\t" & winName & "\t" & (item 1 of winPos as text) & "\t" & (item 2 of winPos as text) & "\t" & (item 1 of winSize as text) & "\t" & (item 2 of winSize as text)
        end if
      end try
    end repeat
  end repeat
  return ""
end tell`;
    const output = execFileSync('osascript', ['-e', script], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (!output) return [];
    const [appName, title, x, y, width, height] = output.split('\t');
    const bounds = {
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    };
    if (
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      isSelfWindow(bounds, selfBounds)
    ) {
      return [];
    }
    return [{
      id: `system-events-${appName || 'window'}-${title || 'untitled'}`,
      title: title || appName || '',
      appName: appName || '',
      bounds,
    }];
  } catch {
    return null;
  }
}

function scanWindows(getMainWindow, appendDebugLog = () => {}) {
  const now = Date.now();
  if (windowScanCache && (now - windowScanCacheTime) < WINDOW_SCAN_CACHE_TTL) {
    return windowScanCache;
  }

  let hasAccessibility = true;
  const screenRecordingStatus = getScreenRecordingStatus();
  if (process.platform === 'darwin') {
    try {
      hasAccessibility = systemPreferences.isTrustedAccessibilityClient(shouldRequestMacOSPermissions());
    } catch {
      hasAccessibility = false;
    }
  }

  const selfBounds = getMainWindow().getBounds();
  let windows = null;
  let windowScanSource = null;
  let systemEventsStatus = null;
  if (hasAccessibility) {
    windows = scanWindowsViaNodeWM(selfBounds);
    if (windows?.length) windowScanSource = 'node-window-manager';
  }
  if (!windows) {
    windows = scanWindowsViaMacOS(selfBounds);
    if (windows?.length) windowScanSource = 'core-graphics';
  }
  if (hasAccessibility && (!windows || windows.length === 0)) {
    const systemEventsProbe = probeSystemEventsAccess();
    systemEventsStatus = systemEventsProbe.status;
    const systemEventsWindows = scanWindowsViaSystemEvents(selfBounds);
    if (systemEventsWindows) {
      windows = systemEventsWindows;
      windowScanSource = systemEventsWindows.length > 0
        ? 'system-events'
        : windowScanSource;
    }
  }

  const windowScanUnavailableReason = (() => {
    if (!windows) {
      return process.platform === 'darwin'
        ? 'macos-window-scan-failed'
        : 'window-scan-unavailable';
    }
    if (windows.length === 0) {
      if (process.platform === 'darwin' && !hasAccessibility) {
        return 'missing-accessibility-or-screen-recording-permission';
      }
      return 'no-eligible-windows';
    }
    return null;
  })();

  const result = {
    ok: Boolean(windows),
    hasAccessibility,
    screenRecordingStatus,
    processPath: process.execPath,
    windowScanSource,
    systemEventsStatus,
    windowScanUnavailableReason,
    windows: windows || []
  };
  if (windowScanUnavailableReason && process.platform === 'darwin') {
    openMacOSPermissionPanes(appendDebugLog, {
      hasAccessibility,
      screenRecordingStatus,
      processPath: process.execPath,
      windowScanUnavailableReason,
    });
  }
  windowScanCache = result;
  windowScanCacheTime = now;
  return result;
}

function registerSystemIpc({ ipcMain, getMainWindow, appendDebugLog }) {
  ipcMain.handle('mouse:getPosition', () => screen.getCursorScreenPoint());
  ipcMain.handle('windows:scan', () => scanWindows(getMainWindow, appendDebugLog));
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
