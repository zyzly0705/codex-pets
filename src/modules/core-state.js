// core-state.js - 共享状态、常量、工具函数、音频、SpeechQueue
// 所有模块的基础层，不 import 任何其他模块
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { get, set } from './store-client.js';

// ===== DOM 引用 =====
export const canvas = document.getElementById('petCanvas');
export const ctx = canvas ? canvas.getContext('2d') : null;
export const bubble = document.getElementById('bubble');
export const bubbleText = bubble ? bubble.querySelector('.bubble-text') : null;
export const feedBtn = document.getElementById('feed-btn');

// ===== 常量 =====
export const CELL_W = 192;
export const CELL_H = 208;

export const STATES = {
  idle: { row: 0, frames: 6, fps: 4 },
  runningRight: { row: 1, frames: 8, fps: 8 },
  runningLeft: { row: 2, frames: 8, fps: 8 },
  waving: { row: 3, frames: 4, fps: 4 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 4 },
  waiting: { row: 6, frames: 6, fps: 3 },
  bashful: { row: 7, frames: 6, speed: 250 },
  review: { row: 8, frames: 6, fps: 4 },
  climbing: { row: 9, frames: 6, fps: 5 },
  perching: { row: 10, frames: 4, fps: 3 },
  petting: { row: 11, frames: 4, fps: 4 },
  yawning: { row: 12, frames: 5, fps: 3 },
  eating: { row: 13, frames: 6, fps: 5 },
  dizzy: { row: 14, frames: 4, fps: 6 },
  lookingAround: { row: 15, frames: 5, fps: 3 },
  swing: { row: 16, frames: 8, speed: 200 },
  digSand: { row: 17, frames: 8, speed: 250 },
  readBook: { row: 18, frames: 8, speed: 300 },
  watchTV: { row: 19, frames: 8, speed: 350 },
  sleeping: { row: 20, frames: 8, speed: 400 },
  dancing: { row: 21, frames: 8, speed: 220 },
  crying: { row: 22, frames: 8, speed: 250 },
  gifting: { row: 23, frames: 8, speed: 200 },
  stretching: { row: 24, frames: 8, speed: 300 },
  clapping: { row: 25, frames: 8, speed: 150 },
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
export const CLICK_MAX_DIST = 5;
export const CLICK_MAX_TIME = 300;

// ===== 共享可变状态 =====
export const state = {
  // 宠物管理
  pets: [],
  currentPet: null,
  sprite: new Image(),
  activeSpritesheetPath: '',
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

  // 音频
  audioCtx: null,
  isMuted: false,   // 由 initCoreState() 从 store 填入
  stepSoundCounter: 0,

  // 菜单模式
  danceTimer: null,
  followInterval: null,

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

  // 喂食
  feedingLock: false,
  dismissTimeout: null,

  // 前台应用
  currentActiveApp: { isWPS: false, title: '' },

  // 设置
  yoyoSettings: { autoStart: true, soundEnabled: true, reminderFreq: 'medium', activity: 'normal' },

  // 行为引擎
  currentBehavior: null,
  behaviorEndTime: 0,

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

  // 换装
  currentOutfit: { hair: 'none', hat: 'none', accessory: 'none', clothes: 'none', face: 'none' },  // 由 initCoreState() 填入

};

// ===== 精细化交互反应状态 =====
export const reactionState = {
  drag: null,      // { velocity: {x,y}, holdStart: number, hasShaken: boolean }
  whip: null,      // { phase: 'hit'|'rub'|'pout', startTime: number }
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

// ===== 工具函数 =====
export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, t);
}

export function localFileUrl(filePath) {
  return `file://${filePath.replaceAll('\\', '/')}`;
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

// ===== 音频系统 =====
const masterVolume = 0.25;

export function getAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

export function playSound(type) {
  if (state.isMuted) return;
  const actx = getAudioContext();
  if (actx.state === 'suspended') actx.resume();

  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);

  const now = actx.currentTime;

  switch (type) {
    case 'step':
      osc.frequency.value = 200;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'giggle':
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'cry':
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.3);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'bounce':
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'clap':
      osc.type = 'square';
      osc.frequency.value = 150;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
  }
}

export function toggleMute() {
  state.isMuted = !state.isMuted;
  set('muted', state.isMuted);
}

// ===== store 初始化（在 initStore() 完成后调用）=====
export function initCoreState() {
  state.isMuted       = get('muted')      ?? false;
  state.shownTips     = get('shownTips')  ?? [];
  state.currentOutfit = {
    hair: 'none',
    hat: 'none',
    accessory: 'none',
    clothes: 'none',
    face: 'none',
    ...(get('outfit') ?? {}),
  };
}

