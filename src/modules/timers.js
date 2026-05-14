// timers.js - 所有定时器统一管理（dailyReminders, weather refresh 等）
import { state, STATES, globalTimers, say, setState, playSound, randomFrom, hasDailyFlag, setDailyFlag } from './core-state.js';
import { stateMachine } from './state-machine.js';
import { yoyoMemory, saveMemory, addXP, incrementAchievementStat, trackGrowthStat } from './growth-system.js';
import { updateEmotion } from './emotion-system.js';
import { refreshWeatherContext } from './weather-seasonal.js';
import { resetInteraction } from './interaction.js';
import { behaviorEngineTick, SPECIAL_DATES, getMothersDay } from './behavior-engine.js';
import { get, set } from './store-client.js';
import { checkDailyNewsBroadcast } from './news-broadcast.js';

// ===== 定时提醒系统 =====
// 根据设置动态生成提醒列表（上下班时间可配置）
function buildDailyReminders() {
  const s = state.yoyoSettings || {};
  const startH = s.workStartHour ?? 9;
  const endH   = s.workEndHour   ?? 18;
  // 上班提醒提前 10 分钟
  const startRemindH = startH === 0 ? 23 : startH - 1;
  const startRemindM = 50;
  return [
    { id: 'work-start', hour: startRemindH, minute: startRemindM, state: 'waving', messages: ['妈妈早上好呀！今天也要加油鸭～', '新的一天开始啦！妈妈冲鸭冲鸭！', '妈妈出发上班啦～Yoyo在家乖乖等你回来！'] },
    { id: 'drink-10',   hour: 10, minute: 0, state: 'review',  messages: ['妈妈该喝水啦～身体要棒棒的！', '妈妈！水杯是不是空了呀？快去接水！', '喝口水吧～Yoyo提醒妈妈补充水分！'] },
    { id: 'lunch',      hour: 12, minute: 0, state: 'waving',  messages: ['妈妈妈妈！该吃饭啦，Yoyo也饿了～', '午饭时间到！妈妈吃点好的犒劳自己～', '中午啦！妈妈快去吃饭！不许饿着肚子哦！'] },
    { id: 'drink-14',   hour: 14, minute: 0, state: 'review',  messages: ['下午啦～妈妈喝口水提提神吧！', '妈妈！Yoyo又来提醒喝水啦～', '喝口水嘛～妈妈下午也要元气满满！'] },
    { id: 'drink-16',   hour: 16, minute: 0, state: 'review',  messages: ['妈妈！Yoyo又来啦～该喝水咯！', '快下班了！喝口水坚持一下下～', '妈妈别忘了喝水哦～Yoyo很认真的在提醒！'] },
    { id: 'work-end',   hour: endH, minute: 0, state: 'jumping', messages: ['妈妈辛苦啦～该收工回家陪Yoyo啦！', '下班啦下班啦！妈妈快回来快回来～', '妈妈别加班了！Yoyo想你想你～'] },
    { id: 'dinner',     hour: 19, minute: 0, state: 'waving',  messages: ['妈妈该吃晚饭啦，不许饿肚子哦！', '晚饭时间到！妈妈吃点热乎乎的～', '妈妈～Yoyo肚子又饿了，一起吃饭饭吧！'] },
    { id: 'drink-20',   hour: 20, minute: 0, state: 'review',  messages: ['妈妈该喝水啦～晚上也要补水哦！', '妈妈！睡前喝口水～对身体好！', '喝口水吧～妈妈今天辛苦啦！'] },
  ];
}

// ===== 晚安检测 =====
export function checkGoodNight() {
  const hour = new Date().getHours();
  const nightKey = `goodnight_${new Date().toDateString()}`;
  if (hour >= 23 && !hasDailyFlag(nightKey)) {
    setDailyFlag(nightKey);
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
        if (!['work-start', 'lunch', 'work-end'].includes(reminder.id)) continue;
      } else if (state.yoyoSettings.reminderFreq === 'medium') {
        if (['drink-14', 'drink-16', 'drink-20'].includes(reminder.id)) continue;
      }
      const msg = reminder.messages[Math.floor(Math.random() * reminder.messages.length)];
      if (reminder.id === 'work-start') {
        setState('stretching');
      } else {
        setState(reminder.state);
      }
      say(msg);
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
    }
  }, 65000));

  // 每5分钟自动保存记忆
  globalTimers.push(setInterval(() => {
    saveMemory();
  }, 300000));

  // 情感系统衰减（每5秒）
  globalTimers.push(setInterval(() => updateEmotion(5000), 5000));

  // 天气更新后延迟触发行为决策
  // (weatherContext refresh 已在 weather-seasonal 中处理)
}
