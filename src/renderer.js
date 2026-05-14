// renderer.js - 主入口：import 所有模块，初始化，启动
import { initStore, get, set, batch } from './modules/store-client.js';
import { state, globalTimers, say, setState, randomFrom, initCoreState } from './modules/core-state.js';
import { stateMachine } from './modules/state-machine.js';
import { updateEmotion } from './modules/emotion-system.js';
import { memoryOnStartup, memoryDrivenGreeting, initCheckinSystem, yoyoGrowth, addXP, trackFeatureUsed, initMemory, initGrowth } from './modules/growth-system.js';
import { startBehaviorEngine, behaviorEngineTick } from './modules/behavior-engine.js';
import { initInteraction, loadPets, resetInteraction } from './modules/interaction.js';
import { initClimbSystem } from './modules/climbing.js';
import { refreshWeatherContext } from './modules/weather-seasonal.js';
import { initTimers, checkGoodMorning, checkSpecialDate, checkCompanionMilestone } from './modules/timers.js';
import { initOutfitSystem } from './modules/outfit-system.js';
import { startRenderLoop } from './modules/render-engine.js';
import { startEntryAnimation } from './modules/startup-animation.js';
import { initBehaviorDebugPanel } from './modules/behavior-debug-panel.js';

// ===== 一次性 localStorage → Store 数据迁移 =====
function migrateFromLocalStorage() {
  if (get('_migrated')) return;

  const tryParse = (key, def = null) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; }
    catch { return def; }
  };

  const updates = {};
  const growth       = tryParse('yoyo_growth');
  const memory       = tryParse('yoyo_memory');
  const checkin      = tryParse('yoyo_checkin');
  const achievements = tryParse('yoyo_achievements');
  const dailyFlags   = tryParse('yoyo_daily_flags');
  const outfit       = tryParse('yoyo_outfit');
  const shownTips    = tryParse('yoyo_shown_tips');
  const usedFeatures = tryParse('yoyo_used_features');
  const firstDayRaw  = localStorage.getItem('yoyo_first_day');
  const lastGreet    = localStorage.getItem('yoyo_last_active_date');
  const hasGuide     = !!localStorage.getItem('hasSeenGuide');
  const muted        = localStorage.getItem('yoyo_muted') === 'true';

  if (growth)       updates.growth       = growth;
  if (memory)       updates.memory       = memory;
  if (checkin)      updates.checkin      = checkin;
  if (achievements) updates.achievements = achievements;
  if (dailyFlags)   updates.dailyFlags   = dailyFlags;
  if (outfit)       updates.outfit       = outfit;
  if (shownTips)    updates.shownTips    = shownTips;
  if (usedFeatures) updates.usedFeatures = usedFeatures;
  if (firstDayRaw)  updates.firstDay     = parseInt(firstDayRaw);
  if (lastGreet)    updates.lastGreetDate = lastGreet;
  if (hasGuide)     updates.hasSeenGuide = true;
  if (muted)        updates.muted        = true;

  updates._migrated = true;
  batch(updates);
}

// ===== 全局设置状态（IPC监听）=====
if (window.petApi && window.petApi.onSettingsChanged) {
  window.petApi.onSettingsChanged((settings) => {
    state.yoyoSettings = settings;
    state.isMuted = !settings.soundEnabled;
    set('muted', state.isMuted);
  });
}

if (window.petApi && window.petApi.onSettingsReset) {
  window.petApi.onSettingsReset(() => {
    // 主进程已重置文件 store，直接重载即可
    location.reload();
  });
}

// ===== 妈妈回来检测 =====
window.petApi.onSystemResume(() => {
  resetInteraction();
  setState('jumping');
  say('妈妈回来啦！Yoyo好想好想你！', 6000);
});

// ===== 前台应用状态（WPS工作陪伴） =====
if (window.petApi && window.petApi.onActiveAppChanged) {
  window.petApi.onActiveAppChanged((data) => {
    state.currentActiveApp = data;
  });
}