// ===== sprite状态 → StateMachine ACTION_STATE 映射 =====
const SPRITE_TO_ACTION = {
  runningRight: ACTION_STATES.WALKING,
  runningLeft:  ACTION_STATES.WALKING,
  dancing:      ACTION_STATES.DANCING,
  climbing:     ACTION_STATES.CLIMBING,
  perching:     ACTION_STATES.CLIMBING,
  eating:       ACTION_STATES.FEEDING,
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

// ===== 气泡排队系统（打字机效果） =====
export const SPEECH_PRIORITY = { CRITICAL: 100, IMPORTANT: 80, BEHAVIOR: 50, CASUAL: 20 };
const TYPEWRITER_BASE_SPEED = 60; // 每字基础速度（ms）
const TYPEWRITER_FAST_SPEED = 30;  // 短消息快速模式

export class SpeechQueue {
  constructor(maxSize = 5) {
    this.queue = [];
    this.maxSize = maxSize;
    this.isDisplaying = false;
    this._hideTimer = null;
    this._typeTimer = null;
  }

  enqueue(text, duration = 5200, priority = SPEECH_PRIORITY.BEHAVIOR) {
    const now = Date.now();
    // 去重：2秒内相同消息不重复入队
    if (this.queue.length > 0) {
      const last = this.queue[this.queue.length - 1];
      if (last.text === text && now - last.time < 2000) return;
    }
    // 队列满时，踢掉优先级最低的（但不踢 IMPORTANT 及以上）
    if (this.queue.length >= this.maxSize) {
      let minIdx = -1, minPri = Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority < minPri) { minPri = this.queue[i].priority; minIdx = i; }
      }
      if (minIdx >= 0 && minPri < SPEECH_PRIORITY.IMPORTANT) this.queue.splice(minIdx, 1);
    }
    this.queue.push({ text, duration, priority, time: now });
    if (!this.isDisplaying) this._displayNext();
  }

  priorityEnqueue(text, duration = 5200) {
    // CRITICAL 优先级：打断当前显示
    if (this.isDisplaying) {
      this._stopTyping();
      bubble.classList.add('hiding');
      // 把当前消息塞回队首
      if (this._currentMsg) {
        this.queue.unshift(this._currentMsg);
        this._currentMsg = null;
      }
      setTimeout(() => {
        bubble.classList.remove('hiding', 'visible');
        bubbleText.textContent = '';
        bubbleText.classList.remove('typing');
        this._displayNext();
      }, 180);
    }
    this.enqueue(text, duration, SPEECH_PRIORITY.CRITICAL);
  }

  _displayNext() {
    if (this.queue.length === 0) {
      this.isDisplaying = false;
      return;
    }
    this.isDisplaying = true;
    const msg = this.queue.shift();
    this._currentMsg = null;

    // 显示气泡（降级：如果 DOM 结构不完整则用旧方式）
    if (!bubbleText) {
      bubble.textContent = msg.text;
      bubble.classList.add('visible');
      this._hideTimer = setTimeout(() => {
        bubble.classList.remove('visible');
        this._hideTimer = setTimeout(() => this._displayNext(), 300);
      }, msg.duration);
      return;
    }

    bubble.classList.remove('hiding');
    bubble.classList.add('visible');
    bubbleText.textContent = '';

    // 打字机逐字显示
    this._typewrite(msg);
  }

  _typewrite(msg) {
    if (!bubbleText) return;
    const text = msg.text;
    // 短消息用快速模式
    const speed = text.length <= 12 ? TYPEWRITER_FAST_SPEED : TYPEWRITER_BASE_SPEED;
    let charIndex = 0;
    bubbleText.classList.add('typing');

    this._stopTyping();
    this._currentMsg = msg;

    this._typeTimer = setInterval(() => {
      if (charIndex < text.length) {
        bubbleText.textContent = text.slice(0, charIndex + 1);
        charIndex++;
      } else {
        // 打完，去掉光标
        clearInterval(this._typeTimer);
        this._typeTimer = null;
        bubbleText.classList.remove('typing');
        bubbleText.textContent = text;

        // 设置隐藏定时器
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
          bubble.classList.add('hiding');
          this._hideTimer = setTimeout(() => {
            bubble.classList.remove('visible', 'hiding');
            bubbleText.textContent = '';
            bubbleText.classList.remove('typing');
            this._currentMsg = null;
            this._displayNext();
          }, 180);
        }, msg.duration);
      }
    }, speed);
  }

  _stopTyping() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    clearTimeout(this._hideTimer);
  }

  clear() {
    this.queue = [];
    this.isDisplaying = false;
    this._stopTyping();
    clearTimeout(this._hideTimer);
    bubble.classList.remove('visible', 'hiding');
    bubbleText.textContent = '';
    bubbleText.classList.remove('typing');
    this._currentMsg = null;
  }
}

export const speechQueue = new SpeechQueue();

export function say(text, duration = 5200) {
  speechQueue.enqueue(text, duration, SPEECH_PRIORITY.BEHAVIOR);
}
