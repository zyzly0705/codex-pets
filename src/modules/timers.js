// timers.js - 所有定时器统一管理（dailyReminders, weather refresh 等）
import { state, STATES, globalTimers, say, setState, playSound, randomFrom, hasDailyFlag, setDailyFlag } from './core-state.js';
import { stateMachine } from './state-machine.js';
import { yoyoMemory, saveMemory, addXP, incrementAchievementStat, trackGrowthStat } from './growth-system.js';
import { updateEmotion, yoyoEmotion, getEmotionLabel } from './emotion-system.js';
import { refreshWeatherContext } from './weather-seasonal.js';
import { resetInteraction } from './interaction.js';
import { behaviorEngineTick, SPECIAL_DATES, getMothersDay } from './behavior-engine.js';
import { get, set } from './store-client.js';
import { checkDailyNewsBroadcast } from './news-broadcast.js';
import { recordDailyEvent, maybeSpeakDailySummary } from './daily-memory.js';
import { triggerMicroExpr } from './render-engine.js';

// ===== 定时提醒系统 =====
// 根据设置动态生成提醒列表（上下班时间可配置）
function buildDailyReminders() {
  const s = state.yoyoSettings || {};
  const startH = s.workStartHour ?? 9;
  const endH   = s.workEndHour   ?? 18;
  const workMode = s.workMode || 'balanced';
  // 上班提醒提前 10 分钟
  const startRemindH = startH === 0 ? 23 : startH - 1;
  const startRemindM = 50;
  return [
    { id: 'work-start', hour: startRemindH, minute: startRemindM, state: 'waving', messages: workMode === 'focus'
      ? ['专注模式开始啦，Yoyo会安静陪着你。', '妈妈开始工作吧，Yoyo守在旁边～']
      : ['妈妈早上好呀！今天也要加油鸭～', '新的一天开始啦！妈妈冲鸭冲鸭！'] },
    { id: 'drink-10',   hour: 10, minute: 0, state: 'review',  messages: ['妈妈该喝水啦～身体要棒棒的！', '喝口水吧，Yoyo想让妈妈轻松一点～'] },
    { id: 'lunch',      hour: 12, minute: 0, state: 'waving',  messages: ['妈妈妈妈！该吃饭啦，Yoyo也饿了～', '中午啦！妈妈快去吃饭！不许饿着肚子哦！'] },
    { id: 'drink-14',   hour: 14, minute: 0, state: 'review',  messages: ['下午啦～妈妈喝口水提提神吧！', '妈妈！Yoyo又来提醒喝水啦～'] },
    { id: 'work-end',   hour: endH, minute: 0, state: 'jumping', messages: workMode === 'overtime'
      ? ['妈妈辛苦啦，今晚别太勉强自己，好吗？', '加班也要慢一点，Yoyo陪着你。']
      : ['妈妈辛苦啦～该收工回家陪Yoyo啦！', '下班啦下班啦！妈妈快回来快回来～'] },
    { id: 'wrap-up',    hour: Math.max(17, endH - 1), minute: 30, state: 'sofaLying', messages: ['可以慢慢收尾啦，Yoyo陪你放松下来～', '今天已经做得很好了，别急，慢慢收工。'] },
  ];
}

// ===== 晚安检测 =====
export function checkGoodNight() {
  const hour = new Date().getHours();
  const nightKey = `goodnight_${new Date().toDateString()}`;
  if (hour >= 23 && !hasDailyFlag(nightKey)) {
    setDailyFlag(nightKey);
    if (maybeSpeakDailySummary()) return;
    setState('yawning');
    say('妈妈晚安～做个好梦，明天见！', 8000);
    setTimeout(() => {
      if (!stateMachine.isDancing && !stateMachine.isFollowing) {
        setState('idle');
        STATES.idle.fps = 1;
        setTimeout(() => { STATES.idle.fps = 4; }, 30000);
      }
    }, 3000);
  }
}

// ===== 每日提醒检查 =====
function checkDailyReminders() {
  if (stateMachine.isSleeping) return;
  const now = new Date();
  const today = now.toDateString();

  if (today !== state.lastReminderDate) {
    state.triggeredReminders.clear();
    state.lastReminderDate = today;
  }

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  checkGoodNight();

  for (const reminder of buildDailyReminders()) {
    if (currentHour === reminder.hour && currentMinute === reminder.minute && !state.triggeredReminders.has(reminder.id)) {
      if (state.yoyoSettings.reminderFreq === 'low') {
        if (!['work-start', 'lunch', 'work-end', 'wrap-up'].includes(reminder.id)) continue;
      } else if (state.yoyoSettings.reminderFreq === 'medium') {
        if (['drink-14'].includes(reminder.id)) continue;
      }
      const msg = reminder.messages[Math.floor(Math.random() * reminder.messages.length)];
      if (reminder.id === 'work-start') {
        setState('stretching');
      } else {
        setState(reminder.state);
      }
      say(msg);
      recordDailyEvent('reminder', { kind: reminder.id.startsWith('work') ? 'work' : 'life' });
      state.triggeredReminders.add(reminder.id);
      resetInteraction();
      break;
    }
  }
}

// ===== 早安检测 =====
export function checkGoodMorning() {
  const today = new Date().toDateString();
  // 用 store 的 lastGreetDate 而非旧的 yoyo_last_active_date
  const lastActive = get('lastGreetDate');
  if (lastActive !== today) {
    set('lastGreetDate', today);
    if (lastActive) {   // 不是第一次启动
      setTimeout(() => {
        setState('stretching');
        say('妈妈早安！新的一天开始啦！Yoyo陪你！', 6000);
      }, 2000);
    }
  }
}

