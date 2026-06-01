// behavior-engine.js - BEHAVIORS 数组 + tick 逻辑 + 冷却 + 评分
import { state, WEATHER_CODES, setState, feedBtn, isOnCooldown, setCooldown, globalTimers, isStartupQuiet } from './core-state.js';
import { randomFrom } from './utils.js';
import { say, speechQueue, SPEECH_PRIORITY } from './speech-queue.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { applyEmotionEvent, applyEmotionModifier, yoyoEmotion } from './emotion-system.js';
import { yoyoGrowth, yoyoMemory, getLevel, applyGrowthModifiers, incrementAchievementStat, trackFeatureUsed, trackGrowthStat, daysSinceLastPet, hoursSinceLastWhip, isInBusyHour, MEMORY_LINES } from './growth-system.js';
import { set } from './store-client.js';
import { startClimbing } from './climbing.js';
import { showHungerUI } from './interaction.js';
import { checkSeasonalParticleTrigger } from './weather-seasonal.js';
import { debugLog, logBehaviorCommitted, logBehaviorDecision } from './debug-log.js';
import { sayWithAi } from './ai-dialogue.js';
import { applyRelationshipScoreModifier } from './relationship-system.js';
import { plannerAllowsBehavior, recordPlannedBehavior, getCompanionPlanSummary } from './companion-planner.js';
import { recordDailyEvent } from './daily-memory.js';
import { startPerformance, isPerformanceLocked } from './performance-script.js';
import { shouldAutoTriggerAction } from './action-taxonomy.js';
import {
  BEHAVIOR_DIALOGUES,
  BORED_MESSAGES,
  HUNGER_MESSAGES,
  DECISION_CONFIG,
  DEFAULT_BEHAVIOR_META,
  BEHAVIOR_META,
  NEED_EFFECTS,
  SPECIAL_DATES,
  FEATURE_TIPS,
  LEARNING_CONFIG,
  getCatalogLine,
  getOvertimeReminderLine,
} from './behavior-data.js';

export { HUNGER_MESSAGES, SPECIAL_DATES } from './behavior-data.js';

// ===== 需求系统 =====
export const petNeeds = {
  // energy 实际代表“疲劳/困意”：0=精神，100=很困。
  // 之前默认 80，且睡眠评分直接用 energy * 0.8，启动后很容易立刻睡觉。
  energy: 30,
  boredom: 20,
  hunger: 10,
  playfulness: 50,
};

