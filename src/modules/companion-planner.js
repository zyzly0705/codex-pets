// companion-planner.js - daily pacing budget for Yoyo's companionship
import { get, set } from './store-client.js';
import { state } from './core-state.js';
import { yoyoRelationship } from './relationship-system.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createPlan(date = todayKey()) {
  const now = new Date();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const activity = state.yoyoSettings?.activity || 'normal';
  const intimacy = yoyoRelationship.intimacy || 0;
  const longing = yoyoRelationship.longing || 0;
  const trust = yoyoRelationship.trust || 60;
  const quiet = activity === 'quiet';
  const active = activity === 'active';
  const hour = now.getHours();
  const isWorkMorning = !isWeekend && hour >= 8 && hour < 12;
  const isWorkAfternoon = !isWeekend && hour >= 14 && hour < 18;
  const isEvening = hour >= 19 && hour < 23;

  let talkBudget = (quiet ? 5 : active ? 12 : 8) + (intimacy > 180 ? 2 : 0);
  let reminderBudget = quiet ? 2 : 3;
  let playBudget = isWeekend ? (active ? 5 : 3) : (quiet ? 1 : 2);

  if (isWorkMorning || isWorkAfternoon) {
    talkBudget -= quiet ? 2 : 1;
    playBudget = Math.max(1, playBudget - 1);
    reminderBudget += 1;
  }
  if (isEvening) {
    talkBudget += 2;
    playBudget += active ? 1 : 0;
  }
  if (isWeekend) {
    talkBudget += 2;
    playBudget += 2;
  }
  if (longing > 45) talkBudget += 1;
  if (trust < 35) playBudget = Math.max(1, playBudget - 1);

  return {
    date,
    mode: isWeekend ? 'weekend_warm' : isEvening ? 'evening_soft' : 'workday_focus',
    mood: longing > 45 ? 'miss_you' : intimacy > 180 ? 'close' : 'gentle',
    budgets: {
      talk: Math.max(3, talkBudget),
      reminder: Math.max(2, reminderBudget),
      play: playBudget,
      rare: 1,
    },
    used: { talk: 0, reminder: 0, play: 0, rare: 0 },
  };
}

export let companionPlan = createPlan();

export function initCompanionPlanner() {
  const saved = get('companionPlan');
  companionPlan = saved?.date === todayKey() ? saved : createPlan();
  saveCompanionPlan();
}

export function saveCompanionPlan() {
  set('companionPlan', companionPlan);
}

function poolForBehavior(behaviorName, pool, category) {
  if (['need'].includes(pool)) return null;
  if (pool === 'rare') return 'rare';
  if (['care'].includes(pool)) return 'reminder';
  if (['play', 'movement'].includes(category)) return 'play';
  return 'talk';
}

export function plannerAllowsBehavior(behaviorName, meta) {
  if (companionPlan.date !== todayKey()) {
    companionPlan = createPlan();
    saveCompanionPlan();
  }
  const bucket = poolForBehavior(behaviorName, meta.pool, meta.category);
  if (!bucket) return true;
  if (meta.urgent) return true;
  return (companionPlan.used[bucket] || 0) < (companionPlan.budgets[bucket] || 0);
}

export function recordPlannedBehavior(behaviorName, meta) {
  const bucket = poolForBehavior(behaviorName, meta.pool, meta.category);
  if (!bucket) return;
  companionPlan.used[bucket] = (companionPlan.used[bucket] || 0) + 1;
  saveCompanionPlan();
}

export function getCompanionPlanSummary() {
  return companionPlan;
}
