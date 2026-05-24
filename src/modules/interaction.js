// interaction.js - 拖拽 + 喂食 + 右键菜单响应 + 键盘响应 + 鞭打
import { state, canvas, feedBtn, careCue, say, setState, playSound, randomFrom, speechQueue, SPEECH_PRIORITY, isOnCooldown, setCooldown, cooldowns, FEED_SCALE_DURATION, FEED_SCALE_MAX, CLICK_MAX_DIST, CLICK_MAX_TIME, localFileUrl, globalTimers, STATES, reactionState, petCapabilityEnabled, petBehaviorAllowed } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { applyEmotionEvent, emotionSay, yoyoEmotion, getEmotionLabel, PET_DIALOGUES, WHIP_DIALOGUES, FEED_DIALOGUES } from './emotion-system.js';
import { yoyoMemory, saveMemory, addXP, trackGrowthStat, incrementAchievementStat, trackFeatureUsed, MEMORY_LINES } from './growth-system.js';
import { cancelClimb } from './climbing.js';
import { petNeeds, behaviorEngineTick, HUNGER_MESSAGES, recordBehaviorFeedback } from './behavior-engine.js';
import { applyOutfitSpritesheet } from './outfit-system.js';
import { checkDailyNewsBroadcast } from './news-broadcast.js';
import { debugLog } from './debug-log.js';
import { relationshipEvent, maybeSpeakRelationshipStageEvent } from './relationship-system.js';
import { recordDailyEvent } from './daily-memory.js';
import { normalizePetManifest } from './pet-manifest.js';
import { set, get } from './store-client.js';
import { startPerformance, endPerformance } from './performance-script.js';

// ===== 喂食相关消息 =====
const DISMISS_MESSAGES = [
  '算了…Yoyo忍一忍…',
  '哼，妈妈不给吃…Yoyo好委屈…',
  '好吧…Yoyo自己饿着吧…（蹲角落）',
];

const FEED_MESSAGES = [
  '好吃好吃！谢谢妈妈～',
  '吃饱饱啦！Yoyo好满足～',
  '嗯嗯好香！妈妈最好了！',
  '谢谢妈妈投喂！Yoyo变得圆滚滚啦～',
  '好幸福呀！妈妈给的零食最好吃了！',
  '这个好好吃！妈妈还有吗还有吗？',
];

const KEYBOARD_COMPANION_DURATION = 2600;
const KEYBOARD_COMPANION_MIN_INTERVAL = 900;
const KEYBOARD_PROTECTED_BEHAVIORS = new Set(['weatherReminder', 'newsBroadcast', 'memoryTrigger']);

// 间隔超过这个时间视为真正休息了，重置打字会话
const TYPING_BREAK_THRESHOLD_MS = 5 * 60 * 1000;

// 多阶段提醒：随着连续打字时长增加，语气越来越心疼
const TYPING_REMINDER_STAGES = [
  {
    ms: 40 * 60 * 1000,
    lines: [
      '打了40分钟啦，手指休息一下嘛～',
      '妈妈已经打了好久啦！喝口水水？',
      '键盘都快被敲烂啦！动动手腕嘛～',
    ],
  },
  {
    ms: 70 * 60 * 1000,
    lines: [
      '妈妈一口气打了超过一小时！眼睛休息下嘛…',
      '好久好久了…妈妈站起来活动活动嘛～',
      '打了七十分钟了…Yoyo都看累了…',
    ],
  },
  {
    ms: 100 * 60 * 1000,
    lines: [
      '妈妈！已经快两小时了！快去休息！',
      '妈妈你是机器人吗…打了这么久…',
      'Yoyo心疼妈妈…快离开屏幕歇一歇…',
    ],
  },
];

const TYPING_RETURN_LINES = [
  '妈妈回来啦！Yoyo在等你哦～',
  '妈妈休息好了吗？Yoyo陪你继续！',
  '妈妈又开始啦～Yoyo给你加油！',
];

// 呼噜阈值随情绪变化：开心时更快进入呼噜，难过时需要更多次安抚
function getPurringThreshold() {
  const label = getEmotionLabel();
  let base;
  if (label === 'excited' || label === 'happy') base = 2;
  else if (label === 'calm') base = 4;
  else if (label === 'sad') base = 6;
  else if (label === 'angry') base = 8;
  else base = 3;
  return Math.max(1, base + Math.round(Math.random() * 2 - 1));
}

// 哭泣阈值随当前情绪变化：已经难过时更容易被打哭
function getWhipCryThreshold(preWhipValence) {
  let base;
  if (preWhipValence < 40) base = 3;
  else if (preWhipValence < 65) base = 5;
  else base = 7;
  return Math.max(2, base + Math.round(Math.random() * 2 - 1));
}

