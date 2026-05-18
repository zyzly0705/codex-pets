import { state, setState, say, speechQueue, SPEECH_PRIORITY, hasDailyFlag, setDailyFlag, petCapabilityEnabled, petBehaviorAllowed } from './core-state.js';
import { stateMachine } from './state-machine.js';
import { debugLog } from './debug-log.js';
import { maybeEnhanceLine } from './ai-dialogue.js';
import { recordDailyEvent } from './daily-memory.js';

function formatNewsBrief(items) {
  const normalizedItems = (items || [])
    .map(item => String(item.title || '').replace(/\s+-\s+[^-]+$/u, '').trim())
    .filter(Boolean)
    .map(title => title.replace(/^#+|#+$/g, ''))
    .slice(0, 4);
  if (!normalizedItems.length) return '';
  const hasHotSearch = (items || []).some(item => item.kind === 'hot-search' || item.source === '微博热搜');
  const icon = hasHotSearch ? '🔥' : '📰';
  const label = hasHotSearch ? '微博热搜' : '今日要闻';
  const suffix = hasHotSearch ? '，妈妈要不要看一眼~' : '，妈妈有空再慢慢看~';
  return `${icon} ${label}：${normalizedItems.join('、')}${suffix}`;
}

export async function checkDailyNewsBroadcast(force = false) {
  if (!petCapabilityEnabled('news') || !petBehaviorAllowed('newsBroadcast')) {
    if (force) say('这个形态今天不播新闻哦～', 4000);
    return;
  }
  if (!window.petApi?.getDailyNews) return;
  if (!force && stateMachine.isSleeping) return;

  const now = new Date();
  const todayKey = `daily_news_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;
  if (!force) {
    if (hasDailyFlag(todayKey)) return;
    if (now.getHours() < 9) return;
  }

  try {
    const result = await window.petApi.getDailyNews({ force });
    if (!result?.ok) {
      if (force) say(result?.error || '新闻暂时播报不了，等会儿再试试～', 5000);
      debugLog('news_broadcast', { ok: false, force, error: result?.error || 'unknown' });
      return;
    }

    const msg = formatNewsBrief(result.items);
    if (!msg) return;
    if (!force) setDailyFlag(todayKey);

    state.currentBehavior = 'newsBroadcast';
    state.behaviorEndTime = Date.now() + 8000;
    setState('review');
    speechQueue.enqueue(msg, 8000, SPEECH_PRIORITY.IMPORTANT);
    maybeEnhanceLine({ behavior: 'newsBroadcast', fallback: msg, duration: 8000, context: '新闻播报摘要' });
    recordDailyEvent('reminder', { kind: 'news' });
    debugLog('news_broadcast', {
      ok: true,
      force,
      cached: Boolean(result.cached),
      stale: Boolean(result.stale),
      source: result.source || result.items?.[0]?.source || '',
      count: result.items?.length || 0,
    });
    setTimeout(() => {
      if (state.currentBehavior === 'newsBroadcast') {
        state.currentBehavior = null;
        setState('idle');
      }
    }, 8200);
  } catch (error) {
    debugLog('news_broadcast', { ok: false, force, error: error.message });
    if (force) say('新闻暂时播报不了，等会儿再试试～', 5000);
  }
}
