const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, screen, nativeImage, systemPreferences, powerMonitor } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

// ===== 统一文件 Store =====
const dataPath = path.join(app.getPath('userData'), 'yoyo-data.json');

const DEFAULT_DATA = {
  settings: {
    autoStart: true, soundEnabled: true, reminderFreq: 'medium',
    activity: 'normal', workStartHour: 9, workEndHour: 18,
  },
  growth: {
    xp: 0, level: 1, path: null, lastLoginDate: '',
    pathStats: { interactionCount: 0, companionTime: 0, workTime: 0 },
  },
  memory: {
    startTimes: [], endTimes: [], lastPetTime: null, lastFedTime: null,
    lastWhipTime: null, totalPetCount: 0, totalFedCount: 0, totalWhipCount: 0,
    hourlyActivity: Array(24).fill(0), totalActiveDays: 0,
    consecutiveDays: 0, lastActiveDate: null,
  },
  checkin: { streak: 0, lastDate: '', totalDays: 0 },
  achievements: {
    unlocked: [],
    stats: {
      petCount: 0, overtimeCount: 0, cloneTriggered: false,
      weatherRemindCount: 0, featuresUsed: 0, totalHours: 0,
      danceCount: 0, climbCount: 0,
    },
  },
  dailyFlags:   {},
  firstDay:     null,
  lastGreetDate: null,
  muted:        false,
  shownTips:    [],
  outfit:       { hat: 'ribbon', accessory: 'none', face: 'none' },
  usedFeatures: [],
  hasSeenGuide: false,
  _migrated:    false,
};

let petData = { ...DEFAULT_DATA };

function mergeDeep(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object'
    ) {
      result[key] = mergeDeep(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadData() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    petData = mergeDeep(DEFAULT_DATA, raw);
    // hourlyActivity 长度校验
    if (!Array.isArray(petData.memory.hourlyActivity) || petData.memory.hourlyActivity.length !== 24) {
      petData.memory.hourlyActivity = Array(24).fill(0);
    }
  } catch {
    // 首次启动或文件损坏：尝试读旧 settings 文件做向前兼容
    petData = { ...DEFAULT_DATA };
    try {
      const oldSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      petData.settings = { ...petData.settings, ...oldSettings };
    } catch { /* 没有旧文件，用默认值 */ }
  }
}

function saveData() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(petData, null, 2));
  } catch (e) {
    console.error('[Store] 保存失败:', e.message);
  }
}

// ===== 窗口扫描模块 =====
let windowManager = null;
try {
  windowManager = require('node-window-manager');
} catch {
  // node-window-manager 不可用，将使用 macOS 原生 API 降级
}

// ===== 全局键盘监听（uiohook-napi） =====
try {
  const { uIOhook } = require('uiohook-napi');
  let lastKeyTime = 0;
  uIOhook.on('keydown', () => {
    const now = Date.now();
    if (now - lastKeyTime < 500) return; // 节流 500ms
    lastKeyTime = now;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('keyboard:activity');
    }
  });
  uIOhook.start();
} catch (e) {
  console.log('[uiohook] 不可用，键盘响应功能禁用:', e.message);
}

// 窗口扫描缓存
let windowScanCache = null;
let windowScanCacheTime = 0;
const WINDOW_SCAN_CACHE_TTL = 300; // 300ms 缓存有效期

