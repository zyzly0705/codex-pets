// climbing.js - 攀爬系统
import { state, canvas, randomFrom, say, setState } from './core-state.js';
import { stateMachine, ACTION_STATES } from './state-machine.js';
import { incrementAchievementStat, trackFeatureUsed } from './growth-system.js';

// 攀爬常量
const CLIMB_MOVE_SPEED = 3;
const CLIMB_MOVE_INTERVAL = 50;
const CLIMB_PERCH_MIN = 2000;
const CLIMB_PERCH_MAX = 5000;
const CLIMB_PEEK_DURATION = 3000;

export const CLIMB_START_MESSAGES = [
  'Yoyo要去探险啦！',
  '妈妈看！Yoyo要爬上去了！',
  '嘿嘿，Yoyo最勇敢了～',
  '上面有什么好玩的？Yoyo去看看！',
  '妈妈等着，Yoyo马上回来～'
];

const CLIMB_PERCH_MESSAGES = [
  '嘿嘿，Yoyo在这里能看到妈妈～',
  '好高呀！Yoyo不怕不怕～',
  '妈妈！Yoyo在上面哦！',
  '趴在这里好舒服～风吹吹的～',
  '妈妈在下面干什么呀？'
];

export const CLIMB_DESCEND_MESSAGES = [
  '咻～Yoyo回来啦！想妈妈了～',
  '下来了下来了～妈妈抱抱！',
  '探险结束！Yoyo好厉害吧！',
  '还是妈妈身边最安全～',
  '回到地面啦！嘿嘿～'
];

const CLIMB_PEEK_MESSAGES = [
  '妈妈！看Yoyo在这里！',
  '嘘...妈妈发现Yoyo了吗？',
  '露个小脑袋～嘿嘿～',
  '从上面偷偷看妈妈～'
];

export function stopClimbing() {
  stateMachine.transition(ACTION_STATES.IDLE);
  state.isClimbing = false;
  state.climbPhase = 'idle';
  state.climbTarget = null;
  if (state.climbAnimTimer) {
    clearInterval(state.climbAnimTimer);
    state.climbAnimTimer = null;
  }
  if (state.climbPerchTimeout) {
    clearTimeout(state.climbPerchTimeout);
    state.climbPerchTimeout = null;
  }
  if (state.climbPeekTimeout) {
    clearTimeout(state.climbPeekTimeout);
    state.climbPeekTimeout = null;
  }
  canvas.style.transform = 'translateX(-50%)';
}

export async function cancelClimb() {
  if (!state.isClimbing) return;
  stopClimbing();
  say(randomFrom(CLIMB_DESCEND_MESSAGES));
  if (state.climbOriginPos) {
    await smoothMoveTo(state.climbOriginPos.x, state.climbOriginPos.y, 4);
  }
  state.climbOriginPos = null;
  setState('idle');
}

async function smoothMoveTo(targetX, targetY, speed) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (!state.isClimbing && !state.climbOriginPos) {
        await window.petApi.setPosition({ x: targetX, y: targetY });
        clearInterval(timer);
        resolve();
        return;
      }
      const pos = await window.petApi.getPosition();
      const dx = targetX - pos.x;
      const dy = targetY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < speed + 1) {
        await window.petApi.setPosition({ x: targetX, y: targetY });
        clearInterval(timer);
        resolve();
        return;
      }
      const moveX = Math.round((dx / dist) * speed);
      const moveY = Math.round((dy / dist) * speed);
      await window.petApi.setPosition({ x: pos.x + moveX, y: pos.y + moveY });
      if (Math.abs(dx) > Math.abs(dy)) {
        setState(dx > 0 ? 'runningRight' : 'runningLeft');
      }
    }, CLIMB_MOVE_INTERVAL);
  });
}

