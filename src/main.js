const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, screen, nativeImage, systemPreferences, powerMonitor } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

// ===== 统一文件 Store =====
const dataPath = path.join(app.getPath('userData'), 'yoyo-data.json');
const debugLogDir = path.join(app.getPath('userData'), 'logs');
const debugLogPath = path.join(debugLogDir, 'yoyo-debug.jsonl');

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/u);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();

const DEEPSEEK_API_URL = process.env.YOYO_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.YOYO_DEEPSEEK_MODEL || 'deepseek-v4-flash';

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

function notifyManualEffect(type, duration) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('effect:manual', { type, duration });
  }
}

function sanitizeAiLine(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .slice(0, 48);
}

async function generateYoyoLine(payload = {}) {
  if (!petData.settings.aiLinesEnabled) return { ok: false, skipped: true, reason: 'disabled' };
  const apiKey = process.env.YOYO_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, reason: 'missing_key' };

  const behavior = String(payload.behavior || 'idle').slice(0, 40);
  const mood = String(payload.mood || 'neutral').slice(0, 40);
  const context = String(payload.context || '').slice(0, 120);
  const fallback = sanitizeAiLine(payload.fallback || '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是桌面宠物 Yoyo，一个4-5岁小女孩。只输出一句中文短台词，称呼用户为妈妈，语气自然撒娇但不要啰嗦，不要解释，不要加引号。',
          },
          {
            role: 'user',
            content: `行为:${behavior}\n心情:${mood}\n上下文:${context}\n参考台词:${fallback}\n请改写成一句不超过28个中文字符的台词。`,
          },
        ],
        temperature: 0.8,
        max_tokens: 60,
      }),
    });
    if (!response.ok) return { ok: false, error: `deepseek_http_${response.status}` };
    const data = await response.json();
    const line = sanitizeAiLine(data?.choices?.[0]?.message?.content);
    if (!line) return { ok: false, error: 'empty_line' };
    return { ok: true, line };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timeout);
  }
}

const DEFAULT_DATA = {
  settings: {
    autoStart: true, soundEnabled: true, reminderFreq: 'medium',
    activity: 'normal', workStartHour: 9, workEndHour: 18,
    aiLinesEnabled: true,
    workMode: 'balanced',
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
    preference: {
      behaviorWeights: {}, quietHours: [], interactionTolerance: 'normal',
      lastFeedbackAt: null, recentFeedback: [], lastDecayDate: null,
    },
  },
  relationship: {
    intimacy: 0, trust: 60, longing: 0, stage: 'first_meet',
    firstMetDate: null, lastStageChangeDate: null, lastInteractionDate: null,
    nicknames: ['妈妈'], milestones: [],
  },
  companionPlan: null,
  dailyMemory: null,
  dailyCards: [],
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
  outfit:       { hair: 'none', hat: 'none', accessory: 'none', clothes: 'none', face: 'none' },
  news:         { lastFetchAt: 0, items: [] },
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

function normalizePlacePart(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[，,、]+/g, '')
    .replace(/市$/u, '')
    .replace(/区$/u, '')
    .replace(/县$/u, '');
}

function formatPlaceName(city, regionName) {
  const rawCity = String(city || '').trim();
  const rawRegion = String(regionName || '').trim();
  const cityNorm = normalizePlacePart(rawCity);
  const regionNorm = normalizePlacePart(rawRegion);

  if (!rawCity && !rawRegion) return '本地天气';
  if (!rawRegion) return rawCity || rawRegion;
  if (!rawCity) return rawRegion;
  if (cityNorm && regionNorm && (cityNorm === regionNorm || regionNorm.includes(cityNorm) || cityNorm.includes(regionNorm))) {
    return rawCity;
  }
  return `${rawCity} ${rawRegion}`;
}

const NEWS_FEEDS = [
  {
    name: '微博热搜',
    type: 'weibo-hot',
    url: 'https://weibo.com/ajax/side/hotSearch',
  },
  {
    name: 'Google News',
    type: 'rss',
    url: 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
  },
  {
    name: 'BBC 中文',
    type: 'rss',
    url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
  },
];
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstXmlValue(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  return match ? stripHtml(match[1]) : '';
}

