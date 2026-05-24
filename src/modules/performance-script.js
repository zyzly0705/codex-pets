import { state, say, setState, SPEECH_PRIORITY, speechQueue } from './core-state.js';
import { stateMachine, ACTION_STATES } from './state-machine.js';
import { applyEmotionEvent } from './emotion-system.js';
import { debugLog } from './debug-log.js';

const timers = new Set();

export const PERFORMANCE_SCRIPTS = {
  danceLetGo: {
    behavior: 'dance',
    state: 'dancing',
    duration: 5400,
    lock: true,
    endState: 'bashful',
    emotion: 'play',
    timeline: [
      { at: 0, expression: 'look_user', say: '妈妈，看这个。', duration: 1900 },
      { at: 850, expression: 'focused' },
      { at: 2100, expression: 'happy' },
      { at: 4050, expression: 'bashful', say: '嘿嘿，刚刚那下还行吧。', duration: 2500 },
    ],
  },
  swingScene: {
    behavior: 'swing',
    state: 'swing',
    duration: 7600,
    lock: true,
    endState: 'happyIdle',
    emotion: 'happy',
    timeline: [
      { at: 0, expression: 'anticipation', say: '我先坐稳哦。', duration: 1800 },
      { at: 1200, expression: 'excited' },
      { at: 5200, expression: 'relaxed', say: '风刚刚好。', duration: 2400 },
    ],
  },
  fanCoolingScene: {
    behavior: 'fanCooling',
    state: 'fanCooling',
    duration: 7200,
    lock: true,
    endState: 'idle',
    emotion: 'calm',
    timeline: [
      { at: 0, expression: 'hot', say: '热乎乎的，吹一下风。', duration: 2400 },
      { at: 2200, expression: 'relaxed' },
      { at: 5200, expression: 'happy', say: '舒服多啦。', duration: 2200 },
    ],
  },
  swimmingScene: {
    behavior: 'swimming',
    state: 'swimming',
    duration: 8000,
    lock: true,
    endState: 'idle',
    emotion: 'happy',
    timeline: [
      { at: 0, expression: 'ready', say: '我下水啦。', duration: 1800 },
      { at: 1600, expression: 'focused' },
      { at: 4200, expression: 'sparkle', say: '水凉凉的，好舒服。', duration: 2800 },
    ],
  },
  airConditioningScene: {
    behavior: 'airConditioning',
    state: 'airConditioning',
    duration: 7600,
    lock: true,
    endState: 'idle',
    emotion: 'calm',
    timeline: [
      { at: 0, expression: 'hot', say: '我站在风下面一小会。', duration: 2600 },
      { at: 2600, expression: 'relaxed' },
      { at: 5600, expression: 'sleepy', say: '有点想眯一下。', duration: 2200 },
    ],
  },
  sofaLyingScene: {
    behavior: 'sofaLying',
    state: 'sofaLying',
    duration: 9000,
    lock: true,
    endState: 'sleeping',
    emotion: 'relaxed',
    timeline: [
      { at: 0, expression: 'tired', say: '我躺一下，就一下。', duration: 2400 },
      { at: 2600, expression: 'relaxed' },
      { at: 6200, expression: 'sleepy', say: '这个沙发好会抱人。', duration: 3000 },
    ],
  },
  cloneHeart: {
    behavior: 'clone',
    state: 'clapping',
    duration: 6500,
    lock: true,
    endState: 'bashful',
    emotion: 'happy',
    timeline: [
      { at: 0, expression: 'proud', say: '看好了哦。', duration: 1600 },
      { at: 3600, expression: 'heart' },
      { at: 5050, expression: 'bashful', say: '都在喜欢妈妈。', duration: 2600 },
    ],
  },
  dharmaManifest: {
    behavior: 'giant',
    state: 'clapping',
    duration: 9000,
    lock: true,
    endState: 'idle',
    emotion: 'happy',
    timeline: [
      { at: 0, expression: 'focused', say: '我要认真一点了。', duration: 1800 },
      { at: 1600, expression: 'sparkle', say: '法相天地。', duration: 2600 },
      { at: 7200, expression: 'tired', say: '呼，收回来。', duration: 2400 },
    ],
  },
};

function clearPerformanceTimers() {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
}

function schedule(fn, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
}

function normalizeEndState(endState) {
  if (endState === 'happyIdle') return 'idle';
  return endState || 'idle';
}

export function isPerformanceLocked(now = Date.now()) {
  return Boolean(state.activePerformance?.lockUntil && now < state.activePerformance.lockUntil);
}

export function endPerformance(reason = 'ended') {
  const active = state.activePerformance;
  if (!active) return;
  clearPerformanceTimers();
  const endState = normalizeEndState(active.endState);
  state.activePerformance = null;
  state.performanceExpression = null;
  state.manualEffectUntil = 0;
  if (state.currentBehavior === active.behavior) {
    state.currentBehavior = null;
    state.behaviorEndTime = 0;
  }
  if (endState) setState(endState);
  if (stateMachine.actionState === ACTION_STATES.DANCING) {
    stateMachine.transition(ACTION_STATES.IDLE);
  }
  debugLog('performance_ended', {
    id: active.id,
    behavior: active.behavior,
    reason,
    endState,
  });
}

export function startPerformance(id, options = {}) {
  const script = PERFORMANCE_SCRIPTS[id];
  if (!script) return false;
  if (isPerformanceLocked() && !options.force) {
    debugLog('performance_rejected', {
      id,
      reason: 'locked',
      active: state.activePerformance?.id,
    });
    return false;
  }

  endPerformance('replaced');
  const now = Date.now();
  const duration = Number(options.duration || script.duration || 5000);
  const behavior = options.behavior || script.behavior || id;
  state.activePerformance = {
    id,
    behavior,
    startedAt: now,
    duration,
    lockUntil: script.lock === false ? 0 : now + duration,
    endState: options.endState || script.endState || 'idle',
    manual: Boolean(options.manual),
  };
  state.currentBehavior = behavior;
  state.behaviorEndTime = now + duration;
  if (script.lock !== false) state.manualEffectUntil = now + duration;
  if (script.state) setState(script.state);
  if (script.emotion) applyEmotionEvent(script.emotion);

  for (const event of script.timeline || []) {
    schedule(() => {
      if (state.activePerformance?.id !== id) return;
      if (event.expression) state.performanceExpression = event.expression;
      if (event.state) setState(event.state);
      if (event.say) {
        const priority = options.manual ? SPEECH_PRIORITY.IMPORTANT : SPEECH_PRIORITY.BEHAVIOR;
        speechQueue.enqueue(event.say, event.duration || 2600, priority);
      }
      debugLog('performance_event', {
        id,
        at: event.at,
        expression: event.expression || '',
        state: event.state || '',
        say: Boolean(event.say),
      });
    }, Number(event.at || 0));
  }

  schedule(() => {
    if (state.activePerformance?.id === id) endPerformance('timeout');
  }, duration + 80);

  debugLog('performance_started', {
    id,
    behavior,
    state: script.state,
    duration,
    manual: Boolean(options.manual),
  });
  return true;
}

export function adoptManualEffect(type, duration) {
  const map = {
    clone: 'cloneHeart',
    giant: 'dharmaManifest',
  };
  const id = map[type];
  if (!id) return false;
  if (Number(duration || 0) <= 0) {
    if (state.activePerformance?.id === id) endPerformance('manual_effect_closed');
    return true;
  }
  return startPerformance(id, { manual: true, duration, force: true });
}
