// ai-dialogue.js - optional DeepSeek-backed Yoyo line enhancer
import { say } from './core-state.js';
import { getEmotionLabel } from './emotion-system.js';
import { debugLog } from './debug-log.js';
import { guardYoyoLine } from './dialogue-guard.js';

const AI_LINE_COOLDOWN_MS = 90 * 1000;
let lastAiLineAt = 0;

function canUseAiLine() {
  if (!window.petApi?.generateYoyoLine) return false;
  if (Date.now() - lastAiLineAt < AI_LINE_COOLDOWN_MS) return false;
  return true;
}

export async function maybeEnhanceLine({ behavior, fallback, duration = 5200, context = '' }) {
  if (!fallback || !canUseAiLine()) return false;
  lastAiLineAt = Date.now();
  try {
    const result = await window.petApi.generateYoyoLine({
      behavior,
      fallback,
      context,
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
