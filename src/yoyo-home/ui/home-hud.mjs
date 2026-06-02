const NEED_ROWS = [
  { key: 'hunger', label: '饱腹' },
  { key: 'hygiene', label: '清洁' },
  { key: 'mood', label: '心情' },
  { key: 'energy', label: '体力' },
  { key: 'affection', label: '亲密' },
];

const ACTION_LABELS = {
  feed: '喂饭',
  bath: '洗澡',
  sleep: '睡觉',
  play: '陪玩',
  pet: '摸摸',
  watchAnime: '动画',
  playSwitch: 'Switch',
  buildBlocks: '积木',
  study: '学习',
};

const STAGE_LABELS = {
  first_meet: '初遇',
  familiar: '熟悉',
  close: '亲近',
  dependent: '依赖',
};

function clampNeed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function relationshipStageLabel(state) {
  const profile = state.lifeSnapshot?.profile || {};
  const rawStage = profile.stage || state.relationship?.stage;
  if (STAGE_LABELS[rawStage]) return STAGE_LABELS[rawStage];
  const intimacy = Number(profile.intimacy ?? state.relationship?.intimacy ?? 0);
  if (intimacy >= 70) return STAGE_LABELS.dependent;
  if (intimacy >= 30) return STAGE_LABELS.close;
  if (intimacy >= 10) return STAGE_LABELS.familiar;
  return STAGE_LABELS.first_meet;
}

function formatTodayCare(today = {}) {
  const items = Object.entries(ACTION_LABELS)
    .map(([key, label]) => ({ label, count: Number(today[key] || 0) }))
    .filter((item) => item.count > 0);
  if (!items.length) return '今天还没照顾过';
  return items.map((item) => `${item.label} ${item.count}`).join(' · ');
}

function todayCareCount(today = {}) {
  return Object.keys(ACTION_LABELS)
    .reduce((total, key) => total + Math.max(0, Number(today[key] || 0)), 0);
}

function todayInsightLine(state) {
  const today = state.lifeSnapshot?.today || {};
  const careCount = todayCareCount(today);
  const lastAction = state.lifeSnapshot?.action || state.aftermath?.actionId || null;
  const lowest = state.lifeSnapshot?.lowestNeed;
  if (lastAction && ACTION_LABELS[lastAction]) {
    return `刚刚${ACTION_LABELS[lastAction]}后，Yoyo觉得你很会照顾她。`;
  }
  if (lowest?.value < 42 && lowest.label) {
    return `Yoyo觉得你今天可能还没注意到她的${lowest.label}。`;
  }
  if (careCount > 0) {
    return `今天你已经照顾了 ${careCount} 次，Yoyo觉得你一直在认真陪她。`;
  }
  return 'Yoyo觉得你今天还没正式来看她，正在乖乖等你。';
}

function feedbackLine(state) {
  if (state.lifeSnapshot?.message) return state.lifeSnapshot.message;
  if (state.lifeSnapshot?.summary) return state.lifeSnapshot.summary;
  if (state.aftermath?.actionId) {
    const label = ACTION_LABELS[state.aftermath.actionId] || '照顾';
    return `${label}完成了`;
  }
  return '安稳陪伴中';
}

export function createHomeHud(root) {
  const hud = document.createElement('section');
  hud.className = 'yoyo-home-hud';
  hud.setAttribute('data-home-hud', 'root');
  hud.setAttribute('aria-label', 'Yoyo 状态');
  hud.innerHTML = `
    <div class="yoyo-home-hud__status">
      <span class="yoyo-home-hud__caption">Yoyo 今天</span>
      <strong data-home-hud="feedback">安稳陪伴中</strong>
      <span class="yoyo-home-hud__insight" data-home-hud="today-insight">Yoyo觉得你今天还没正式来看她。</span>
    </div>
    <div class="yoyo-home-hud__needs" aria-label="生活状态">
      ${NEED_ROWS.map((need) => `
        <div class="yoyo-home-need">
          <span>${need.label}</span>
          <meter min="0" max="100" value="0" data-home-meter="${need.key}"></meter>
          <strong data-home-need="${need.key}">0</strong>
        </div>
      `).join('')}
    </div>
    <div class="yoyo-home-hud__meta">
      <span>关系 <strong data-home-hud="relationship-stage">初遇</strong></span>
      <span>今日 <strong data-home-hud="today-care">今天还没照顾过</strong></span>
    </div>
  `;
  root.append(hud);

  const read = (selector) => hud.querySelector(selector);
  return {
    element: hud,
    update(state) {
      if (!state) return;
      for (const need of NEED_ROWS) {
        const value = clampNeed(state.needs?.[need.key]);
        const meter = read(`[data-home-meter="${need.key}"]`);
        const text = read(`[data-home-need="${need.key}"]`);
        if (meter) meter.value = value;
        if (text) text.textContent = String(value);
      }
      read('[data-home-hud="relationship-stage"]').textContent = relationshipStageLabel(state);
      read('[data-home-hud="today-care"]').textContent = formatTodayCare(state.lifeSnapshot?.today);
      read('[data-home-hud="today-insight"]').textContent = todayInsightLine(state);
      read('[data-home-hud="feedback"]').textContent = feedbackLine(state);
    },
  };
}
