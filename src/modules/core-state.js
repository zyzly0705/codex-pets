// core-state.js - 共享状态、常量、DOM 引用、宠物助手、冷却、每日标记
// 工具函数 → utils.js，音频 → audio.js，气泡队列 → speech-queue.js
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { get, set } from './store-client.js';

// ===== DOM 引用 =====
export const canvas = document.getElementById('petCanvas');
export const ctx = canvas ? canvas.getContext('2d') : null;
export const bubble = document.getElementById('bubble');
export const bubbleText = bubble ? bubble.querySelector('.bubble-text') : null;
export const bubbleAvatar = bubble ? bubble.querySelector('.bubble-avatar') : null;
export const careCue = document.getElementById('care-cue');
export const feedBtn = document.getElementById('feed-btn');

// ===== 默认素材常量 =====
// 新素材应在 pet.json 的 asset/states 中声明；这里保留为内置 Yoyo 和旧宠物包的安全默认值。
export const CELL_W = 192;
export const CELL_H = 208;

export const STATES = {
  idle: { row: 0, frames: 8, fps: 4, loop: 'pingpong' },
  runningRight: { row: 1, frames: 8, fps: 12 },
  runningLeft: { row: 2, frames: 8, fps: 12 },
  waving: { row: 3, frames: 4, fps: 4, loop: 'pingpong' },
  jumping: { row: 4, frames: 5, fps: 7, loop: 'pingpong' },
  failed: { row: 5, frames: 8, fps: 4 },
  waiting: { row: 6, frames: 8, fps: 3, loop: 'pingpong' },
  bashful: { row: 7, frames: 6, speed: 250, loop: 'pingpong' },
  review: { row: 8, frames: 6, fps: 4, loop: 'pingpong' },
  climbing: { row: 9, frames: 6, fps: 5 },
  perching: { row: 10, frames: 4, fps: 3, loop: 'pingpong' },
  petting: { row: 11, frames: 8, fps: 4, loop: 'pingpong' },
  yawning: { row: 12, frames: 5, fps: 3, loop: 'pingpong' },
  eating: { row: 13, frames: 6, fps: 5, loop: 'pingpong' },
  dizzy: { row: 14, frames: 4, fps: 6, loop: 'pingpong' },
  lookingAround: { row: 15, frames: 8, fps: 3, loop: 'pingpong' },
  swing: { row: 16, frames: 16, speed: 115, clips: [{ row: 16, frames: 8 }, { row: 37, frames: 8 }] },
  swimming: { row: 27, frames: 16, speed: 120, clips: [{ row: 27, frames: 8 }, { row: 39, frames: 8 }] },
  digSand: { row: 17, frames: 8, speed: 250 },
  readBook: { row: 8, frames: 6, speed: 300, loop: 'pingpong' },
  watchTV: { row: 19, frames: 8, speed: 350, loop: 'pingpong' },
  fanCooling: { row: 26, frames: 16, speed: 110, clips: [{ row: 26, frames: 8 }, { row: 38, frames: 8 }] },
  sleeping: { row: 20, frames: 8, speed: 400, loop: 'pingpong' },
  dancing: { row: 21, frames: 8, speed: 220 },
  crying: { row: 22, frames: 8, speed: 250 },
  gifting: { row: 23, frames: 8, speed: 200 },
  stretching: { row: 24, frames: 8, speed: 300 },
  clapping: { row: 25, frames: 8, speed: 150 },
  whip: { row: 28, frames: 8, speed: 160 },
  airConditioning: { row: 29, frames: 16, speed: 120, clips: [{ row: 29, frames: 8 }, { row: 40, frames: 8 }] },
  sofaLying: { row: 30, frames: 16, speed: 150, clips: [{ row: 30, frames: 8 }, { row: 41, frames: 8 }] },
  typingCompanion: { row: 32, frames: 8, speed: 170, loop: 'pingpong' },
};

export const WEATHER_CODES = new Map([
  [0, 'clear'], [1, 'clear'], [2, 'cloudy'], [3, 'cloudy'],
  [45, 'fog'], [48, 'fog'],
  [51, 'rain'], [53, 'rain'], [55, 'rain'],
  [61, 'rain'], [63, 'rain'], [65, 'rain'],
  [71, 'snow'], [73, 'snow'], [75, 'snow'],
  [95, 'storm']
]);