// ===== 行为注册表 =====
export const BEHAVIORS = [
  {
    name: 'idle',
    state: 'idle',
    duration: 0,
    cooldown: 0,
    utilityFn(needs, ctx) {
      const avgNeed = (needs.boredom + needs.hunger + needs.energy) / 3;
      return Math.max(10, 50 - avgNeed * 0.4);
    },
    onExecute() {
      setState('idle');
    }
  },
  {
    name: 'walk',
    state: 'runningRight',
    duration: 4000,
    cooldown: 60000,
    utilityFn(needs, ctx) {
      let score = needs.playfulness * 0.5 + needs.boredom * 0.2;
      if (ctx.weatherKind === 'clear') score += 15;
      if (ctx.hour >= 8 && ctx.hour <= 11) score += 10;
      if (ctx.weatherKind === 'rain') score -= 20;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 30;
      // 情绪影响散步意愿：开心活泼时更想跑动，难过时宁愿待着不动
      if (yoyoEmotion.valence > 70 && yoyoEmotion.arousal > 55) score += 18;
      else if (yoyoEmotion.valence < 35) score -= 22;
      return Math.max(0, Math.min(100, score));
    },
    async onExecute() {
      const lines = BEHAVIOR_DIALOGUES.walk;
      sayWithAi({ behavior: 'walk', fallback: lines[Math.floor(Math.random() * lines.length)] });
    }
  },
  {
    name: 'wave',
    state: 'waving',
    duration: 3000,
    cooldown: 120000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.6;
      const idleMin = ctx.idleTime / 60000;
      if (idleMin > 1) score += 10;
      if (idleMin > 3) score += 10;
      if (ctx.hour >= 8 && ctx.hour <= 10) score += 15;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('waving');
      const lines = BEHAVIOR_DIALOGUES.wave;
      sayWithAi({ behavior: 'wave', fallback: lines[Math.floor(Math.random() * lines.length)] });
    }
  },
  {
    name: 'dance',
    state: 'dancing',
    duration: 5000,
    cooldown: 300000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.42 + needs.playfulness * 0.28 + (100 - needs.energy) * 0.22;
      if (needs.energy < 38 && needs.boredom > 58) score += 16;
      if (ctx.hour >= 10 && ctx.hour <= 18) score += 10;
      if (ctx.isWeekend && ctx.hour >= 14 && ctx.hour <= 20) score += 6;
      if (yoyoEmotion && yoyoEmotion.valence > 62 && yoyoEmotion.arousal > 52) score += 12;
      if (ctx.idleTime > 5 * 60 * 1000) score += 6;
      if (ctx.hour >= 20 && ctx.hour <= 22) score -= 8;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 40;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      startPerformance('danceLetGo');
      incrementAchievementStat('danceCount');
      trackFeatureUsed('dance');
    }
  },
  {
    name: 'cheer',
    state: 'clapping',
    duration: 3600,
    cooldown: 600000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.18 + needs.playfulness * 0.24;
      if (yoyoEmotion && yoyoEmotion.valence > 62) score += 16;
      if (yoyoEmotion && yoyoEmotion.arousal > 54) score += 10;
      if (ctx.idleTime > 2 * 60 * 1000) score += 8;
      if (ctx.hour >= 9 && ctx.hour <= 18) score += 8;
      if (ctx.hour >= 23 || ctx.hour < 7) score -= 35;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('clapping');
      sayWithAi({ behavior: 'cheer', fallback: randomFrom(BEHAVIOR_DIALOGUES.cheer) });
      applyEmotionEvent('happy');
      trackGrowthStat('interactionCount');
    }
  },
  {
    name: 'sleep',
    state: 'sleeping',
    duration: 9000,
    cooldown: 1200000,
    utilityFn(needs, ctx) {
      const fatigue = needs.energy;
      const isNight = ctx.hour >= 23 || ctx.hour < 6;
      const isNapTime = ctx.hour >= 13 && ctx.hour <= 14;

      // 睡觉必须先满足困意门槛。否则初始/普通状态下不参与竞争，避免频繁触发。
      if (!isNight && !isNapTime && fatigue < 72) return 0;
      if (isNapTime && fatigue < 58) return 0;
      if (isNight && fatigue < 45) return 0;

      let score = (fatigue - 55) * 1.2;
      if (isNight) score += 18;
      if (isNapTime) score += 8;
      if (ctx.idleTime > 10 * 60 * 1000) score += 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('yawning');
      const lines = BEHAVIOR_DIALOGUES.sleep;
      sayWithAi({ behavior: 'sleep', fallback: lines[Math.floor(Math.random() * lines.length)] });
      setTimeout(() => {
        if (!stateMachine.isDancing && !stateMachine.isFollowing && !stateMachine.isWhipping) {
          setState('sleeping');
        }
      }, 2000);
    }
  },
  {
    name: 'climb',
    state: 'climbing',
    duration: 15000,
    cooldown: 300000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.5 + (100 - needs.energy) * 0.2;
      if (needs.energy > 70) score -= 30;
      if (needs.boredom > 60) score += 15;
      if (ctx.idleTime > 180000) score += 15;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 40;
      return Math.max(0, Math.min(100, score));
    },
    async onExecute() {
      await startClimbing();
      incrementAchievementStat('climbCount');
      trackFeatureUsed('climb');
    }
  },
  {
    name: 'hungry',
    state: 'waiting',
    duration: 30000,
    cooldown: 60000,
    utilityFn(needs, ctx) {
      if (state.life) return 0;
      if (needs.hunger < 70) return 0;
      let score = needs.hunger * 0.9;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      showHungerUI();
    }
  },
  {
    name: 'lookAround',
    state: 'lookingAround',
    duration: 5000,
    cooldown: 180000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.4;
      const idleMin = ctx.idleTime / 60000;
      if (idleMin > 2) score += 15;
      if (idleMin > 5) score += 10;
      if (needs.boredom > 50) score += 10;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 30;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('lookingAround');
      sayWithAi({ behavior: 'lookAround', fallback: randomFrom(BORED_MESSAGES) });
    }
  },
  {
    name: 'sweetTalk',
    state: 'waving',
    duration: 4000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      let score = 15 + Math.random() * 5;
      if (ctx.isWeekend) score += 3;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 10;
      if (daysSinceLastPet() > 2) score += 10;
      if (daysSinceLastPet() > 5) score += 10;
      if (isInBusyHour()) score -= 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        '妈妈妈妈，Yoyo好爱好爱你呀～',
        '妈妈是世界上最好最好的妈妈！',
        'Yoyo想抱抱妈妈…抱紧紧的那种！',
        '妈妈今天有没有想Yoyo呀？Yoyo可想你了！',
        '妈妈笑一个嘛～Yoyo最喜欢看妈妈笑啦！',
        '妈妈～Yoyo会永远永远爱你的！',
        '妈妈辛苦了！Yoyo给你揉揉小肩膀～',
      ];
      setState('waving');
      sayWithAi({ behavior: 'sweetTalk', fallback: randomFrom(lines) });
    }
  },
  {
    name: 'bashful',
    state: 'bashful',
    duration: 4000,
    cooldown: 300000,
    utilityFn(needs, ctx) {
      // 心情好时才会害羞卖萌
      const valence = yoyoEmotion ? yoyoEmotion.valence : 50;
      if (valence < 55) return 0;
      let score = (valence - 55) * 0.7;
      if (needs.boredom < 40) score += 8;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 20;
      if (isInBusyHour()) score -= 10;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('bashful');
      sayWithAi({ behavior: 'bashful', fallback: randomFrom(BEHAVIOR_DIALOGUES.bashful) });
      applyEmotionEvent('happy');
    }
  },
  {
    name: 'giftFlower',
    state: 'gifting',
    duration: 6000,
    cooldown: 14400000,
    utilityFn(needs, ctx) {
      let score = 10 + Math.random() * 5;
      if (ctx.isSpecialDay) score += 60;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 15;
      if ([7, 14, 30, 50, 100].includes(yoyoMemory.consecutiveDays)) score += 25;
      if (isInBusyHour()) score -= 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        'Yoyo给妈妈送小花花～最漂亮的送给最好的妈妈！',
        '妈妈妈妈！Yoyo采了好多好多花花送给你！',
        '送你小花花！妈妈要天天开心哦～',
        '每一朵花花都代表Yoyo对妈妈的爱！',
      ];
      setState('gifting');
      sayWithAi({ behavior: 'giftCandy', fallback: randomFrom(lines), duration: 6000 });
      window.petApi.triggerEffect('flower');
    }
  },
  {
    name: 'giftCandy',
    state: 'gifting',
    duration: 6000,
    cooldown: 14400000,
    utilityFn(needs, ctx) {
      let score = 10 + Math.random() * 5;
      if (ctx.isSpecialDay) score += 50;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 15;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        'Yoyo请妈妈吃糖糖！甜甜的～像妈妈一样甜！',
        '给妈妈的小零食！嘿嘿～Yoyo偷偷留的～',
        '妈妈吃块糖吧～吃了心情会变好哦！',
        '甜甜的糖果送给甜甜的妈妈～最配啦！',
      ];
      setState('gifting');
      sayWithAi({ behavior: 'giftFlower', fallback: randomFrom(lines), duration: 6000 });
      window.petApi.triggerEffect('candy');
    }
  },
  {
    name: 'swing',
    state: 'swing',
    duration: 6000,
    cooldown: 3600000,
    utilityFn(needs, ctx) {
      const isAfternoon = ctx.hour >= 14 && ctx.hour <= 18;
      let u = needs.playfulness * 0.48 + needs.boredom * 0.24;
      if (ctx.isWeekend) u += 16;
      if (isAfternoon) u += 18;
      if (ctx.hour >= 11 && ctx.hour <= 13) u += 4;
      if (yoyoEmotion && yoyoEmotion.valence > 58) u += 10;
      if (yoyoEmotion && yoyoEmotion.arousal < 62) u += 6;
      if (ctx.idleTime > 3 * 60 * 1000) u += 8;
      if (ctx.hour >= 20) u -= 18;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      startPerformance('swingScene');
      trackGrowthStat('interactionCount');
    }
  },
  {
    name: 'digSand',
    state: 'digSand',
    duration: 7000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      let u = needs.boredom * 0.5 + needs.playfulness * 0.3;
      if (yoyoEmotion && yoyoEmotion.arousal > 50) u += 10;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('digSand');
      sayWithAi({ behavior: 'digSand', fallback: getCatalogLine('digSand') });
      applyEmotionEvent('curious');
    }
  },
  {
    name: 'readBook',
    state: 'readBook',
    duration: 8000,
    cooldown: 10800000,
    utilityFn(needs, ctx) {
      const isEvening = ctx.hour >= 20 && ctx.hour <= 22;
      let u = 20;
      if (isEvening) u += 30;
      if (yoyoEmotion && yoyoEmotion.arousal < 40) u += 20;
      if (needs.boredom > 50) u += 15;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('readBook');
      sayWithAi({ behavior: 'readBook', fallback: getCatalogLine('readBook') });
      applyEmotionEvent('calm');
    }
  },
  {
    name: 'watchTV',
    state: 'watchTV',
    duration: 8000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      const isWeekend = ctx.isWeekend;
      const isEvening = ctx.hour >= 19 && ctx.hour <= 22;
      let u = 15;
      if (isWeekend && isEvening) u += 35;
      else if (isEvening) u += 20;
      if (needs.boredom > 60) u += 15;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('watchTV');
      sayWithAi({ behavior: 'watchTV', fallback: getCatalogLine('watchTV') });
      applyEmotionEvent('relaxed');
    }
  },
  {
    name: 'fanCooling',
    state: 'fanCooling',
    duration: 7000,
    cooldown: 5400000,
    utilityFn(needs, ctx) {
      if (!ctx.isSummer && (ctx.temp ?? 0) < 28) return 0;
      let u = 18;
      if ((ctx.temp ?? 0) >= 30) u += 24;
      if ((ctx.temp ?? 0) >= 34) u += 16;
      if (ctx.hour >= 12 && ctx.hour <= 18) u += 10;
      if (needs.energy > 45) u += 8;
      if (yoyoEmotion && yoyoEmotion.arousal < 55) u += 8;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      startPerformance('fanCoolingScene');
    }
  },
  {
    name: 'swimming',
    state: 'swimming',
    duration: 8000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      if (!ctx.isSummer) return 0;
      if (ctx.hour < 11 || ctx.hour > 18) return 0;
      let u = needs.playfulness * 0.44 + needs.boredom * 0.28;
      if ((ctx.temp ?? 0) >= 29) u += 12;
      if ((ctx.temp ?? 0) >= 33) u += 8;
      if (ctx.weatherKind === 'clear') u += 8;
      if (ctx.isWeekend) u += 10;
      if (yoyoEmotion && yoyoEmotion.valence > 58) u += 12;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      startPerformance('swimmingScene');
      trackGrowthStat('interactionCount');
    }
  },
  {
    name: 'airConditioning',
    state: 'airConditioning',
    duration: 8000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      if (!ctx.isSummer && (ctx.temp ?? 0) < 30) return 0;
      let u = 14;
      if ((ctx.temp ?? 0) >= 32) u += 26;
      if ((ctx.temp ?? 0) >= 35) u += 18;
      if (ctx.hour >= 12 && ctx.hour <= 19) u += 12;
      if (yoyoEmotion && yoyoEmotion.arousal > 58) u += 8;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      startPerformance('airConditioningScene');
    }
  },
  {
    name: 'sofaLying',
    state: 'sofaLying',
    duration: 9000,
    cooldown: 9000000,
    utilityFn(needs, ctx) {
      const isRestTime = ctx.hour >= 20 || ctx.hour <= 8 || ctx.hour === 13;
      let u = 12;
      if (isRestTime) u += 24;
      if (needs.energy < 45) u += 20;
      if (needs.boredom < 45) u += 8;
      if (yoyoEmotion && yoyoEmotion.arousal < 42) u += 14;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      startPerformance('sofaLyingScene');
    }
  },
  {
    name: 'overtimeReminder',
    state: 'waiting',
    duration: 6000,
    cooldown: 3600000,
    utilityFn(needs, ctx) {
      const isWeekend = ctx.isWeekend;
      const isLateWork = ctx.hour >= 20;
      const isHoliday = isWeekend;

      if (!isLateWork && !isHoliday) return 0;
      let u = 0;
      if (isHoliday && ctx.hour >= 9 && ctx.hour <= 22) u = 75;
      else if (isLateWork) u = 70 + (ctx.hour - 20) * 5;
      if (state.currentActiveApp.isWPS) u += 15;
      return u;
    },
    onExecute() {
      setState('waiting');
      speechQueue.enqueue(getOvertimeReminderLine(), 6000, SPEECH_PRIORITY.IMPORTANT);
      applyEmotionEvent('worried');
      incrementAchievementStat('overtimeCount');
      trackGrowthStat('workTime', 0.5);
    }
  },
  {
    name: 'wpsCompanion',
    state: 'typingCompanion',
    duration: 6000,
    cooldown: 1800000,
    utilityFn(needs, ctx) {
      if (!state.currentActiveApp.isWPS) return 0;
      if (ctx.hour >= 20) return 0;
      let score = 55;
      if (ctx.isWeekend) score += 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      state.keyboardActiveUntil = Date.now() + 6000;
      stateMachine.transition(ACTION_STATES.TYPING_COMPANION);
      setState('typingCompanion');
      sayWithAi({ behavior: 'wpsCompanion', fallback: getCatalogLine('wpsCompanion'), context: '妈妈正在使用办公软件工作' });
      applyEmotionEvent('calm');
      trackGrowthStat('workTime', 0.5);
    }
  },
  {
    name: 'giant',
    state: 'clapping',
    duration: 7000,
    cooldown: 1200000, // 20分钟冷却
    utilityFn(needs, ctx) {
      // 等级 >= 4 才能触发
      if (getLevel(yoyoGrowth.xp) < 4) return 0;
      // 夜间不触发
      if (ctx.hour >= 23 || ctx.hour < 6) return 0;
      // 0.5% 随机概率（每2秒tick一次，约6-7分钟一次机会）
      if (Math.random() > 0.005) return 0;
      return 80; // 一旦触发概率通过，给一个较高分数确保执行
    },
    onExecute() {
      startPerformance('dharmaManifest');
      window.petApi.triggerGiantEffect();
      incrementAchievementStat('giantCount');
      trackFeatureUsed('giant');
    }
  },
  {
    name: 'neglectProtest',
    state: 'waving',
    duration: 4000,
    cooldown: 1800000, // 30分钟冷却
    utilityFn(needs, ctx) {
      if (needs.boredom < 65) return 0;
      const idleMinutes = (Date.now() - state.lastInteractionTime) / 60000;
      if (idleMinutes < 25) return 0;
      if (ctx.workMode) return 0;
      return 70;
    },
    onExecute() {
      sayWithAi({
        behavior: 'neglectProtest',
        fallback: randomFrom(BEHAVIOR_DIALOGUES.neglectProtest),
        context: '妈妈很久没有理Yoyo了',
      });
    }
  },
  {
    name: 'sadnessLinger',
    state: 'failed',
    duration: 4000,
    cooldown: 900000, // 15分钟冷却
    utilityFn(_needs, _ctx) {
      if (yoyoEmotion.valence >= 35) return 0;
      if (hoursSinceLastWhip() > 2) return 0;
      return 60;
    },
    onExecute() {
      sayWithAi({
        behavior: 'sadnessLinger',
        fallback: randomFrom(BEHAVIOR_DIALOGUES.sadnessLinger),
        context: '刚被妈妈打了还没恢复',
      });
    }
  },
  {
    name: 'joySpill',
    state: 'clapping',
    duration: 3600,
    cooldown: 600000, // 10分钟冷却
    utilityFn(_needs, _ctx) {
      if (yoyoEmotion.valence <= 80) return 0;
      if (yoyoEmotion.arousal <= 65) return 0;
      return 65;
    },
    onExecute() {
      sayWithAi({
        behavior: 'joySpill',
        fallback: randomFrom(BEHAVIOR_DIALOGUES.joySpill),
        context: '心情超好控制不住',
      });
    }
  }
];

