import { state, setState, isStartupQuiet, globalTimers } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { randomFrom } from './utils.js';
import { DESKTOP_TOY_STATES } from './desktop-toy-catalog.js';
import { debugLog } from './debug-log.js';
import {
  createEdgePatrolState,
  stepEdgePatrol,
} from '../shared/desktop-edge-patrol.mjs';

const TICK_MS = 55;
const EDGE_PATROL_SPEED = 5;
const START_DELAY_MS = 1000;
const RESUME_AFTER_INTERRUPT_MS = 3600;
const PATROL_SEGMENT_MS = 16000;
const PATROL_SEGMENT_JITTER_MS = 8000;
const DEBUG_STEP_INTERVAL_MS = 700;
const DEBUG_EVENTS = {
  enabled: 'desktop_edge_patrol_enabled',
  start: 'desktop_edge_patrol_start',
  step: 'desktop_edge_patrol_step',
  pause: 'desktop_edge_patrol_pause',
  stop: 'desktop_edge_patrol_stop',
  screenEdgeOnly: 'desktop_edge_patrol_screen_edge_only',
  manualPause: 'desktop_edge_patrol_manual_pause',
  error: 'desktop_edge_patrol_error',
};

const roam = {
  active: false,
  ownsWalking: false,
  mode: 'pause',
  edgeState: null,
  nextSwitchAt: 0,
  pausedUntil: 0,
  moving: false,
  lastDebugStepAt: 0,
  lastDebugSignature: '',
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

function compactRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(Number(rect.x) || 0),
    y: Math.round(Number(rect.y) || 0),
    width: Math.round(Number(rect.width) || 0),
    height: Math.round(Number(rect.height) || 0),
  };
}

function logPatrol(type, payload = {}) {
  debugLog(DEBUG_EVENTS[type] || `desktop_edge_patrol_${type}`, {
    mode: roam.mode,
    ownsWalking: roam.ownsWalking,
    actionState: stateMachine.actionState,
    behavior: state.currentBehavior || 'idle',
    edge: roam.edgeState?.edge || null,
    ...payload,
  });
}

function logPatrolStep(step, bounds, workArea) {
  const timestamp = now();
  const signature = `${step.edge}:${step.mode}:${step.stateName}`;
  if (signature === roam.lastDebugSignature && timestamp - roam.lastDebugStepAt < DEBUG_STEP_INTERVAL_MS) {
    return;
  }
  roam.lastDebugSignature = signature;
  roam.lastDebugStepAt = timestamp;
  logPatrol('step', {
    edge: step.edge,
    stepMode: step.mode,
    stateName: step.stateName,
    delta: {
      x: Math.round(Number(step.delta?.x) || 0),
      y: Math.round(Number(step.delta?.y) || 0),
    },
    gravityVy: Math.round(Number(step.state?.gravityVy) || 0),
    bounds: compactRect(bounds),
    workArea: compactRect(workArea),
  });
}

function canRoam() {
  if (!roam.active || !window.petApi?.getBounds || !window.petApi?.setPosition) return false;
  if (isStartupQuiet()) return false;
  if (now() < roam.pausedUntil) return false;
  if (stateMachine.globalMode !== GLOBAL_MODES.INTERACTIVE) return false;
  const ownsMovement = roam.ownsWalking && [
    ACTION_STATES.WALKING,
    ACTION_STATES.CLIMBING,
  ].includes(stateMachine.actionState);
  if (stateMachine.actionState !== ACTION_STATES.IDLE && !ownsMovement) {
    return false;
  }
  if (state.currentBehavior && !['idle', 'walk'].includes(state.currentBehavior)) return false;
  if (state.manualEffectUntil && now() < state.manualEffectUntil) return false;
  if (state.activePerformance) return false;
  return true;
}

function stopOwnedWalk(nextState = 'idle') {
  const wasOwning = roam.ownsWalking;
  if (roam.ownsWalking && [
    ACTION_STATES.WALKING,
    ACTION_STATES.CLIMBING,
  ].includes(stateMachine.actionState)) {
    stateMachine.transition(ACTION_STATES.IDLE);
  }
  roam.ownsWalking = false;
  roam.mode = 'pause';
  setEdgeVisual('', 'pause');
  setState(nextState);
  if (wasOwning) logPatrol('stop', { nextState });
}

function startPause() {
  stopOwnedWalk(choosePauseState());
  roam.nextSwitchAt = now() + 1800 + Math.random() * 3600;
  logPatrol('pause', {
    nextSwitchInMs: Math.round(roam.nextSwitchAt - now()),
  });
}

function setEdgeVisual(edge, mode) {
  const app = document.getElementById('app');
  if (!app) return;
  if (edge) app.setAttribute('data-edge-patrol-edge', edge);
  else app.removeAttribute('data-edge-patrol-edge');
  if (mode) app.setAttribute('data-edge-patrol-mode', mode);
  else app.removeAttribute('data-edge-patrol-mode');
}

function startPatrol(bounds, workArea) {
  if (!stateMachine.transition(ACTION_STATES.WALKING)) return;
  roam.ownsWalking = true;
  roam.mode = 'patrol';
  roam.edgeState = createEdgePatrolState(bounds, workArea, roam.edgeState || {});
  roam.nextSwitchAt = now() + PATROL_SEGMENT_MS + Math.random() * PATROL_SEGMENT_JITTER_MS;
  setEdgeVisual(roam.edgeState.edge, 'patrol');
  logPatrol('start', {
    bounds: compactRect(bounds),
    workArea: compactRect(workArea),
    nextSwitchInMs: Math.round(roam.nextSwitchAt - now()),
  });
  logPatrol('screenEdgeOnly', {
    reason: 'desktop-patrol-stays-on-work-area-edges',
  });
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

    if (roam.mode !== 'patrol') {
      if (now() >= roam.nextSwitchAt) startPatrol(bounds, workArea);
      return;
    }

    if (now() >= roam.nextSwitchAt) {
      startPause();
      return;
    }

    const step = stepEdgePatrol(roam.edgeState, bounds, workArea, { speed: EDGE_PATROL_SPEED });
    roam.edgeState = step.state;
    setEdgeVisual(step.edge, step.mode);
    logPatrolStep(step, bounds, workArea);
    setState(step.stateName || DESKTOP_TOY_STATES.walk.right.stateName);
    await window.petApi.setPosition(step.target || {
      x: bounds.x + step.delta.x,
      y: bounds.y + step.delta.y,
    });
  } catch (error) {
    logPatrol('error', { message: error?.message || String(error) });
    stopOwnedWalk('idle');
  } finally {
    roam.moving = false;
  }
}

export function pauseDesktopRoaming(durationMs = RESUME_AFTER_INTERRUPT_MS) {
  roam.pausedUntil = now() + durationMs;
  logPatrol('manualPause', { durationMs });
  if (roam.ownsWalking) stopOwnedWalk('idle');
}

export function startDesktopRoaming() {
  if (roam.active) return;
  roam.active = true;
  roam.nextSwitchAt = now() + START_DELAY_MS;
  logPatrol('enabled', {
    startDelayMs: START_DELAY_MS,
    tickMs: TICK_MS,
    speed: EDGE_PATROL_SPEED,
  });
  globalTimers.push(setInterval(tickRoaming, TICK_MS));
}