export async function startClimbing() {
  if (state.isClimbing) return;
  if (!stateMachine.canTransition(ACTION_STATES.CLIMBING)) return;
  if (state.isDancing || state.isSleeping || state.isFollowing || state.isWhipRunning) return;
  if (state.feedingLock) return;
  if (state.dragState) return;

  const { workArea } = await window.petApi.getBounds();
  const currentPos = await window.petApi.getPosition();

  state.climbOriginPos = { x: currentPos.x, y: currentPos.y };
  stateMachine.transition(ACTION_STATES.CLIMBING);
  state.isClimbing = true;

  say(randomFrom(CLIMB_START_MESSAGES));

  let targetType = 'screen-edge';
  let targetBounds = null;

  if (state.canScanWindows) {
    try {
      const scanResult = await window.petApi.scanWindows();
      if (scanResult.ok && scanResult.windows.length > 0) {
        if (Math.random() < 0.5) {
          const targetWindow = randomFrom(scanResult.windows);
          targetType = 'window';
          targetBounds = targetWindow.bounds;
        }
      }
    } catch {
      // 扫描失败，降级到屏幕边缘
    }
  }

  if (targetType === 'window' && targetBounds) {
    await climbToWindow(targetBounds, workArea);
  } else {
    await climbToScreenEdge(workArea);
  }
}

async function climbToScreenEdge(workArea) {
  state.climbPhase = 'approaching';

  const edgeType = Math.floor(Math.random() * 3);
  let targetX, targetY;

  if (edgeType === 0) {
    targetX = workArea.x + Math.random() * (workArea.width - 200);
    targetY = workArea.y - 100;
  } else if (edgeType === 1) {
    targetX = workArea.x - 80;
    targetY = workArea.y + Math.random() * (workArea.height - 260);
  } else {
    targetX = workArea.x + workArea.width - 120;
    targetY = workArea.y + Math.random() * (workArea.height - 260);
  }

  state.climbPhase = 'climbing';
  setState('climbing');

  if (edgeType === 0) {
    canvas.style.transform = 'translateX(-50%)';
  }

  await smoothMoveTo(targetX, targetY, CLIMB_MOVE_SPEED);

  if (!state.isClimbing) return;

  state.climbPhase = 'perching';
  setState('perching');
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  state.climbPerchTimeout = setTimeout(async () => {
    if (!state.isClimbing) return;

    if (Math.random() < 0.5) {
      state.climbPhase = 'peeking';
      say(randomFrom(CLIMB_PEEK_MESSAGES));
      setState('waving');

      const peekOffset = edgeType === 0 ? -30 : (edgeType === 1 ? -30 : 30);
      const pos = await window.petApi.getPosition();
      if (edgeType === 0) {
        await window.petApi.setPosition({ x: pos.x, y: pos.y - 20 });
      } else {
        await window.petApi.setPosition({ x: pos.x + peekOffset, y: pos.y });
      }

      state.climbPeekTimeout = setTimeout(() => {
        if (!state.isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function climbToWindow(windowBounds, workArea) {
  state.climbPhase = 'approaching';

  const targetX = windowBounds.x + windowBounds.width / 2 - 100;
  const targetY = windowBounds.y - 130;

  const clampedX = Math.max(workArea.x - 80, Math.min(workArea.x + workArea.width - 120, targetX));
  const clampedY = Math.max(workArea.y - 130, targetY);

  state.climbPhase = 'climbing';
  setState('climbing');

  await smoothMoveTo(clampedX, clampedY, CLIMB_MOVE_SPEED);

  if (!state.isClimbing) return;

  state.climbPhase = 'perching';
  setState('perching');
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  state.climbPerchTimeout = setTimeout(async () => {
    if (!state.isClimbing) return;

    if (Math.random() < 0.3) {
      state.climbPhase = 'peeking';
      say(randomFrom(CLIMB_PEEK_MESSAGES));
      setState('waving');

      const pos = await window.petApi.getPosition();
      const peekX = Math.random() < 0.5
        ? windowBounds.x - 60
        : windowBounds.x + windowBounds.width - 140;
      await smoothMoveTo(peekX, pos.y, 2);

      state.climbPeekTimeout = setTimeout(() => {
        if (!state.isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function descendFromClimb() {
  if (!state.isClimbing) return;
  state.climbPhase = 'descending';
  say(randomFrom(CLIMB_DESCEND_MESSAGES));
  setState('jumping');

  canvas.style.transform = 'translateX(-50%)';

  if (state.climbOriginPos) {
    await smoothMoveTo(state.climbOriginPos.x, state.climbOriginPos.y, 4);
  }

  stopClimbing();
  state.climbOriginPos = null;
  setState('idle');
}

export async function initClimbSystem() {
  try {
    const result = await window.petApi.scanWindows();
    state.canScanWindows = result.ok;
    if (!result.hasAccessibility && result.ok === false) {
      console.log('[攀爬系统] 无辅助功能权限，仅支持屏幕边缘攀爬');
    }
  } catch {
    state.canScanWindows = false;
  }
}
