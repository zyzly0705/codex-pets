// ai-dialogue.js - optional DeepSeek-backed Yoyo line enhancer
import { say } from './speech-queue.js';
import { getEmotionLabel, yoyoEmotion } from './emotion-system.js';
import { debugLog } from './debug-log.js';
import { guardYoyoLine } from './dialogue-guard.js';
import { yoyoMemory, getBusiestHours } from './growth-system.js';
import { yoyoRelationship, RELATIONSHIP_STAGES } from './relationship-system.js';
import { get } from './store-client.js';

const AI_LINE_COOLDOWN_MS = 90 * 1000;
let lastAiLineAt = 0;

function canUseAiLine() {
  if (!window.petApi?.generateYoyoLine) return false;
  if (Date.now() - lastAiLineAt < AI_LINE_COOLDOWN_MS) return false;
  return true;
}

// 把 PAD 数值转成 Yoyo 内心状态的中文描述，注入 AI 提示词让台词更有情绪背景
function buildEmotionNatural() {
  const { valence, arousal } = yoyoEmotion;
  let mood;
  if (valence < 30) mood = '非常委屈难过';
  else if (valence < 45) mood = '有点不开心';
  else if (valence < 65) mood = '心情平平';
  else if (valence < 80) mood = '挺开心的';
  else mood = '超级开心';

  if (arousal > 75) mood += '有点兴奋';
  else if (arousal < 30) mood += '有点困';
  return mood;
}

// 把 Yoyo 观察到的妈妈信息拼成上下文，让 AI 说出只属于她的话
function buildMomContext() {
  const parts = [];
  const hour = new Date().getHours();

  parts.push(`Yoyo现在${buildEmotionNatural()}`);

  if ((yoyoMemory.consecutiveDays || 0) > 1) {
    parts.push(`陪伴第${yoyoMemory.consecutiveDays}天`);
  }

  const busyHours = getBusiestHours();
  if (busyHours.includes(hour)) parts.push('妈妈现在最忙');

  const todayData = get('dailyMemory');
  const petToday = todayData?.interactions?.pet || 0;
  if (petToday > 0) parts.push(`今天摸了${petToday}次`);

  const stage = yoyoRelationship?.stage;
  if (stage && stage !== 'first_meet') {
    const stageName = RELATIONSHIP_STAGES[stage]?.name;
    if (stageName) parts.push(stageName);
  }

  return parts.slice(0, 4).join('，');
}

export async function maybeEnhanceLine({ behavior, fallback, duration = 5200, context = '' }) {
  if (!fallback || !canUseAiLine()) return false;
  lastAiLineAt = Date.now();
  const momCtx = buildMomContext();
  const fullContext = [momCtx, context].filter(Boolean).join('；');
  try {
    const result = await window.petApi.generateYoyoLine({
      behavior,
      fallback,
      context: fullContext,
      mood: getEmotionLabel(),
    });
    const guardedLine = guardYoyoLine(result?.line);
    if (!result?.ok || !guardedLine) {
      debugLog('ai_line_skipped', { behavior, reason: result?.reason || result?.error || 'unknown' });
      return false;
    }
    say(guardedLine, duration);
    debugLog('ai_line_used', { behavior, lineLength: guardedLine.length });
    return true;
  } catch (e) {
    debugLog('ai_line_failed', { behavior, message: e.message });
    return false;
  }
}

export function sayWithAi({ behavior, fallback, duration = 5200, context = '' }) {
  say(fallback, duration);
  maybeEnhanceLine({ behavior, fallback, duration, context });
}
