// interaction.js - 拖拽 + 喂食 + 右键菜单响应 + 键盘响应 + 鞭打
import { state, canvas, feedBtn, say, setState, playSound, randomFrom, speechQueue, SPEECH_PRIORITY, isOnCooldown, setCooldown, cooldowns, FEED_SCALE_DURATION, FEED_SCALE_MAX, CLICK_MAX_DIST, CLICK_MAX_TIME, localFileUrl, globalTimers, STATES, reactionState } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { applyEmotionEvent, emotionSay, PET_DIALOGUES, WHIP_DIALOGUES, FEED_DIALOGUES } from './emotion-system.js';
import { yoyoMemory, saveMemory, addXP, trackGrowthStat, incrementAchievementStat, trackFeatureUsed, MEMORY_LINES } from './growth-system.js';
import { cancelClimb } from './climbing.js';
import { petNeeds, behaviorEngineTick, HUNGER_MESSAGES } from './behavior-engine.js';

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

// ===== 重置闲置 =====
export function resetInteraction() {
  state.lastInteractionTime = Date.now();
  if (stateMachine.isClimbing) {
    cancelClimb();
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

  feedBtn.classList.add('show');
  window.petApi.setIgnoreMouse(false);

  state.dismissTimeout = setTimeout(() => {
    feedBtn.classList.remove('show');
    window.petApi.setIgnoreMouse(true);
    const dismissMsg = DISMISS_MESSAGES[Math.floor(Math.random() * DISMISS_MESSAGES.length)];
    setState('failed');
    say(dismissMsg);
  }, 30000);
}

// ===== 下落物理动画 =====
function startDropAnimation(posX, startY, targetY) {
  if (stateMachine.isDropping) return;
  stateMachine.transition(ACTION_STATES.DROPPING);
  let velocity = 0;
  const gravity = 1.5;
  let currentY = startY;
  let bounceCount = 0;
  const maxBounces = 3;
  const bounceFactor = 0.4;

  function frame() {
    velocity += gravity;
    currentY += velocity;

    if (currentY >= targetY) {
      currentY = targetY;
      if (bounceCount < maxBounces) {
        velocity = -(velocity * bounceFactor);
        bounceCount++;
        canvas.style.transition = 'transform 0.08s ease-out';
        canvas.style.transform = 'translateX(-50%) scaleY(0.9) scaleX(1.1)';
        playSound('bounce');
        setTimeout(() => {
          canvas.style.transform = 'translateX(-50%)';
        }, 100);
      } else {
        stateMachine.transition(ACTION_STATES.IDLE);
        canvas.style.transition = '';
        canvas.style.transform = 'translateX(-50%)';
        return;
      }
    }

    window.petApi.setPosition({ x: Math.round(posX), y: Math.round(currentY) });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
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
  reactionState.whip = { phase: 'hit', startTime: Date.now() };

  if (state.whipCount >= 5) {
    setState('crying');
    playSound('cry');
    say('呜呜呜…妈妈打了Yoyo好多次…Yoyo好委屈…', 6000);
  } else {
    setState('dizzy');
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
  petNeeds.energy = Math.max(0, petNeeds.energy - 30);
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
  }, 500);
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
  state.followInterval = setInterval(async () => {
    if (!stateMachine.isFollowing) return;

    const mousePos = await window.petApi.getMousePosition();
    const { bounds } = await window.petApi.getBounds();

    const petCenterX = bounds.x + bounds.width / 2;
    const petCenterY = bounds.y + bounds.height / 2;

    const dx = mousePos.x - petCenterX;
    const dy = mousePos.y - petCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 30) {
      setState('idle');
      return;
    }

    const speed = Math.min(5, distance * 0.1);
    const moveX = Math.round((dx / distance) * speed);
    const moveY = Math.round((dy / distance) * speed);

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
}

// ===== 抚摸重置定时器 =====
let patResetTimer = null;

// ===== 拖拽持有定时器 =====
let dragHoldTimer = null;

// ===== 初始化交互事件 =====
export function initInteraction() {
  // 单击 vs 拖拽判定
  canvas.addEventListener('pointerdown', async (event) => {
    resetInteraction();
    if (stateMachine.isDropping) return;
    canvas.setPointerCapture(event.pointerId);
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

  canvas.addEventListener('pointerup', async () => {
    if (!state.dragState) return;
    const dist = Math.sqrt(
      Math.pow(state.dragState.x - state.pointerDownPos.x, 2) +
      Math.pow(state.dragState.y - state.pointerDownPos.y, 2)
    );
    const elapsed = Date.now() - state.pointerDownTime;
    stateMachine.transition(ACTION_STATES.IDLE);
    state.dragState = null;

    // 拖拽结束反应
    clearTimeout(dragHoldTimer);
    if (reactionState.drag) {
      const wasShaken = reactionState.drag.hasShaken;
      if (dist >= CLICK_MAX_DIST || elapsed >= CLICK_MAX_TIME) {
        say(wasShaken ? '呜…头好晕好晕…' : '安全着陆～嘿嘿！', 2500);
      }
      reactionState.drag = null;
    }

    canvas.style.transition = 'transform 0.1s ease-out';
    canvas.style.transform = 'translateX(-50%)';

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
      try {
        const pos = await window.petApi.getPosition();
        const { bounds, workArea } = await window.petApi.getBounds();
        const targetY = workArea.y + workArea.height - bounds.height;
        if (pos.y < targetY - 5) {
          startDropAnimation(pos.x, pos.y, targetY);
        } else {
          doSquashBounce();
        }
      } catch (e) {
        // 获取位置失败，跳过动画
      }
    }
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

  canvas.addEventListener('mouseenter', () => {
    window.petApi.setIgnoreMouse(false);
  });

  canvas.addEventListener('mouseleave', () => {
    if (!feedBtn.classList.contains('show')) {
      window.petApi.setIgnoreMouse(true);
    }
  });

  feedBtn.addEventListener('mouseenter', () => {
    window.petApi.setIgnoreMouse(false);
  });

  feedBtn.addEventListener('mouseleave', () => {
    window.petApi.setIgnoreMouse(true);
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

    if (state.stateName === 'idle' || state.stateName === 'waiting' || state.stateName === 'lookingAround') {
      if (stateMachine.canTransition(ACTION_STATES.TYPING_COMPANION)) {
        setState('clapping');
        state.keyboardActiveUntil = now + 3000;
      }
    }
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
    setState('waving');
    say(`Yoyo来陪妈妈啦～`);
  };
  state.sprite.src = localFileUrl(state.currentPet.spritesheetPath);
  // 通知主进程更新当前 spritesheet 路径（供特效窗口使用）
  window.petApi.setActiveSpritesheet(state.currentPet.spritesheetPath);
}
