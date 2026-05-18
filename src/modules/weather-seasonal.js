// weather-seasonal.js - 天气获取/提醒 + 季节粒子 + 天气代码映射
import { state, WEATHER_CODES, say, setState, speechQueue, SPEECH_PRIORITY, petCapabilityEnabled, petBehaviorAllowed, isStartupQuiet } from './core-state.js';
import { incrementAchievementStat, trackFeatureUsed } from './growth-system.js';
import { stateMachine } from './state-machine.js';
import { sayWithAi } from './ai-dialogue.js';
import { recordDailyEvent } from './daily-memory.js';

// ===== 季节微粒子系统 =====
export const SEASON_PARTICLES = {
  spring: { emojis: ['🌸', '🌷', '💮'], color: '#FFB7C5' },
  summer: { emojis: ['✨', '🌟', '💫'], color: '#FFD700' },
  autumn: { emojis: ['🍂', '🍁', '🍃'], color: '#D2691E' },
  winter: { emojis: ['❄️', '🌨️', '⛄'], color: '#B0E0E6' }
};

export function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function triggerSeasonalParticles() {
  const season = getCurrentSeason();
  const config = SEASON_PARTICLES[season];
  const count = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i++) {
    state.seasonalParticles.push({
      emoji: config.emojis[Math.floor(Math.random() * config.emojis.length)],
      x: Math.random() * 200,
      y: -20 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.5 + Math.random() * 0.8,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 3,
      opacity: 1,
      life: 0,
      maxLife: 2000 + Math.random() * 1000
    });
  }
}

export function updateSeasonalParticles(dt) {
  for (let i = state.seasonalParticles.length - 1; i >= 0; i--) {
    const p = state.seasonalParticles[i];
    p.life += dt;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotSpeed;
    if (p.life > p.maxLife - 500) {
      p.opacity = Math.max(0, (p.maxLife - p.life) / 500);
    }
    if (p.life >= p.maxLife) {
      state.seasonalParticles.splice(i, 1);
    }
  }
}

export function drawSeasonalParticles(drawCtx) {
  for (const p of state.seasonalParticles) {
    drawCtx.save();
    drawCtx.globalAlpha = p.opacity;
    drawCtx.translate(p.x, p.y);
    drawCtx.rotate(p.rotation * Math.PI / 180);
    drawCtx.font = '14px serif';
    drawCtx.textAlign = 'center';
    drawCtx.fillText(p.emoji, 0, 0);
    drawCtx.restore();
  }
}

export function checkSeasonalParticleTrigger() {
  const now = Date.now();
  const interval = (30 + Math.random() * 30) * 60 * 1000;
  if (now - state.lastSeasonalTrigger >= interval) {
    state.lastSeasonalTrigger = now;
    triggerSeasonalParticles();
  }
}

// ===== 天气与时间 =====
export function weatherMood(current) {
  if (!current) return null;
  const kind = WEATHER_CODES.get(current.weather_code) || 'cloudy';
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  if (kind === 'rain') return { state: 'waiting', text: `外面下雨啦！妈妈记得带伞伞哦～别淋湿了！` };
  if (kind === 'snow') return { state: 'jumping', text: `哇下雪啦！妈妈要穿得暖暖的出门哦～` };
  if (kind === 'storm') return { state: 'failed', text: `外面好大的雷！轰隆隆的…妈妈不要出门哦～` };
  if (temp > 35) return { state: 'waiting', text: `好热好热！妈妈多喝水别中暑哦～Yoyo担心！` };
  if (temp >= 30) return { state: 'waiting', text: `好热呀！妈妈记得多喝水～` };
  if (temp <= 5) return { state: 'waiting', text: `好冷好冷！妈妈穿暖和了吗？别感冒啦～` };
  if (temp < 10) return { state: 'waiting', text: `好冷呀！妈妈记得穿厚外套哦～` };
  if (wind >= 28) return { state: 'review', text: `外面风好大呀！妈妈出门要小心哦～` };
  if (kind === 'clear') return { state: 'jumping', text: `今天天气好好哦～妈妈心情也要棒棒的！` };
  return { state: 'review', text: `今天是阴天，妈妈注意保暖哦～` };
}

function canWeatherTakeOverState() {
  return stateMachine.isIdle && !state.currentBehavior;
}