function canStartTypingCompanion(now) {
  if (state.manualEffectUntil && now < state.manualEffectUntil) return false;
  if (stateMachine.globalMode !== GLOBAL_MODES.INTERACTIVE) return false;
  if (stateMachine.isDragging || stateMachine.isFeeding || stateMachine.isWhipping || stateMachine.isDropping) return false;
  if (stateMachine.isSleeping || stateMachine.isFollowing || stateMachine.isClimbing) return false;
  if (stateMachine.isDancing && !(state.currentBehavior === 'dance' && !state.danceTimer)) return false;
  if (stateMachine.actionState === ACTION_STATES.TYPING_COMPANION) return true;
  if (!stateMachine.canTransition(ACTION_STATES.TYPING_COMPANION)) return false;
  if (state.currentBehavior && KEYBOARD_PROTECTED_BEHAVIORS.has(state.currentBehavior)) return false;
  return true;
}

// ===== 重置闲置 =====
export function resetInteraction() {
  state.lastInteractionTime = Date.now();
  recordBehaviorFeedback('manual');
  relationshipEvent('manual', 1);
  maybeSpeakRelationshipStageEvent();
  recordDailyEvent('interaction', { kind: 'manual' });
  if (stateMachine.isClimbing) {
    cancelClimb();
  }
}

async function startManualBehavior({ name, stateName, duration = 7000, message, emotionEvent }) {
  state.lastInteractionTime = Date.now();

  if (stateMachine.isClimbing) {
    await cancelClimb();
  }
  if (stateMachine.isDancing) {
    clearInterval(state.danceTimer);
    state.danceTimer = null;
    stateMachine.transition(ACTION_STATES.IDLE);
  }
  if (stateMachine.isFollowing) {
    stopFollowing();
  }
  if (stateMachine.isSleeping) {
    stateMachine.setGlobalMode(GLOBAL_MODES.INTERACTIVE);
    STATES.idle.fps = 4;
  }

  clearTimeout(state.dismissTimeout);
  feedBtn.classList.remove('show');
  state.hungerPromptStartedAt = 0;

  state.currentBehavior = name;
  state.behaviorEndTime = Date.now() + duration;
  setState(stateName);
  if (message) say(message, Math.min(duration, 7000));
  if (emotionEvent) applyEmotionEvent(emotionEvent);

  setTimeout(() => {
    if (state.currentBehavior === name) {
      state.currentBehavior = null;
      state.behaviorEndTime = 0;
      setState('idle');
    }
  }, duration + 120);
}

function desktopLifeLine(life = {}) {
  const lowest = life.lowestNeed || {};
  if (life.prompt?.line) return life.prompt.line;
  if (lowest.key === 'satiety' && lowest.value < 70) return '妈妈，Yoyo有点饿，想吃一点。';
  if (lowest.key === 'cleanliness' && lowest.value < 70) return '妈妈，Yoyo想洗香香。';
  if (lowest.key === 'energy' && lowest.value < 70) return '妈妈，Yoyo有点困，想休息一下。';
  if (lowest.key === 'mood' && lowest.value < 70) return '妈妈，Yoyo想你陪陪。';
  if (life.status === 'close') return 'Yoyo今天很黏妈妈。';
  return `Yoyo现在${life.summary || '安安稳稳的'}。`;
}

async function inspectYoyoLife() {
  try {
    const life = await window.petApi.getLife();
    state.life = life;
    const nextState = life.prompt?.stateName || (life.status === 'close' ? 'clapping' : 'waving');
    setState(nextState);
    say(desktopLifeLine(life), 5200);
  } catch {
    setState('waiting');
    say('Yoyo现在有点迷糊，等一下再看看我。', 4200);
  }
}

async function careFromMenu(actionId) {
  if (!actionId) return;
  if (!window.petApi?.careForYoyo) {
    say('先打开小屋照顾Yoyo吧。', 3600);
    return;
  }
  try {
    const life = await window.petApi.careForYoyo(actionId);
    if (life?.stateName) setState(life.stateName);
    state.life = life;
  } catch {
    setState('failed');
    say('这下没照顾好，Yoyo有点懵。', 3600);
  }
}

// ===== 同步菜单状态 =====
export function syncMenuState() {
  window.petApi.syncMenuState({
    dancing: stateMachine.isDancing,
    following: stateMachine.isFollowing,
    sleeping: stateMachine.isSleeping
  });
}

// ===== 饥饿 UI =====
export function showHungerUI() {
  const msg = HUNGER_MESSAGES[Math.floor(Math.random() * HUNGER_MESSAGES.length)];
  setState('waiting');
  say(msg, 6000);
  state.hungerPromptStartedAt = Date.now();

  feedBtn.classList.add('show');
  window.petApi.setIgnoreMouse(false);

  state.dismissTimeout = setTimeout(() => {
    feedBtn.classList.remove('show');
    window.petApi.setIgnoreMouse(true);
    const dismissMsg = DISMISS_MESSAGES[Math.floor(Math.random() * DISMISS_MESSAGES.length)];
    setState('failed');
    say(dismissMsg);
    state.hungerPromptStartedAt = 0;
  }, 30000);
}

