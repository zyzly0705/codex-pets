// interaction.js - 拖拽 + 喂食 + 右键菜单响应 + 键盘响应 + 鞭打
import { state, canvas, feedBtn, say, setState, playSound, randomFrom, speechQueue, SPEECH_PRIORITY, isOnCooldown, setCooldown, cooldowns, FEED_SCALE_DURATION, FEED_SCALE_MAX, CLICK_MAX_DIST, CLICK_MAX_TIME, localFileUrl, globalTimers, STATES, reactionState } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { applyEmotionEvent, emotionSay, PET_DIALOGUES, WHIP_DIALOGUES, FEED_DIALOGUES } from './emotion-system.js';
import { yoyoMemory, saveMemory, addXP, trackGrowthStat, incrementAchievementStat, trackFeatureUsed, MEMORY_LINES } from './growth-system.js';
import { cancelClimb } from './climbing.js';
import { petNeeds, behaviorEngineTick, HUNGER_MESSAGES } from './behavior-engine.js';
import { applyFaceSpritesheet } from './outfit-system.js';
import { checkDailyNewsBroadcast } from './news-broadcast.js';
import { debugLog } from './debug-log.js';

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

  state.whipCount++;
  clearTimeout(state.whipResetTimeout);
  state.whipResetTimeout = setTimeout(() => { state.whipCount = 0; }, 10000);

  yoyoMemory.lastWhipTime = Date.now();
  yoyoMemory.totalWhipCount++;
  saveMemory();

  applyEmotionEvent('whip');
  trackFeatureUsed('whip');

  canvas.classList.add('shake');
  setTimeout(() => canvas.classList.remove('shake'), 300);

  // 鞭打反应状态
  const side = Math.random() > 0.5 ? 1 : -1;
  reactionState.whip = {
    phase: 'hit',
    startTime: Date.now(),
    side,
    severity: state.whipCount >= 5 ? 'heavy' : 'light',
  };

  if (state.whipCount >= 5) {
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
  if (stateMachine.isDancing) {
    stateMachine.transition(ACTION_STATES.IDLE);
    clearInterval(state.danceTimer);
    state.danceTimer = null;
    setState('failed');
    say('跳够啦～Yoyo休息一下～');
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
    setState('dancing');
    say('妈妈看！Yoyo会跳舞了！');
    applyEmotionEvent('play');
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
  return Boolean(target && (target === canvas || target === feedBtn || feedBtn.contains(target)));
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
    }

    if (dist < CLICK_MAX_DIST && elapsed < CLICK_MAX_TIME) {
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
  feedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetInteraction();
    clearTimeout(state.dismissTimeout);

    // 喂食反应：兴奋阶段
    reactionState.feed = { phase: 'excited', startTime: Date.now() };
    say('哇！有好吃的！', 2000);

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

      petNeeds.hunger = 10;
      petNeeds.boredom = Math.max(0, petNeeds.boredom - 20);
      delete cooldowns['hungry'];

      yoyoMemory.lastFedTime = Date.now();
      yoyoMemory.totalFedCount++;
      saveMemory();

      addXP(3);

      // 吃完后满足
      setTimeout(() => {
        reactionState.feed = { phase: 'satisfied', startTime: Date.now() };
        say('好饱～', 2500);
        setTimeout(() => { reactionState.feed = null; }, 3000);
      }, 2000);
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

  // 右键菜单
  canvas.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    await window.petApi.showContextMenu();
  });

  // 菜单动作
  window.petApi.onMenuAction(async (action) => {
    resetInteraction();
    if (action.startsWith('switch-pet:')) {
      const petId = action.slice('switch-pet:'.length);
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
          say('哇！Yoyo有新衣服了！');
        } else if (result.error) {
          setState('failed');
          say(result.error);
        }
        break;
      }
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
    }
  });

  // 抚摸动作
  window.petApi.onAction(() => {
    resetInteraction();
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

    if (state.keyboardActiveUntil > 0 && now - state.keyboardActiveUntil < 5000) {
      // 还在连续打字中
    } else {
      state.continuousTypingStart = now;
      state.typingReminderSent = false;
    }

    state.keyboardActiveUntil = now + 3000;
    state.lastInteractionTime = now;

    if (!state.typingReminderSent && now - state.continuousTypingStart > 30 * 60 * 1000) {
      state.typingReminderSent = true;
      say(randomFrom(['打字好久啦，手指休息一下吧～', '键盘都被敲热啦！站起来活动活动嘛～', '写了这么久，眨眨眼休息一下下吧～']));
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
  });
}

// ===== 加载宠物 =====
export async function loadPets() {
  state.pets = await window.petApi.listPets();
  await choosePet(state.pets[0]?.id);
}

export async function choosePet(id) {
  state.currentPet = state.pets.find((pet) => pet.id === id) || state.pets[0];
  if (!state.currentPet) return;
  state.sprite = new Image();
  state.sprite.onload = () => {
    state.activeSpritesheetPath = state.currentPet.spritesheetPath;
    applyFaceSpritesheet();
    setState('waving');
    say(`Yoyo来陪妈妈啦～`);
  };
  state.sprite.src = localFileUrl(state.currentPet.spritesheetPath);
  // 通知主进程更新当前 spritesheet 路径（供特效窗口使用）
  window.petApi.setActiveSpritesheet(state.currentPet.spritesheetPath);
}