function scanWindowsViaNodeWM(selfBounds) {
  if (!windowManager) return null;
  try {
    const windows = windowManager.windowManager.getWindows();
    return windows
      .filter((w) => {
        const bounds = w.getBounds();
        // 过滤掉太小的窗口、最小化窗口
        if (bounds.width < 100 || bounds.height < 50) return false;
        // 过滤掉自身窗口（通过位置和大小匹配）
        if (selfBounds &&
            bounds.x === selfBounds.x && bounds.y === selfBounds.y &&
            bounds.width === selfBounds.width && bounds.height === selfBounds.height) {
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
    // 过滤自身窗口
    return windows.filter((w) => {
      if (selfBounds &&
          Math.abs(w.bounds.x - selfBounds.x) < 5 &&
          Math.abs(w.bounds.y - selfBounds.y) < 5 &&
          Math.abs(w.bounds.width - selfBounds.width) < 5 &&
          Math.abs(w.bounds.height - selfBounds.height) < 5) {
        return false;
      }
      return true;
    });
  } catch {
    return null;
  }
}

const APP_WIDTH = 200;
const APP_HEIGHT = 260;

let mainWindow;
let tray;

function userPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
}

function bundledPetDir() {
  return path.join(__dirname, '..', 'assets', 'xiao-hong');
}

function ensureDefaultPet() {
  const target = path.join(userPetsDir(), 'xiao-hong');
  fs.mkdirSync(target, { recursive: true });
  for (const file of ['pet.json', 'spritesheet.webp']) {
    const source = path.join(bundledPetDir(), file);
    const dest = path.join(target, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(source, dest);
    } else {
      // 若内置素材更新（文件大小不同），则覆盖旧副本
      const srcStat = fs.statSync(source);
      const dstStat = fs.statSync(dest);
      if (srcStat.size !== dstStat.size) {
        fs.copyFileSync(source, dest);
      }
    }
  }
}

function readPet(dir) {
  const manifestPath = path.join(dir, 'pet.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const spritesheetPath = path.join(dir, manifest.spritesheetPath || 'spritesheet.webp');
  return {
    id: manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.name || path.basename(dir),
    description: manifest.description || '',
    spritesheetPath,
    manifestPath
  };
}

function listPets() {
  ensureDefaultPet();
  return fs.readdirSync(userPetsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(userPetsDir(), entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'pet.json')))
    .map(readPet);
}

function createWindow() {
  const primary = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    x: primary.x + primary.width - APP_WIDTH - 24,
    y: primary.y + primary.height - APP_HEIGHT - 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createTrayIcon() {
  // 生成 16x16 粉色圆点图标（macOS template image 用黑色轮廓）
  const size = 16;
  // 一个简单的 16x16 PNG：粉色实心圆
  // 使用 data URL 方式创建
  const canvas = Buffer.alloc(size * size * 4); // RGBA
  const cx = size / 2, cy = size / 2, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * size + x) * 4;
      if (dist <= r) {
        if (process.platform === 'darwin') {
          // macOS template: 黑色轮廓，系统会自动适配颜色
          canvas[idx] = 0;       // R
          canvas[idx + 1] = 0;   // G
          canvas[idx + 2] = 0;   // B
          canvas[idx + 3] = dist <= r - 1 ? 200 : 120; // A
        } else {
          // 其他平台：粉色圆点
          canvas[idx] = 255;     // R
          canvas[idx + 1] = 105; // G
          canvas[idx + 2] = 180; // B
          canvas[idx + 3] = dist <= r - 1 ? 255 : 180; // A
        }
      } else {
        canvas[idx + 3] = 0; // 透明
      }
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Yoyo 桌面宠物');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 Yoyo', click: () => { if (mainWindow) mainWindow.show(); } },
    { label: '隐藏 Yoyo', click: () => { if (mainWindow) mainWindow.hide(); } },
    { type: 'separator' },
    { label: '导入宠物...', click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', 'import'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);

  // 左键点击切换显示/隐藏
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// ===== 当前激活的 spritesheet 路径（由 renderer 切换宠物时更新）=====
let activeSpritesheetPath = null;

// ===== 窗口关闭行为：隐藏到托盘 =====
app.isQuitting = false;

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.whenReady().then(() => {
  loadData();  // 从文件加载持久化数据
  ensureDefaultPet();
  // 初始化默认 spritesheet 路径
  activeSpritesheetPath = path.join(userPetsDir(), 'xiao-hong', 'spritesheet.webp');
  createWindow();
  createTray();

  // 开机自启（默认开启）
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });

  // 关闭按钮隐藏到托盘而非退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // ===== 系统恢复/解锁 → 通知渲染进程 =====
  powerMonitor.on('unlock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:resume');
    }
  });
  powerMonitor.on('resume', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:resume');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

// === 自动更新 ===
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// 应用就绪后检查更新
app.whenReady().then(() => {
  // 延迟 10 秒检查（避免启动时阻塞）
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 10000);

  // 每 4 小时检查一次
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4 * 60 * 60 * 1000);
});