// ===== 繁忙提醒 =====
const BUSY_REMINDER_MESSAGES = [
  '妈妈已经忙了好久好久啦…休息一下好不好？',
  '妈妈～站起来动一动嘛！Yoyo担心你～',
  '妈妈别太累了！Yoyo好心疼好心疼…',
  '妈妈工作好认真呀！但是也要注意身体哦～',
  '妈妈！休息五分钟好不好？Yoyo陪你玩～',
  '妈妈眼睛会累的！看看远处嘛～绿绿的树！',
  '妈妈～喝口水站起来走走嘛～腿腿会麻的！',
];

window.petApi.onBusyReminder(() => {
  setState('review');
  trackFeatureUsed('busyReminder');
  if (state.currentActiveApp.isWPS) {
    const wpsOvertimeLines = [
      '妈妈备课好久啦…眼睛会累的，休息一下下嘛～',
      '妈妈在WPS里写了好久好久！Yoyo好心疼…',
      '妈妈已经在电脑前坐了好久啦…站起来动动嘛～',
      '妈妈辛苦啦！备课也要注意休息哦～Yoyo陪你！',
    ];
    say(randomFrom(wpsOvertimeLines), 8000);
  } else {
    say(randomFrom(BUSY_REMINDER_MESSAGES), 8000);
  }
});

if (window.petApi && window.petApi.onManualEffect) {
  window.petApi.onManualEffect((data = {}) => {
    const duration = Number(data.duration || 0);
    state.manualEffectUntil = duration > 0 ? Date.now() + duration : 0;
    state.lastInteractionTime = Date.now();
  });
}

// ===== 初始化 =====
async function init() {
  // 1. 先加载持久化数据到内存缓存
  await initStore();

  // 2. 一次性迁移旧 localStorage 数据（只在首次更新后执行）
  migrateFromLocalStorage();

  // 3. 用 store 数据初始化各模块内存
  initCoreState();
  initMemory();
  initGrowth();

  // 4. 用 store 中的设置覆盖运行时状态
  const settings = get('settings');
  if (settings) state.yoyoSettings = settings;

  // 5. 首次启动引导（改用 store 而非 localStorage）
  if (!get('hasSeenGuide')) {
    setTimeout(() => {
      say('妈妈好！右键点Yoyo可以一起玩哦～');
      set('hasSeenGuide', true);
    }, 3000);
  }

  // 初始化交互系统（注册事件监听）
  initInteraction();

  // 初始化攀爬系统（检测窗口扫描能力）
  initClimbSystem();

  // 初始化换装系统
  initOutfitSystem();

  // 加载宠物并启动天气
  await loadPets();
  refreshWeatherContext();

  // 启动记忆系统
  memoryOnStartup();

  // 启动时检测特殊日期和里程碑
  setTimeout(() => {
    checkGoodMorning();
    checkSpecialDate();
    checkCompanionMilestone();
  }, 4000);

  // 记忆驱动的问候
  setTimeout(() => {
    memoryDrivenGreeting();
  }, 6000);

  // 每日签到系统
  setTimeout(() => {
    initCheckinSystem();
  }, 8000);

  // 启动渲染循环
  startRenderLoop();

  // 启动入场动画（仅首次启动播放）
  startEntryAnimation();
  if (!sessionStorage.getItem('yoyo_entered')) {
    setTimeout(() => {
      say('Yoyo来啦～', 3000);
    }, 2000);
  }

  // 启动行为决策引擎
  startBehaviorEngine();

  // 开发调试面板（YOYO_BEHAVIOR_DEBUG=1 时启用）
  await initBehaviorDebugPanel();

  // 启动所有定时器
  initTimers();
}

init().catch(err => console.error('Yoyo init failed:', err));

// ===== 全局定时器清理 =====
window.addEventListener('beforeunload', () => {
  globalTimers.forEach(id => clearInterval(id));
});
