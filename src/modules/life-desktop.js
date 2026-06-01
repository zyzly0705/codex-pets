import { state, setState, globalTimers, isStartupQuiet, careCue, feedBtn } from './core-state.js';
import { say, speechQueue, SPEECH_PRIORITY } from './speech-queue.js';

const LIFE_POLL_INTERVAL = 5 * 60 * 1000;
const NEED_PROMPT_COOLDOWN = 22 * 60 * 1000;
const CARE_CUE_VISIBLE_NEED = 70;

const ACTION_CUE = {
  feed: { icon: '🍙', label: '喂一口', stateName: 'eating' },
  bath: { icon: '🫧', label: '洗香香', stateName: 'fanCooling' },
  sleep: { icon: '☾', label: '休息一下', stateName: 'sleeping' },
  play: { icon: '☆', label: '陪她玩', stateName: 'dancing' },
  pet: { icon: '♡', label: '摸摸她', stateName: 'petting' },
  watchAnime: { icon: '▣', label: '看动画', stateName: 'watchTV' },
  playSwitch: { icon: '◇', label: '玩 Switch', stateName: 'dancing' },
  buildBlocks: { icon: '▦', label: '叠积木', stateName: 'review' },
  study: { icon: '◎', label: '学习一下', stateName: 'review' },
};

let lastPromptAt = 0;
let lastPromptKey = '';
let currentCueAction = '';
let careCueReady = false;
let desktopRunTestEnabled = false;

function canPrompt(life) {
  if (!life?.prompt) return false;
  if (isStartupQuiet()) return false;
  if (state.manualEffectUntil && Date.now() < state.manualEffectUntil) return false;
  const now = Date.now();
  if (life.prompt.key === lastPromptKey && now - lastPromptAt < NEED_PROMPT_COOLDOWN) return false;
  if (now - lastPromptAt < Math.floor(NEED_PROMPT_COOLDOWN / 2)) return false;
  return true;
}

function maybePromptNeed(life) {
  if (!canPrompt(life)) return;
  lastPromptAt = Date.now();
  lastPromptKey = life.prompt.key;
  if (life.prompt.stateName) setState(life.prompt.stateName);
  const priority = life.prompt.urgency === 'urgent' ? SPEECH_PRIORITY.IMPORTANT : SPEECH_PRIORITY.CASUAL;
  speechQueue.enqueue(life.prompt.line, 6200, priority);
}

function getCueAction(life) {
  if (!life) return '';
  const actionId = life.redirectedAction || life.recommendedAction || life.prompt?.recommendedAction;
  if (!actionId || !ACTION_CUE[actionId]) return '';
  const lowest = life.lowestNeed || {};
  if (life.prompt || life.status === 'urgent' || life.status === 'needs-care') return actionId;
  if (Number(lowest.value ?? 100) < CARE_CUE_VISIBLE_NEED) return actionId;
  return '';
}

function hideCareCue() {
  currentCueAction = '';
  if (careCue) {
    careCue.classList.remove('show', 'urgent', 'pending');
    careCue.removeAttribute('data-action');
    careCue.removeAttribute('data-tooltip');
    careCue.removeAttribute('title');
  }
}

function renderCareCue(life) {
  if (!careCue) return;
  if (desktopRunTestEnabled) {
    hideCareCue();
    careCue.dataset.muted = 'true';
    return;
  }
  const actionId = getCueAction(life);
  if (!actionId) {
    hideCareCue();
    return;
  }

  const cue = ACTION_CUE[actionId];
  currentCueAction = actionId;
  careCue.dataset.action = actionId;
  careCue.dataset.tooltip = cue.label;
  careCue.title = cue.label;
  careCue.setAttribute('aria-label', `${cue.label} Yoyo`);
  careCue.querySelector('.care-cue-icon').textContent = cue.icon;
  careCue.classList.toggle('urgent', life.prompt?.urgency === 'urgent' || life.status === 'urgent');
  careCue.classList.add('show');

  // 生活系统接管后，避免旧饼干入口和新照顾入口同时露出。
  if (feedBtn?.classList.contains('show')) feedBtn.classList.remove('show');
}

async function careFromCue() {
  if (!currentCueAction || careCue?.classList.contains('pending')) return;
  if (!window.petApi?.careForYoyo) {
    say('先打开小屋照顾Yoyo吧。', 3600);
    return;
  }
  const actionId = currentCueAction;
  careCue.classList.add('pending');
  try {
    const cue = ACTION_CUE[actionId];
    if (cue?.stateName) setState(cue.stateName);
    const life = await window.petApi.careForYoyo(actionId);
    state.life = life;
    renderCareCue(life);
  } catch {
    setState('failed');
    say('这下没照顾好，Yoyo有点懵。', 3600);
  } finally {
    careCue.classList.remove('pending');
  }
}

async function refreshLife() {
  if (!window.petApi?.getLife) return;
  try {
    const life = await window.petApi.getLife();
    state.life = life;
    renderCareCue(life);
    maybePromptNeed(life);
  } catch {
    // 生活状态读取失败不能影响桌面主循环。
  }
}

export async function initLifeDesktop() {
  desktopRunTestEnabled = window.petApi?.desktopRunTestEnabled
    ? await window.petApi.desktopRunTestEnabled()
    : false;
  const app = document.getElementById('app');
  if (app) app.dataset.careCueMuted = desktopRunTestEnabled ? 'true' : 'false';
  if (careCue && desktopRunTestEnabled) {
    careCue.dataset.muted = 'true';
    hideCareCue();
  }
  if (!window.petApi?.getLife) return;
  if (careCue && !careCueReady) {
    careCueReady = true;
    careCue.addEventListener('click', (event) => {
      event.stopPropagation();
      careFromCue();
    });
  }
  if (window.petApi.onLifeChanged) {
    window.petApi.onLifeChanged((life) => {
      state.life = life;
      renderCareCue(life);
    });
  }
  globalTimers.push(setInterval(refreshLife, LIFE_POLL_INTERVAL));
  setTimeout(refreshLife, 10000);
}
