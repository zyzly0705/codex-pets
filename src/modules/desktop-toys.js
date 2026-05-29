import { state, setState } from './core-state.js';
import { randomFrom } from './utils.js';
import { say } from './speech-queue.js';
import { DESKTOP_TOY_EVENTS, DESKTOP_TOY_PROPS } from './desktop-toy-catalog.js';
import { pauseDesktopRoaming } from './desktop-roaming.js';
import '../shared/yoyo-actions.js';
import '../shared/desktop-action-dispatcher.js';

const CLICK_EVENT_IDS = ['click-cookie', 'click-toy', 'click-wave'];
const CLICK_LINES = {
  'click-cookie': ['Yoyo接到小饼干啦～', '这一口好幸福！', '妈妈投喂成功！'],
  'click-toy': ['Yoyo玩一下小玩具～', '嘿嘿，动起来啦！', '妈妈看，Yoyo会自己玩～'],
  'click-wave': ['妈妈，我在这里～', 'Yoyo挥挥手！', '看到妈妈啦～'],
};

let propLayer = null;
let propTimer = 0;
let actionTimer = 0;
let actionUntil = 0;

function getPropLayer() {
  if (!propLayer) propLayer = document.getElementById('desktop-toy-prop');
  return propLayer;
}

function hideDesktopProp() {
  const layer = getPropLayer();
  if (!layer) return;
  layer.classList.remove('show');
  layer.removeAttribute('src');
  layer.removeAttribute('data-prop');
}

function showDesktopProp(propId, durationMs) {
  const prop = DESKTOP_TOY_PROPS[propId];
  const layer = getPropLayer();
  if (!prop || !layer || prop.artStatus === 'missing-standalone-art') return;

  clearTimeout(propTimer);
  layer.src = new URL(prop.asset, window.location.href).href;
  layer.dataset.prop = propId;
  layer.style.setProperty('--prop-width', `${Math.round((prop.dimensions?.width || 180) * 0.34)}px`);
  layer.classList.add('show');
  propTimer = setTimeout(hideDesktopProp, Math.max(800, durationMs - 180));
}

function buildDesktopActionForClient(actionId, overrides) {
  return globalThis.YOYO_DESKTOP_ACTIONS?.buildDesktopAction?.(actionId, overrides) || null;
}

function scheduleDesktopActionEnd(durationMs) {
  clearTimeout(actionTimer);
  actionUntil = Date.now() + durationMs;
  actionTimer = setTimeout(() => {
    if (Date.now() + 40 < actionUntil) return;
    hideDesktopProp();
    setState('idle');
    actionTimer = 0;
    actionUntil = 0;
  }, Math.max(800, durationMs));
}

export function playDesktopAction(actionId, overrides = {}) {
  const action = buildDesktopActionForClient(actionId, overrides);
  if (!action) return null;

  if (action.propId) showDesktopProp(action.propId, action.durationMs);
  else hideDesktopProp();

  pauseDesktopRoaming(action.durationMs + 700);
  setState(action.stateName);
  state.manualEffectUntil = Date.now() + action.durationMs;
  state.lastInteractionTime = Date.now();
  scheduleDesktopActionEnd(action.durationMs);
  if (action.line) say(action.line, Math.min(action.durationMs + 900, 5200));
  return action;
}

function eventById(id) {
  return DESKTOP_TOY_EVENTS.find((event) => event.id === id);
}

export function playDesktopClickToyReaction() {
  const event = eventById(randomFrom(CLICK_EVENT_IDS));
  if (!event) return null;

  const stateName = randomFrom(event.states || ['waving']);
  const durationMs = stateName === 'eating' ? 2600 : stateName === 'dancing' ? 2800 : 1800;
  const propId = randomFrom(event.props || []);

  if (propId) showDesktopProp(propId, durationMs);
  else hideDesktopProp();

  pauseDesktopRoaming(durationMs + 700);
  setState(stateName);
  state.manualEffectUntil = Date.now() + durationMs;
  state.lastInteractionTime = Date.now();
  scheduleDesktopActionEnd(durationMs);
  say(randomFrom(CLICK_LINES[event.id] || ['Yoyo在妈妈旁边～']), Math.min(durationMs + 600, 4200));

  return { eventId: event.id, stateName, durationMs, propId };
}

export function clearDesktopToyReaction() {
  clearTimeout(propTimer);
  clearTimeout(actionTimer);
  actionTimer = 0;
  actionUntil = 0;
  hideDesktopProp();
}