export const FEED_SCALE_DURATION = 600;
export const FEED_SCALE_MAX = 1.3;
export const BREATH_PERIOD = 3500;
export const BREATH_AMPLITUDE = 0.012;
export const GLANCE_DURATION = 700;
export const GLANCE_MAX_OFFSET = 1.5;
export const GLANCE_INTERVAL_MIN = 4000;
export const GLANCE_INTERVAL_MAX = 8000;
export const CLICK_MAX_DIST = 5;
export const CLICK_MAX_TIME = 300;

// ===== 共享可变状态 =====
const rawState = {
  // 宠物管理
  pets: [],
  currentPet: null,
  currentFormId: null,
  sprite: new Image(),
  spriteSheets: {},
  activeSpritesheetPath: '',
  currentLookId: 'default',
  outfitLayerImages: [],

  // 动画
  stateName: 'idle',
  frame: 0,
  lastFrameAt: 0,
  lastDrawTime: 0,

  // 天气
  weatherContext: null,

  // 拖拽
  dragState: null,
  pointerDownTime: 0,
  pointerDownPos: { x: 0, y: 0 },

  // 喂食缩放
  feedScaleStart: 0,

  // 视线追踪
  glanceStart: 0,
  glanceDirectionX: 0,
  glanceDirectionY: 0,
  nextGlanceAt: 0,

  // 音频
  audioCtx: null,
  isMuted: false,   // 由 initCoreState() 从 store 填入
  stepSoundCounter: 0,

  // 菜单模式
  danceTimer: null,
  followInterval: null,
  followMotion: { vx: 0, vy: 0, targetDx: 0, targetDy: 0 },

  // 闲置追踪
  lastInteractionTime: Date.now(),

  // 攀爬
  climbPhase: 'idle',
  climbEdgeType: null,
  climbTarget: null,
  climbOriginPos: null,
  climbAnimTimer: null,
  climbPerchTimeout: null,
  climbPeekTimeout: null,
  canScanWindows: false,

  // 鞭打
  whipCount: 0,
  whipResetTimeout: null,

  // 键盘
  keyboardActiveUntil: 0,
  continuousTypingStart: 0,
  typingReminderSent: false,
  lastTypingCompanionAt: 0,

  // 喂食
  feedingLock: false,
  dismissTimeout: null,
  hungerPromptStartedAt: 0,

  // 前台应用
  currentActiveApp: { isWPS: false, title: '' },

  // 设置
  yoyoSettings: { autoStart: true, soundEnabled: true, reminderFreq: 'medium', activity: 'normal', workMode: 'balanced' },

  // 行为引擎
  currentBehavior: null,
  behaviorEndTime: 0,
  manualEffectUntil: 0,
  activePerformance: null,
  performanceExpression: null,

  // 季节粒子
  seasonalParticles: [],
  lastSeasonalTrigger: 0,

  // 天气提醒
  weatherReminderCount: 0,
  lastWeatherReminderDate: '',

  // 每日提醒
  triggeredReminders: new Set(),
  lastReminderDate: new Date().toDateString(),

  // 记忆驱动
  lastMemoryTriggerTime: 0,

  // 功能引导
  shownTips: [],   // 由 initCoreState() 填入
  lastTipTime: Date.now(),

  // 记忆小时
  lastMemoryHour: new Date().getHours(),

  // 完整造型
  currentOutfit: { look: 'default' },  // 由 initCoreState() 填入

  // 启动安静窗口
  startupQuietUntil: 0,

};

// Proxy 包装：开发模式下记录状态变更到控制台
export const state = new Proxy(rawState, {
  set(target, prop, value) {
    const old = target[prop];
    target[prop] = value;
    if (old !== value && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.debug(`[state] ${String(prop)}:`, old, '→', value);
    }
    return true;
  }
});

export function getPetCell() {
  const asset = state.currentPet?.asset || {};
  return {
    width: Number(asset.cellWidth) || CELL_W,
    height: Number(asset.cellHeight) || CELL_H,
    columns: Number(asset.columns) || 8,
    rows: Number(asset.rows) || 0,
  };
}

