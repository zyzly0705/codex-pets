// relationship-system.js - long-term relationship state between Yoyo and the user
import { get, set } from './store-client.js';
import { debugLog } from './debug-log.js';
import { setState } from './core-state.js';
import { speechQueue } from './speech-queue.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultRelationship() {
  return {
    intimacy: 0,
    trust: 60,
    longing: 0,
    stage: 'first_meet',
    firstMetDate: todayKey(),
    lastStageChangeDate: todayKey(),
    lastInteractionDate: null,
    nicknames: ['妈妈'],
    milestones: [],
  };
}

export let yoyoRelationship = createDefaultRelationship();

export const RELATIONSHIP_STAGES = {
  first_meet: { name: '初遇期', minIntimacy: 0, line: '妈妈，Yoyo刚来，还想多认识你一点点～' },
  familiar: { name: '熟悉期', minIntimacy: 30, line: '妈妈，Yoyo好像越来越懂你一点点了～' },
  attached: { name: '依赖期', minIntimacy: 90, line: '妈妈不在的时候，Yoyo会有一点点想你哦～' },
  tacit: { name: '默契期', minIntimacy: 180, line: '妈妈忙的时候，Yoyo会乖乖陪着不吵你～' },
  exclusive: { name: '专属期', minIntimacy: 320, line: '这是只属于妈妈和Yoyo的小世界～' },
};

export function initRelationship() {
  const saved = get('relationship');
  yoyoRelationship = { ...createDefaultRelationship(), ...(saved || {}) };
  updateRelationshipStage();
  saveRelationship();
}

export function saveRelationship() {
  set('relationship', yoyoRelationship);
}

function stageForIntimacy(intimacy) {
  let selected = 'first_meet';
  for (const [stage, config] of Object.entries(RELATIONSHIP_STAGES)) {
    if (intimacy >= config.minIntimacy) selected = stage;
  }
  return selected;
}

export function updateRelationshipStage() {
  const nextStage = stageForIntimacy(yoyoRelationship.intimacy);
  if (nextStage !== yoyoRelationship.stage) {
    yoyoRelationship.stage = nextStage;
    yoyoRelationship.lastStageChangeDate = todayKey();
    yoyoRelationship.milestones.push({ type: 'stage', stage: nextStage, at: Date.now(), spoken: false });
    if (yoyoRelationship.milestones.length > 20) yoyoRelationship.milestones = yoyoRelationship.milestones.slice(-20);
    debugLog('relationship_stage_changed', { stage: nextStage, intimacy: yoyoRelationship.intimacy });
  }
}

export function maybeSpeakRelationshipStageEvent() {
  const milestone = [...(yoyoRelationship.milestones || [])].reverse()
    .find(item => item.type === 'stage' && item.stage === yoyoRelationship.stage && !item.spoken);
  if (!milestone) return false;
  const stage = RELATIONSHIP_STAGES[yoyoRelationship.stage] || RELATIONSHIP_STAGES.first_meet;
  milestone.spoken = true;
  saveRelationship();
  setState('clapping');
  speechQueue.priorityEnqueue(stage.line, 7000);
  if (window.petApi?.triggerEffect && ['attached', 'tacit', 'exclusive'].includes(yoyoRelationship.stage)) {
    window.petApi.triggerEffect('heart');
  }
  debugLog('relationship_stage_spoken', { stage: yoyoRelationship.stage });
  return true;
}

export function relationshipEvent(type, amount = 1) {
  const today = todayKey();
  if (['pet', 'feed', 'play', 'manual', 'daily_start'].includes(type)) {
    yoyoRelationship.intimacy += amount;
    yoyoRelationship.trust = Math.min(100, yoyoRelationship.trust + amount * 0.4);
    yoyoRelationship.longing = Math.max(0, yoyoRelationship.longing - amount * 1.5);
    yoyoRelationship.lastInteractionDate = today;
  } else if (type === 'whip') {
    yoyoRelationship.trust = Math.max(0, yoyoRelationship.trust - amount * 4);
    yoyoRelationship.longing = Math.max(0, yoyoRelationship.longing - amount);
  } else if (type === 'miss_day') {
    yoyoRelationship.longing = Math.min(100, yoyoRelationship.longing + amount * 8);
  }
  updateRelationshipStage();
  saveRelationship();
}

export function applyRelationshipScoreModifier(behaviorName, score) {
  const { stage, intimacy, trust, longing } = yoyoRelationship;
  let next = score;
  if (stage === 'first_meet' && ['sweetTalk', 'giftFlower', 'giftCandy'].includes(behaviorName)) next *= 0.75;
  if (['attached', 'tacit', 'exclusive'].includes(stage) && ['sweetTalk', 'bashful', 'wpsCompanion'].includes(behaviorName)) next *= 1.08;
  if (longing > 40 && ['wave', 'sweetTalk', 'lookAround'].includes(behaviorName)) next += Math.min(12, longing * 0.15);
  if (trust < 35 && ['bashful', 'giftFlower', 'giftCandy'].includes(behaviorName)) next *= 0.7;
  if (intimacy > 220 && behaviorName === 'overtimeReminder') next += 5;
  return Math.max(0, Math.min(100, next));
}

export function getRelationshipSummary() {
  const stage = RELATIONSHIP_STAGES[yoyoRelationship.stage] || RELATIONSHIP_STAGES.first_meet;
  return {
    ...yoyoRelationship,
    stageName: stage.name,
  };
}