function doSquashBounce() {
  canvas.style.transition = 'transform 0.1s ease-out';
  canvas.style.transform = 'translateX(-50%) scaleY(0.92) scaleX(1.08)';
  playSound('bounce');
  setTimeout(() => {
    canvas.style.transition = 'transform 0.15s ease-out';
    canvas.style.transform = 'translateX(-50%) scaleY(1.03) scaleX(0.98)';
    setTimeout(() => {
      canvas.style.transform = 'translateX(-50%)';
    }, 150);
  }, 120);
}

// ===== 鞭打 =====
export function whipPet() {
  if (stateMachine.isWhipping) return;
  recordBehaviorFeedback('whip');
  relationshipEvent('whip', 1);
  maybeSpeakRelationshipStageEvent();
  recordDailyEvent('interaction', { kind: 'whip' });

  state.whipCount++;
  clearTimeout(state.whipResetTimeout);
  state.whipResetTimeout = setTimeout(() => { state.whipCount = 0; }, 10000);

  yoyoMemory.lastWhipTime = Date.now();
  yoyoMemory.totalWhipCount++;
  saveMemory();

  const preWhipValence = yoyoEmotion.valence;
  applyEmotionEvent('whip');
  // 情绪惯性：已经难过时被打，伤害加重
  if (preWhipValence < 40) {
    applyEmotionEvent('sad');
  }
  trackFeatureUsed('whip');

  canvas.classList.add('shake');
  setTimeout(() => canvas.classList.remove('shake'), 300);

  // 鞭打反应状态
  const side = Math.random() > 0.5 ? 1 : -1;
  const cryThreshold = getWhipCryThreshold(preWhipValence);
  reactionState.whip = {
    phase: 'hit',
    startTime: Date.now(),
    side,
    severity: state.whipCount >= cryThreshold ? 'heavy' : 'light',
  };

  if (state.whipCount >= cryThreshold) {
    setState('whip');
    playSound('cry');
    say('呜呜呜…妈妈打了Yoyo好多次…Yoyo好委屈…', 6000);
  } else {
    setState('whip');
    say('呜…好疼…', 2000);
  }

  // 1.5秒后揉屁股
  setTimeout(() => {
    if (reactionState.whip) {
      reactionState.whip.phase = 'rub';
      say('不要打了嘛…疼疼…', 2500);
    }
  }, 1500);

  // 3秒后噘嘴
  setTimeout(() => {
    if (reactionState.whip) reactionState.whip.phase = 'pout';
  }, 3000);

  // 4.5秒后恢复
  setTimeout(() => { reactionState.whip = null; }, 4500);

  stateMachine.transition(ACTION_STATES.WHIP);
  // energy 在行为引擎中表示疲劳/困意；受惊会稍微消耗体力，但避免大幅推高睡眠概率。
  petNeeds.energy = Math.min(100, petNeeds.energy + 4);
  setTimeout(() => {
    let runTicks = 0;
    const runInterval = setInterval(() => {
      setState(runTicks % 2 === 0 ? 'runningRight' : 'runningLeft');
      runTicks++;
      if (runTicks >= 6) {
        clearInterval(runInterval);
        setState('idle');
        stateMachine.transition(ACTION_STATES.IDLE);
      }
    }, 500);
  }, 4500);
}

// ===== 跳舞模式 =====
export function toggleDance() {
  if (!petCapabilityEnabled('dance')) {
    say('这个形态今天不想跳舞，先安静陪妈妈吧～');
    return;
  }
  if (stateMachine.isDancing) {
    clearInterval(state.danceTimer);
    state.danceTimer = null;
    endPerformance('manual_stop');
    stateMachine.transition(ACTION_STATES.IDLE);
    setState('bashful');
    say('好，收住。');
  } else {
    const wasFollowing = stateMachine.isFollowing;
    const wasClimbing = stateMachine.isClimbing;
    if (!stateMachine.transition(ACTION_STATES.DANCING)) return;

    if (wasFollowing) stopFollowing();
    if (wasClimbing) {
      state.climbPhase = 'idle';
      canvas.style.transform = 'translateX(-50%)';
      if (state.climbOriginPos) {
        window.petApi.setPosition(state.climbOriginPos);
        state.climbOriginPos = null;
      }
    }
    startPerformance('danceLetGo', { manual: true, force: true });
    incrementAchievementStat('danceCount');
    trackFeatureUsed('dance');
    trackGrowthStat('interactionCount');
    setCooldown('dance', 300000);
    state.danceTimer = setInterval(() => {
      if (!stateMachine.isDancing) return;
      setState('dancing');
    }, 3000);
  }
  syncMenuState();
}

