import { globalTimers } from './core-state.js';
import { getBehaviorDebugSnapshot } from './behavior-engine.js';

const EMPTY_TEXT = '<div class="debug-muted">waiting for next behavior tick...</div>';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderCandidateRows(snapshot) {
  return snapshot.candidates.map(candidate => {
    const selected = snapshot.selected?.name === candidate.name;
    const bd = candidate.breakdown;
    return `
      <div class="debug-row${selected ? ' selected' : ''}">
        <span>${escapeHtml(candidate.name)}</span>
        <span>${candidate.score}</span>
        <span>${escapeHtml(candidate.pool)}</span>
        <span>${escapeHtml(candidate.category)}</span>
      </div>
      <div class="debug-breakdown ${selected ? ' selected' : ''}">
        base ${bd.base}
        em ${bd.emotion >= 0 ? '+' : ''}${bd.emotion}
        gr ${bd.growth >= 0 ? '+' : ''}${bd.growth}
        meta ${bd.meta >= 0 ? '+' : ''}${bd.meta}
        bias ${bd.bias >= 0 ? '+' : ''}${bd.bias}
        pref ${bd.preference >= 0 ? '+' : ''}${bd.preference}
        smooth ${bd.smoothed >= 0 ? '+' : ''}${bd.smoothed}
        pen -${bd.penalty}
      </div>
    `;
  }).join('');
}

function renderPoolRows(snapshot) {
  if (!snapshot.poolChoices.length) return '<div class="debug-muted">urgent or single-pool choice</div>';
  return snapshot.poolChoices.map(choice => (
    `<div>${escapeHtml(choice.pool)} ${choice.score} <span class="debug-muted">${escapeHtml(choice.best)}</span></div>`
  )).join('');
}

function renderPreferenceRows(snapshot) {
  const weights = Object.entries(snapshot.preference?.weights || {});
  if (!weights.length) return '<div class="debug-muted">no learned preference yet</div>';
  return weights.map(([name, weight]) => (
    `<div>${escapeHtml(name)} ${weight >= 0 ? '+' : ''}${weight}</div>`
  )).join('');
}

function renderFeedbackRows(snapshot) {
  const feedback = snapshot.preference?.recentFeedback || [];
  if (!feedback.length) return '<div class="debug-muted">no feedback yet</div>';
  return feedback.map(item => (
    `<div>${escapeHtml(item.type)} ${escapeHtml(item.behaviorName)} ${item.delta >= 0 ? '+' : ''}${item.delta} -> ${item.weight}</div>`
  )).join('');
}

function renderHistoryRows(snapshot) {
  const history = snapshot.history || [];
  if (!history.length) return '<div class="debug-muted">no committed behavior yet</div>';
  return history.map(item => (
    `<div>${escapeHtml(item.at)} ${escapeHtml(item.behaviorName)} ${item.score} <span class="debug-muted">${escapeHtml(item.pool)}</span></div>`
  )).join('');
}

function renderDebugPanel(panel, snapshot) {
  if (!snapshot) {
    panel.innerHTML = EMPTY_TEXT;
    return;
  }

  panel.innerHTML = `
    <div class="debug-title">
      <span>Behavior Debug</span>
      <span class="debug-muted">${escapeHtml(snapshot.at)}</span>
    </div>
    <div class="debug-grid">
      <div>selected</div><div>${escapeHtml(snapshot.selected?.name || 'none')}</div>
      <div>pool</div><div>${escapeHtml(snapshot.selected?.pool || '-')}</div>
      <div>score</div><div>${snapshot.selected?.score ?? '-'}</div>
      <div>threshold</div><div>${snapshot.threshold}</div>
      <div>state</div><div>${escapeHtml(snapshot.state.stateName)}</div>
      <div>action</div><div>${escapeHtml(snapshot.state.actionState)}</div>
      <div>level</div><div>Lv.${snapshot.growth.level} ${escapeHtml(snapshot.growth.path)}</div>
      <div>busy</div><div>${snapshot.context.busyHour ? 'yes' : 'no'}</div>
    </div>
    <div class="debug-section">
      <div>needs e:${snapshot.needs.energy} b:${snapshot.needs.boredom} h:${snapshot.needs.hunger} p:${snapshot.needs.playfulness}</div>
      <div>ctx ${snapshot.context.hour}:00 ${escapeHtml(snapshot.context.weatherKind)} ${escapeHtml(snapshot.context.season)} idle ${snapshot.context.idleMin}m</div>
      <div>score ctx <span class="debug-muted">${escapeHtml(snapshot.context.scoreContext)}</span></div>
      <div>recent <span class="debug-muted">${escapeHtml(snapshot.recent.join(', ') || 'none')}</span></div>
    </div>
    <div class="debug-section">
      <div class="debug-muted">learned weights</div>
      ${renderPreferenceRows(snapshot)}
      <div class="debug-muted">recent feedback</div>
      ${renderFeedbackRows(snapshot)}
    </div>
    <div class="debug-section">
      <div class="debug-muted">pools</div>
      ${renderPoolRows(snapshot)}
    </div>
    <div class="debug-section">
      <div class="debug-muted">behavior replay</div>
      ${renderHistoryRows(snapshot)}
    </div>
    <div class="debug-section">
      <div class="debug-row debug-muted">
        <span>behavior</span><span>score</span><span>pool</span><span>category</span>
      </div>
      ${renderCandidateRows(snapshot)}
    </div>
  `;
}

export async function initBehaviorDebugPanel() {
  if (!window.petApi?.behaviorDebugEnabled) return;
  const enabled = await window.petApi.behaviorDebugEnabled();
  if (!enabled) return;

  const app = document.getElementById('app');
  const panel = document.getElementById('behavior-debug-panel');
  if (!app || !panel) return;

  app.classList.add('debug-mode');
  panel.setAttribute('aria-hidden', 'false');
  panel.innerHTML = EMPTY_TEXT;

  const refresh = () => renderDebugPanel(panel, getBehaviorDebugSnapshot());
  refresh();
  globalTimers.push(setInterval(refresh, 1000));
}
