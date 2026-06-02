import {
  getHomeObjectById,
  HOME_TASK_LIFECYCLE,
  YOYO_HOME_MANIFEST,
} from '../data/home-manifest.mjs';

const NEED_BASELINE = {
  hunger: 70,
  energy: 70,
  hygiene: 70,
  fun: 60,
  focus: 55,
  affection: 65,
  mood: 62,
};

const NEED_DECAY_PER_MINUTE = {
  hunger: 0.08,
  energy: 0.06,
  hygiene: 0.04,
  fun: 0.07,
  focus: 0.03,
  affection: 0.035,
  mood: 0.025,
};

const ACTION_DELTAS = {
  feed: { hunger: 35, mood: 8, affection: 2 },
  sleep: { energy: 32, mood: 4 },
  bath: { hygiene: 35, mood: 5 },
  play: { fun: 30, mood: 7, affection: 3 },
  comfort: { affection: 24, mood: 8 },
  study: { focus: 26, mood: 3 },
  watchAnime: { fun: 20, mood: 6 },
  playSwitch: { fun: 24, focus: 4, mood: 5 },
  buildBlocks: { fun: 22, focus: 8, mood: 5 },
};

function clampNeed(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function appendEventLog(state, event) {
  return [...state.eventLog, { ...event, index: state.eventLog.length }].slice(-200);
}

export function createHomeState(options = {}) {
  const now = options.now || 0;
  return {
    now,
    lastTickAt: now,
    needs: { ...NEED_BASELINE, ...(options.needs || {}) },
    relationship: { intimacy: options.intimacy || 0, xp: options.xp || 0 },
    currentTask: null,
    activeTask: null,
    activeMiniGame: null,
    roomEntities: Object.fromEntries(
      (options.manifest || YOYO_HOME_MANIFEST).objects.map((object) => [
        object.id,
        { id: object.id, state: 'idle', cooldownUntil: 0, aftermath: null },
      ]),
    ),
    aftermath: null,
    dailyQuests: {},
    cooldowns: {},
    rngSeed: options.rngSeed || 1,
    eventLog: [],
  };
}

export function decayNeeds(needs, elapsedMs) {
  const minutes = Math.max(0, elapsedMs) / 60000;
  const next = { ...needs };
  for (const [need, decay] of Object.entries(NEED_DECAY_PER_MINUTE)) {
    next[need] = clampNeed((next[need] ?? 0) - decay * minutes);
  }
  return next;
}

export function createTaskFromObject(object, actionId) {
  const miniGame = object.miniGame || null;
  return {
    id: `${actionId}:${object.id}`,
    actionId,
    objectId: object.id,
    lifecycle: 'approach',
    lifecycleIndex: 0,
    miniGame,
    activeMode: miniGame ? 'miniGame' : 'interaction',
    actorSpot: object.actorSpot,
    startedAt: 0,
    result: null,
    appliedDelta: null,
  };
}

export function reduceHomeEvent(state, event, manifest = YOYO_HOME_MANIFEST) {
  const logged = { ...state, eventLog: appendEventLog(state, event) };

  if (event.type === 'tick') {
    const now = event.now ?? logged.now;
    return {
      ...logged,
      now,
      lastTickAt: now,
      needs: decayNeeds(logged.needs, now - logged.lastTickAt),
    };
  }

  if (event.type === 'objectClick') {
    if (logged.currentTask) return logged;
    const object = getHomeObjectById(manifest, event.objectId);
    if (!object) return logged;
    const actionId = event.actionId || object.capabilities[0];
    if (!object.capabilities.includes(actionId)) return logged;
    return {
      ...logged,
      currentTask: { ...createTaskFromObject(object, actionId), startedAt: logged.now },
      activeTask: null,
      activeMiniGame: null,
    };
  }

  if (event.type === 'advanceTask') {
    return advanceCurrentTask(logged, event);
  }

  if (event.type === 'taskResult') {
    if (!logged.currentTask) return logged;
    return {
      ...logged,
      currentTask: {
        ...logged.currentTask,
        result: {
          gameId: event.gameId,
          score: event.score,
          target: event.target,
          ratio: event.target > 0 ? Math.max(0, Math.min(1, event.score / event.target)) : 0,
          detail: event.detail || {},
          mode: event.mode || logged.currentTask.activeMode,
        },
      },
    };
  }

  return logged;
}

export function advanceCurrentTask(state, event = {}) {
  const task = state.currentTask;
  if (!task) return state;

  const nextIndex = Math.min(task.lifecycleIndex + 1, HOME_TASK_LIFECYCLE.length - 1);
  const lifecycle = HOME_TASK_LIFECYCLE[nextIndex];
  const nextTask = { ...task, lifecycleIndex: nextIndex, lifecycle };

  if (lifecycle === 'active') {
    const activeTask = {
      actionId: task.actionId,
      objectId: task.objectId,
      mode: task.activeMode,
      gameId: task.miniGame,
    };
    return {
      ...state,
      currentTask: nextTask,
      activeTask,
      activeMiniGame: task.miniGame
        ? { id: task.miniGame, actionId: task.actionId, objectId: task.objectId }
        : null,
    };
  }

  if (lifecycle === 'result') {
    return {
      ...state,
      currentTask: nextTask,
      activeTask: null,
      activeMiniGame: null,
    };
  }

  if (lifecycle === 'careDelta') {
    const delta = scaleActionDelta(task.actionId, task.result);
    return {
      ...state,
      needs: applyNeedDelta(state.needs, delta),
      relationship: {
        ...state.relationship,
        xp: state.relationship.xp + Math.max(1, Math.round((task.result?.ratio ?? 1) * 6)),
      },
      currentTask: { ...nextTask, appliedDelta: delta },
      activeTask: null,
      activeMiniGame: null,
    };
  }

  if (lifecycle === 'aftermath') {
    const aftermath = {
      actionId: task.actionId,
      objectId: task.objectId,
      result: task.result || null,
      at: state.now,
    };
    return {
      ...state,
      currentTask: nextTask,
      activeTask: null,
      activeMiniGame: null,
      aftermath,
      roomEntities: {
        ...state.roomEntities,
        [task.objectId]: {
          ...state.roomEntities[task.objectId],
          state: 'aftermath',
          aftermath,
        },
      },
    };
  }

  if (lifecycle === 'idle') {
    return {
      ...state,
      currentTask: null,
      activeTask: null,
      activeMiniGame: null,
    };
  }

  return { ...state, currentTask: nextTask };
}

export function applyNeedDelta(needs, delta) {
  const next = { ...needs };
  for (const [need, value] of Object.entries(delta || {})) {
    next[need] = clampNeed((next[need] ?? 0) + value);
  }
  return next;
}

export function scaleActionDelta(actionId, result) {
  const base = ACTION_DELTAS[actionId] || {};
  const ratio = result ? Math.max(0.25, Math.min(1, result.ratio ?? 0)) : 1;
  return Object.fromEntries(Object.entries(base).map(([need, value]) => [need, Math.round(value * ratio * 100) / 100]));
}

export function selectNeedDrivenBehavior(state, manifest = YOYO_HOME_MANIFEST) {
  if (state.currentTask) return null;
  const candidates = [
    { actionId: 'feed', need: 'hunger', urgency: 100 - state.needs.hunger },
    { actionId: 'sleep', need: 'energy', urgency: 100 - state.needs.energy },
    { actionId: 'bath', need: 'hygiene', urgency: 100 - state.needs.hygiene },
    { actionId: 'play', need: 'fun', urgency: 100 - state.needs.fun },
    { actionId: 'comfort', need: 'affection', urgency: 100 - state.needs.affection },
    { actionId: 'study', need: 'focus', urgency: 100 - state.needs.focus },
  ].sort((a, b) => b.urgency - a.urgency);

  const best = candidates[0];
  if (!best || best.urgency < 38) return null;
  const object = manifest.objects.find((item) => item.capabilities.includes(best.actionId));
  if (!object) return null;
  return { ...best, objectId: object.id, reason: `${best.need} below comfort threshold` };
}