// ===== 睡眠模式 =====
export function toggleSleep() {
  if (!petCapabilityEnabled('sleep')) {
    say('这个形态先不睡，继续陪妈妈待着～');
    return;
  }
  if (stateMachine.isSleeping) {
    stateMachine.setGlobalMode(GLOBAL_MODES.INTERACTIVE);
    STATES.idle.fps = 4;
    setState('waving');
    say('唔...妈妈...再睡五分钟嘛...');
  } else {
    const wasDancing = stateMachine.isDancing;
    const wasFollowing = stateMachine.isFollowing;
    stateMachine.setGlobalMode(GLOBAL_MODES.SLEEP);
    if (wasDancing) {
      clearInterval(state.danceTimer);
      state.danceTimer = null;
    }
    if (wasFollowing) stopFollowing();
    clearTimeout(state.dismissTimeout);
    feedBtn.classList.remove('show');
    state.hungerPromptStartedAt = 0;
    setState('sleeping');
    say('呼...Yoyo好困呀...zzZ...');
    STATES.idle.fps = 1;
    trackFeatureUsed('sleep');
  }
  syncMenuState();
}

// ===== 跟随鼠标模式 =====
export function toggleFollowMouse() {
  if (!stateMachine.isFollowing) {
    const wasDancing = stateMachine.isDancing;
    const wasClimbing = stateMachine.isClimbing;
    if (!stateMachine.transition(ACTION_STATES.FOLLOWING)) return;

    if (wasDancing) {
      clearInterval(state.danceTimer);
      state.danceTimer = null;
    }
    if (wasClimbing) {
      state.climbPhase = 'idle';
      canvas.style.transform = 'translateX(-50%)';
      if (state.climbOriginPos) {
        window.petApi.setPosition(state.climbOriginPos);
        state.climbOriginPos = null;
      }
    }
    setState('jumping');
    say('Yoyo要跟着妈妈！哪里都要跟着！');
    startFollowing();
    trackFeatureUsed('follow');
  } else {
    stateMachine.transition(ACTION_STATES.IDLE);
    setState('jumping');
    say('好吧～Yoyo不跟了，自己玩～');
    stopFollowing();
  }
  syncMenuState();
}

function startFollowing() {
  state.followMotion = { vx: 0, vy: 0, targetDx: 0, targetDy: 0 };
  state.followInterval = setInterval(async () => {
    if (!stateMachine.isFollowing) return;

    const mousePos = await window.petApi.getMousePosition();
    const { bounds } = await window.petApi.getBounds();

    const petCenterX = bounds.x + bounds.width / 2;
    const petCenterY = bounds.y + bounds.height / 2;

    const dx = mousePos.x - petCenterX;
    const dy = mousePos.y - petCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    state.followMotion.targetDx = dx;
    state.followMotion.targetDy = dy;

    if (distance < 30) {
      setState('idle');
      state.followMotion.vx *= 0.6;
      state.followMotion.vy *= 0.6;
      return;
    }

    const targetSpeed = Math.min(6.5, Math.max(1.2, distance * 0.055));
    const slowRadius = 140;
    const speedScale = distance < slowRadius ? (0.35 + 0.65 * (distance / slowRadius)) : 1;
    const desiredX = (dx / distance) * targetSpeed * speedScale;
    const desiredY = (dy / distance) * targetSpeed * speedScale;
    state.followMotion.vx += (desiredX - state.followMotion.vx) * 0.24;
    state.followMotion.vy += (desiredY - state.followMotion.vy) * 0.20;
    const moveX = Math.round(state.followMotion.vx);
    const moveY = Math.round(state.followMotion.vy);

    if (dx > 0) {
      setState('runningRight');
    } else {
      setState('runningLeft');
    }

    await window.petApi.moveBy({ x: moveX, y: moveY });
  }, 50);
}

function stopFollowing() {
  if (state.followInterval) {
    clearInterval(state.followInterval);
    state.followInterval = null;
  }
  state.followMotion = { vx: 0, vy: 0, targetDx: 0, targetDy: 0 };
}

// ===== 抚摸重置定时器 =====
let patResetTimer = null;

// ===== 拖拽持有定时器 =====
let dragHoldTimer = null;

function isPointerInsideInteractiveArea(event) {
  if (!event) return false;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  return Boolean(target && (
    target === canvas ||
    target === feedBtn ||
    feedBtn.contains(target) ||
    target === careCue ||
    careCue?.contains(target)
  ));
}

function updateMousePassthrough(event) {
  window.petApi.setIgnoreMouse(!isPointerInsideInteractiveArea(event));
}

function cleanupDragInteraction(event, { forcePassthrough = false } = {}) {
  const hadDragState = Boolean(state.dragState || reactionState.drag || stateMachine.isDragging);

  state.dragState = null;
  reactionState.drag = null;
  clearTimeout(dragHoldTimer);

  if (stateMachine.isDragging) {
    stateMachine.transition(ACTION_STATES.IDLE);
  }

  canvas.style.transition = 'transform 0.1s ease-out';
  canvas.style.transform = 'translateX(-50%)';

  if (forcePassthrough) {
    window.petApi.setIgnoreMouse(true);
  } else if (event) {
    updateMousePassthrough(event);
  }

  return hadDragState;
}

