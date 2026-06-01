// climbing.js - 攀爬系统
import { state, canvas, setState } from './core-state.js';
import { randomFrom } from './utils.js';
import { say } from './speech-queue.js';
import { stateMachine, ACTION_STATES } from './state-machine.js';
import { incrementAchievementStat, trackFeatureUsed } from './growth-system.js';
import { debugLog } from './debug-log.js';

// 攀爬常量
const CLIMB_MOVE_SPEED = 3;
const CLIMB_MOVE_INTERVAL = 50;
const CLIMB_PERCH_MIN = 2000;
const CLIMB_PERCH_MAX = 5000;
const CLIMB_PEEK_DURATION = 3000;

export const CLIMB_START_MESSAGES = [
  'Yoyo要去探险啦！冲冲冲！',
  '妈妈快看！Yoyo要爬上去了！',
  '嘿嘿，Yoyo最勇敢了对不对？',
  '上面有什么好玩的呀？Yoyo去看看！',
  '妈妈等着哦，Yoyo马上就回来～',
];

const CLIMB_PERCH_MESSAGES = [
  '嘿嘿，Yoyo在这里能看到妈妈哦～',
  '好高呀！但是Yoyo不怕不怕！',
  '妈妈妈妈！Yoyo在上面呢！',
  '趴在这里好舒服呀～风呼呼吹～',
  '妈妈在下面干什么呀？Yoyo偷偷看～',
];

export const CLIMB_DESCEND_MESSAGES = [
  '咻～Yoyo回来啦！想妈妈啦～',
  '下来了下来了～妈妈抱抱抱抱！',
  '探险结束！Yoyo好厉害吧？嘿嘿～',
  '还是妈妈身边最安全最舒服～',
  '回到地面啦！妈妈我回来了！',
];

const CLIMB_PEEK_MESSAGES = [
  '妈妈！看Yoyo躲在这里！',
  '嘘…妈妈发现Yoyo了吗？',
  '露个小脑袋～嘿嘿嘿嘿～',
  '从上面偷偷看妈妈～好好玩！',
];

export function stopClimbing() {
  stateMachine.transition(ACTION_STATES.IDLE);
  state.climbPhase = 'idle';
  state.climbTarget = null;
  state.climbEdgeType = null;
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
  if (!stateMachine.isClimbing) return;
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
      if (!stateMachine.isClimbing && !state.climbOriginPos) {
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
      } else {
        // 垂直移动也保持直立跑动，避免横向爬墙素材让脚朝边缘。
        setState(dy < 0 ? 'runningLeft' : 'runningRight');
      }
    }, CLIMB_MOVE_INTERVAL);
  });
}

export async function startClimbing(options = {}) {
  if (stateMachine.isClimbing) return;
  if (!stateMachine.canTransition(ACTION_STATES.CLIMBING)) return;
  if (stateMachine.isDancing || stateMachine.isFollowing || stateMachine.isWhipping) return;
  if (state.feedingLock) return;
  if (state.dragState) return;

  const { workArea } = await window.petApi.getBounds();
  const currentPos = await window.petApi.getPosition();
  debugLog('climb_start', {
    options,
    currentPos,
    workArea,
    canScanWindows: state.canScanWindows,
  });

  state.climbOriginPos = { x: currentPos.x, y: currentPos.y };
  stateMachine.transition(ACTION_STATES.CLIMBING);

  say(randomFrom(CLIMB_START_MESSAGES));

  let targetType = 'screen-edge';
  let targetBounds = null;
  let scanUnavailableReason = null;

  if (state.canScanWindows) {
    try {
      const scanResult = await window.petApi.scanWindows();
      debugLog('climb_scan_windows', {
        ok: scanResult.ok,
        count: scanResult.windows?.length || 0,
        hasAccessibility: scanResult.hasAccessibility,
        screenRecordingStatus: scanResult.screenRecordingStatus || null,
        processPath: scanResult.processPath || null,
        windowScanSource: scanResult.windowScanSource || null,
        systemEventsStatus: scanResult.systemEventsStatus || null,
        scanUnavailableReason: scanResult.windowScanUnavailableReason || null,
      });
      scanUnavailableReason = scanResult.windowScanUnavailableReason || null;
      if (scanResult.ok && scanResult.windows.length > 0) {
        if (options.preferWindow || Math.random() < 0.5) {
          const targetWindow = randomFrom(scanResult.windows);
          targetType = 'window';
          targetBounds = targetWindow.bounds;
        }
      }
    } catch (error) {
      scanUnavailableReason = 'renderer-scan-exception';
      debugLog('climb_scan_windows_error', {
        message: error?.message || String(error),
        scanUnavailableReason: 'renderer-scan-exception',
      });
      // 扫描失败，降级到屏幕边缘
    }
  }

  if (targetType === 'window' && targetBounds) {
    state.climbTarget = targetBounds;
    debugLog('climb_target', { targetType, targetBounds });
    await climbToWindow(targetBounds, workArea);
  } else {
    state.climbTarget = null;
    debugLog('climb_target', {
      targetType: 'screen-edge',
      targetBounds: null,
      scanUnavailableReason: scanUnavailableReason || 'no-window-target',
    });
    await climbToScreenEdge(workArea);
  }
}