export function getMothersDay(year) {
  const may1 = new Date(year, 4, 1);
  const dayOfWeek = may1.getDay();
  const firstSunday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  return firstSunday + 7;
}

function maybeShowFeatureTip() {
  if (isStartupQuiet()) return;
  const now = Date.now();
  const interval = (2 + Math.random() * 2) * 60 * 60 * 1000;
  if (now - state.lastTipTime < interval) return;

  const candidates = FEATURE_TIPS.map(tip => ({
    ...tip,
    weight: state.shownTips.includes(tip.id) ? 0.2 : 1.0
  }));

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;
  let selected = candidates[0];
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) { selected = c; break; }
  }

  speechQueue.enqueue(selected.text, 5200, SPEECH_PRIORITY.CASUAL);
  if (!state.shownTips.includes(selected.id)) {
    state.shownTips.push(selected.id);
    set('shownTips', state.shownTips);
  }
  state.lastTipTime = now;
}

// ===== 上下文感知 =====
function getBehaviorContext() {
  const now = new Date();
  const weatherCode = state.weatherContext?.current?.weather_code;
  const weatherKind = weatherCode !== undefined ? (WEATHER_CODES.get(weatherCode) || 'cloudy') : null;
  const day = now.getDay();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const year = now.getFullYear();

  let isSpecialDay = false;
  for (const sd of SPECIAL_DATES) {
    let targetDay = sd.day;
    if (sd.type === 'mothers_day') targetDay = getMothersDay(year);
    if (sd.month === month && targetDay === date) {
      isSpecialDay = true;
      break;
    }
  }

  return {
    weather: weatherCode,
    weatherKind,
    temp: state.weatherContext?.current?.temperature_2m,
    month,
    hour: now.getHours(),
    dayOfWeek: day,
    isWeekend: (day === 0 || day === 6),
    isMonday: (day === 1),
    isSummer: month >= 6 && month <= 8,
    isSpecialDay,
    idleTime: Date.now() - state.lastInteractionTime,
  };
}

