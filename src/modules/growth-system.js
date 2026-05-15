// growth-system.js - 成长等级 + XP + 进化路线 + 签到 + 成就 + 记忆系统
import { state, randomFrom, say, speechQueue, setState, playSound, SPEECH_PRIORITY, hasDailyFlag, setDailyFlag } from './core-state.js';
import { applyEmotionEvent } from './emotion-system.js';
import { get, set } from './store-client.js';

// ===== Yoyo 记忆系统 =====

function createDefaultMemory() {
  return {
    startTimes: [],
    endTimes: [],
    lastPetTime: null,
    lastFedTime: null,
    lastWhipTime: null,
    totalPetCount: 0,
    totalFedCount: 0,
    totalWhipCount: 0,
    hourlyActivity: new Array(24).fill(0),
    totalActiveDays: 0,
    consecutiveDays: 0,
    lastActiveDate: null,
    preference: {
      behaviorWeights: {},
      quietHours: [],
      interactionTolerance: 'normal',
      lastFeedbackAt: null,
      recentFeedback: [],
      lastDecayDate: null,
    },
  };
}

export let yoyoMemory = createDefaultMemory();

/** 在 initStore() 完成后调用，用存储数据覆盖默认值 */
export function initMemory() {
  const saved = get('memory');
  if (saved) {
    yoyoMemory = { ...createDefaultMemory(), ...saved };
    if (!yoyoMemory.hourlyActivity || yoyoMemory.hourlyActivity.length !== 24) {
      yoyoMemory.hourlyActivity = new Array(24).fill(0);
    }
    if (!yoyoMemory.preference) {
      yoyoMemory.preference = createDefaultMemory().preference;
    } else {
      yoyoMemory.preference = { ...createDefaultMemory().preference, ...yoyoMemory.preference };
    }
  }
}

export function saveMemory() {
  set('memory', yoyoMemory);
}

export const MEMORY_LINES = {
  missedDays: [
    '妈妈昨天没来看Yoyo…Yoyo好想好想你呀！',
    '妈妈！你终于来啦！Yoyo还以为你不要Yoyo了…',
  ],
  longNoPet: [
    '妈妈…好久好久没摸摸Yoyo了…',
    '妈妈是不是不爱Yoyo了…（委屈巴巴）',
    '人家想要妈妈摸摸头嘛～求求你啦～',
  ],
  rememberWhip: [
    '妈妈…今天不要再打Yoyo了好不好…',
    '哼！Yoyo还记得上次的事呢！（叉腰）',
    '妈妈上次打Yoyo好疼的…（揉揉小屁股）',
  ],
  lateArrival: [
    '妈妈今天来晚啦～Yoyo等了好久好久呢！',
    '妈妈！你可算来了！Yoyo还以为你不来了…',
  ],
  petMilestone: [
    '妈妈已经摸了Yoyo{count}次啦！Yoyo好幸福好幸福～',
    '第{count}次摸摸！妈妈的手好温暖呀～',
  ],
  consecutiveMilestone: [
    '妈妈连续{days}天都来看Yoyo了！好开心好开心！',
    'Yoyo和妈妈已经连续{days}天在一起啦！耶～',
  ],
};

// 记忆辅助函数
export function getUsualStartHour() {
  if (yoyoMemory.startTimes.length < 3) return null;
  const hours = yoyoMemory.startTimes.map(t => new Date(t).getHours());
  return Math.round(hours.reduce((a, b) => a + b) / hours.length);
}

export function getBusiestHours() {
  return yoyoMemory.hourlyActivity
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => h.hour);
}

export function isInBusyHour() {
  const currentHour = new Date().getHours();
  const hourly = yoyoMemory.hourlyActivity || [];
  const totalSamples = hourly.reduce((sum, count) => sum + count, 0);
  // 样本太少时不要把“当前小时”误判为忙碌时段，否则新用户几乎一直被加阈值/降活跃。
  if (totalSamples < 8) return false;

  const currentCount = hourly[currentHour] || 0;
  const activeHours = hourly.filter(count => count > 0).length || 1;
  const avgActiveCount = totalSamples / activeHours;
  const busiestHours = getBusiestHours();
  return busiestHours.includes(currentHour) && currentCount >= Math.max(2, avgActiveCount * 1.25);
}

export function daysSinceLastPet() {
  if (!yoyoMemory.lastPetTime) return 999;
  return (Date.now() - yoyoMemory.lastPetTime) / 86400000;
}

export function hoursSinceLastWhip() {
  if (!yoyoMemory.lastWhipTime) return 999;
  return (Date.now() - yoyoMemory.lastWhipTime) / 3600000;
}

