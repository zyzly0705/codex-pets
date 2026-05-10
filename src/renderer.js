// renderer.js - 主入口：import 所有模块，初始化，启动
import { state, globalTimers, say, setState, randomFrom } from './modules/core-state.js';
import { stateMachine } from './modules/state-machine.js';
import { updateEmotion } from './modules/emotion-system.js';
import { memoryOnStartup, memoryDrivenGreeting, initCheckinSystem, yoyoGrowth, addXP, trackFeatureUsed } from './modules/growth-system.js';
import { startBehaviorEngine, behaviorEngineTick } from './modules/behavior-engine.js';
import { initInteraction, loadPets, resetInteraction } from './modules/interaction.js';
import { initClimbSystem } from './modules/climbing.js';
import { refreshWeatherContext } from './modules/weather-seasonal.js';
import { initTimers, checkGoodMorning, checkSpecialDate, checkCompanionMilestone } from './modules/timers.js';
import { initOutfitSystem } from './modules/outfit-system.js';
import { initCloneSystem } from './modules/clone-system.js';
import { startRenderLoop } from './modules/render-engine.js';
import { startEntryAnimation } from './modules/startup-animation.js';

// ===== 全局设置状态（IPC监听）=====
if (window.petApi && window.petApi.onSettingsChanged) {
  window.petApi.onSettingsChanged((settings) => {
    state.yoyoSettings = settings;
    state.isMuted = !settings.soundEnabled;
    localStorage.setItem('yoyo_muted', state.isMuted.toString());
  });
}

if (window.petApi && window.petApi.onSettingsReset) {
  window.petApi.onSettingsReset(() => {
    localStorage.clear();
    location.reload();
  });
}

// ===== 妈妈回来检测 =====
window.petApi.onSystemResume(() => {
  resetInteraction();
  setState('jumping');
  say('妈妈回来啦！Yoyo好想你！', 6000);
});

// ===== 前台应用状态（WPS工作陪伴） =====
if (window.petApi && window.petApi.onActiveAppChanged) {
  window.petApi.onActiveAppChanged((data) => {
    state.currentActiveApp = data;
  });
}

// ===== 繁忙提醒 =====
const BUSY_REMINDER_MESSAGES = [
  '妈妈已经忙了好久了...休息一下好不好？',
  '妈妈～站起来动动吧！Yoyo担心你～',
  '妈妈别太累了！Yoyo心疼...',
  '妈妈工作好认真！但是也要注意身体哦～',
  '妈妈！休息5分钟好不好？Yoyo陪你～',
  '妈妈眼睛会累的！看看远处休息一下嘛～',
  '妈妈～喝口水站起来走走吧！'
];

window.petApi.onBusyReminder(() => {
  setState('review');
  trackFeatureUsed('busyReminder');
  if (state.currentActiveApp.isWPS) {
    const wpsOvertimeLines = [
      '妈妈备课好久了...眼睛会累的，休息一下嘛～',
      '妈妈在WPS里写了好久了！Yoyo心疼妈妈...',
      '妈妈已经在电脑前很久了...站起来动动吧！',
      '妈妈辛苦了！备课也要注意休息哦～'
    ];
    say(randomFrom(wpsOvertimeLines), 8000);
  } else {
    say(randomFrom(BUSY_REMINDER_MESSAGES), 8000);
  }
});

// ===== 首次启动引导 =====
if (!localStorage.getItem('hasSeenGuide')) {
  setTimeout(() => {
    say('妈妈好！右键可以和Yoyo玩哦～');
    localStorage.setItem('hasSeenGuide', 'true');
  }, 3000);
}

// ===== 初始化 =====
async function init() {
  // 初始化交互系统（注册事件监听）
  initInteraction();

  // 初始化攀爬系统（检测窗口扫描能力）
  initClimbSystem();

  // 初始化换装系统
  initOutfitSystem();

  // 初始化分身术
  initCloneSystem();

  // 加载宠物并启动天气
  await loadPets();
  refreshWeatherContext();

  // 启动记忆系统
  memoryOnStartup();

  // 启动时检测特殊日期和里程碑
  setTimeout(() => {
    checkGoodMorning();
    checkSpecialDate();
    checkCompanionMilestone();
  }, 4000);

  // 记忆驱动的问候
  setTimeout(() => {
    memoryDrivenGreeting();
  }, 6000);

  // 每日签到系统
  setTimeout(() => {
    initCheckinSystem();
  }, 8000);

  // 启动渲染循环
  startRenderLoop();

  // 启动入场动画（仅首次启动播放）
  startEntryAnimation();
  // 动画结束后说一句话
  if (!sessionStorage.getItem('yoyo_entered')) {
    setTimeout(() => {
      say('Yoyo来啦～', 3000);
    }, 2000);
  }

  // 启动行为决策引擎
  startBehaviorEngine();

  // 启动所有定时器
  initTimers();
}

init().catch(err => console.error('Yoyo init failed:', err));

// ===== 全局定时器清理 =====
window.addEventListener('beforeunload', () => {
  globalTimers.forEach(id => clearInterval(id));
});