// ===== 初始化交互事件 =====
export function initInteraction() {
  // 单击 vs 拖拽判定
  canvas.addEventListener('pointerdown', async (event) => {
    if (event.button !== 0) return;
    resetInteraction();
    if (stateMachine.isDropping) return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer capture may fail if pointer is gone */ }
    state.pointerDownTime = Date.now();
    state.pointerDownPos = { x: event.screenX, y: event.screenY };
    stateMachine.transition(ACTION_STATES.DRAGGING);
    state.dragState = { x: event.screenX, y: event.screenY };
    setState('jumping');
    canvas.style.transition = 'transform 0.15s ease-out';
    canvas.style.transform = 'translateX(-50%) scaleY(1.08) scaleX(0.95)';
    await window.petApi.setIgnoreMouse(false);

    // 拖拽反应状态
    reactionState.drag = { velocity: { x: 0, y: 0 }, holdStart: Date.now(), hasShaken: false };
    clearTimeout(dragHoldTimer);
    dragHoldTimer = setTimeout(() => {
      if (state.dragState) say('妈妈放Yoyo下来嘛～', 3000);
    }, 5000);
  });

  canvas.addEventListener('pointermove', async (event) => {
    if (!state.dragState) return;
    const dx = event.screenX - state.dragState.x;
    const dy = event.screenY - state.dragState.y;
    state.dragState = { x: event.screenX, y: event.screenY };
    const angle = Math.max(-8, Math.min(8, dx * 0.3));
    canvas.style.transform = `translateX(-50%) scaleY(1.08) scaleX(0.95) rotate(${angle}deg)`;
    await window.petApi.moveBy({ x: dx, y: dy });

    // 拖拽速度计算 & 甩动检测
    const speed = Math.hypot(dx, dy);
    if (reactionState.drag) {
      reactionState.drag.velocity = { x: dx, y: dy };
      if (speed > 25 && !reactionState.drag.hasShaken) {
        reactionState.drag.hasShaken = true;
        say('呀！好晕好晕～别甩了啦！', 2000);
      }
    }
  });

  canvas.addEventListener('pointerup', async (event) => {
    if (!state.dragState) return;
    const dist = Math.sqrt(
      Math.pow(state.dragState.x - state.pointerDownPos.x, 2) +
      Math.pow(state.dragState.y - state.pointerDownPos.y, 2)
    );
    const elapsed = Date.now() - state.pointerDownTime;
    const wasShaken = Boolean(reactionState.drag?.hasShaken);
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    cleanupDragInteraction(event);

    // 拖拽结束反应
    if (dist >= CLICK_MAX_DIST || elapsed >= CLICK_MAX_TIME) {
      say(wasShaken ? '呜…头好晕好晕…' : '安全着陆～嘿嘿！', 2500);
      recordBehaviorFeedback(wasShaken ? 'whip' : 'drag');
      recordDailyEvent('interaction', { kind: 'drag' });
    }

    if (dist < CLICK_MAX_DIST && elapsed < CLICK_MAX_TIME) {
      recordBehaviorFeedback('pet');
      relationshipEvent('pet', 2);
      maybeSpeakRelationshipStageEvent();
      recordDailyEvent('interaction', { kind: 'pet' });
      petNeeds.boredom = Math.max(0, petNeeds.boredom - 15);
      petNeeds.playfulness = Math.min(100, petNeeds.playfulness + 10);
      state.lastInteractionTime = Date.now();
      setState('petting');
      playSound('giggle');

      yoyoMemory.lastPetTime = Date.now();
      yoyoMemory.totalPetCount++;
      saveMemory();

      addXP(5);
      trackGrowthStat('interactionCount');
      applyEmotionEvent('pet');
      incrementAchievementStat('petCount');
      trackFeatureUsed('pet');

      // 抚摸反应：追踪连续次数
      if (!reactionState.pat) {
        reactionState.pat = { phase: 'happy', count: 1, startTime: Date.now() };
        say('嗯～好舒服', 2500);
      } else {
        reactionState.pat.count++;
        if (reactionState.pat.count >= getPurringThreshold()) {
          reactionState.pat.phase = 'purring';
          say('呼噜呼噜～', 3000);
        } else {
          emotionSay(PET_DIALOGUES);
        }
      }
      clearTimeout(patResetTimer);
      patResetTimer = setTimeout(() => { reactionState.pat = null; }, 5000);

      const petMilestones = [100, 500, 1000, 2000, 5000];
      if (petMilestones.includes(yoyoMemory.totalPetCount)) {
        const line = randomFrom(MEMORY_LINES.petMilestone)
          .replace('{count}', yoyoMemory.totalPetCount);
        say(line, 7000);
      }
      setTimeout(() => setState('idle'), 2000);
    } else {
      setState('idle');
      say('妈妈把Yoyo放这里啦～嘿嘿！');
      trackGrowthStat('interactionCount');
      // 以前这里会模拟重力把 Yoyo 掉到屏幕底部，导致“拖到哪都放不住”。
      // 现在松手后保留当前窗口位置，只做一个轻微落地反馈。
      doSquashBounce();
    }
  });

  canvas.addEventListener('pointercancel', (event) => {
    cleanupDragInteraction(event, { forcePassthrough: true });
  });

  canvas.addEventListener('lostpointercapture', (event) => {
    if (state.dragState) cleanupDragInteraction(event, { forcePassthrough: true });
  });

  window.addEventListener('blur', () => {
    cleanupDragInteraction(null, { forcePassthrough: true });
  });

  // 喂食按钮
  feedBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    resetInteraction();
    recordBehaviorFeedback('feed');
    relationshipEvent('feed', 1.5);
    maybeSpeakRelationshipStageEvent();
    recordDailyEvent('interaction', { kind: 'feed' });
    clearTimeout(state.dismissTimeout);

    const useLifeCare = Boolean(window.petApi?.careForYoyo);

    // 喂食反应：兴奋阶段
    reactionState.feed = { phase: 'excited', startTime: Date.now() };
    if (!useLifeCare) say('哇！有好吃的！', 2000);

    feedBtn.classList.add('feeding');
    setTimeout(() => {
      feedBtn.classList.remove('feeding');
      feedBtn.classList.remove('show');
      window.petApi.setIgnoreMouse(true);

      setState('eating');
      stateMachine.transition(ACTION_STATES.FEEDING);
      stateMachine.acquireLock('feeding', 2000);
      state.feedingLock = true;
      setTimeout(() => { state.feedingLock = false; stateMachine.transition(ACTION_STATES.IDLE); stateMachine.releaseLock('feeding'); }, 2000);

      // 喂食反应：进入吃的阶段
      reactionState.feed = { phase: 'eating', startTime: Date.now() };
      state.hungerPromptStartedAt = 0;

      state.feedScaleStart = performance.now();
      applyEmotionEvent('feed');
      if (useLifeCare) {
        window.petApi.careForYoyo('feed')
          .then((life) => { state.life = life; })
          .catch(() => say('这口饭没送到，等一下再喂Yoyo。', 3600));
      }

      petNeeds.hunger = 10;
      petNeeds.boredom = Math.max(0, petNeeds.boredom - 20);
      delete cooldowns['hungry'];

      yoyoMemory.lastFedTime = Date.now();
      yoyoMemory.totalFedCount++;
      saveMemory();

      addXP(3);

      // 吃完后满足
      if (!useLifeCare) {
        setTimeout(() => {
          reactionState.feed = { phase: 'satisfied', startTime: Date.now() };
          say('好饱～', 2500);
          setTimeout(() => { reactionState.feed = null; }, 3000);
        }, 2000);
      } else {
        setTimeout(() => { reactionState.feed = null; }, 3000);
      }
    }, 500);
  });

  // 鼠标穿透
  window.petApi.setIgnoreMouse(true);

  canvas.addEventListener('mouseenter', (event) => {
    updateMousePassthrough(event);
  });

  canvas.addEventListener('mouseleave', (event) => {
    if (state.dragState) return;
    updateMousePassthrough(event);
  });

  feedBtn.addEventListener('mouseenter', (event) => {
    updateMousePassthrough(event);
  });

  feedBtn.addEventListener('mouseleave', (event) => {
    updateMousePassthrough(event);
  });

  if (careCue) {
    careCue.addEventListener('mouseenter', (event) => {
      updateMousePassthrough(event);
    });

    careCue.addEventListener('mouseleave', (event) => {
      updateMousePassthrough(event);
    });
  }

  // 右键菜单
  canvas.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    await window.petApi.showContextMenu();
  });

  // 菜单动作
  window.petApi.onMenuAction(async (action) => {
    resetInteraction();
    if (action.startsWith('care:')) {
      await careFromMenu(action.slice('care:'.length));
      return;
    }
    if (action === 'special:clone') {
      startPerformance('cloneHeart', { manual: true, force: true });
      window.petApi.triggerCloneEffect();
      incrementAchievementStat('cloneTriggered');
      trackFeatureUsed('clone');
      return;
    }
    if (action === 'special:giant') {
      startPerformance('dharmaManifest', { manual: true, force: true });
      window.petApi.triggerGiantEffect();
      trackFeatureUsed('giant');
      return;
    }
    if (action.startsWith('switch-pet:') || action.startsWith('switch-form:')) {
      const petId = action.replace(/^switch-(pet|form):/, '');
      await choosePet(petId);
      return;
    }
    switch (action) {
      case 'import': {
        const result = await window.petApi.importPet();
        if (result.ok) {
          state.pets = result.pets;
          await choosePet(result.pet.id);
          setState('jumping');
          say('哇！Yoyo有新的角色样子啦！');
        } else if (result.error) {
          setState('failed');
          say(result.error);
        }
        break;
      }
      case 'inspect-yoyo':
        await inspectYoyoLife();
        break;
      case 'swing':
        if (stateMachine.isDancing) {
          clearInterval(state.danceTimer);
          state.danceTimer = null;
          stateMachine.transition(ACTION_STATES.IDLE);
        }
        if (stateMachine.isFollowing) stopFollowing();
        if (stateMachine.isSleeping) {
          stateMachine.setGlobalMode(GLOBAL_MODES.INTERACTIVE);
          STATES.idle.fps = 4;
        }
        clearTimeout(state.dismissTimeout);
        feedBtn.classList.remove('show');
        state.hungerPromptStartedAt = 0;
        startPerformance('swingScene', { manual: true, force: true });
        trackFeatureUsed('swing');
        break;
      case 'cheer':
        await startManualBehavior({
          name: 'cheer',
          stateName: 'clapping',
          duration: 3600,
          message: '妈妈加油！Yoyo给你打气！',
          emotionEvent: 'happy',
        });
        trackFeatureUsed('cheer');
        break;
      case 'read-book':
        await startManualBehavior({
          name: 'readBook',
          stateName: 'readBook',
          duration: 8000,
          message: 'Yoyo安静看会书，陪妈妈一起专心～',
          emotionEvent: 'calm',
        });
        trackFeatureUsed('readBook');
        break;
      case 'typing-companion':
        await startManualBehavior({
          name: 'typingCompanion',
          stateName: 'typingCompanion',
          duration: 7000,
          message: 'Yoyo搬好小桌子，陪妈妈打字。',
          emotionEvent: 'calm',
        });
        state.keyboardActiveUntil = Date.now() + 7000;
        trackFeatureUsed('typingCompanion');
        break;
      case 'fan-cooling':
        await startManualBehavior({
          name: 'fanCooling',
          stateName: 'fanCooling',
          duration: 7000,
          message: '呼呼的小风扇吹起来啦～',
          emotionEvent: 'calm',
        });
        break;
      case 'air-conditioning':
        await startManualBehavior({
          name: 'airConditioning',
          stateName: 'airConditioning',
          duration: 8000,
          message: '空调凉凉的～Yoyo不热啦！',
          emotionEvent: 'calm',
        });
        break;
      case 'sofa-lying':
        await startManualBehavior({
          name: 'sofaLying',
          stateName: 'sofaLying',
          duration: 9000,
          message: 'Yoyo在沙发上躺一下下～',
          emotionEvent: 'relaxed',
        });
        break;
      case 'swimming':
        await startManualBehavior({
          name: 'swimming',
          stateName: 'swimming',
          duration: 8000,
          message: '扑通！Yoyo去游泳啦～',
          emotionEvent: 'happy',
        });
        break;
      case 'daily-news':
        await checkDailyNewsBroadcast(true);
        break;
      case 'manual-break':
        setState('stretching');
        say('妈妈先活动一下吧，Yoyo陪你缓一缓～', 7000);
        break;
      case 'end-of-day':
        setState('clapping');
        say('今天辛苦啦，妈妈已经做得很好了～', 8000);
        break;
      default:
        if (action.startsWith('work-mode:')) {
          const mode = action.slice('work-mode:'.length);
          const settings = { ...(get('settings') || state.yoyoSettings || {}) };
          settings.workMode = mode;
          set('settings', settings);
          state.yoyoSettings = settings;
          const modeMessages = {
            focus: '好哦，Yoyo安静陪你专注一会儿～',
            balanced: '收到，今天就轻轻陪着妈妈工作～',
            overtime: '妈妈辛苦了，今晚Yoyo会更体贴一点。',
            wrapup: '准备收工啦，Yoyo陪你慢慢放松下来～',
          };
          setState(mode === 'wrapup' ? 'sofaLying' : mode === 'focus' ? 'review' : 'waving');
          say(modeMessages[mode] || 'Yoyo记住现在的节奏啦～', 7000);
          break;
        }
    }
  });

  // 抚摸动作
  window.petApi.onAction(() => {
    resetInteraction();
    recordBehaviorFeedback('pet');
    relationshipEvent('pet', 2);
    maybeSpeakRelationshipStageEvent();
    recordDailyEvent('interaction', { kind: 'pet' });
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 15);
    petNeeds.playfulness = Math.min(100, petNeeds.playfulness + 10);
    state.lastInteractionTime = Date.now();
    setState('petting');
    playSound('giggle');

    yoyoMemory.lastPetTime = Date.now();
    yoyoMemory.totalPetCount++;
    saveMemory();

    addXP(5);
    trackGrowthStat('interactionCount');
    applyEmotionEvent('pet');
    incrementAchievementStat('petCount');
    trackFeatureUsed('pet');

    // 抚摸反应：追踪连续次数
    if (!reactionState.pat) {
      reactionState.pat = { phase: 'happy', count: 1, startTime: Date.now() };
      say('嗯～好舒服', 2500);
    } else {
      reactionState.pat.count++;
      if (reactionState.pat.count >= 3) {
        reactionState.pat.phase = 'purring';
        say('呼噜呼噜～', 3000);
      } else {
        emotionSay(PET_DIALOGUES);
      }
    }
    clearTimeout(patResetTimer);
    patResetTimer = setTimeout(() => { reactionState.pat = null; }, 5000);

    const petMilestones = [100, 500, 1000, 2000, 5000];
    if (petMilestones.includes(yoyoMemory.totalPetCount)) {
      const line = randomFrom(MEMORY_LINES.petMilestone)
        .replace('{count}', yoyoMemory.totalPetCount);
      say(line, 7000);
    }
    setTimeout(() => setState('idle'), 2000);
  });

  window.petApi.onWhip(() => {
    resetInteraction();
    whipPet();
  });

  window.petApi.onDance((checked) => {
    resetInteraction();
    if (checked) {
      if (isOnCooldown('dance')) {
        say('Yoyo舞累了，休息一下～', 3000, SPEECH_PRIORITY.CASUAL);
        return;
      }
      if (!stateMachine.isDancing) toggleDance();
    } else {
      if (stateMachine.isDancing) toggleDance();
    }
    syncMenuState();
  });

  window.petApi.onFollow((checked) => {
    resetInteraction();
    if (checked) {
      if (isOnCooldown('follow')) {
        say('Yoyo跑累了，歇会儿～', 3000, SPEECH_PRIORITY.CASUAL);
        return;
      }
      if (!stateMachine.isFollowing) toggleFollowMouse();
    } else {
      if (stateMachine.isFollowing) toggleFollowMouse();
    }
    syncMenuState();
  });

  window.petApi.onSleep((checked) => {
    resetInteraction();
    if (checked) {
      if (!stateMachine.isSleeping) toggleSleep();
    } else {
      if (stateMachine.isSleeping) toggleSleep();
    }
    syncMenuState();
  });

  // 键盘响应
  window.petApi.onKeyboardActivity(() => {
    const now = Date.now();

    const gapMs = state.keyboardActiveUntil > 0 ? now - state.keyboardActiveUntil : Infinity;
    const isNewSession = gapMs >= TYPING_BREAK_THRESHOLD_MS;

    if (isNewSession) {
      // 真实休息后回来，打个招呼
      if (state.keyboardActiveUntil > 0) {
        say(randomFrom(TYPING_RETURN_LINES), 3000);
      }
      state.continuousTypingStart = now;
      state.typingReminderStage = 0;
    }

    state.keyboardActiveUntil = now + 3000;
    state.lastInteractionTime = now;

    // 检查是否到达下一个提醒阶段
    const sessionMs = now - (state.continuousTypingStart || now);
    const stage = state.typingReminderStage || 0;
    if (stage < TYPING_REMINDER_STAGES.length) {
      if (sessionMs >= TYPING_REMINDER_STAGES[stage].ms) {
        state.typingReminderStage = stage + 1;
        say(randomFrom(TYPING_REMINDER_STAGES[stage].lines), 5000);
      }
    }

    if (!canStartTypingCompanion(now)) {
      debugLog('keyboard_companion_ignored', {
        stateName: state.stateName,
        actionState: stateMachine.actionState,
        currentBehavior: state.currentBehavior,
        globalMode: stateMachine.globalMode,
      });
      return;
    }

    if (state.stateName !== 'typingCompanion' && now - (state.lastTypingCompanionAt || 0) < KEYBOARD_COMPANION_MIN_INTERVAL) {
      return;
    }

    const interruptedBehavior = state.currentBehavior;
    state.lastTypingCompanionAt = now;
    state.currentBehavior = 'typingCompanion';
    state.behaviorEndTime = now + KEYBOARD_COMPANION_DURATION;
    state.keyboardActiveUntil = now + KEYBOARD_COMPANION_DURATION;
    stateMachine.transition(ACTION_STATES.TYPING_COMPANION);
    setState('typingCompanion');
      debugLog('keyboard_companion_started', {
      interruptedBehavior,
      duration: KEYBOARD_COMPANION_DURATION,
    });
    recordDailyEvent('work', { amount: 1 });
  });
}