// ===== 需求值更新 =====
function updateNeeds(ctx) {
  if (stateMachine.actionState === ACTION_STATES.DANCING ||
      stateMachine.actionState === ACTION_STATES.CLIMBING ||
      stateMachine.globalMode === GLOBAL_MODES.SLEEP) {
    return;
  }

  // energy 是“疲劳/困意”，增长要慢；旧值 0.1/2s 会约 3 点/分钟，十几分钟就高频睡觉。
  petNeeds.energy = Math.min(100, petNeeds.energy + 0.012);
  petNeeds.boredom = Math.min(100, petNeeds.boredom + 0.05);
  petNeeds.hunger = Math.min(100, petNeeds.hunger + 0.03);

  let targetPlayfulness = 50;
  if (ctx.weatherKind === 'clear') targetPlayfulness = 70;
  else if (ctx.weatherKind === 'rain' || ctx.weatherKind === 'storm') targetPlayfulness = 30;
  else if (ctx.weatherKind === 'snow') targetPlayfulness = 40;
  petNeeds.playfulness += (targetPlayfulness - petNeeds.playfulness) * 0.02;

  if (ctx.hour >= 23 || ctx.hour < 6) {
    petNeeds.energy = Math.min(100, petNeeds.energy + 0.045);
  } else if (ctx.hour >= 13 && ctx.hour <= 14) {
    petNeeds.energy = Math.min(100, petNeeds.energy + 0.018);
  }

  if (ctx.idleTime > 120000) {
    petNeeds.boredom = Math.min(100, petNeeds.boredom + 0.05);
  }

  if (ctx.idleTime > 15 * 60 * 1000 && Date.now() - lastIgnoreEmotionAt > IGNORE_EMOTION_COOLDOWN) {
    lastIgnoreEmotionAt = Date.now();
    applyEmotionEvent('ignore');
  }

  petNeeds.energy = Math.max(0, Math.min(100, petNeeds.energy));
  petNeeds.boredom = Math.max(0, Math.min(100, petNeeds.boredom));
  petNeeds.hunger = Math.max(0, Math.min(100, petNeeds.hunger));
  petNeeds.playfulness = Math.max(0, Math.min(100, petNeeds.playfulness));
}