async function climbToScreenEdge(workArea) {
  state.climbPhase = 'approaching';

  const edgeType = Math.floor(Math.random() * 3);
  state.climbEdgeType = edgeType;  // 记录边类型，供 perching/peeking 阶段使用
  let targetX, targetY;

  if (edgeType === 0) {
    // 顶边：窗口大幅上移，使角色从屏幕顶部探出约 50px
    targetX = workArea.x + Math.random() * (workArea.width - 200);
    targetY = workArea.y - 200;
  } else if (edgeType === 1) {
    // 左边：窗口略出屏幕左侧，旋转后角色贴左墙
    targetX = workArea.x - 50;
    targetY = workArea.y + 40 + Math.random() * Math.max(0, workArea.height - 340);
  } else {
    // 右边：窗口略出屏幕右侧，旋转后角色贴右墙
    targetX = workArea.x + workArea.width - 150;
    targetY = workArea.y + 40 + Math.random() * Math.max(0, workArea.height - 340);
  }
  debugLog('climb_screen_edge_target', { edgeType, targetX, targetY, workArea });

  state.climbPhase = 'climbing';
  setState(edgeType === 1 ? 'runningLeft' : 'runningRight');

  // 边缘停靠只移动窗口位置，不再旋转整张角色贴图。
  canvas.style.transform = 'translateX(-50%)';

  await smoothMoveTo(targetX, targetY, CLIMB_MOVE_SPEED);

  if (!stateMachine.isClimbing) return;

  state.climbPhase = 'perching';
  setState('waving');
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  state.climbPerchTimeout = setTimeout(async () => {
    if (!stateMachine.isClimbing) return;

    if (Math.random() < 0.5) {
      state.climbPhase = 'peeking';
      say(randomFrom(CLIMB_PEEK_MESSAGES));
      setState('waving');

      const pos = await window.petApi.getPosition();
      if (edgeType === 0) {
        // 顶边：再向上缩一点，藏得更深
        await window.petApi.setPosition({ x: pos.x, y: pos.y - 20 });
      } else if (edgeType === 1) {
        // 左边：向左再移，更多藏入屏幕外
        await window.petApi.setPosition({ x: pos.x - 20, y: pos.y });
      } else {
        // 右边：向右再移
        await window.petApi.setPosition({ x: pos.x + 20, y: pos.y });
      }

      state.climbPeekTimeout = setTimeout(() => {
        if (!stateMachine.isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function climbToWindow(windowBounds, workArea) {
  state.climbPhase = 'approaching';
  state.climbEdgeType = 0;

  const targetX = windowBounds.x + windowBounds.width / 2 - 100;
  const targetY = windowBounds.y - 130;

  const clampedX = Math.max(workArea.x - 80, Math.min(workArea.x + workArea.width - 120, targetX));
  const clampedY = Math.max(workArea.y - 130, targetY);
  debugLog('climb_window_target', { windowBounds, targetX, targetY, clampedX, clampedY });

  state.climbPhase = 'climbing';
  setState('runningRight');

  await smoothMoveTo(clampedX, clampedY, CLIMB_MOVE_SPEED);

  if (!stateMachine.isClimbing) return;

  state.climbPhase = 'perching';
  setState('waving');
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  state.climbPerchTimeout = setTimeout(async () => {
    if (!stateMachine.isClimbing) return;

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
        if (!stateMachine.isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function descendFromClimb() {
  if (!stateMachine.isClimbing) return;
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
    if (result.windowScanUnavailableReason) {
      debugLog('climb_window_scan_unavailable', {
        ok: result.ok,
        hasAccessibility: result.hasAccessibility,
        screenRecordingStatus: result.screenRecordingStatus || null,
        processPath: result.processPath || null,
        windowScanSource: result.windowScanSource || null,
        systemEventsStatus: result.systemEventsStatus || null,
        scanUnavailableReason: result.windowScanUnavailableReason,
      });
      if (!result.hasAccessibility) {
        console.log('[攀爬系统] 缺少窗口扫描权限，仅支持屏幕边缘攀爬');
      }
    }
  } catch {
    state.canScanWindows = false;
  }
}