export function timeMood() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = (day === 0 || day === 6);
  const isMonday = (day === 1);

  if (hour < 6) return { state: 'failed', text: '妈妈…都这么晚了还不睡吗？Yoyo好担心…' };
  if (hour < 9) {
    if (isMonday) return { state: 'waving', text: '又是周一啦…妈妈加油加油！Yoyo给你打气！' };
    if (isWeekend) return { state: 'jumping', text: '周末早安呀！妈妈今天可以多睡一会儿～' };
    return { state: 'waving', text: '妈妈早安！今天也是元气满满的一天！' };
  }
  if (hour < 12) {
    if (isWeekend) return { state: 'jumping', text: '今天是周末耶！妈妈可以多陪陪Yoyo吗？' };
    return { state: 'jumping', text: '妈妈加油！Yoyo在旁边安安静静陪着你～' };
  }
  if (hour < 14) return { state: 'review', text: '中午好呀！妈妈别忘了休息一下下～' };
  if (hour < 18) {
    if (isWeekend) return { state: 'jumping', text: '周末下午啦～妈妈要不要带Yoyo出去玩玩？' };
    return { state: 'review', text: '妈妈下午也要加油鸭～Yoyo给你打气！' };
  }
  if (hour < 22) return { state: 'review', text: '妈妈晚上好～要早点睡觉觉哦！' };
  return { state: 'failed', text: '妈妈…都这么晚了还在忙吗？Yoyo好心疼…' };
}

export async function refreshWeatherContext() {
  if (!petCapabilityEnabled('weather') || !petBehaviorAllowed('weather')) {
    const fallback = timeMood();
    if (canWeatherTakeOverState()) {
      setState(fallback.state);
    }
    if (!isStartupQuiet()) {
      sayWithAi({ behavior: 'timeMood', fallback: fallback.text, context: '时间问候' });
    }
    return;
  }
  try {
    const result = await window.petApi.getWeather();
    if (result.ok) {
      state.weatherContext = result;
      const mood = weatherMood(result.current);
      if (canWeatherTakeOverState()) {
        setState(mood.state);
      }
      if (!isStartupQuiet()) {
        const placePrefix = result.place ? `${result.place}天气：` : '';
        sayWithAi({ behavior: 'weatherMood', fallback: `${placePrefix}${mood.text}`, context: '天气提醒' });
        checkWeatherReminders(result);
      }
      // 延迟触发行为决策（由 behavior-engine 处理）
      return;
    }
    setState('review');
    if (!isStartupQuiet()) {
      sayWithAi({ behavior: 'weatherFallback', fallback: result.error || '天气没有取到，Yoyo先按时间陪妈妈～' });
    }
  } catch {
    setState('review');
    if (!isStartupQuiet()) {
      sayWithAi({ behavior: 'weatherFallback', fallback: '天气暂时看不了，Yoyo先陪妈妈～' });
    }
  }
  const fallback = timeMood();
  setState(fallback.state);
  if (!isStartupQuiet()) {
    sayWithAi({ behavior: 'timeMood', fallback: fallback.text, context: '时间问候' });
  }
}

// ===== 天气智能提醒系统 =====
export function checkWeatherReminders(weatherData) {
  if (!petCapabilityEnabled('weather') || !petBehaviorAllowed('weatherReminder')) return;
  const today = new Date().toDateString();
  if (state.lastWeatherReminderDate !== today) {
    state.lastWeatherReminderDate = today;
    state.weatherReminderCount = 0;
  }
  if (state.weatherReminderCount >= 2) return;

  const temp = weatherData.current ? weatherData.current.temperature_2m : null;
  if (temp === null) return;
  const { tempDrop, rainComing, windWarning, minTemp6h } = weatherData;

  let msg = '';

  if (temp < 15 || tempDrop) {
    const icon = '🧥';
    const currentTemp = Math.round(temp);
    const nextMin = minTemp6h !== null ? Math.round(minTemp6h) : null;
    if (tempDrop && currentTemp >= 26 && nextMin !== null && nextMin >= 18) {
      msg = `${icon} 现在${currentTemp}°C，晚些会降到${nextMin}°C，温差会变大，出门带件薄外套哦~`;
    } else if (tempDrop && nextMin !== null) {
      msg = `${icon} 现在${currentTemp}°C，马上还要降温到${nextMin}°C，记得加件外套哦~`;
    } else {
      msg = `${icon} 现在${currentTemp}°C，记得穿暖一点哦~`;
    }
    state.weatherReminderCount++;
  } else if (rainComing) {
    msg = `☔ 接下来几小时可能要下雨，出门记得带伞哦~`;
    state.weatherReminderCount++;
  } else if (windWarning) {
    msg = `💨 外面风好大，注意别被吹跑啦~`;
    state.weatherReminderCount++;
  }

  if (msg) {
    setTimeout(() => {
      state.currentBehavior = 'weatherReminder';
      state.behaviorEndTime = Date.now() + 6000;
      setState('review');
      speechQueue.enqueue(msg, 6000, SPEECH_PRIORITY.IMPORTANT);
      recordDailyEvent('reminder', { kind: 'weather' });
      setTimeout(() => {
        if (state.currentBehavior === 'weatherReminder') {
          state.currentBehavior = null;
          state.behaviorEndTime = 0;
          if (state.stateName === 'review') setState('idle');
        }
      }, 6200);
    }, 8000);
    incrementAchievementStat('weatherRemindCount');
    trackFeatureUsed('weather');
  }
}