// ===== 记忆驱动行为 =====
const MEMORY_TRIGGER_COOLDOWN = 1800000;
const IGNORE_EMOTION_COOLDOWN = 1800000;
let lastIgnoreEmotionAt = 0;

function tryMemoryDrivenBehavior() {
  if (Date.now() - state.lastMemoryTriggerTime < MEMORY_TRIGGER_COOLDOWN) return false;
  if (Math.random() > 0.15) return false;
  if (isInBusyHour()) return false;
  if (stateMachine.isDancing || stateMachine.isSleeping || stateMachine.isFollowing || stateMachine.isWhipping || state.feedingLock || stateMachine.isClimbing) return false;

  if (yoyoMemory.lastPetTime && daysSinceLastPet() > 3) {
    state.lastMemoryTriggerTime = Date.now();
    setState('waiting');
    sayWithAi({ behavior: 'memoryLongNoPet', fallback: randomFrom(MEMORY_LINES.longNoPet), duration: 6000 });
    return true;
  }

  if (hoursSinceLastWhip() < 24 && hoursSinceLastWhip() > 1) {
    state.lastMemoryTriggerTime = Date.now();
    setState('failed');
    sayWithAi({ behavior: 'memoryRememberWhip', fallback: randomFrom(MEMORY_LINES.rememberWhip), duration: 6000 });
    return true;
  }

  return false;
}

const behaviorDecisionState = {
  smoothedScores: new Map(),
  recent: [],
  history: [],
  lastCommitted: null,
};

let latestBehaviorDebugSnapshot = null;

function clampScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function clampWeight(weight) {
  if (!Number.isFinite(weight)) return 0;
  return Math.max(LEARNING_CONFIG.weightMin, Math.min(LEARNING_CONFIG.weightMax, weight));
}

function getPreference() {
  if (!yoyoMemory.preference) {
    yoyoMemory.preference = {
      behaviorWeights: {},
      quietHours: [],
      interactionTolerance: 'normal',
      lastFeedbackAt: null,
      recentFeedback: [],
      lastDecayDate: null,
    };
  }
  if (!yoyoMemory.preference.behaviorWeights) yoyoMemory.preference.behaviorWeights = {};
  if (!Array.isArray(yoyoMemory.preference.recentFeedback)) yoyoMemory.preference.recentFeedback = [];
  return yoyoMemory.preference;
}

export function decayBehaviorPreferences(force = false) {
  const preference = getPreference();
  const today = new Date().toISOString().slice(0, 10);
  if (!force && preference.lastDecayDate === today) return false;

  let changed = false;
  for (const [name, rawWeight] of Object.entries(preference.behaviorWeights)) {
    const next = clampWeight(Number(rawWeight || 0) * LEARNING_CONFIG.decayPerDay);
    if (Math.abs(next) < 0.15) {
      delete preference.behaviorWeights[name];
      changed = true;
    } else if (next !== rawWeight) {
      preference.behaviorWeights[name] = next;
      changed = true;
    }
  }
  preference.lastDecayDate = today;
  if (changed || force) set('memory', yoyoMemory);
  return changed;
}

export function resetBehaviorPreferences() {
  const preference = getPreference();
  preference.behaviorWeights = {};
  preference.recentFeedback = [];
  preference.lastFeedbackAt = null;
  preference.lastDecayDate = new Date().toISOString().slice(0, 10);
  set('memory', yoyoMemory);
  debugLog('behavior_preference_reset', {});
}

function getBehaviorPreferenceWeight(name) {
  const preference = getPreference();
  return clampWeight(Number(preference.behaviorWeights[name] || 0));
}

function getBehaviorMeta(name) {
  return { ...DEFAULT_BEHAVIOR_META, ...(BEHAVIOR_META[name] || {}) };
}

function getBehaviorCategory(name) {
  return getBehaviorMeta(name).category;
}

function pruneRecentBehaviors(now = Date.now()) {
  behaviorDecisionState.recent = behaviorDecisionState.recent.filter(
    item => now - item.time <= DECISION_CONFIG.recentMemoryMs
  );
}

function rememberBehavior(name) {
  if (!name || name === 'idle') return;
  pruneRecentBehaviors();
  behaviorDecisionState.recent.unshift({
    name,
    category: getBehaviorCategory(name),
    time: Date.now(),
  });
  if (behaviorDecisionState.recent.length > DECISION_CONFIG.maxRecent) {
    behaviorDecisionState.recent.length = DECISION_CONFIG.maxRecent;
  }
}

function recencyStrength(item, index, now = Date.now()) {
  const ageRatio = Math.min(1, Math.max(0, (now - item.time) / DECISION_CONFIG.recentMemoryMs));
  const ageStrength = 1 - ageRatio;
  const orderStrength = Math.max(0, 1 - index / DECISION_CONFIG.maxRecent);
  return ageStrength * orderStrength;
}

function recentPenaltyFor(behavior) {
  const meta = getBehaviorMeta(behavior.name);
  if (meta.urgent) return 0;

  const category = meta.category;
  let penalty = 0;
  const now = Date.now();
  pruneRecentBehaviors(now);
  for (let i = 0; i < behaviorDecisionState.recent.length; i++) {
    const recent = behaviorDecisionState.recent[i];
    const strength = recencyStrength(recent, i, now);
    if (strength <= 0) continue;
    if (recent.name === behavior.name) {
      penalty += DECISION_CONFIG.repeatPenalty * strength;
    } else if (recent.category === category) {
      penalty += DECISION_CONFIG.categoryPenalty * strength;
    }
  }
  return penalty;
}