// 更新下载完成，通知用户
autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Yoyo 有新版本啦！',
    message: `v${info.version} 已准备好，要现在更新吗？`,
    buttons: ['立即更新', '下次再说'],
    defaultId: 0
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

ipcMain.handle('pets:list', () => listPets());

// 渲染进程切换宠物时通知主进程更新 spritesheet 路径
ipcMain.handle('pet:setActiveSpritesheet', (_, spritesheetPath) => {
  activeSpritesheetPath = spritesheetPath;
});

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

ipcMain.handle('pet:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Codex Pet',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false };
  }
  const sourceDir = result.filePaths[0];
  const sourceManifest = path.join(sourceDir, 'pet.json');
  if (!fs.existsSync(sourceManifest)) {
    return { ok: false, error: 'Selected folder must contain pet.json.' };
  }
  const pet = readPet(sourceDir);
  if (!fs.existsSync(pet.spritesheetPath)) {
    return { ok: false, error: 'Selected pet spritesheet was not found.' };
  }
  const targetDir = path.join(userPetsDir(), pet.id);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceManifest, path.join(targetDir, 'pet.json'));
  fs.copyFileSync(pet.spritesheetPath, path.join(targetDir, path.basename(pet.spritesheetPath)));
  return { ok: true, pet: readPet(targetDir), pets: listPets() };
});

// ===== 右键菜单 checkbox 状态跟踪 =====
let menuState = { dancing: false, following: false, sleeping: false };

// ===== 设置窗口 =====
let settingsWindow = null;

// 旧 settings 文件路径（仅供 loadData 向前兼容读取，不再写入）
const settingsPath = path.join(app.getPath('userData'), 'yoyo-settings.json');

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
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

ipcMain.handle('settings:load', () => {
  return petData.settings;
});

ipcMain.handle('settings:save', (_, settings) => {
  petData.settings = settings;
  saveData();
  app.setLoginItemSettings({ openAtLogin: settings.autoStart !== false });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-changed', settings);
  }
});

ipcMain.handle('settings:reset', () => {
  petData = { ...DEFAULT_DATA };
  saveData();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-reset');
  }
});

// stats:get 现在直接读 petData，不再 executeJavaScript 跨窗口读 localStorage
ipcMain.handle('stats:get', () => {
  const growth  = petData.growth;
  const memory  = petData.memory;
  const firstDay = petData.firstDay || Date.now();
  return {
    xp:             growth.xp  || 0,
    level:          growth.level || 1,
    path:           growth.path  || null,
    consecutiveDays: memory.consecutiveDays || 0,
    companionDays:  Math.floor((Date.now() - firstDay) / 86400000),
  };
});

// ===== 统一 Store IPC =====
ipcMain.handle('store:load', () => petData);

ipcMain.handle('store:set', (_, key, value) => {
  petData[key] = value;
  saveData();
});

ipcMain.handle('store:batch', (_, updates) => {
  Object.assign(petData, updates);
  saveData();
});

// 监听 renderer 发来的状态同步
ipcMain.on('menu-state:sync', (_event, state) => {
  if (state.dancing !== undefined) menuState.dancing = state.dancing;
  if (state.following !== undefined) menuState.following = state.following;
  if (state.sleeping !== undefined) menuState.sleeping = state.sleeping;
});