// ===== 加载宠物 =====
export async function loadPets() {
  state.pets = await window.petApi.listPets();
  await choosePet('yoyo');
}

function loadSpriteImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = localFileUrl(src);
  });
}

async function loadPetSheets(pet) {
  const entries = Object.entries(pet.sheets || {});
  const loaded = await Promise.all(entries.map(async ([id, src]) => [id, await loadSpriteImage(src)]));
  state.spriteSheets = Object.fromEntries(loaded.filter(([, img]) => Boolean(img)));
}

export async function choosePet(id) {
  state.currentPet = normalizePetManifest(state.pets.find((pet) => pet.id === id) || state.pets[0]);
  if (!state.currentPet) return;
  state.currentFormId = state.currentPet.id;
  set('currentFormId', state.currentPet.id);
  await loadPetSheets(state.currentPet);
  state.sprite = new Image();
  state.sprite.onload = () => {
    state.activeSpritesheetPath = state.currentPet.spritesheetPath;
    applyOutfitSpritesheet();
    setState('waving');
    if (state.currentPet.id === 'gugu-gaga') {
      say('Gaga形态来陪妈妈一下下～');
    } else {
      say('Yoyo来陪妈妈啦～');
    }
  };
  state.sprite.src = localFileUrl(state.currentPet.spritesheetPath);
  window.petApi.setActiveVisual({ pet: state.currentPet, look: state.currentPet.looks?.default });
}