export function getPetStates() {
  return state.currentPet?.states || STATES;
}

export function getPetCapabilities() {
  return state.currentPet?.capabilities || {};
}

export function petCapabilityEnabled(key, fallback = true) {
  const capabilities = getPetCapabilities();
  if (!Object.prototype.hasOwnProperty.call(capabilities, key)) return fallback;
  return capabilities[key] !== false;
}

export function petBehaviorAllowed(name) {
  const capabilities = getPetCapabilities();
  const allowlist = capabilities.behaviorAllowlist;
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true;
  return allowlist.includes(name);
}

export function getPetStateSpec(name) {
  const states = getPetStates();
  return states[name] || STATES[name] || STATES.idle;
}

export function isStartupQuiet() {
  return Date.now() < Number(state.startupQuietUntil || 0);
}

// ===== 精细化交互反应状态 =====
export const reactionState = {
  drag: null,      // { velocity: {x,y}, holdStart: number, hasShaken: boolean }
  whip: null,      // { phase: 'hit'|'rub'|'pout', startTime: number, side?: 1|-1, severity?: 'light'|'heavy' }
  feed: null,      // { phase: 'excited'|'eating'|'satisfied', startTime: number }
  pat: null,       // { phase: 'happy'|'purring', count: number, startTime: number }
};

// ===== 辫子物理 =====
export const braidPhysics = {
  points: [
    { x: 0, y: 0, vx: 0, vy: 0 },
    { x: 0, y: 8, vx: 0, vy: 0 },
    { x: 0, y: 16, vx: 0, vy: 0 },
  ],
  stiffness: 0.3,
  damping: 0.85,
  gravity: 0.5,
};

// ===== 全局定时器管理 =====
export const globalTimers = [];

// ===== 冷却系统 =====
export const cooldowns = {};

export function isOnCooldown(name) {
  if (!cooldowns[name]) return false;
  if (Date.now() >= cooldowns[name]) {
    delete cooldowns[name];
    return false;
  }
  return true;
}

export function setCooldown(name, ms) {
  if (ms > 0) cooldowns[name] = Date.now() + ms;
}

// ===== 每日标记系统 =====

export function hasDailyFlag(key) {
  const flags = get('dailyFlags') || {};
  return !!flags[key];
}

export function setDailyFlag(key) {
  const flags = get('dailyFlags') || {};
  flags[key] = Date.now();
  const cutoff = Date.now() - 60 * 86400000;
  for (const k of Object.keys(flags)) {
    if (typeof flags[k] === 'number' && flags[k] < cutoff) delete flags[k];
  }
  set('dailyFlags', flags);
}

// ===== store 初始化（在 initStore() 完成后调用）=====
export function initCoreState() {
  state.isMuted       = get('muted')      ?? false;
  state.shownTips     = get('shownTips')  ?? [];
  state.currentFormId = 'yoyo';
  state.currentOutfit = {
    look: 'default',
    ...(get('outfit') ?? {}),
  };
  set('currentFormId', 'yoyo');
}

// ===== sprite状态 → StateMachine ACTION_STATE 映射 =====
const SPRITE_TO_ACTION = {
  runningRight: ACTION_STATES.WALKING,
  runningLeft:  ACTION_STATES.WALKING,
  dancing:      ACTION_STATES.DANCING,
  climbing:     ACTION_STATES.CLIMBING,
  perching:     ACTION_STATES.CLIMBING,
  eating:       ACTION_STATES.FEEDING,
  whip:         ACTION_STATES.WHIP,
  typingCompanion: ACTION_STATES.TYPING_COMPANION,
};

// ===== setState =====
export function setState(next) {
  if (!STATES[next]) return;
  // 尊重 FROZEN 全局模式（例如特殊动画播放中）
  if (stateMachine.globalMode === GLOBAL_MODES.FROZEN) return;
  if (state.stateName !== next) {
    state.stateName = next;
    state.frame = 0;
    state.lastFrameAt = 0;
  }
  // 同步 StateMachine actionState，保持两套系统一致
  const actionState = SPRITE_TO_ACTION[next] ?? ACTION_STATES.IDLE;
  if (stateMachine.actionState !== actionState) {
    stateMachine.actionState = actionState;
  }
}