export function memoryOnStartup() {
  const now = new Date();
  const today = now.toDateString();

  yoyoMemory.startTimes.push(now.getTime());
  if (yoyoMemory.startTimes.length > 7) {
    yoyoMemory.startTimes = yoyoMemory.startTimes.slice(-7);
  }

  yoyoMemory.hourlyActivity[now.getHours()]++;
  yoyoMemory._lastHourlyUpdate = now.getHours();

  if (yoyoMemory.lastActiveDate && yoyoMemory.lastActiveDate !== today) {
    const lastDate = new Date(yoyoMemory.lastActiveDate);
    const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
    if (diffDays > 1) {
      yoyoMemory.consecutiveDays = 1;
    } else {
      yoyoMemory.consecutiveDays++;
    }
  } else if (!yoyoMemory.lastActiveDate) {
    yoyoMemory.consecutiveDays = 1;
  }

  if (yoyoMemory.lastActiveDate !== today) {
    yoyoMemory.totalActiveDays++;
  }
  yoyoMemory.lastActiveDate = today;

  saveMemory();

  // 成长系统：每日首次登录 +10 XP
  if (yoyoGrowth.lastLoginDate !== today) {
    yoyoGrowth.lastLoginDate = today;
    addXP(10);
  }
}

export function memoryDrivenGreeting() {
  const now = new Date();
  const today = now.toDateString();

  if (yoyoMemory.startTimes.length > 1) {
    const prevStart = yoyoMemory.startTimes[yoyoMemory.startTimes.length - 2];
    const prevDate = new Date(prevStart).toDateString();
    const prevDateObj = new Date(prevDate);
    const todayObj = new Date(today);
    const diffDays = Math.floor((todayObj - prevDateObj) / 86400000);
    if (diffDays > 1) {
      say(randomFrom(MEMORY_LINES.missedDays), 7000);
      return;
    }
  }

  const consMilestones = [7, 14, 30, 50, 100, 200, 365];
  if (consMilestones.includes(yoyoMemory.consecutiveDays)) {
    const milestoneKey = `cons_milestone_${yoyoMemory.consecutiveDays}`;
    if (!hasDailyFlag(milestoneKey)) {
      setDailyFlag(milestoneKey);
      const line = randomFrom(MEMORY_LINES.consecutiveMilestone)
        .replace('{days}', yoyoMemory.consecutiveDays);
      say(line, 7000);
      return;
    }
  }

  const usualStart = getUsualStartHour();
  if (usualStart && now.getHours() > usualStart + 1 && Math.random() < 0.3) {
    say(randomFrom(MEMORY_LINES.lateArrival), 6000);
    return;
  }

  if (hoursSinceLastWhip() < 24 && hoursSinceLastWhip() > 1 && Math.random() < 0.2) {
    say(randomFrom(MEMORY_LINES.rememberWhip), 6000);
    return;
  }
}

// ===== 成长等级系统 =====

export const LEVELS = [
  { name: '小豆芽', minXP: 0 },
  { name: '小花苞', minXP: 50 },
  { name: '小蝴蝶', minXP: 150 },
  { name: '小公主', minXP: 350 },
  { name: '小天使', minXP: 700 }
];

export const EVOLUTION_PATHS = {
  active: { name: '活力线', level3Name: '小舞者', emoji: '💃' },
  gentle: { name: '温柔线', level3Name: '小书虫', emoji: '📚' },
  energy: { name: '元气线', level3Name: '小助手', emoji: '⚡' }
};

export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i + 1;
  }
  return 1;
}

export function getLevelName(level, path) {
  if (level === 3 && path) {
    return EVOLUTION_PATHS[path]?.level3Name || '小蝴蝶';
  }
  return LEVELS[level - 1]?.name || '小豆芽';
}

function createDefaultGrowth() {
  return { xp: 0, level: 1, lastLoginDate: '', pathStats: { interactionCount: 0, companionTime: 0, workTime: 0 }, path: null };
}

export let yoyoGrowth = createDefaultGrowth();

/** 在 initStore() 完成后调用，用存储数据覆盖默认值 */
export function initGrowth() {
  const saved = get('growth');
  if (saved) {
    yoyoGrowth = { ...createDefaultGrowth(), ...saved };
    if (!yoyoGrowth.pathStats) {
      yoyoGrowth.pathStats = { interactionCount: 0, companionTime: 0, workTime: 0 };
    }
    if (!yoyoGrowth.path && getLevel(yoyoGrowth.xp) >= 3) {
      yoyoGrowth.path = 'energy';
    }
  }
}

export function saveGrowth() {
  set('growth', yoyoGrowth);
}

