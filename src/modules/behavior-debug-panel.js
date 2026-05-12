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
    return `
      <div class="debug-row${selected ? ' selected' : ''}">
        <span>${escapeHtml(candidate.name)}</span>
        <span>${candidate.score}</span>
        <span>${escapeHtml(candidate.pool)}</span>
        <span>${escapeHtml(candidate.category)}</span>
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
      <div>ctx ${snapshot.context.hour}:00 ${escapeHtml(snapshot.context.weatherKind)} idle ${snapshot.context.idleMin}m</div>
      <div>recent <span class="debug-muted">${escapeHtml(snapshot.recent.join(', ') || 'none')}</span></div>
    </div>
    <div class="debug-section">
      <div class="debug-muted">pools</div>
      ${renderPoolRows(snapshot)}
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