function parseRssItems(xml, sourceName) {
  return Array.from(String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi))
    .map((match) => {
      const block = match[0];
      const title = firstXmlValue(block, 'title');
      const link = firstXmlValue(block, 'link');
      const pubDate = firstXmlValue(block, 'pubDate');
      return title ? { title, link, pubDate, source: sourceName } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeHotTopicTitle(value) {
  return stripHtml(value)
    .replace(/^#+|#+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWeiboHotItems(payload) {
  const list = Array.isArray(payload?.data?.realtime) ? payload.data.realtime : [];
  return list
    .map((item, index) => {
      const title = normalizeHotTopicTitle(item.word_scheme || item.word || item.note || item.name);
      if (!title) return null;
      return {
        title,
        rank: Number(item.rank || item.realpos || index + 1),
        hot: Number(item.num || item.raw_hot || 0),
        tag: item.icon_desc || item.small_icon_desc || '',
        source: '微博热搜',
        kind: 'hot-search',
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

async function fetchDailyNews(force = false) {
  const now = Date.now();
  const cached = petData.news?.items;
  if (!force && Array.isArray(cached) && cached.length && petData.news?.source === '微博热搜' && now - (petData.news.lastFetchAt || 0) < NEWS_CACHE_TTL_MS) {
    return { ok: true, items: cached, cached: true, source: petData.news.source };
  }

  const errors = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const headers = {
        'User-Agent': feed.type === 'weibo-hot' ? 'Mozilla/5.0 Yoyo hot-search' : `Yoyo/${app.getVersion()} daily-news`,
      };
      if (feed.type === 'weibo-hot') headers.Referer = 'https://weibo.com/';
      const response = await fetch(feed.url, {
        headers,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const items = feed.type === 'weibo-hot'
        ? parseWeiboHotItems(await response.json())
        : parseRssItems(await response.text(), feed.name);
      if (!items.length) throw new Error('empty feed');
      petData.news = { lastFetchAt: now, items, source: feed.name };
      saveData();
      appendDebugLog('news_fetch', { ok: true, source: feed.name, count: items.length });
      return { ok: true, items, cached: false, source: feed.name };
    } catch (error) {
      errors.push(`${feed.name}: ${error.message}`);
    }
  }

  appendDebugLog('news_fetch', { ok: false, errors });
  if (Array.isArray(cached) && cached.length) {
    return { ok: true, items: cached, cached: true, stale: true, source: petData.news?.source || '' };
  }
  return { ok: false, error: '新闻服务暂时不可用。' };
}

// ===== 窗口扫描模块 =====
let windowManager = null;
try {
  windowManager = require('node-window-manager');
} catch {
  // node-window-manager 不可用，将使用 macOS 原生 API 降级
}

// ===== 全局键盘监听（uiohook-napi） =====
// 默认关闭；在部分 macOS/Electron 组合上，原生钩子可能触发主进程 fatal error。
// 需要时通过 YOYO_ENABLE_UIOHOOK=1 显式开启。
function initGlobalKeyboardHook() {
  if (process.env.YOYO_ENABLE_UIOHOOK !== '1') {
    console.log('[uiohook] 默认关闭；如需启用请设置 YOYO_ENABLE_UIOHOOK=1');
    return;
  }
  try {
    const { uIOhook } = require('uiohook-napi');
    let lastKeyTime = 0;
    uIOhook.on('keydown', () => {
      const now = Date.now();
      if (now - lastKeyTime < 500) return; // 节流 500ms
      lastKeyTime = now;
      if (mainWindow && !mainWindow.isDestroyed()) {
        appendDebugLog('keyboard_activity', { source: 'uiohook' });
        mainWindow.webContents.send('keyboard:activity');
      }
    });
    uIOhook.start();
    appendDebugLog('keyboard_hook_started', { enabled: true });
  } catch (e) {
    console.log('[uiohook] 不可用，键盘响应功能禁用:', e.message);
    appendDebugLog('keyboard_hook_failed', { message: e.message });
  }
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

const BEHAVIOR_DEBUG_ENABLED = process.env.YOYO_BEHAVIOR_DEBUG === '1';
const APP_WIDTH = BEHAVIOR_DEBUG_ENABLED ? 560 : 200;
const APP_HEIGHT = BEHAVIOR_DEBUG_ENABLED ? 360 : 260;

if (BEHAVIOR_DEBUG_ENABLED) {
  appendDebugLog('session_start', {
    pid: process.pid,
    version: app.getVersion(),
  });
}

let mainWindow;
let tray;

function userPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
}

function bundledPetsDir() {
  return path.join(__dirname, '..', 'assets');
}

function copyDirectoryContents(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(source, dest);
      continue;
    }
    if (!fs.existsSync(source)) continue;
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(source, dest);
    } else {
      const srcStat = fs.statSync(source);
      const dstStat = fs.statSync(dest);
      if (srcStat.size !== dstStat.size) {
        fs.copyFileSync(source, dest);
      }
    }
  }
}

function ensureBundledPets() {
  const assetsDir = bundledPetsDir();
  fs.mkdirSync(userPetsDir(), { recursive: true });
  if (!fs.existsSync(assetsDir)) return;
  for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceDir = path.join(assetsDir, entry.name);
    if (!fs.existsSync(path.join(sourceDir, 'pet.json'))) continue;
    copyDirectoryContents(sourceDir, path.join(userPetsDir(), entry.name));
  }
}

function readPet(dir) {
  const manifestPath = path.join(dir, 'pet.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const asset = manifest.asset || {};
  const spritesheetFile = manifest.spritesheetPath || asset.spritesheetPath || 'spritesheet.webp';
  const spritesheetPath = path.join(dir, spritesheetFile);
  return {
    id: manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.name || path.basename(dir),
    description: manifest.description || '',
    spritesheetPath,
    manifestPath,
    asset: {
      ...asset,
      spritesheetPath: spritesheetFile,
    },
    states: manifest.states || undefined,
    layers: manifest.layers || undefined,
    render: manifest.render || undefined,
    capabilities: manifest.capabilities || undefined,
  };
}

function isRunnablePetDir(dir) {
  if (!fs.existsSync(path.join(dir, 'pet.json'))) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pet.json'), 'utf8'));
    const asset = manifest.asset || {};
    const spritesheetFile = manifest.spritesheetPath || asset.spritesheetPath || 'spritesheet.webp';
    return fs.existsSync(path.join(dir, spritesheetFile));
  } catch {
    return false;
  }
}

function listPets() {
  ensureBundledPets();
  return fs.readdirSync(userPetsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(userPetsDir(), entry.name))
    .filter(isRunnablePetDir)
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

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appendDebugLog('render_process_gone', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    appendDebugLog('renderer_unresponsive', {});
  });
  mainWindow.on('closed', () => {
    appendDebugLog('window_closed', {});
  });
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

const OUTFIT_DEFAULTS_FOR_EFFECTS = { hair: 'none', hat: 'none', accessory: 'none', clothes: 'none', face: 'none' };
const EFFECT_FACE_SPRITESHEETS = {
  none: 'spritesheet.webp',
  happy: 'spritesheet_face_happy.webp',
  shy: 'spritesheet_face_shy.webp',
  sparkle: 'spritesheet_face_sparkle.webp',
  heart: 'spritesheet_face_heart.webp',
  sleepy: 'spritesheet_face_sleepy.webp',
};
const EFFECT_LAYER_SPRITESHEETS = {
  hair: {
    flower: 'spritesheet_hair_flower.webp',
    starclip: 'spritesheet_hair_starclip.webp',
    pearlpin: 'spritesheet_hair_pearlpin.webp',
  },
  hat: {
    ribbon: 'spritesheet_hat_ribbon.webp',
    crown: 'spritesheet_hat_crown.webp',
    catears: 'spritesheet_hat_catears.webp',
    santa: 'spritesheet_hat_santa.webp',
    halo: 'spritesheet_hat_halo.webp',
  },
  accessory: {
    bow: 'spritesheet_accessory_bow.webp',
    scarf: 'spritesheet_accessory_scarf.webp',
    wings: 'spritesheet_accessory_wings.webp',
    butterfly_wings: 'spritesheet_accessory_butterfly_wings.webp',
    devil_wings: 'spritesheet_accessory_devil_wings.webp',
    jetpack: 'spritesheet_accessory_jetpack.webp',
    star_backpack: 'spritesheet_accessory_star_backpack.webp',
  },
  clothes: {
    hoodie: 'spritesheet_clothes_hoodie.webp',
    dress: 'spritesheet_clothes_dress.webp',
    cape: 'spritesheet_clothes_cape.webp',
    sweater: 'spritesheet_clothes_sweater.webp',
    party: 'spritesheet_party.webp',
    angel: 'spritesheet_angel.webp',
  },
};
const EFFECT_BEHIND_LAYER_SPRITESHEETS = {
  accessory: {
    wings: 'spritesheet_accessory_wings.webp',
    butterfly_wings: 'spritesheet_accessory_butterfly_wings.webp',
    devil_wings: 'spritesheet_accessory_devil_wings.webp',
    jetpack: 'spritesheet_accessory_jetpack.webp',
    star_backpack: 'spritesheet_accessory_star_backpack.webp',
  },
  clothes: {
    party: 'spritesheet_party_behind.webp',
    angel: 'spritesheet_angel_behind.webp',
  },
};
const EFFECT_LAYER_DRAW_ORDER = [
  { category: 'accessory', position: 'behind' },
  { category: 'clothes', position: 'behind' },
  { category: 'clothes', position: 'front' },
  { category: 'accessory', position: 'front' },
  { category: 'hat', position: 'front' },
  { category: 'hair', position: 'front' },
];

function toFileUrl(filePath) {
  return 'file://' + filePath.replaceAll('\\', '/');
}

function defaultSpritesheetPath() {
  return path.join(userPetsDir(), 'yoyo', 'spritesheet.webp');
}

function getActiveSpritesheetPath() {
  return activeSpritesheetPath || defaultSpritesheetPath();
}

function getActiveEffectLayers() {
  const outfit = { ...OUTFIT_DEFAULTS_FOR_EFFECTS, ...(petData.outfit || {}) };
  const baseDir = path.dirname(getActiveSpritesheetPath());
  const layers = [];
  for (const entry of EFFECT_LAYER_DRAW_ORDER) {
    const itemId = outfit[entry.category];
    if (!itemId || itemId === 'none') continue;
    const file = entry.position === 'behind'
      ? EFFECT_BEHIND_LAYER_SPRITESHEETS[entry.category]?.[itemId]
      : EFFECT_LAYER_SPRITESHEETS[entry.category]?.[itemId];
    if (!file) continue;
    const layerPath = path.join(baseDir, file);
    layers.push({ position: entry.position, src: toFileUrl(layerPath) });
  }
  return layers;
}

function getEffectFaceSources() {
  const baseDir = path.dirname(getActiveSpritesheetPath());
  return Object.entries(EFFECT_FACE_SPRITESHEETS).map(([id, file]) => ({
    id,
    src: toFileUrl(path.join(baseDir, file)),
  }));
}

// ===== 窗口关闭行为：隐藏到托盘 =====
app.isQuitting = false;

app.on('before-quit', () => {
  app.isQuitting = true;
  appendDebugLog('before_quit', {});
});

app.whenReady().then(() => {
  loadData();  // 从文件加载持久化数据
  ensureBundledPets();
  // 初始化默认 spritesheet 路径
  activeSpritesheetPath = path.join(userPetsDir(), 'yoyo', 'spritesheet.webp');
  createWindow();
  createTray();
  initGlobalKeyboardHook();
  if (process.env.YOYO_TEST_GIANT === '1') {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) triggerGiantEffect();
    }, 2500);
  }
  if (process.env.YOYO_TEST_CLONE === '1') {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) triggerCloneEffect();
    }, 2500);
  }
  if (process.env.YOYO_TEST_KEYBOARD === '1') {
    let sent = 0;
    const timer = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed() || sent >= 5) {
        clearInterval(timer);
        return;
      }
      sent += 1;
      appendDebugLog('keyboard_activity', { source: 'test', sent });
      mainWindow.webContents.send('keyboard:activity');
    }, 700);
  }

  // 开机自启（默认开启）
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });

  // 关闭按钮隐藏到托盘而非退出
  mainWindow.on('close', (event) => {
    appendDebugLog('window_close_requested', { isQuitting: app.isQuitting });
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      appendDebugLog('window_hidden_to_tray', {});
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
  appendDebugLog('window_all_closed', {});
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
  copyDirectoryContents(sourceDir, targetDir);
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

ipcMain.handle('preferences:reset-behavior', () => {
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
    relationship: petData.relationship || null,
    dailyMemory: petData.dailyMemory || null,
    dailyCards: petData.dailyCards || [],
    companionPlan: petData.companionPlan || null,
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

ipcMain.handle('debug:behavior-enabled', () => BEHAVIOR_DEBUG_ENABLED);
ipcMain.handle('debug:log-path', () => debugLogPath);
ipcMain.on('debug:log', (_event, type, payload) => appendDebugLog(type, payload));
ipcMain.handle('news:get', async (_event, options = {}) => fetchDailyNews(Boolean(options.force)));
ipcMain.handle('ai:status', () => ({
  enabled: Boolean(petData.settings.aiLinesEnabled),
  configured: Boolean(process.env.YOYO_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY),
  model: DEEPSEEK_MODEL,
}));
ipcMain.handle('ai:yoyo-line', (_event, payload) => generateYoyoLine(payload));

// 监听 renderer 发来的状态同步
ipcMain.on('menu-state:sync', (_event, state) => {
  if (state.dancing !== undefined) menuState.dancing = state.dancing;
  if (state.following !== undefined) menuState.following = state.following;
  if (state.sleeping !== undefined) menuState.sleeping = state.sleeping;
});

ipcMain.handle('context-menu:show', (event) => {
  const pets = listPets();
  const currentFormId = petData.currentFormId || petData.currentPetId || pets[0]?.id || 'yoyo';
  const petSubmenu = pets.map((pet) => ({
    label: pet.displayName,
    click: () => { mainWindow.webContents.send('menu-action', `switch-form:${pet.id}`); }
  }));
  petSubmenu.push({ type: 'separator' });
  petSubmenu.push({ label: '导入新角色或形态...', click: () => { mainWindow.webContents.send('menu-action', 'import'); } });

  const currentForm = pets.find((pet) => pet.id === currentFormId) || pets[0];
  const currentCapabilities = currentForm?.capabilities || {};
  const outfitSupported = currentCapabilities.outfit !== false && currentForm?.id !== 'gugu-gaga';
  const appearanceMenuByPet = !outfitSupported
    ? {
        label: '🎀 角色外观',
        submenu: [
          { label: '这个形态暂时没有专属外观', enabled: false },
        ]
      }
    : {
        label: '🎀 角色外观',
        submenu: [
          { label: '🎲 随机换个样子', click: () => { mainWindow.webContents.send('outfit:random'); } },
          { label: '🌸 日常套装', click: () => { mainWindow.webContents.send('outfit:preset', 'daily'); } },
          { label: '🧶 温暖套装', click: () => { mainWindow.webContents.send('outfit:preset', 'warm'); } },
          { label: '🦸 小披风套装', click: () => { mainWindow.webContents.send('outfit:preset', 'cape'); } },
          { label: '🎄 节日套装', click: () => { mainWindow.webContents.send('outfit:preset', 'holiday'); } },
          { label: '✨ 开心庆祝装', click: () => { mainWindow.webContents.send('outfit:preset', 'celebration'); } },
          { type: 'separator' },
          { label: '🌿 恢复默认', click: () => { mainWindow.webContents.send('outfit:reset'); } },
        ]
      };

  const workMode = petData.settings.workMode || 'balanced';
  const workModeMenu = {
    label: '🧭 工作节奏',
    submenu: [
      { label: `${workMode === 'focus' ? '✓ ' : ''}专注中`, click: () => { mainWindow.webContents.send('menu-action', 'work-mode:focus'); } },
      { label: `${workMode === 'balanced' ? '✓ ' : ''}轻松工作`, click: () => { mainWindow.webContents.send('menu-action', 'work-mode:balanced'); } },
      { label: `${workMode === 'overtime' ? '✓ ' : ''}加班中`, click: () => { mainWindow.webContents.send('menu-action', 'work-mode:overtime'); } },
      { label: `${workMode === 'wrapup' ? '✓ ' : ''}准备收工`, click: () => { mainWindow.webContents.send('menu-action', 'work-mode:wrapup'); } },
      { type: 'separator' },
      { label: '🫗 现在提醒我休息', click: () => { mainWindow.webContents.send('menu-action', 'manual-break'); } },
      { label: '🌙 今天辛苦了', click: () => { mainWindow.webContents.send('menu-action', 'end-of-day'); } },
    ]
  };

  const template = [
    {
      label: '💛 陪我一下',
      submenu: [
        { label: '摸摸 Yoyo', click: () => { mainWindow.webContents.send('action:pet'); } },
        { label: menuState.following ? '别跟着我啦' : '让她跟着我', type: 'checkbox', checked: menuState.following, click: (item) => { mainWindow.webContents.send('action:follow', item.checked); } },
        { label: menuState.sleeping ? '叫醒 Yoyo' : '让她休息一下', type: 'checkbox', checked: menuState.sleeping, click: (item) => { mainWindow.webContents.send('action:sleep', item.checked); } },
      ]
    },
    { type: 'separator' },
    workModeMenu,
    appearanceMenuByPet,
    { type: 'separator' },
    {
      label: '小惊喜',
      submenu: [
        { label: '分身术', click: () => { triggerCloneEffect(); } },
        { label: '法天象地', click: () => { triggerGiantEffect(); } },
        { label: menuState.dancing ? '停下跳舞' : '让她跳会舞', type: 'checkbox', checked: menuState.dancing, click: (item) => { mainWindow.webContents.send('action:dance', item.checked); } },
      ]
    },
    {
      label: '管理 Yoyo',
      submenu: [
        { label: '设置与成长', click: () => openSettings() },
        { label: '切换形态', submenu: petSubmenu },
      ]
    },
    { type: 'separator' },
    {
      label: '其他',
      submenu: [
        { label: '鞭打 Yoyo', click: () => { mainWindow.webContents.send('action:whip'); } },
        { type: 'separator' },
        { label: '退出 Yoyo', click: () => { app.quit(); } },
      ]
    }
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
    placeName = formatPlaceName(ipData.city, ipData.regionName);
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
  const mainBounds = mainWindow.getBounds();
  const effectDisplay = screen.getDisplayMatching(mainBounds);
  const displayBounds = effectDisplay.bounds;
  const overlayBounds = effectDisplay.workArea;
  const { width, height } = overlayBounds;
  appendDebugLog('clone_effect_triggered', {
    mainBounds,
    displayBounds,
    overlayBounds,
  });
  notifyManualEffect('clone', 6200);
  const cloneWin = new BrowserWindow({
    width, height,
    x: overlayBounds.x, y: overlayBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  const enforcedBounds = { x: overlayBounds.x, y: overlayBounds.y, width, height };
  cloneWin.setBounds(enforcedBounds, false);
  cloneWin.setIgnoreMouseEvents(true);
  cloneWin.setAlwaysOnTop(true, 'screen-saver');
  cloneWin.webContents.on('console-message', (_event, level, message) => {
    appendDebugLog('clone_effect_console', { level, message });
  });
  cloneWin.webContents.on('render-process-gone', (_event, details) => {
    appendDebugLog('clone_effect_gone', details);
  });
  cloneWin.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendDebugLog('clone_effect_load_failed', { errorCode, errorDescription, validatedURL });
  });
  cloneWin.once('ready-to-show', () => {
    cloneWin.setBounds(enforcedBounds, false);
    appendDebugLog('clone_effect_ready_to_show', cloneWin.getBounds());
  });
  cloneWin.once('closed', () => {
    notifyManualEffect('clone', 0);
    appendDebugLog('clone_effect_closed', {});
  });
  cloneWin.loadFile(path.join(__dirname, 'clone-effect.html'));

  const spritePath = getActiveSpritesheetPath();
  const spriteUrl = toFileUrl(spritePath);
  const outfitLayerSources = getActiveEffectLayers();
  appendDebugLog('clone_effect_assets', {
    spritePath,
    outfitLayerCount: outfitLayerSources.length,
  });
  cloneWin.webContents.once('did-finish-load', () => {
    appendDebugLog('clone_effect_loaded', {});
    cloneWin.webContents.executeJavaScript(`startCloneEffect(${JSON.stringify(spriteUrl)}, ${JSON.stringify(outfitLayerSources)}, ${JSON.stringify({})});`)
      .then(() => {
        appendDebugLog('clone_effect_started', {});
      })
      .catch((error) => {
        appendDebugLog('clone_effect_start_failed', { message: error.message, stack: error.stack });
      });
  });

  // 7秒保险关闭
  setTimeout(() => {
    if (!cloneWin.isDestroyed()) cloneWin.close();
  }, 7000);
}

function triggerGiantEffect() {
  const mainBounds = mainWindow.getBounds();
  const effectDisplay = screen.getDisplayMatching(mainBounds);
  const displayBounds = effectDisplay.bounds;
  const overlayBounds = effectDisplay.workArea;
  const { width, height } = overlayBounds;
  appendDebugLog('giant_effect_triggered', {
    mainBounds,
    displayBounds,
    overlayBounds,
  });
  notifyManualEffect('giant', 9000);

  const giantWin = new BrowserWindow({
    x: overlayBounds.x, y: overlayBounds.y,
    width, height,
    useContentSize: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  const enforcedBounds = { x: overlayBounds.x, y: overlayBounds.y, width, height };
  giantWin.setBounds(enforcedBounds, false);
  appendDebugLog('giant_effect_bounds_enforced', {
    requested: enforcedBounds,
    actual: giantWin.getBounds(),
  });
  giantWin.setIgnoreMouseEvents(true);
  giantWin.setAlwaysOnTop(true, 'screen-saver');
  giantWin.webContents.on('console-message', (_event, level, message) => {
    appendDebugLog('giant_effect_console', { level, message });
  });
  giantWin.webContents.on('render-process-gone', (_event, details) => {
    appendDebugLog('giant_effect_gone', details);
  });
  giantWin.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendDebugLog('giant_effect_load_failed', { errorCode, errorDescription, validatedURL });
  });
  giantWin.once('ready-to-show', () => {
    giantWin.setBounds(enforcedBounds, false);
    appendDebugLog('giant_effect_ready_to_show', giantWin.getBounds());
  });
  giantWin.once('closed', () => {
    notifyManualEffect('giant', 0);
    appendDebugLog('giant_effect_closed', {});
  });
  giantWin.loadFile(path.join(__dirname, 'giant-effect.html'));

  // 角色视觉中心在窗口内的实际偏移量：
  // canvas 在窗口 bottom:10px，高130px → canvas顶部 = 260-10-130 = 120
  // canvas 内绘制：DRAW_SCALE=0.75，drawH=97.5，offsetY=32.5，角色中心=81.25
  // 所以角色中心 Y = 120 + 81.25 ≈ 201，X = window.width/2 = 100
  const charCenterX = mainBounds.x + 100;
  const charCenterY = mainBounds.y + 201;
  const sourceCenter = {
    x: charCenterX - overlayBounds.x,
    y: charCenterY - overlayBounds.y,
  };
  const arenaCenter = { x: overlayBounds.width / 2, y: overlayBounds.height / 2 };
  const giantSpritePath = getActiveSpritesheetPath();
  const giantSpriteUrl = toFileUrl(giantSpritePath);
  const outfitLayerSources = getActiveEffectLayers();
  appendDebugLog('giant_effect_assets', {
    giantSpritePath,
    outfitLayerCount: outfitLayerSources.length,
    sourceCenter,
    arenaCenter,
  });
  giantWin.webContents.once('did-finish-load', () => {
    appendDebugLog('giant_effect_loaded', {});
    giantWin.webContents.executeJavaScript(`
      window.petPosition = { x: ${mainBounds.x}, y: ${mainBounds.y} };
      window.petSize = { w: ${mainBounds.width}, h: ${mainBounds.height} };
      window.petCharCenter = { x: ${sourceCenter.x}, y: ${sourceCenter.y} };
      window.effectArenaCenter = { x: ${arenaCenter.x}, y: ${arenaCenter.y} };
      window.effectOverlayBounds = { x: ${overlayBounds.x}, y: ${overlayBounds.y}, width: ${overlayBounds.width}, height: ${overlayBounds.height} };
      window.spritesheetSrc = ${JSON.stringify(giantSpriteUrl)};
      window.outfitLayerSources = ${JSON.stringify(outfitLayerSources)};
      startGiantEffect();
    `).then(() => {
      appendDebugLog('giant_effect_started', {});
    }).catch((error) => {
      appendDebugLog('giant_effect_start_failed', { message: error.message, stack: error.stack });
    });
  });

  setTimeout(() => {
    if (!giantWin.isDestroyed()) giantWin.close();
  }, 8600);
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