ipcMain.handle('context-menu:show', (event) => {
  const pets = listPets();
  const petSubmenu = pets.map((pet) => ({
    label: pet.displayName,
    click: () => { mainWindow.webContents.send('menu-action', `switch-pet:${pet.id}`); }
  }));
  petSubmenu.push({ type: 'separator' });
  petSubmenu.push({ label: '导入素材...', click: () => { mainWindow.webContents.send('menu-action', 'import'); } });

  const template = [
    { label: '抚摸一下', click: () => { mainWindow.webContents.send('action:pet'); } },
    { label: '鞭打！', click: () => { mainWindow.webContents.send('action:whip'); } },
    { type: 'separator' },
    { label: '跳个舞', type: 'checkbox', checked: menuState.dancing, click: (item) => { mainWindow.webContents.send('action:dance', item.checked); } },
    { label: '跟随鼠标', type: 'checkbox', checked: menuState.following, click: (item) => { mainWindow.webContents.send('action:follow', item.checked); } },
    { label: '睡觉', type: 'checkbox', checked: menuState.sleeping, click: (item) => { mainWindow.webContents.send('action:sleep', item.checked); } },
    { type: 'separator' },
    { label: '✨ 分身术！', click: () => { triggerCloneEffect(); } },
    { label: '🏔️ 法天象地！', click: () => { triggerGiantEffect(); } },
    { type: 'separator' },
    {
      label: '👗 换装',
      submenu: [
        {
          label: '帽子',
          submenu: [
            { label: '❌ 无', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'none'); } },
            { label: '🎀 蝴蝶结', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'ribbon'); } },
            { label: '👑 花冠', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'crown'); } },
            { label: '🐱 猫耳', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'catears'); } },
            { label: '🎅 圣诞帽', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'santa'); } },
            { label: '😇 光环', click: () => { mainWindow.webContents.send('outfit:change', 'hat', 'halo'); } },
          ]
        },
        {
          label: '配饰',
          submenu: [
            { label: '❌ 无', click: () => { mainWindow.webContents.send('outfit:change', 'accessory', 'none'); } },
            { label: '🧣 围巾', click: () => { mainWindow.webContents.send('outfit:change', 'accessory', 'scarf'); } },
            { label: '👓 眼镜', click: () => { mainWindow.webContents.send('outfit:change', 'accessory', 'glasses'); } },
            { label: '🪽 翅膀', click: () => { mainWindow.webContents.send('outfit:change', 'accessory', 'wings'); } },
            { label: '🎀 领结', click: () => { mainWindow.webContents.send('outfit:change', 'accessory', 'bow'); } },
          ]
        },
        {
          label: '表情',
          submenu: [
            { label: '❌ 默认', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'none'); } },
            { label: '😊 开心', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'happy'); } },
            { label: '😳 害羞', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'shy'); } },
            { label: '🤩 星星眼', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'sparkle'); } },
            { label: '😍 爱心眼', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'heart'); } },
            { label: '😴 困困', click: () => { mainWindow.webContents.send('outfit:change', 'face', 'sleepy'); } },
          ]
        },
        { type: 'separator' },
        { label: '🔄 随机搭配', click: () => { mainWindow.webContents.send('outfit:random'); } },
        { label: '🚫 全部卸下', click: () => { mainWindow.webContents.send('outfit:reset'); } },
      ]
    },
    { type: 'separator' },
    { label: '切换宠物', submenu: petSubmenu },
    { type: 'separator' },
    { label: '设置', click: () => openSettings() },
    { label: '退出', click: () => { app.quit(); } }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.handle('mouse:getPosition', () => {
  return screen.getCursorScreenPoint();
});

// ===== 攀爬功能 IPC =====
ipcMain.handle('pet:setPosition', (_event, pos) => {
  mainWindow.setBounds({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: APP_WIDTH,
    height: APP_HEIGHT
  }, false);
  return mainWindow.getBounds();
});

ipcMain.handle('pet:getPosition', () => {
  return mainWindow.getBounds();
});

ipcMain.handle('windows:scan', () => {
  const now = Date.now();
  if (windowScanCache && (now - windowScanCacheTime) < WINDOW_SCAN_CACHE_TTL) {
    return windowScanCache;
  }

  // macOS 权限检查
  let hasAccessibility = true;
  if (process.platform === 'darwin') {
    try {
      hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
    } catch {
      hasAccessibility = false;
    }
  }

  const selfBounds = mainWindow.getBounds();
  let windows = null;

  // 优先尝试 node-window-manager
  if (hasAccessibility) {
    windows = scanWindowsViaNodeWM(selfBounds);
  }

  // 降级到 macOS 原生 API
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
});