export function addXP(amount) {
  const oldLevel = getLevel(yoyoGrowth.xp);
  yoyoGrowth.xp += amount;
  const newLevel = getLevel(yoyoGrowth.xp);
  if (newLevel > oldLevel) {
    onLevelUp(newLevel);
  }
  saveGrowth();
}

export function trackGrowthStat(stat, amount) {
  if (amount === undefined) amount = 1;
  if (!yoyoGrowth.pathStats) yoyoGrowth.pathStats = { interactionCount: 0, companionTime: 0, workTime: 0 };
  yoyoGrowth.pathStats[stat] = (yoyoGrowth.pathStats[stat] || 0) + amount;
  saveGrowth();
}

function determineEvolutionPath() {
  const stats = yoyoGrowth.pathStats || { interactionCount: 0, companionTime: 0, workTime: 0 };
  const { interactionCount, companionTime, workTime } = stats;
  if (interactionCount > companionTime && interactionCount > workTime) return 'active';
  if (companionTime > interactionCount && companionTime > workTime) return 'gentle';
  return 'energy';
}

function onLevelUp(newLevel) {
  if (newLevel === 3 && !yoyoGrowth.path) {
    yoyoGrowth.path = determineEvolutionPath();
    const pathInfo = EVOLUTION_PATHS[yoyoGrowth.path];
    speechQueue.priorityEnqueue(`我进化啦！我成为了${pathInfo.emoji} ${pathInfo.level3Name}！`);
  } else {
    const name = getLevelName(newLevel, yoyoGrowth.path);
    speechQueue.priorityEnqueue(`妈妈！Yoyo升级啦！现在是${name}了！开心～`);
  }
  setState('clapping');
  if (window.petApi && window.petApi.triggerEffect) {
    window.petApi.triggerEffect('heart');
  }
  applyEmotionEvent('happy');
  checkAchievements('levelup', null);
}

// 成长等级/进化路线影响行为引擎评分
export function applyGrowthModifiers(score, behaviorName) {
  const level = getLevel(yoyoGrowth.xp);
  const evoPath = yoyoGrowth.path;

  if (level >= 3) {
    if (behaviorName === 'swing') score *= 1.15;
    if (behaviorName === 'readBook') score *= 1.1;
  }
  if (level >= 5) {
    if (behaviorName === 'giftFlower') score *= 1.2;
  }

  if (evoPath === 'active') {
    if (behaviorName === 'dance') score *= 1.2;
    if (behaviorName === 'walk') score *= 1.15;
  } else if (evoPath === 'gentle') {
    if (behaviorName === 'sweetTalk') score *= 1.2;
    if (behaviorName === 'readBook') score *= 1.15;
  } else if (evoPath === 'energy') {
    if (behaviorName === 'wave') score *= 1.2;
    if (behaviorName === 'wpsCompanion') score *= 1.15;
  }

  return score;
}

// ===== 每日签到系统 =====
export const CHECKIN_REWARDS = [
  { days: 1, xp: 10, text: '签到成功！+10 XP ✨' },
  { days: 3, xp: 15, text: '连续3天！你真棒~ +15 XP 🌟' },
  { days: 7, xp: 25, text: '连续一周！好有毅力！+25 XP 💪' },
  { days: 14, xp: 35, text: '两周不间断！我好开心~ +35 XP 🎉' },
  { days: 30, xp: 50, text: '一个月了！你是最棒的！+50 XP 🏆' },
];

export function initCheckinSystem() {
  try {
    const data = get('checkin') || { streak: 0, lastDate: '', totalDays: 0 };
    const today = new Date().toISOString().slice(0, 10);

    if (data.lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastDate === yesterday) {
      data.streak++;
    } else {
      data.streak = 1;
    }
    data.lastDate = today;
    data.totalDays++;

    let reward = CHECKIN_REWARDS[0];
    for (const r of CHECKIN_REWARDS) {
      if (data.streak >= r.days) reward = r;
    }

    setTimeout(() => {
      speechQueue.enqueue(reward.text, 6000, SPEECH_PRIORITY.IMPORTANT);
      playSound('giggle');
      setState('clapping');
      addXP(reward.xp);

      if (data.streak === 7 || data.streak === 30) {
        setTimeout(() => {
          window.petApi.triggerCloneEffect();
          incrementAchievementStat('cloneTriggered');
        }, 2000);
      }
      if (data.streak === 3 || data.streak === 14) {
        setTimeout(() => window.petApi.triggerEffect('flower'), 1500);
      }

      checkAchievements('checkin', data);
    }, 3000);

    set('checkin', data);
  } catch (e) { /* store 异常保护 */ }
}

