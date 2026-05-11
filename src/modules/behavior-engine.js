// behavior-engine.js - BEHAVIORS 数组 + tick 逻辑 + 冷却 + 评分
import { state, WEATHER_CODES, randomFrom, say, setState, speechQueue, feedBtn, isOnCooldown, setCooldown, SPEECH_PRIORITY, globalTimers } from './core-state.js';
import { stateMachine, ACTION_STATES, GLOBAL_MODES } from './state-machine.js';
import { applyEmotionEvent, applyEmotionModifier, yoyoEmotion } from './emotion-system.js';
import { yoyoGrowth, yoyoMemory, getLevel, applyGrowthModifiers, incrementAchievementStat, trackFeatureUsed, trackGrowthStat, daysSinceLastPet, hoursSinceLastWhip, isInBusyHour, MEMORY_LINES } from './growth-system.js';
import { set } from './store-client.js';
import { startClimbing, CLIMB_START_MESSAGES } from './climbing.js';
import { showHungerUI } from './interaction.js';
import { checkSeasonalParticleTrigger } from './weather-seasonal.js';

// ===== 需求系统 =====
export const petNeeds = {
  // energy 实际代表“疲劳/困意”：0=精神，100=很困。
  // 之前默认 80，且睡眠评分直接用 energy * 0.8，启动后很容易立刻睡觉。
  energy: 30,
  boredom: 20,
  hunger: 10,
  playfulness: 50,
};

// ===== 消息数组（拟真4-5岁小女孩语气） =====
export const BORED_MESSAGES = [
  '妈妈～你在干嘛呀？Yoyo好无聊哦...',
  '唔…妈妈理理Yoyo嘛…',
  '妈妈妈妈！看看Yoyo呀～',
  '好无聊好无聊…妈妈陪Yoyo玩一会儿好不好？',
  '妈妈在哪里呀？Yoyo想妈妈了…',
];

export const SLEEPY_MESSAGES = [
  '呼…Yoyo困困…打个盹盹…',
  '啊～好困呀…眼睛都睁不开了…',
  '眼皮好重…Yoyo要睡着了…zzZ…',
  '妈妈…Yoyo困了…就睡一小会儿…',
  '呼噜…呼噜…（Yoyo睡着了）',
];

export const HUNGER_MESSAGES = [
  '妈妈～Yoyo的小肚子咕咕叫啦！',
  '妈妈妈妈！Yoyo饿了想吃东西～',
  '肚子好饿呀…妈妈给Yoyo吃点什么嘛～',
  '好想吃零食…妈妈～求求你啦～',
  '咦？Yoyo闻到好香的味道！是什么呀？',
];