ipcMain.handle('weather:get', async () => {
  // 通过 IP 获取地理位置
  let latitude, longitude, placeName;
  try {
    const ipResponse = await fetch('http://ip-api.com/json/?fields=status,city,regionName,lat,lon&lang=zh-CN');
    if (!ipResponse.ok) throw new Error(`IP locate failed: ${ipResponse.status}`);
    const ipData = await ipResponse.json();
    if (ipData.status !== 'success') throw new Error('IP locate returned failure');
    latitude = ipData.lat;
    longitude = ipData.lon;
    placeName = `${ipData.city}${ipData.regionName ? `, ${ipData.regionName}` : ''}`;
  } catch {
    return { ok: false, error: '无法定位当前位置。' };
  }
  // 获取天气（含未来24小时预报）
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weathercode,windspeed_10m&forecast_days=2&timezone=auto`;
  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    return { ok: false, error: '天气服务不可用。' };
  }
  const weather = await weatherResponse.json();

  // 解析未来6小时预报数据
  let tempDrop = false;
  let rainComing = false;
  let windWarning = false;
  let minTemp6h = null;
  let maxTemp6h = null;
  let forecast = [];

  if (weather.hourly && weather.hourly.time) {
    const nowISO = new Date().toISOString();
    const hourlyTimes = weather.hourly.time;
    // 找到当前时间之后的索引
    let startIdx = 0;
    for (let i = 0; i < hourlyTimes.length; i++) {
      if (hourlyTimes[i] >= nowISO.slice(0, 16)) {
        startIdx = i;
        break;
      }
    }
    // 取未来6小时数据
    const endIdx = Math.min(startIdx + 6, hourlyTimes.length);
    const temps6h = weather.hourly.temperature_2m.slice(startIdx, endIdx);
    const codes6h = (weather.hourly.weathercode || []).slice(startIdx, endIdx);
    const winds6h = (weather.hourly.windspeed_10m || []).slice(startIdx, endIdx);

    forecast = temps6h;
    if (temps6h.length > 0) {
      minTemp6h = Math.min(...temps6h);
      maxTemp6h = Math.max(...temps6h);
      const currentTemp = weather.current.temperature_2m;
      tempDrop = (currentTemp - minTemp6h) > 5;
    }
    // 下雨检测 (code 51-67, 80-82)
    rainComing = codes6h.some(code => (code >= 51 && code <= 67) || (code >= 80 && code <= 82));
    // 大风检测 (>40km/h)
    windWarning = winds6h.some(speed => speed > 40);
  }

  return {
    ok: true,
    place: placeName,
    current: weather.current,
    forecast,
    tempDrop,
    rainComing,
    windWarning,
    minTemp6h,
    maxTemp6h
  };
});

// ===== 满屏飘落特效窗口 =====
ipcMain.handle('effect:fullscreen', async (_event, type) => {
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
      contextIsolation: true
    }
  });
  effectWin.setIgnoreMouseEvents(true);
  effectWin.setAlwaysOnTop(true, 'screen-saver');
  effectWin.loadFile(path.join(__dirname, 'effect.html'), { query: { type } });
  // 6秒后自动关闭
  setTimeout(() => {
    if (!effectWin.isDestroyed()) effectWin.close();
  }, 6000);
});

// ===== 分身术特效窗口 =====
function triggerCloneEffect() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const cloneWin = new BrowserWindow({
    width, height,
    x: 0, y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  cloneWin.setIgnoreMouseEvents(true);
  cloneWin.setAlwaysOnTop(true, 'screen-saver');
  cloneWin.loadFile(path.join(__dirname, 'clone-effect.html'));

  const spritePath = activeSpritesheetPath || path.join(userPetsDir(), 'xiao-hong', 'spritesheet.webp');
  const spriteUrl = 'file://' + spritePath.replaceAll('\\', '/');
  cloneWin.webContents.once('did-finish-load', () => {
    cloneWin.webContents.executeJavaScript(`startCloneEffect(${JSON.stringify(spriteUrl)});`);
  });

  // 7秒保险关闭
  setTimeout(() => {
    if (!cloneWin.isDestroyed()) cloneWin.close();
  }, 7000);
}

function triggerGiantEffect() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;

  const giantWin = new BrowserWindow({
    x: 0, y: 0,
    width, height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  giantWin.setIgnoreMouseEvents(true);
  giantWin.setAlwaysOnTop(true, 'screen-saver');
  giantWin.loadFile(path.join(__dirname, 'giant-effect.html'));

  const mainBounds = mainWindow.getBounds();
  // 角色视觉中心在窗口内的实际偏移量：
  // canvas 在窗口 bottom:10px，高130px → canvas顶部 = 260-10-130 = 120
  // canvas 内绘制：DRAW_SCALE=0.75，drawH=97.5，offsetY=32.5，角色中心=81.25
  // 所以角色中心 Y = 120 + 81.25 ≈ 201，X = window.width/2 = 100
  const charCenterX = mainBounds.x + 100;
  const charCenterY = mainBounds.y + 201;
  const giantSpritePath = activeSpritesheetPath || path.join(userPetsDir(), 'xiao-hong', 'spritesheet.webp');
  const giantSpriteUrl = 'file://' + giantSpritePath.replaceAll('\\', '/');
  giantWin.webContents.once('did-finish-load', () => {
    giantWin.webContents.executeJavaScript(`
      window.petPosition = { x: ${mainBounds.x}, y: ${mainBounds.y} };
      window.petSize = { w: ${mainBounds.width}, h: ${mainBounds.height} };
      window.petCharCenter = { x: ${charCenterX}, y: ${charCenterY} };
      window.spritesheetSrc = ${JSON.stringify(giantSpriteUrl)};
      startGiantEffect();
    `);
  });

  setTimeout(() => {
    if (!giantWin.isDestroyed()) giantWin.close();
  }, 6500);
}

ipcMain.handle('effect:clone', () => {
  triggerCloneEffect();
});

// ===== 法天象地巨大化特效窗口 =====
ipcMain.handle('effect:giant', () => {
  triggerGiantEffect();
});

// ===== 前台窗口检测（WPS工作陪伴） =====
let lastActiveAppIsWPS = false;

function checkActiveWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    let title = '';
    // 优先使用 node-window-manager 获取活跃窗口
    if (windowManager && windowManager.windowManager) {
      try {
        const activeWin = windowManager.windowManager.getActiveWindow();
        if (activeWin) {
          title = activeWin.getTitle() || '';
        }
      } catch {
        // getActiveWindow 不可用，降级
      }
    }
    // 降级方案：macOS AppleScript 获取前台应用名
    if (!title && process.platform === 'darwin') {
      try {
        title = execSync(
          `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();
      } catch {
        // 获取失败，忽略
      }
    }
    const isWPS = /wps/i.test(title);
    mainWindow.webContents.send('active-app-changed', { isWPS, title });
    lastActiveAppIsWPS = isWPS;
  } catch {
    // 容错：检测失败不影响主流程
  }
}

