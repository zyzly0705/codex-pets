// daily-memory.js - records a lightweight shared day and turns it into memory lines
import { get, set } from './store-client.js';
import { say, randomFrom } from './core-state.js';
import { yoyoRelationship } from './relationship-system.js';
import { maybeEnhanceLine } from './ai-dialogue.js';

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function yesterdayKey() {
  return todayKey(new Date(Date.now() - 86400000));
}

function createDay(date = todayKey()) {
  return {
    date,
    startedAt: Date.now(),
    activeMinutes: 0,
    interactions: { pet: 0, feed: 0, whip: 0, drag: 0, manual: 0 },
    behaviors: {},
    reminders: { weather: 0, news: 0, work: 0 },
    workSignals: 0,
    summaryLine: '',
    summarySpoken: false,
  };
}

export let dailyMemory = createDay();
export let recentDailyCards = [];

export function initDailyMemory() {
  const saved = get('dailyMemory');
  recentDailyCards = Array.isArray(get('dailyCards')) ? get('dailyCards') : [];
  if (saved?.date && saved.date !== todayKey()) {
    archiveDay(saved);
  }
  dailyMemory = saved?.date === todayKey() ? saved : createDay();
  set('dailyMemory', dailyMemory);
}

export function saveDailyMemory() {
  set('dailyMemory', dailyMemory);
}

function archiveDay(day) {
  if (!day?.date) return;
  const card = makeMemoryCard(day);
  recentDailyCards = [card, ...recentDailyCards.filter(item => item.date !== card.date)].slice(0, 7);
  set('dailyCards', recentDailyCards);
}

export function makeMemoryCard(memory = dailyMemory) {
  const topBehavior = Object.entries(memory.behaviors || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '陪伴';
  const interactions = memory.interactions || {};
  const reminders = memory.reminders || {};
  return {
    date: memory.date,
    activeMinutes: Math.round(memory.activeMinutes || 0),
    petCount: interactions.pet || 0,
    feedCount: interactions.feed || 0,
    topBehavior,
    reminderCount: Object.values(reminders).reduce((sum, count) => sum + Number(count || 0), 0),
    workSignals: memory.workSignals || 0,
    summaryLine: memory.summaryLine || buildDailySummaryLine(memory),
  };
}

export function recordDailyEvent(type, detail = {}) {
  if (dailyMemory.date !== todayKey()) {
    dailyMemory = createDay();
  }
  if (type === 'interaction') {
    const key = detail.kind || 'manual';
    dailyMemory.interactions[key] = (dailyMemory.interactions[key] || 0) + 1;
  } else if (type === 'behavior') {
    const key = detail.name || 'unknown';
    dailyMemory.behaviors[key] = (dailyMemory.behaviors[key] || 0) + 1;
  } else if (type === 'reminder') {
    const key = detail.kind || 'work';
    dailyMemory.reminders[key] = (dailyMemory.reminders[key] || 0) + 1;
  } else if (type === 'work') {
    dailyMemory.workSignals += Number(detail.amount || 1);
  } else if (type === 'activeMinutes') {
    dailyMemory.activeMinutes += Number(detail.amount || 0);
  }
  saveDailyMemory();
}

function topBehaviorName() {
  const [name] = Object.entries(dailyMemory.behaviors).sort((a, b) => b[1] - a[1])[0] || [];
  return name || '';
}

export function buildDailySummaryLine(memory = dailyMemory) {
  const petCount = memory.interactions.pet || 0;
  const feedCount = memory.interactions.feed || 0;
  const workSignals = memory.workSignals || 0;
  const topBehavior = topBehaviorName();
  const templates = [
    `今天妈妈摸了Yoyo${petCount}次，Yoyo心里甜甜的～`,
    `今天Yoyo陪妈妈过了一天，明天也想在旁边乖乖待着～`,
    `今天妈妈${workSignals > 2 ? '忙了好久' : '也辛苦啦'}，Yoyo给你揉揉肩～`,
  ];
  if (feedCount > 0) templates.push(`今天妈妈还喂了Yoyo${feedCount}次，好幸福呀～`);
  if (topBehavior) templates.push(`今天Yoyo最常${topBehavior}，都是想让妈妈开心～`);
  if (yoyoRelationship.stage === 'exclusive') templates.push('今天也是只属于妈妈和Yoyo的小日子～');
  return randomFrom(templates);
}

export function maybeSpeakDailySummary() {
  const hour = new Date().getHours();
  if (hour < 22 || dailyMemory.summarySpoken) return false;
  dailyMemory.summaryLine = dailyMemory.summaryLine || buildDailySummaryLine();
  dailyMemory.summarySpoken = true;
  archiveDay(dailyMemory);
  saveDailyMemory();
  say(dailyMemory.summaryLine, 8000);
  maybeEnhanceLine({ behavior: 'dailySummary', fallback: dailyMemory.summaryLine, duration: 8000, context: '今日陪伴小结' });
  return true;
}

export function getStartupMemoryLine() {
  const saved = get('dailyMemory');
  if (!saved || saved.date !== yesterdayKey() || !saved.summaryLine) return '';
  return `妈妈，Yoyo还记得昨天：${saved.summaryLine}`;
}

export function getDailyMemorySummary() {
  return {
    today: dailyMemory,
    cards: [makeMemoryCard(dailyMemory), ...recentDailyCards.filter(item => item.date !== dailyMemory.date)].slice(0, 7),
  };
}
