import { state, setState, isStartupQuiet, globalTimers } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { randomFrom } from './utils.js';
import { DESKTOP_TOY_STATES } from './desktop-toy-catalog.js';

const TICK_MS = 55;
const WALK_SPEED = 6;
const EDGE_PADDING = 12;
const START_DELAY_MS = 9000;
const RESUME_AFTER_INTERRUPT_MS = 3600;

const roam = {
  active: false,
  ownsWalking: false,
  mode: 'pause',
  direction: -1,
  nextSwitchAt: 0,
  pausedUntil: 0,
  moving: false,
};

function now() {
  return Date.now();
}

function choosePauseState() {
  const pool = [];
  for (const item of DESKTOP_TOY_STATES.pauses || []) {
    const weight = Math.max(1, Number(item.weight || 1));
    for (let i = 0; i < weight; i++) pool.push(item.stateName);
  }
  return randomFrom(pool) || 'idle';
}

function canRoam() {
  if (!roam.active || !window.petApi?.getBounds || !window.petApi?.moveBy) return false;
  if (isStartupQuiet()) return false;
  if (now() < roam.pausedUntil) return false;
  if (stateMachine.globalMode !== GLOBAL_MODES.INTERACTIVE) return false;
  if (stateMachine.actionState !== ACTION_STATES.IDLE && !(roam.ownsWalking && stateMachine.actionState === ACTION_STATES.WALKING)) {
    return false;
  }
  if (state.currentBehavior && state.currentBehavior !== 'idle') return false;
  if (state.manualEffectUntil && now() < state.manualEffectUntil) return false;
  if (state.activePerformance) return false;
  return true;
}

function stopOwnedWalk(nextState = 'idle') {
  if (roam.ownsWalking && stateMachine.actionState === ACTION_STATES.WALKING) {
    stateMachine.transition(ACTION_STATES.IDLE);
  }
  roam.ownsWalking = false;
  roam.mode = 'pause';
  setState(nextState);
}

function startPause() {
  stopOwnedWalk(choosePauseState());
  roam.nextSwitchAt = now() + 1800 + Math.random() * 3600;
}

function startWalk(bounds, workArea) {
  if (!stateMachine.transition(ACTION_STATES.WALKING)) return;
  roam.ownsWalking = true;
  roam.mode = 'walk';

  const nearLeft = bounds.x <= workArea.x + EDGE_PADDING;
  const nearRight = bounds.x + bounds.width >= workArea.x + workArea.width - EDGE_PADDING;
  if (nearLeft) roam.direction = 1;
  else if (nearRight) roam.direction = -1;
  else roam.direction = Math.random() > 0.5 ? 1 : -1;

  setState(roam.direction > 0 ? DESKTOP_TOY_STATES.walk.right.stateName : DESKTOP_TOY_STATES.walk.left.stateName);
  roam.nextSwitchAt = now() + 3200 + Math.random() * 5200;
}

async function keepOnDesktopFloor(bounds, workArea) {
  const floorY = workArea.y + workArea.height - bounds.height;
  if (Math.abs(bounds.y - floorY) > 8) {
    await window.petApi.setPosition({ x: bounds.x, y: floorY });
  }
}

async function tickRoaming() {
  if (roam.moving) return;
  if (!canRoam()) {
    if (roam.ownsWalking) stopOwnedWalk('idle');
    return;
  }

  roam.moving = true;
  try {
    const { bounds, workArea } = await window.petApi.getBounds();
    await keepOnDesktopFloor(bounds, workArea);

    if (roam.mode !== 'walk') {
      if (now() >= roam.nextSwitchAt) startWalk(bounds, workArea);
      return;
    }

    if (now() >= roam.nextSwitchAt) {
      startPause();
      return;
    }

    const moved = await window.petApi.moveBy({ x: roam.direction * WALK_SPEED, y: 0 });
    const hitLeft = moved.x <= workArea.x + EDGE_PADDING;
    const hitRight = moved.x + bounds.width >= workArea.x + workArea.width - EDGE_PADDING;
    if (hitLeft || hitRight) {
      roam.direction = hitLeft ? 1 : -1;
      setState(roam.direction > 0 ? DESKTOP_TOY_STATES.walk.right.stateName : DESKTOP_TOY_STATES.walk.left.stateName);
      roam.nextSwitchAt = now() + 2200 + Math.random() * 3200;
    }
  } catch {
    stopOwnedWalk('idle');
  } finally {
    roam.moving = false;
  }
}

export function pauseDesktopRoaming(durationMs = RESUME_AFTER_INTERRUPT_MS) {
  roam.pausedUntil = now() + durationMs;
  if (roam.ownsWalking) stopOwnedWalk('idle');
}

export function startDesktopRoaming() {
  if (roam.active) return;
  roam.active = true;
  roam.nextSwitchAt = now() + START_DELAY_MS;
  globalTimers.push(setInterval(tickRoaming, TICK_MS));
}