// 每30秒检测一次前台窗口
setInterval(checkActiveWindow, 30000);
// 启动后延迟5秒执行一次初始检测
setTimeout(checkActiveWindow, 5000);

// ===== 繁忙检测系统 =====
// 通过 powerMonitor.getSystemIdleTime() 检测用户是否持续工作
let busyContinuousMinutes = 0;
let lastBusyReminderTime = 0;
const BUSY_CHECK_INTERVAL = 60000; // 每60秒检查一次
const BUSY_THRESHOLD_MINUTES = 60; // 连续工作60分钟触发
const BUSY_IDLE_THRESHOLD = 30; // 空闲时间<30秒视为忙碌
const BUSY_REMINDER_COOLDOWN = 1800000; // 30分钟冷却

setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const idleSeconds = powerMonitor.getSystemIdleTime();
  if (idleSeconds < BUSY_IDLE_THRESHOLD) {
    busyContinuousMinutes++;
  } else {
    // 空闲超过30秒，重置计数
    busyContinuousMinutes = 0;
  }

  // 连续忙碌超过阈值，且冷却已过
  if (busyContinuousMinutes >= BUSY_THRESHOLD_MINUTES) {
    const now = Date.now();
    if (now - lastBusyReminderTime > BUSY_REMINDER_COOLDOWN) {
      lastBusyReminderTime = now;
      busyContinuousMinutes = 0; // 提醒后重置
      mainWindow.webContents.send('system:busy-reminder');
    }
  }
}, BUSY_CHECK_INTERVAL);