// ===== 成就徽章系统 =====
export const ACHIEVEMENTS = [
  { id: 'streak_7', name: '坚持不懈', desc: '连续签到7天', icon: '🔥', condition: (ctx) => ctx.checkin?.streak >= 7 },
  { id: 'streak_30', name: '三十而立', desc: '连续签到30天', icon: '👑', condition: (ctx) => ctx.checkin?.streak >= 30 },
  { id: 'pet_50', name: '摸摸达人', desc: '被抚摸50次', icon: '🤗', condition: (ctx) => ctx.petCount >= 50 },
  { id: 'pet_100', name: '宠爱有加', desc: '被抚摸100次', icon: '💖', condition: (ctx) => ctx.petCount >= 100 },
  { id: 'overtime_3', name: '加班守护', desc: '触发加班提醒3次', icon: '🌙', condition: (ctx) => ctx.overtimeCount >= 3 },
  { id: 'overtime_10', name: '深夜卫士', desc: '触发加班提醒10次', icon: '⭐', condition: (ctx) => ctx.overtimeCount >= 10 },
  { id: 'level_max', name: '小天使', desc: '升到最高等级', icon: '👼', condition: (ctx) => ctx.level >= 5 },
  { id: 'clone', name: '影分身术', desc: '第一次触发分身术', icon: '🎭', condition: (ctx) => ctx.cloneTriggered },
  { id: 'weather_listener', name: '天气通', desc: '收到10次天气提醒', icon: '🌤️', condition: (ctx) => ctx.weatherRemindCount >= 10 },
  { id: 'all_features', name: '全能探索', desc: '尝试过所有功能', icon: '🗺️', condition: (ctx) => ctx.featuresUsed >= 8 },
  { id: 'companion_24h', name: '长情陪伴', desc: '累计陪伴24小时', icon: '💕', condition: (ctx) => ctx.totalHours >= 24 },
  { id: 'companion_100h', name: '不离不弃', desc: '累计陪伴100小时', icon: '💎', condition: (ctx) => ctx.totalHours >= 100 },
  { id: 'dancer', name: '舞林高手', desc: '跳舞10次', icon: '💃', condition: (ctx) => ctx.danceCount >= 10 },
  { id: 'climber', name: '攀爬健将', desc: '攀爬5次', icon: '🧗', condition: (ctx) => ctx.climbCount >= 5 },
];

export function loadAchievementProgress() {
  return get('achievements') || {
    unlocked: [],
    stats: { petCount: 0, overtimeCount: 0, cloneTriggered: false, weatherRemindCount: 0, featuresUsed: 0, totalHours: 0, danceCount: 0, climbCount: 0 }
  };
}

export function saveAchievementProgress(progress) {
  set('achievements', progress);
}

export function incrementAchievementStat(statName, amount = 1) {
  const progress = loadAchievementProgress();
  if (typeof progress.stats[statName] === 'number') {
    progress.stats[statName] += amount;
  } else if (typeof progress.stats[statName] === 'boolean') {
    progress.stats[statName] = true;
  }
  saveAchievementProgress(progress);
  checkAchievements('stat_update', null);
}

const _usedFeaturesKey = 'usedFeatures';
export function trackFeatureUsed(featureId) {
  const used = get(_usedFeaturesKey) || [];
  if (!used.includes(featureId)) {
    used.push(featureId);
    set(_usedFeaturesKey, used);
    const progress = loadAchievementProgress();
    progress.stats.featuresUsed = used.length;
    saveAchievementProgress(progress);
    checkAchievements('stat_update', null);
  }
}

export function checkAchievements(trigger, extraData) {
  const progress = loadAchievementProgress();
  const ctx = {
    ...progress.stats,
    checkin: extraData || (get('checkin') || {}),
    level: getLevel(yoyoGrowth.xp),
  };

  let newUnlock = false;
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (progress.unlocked.includes(ach.id)) continue;
    try {
      if (ach.condition(ctx)) {
        progress.unlocked.push(ach.id);
        newUnlock = true;
        newlyUnlocked.push(ach);
      }
    } catch (e) { /* ignore */ }
  }

  if (newUnlock) {
    saveAchievementProgress(progress);
    newlyUnlocked.forEach((ach, i) => {
      setTimeout(() => showAchievementToast(ach), 1000 + i * 2500);
    });
  }
}

function showAchievementToast(achievement) {
  speechQueue.priorityEnqueue(`🏅 成就解锁：${achievement.icon} ${achievement.name}！${achievement.desc}`);
  playSound('clap');
  setState('clapping');

  if (achievement.id === 'level_max' || achievement.id === 'streak_30' || achievement.id === 'companion_100h') {
    setTimeout(() => {
      window.petApi.triggerCloneEffect();
      incrementAchievementStat('cloneTriggered');
    }, 2000);
  }
}