function recentBiasFor(behaviorName) {
  pruneRecentBehaviors();
  const latest = behaviorDecisionState.recent[0];
  if (!latest) return 0;
  if (Date.now() - latest.time > DECISION_CONFIG.recentBiasWindowMs) return 0;

  if (behaviorName === 'swing' && latest.name === 'dance') return 7;
  if (behaviorName === 'dance' && latest.name === 'swing') return -5;
  if (behaviorName === 'dance' && latest.category === 'care') return 4;
  return 0;
}

function applyBehaviorMetaModifiers(behavior, score, ctx) {
  const meta = getBehaviorMeta(behavior.name);
  const level = getLevel(yoyoGrowth.xp);
  if (level < meta.minLevel) return 0;

  let nextScore = score;
  if (meta.growthPaths?.includes(yoyoGrowth.path)) {
    nextScore *= 1.12;
  }
  if (meta.rarity === 'rare' && !ctx.isSpecialDay) {
    nextScore *= 0.82;
  } else if (meta.rarity === 'legendary') {
    nextScore *= 0.72;
  }
  return nextScore;
}

function getScoreBucket(ctx) {
  if (ctx.hour >= 23 || ctx.hour < 6) return 'night';
  if (ctx.hour >= 6 && ctx.hour <= 11) return 'morning';
  if (ctx.hour >= 12 && ctx.hour <= 18) return 'day';
  return 'evening';
}

function getScoreContextKey(ctx) {
  return [
    getScoreBucket(ctx),
    ctx.weatherKind || 'none',
    ctx.isSummer ? 'summer' : 'other',
    isInBusyHour() ? 'busy' : 'free',
    state.yoyoSettings.activity || 'normal',
  ].join('|');
}

function getSmoothedScoreEntry(name, ctx) {
  const entry = behaviorDecisionState.smoothedScores.get(name);
  if (!entry) return null;

  const now = Date.now();
  if (entry.contextKey !== getScoreContextKey(ctx) || now - entry.at > DECISION_CONFIG.smoothedScoreTtlMs) {
    behaviorDecisionState.smoothedScores.delete(name);
    return null;
  }

  return entry;
}

function setSmoothedScoreEntry(name, score, ctx) {
  behaviorDecisionState.smoothedScores.set(name, {
    score,
    at: Date.now(),
    contextKey: getScoreContextKey(ctx),
  });
}

function scoreBehavior(behavior, ctx) {
  const breakdown = {
    base: clampScore(behavior.utilityFn(petNeeds, ctx)),
    emotion: 0,
    growth: 0,
    meta: 0,
    relationship: 0,
    bias: 0,
    preference: 0,
    smoothed: 0,
    penalty: 0,
    final: 0,
  };

  const emotionScore = applyEmotionModifier(behavior.name, breakdown.base);
  breakdown.emotion = emotionScore - breakdown.base;

  const growthScore = applyGrowthModifiers(emotionScore, behavior.name);
  breakdown.growth = growthScore - emotionScore;

  const metaScore = applyBehaviorMetaModifiers(behavior, growthScore, ctx);
  breakdown.meta = metaScore - growthScore;

  const relationshipScore = applyRelationshipScoreModifier(behavior.name, metaScore);
  breakdown.relationship = relationshipScore - metaScore;

  const bias = recentBiasFor(behavior.name);
  breakdown.bias = bias;
  const preferenceWeight = getBehaviorPreferenceWeight(behavior.name) * LEARNING_CONFIG.scoreScale;
  breakdown.preference = preferenceWeight;
  const rawScore = clampScore(relationshipScore + bias + preferenceWeight);

  if (getBehaviorMeta(behavior.name).urgent) {
    breakdown.final = rawScore;
    setSmoothedScoreEntry(behavior.name, rawScore, ctx);
    return { score: rawScore, breakdown };
  }

  const previous = getSmoothedScoreEntry(behavior.name, ctx);
  const smoothed = previous === null
    ? rawScore
    : previous.score * (1 - DECISION_CONFIG.scoreSmoothing) + rawScore * DECISION_CONFIG.scoreSmoothing;
  setSmoothedScoreEntry(behavior.name, smoothed, ctx);

  const penalty = recentPenaltyFor(behavior);
  const finalScore = clampScore(smoothed - penalty);

  breakdown.smoothed = smoothed - rawScore;
  breakdown.penalty = penalty;
  breakdown.final = finalScore;

  return { score: finalScore, breakdown };
}