// WPS工作陪伴文案
function getWpsCompanionSaying() {
  const sayings = [
    '妈妈在备课呀～Yoyo乖乖不吵你～',
    '妈妈加油！Yoyo在旁边安安静静陪着你～',
    '妈妈好认真呀！Yoyo也要学妈妈当个好学生～',
    '妈妈在做PPT吗？好厉害好厉害！',
    '嘘…Yoyo不出声，让妈妈专心工作～',
    '妈妈写的字好漂亮！Yoyo也想学写字～',
    '妈妈备课辛苦啦～等下Yoyo给你捶捶背！',
    '妈妈的学生好幸福呀，有这么认真的老师～',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

// 行为台词
const BEHAVIOR_LINES = {
  idle: [],
  bashful: [
    '嘿嘿～妈妈看Yoyo干什么嘛，好害羞哦～',
    '妈妈你一直看着Yoyo，Yoyo脸红了啦～',
    '哼哼～妈妈最好啦！（偷偷开心）',
    '嘿嘿嘿～今天的Yoyo特别特别开心！',
    '妈妈妈妈！Yoyo好开心好开心！嘻嘻～',
    '妈妈好厉害！Yoyo好崇拜妈妈哦～',
  ],
  walk: [
    '妈妈～Yoyo散个步就回来！',
    '走一走看一看～有什么好玩的呀？',
    'Yoyo出去溜达一小圈～',
    '嘿嘿，到处逛逛～小腿腿活动活动！',
    '散步散步～外面的世界好大呀～',
  ],
  wave: [
    '妈妈！Yoyo在这里哦～',
    '嗨嗨！妈妈看到Yoyo了吗？',
    '妈妈别忘了Yoyo呀～跟你挥挥手～',
    '东看看西看看…妈妈在干什么呢？',
    'Yoyo跟妈妈打个招呼！嗨～',
  ],
  dance: [
    '妈妈快看！Yoyo会跳舞啦！',
    '啦啦啦～转圈圈～跳舞好开心呀！',
    '来一段表演给妈妈看！噔噔噔～',
    '蹦恰恰蹦恰恰～Yoyo跳得好不好？',
    'Yoyo最会跳舞了！妈妈快夸我～',
  ],
  sleep: [
    '呼…Yoyo好困呀…就睡一小会儿…',
    '眼皮好重…zzZ…Yoyo睡着啦…',
    '趁妈妈不注意偷偷眯一下…zzZ…',
    '困困…妈妈晚安…Yoyo先睡啦…',
    '休息一下下…妈妈别走开哦…呼…',
  ],
  climb: CLIMB_START_MESSAGES,
  hungry: HUNGER_MESSAGES,
};

// 玩耍行为文案
function getSwingSaying() {
  const sayings = [
    '妈妈快看！Yoyo在荡秋千～好高好高！',
    '推我推我！再高一点点嘛～嘻嘻～',
    '妈妈～风呼呼吹到Yoyo脸上啦，凉凉的～',
    '哇～Yoyo要飞到天上去了！',
    '好好玩呀～妈妈也来荡嘛～一起一起！',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getDigSandSaying() {
  const sayings = [
    '妈妈你看！Yoyo挖到宝藏啦！是什么呀？',
    '咦？这里有只小虫虫～圆圆的好可爱！',
    '妈妈～Yoyo在给你种小花花哦～',
    '挖呀挖呀挖～种小小的种子开大大的花～',
    'Yoyo要给妈妈挖一个大城堡！好大好大的！',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getReadBookSaying() {
  const sayings = [
    '妈妈～这本书好好看呀！有好多图画！',
    'Yoyo在看绘本哦～里面有小兔兔！',
    '妈妈晚上给Yoyo讲故事好不好？求求你啦～',
    '这个字Yoyo认识！是"大"字！对不对？',
    '安安静静看书的Yoyo是不是特别乖呀？',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getWatchTVSaying() {
  const sayings = [
    '妈妈～动画片开始啦！Yoyo可以看一小会儿吗？',
    '就看一集！就一集！好不好嘛～',
    '这个故事好好看呀！妈妈快来一起看！',
    '妈妈妈妈～那个小狗狗好好笑哈哈哈～',
    '看完这集Yoyo就去睡觉觉～保证保证！',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getOvertimeReminder() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    const sayings = [
      '妈妈～今天是周末呀！别工作了陪Yoyo玩嘛～',
      '妈妈放假还在忙…Yoyo好想妈妈陪…',
      '妈妈～周末啦，可以休息一下下嘛？',
      '妈妈不要加班了好不好～Yoyo给你捶捶背～',
    ];
    return sayings[Math.floor(Math.random() * sayings.length)];
  }

  if (hour >= 22) {
    const sayings = [
      '妈妈都这么晚了…Yoyo好心疼你…',
      '妈妈快去睡觉觉！明天再弄嘛～好不好？',
      '妈妈眼睛会累坏的…Yoyo不要妈妈生病…',
      '好晚了…妈妈你太辛苦了…Yoyo抱抱～',
    ];
    return sayings[Math.floor(Math.random() * sayings.length)];
  }

  const sayings = [
    '妈妈～还在忙呀？记得要喝水水哦～',
    '妈妈加油加油！忙完了Yoyo给你跳个舞！',
    '妈妈辛苦啦～要不要休息一下下呀？',
    '妈妈别太累了哦…Yoyo乖乖等你～',
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

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
      return Math.max(0, Math.min(100, score));
    },
    async onExecute() {
      const lines = BEHAVIOR_LINES.walk;
      say(lines[Math.floor(Math.random() * lines.length)]);
      const direction = Math.random() > 0.5 ? 1 : -1;
      const distance = 40 + Math.random() * 60;
      const walkState = direction > 0 ? 'runningRight' : 'runningLeft';
      setState(walkState);
      let remaining = distance;
      const walkTimer = setInterval(async () => {
        if (remaining <= 0) {
          clearInterval(walkTimer);
          setState('idle');
          return;
        }
        const moved = await window.petApi.moveBy({ x: direction * 2, y: 0 });
        remaining -= 2;
        const { bounds, workArea } = await window.petApi.getBounds();
        if (moved.x <= workArea.x || moved.x + bounds.width >= workArea.x + workArea.width) {
          remaining = 0;
        }
      }, 50);
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
      const lines = BEHAVIOR_LINES.wave;
      say(lines[Math.floor(Math.random() * lines.length)]);
    }
  },
  {
    name: 'dance',
    state: 'dancing',
    duration: 5000,
    cooldown: 300000,
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.5 + (100 - needs.energy) * 0.3;
      if (needs.energy < 40 && needs.boredom > 60) score += 20;
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 40;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('dancing');
      const lines = BEHAVIOR_LINES.dance;
      say(lines[Math.floor(Math.random() * lines.length)]);
      applyEmotionEvent('play');
      incrementAchievementStat('danceCount');
      trackFeatureUsed('dance');
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
      const lines = BEHAVIOR_LINES.sleep;
      say(lines[Math.floor(Math.random() * lines.length)]);
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
    onExecute() {
      startClimbing();
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
      say(randomFrom(BORED_MESSAGES));
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
      say(randomFrom(lines));
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
      say(randomFrom(BEHAVIOR_LINES.bashful));
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
      say(randomFrom(lines), 6000);
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
      say(randomFrom(lines), 6000);
      window.petApi.triggerEffect('candy');
    }
  },
  {
    name: 'swing',
    state: 'swing',
    duration: 6000,
    cooldown: 3600000,
    utilityFn(needs, ctx) {
      const day = new Date().getDay();
      const hour = new Date().getHours();
      const isWeekend = day === 0 || day === 6;
      const isAfternoon = hour >= 14 && hour <= 17;
      let u = needs.playfulness * 0.4 + needs.boredom * 0.3;
      if (isWeekend) u += 20;
      if (isAfternoon) u += 15;
      if (yoyoEmotion && yoyoEmotion.valence > 60) u += 15;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('swing');
      say(getSwingSaying());
      applyEmotionEvent('happy');
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
      say(getDigSandSaying());
      applyEmotionEvent('curious');
    }
  },
  {
    name: 'readBook',
    state: 'readBook',
    duration: 8000,
    cooldown: 10800000,
    utilityFn(needs, ctx) {
      const hour = new Date().getHours();
      const isEvening = hour >= 20 && hour <= 22;
      let u = 20;
      if (isEvening) u += 30;
      if (yoyoEmotion && yoyoEmotion.arousal < 40) u += 20;
      if (needs.boredom > 50) u += 15;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('readBook');
      say(getReadBookSaying());
      applyEmotionEvent('calm');
    }
  },
  {
    name: 'watchTV',
    state: 'watchTV',
    duration: 8000,
    cooldown: 7200000,
    utilityFn(needs, ctx) {
      const day = new Date().getDay();
      const hour = new Date().getHours();
      const isWeekend = day === 0 || day === 6;
      const isEvening = hour >= 19 && hour <= 22;
      let u = 15;
      if (isWeekend && isEvening) u += 35;
      else if (isEvening) u += 20;
      if (needs.boredom > 60) u += 15;
      return Math.max(0, Math.min(100, u));
    },
    onExecute() {
      setState('watchTV');
      say(getWatchTVSaying());
      applyEmotionEvent('relaxed');
    }
  },
  {
    name: 'overtimeReminder',
    state: 'waiting',
    duration: 6000,
    cooldown: 3600000,
    utilityFn(needs, ctx) {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const isWeekend = day === 0 || day === 6;
      const isLateWork = hour >= 20;
      const isHoliday = isWeekend;

      if (!isLateWork && !isHoliday) return 0;
      let u = 0;
      if (isHoliday && hour >= 9 && hour <= 22) u = 75;
      else if (isLateWork) u = 70 + (hour - 20) * 5;
      if (state.currentActiveApp.isWPS) u += 15;
      return u;
    },
    onExecute() {
      setState('waiting');
      speechQueue.enqueue(getOvertimeReminder(), 6000, SPEECH_PRIORITY.IMPORTANT);
      applyEmotionEvent('worried');
      incrementAchievementStat('overtimeCount');
      trackGrowthStat('workTime', 0.5);
    }
  },
  {
    name: 'wpsCompanion',
    state: 'review',
    duration: 6000,
    cooldown: 1800000,
    utilityFn(needs, ctx) {
      if (!state.currentActiveApp.isWPS) return 0;
      const hour = new Date().getHours();
      if (hour >= 20) return 0;
      let score = 55;
      if (ctx.isWeekend) score += 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('review');
      say(getWpsCompanionSaying());
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
      setState('clapping');
      say('看我的——法天象地！', 6000);
      window.petApi.triggerGiantEffect();
      applyEmotionEvent('happy');
      incrementAchievementStat('giantCount');
      trackFeatureUsed('giant');
      // 6秒后说"累了"
      setTimeout(() => {
        say('呼～好累', 3000);
      }, 6500);
    }
  }
];

// ===== 特殊日期（用于行为上下文） =====
export const SPECIAL_DATES = [
  { month: 7, day: 5, type: 'birthday', messages: ['今天是Yoyo的生日！妈妈记得吗？嘿嘿～', '妈妈！今天Yoyo又长大一岁啦！'] },
  { month: 9, day: 28, type: 'anniversary', messages: ['今天是爸爸妈妈的纪念日！要永远永远幸福哦～', '妈妈和爸爸结婚纪念日快乐！Yoyo爱你们！'] },
  { month: 9, day: 10, type: 'teachers_day', messages: ['妈妈老师节日快乐！Yoyo给妈妈送花花～', '教师节快乐！妈妈是最好的老师！'] },
  { month: 5, day: -1, type: 'mothers_day', messages: ['妈妈节日快乐！Yoyo最爱妈妈了！', '母亲节快乐～妈妈辛苦了！送你花花！'] },
];

export function getMothersDay(year) {
  const may1 = new Date(year, 4, 1);
  const dayOfWeek = may1.getDay();
  const firstSunday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  return firstSunday + 7;
}

// ===== 功能引导提醒 =====
const FEATURE_TIPS = [
  { id: 'rightclick', text: '💡 试试右键点击我，有很多好玩的功能哦~' },
  { id: 'doubleclick', text: '💡 双击我试试看，会有惊喜~' },
  { id: 'drag', text: '💡 你可以拖着我到处走哦，放开手还会弹跳~' },
  { id: 'climb', text: '💡 你知道我会爬窗口边缘吗？等等看~' },
  { id: 'dance', text: '💡 右键菜单里可以让我跳舞哦~' },
  { id: 'follow', text: '💡 试试右键让我跟着你的鼠标走~' },
  { id: 'weather', text: '💡 我会根据天气变化提醒你加衣服哦~' },
  { id: 'overtime', text: '💡 加班的时候我会心疼你的，别太累了~' },
  { id: 'wps', text: '💡 你用WPS工作的时候我会安静陪你~' },
  { id: 'settings', text: '💡 右键菜单里有设置，可以调整我的行为~' },
];

function maybeShowFeatureTip() {
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
    hour: now.getHours(),
    dayOfWeek: day,
    isWeekend: (day === 0 || day === 6),
    isMonday: (day === 1),
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
    say(randomFrom(MEMORY_LINES.longNoPet), 6000);
    return true;
  }

  if (hoursSinceLastWhip() < 24 && hoursSinceLastWhip() > 1) {
    state.lastMemoryTriggerTime = Date.now();
    setState('failed');
    say(randomFrom(MEMORY_LINES.rememberWhip), 6000);
    return true;
  }

  return false;
}

// ===== 决策引擎主循环 =====
export function behaviorEngineTick() {
  checkSeasonalParticleTrigger();

  if (stateMachine.actionState !== ACTION_STATES.IDLE || stateMachine.globalMode !== GLOBAL_MODES.INTERACTIVE) {
    return;
  }

  if (state.stateName === 'clapping' && Date.now() > state.keyboardActiveUntil) {
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

  let bestBehavior = null;
  let bestScore = -1;

  for (const behavior of BEHAVIORS) {
    if (isOnCooldown(behavior.name)) continue;
    if (behavior.name === 'hungry' && feedBtn.classList.contains('show')) continue;

    let score = behavior.utilityFn(petNeeds, ctx);
    score = applyEmotionModifier(behavior.name, score);
    score = applyGrowthModifiers(score, behavior.name);
    if (score > bestScore) {
      bestScore = score;
      bestBehavior = behavior;
    }
  }

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

  bestBehavior.onExecute();

  if (bestBehavior.name === 'walk') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 10);
    petNeeds.playfulness = Math.max(0, petNeeds.playfulness - 5);
  } else if (bestBehavior.name === 'wave') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 8);
  } else if (bestBehavior.name === 'dance') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 25);
    petNeeds.energy = Math.min(100, petNeeds.energy + 5);
  } else if (bestBehavior.name === 'sleep') {
    petNeeds.energy = Math.max(0, petNeeds.energy - 45);
  } else if (bestBehavior.name === 'climb') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 30);
  } else if (bestBehavior.name === 'lookAround') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 12);
  } else if (bestBehavior.name === 'swing') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 20);
    petNeeds.playfulness = Math.max(0, petNeeds.playfulness - 10);
  } else if (bestBehavior.name === 'digSand') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 18);
  } else if (bestBehavior.name === 'readBook') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 15);
    petNeeds.energy = Math.min(100, petNeeds.energy + 5);
  } else if (bestBehavior.name === 'watchTV') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 20);
  } else if (bestBehavior.name === 'giant') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 30);
    petNeeds.energy = Math.min(100, petNeeds.energy + 10);
  }
}

// ===== 启动行为决策引擎 =====
export function startBehaviorEngine() {
  globalTimers.push(setInterval(behaviorEngineTick, 2000));
}