// ===== 特殊日期检查 =====
export function checkSpecialDate() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const todayKey = `special_date_${year}_${month}_${day}`;

  if (hasDailyFlag(todayKey)) return;

  for (const sd of SPECIAL_DATES) {
    let targetDay = sd.day;
    if (sd.type === 'mothers_day') {
      targetDay = getMothersDay(year);
    }
    if (sd.month === month && targetDay === day) {
      setDailyFlag(todayKey);
      const msg = sd.messages[Math.floor(Math.random() * sd.messages.length)];
      setState('jumping');
      say(msg, 8000);
      let tick = 0;
      const celebrateInterval = setInterval(() => {
        tick++;
        setState(tick % 2 === 0 ? 'jumping' : 'waving');
        if (tick >= 6) clearInterval(celebrateInterval);
      }, 1000);
      if (sd.type === 'teachers_day' || sd.type === 'mothers_day') {
        setState('gifting');
        say('妈妈～这是Yoyo送你的花花！', 8000);
        window.petApi.triggerEffect('flower');
      } else if (sd.type === 'birthday') {
        window.petApi.triggerEffect('candy');
      } else if (sd.type === 'anniversary') {
        window.petApi.triggerEffect('heart');
      }
      return;
    }
  }
}

// ===== 陪伴天数系统 =====
const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000];

export function checkCompanionMilestone() {
  if (!get('firstDay')) {
    set('firstDay', Date.now());
  }
  const firstDay = get('firstDay');
  const companionDays = Math.floor((Date.now() - firstDay) / 86400000);
  const milestoneKey = `milestone_${new Date().toDateString()}`;

  if (hasDailyFlag(milestoneKey)) return;

  if (MILESTONES.includes(companionDays)) {
    setDailyFlag(milestoneKey);
    setState('clapping');
    playSound('clap');
    say(`Yoyo已经陪妈妈${companionDays}天啦！好开心～`, 8000);
    if (companionDays >= 100) addXP(200);
    else if (companionDays >= 30) addXP(100);
    else addXP(50);
    let tick = 0;
    const celebrateInterval = setInterval(() => {
      tick++;
      setState(tick % 2 === 0 ? 'clapping' : 'jumping');
      if (tick % 2 === 0) playSound('clap');
      if (tick >= 4) clearInterval(celebrateInterval);
    }, 1200);
  }
}

// ===== 初始化所有定时器 =====
export function initTimers() {
  // 陪伴天数初始化
  if (!get('firstDay')) {
    set('firstDay', Date.now());
  }

  // 每日提醒检查（立即+延迟5秒启动）
  checkDailyReminders();
  setTimeout(() => {
    globalTimers.push(setInterval(checkDailyReminders, 60 * 1000));
  }, 5000);

  // 天气刷新（延迟10秒启动，每30分钟）
  setTimeout(() => {
    globalTimers.push(setInterval(refreshWeatherContext, 30 * 60 * 1000));
  }, 10000);

  // 每日新闻播报：启动后稍等网络/天气初始化，之后每小时检查一次
  setTimeout(() => {
    checkDailyNewsBroadcast();
    globalTimers.push(setInterval(checkDailyNewsBroadcast, 60 * 60 * 1000));
  }, 15000);

  // 记忆系统：每小时活跃度更新
  globalTimers.push(setInterval(() => {
    const currentHour = new Date().getHours();
    if (currentHour !== state.lastMemoryHour) {
      state.lastMemoryHour = currentHour;
      if (yoyoMemory._lastHourlyUpdate !== currentHour) {
        yoyoMemory.hourlyActivity[currentHour]++;
        yoyoMemory._lastHourlyUpdate = currentHour;
      }
      saveMemory();
      addXP(2);
      incrementAchievementStat('totalHours', 1);
      trackGrowthStat('companionTime', 1);
      recordDailyEvent('activeMinutes', { amount: 60 });
    }
  }, 65000));

  globalTimers.push(setInterval(maybeSpeakDailySummary, 10 * 60 * 1000));

  // 每5分钟自动保存记忆
  globalTimers.push(setInterval(() => {
    saveMemory();
  }, 300000));

  // 情感系统衰减（每5秒）
  globalTimers.push(setInterval(() => updateEmotion(5000), 5000));

  // 自发微表情：每 20 秒有 25% 概率闪现一个和当前情绪匹配的微表情
  // 模拟小孩会突然皱眉、偷笑、发呆这样的自然表情变化
  globalTimers.push(setInterval(() => {
    if (Math.random() > 0.25) return;
    if (stateMachine.isSleeping || stateMachine.isDragging) return;
    const label = getEmotionLabel();
    const EXPR_BY_MOOD = {
      excited: ['sparkle', 'sparkle', 'heart'],
      happy:   ['happy', 'shy', 'sparkle'],
      neutral: ['happy', 'sleepy', 'neutral'],
      calm:    ['sleepy', 'happy'],
      sad:     ['sad', 'sad', 'neutral'],
      angry:   ['angry', 'sad'],
    };
    const pool = EXPR_BY_MOOD[label] || ['neutral'];
    const expr = pool[Math.floor(Math.random() * pool.length)];
    triggerMicroExpr(expr, 1200 + Math.random() * 800);
  }, 20000));

  // 天气更新后延迟触发行为决策
  // (weatherContext refresh 已在 weather-seasonal 中处理)
}