function weightedPick(items, scoreFn, temperature = DECISION_CONFIG.temperature) {
  if (items.length === 0) return null;
  const bestScore = Math.max(...items.map(scoreFn));
  const weights = items.map(item => Math.exp((scoreFn(item) - bestScore) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return items[i];
  }
  return items[0];
}

function chooseFromPool(candidates) {
  const best = candidates[0];
  const second = candidates[1];
  if (!second || best.score - second.score >= 20) {
    return { ...best, debugPool: getBehaviorMeta(best.behavior.name).pool };
  }

  const pool = candidates.filter(candidate => best.score - candidate.score <= DECISION_CONFIG.topBand);
  const selected = weightedPick(pool, candidate => candidate.score);
  return { ...selected, debugPool: getBehaviorMeta(selected.behavior.name).pool };
}

function poolScore(pool, bestScore, ctx) {
  let score = bestScore;
  if (pool === 'need') score += 12;
  if (pool === 'care' && isInBusyHour()) score += 8;
  if (pool === 'growth') score += (getLevel(yoyoGrowth.xp) - 1) * 1.5;
  if (pool === 'rare' && !ctx.isSpecialDay) score -= 10;
  return score;
}

function chooseBehavior(candidates, threshold, ctx) {
  const runnable = candidates
    .filter(candidate => candidate.behavior.name !== 'idle' && candidate.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (runnable.length === 0) return null;

  const urgent = runnable.filter(candidate => getBehaviorMeta(candidate.behavior.name).urgent);
  if (urgent.length > 0) {
    const selectedUrgent = urgent.sort((a, b) => b.score - a.score)[0];
    return { ...selectedUrgent, debugPool: getBehaviorMeta(selectedUrgent.behavior.name).pool };
  }

  const byPool = new Map();
  for (const candidate of runnable) {
    const pool = getBehaviorMeta(candidate.behavior.name).pool;
    if (!byPool.has(pool)) byPool.set(pool, []);
    byPool.get(pool).push(candidate);
  }

  const poolChoices = Array.from(byPool.entries()).map(([pool, poolCandidates]) => {
    const sorted = poolCandidates.sort((a, b) => b.score - a.score);
    return {
      pool,
      candidates: sorted,
      score: poolScore(pool, sorted[0].score, ctx),
    };
  }).sort((a, b) => b.score - a.score);

  const bestPool = poolChoices[0];
  const poolBand = poolChoices.filter(choice => bestPool.score - choice.score <= DECISION_CONFIG.topBand);
  const selectedPool = weightedPick(poolBand, choice => choice.score);
  const selected = chooseFromPool(selectedPool.candidates);
  return { ...selected, debugPool: selectedPool.pool, debugPoolChoices: poolChoices };
}

function applyNeedEffects(behaviorName) {
  const effects = NEED_EFFECTS[behaviorName];
  if (!effects) return;
  for (const [need, delta] of Object.entries(effects)) {
    petNeeds[need] = clampScore((petNeeds[need] || 0) + delta);
  }
}

function rememberDecisionHistory(entry) {
  behaviorDecisionState.history.unshift(entry);
  if (behaviorDecisionState.history.length > LEARNING_CONFIG.historyLimit) {
    behaviorDecisionState.history.length = LEARNING_CONFIG.historyLimit;
  }
}

function getLastFeedbackTarget(now = Date.now()) {
  const last = behaviorDecisionState.lastCommitted;
  if (!last) return null;
  if (last.behaviorName === 'idle' || last.behaviorName === 'memoryTrigger') return null;
  if (now - last.at > LEARNING_CONFIG.feedbackWindowMs) return null;
  return last;
}

export function recordBehaviorFeedback(type, explicitBehaviorName = null) {
  const impact = LEARNING_CONFIG.feedbackImpact[type] || 0;
  if (!impact) return null;

  const now = Date.now();
  const target = explicitBehaviorName
    ? { behaviorName: explicitBehaviorName, at: now }
    : getLastFeedbackTarget(now);
  if (!target?.behaviorName) return null;

  const preference = getPreference();
  const current = Number(preference.behaviorWeights[target.behaviorName] || 0);
  const next = clampWeight(current + impact);
  preference.behaviorWeights[target.behaviorName] = next;
  preference.lastFeedbackAt = now;
  preference.recentFeedback.unshift({
    type,
    behaviorName: target.behaviorName,
    delta: impact,
    weight: next,
    at: now,
  });
  if (preference.recentFeedback.length > 20) preference.recentFeedback.length = 20;
  set('memory', yoyoMemory);
  debugLog('behavior_feedback', {
    type,
    behaviorName: target.behaviorName,
    delta: impact,
    weight: next,
  });
  return { behaviorName: target.behaviorName, weight: next };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function makeBehaviorDebugSnapshot(ctx, threshold, candidates, selected) {
  const sortedCandidates = [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(candidate => {
      const meta = getBehaviorMeta(candidate.behavior.name);
      return {
        name: candidate.behavior.name,
        score: round1(candidate.score),
        pool: meta.pool,
        category: meta.category,
        rarity: meta.rarity,
        minLevel: meta.minLevel,
        breakdown: {
          base: round1(candidate.breakdown.base),
          emotion: round1(candidate.breakdown.emotion),
          growth: round1(candidate.breakdown.growth),
          meta: round1(candidate.breakdown.meta),
          relationship: round1(candidate.breakdown.relationship || 0),
          bias: round1(candidate.breakdown.bias),
          preference: round1(candidate.breakdown.preference || 0),
          smoothed: round1(candidate.breakdown.smoothed),
          penalty: round1(candidate.breakdown.penalty),
          final: round1(candidate.breakdown.final),
        },
      };
    });

  latestBehaviorDebugSnapshot = {
    at: new Date().toLocaleTimeString(),
    threshold: round1(threshold),
    selected: selected ? {
      name: selected.behavior.name,
      score: round1(selected.score),
      pool: selected.debugPool || getBehaviorMeta(selected.behavior.name).pool,
    } : null,
    poolChoices: (selected?.debugPoolChoices || []).map(choice => ({
      pool: choice.pool,
      score: round1(choice.score),
      best: choice.candidates[0]?.behavior.name || '',
    })),
    needs: {
      energy: round1(petNeeds.energy),
      boredom: round1(petNeeds.boredom),
      hunger: round1(petNeeds.hunger),
      playfulness: round1(petNeeds.playfulness),
    },
    state: {
      stateName: state.stateName,
      actionState: stateMachine.actionState,
      currentBehavior: state.currentBehavior,
      behaviorEndIn: Math.max(0, Math.ceil((state.behaviorEndTime - Date.now()) / 1000)),
    },
    growth: {
      level: getLevel(yoyoGrowth.xp),
      path: yoyoGrowth.path || 'none',
      xp: yoyoGrowth.xp,
    },
    context: {
      hour: ctx.hour,
      weatherKind: ctx.weatherKind || 'none',
      busyHour: isInBusyHour(),
      idleMin: round1(ctx.idleTime / 60000),
      season: ctx.isSummer ? 'summer' : 'default',
      scoreContext: getScoreContextKey(ctx),
    },
    recent: behaviorDecisionState.recent.map(item => item.name),
    plan: getCompanionPlanSummary(),
    preference: {
      weights: Object.fromEntries(
        Object.entries(getPreference().behaviorWeights)
          .filter(([, weight]) => Math.abs(Number(weight || 0)) >= 0.1)
          .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
          .slice(0, 8)
          .map(([name, weight]) => [name, round1(Number(weight))])
      ),
      recentFeedback: getPreference().recentFeedback.slice(0, 5).map(item => ({
        type: item.type,
        behaviorName: item.behaviorName,
        delta: round1(item.delta),
        weight: round1(item.weight),
      })),
    },
    history: behaviorDecisionState.history.slice(0, 8).map(item => ({
      behaviorName: item.behaviorName,
      score: round1(item.score),
      pool: item.pool,
      at: item.atText,
    })),
    candidates: sortedCandidates,
  };
}

export function getBehaviorDebugSnapshot() {
  return latestBehaviorDebugSnapshot;
}

// ===== 决策引擎主循环 =====
export async function behaviorEngineTick() {
  if (isStartupQuiet()) return;
  checkSeasonalParticleTrigger();

  if (isPerformanceLocked()) {
    debugLog('behavior_suppressed', {
      reason: 'performance_lock',
      performance: state.activePerformance?.id,
      untilIn: Math.max(0, Math.ceil((state.activePerformance.lockUntil - Date.now()) / 1000)),
      stateName: state.stateName,
      currentBehavior: state.currentBehavior,
    });
    return;
  }

  if (stateMachine.actionState === ACTION_STATES.TYPING_COMPANION && Date.now() > state.keyboardActiveUntil) {
    stateMachine.transition(ACTION_STATES.IDLE);
    if (state.currentBehavior === 'typingCompanion') {
      state.currentBehavior = null;
      state.behaviorEndTime = 0;
    }
    setState('idle');
  }

  if (stateMachine.actionState !== ACTION_STATES.IDLE || stateMachine.globalMode !== GLOBAL_MODES.INTERACTIVE) {
    return;
  }

  if (Date.now() < state.manualEffectUntil) {
    debugLog('behavior_suppressed', {
      reason: 'manual_effect',
      untilIn: Math.max(0, Math.ceil((state.manualEffectUntil - Date.now()) / 1000)),
      stateName: state.stateName,
      currentBehavior: state.currentBehavior,
    });
    return;
  }

  if (state.stateName === 'clapping' && !state.currentBehavior && Date.now() > state.keyboardActiveUntil) {
    if (!stateMachine.isDancing && !stateMachine.isSleeping && !stateMachine.isFollowing && !stateMachine.isClimbing) {
      setState('idle');
    }
  }

  maybeShowFeatureTip();

  if (state.currentBehavior && Date.now() < state.behaviorEndTime) {
    return;
  }

  if (state.currentBehavior && state.currentBehavior !== 'idle') {
    state.currentBehavior = null;
    state.behaviorEndTime = 0;
    setState('idle');
  }

  if (tryMemoryDrivenBehavior()) {
    state.currentBehavior = 'memoryTrigger';
    state.behaviorEndTime = Date.now() + 6000;
    return;
  }

  const ctx = getBehaviorContext();
  updateNeeds(ctx);

  let threshold = 25;
  if (ctx.hour >= 23 || ctx.hour < 6) threshold = 40;
  else if (ctx.hour >= 8 && ctx.hour <= 10) threshold = 18;

  if (isInBusyHour()) threshold += 10;

  const levelBonus = (getLevel(yoyoGrowth.xp) - 1) * 2;
  threshold -= levelBonus;

  if (state.yoyoSettings.activity === 'quiet') threshold += 15;
  else if (state.yoyoSettings.activity === 'active') threshold -= 10;
  threshold = Math.max(15, Math.min(60, threshold));

  const candidates = [];
  for (const behavior of BEHAVIORS) {
    if (isOnCooldown(behavior.name)) continue;
    if (behavior.name === 'hungry' && feedBtn.classList.contains('show')) continue;
    if (!shouldAutoTriggerAction(behavior.name)) continue;
    if (!plannerAllowsBehavior(behavior.name, getBehaviorMeta(behavior.name))) continue;

    const { score, breakdown } = scoreBehavior(behavior, ctx);
    candidates.push({ behavior, score, breakdown });
  }

  const selected = chooseBehavior(candidates, threshold, ctx);
  const bestBehavior = selected?.behavior;
  const bestScore = selected?.score ?? -1;
  makeBehaviorDebugSnapshot(ctx, threshold, candidates, selected);
  logBehaviorDecision(latestBehaviorDebugSnapshot);

  if (!bestBehavior || bestBehavior.name === 'idle' || bestScore < threshold) {
    if (state.stateName !== 'idle') setState('idle');
    state.currentBehavior = 'idle';
    state.behaviorEndTime = 0;
    return;
  }

  state.currentBehavior = bestBehavior.name;
  state.behaviorEndTime = bestBehavior.duration > 0 ? Date.now() + bestBehavior.duration : 0;

  if (bestBehavior.cooldown > 0) {
    setCooldown(bestBehavior.name, bestBehavior.cooldown);
  }

  await Promise.resolve(bestBehavior.onExecute());
  rememberBehavior(bestBehavior.name);
  applyNeedEffects(bestBehavior.name);
  recordPlannedBehavior(bestBehavior.name, getBehaviorMeta(bestBehavior.name));
  recordDailyEvent('behavior', { name: bestBehavior.name });
  const committedAt = Date.now();
  const committedEntry = {
    behaviorName: bestBehavior.name,
    score: bestScore,
    pool: selected.debugPool || getBehaviorMeta(bestBehavior.name).pool,
    at: committedAt,
    atText: new Date(committedAt).toLocaleTimeString(),
  };
  behaviorDecisionState.lastCommitted = committedEntry;
  rememberDecisionHistory(committedEntry);
  logBehaviorCommitted({
    at: new Date().toLocaleTimeString(),
    selected: bestBehavior.name,
    stateName: state.stateName,
    actionState: stateMachine.actionState,
    currentBehavior: state.currentBehavior,
    behaviorEndIn: Math.max(0, Math.ceil((state.behaviorEndTime - Date.now()) / 1000)),
    recent: behaviorDecisionState.recent.map(item => item.name),
    preferenceWeight: getBehaviorPreferenceWeight(bestBehavior.name),
  });
}

// ===== 启动行为决策引擎 =====
export function startBehaviorEngine() {
  decayBehaviorPreferences();
  globalTimers.push(setInterval(behaviorEngineTick, 2000));
}
