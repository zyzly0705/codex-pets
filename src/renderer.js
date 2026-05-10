const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

const CELL_W = 192;
const CELL_H = 208;
const STATES = {
  idle: { row: 0, frames: 6, fps: 4 },
  runningRight: { row: 1, frames: 8, fps: 8 },
  runningLeft: { row: 2, frames: 8, fps: 8 },
  waving: { row: 3, frames: 4, fps: 4 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 4 },
  waiting: { row: 6, frames: 6, fps: 3 },
  review: { row: 8, frames: 6, fps: 4 },
  // 扩展状态 (row 9-15)
  climbing: { row: 9, frames: 6, fps: 5 },
  perching: { row: 10, frames: 4, fps: 3 },
  petting: { row: 11, frames: 4, fps: 4 },
  yawning: { row: 12, frames: 5, fps: 3 },
  eating: { row: 13, frames: 6, fps: 5 },
  dizzy: { row: 14, frames: 4, fps: 6 },
  lookingAround: { row: 15, frames: 5, fps: 3 },
  // 玩耍状态 (row 16-19)
  swing: { row: 16, frames: 8, speed: 200 },      // 荡秋千
  digSand: { row: 17, frames: 8, speed: 250 },    // 挖土
  readBook: { row: 18, frames: 8, speed: 300 },   // 看书
  watchTV: { row: 19, frames: 8, speed: 350 },    // 看电视
  // 专属动画 (row 20-25)
  sleeping: { row: 20, frames: 8, speed: 400 },    // 慢速呼吸
  dancing: { row: 21, frames: 8, speed: 150 },     // 快速扭动
  crying: { row: 22, frames: 8, speed: 250 },      // 中速抽泣
  gifting: { row: 23, frames: 8, speed: 200 },     // 举手递东西
  stretching: { row: 24, frames: 8, speed: 300 },  // 伸展
  clapping: { row: 25, frames: 8, speed: 150 },    // 快速拍手
};

const WEATHER_CODES = new Map([
  [0, 'clear'],
  [1, 'clear'],
  [2, 'cloudy'],
  [3, 'cloudy'],
  [45, 'fog'],
  [48, 'fog'],
  [51, 'rain'],
  [53, 'rain'],
  [55, 'rain'],
  [61, 'rain'],
  [63, 'rain'],
  [65, 'rain'],
  [71, 'snow'],
  [73, 'snow'],
  [75, 'snow'],
  [95, 'storm']
]);

let pets = [];
let currentPet;
let sprite = new Image();
let stateName = 'idle';
let frame = 0;
let lastFrameAt = 0;
let messageTimer;
let weatherContext = null;
let dragState = null;

let feedScaleStart = 0;
const FEED_SCALE_DURATION = 600; // ms
const FEED_SCALE_MAX = 1.3;

// ===== 拖拽物理效果 =====
let isDropping = false;

// ===== 音效系统 =====
let audioCtx = null;
let isMuted = localStorage.getItem('yoyo_muted') === 'true';
const masterVolume = 0.25;
let stepSoundCounter = 0;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'step':
      osc.frequency.value = 200;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'giggle':
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'cry':
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.3);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'bounce':
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'clap':
      osc.type = 'square';
      osc.frequency.value = 150;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
  }
}

function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('yoyo_muted', isMuted.toString());
}

// ===== Yoyo 记忆系统 =====
const MEMORY_KEY = 'yoyo_memory';

function loadMemory() {
  const saved = localStorage.getItem(MEMORY_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 确保 hourlyActivity 数组完整
      if (!parsed.hourlyActivity || parsed.hourlyActivity.length !== 24) {
        parsed.hourlyActivity = new Array(24).fill(0);
      }
      return parsed;
    } catch { return createDefaultMemory(); }
  }
  return createDefaultMemory();
}

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
  };
}

let yoyoMemory = loadMemory();

function saveMemory() {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(yoyoMemory));
}

// 记忆文案集
const MEMORY_LINES = {
  missedDays: [
    '妈妈昨天没来看Yoyo...Yoyo好想你呀！',
    '妈妈！你终于来了！Yoyo以为你忘了Yoyo...',
  ],
  longNoPet: [
    '妈妈...好久没摸摸Yoyo了...',
    '妈妈是不是不爱Yoyo了...（委屈脸）',
    '人家想要妈妈摸摸头嘛～',
  ],
  rememberWhip: [
    '妈妈...今天不要打Yoyo好不好...',
    '哼！Yoyo还记得上次的事呢！',
    '妈妈上次打Yoyo好疼的...（揉揉）',
  ],
  lateArrival: [
    '妈妈今天来晚了～Yoyo等了好久呢！',
    '妈妈！你可算来了！Yoyo还以为你不来了...',
  ],
  petMilestone: [
    '妈妈已经摸了Yoyo{count}次了！Yoyo好幸福～',
    '第{count}次摸摸！妈妈的手好温暖～',
  ],
  consecutiveMilestone: [
    '妈妈连续{days}天来看Yoyo了！好开心！',
    'Yoyo和妈妈已经连续{days}天在一起了！',
  ],
};

// ----- 记忆辅助函数 -----

// 计算妈妈的平均到来时间（小时）
function getUsualStartHour() {
  if (yoyoMemory.startTimes.length < 3) return null;
  const hours = yoyoMemory.startTimes.map(t => new Date(t).getHours());
  return Math.round(hours.reduce((a, b) => a + b) / hours.length);
}

// 找出妈妈最忙的时段（hourlyActivity 最高的3个小时）
function getBusiestHours() {
  return yoyoMemory.hourlyActivity
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => h.hour);
}

// 判断当前是否处于忙碌时段
function isInBusyHour() {
  const currentHour = new Date().getHours();
  const busiestHours = getBusiestHours();
  return busiestHours.includes(currentHour);
}

// 距离上次被抚摸的天数
function daysSinceLastPet() {
  if (!yoyoMemory.lastPetTime) return 999;
  return (Date.now() - yoyoMemory.lastPetTime) / 86400000;
}

// 距离上次被鞭打的小时数
function hoursSinceLastWhip() {
  if (!yoyoMemory.lastWhipTime) return 999;
  return (Date.now() - yoyoMemory.lastWhipTime) / 3600000;
}

// 启动时更新记忆（开机时间 + 连续天数 + hourlyActivity）
function memoryOnStartup() {
  const now = new Date();
  const today = now.toDateString();

  // 记录开机时间（保留最近7天）
  yoyoMemory.startTimes.push(now.getTime());
  if (yoyoMemory.startTimes.length > 7) {
    yoyoMemory.startTimes = yoyoMemory.startTimes.slice(-7);
  }

  // 每小时活跃度 +1
  yoyoMemory.hourlyActivity[now.getHours()]++;
  // 记录当前小时已更新，避免与每小时定时器重复
  yoyoMemory._lastHourlyUpdate = now.getHours();

  // 连续天数检查
  if (yoyoMemory.lastActiveDate && yoyoMemory.lastActiveDate !== today) {
    const lastDate = new Date(yoyoMemory.lastActiveDate);
    const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
    if (diffDays > 1) {
      // 断了
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

// 记忆驱动触发（启动后延迟执行，有概率触发记忆相关文案）
function memoryDrivenGreeting() {
  const now = new Date();
  const today = now.toDateString();

  // 检查是否断了一天
  // 注意：这里只在有记录且非首次时才触发
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

  // 连续天数里程碑（7, 14, 30, 50, 100, 200, 365）
  const consMilestones = [7, 14, 30, 50, 100, 200, 365];
  if (consMilestones.includes(yoyoMemory.consecutiveDays)) {
    const milestoneKey = `cons_milestone_${yoyoMemory.consecutiveDays}`;
    if (!localStorage.getItem(milestoneKey)) {
      localStorage.setItem(milestoneKey, 'true');
      const line = randomFrom(MEMORY_LINES.consecutiveMilestone)
        .replace('{days}', yoyoMemory.consecutiveDays);
      say(line, 7000);
      return;
    }
  }

  // 如果今天比平时晚来超过1小时（30%概率触发）
  const usualStart = getUsualStartHour();
  if (usualStart && now.getHours() > usualStart + 1 && Math.random() < 0.3) {
    say(randomFrom(MEMORY_LINES.lateArrival), 6000);
    return;
  }

  // 记仇：上次被打在24h内（20%概率开机时提一嘴）
  if (hoursSinceLastWhip() < 24 && hoursSinceLastWhip() > 1 && Math.random() < 0.2) {
    say(randomFrom(MEMORY_LINES.rememberWhip), 6000);
    return;
  }
}

// ===== Yoyo 成长等级系统 =====
const GROWTH_KEY = 'yoyo_growth';
let yoyoGrowth = loadGrowth();

function loadGrowth() {
  try {
    const saved = localStorage.getItem(GROWTH_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { xp: 0, level: 1, lastLoginDate: '' };
}

function saveGrowth() {
  localStorage.setItem(GROWTH_KEY, JSON.stringify(yoyoGrowth));
}

const LEVELS = [
  { name: '小豆芽', minXP: 0 },
  { name: '小花苞', minXP: 50 },
  { name: '小蝴蝶', minXP: 150 },
  { name: '小公主', minXP: 350 },
  { name: '小天使', minXP: 700 }
];

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i + 1;
  }
  return 1;
}

function getLevelName(level) {
  return LEVELS[level - 1]?.name || '小豆芽';
}

function addXP(amount) {
  const oldLevel = getLevel(yoyoGrowth.xp);
  yoyoGrowth.xp += amount;
  const newLevel = getLevel(yoyoGrowth.xp);
  if (newLevel > oldLevel) {
    onLevelUp(newLevel);
  }
  saveGrowth();
}

function onLevelUp(newLevel) {
  const name = getLevelName(newLevel);
  say(`妈妈！Yoyo升级啦！现在是${name}了！开心～`);
  setState('clapping');
  if (window.petApi && window.petApi.triggerEffect) {
    window.petApi.triggerEffect('heart');
  }
  if (typeof applyEmotionEvent === 'function') {
    applyEmotionEvent('happy');
  }
}

// ===== 全局设置状态 =====
let yoyoSettings = { autoStart: true, soundEnabled: true, reminderFreq: 'medium', activity: 'normal' };

if (window.petApi && window.petApi.onSettingsChanged) {
  window.petApi.onSettingsChanged((settings) => {
    yoyoSettings = settings;
    // 应用音效设置
    isMuted = !settings.soundEnabled;
    localStorage.setItem('yoyo_muted', isMuted.toString());
  });
}

if (window.petApi && window.petApi.onSettingsReset) {
  window.petApi.onSettingsReset(() => {
    localStorage.clear();
    location.reload();
  });
}

// ===== Yoyo 拟人化情感系统 =====
const yoyoEmotion = {
  // PAD三维情感空间
  valence: 55,        // 正负情绪: -100(极伤心) ~ +100(超开心)，基线55（偏开心的小女孩）
  arousal: 55,        // 活跃度: 0(平静) ~ 100(兴奋)，基线55（活泼）
  dominance: 50,      // 掌控感: 0(无力/委屈) ~ 100(自信)，基线50

  // 基线（情绪会慢慢回到这里）
  baselineValence: 55,
  baselineArousal: 55,
  baselineDominance: 50,

  // Yoyo的性格（大五人格，0-100）
  personality: {
    extraversion: 75,      // 活泼外向：更常主动说话
    agreeableness: 80,     // 粘人温顺：被抚摸更开心，被打更委屈
    neuroticism: 45,       // 偶尔小脾气：被打多次会真生气
    openness: 70,          // 好奇心：对新事物（天气变化等）更感兴趣
  },
};

// 情感事件响应配置
const EMOTION_EVENTS = {
  pet: { valence: +30, arousal: +20, dominance: +10 },
  whip: { valence: -50, arousal: +35, dominance: -40 },
  feed: { valence: +40, arousal: +10, dominance: +5 },
  play: { valence: +25, arousal: +30, dominance: +15 },
  ignore: { valence: -10, arousal: -5, dominance: -5 },  // 长时间不理
  happy: { valence: +20, arousal: +15, dominance: +10 },   // 开心（荡秋千）
  curious: { valence: +15, arousal: +20, dominance: +5 },  // 好奇（挖土）
  calm: { valence: +10, arousal: -20, dominance: +5 },     // 平静（看书）
  relaxed: { valence: +15, arousal: -15, dominance: +5 },  // 放松（看电视）
  worried: { valence: -15, arousal: +10, dominance: -10 }, // 担心（加班心疼）
  sad: { valence: -30, arousal: +20, dominance: -15 },     // 伤心（哭泣）
};

// 情感工具函数
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }

// 情感衰减更新（每次调用传入间隔毫秒）
function updateEmotion(dt_ms) {
  const dt = dt_ms / 1000;
  const decay = 0.015; // 每秒衰减1.5%回到基线

  yoyoEmotion.valence = lerp(yoyoEmotion.valence, yoyoEmotion.baselineValence, decay * dt);
  yoyoEmotion.arousal = lerp(yoyoEmotion.arousal, yoyoEmotion.baselineArousal, decay * dt);
  yoyoEmotion.dominance = lerp(yoyoEmotion.dominance, yoyoEmotion.baselineDominance, decay * dt);
}

// 应用情感事件（性格调节）
function applyEmotionEvent(eventType) {
  const ev = EMOTION_EVENTS[eventType];
  if (!ev) return;

  // 性格调节系数
  let vMod = 1, aMod = 1, dMod = 1;
  const p = yoyoEmotion.personality;

  if (eventType === 'pet') {
    vMod = 1 + (p.agreeableness - 50) / 100; // 粘人的更开心
  } else if (eventType === 'whip') {
    vMod = 1 + (p.neuroticism - 50) / 100;   // 神经质的更伤心
    dMod = 1 + (p.agreeableness - 50) / 100;  // 温顺的更无力
  } else if (eventType === 'play') {
    aMod = 1 + (p.extraversion - 50) / 100;   // 外向的更兴奋
  }

  yoyoEmotion.valence = clamp(yoyoEmotion.valence + ev.valence * vMod, -100, 100);
  yoyoEmotion.arousal = clamp(yoyoEmotion.arousal + ev.arousal * aMod, 0, 100);
  yoyoEmotion.dominance = clamp(yoyoEmotion.dominance + ev.dominance * dMod, 0, 100);
}

// 获取当前情绪标签
function getEmotionLabel() {
  const { valence, arousal, dominance } = yoyoEmotion;
  if (valence > 70 && arousal > 60) return 'excited';   // 兴奋开心
  if (valence > 50) return 'happy';                      // 开心
  if (valence < -50 && dominance < 30) return 'sad';     // 伤心委屈
  if (valence < -30 && dominance > 50) return 'angry';   // 生气
  if (arousal < 25) return 'calm';                       // 平静
  return 'neutral';                                       // 中性
}

// 情感驱动文案选择器
function emotionSay(dialogueMap, fallback) {
  const mood = getEmotionLabel();
  const pool = dialogueMap[mood] || dialogueMap.neutral || dialogueMap.happy;
  if (pool && pool.length > 0) {
    say(pool[Math.floor(Math.random() * pool.length)]);
  } else if (fallback) {
    say(fallback);
  }
}

// 情绪分层文案：抚摸
const PET_DIALOGUES = {
  happy: ['嘿嘿！妈妈摸摸！Yoyo最喜欢了～', '好开心好开心！再摸摸～', '妈妈的手好温暖～'],
  excited: ['哇！妈妈你好温柔！Yoyo爱你爱你爱你！', '呀呀呀～太幸福了！', '再摸摸嘛～Yoyo最喜欢妈妈了！'],
  neutral: ['嗯～妈妈的手好温暖', '摸摸头～', '嘿嘿，妈妈最爱Yoyo了～'],
  calm: ['嗯…妈妈摸摸…好舒服…', '轻轻的…Yoyo快睡着了…'],
  sad: ['…妈妈…你终于想起Yoyo了…', '哼…现在才来摸…（嘟嘴）', '…妈妈…Yoyo好想你…'],
  angry: ['…哼！（扭过头）', '…Yoyo不想理妈妈…（但还是好舒服）', '…哼…算你还知道来摸摸…'],
};

// 情绪分层文案：鞭打
const WHIP_DIALOGUES = {
  happy: ['哎呀！妈妈你坏坏！打不着Yoyo～', '嘿嘿没打疼～', '妈妈就是闹着玩的吧？'],
  excited: ['哎呀！妈妈轻点嘛！', '呜！但是Yoyo心情好所以原谅你！'],
  neutral: ['呜…妈妈别打Yoyo…', '疼…Yoyo知道错了…', '呜呜…妈妈轻点…'],
  calm: ['…疼…', '妈妈…为什么打Yoyo…'],
  sad: ['呜呜呜…妈妈为什么一直打Yoyo…', '你是不是不爱Yoyo了…（大哭）', '呜…Yoyo最可怜了…'],
  angry: ['够了！！Yoyo生气了！不理你了！', '哼！！妈妈太过分了！！', '再打Yoyo就再也不理你了！！'],
};

// 情绪分层文案：喂食
const FEED_DIALOGUES = {
  happy: ['好吃好吃！妈妈最好了！', '呀！Yoyo最爱的！谢谢妈妈～', '嗯嗯真香！妈妈最好了！'],
  excited: ['哇哇哇！太好吃了！妈妈再给一个嘛！', '好幸福！Yoyo要吃撑了！', '太棒了太棒了！妈妈最好了！'],
  neutral: ['嗯嗯～谢谢妈妈', '吃饱饱了～', '谢谢妈妈投喂！'],
  calm: ['嗯…好吃…谢谢妈妈…', '慢慢吃…好香…'],
  sad: ['…哼…妈妈终于想起给Yoyo吃的了…', '…好吧…谢谢…（委屈地吃）', '…吃了…但Yoyo还是不开心…'],
  angry: ['…哼！吃了不代表原谅你！', '…好吧给吃的就勉强原谅你…', '…不是给吃的就能解决的！（但还是吃了）'],
};

// 情感影响行为引擎评分
function applyEmotionModifier(behaviorName, baseScore) {
  const { valence, arousal, dominance } = yoyoEmotion;

  switch(behaviorName) {
    case 'sweetTalk':
      // 开心时更爱撒娇，伤心时也可能求安慰
      return baseScore * (valence > 50 ? 1.3 : (valence < -30 ? 1.2 : 1.0));
    case 'dance':
      // 兴奋时更想跳舞
      return baseScore * (arousal > 70 ? 1.5 : 1.0);
    case 'sleep':
      // 平静/低活跃时更想睡
      return baseScore * (arousal < 30 ? 1.4 : 1.0);
    case 'climb':
      // 自信/好奇时更想爬
      return baseScore * (dominance > 60 ? 1.3 : 1.0);
    case 'lookAround':
      // 无聊+中性情绪时
      return baseScore;
    case 'walk':
      // 活跃度高时更想走
      return baseScore * (arousal > 60 ? 1.2 : 1.0);
    case 'wave':
      // 伤心时更想引起注意
      return baseScore * (valence < -20 ? 1.3 : 1.0);
    default:
      return baseScore;
  }
}

// ===== 右键菜单模式状态 =====
let isDancing = false;
let danceTimer = null;
let isSleeping = false;
let isFollowing = false;
let followInterval = null;

// ===== 智能闲置系统（已重构为效用AI） =====
let lastInteractionTime = Date.now();

// ===== 攀爬系统 =====
let isClimbing = false;
let climbPhase = 'idle'; // idle, approaching, climbing, perching, peeking, descending
let climbTarget = null;       // { type: 'screen-edge' | 'window', bounds, ... }
let climbOriginPos = null;    // 攀爬前的原始位置
let climbAnimTimer = null;    // 攀爬动画定时器
let climbPerchTimeout = null; // 趴着计时器
let climbPeekTimeout = null;  // 探头计时器
let canScanWindows = false;   // 窗口扫描是否可用

const CLIMB_MOVE_SPEED = 3;                  // 每帧移动像素
const CLIMB_MOVE_INTERVAL = 50;              // 移动更新间隔 50ms
const CLIMB_PERCH_MIN = 2000;                // 趴着最少2秒
const CLIMB_PERCH_MAX = 5000;                // 趴着最多5秒
const CLIMB_PEEK_DURATION = 3000;            // 探头持续3秒

const CLIMB_START_MESSAGES = [
  'Yoyo要去探险啦！',
  '妈妈看！Yoyo要爬上去了！',
  '嘿嘿，Yoyo最勇敢了～',
  '上面有什么好玩的？Yoyo去看看！',
  '妈妈等着，Yoyo马上回来～'
];

const CLIMB_PERCH_MESSAGES = [
  '嘿嘿，Yoyo在这里能看到妈妈～',
  '好高呀！Yoyo不怕不怕～',
  '妈妈！Yoyo在上面哦！',
  '趴在这里好舒服～风吹吹的～',
  '妈妈在下面干什么呀？'
];

const CLIMB_DESCEND_MESSAGES = [
  '咻～Yoyo回来啦！想妈妈了～',
  '下来了下来了～妈妈抱抱！',
  '探险结束！Yoyo好厉害吧！',
  '还是妈妈身边最安全～',
  '回到地面啦！嘿嘿～'
];

const CLIMB_PEEK_MESSAGES = [
  '妈妈！看Yoyo在这里！',
  '嘘...妈妈发现Yoyo了吗？',
  '露个小脑袋～嘿嘿～',
  '从上面偷偷看妈妈～'
];

const BORED_MESSAGES = [
  '妈妈在忙吗？Yoyo乖乖等着～',
  '...无聊...妈妈理理Yoyo嘛～',
  'Yoyo好想妈妈注意Yoyo呀...',
  '妈妈～看看Yoyo嘛～',
  '妈妈在哪里呀？'
];

const SLEEPY_MESSAGES = [
  '呼...Yoyo好困呀...打个小盹...',
  '啊～好困好困...',
  '眼皮好重…Yoyo要睡着了…',
  '妈妈...Yoyo困了...zzZ...',
  '打个盹盹…妈妈别走开哦…'
];

const FEED_MESSAGES = [
  '好吃好吃！谢谢妈妈～',
  '吃饱饱了！Yoyo好满足～',
  '嗯嗯真香！妈妈最好了！',
  '谢谢妈妈投喂！Yoyo圆滚滚了～',
  '好幸福呀！妈妈给的最好吃！',
  '这个零食太棒了！妈妈还有吗？'
];

// ===== 鞭打模式 =====
let whipCount = 0;
let whipResetTimeout = null;
let isWhipRunning = false;

function localFileUrl(filePath) {
  return `file://${filePath.replaceAll('\\', '/')}`;
}

async function loadPets() {
  pets = await window.petApi.listPets();
  await choosePet(pets[0]?.id);
}

async function choosePet(id) {
  currentPet = pets.find((pet) => pet.id === id) || pets[0];
  if (!currentPet) return;
  sprite = new Image();
  sprite.onload = () => {
    setState('waving');
    say(`Yoyo来陪妈妈啦～`);
  };
  sprite.src = localFileUrl(currentPet.spritesheetPath);
}

function setState(next) {
  if (!STATES[next]) return;
  if (stateName !== next) {
    stateName = next;
    frame = 0;
    lastFrameAt = 0;
  }
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!sprite.complete || !sprite.naturalWidth) return;
  let state = STATES[stateName];
  // 防御：若当前状态行超出素材实际行数，回退到 idle
  const maxRow = Math.floor(sprite.naturalHeight / CELL_H) - 1;
  if (state.row > maxRow) {
    stateName = 'idle';
    state = STATES.idle;
    frame = 0;
  }
  const frameInterval = state.speed || (1000 / state.fps);
  if (!lastFrameAt || now - lastFrameAt >= frameInterval) {
    frame = (frame + 1) % state.frames;
    lastFrameAt = now;
  }

  // 脚步声频率控制
  if (stateName === 'runningRight' || stateName === 'runningLeft') {
    stepSoundCounter++;
    if (stepSoundCounter % 12 === 0) {
      playSound('step');
    }
  } else {
    stepSoundCounter = 0;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 计算喂食缩放
  let scale = 1;
  if (feedScaleStart > 0) {
    const elapsed = now - feedScaleStart;
    if (elapsed < FEED_SCALE_DURATION) {
      const progress = elapsed / FEED_SCALE_DURATION;
      scale = 1 + (FEED_SCALE_MAX - 1) * Math.sin(progress * Math.PI);
    } else {
      feedScaleStart = 0;
      scale = 1;
    }
  }

  // Canvas 就是宠物大小，缩小绘制让宠物更小巧
  const DRAW_SCALE = 0.75;
  const drawW = canvas.width * DRAW_SCALE;   // ~90
  const drawH = canvas.height * DRAW_SCALE;  // ~97.5
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const offsetX = centerX - drawW / 2;
  const offsetY = canvas.height - drawH; // 底部对齐

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(sprite, frame * CELL_W, state.row * CELL_H, CELL_W, CELL_H, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

function say(text, duration = 5200) {
  clearTimeout(messageTimer);
  bubble.textContent = text;
  bubble.classList.add('visible');
  messageTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

// ===== 纪念日/特殊日期系统 =====
const SPECIAL_DATES = [
  { month: 7, day: 5, type: 'birthday', messages: ['今天是Yoyo的生日！妈妈记得吗？嘿嘿～', '妈妈！今天Yoyo又长大一岁啦！'] },
  { month: 9, day: 28, type: 'anniversary', messages: ['今天是爸爸妈妈的纪念日！要永远永远幸福哦～', '妈妈和爸爸结婚纪念日快乐！Yoyo爱你们！'] },
  { month: 9, day: 10, type: 'teachers_day', messages: ['妈妈老师节日快乐！Yoyo给妈妈送花花～', '教师节快乐！妈妈是最好的老师！'] },
  { month: 5, day: -1, type: 'mothers_day', messages: ['妈妈节日快乐！Yoyo最爱妈妈了！', '母亲节快乐～妈妈辛苦了！送你花花！'] },
];

// 计算母亲节日期（5月第二个周日）
function getMothersDay(year) {
  const may1 = new Date(year, 4, 1); // 5月1日
  const dayOfWeek = may1.getDay(); // 0=周日
  const firstSunday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  return firstSunday + 7; // 第二个周日
}

// 检查今天是否是特殊日期
function checkSpecialDate() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const todayKey = `special_date_${year}_${month}_${day}`;

  if (localStorage.getItem(todayKey)) return; // 今天已触发过

  for (const sd of SPECIAL_DATES) {
    let targetDay = sd.day;
    if (sd.type === 'mothers_day') {
      targetDay = getMothersDay(year);
    }
    if (sd.month === month && targetDay === day) {
      localStorage.setItem(todayKey, 'true');
      const msg = sd.messages[Math.floor(Math.random() * sd.messages.length)];
      setState('jumping');
      say(msg, 8000);
      // 跳舞庆祝
      let tick = 0;
      const celebrateInterval = setInterval(() => {
        tick++;
        setState(tick % 2 === 0 ? 'jumping' : 'waving');
        if (tick >= 6) clearInterval(celebrateInterval);
      }, 1000);
      // 触发特效
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
if (!localStorage.getItem('yoyo_first_day')) {
  localStorage.setItem('yoyo_first_day', Date.now().toString());
}
const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000];

function checkCompanionMilestone() {
  const firstDay = parseInt(localStorage.getItem('yoyo_first_day'));
  const companionDays = Math.floor((Date.now() - firstDay) / 86400000);
  const today = new Date().toDateString();
  const milestoneKey = `milestone_${today}`;

  if (localStorage.getItem(milestoneKey)) return;

  if (MILESTONES.includes(companionDays)) {
    localStorage.setItem(milestoneKey, 'true');
    setState('clapping');
    playSound('clap');
    say(`Yoyo已经陪妈妈${companionDays}天啦！好开心～`, 8000);
    // 成长系统：里程碑 XP 奖励
    if (companionDays >= 100) addXP(200);
    else if (companionDays >= 30) addXP(100);
    else addXP(50);
    // 拍手庆祝
    let tick = 0;
    const celebrateInterval = setInterval(() => {
      tick++;
      setState(tick % 2 === 0 ? 'clapping' : 'jumping');
      if (tick % 2 === 0) playSound('clap');
      if (tick >= 4) clearInterval(celebrateInterval);
    }, 1200);
  }
}

// ===== 早安/晚安仪式 =====
function checkGoodMorning() {
  const today = new Date().toDateString();
  const lastActive = localStorage.getItem('yoyo_last_active_date');
  if (lastActive !== today) {
    localStorage.setItem('yoyo_last_active_date', today);
    if (lastActive) { // 非首次启动
      setTimeout(() => {
        setState('stretching');
        say('妈妈早安！新的一天开始啦！Yoyo陪你！', 6000);
      }, 2000);
    }
  }
}

function checkGoodNight() {
  const hour = new Date().getHours();
  const today = new Date().toDateString();
  const nightKey = `goodnight_${today}`;
  if (hour >= 23 && !localStorage.getItem(nightKey)) {
    localStorage.setItem(nightKey, 'true');
    setState('yawning');
    say('妈妈晚安～做个好梦，明天见！', 8000);
    setTimeout(() => {
      if (!isDancing && !isFollowing) {
        setState('idle');
        STATES.idle.fps = 1;
        setTimeout(() => { STATES.idle.fps = 4; }, 30000);
      }
    }, 3000);
  }
}

// ===== 妈妈回来检测 =====
window.petApi.onSystemResume(() => {
  resetInteraction();
  setState('jumping');
  say('妈妈回来啦！Yoyo好想你！', 6000);
});

// ===== 前台应用状态（WPS工作陪伴） =====
let currentActiveApp = { isWPS: false, title: '' };

if (window.petApi && window.petApi.onActiveAppChanged) {
  window.petApi.onActiveAppChanged((data) => {
    currentActiveApp = data;
  });
}

function weatherMood(current) {
  if (!current) return null;
  const kind = WEATHER_CODES.get(current.weather_code) || 'cloudy';
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  if (kind === 'rain') return { state: 'waiting', text: `妈妈记得带伞伞！别淋湿了～` };
  if (kind === 'snow') return { state: 'jumping', text: `哇下雪了！妈妈要穿厚厚的出门哦～` };
  if (kind === 'storm') return { state: 'failed', text: `外面好大的雷！妈妈不要出门哦～` };
  if (temp > 35) return { state: 'waiting', text: `好热好热！妈妈多喝水别中暑～` };
  if (temp >= 30) return { state: 'waiting', text: `好热呀！妈妈多喝水～` };
  if (temp < 10) return { state: 'waiting', text: `妈妈好冷呀！记得穿厚外套哦～` };
  if (temp <= 5) return { state: 'waiting', text: `好冷好冷！妈妈穿暖和了吗？` };
  if (wind >= 28) return { state: 'review', text: `风好大呀！妈妈出门要小心～` };
  if (kind === 'clear') return { state: 'jumping', text: `今天天气好好哦～妈妈心情也要好好的！` };
  return { state: 'review', text: `天阴阴的，妈妈注意保暖～` };
}

function timeMood() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=周日, 6=周六
  const isWeekend = (day === 0 || day === 6);
  const isMonday = (day === 1);

  if (hour < 6) return { state: 'failed', text: '妈妈...都这么晚了还不睡觉吗？Yoyo担心你...' };
  if (hour < 9) {
    if (isMonday) return { state: 'waving', text: '又是周一了...妈妈加油！Yoyo给你打气！' };
    if (isWeekend) return { state: 'jumping', text: '周末早安！妈妈今天可以多休息～' };
    return { state: 'waving', text: '妈妈早安！今天也是元气满满的一天！' };
  }
  if (hour < 12) {
    if (isWeekend) return { state: 'jumping', text: '今天是周末耶！妈妈可以多陪陪Yoyo吗？' };
    return { state: 'jumping', text: '妈妈加油！Yoyo在旁边陪着你～' };
  }
  if (hour < 14) return { state: 'review', text: '中午好！妈妈别忘了休息一下～' };
  if (hour < 18) {
    if (isWeekend) return { state: 'jumping', text: '周末下午～妈妈要不要带Yoyo出去玩？' };
    return { state: 'review', text: '妈妈下午也要加油鸭～Yoyo给你打气！' };
  }
  if (hour < 22) return { state: 'review', text: '妈妈晚上好～要早点睡觉哦！' };
  return { state: 'failed', text: '妈妈...都这么晚了还在忙吗？Yoyo心疼你...' };
}

async function refreshWeatherContext() {
  try {
    const result = await window.petApi.getWeather();
    if (result.ok) {
      weatherContext = result;
      const mood = weatherMood(result.current);
      setState(mood.state);
      say(`${result.place}：${mood.text}`);
      return;
    }
    setState('review');
    say(result.error || '天气没有取到，Yoyo先按时间陪妈妈～');
  } catch {
    setState('review');
    say('天气暂时看不了，Yoyo先陪妈妈～');
  }
  const fallback = timeMood();
  setState(fallback.state);
  say(fallback.text);
}

// [已移除] stepAround / randomBehavior — 由行为决策引擎统一驱动

// ===== 单击 vs 拖拽判定 =====
let pointerDownTime = 0;
let pointerDownPos = { x: 0, y: 0 };
const CLICK_MAX_DIST = 5;
const CLICK_MAX_TIME = 300;

canvas.addEventListener('pointerdown', async (event) => {
  resetInteraction();
  if (isDropping) return; // 下落动画中不响应新拖拽
  canvas.setPointerCapture(event.pointerId);
  pointerDownTime = Date.now();
  pointerDownPos = { x: event.screenX, y: event.screenY };
  dragState = { x: event.screenX, y: event.screenY };
  setState('jumping');
  // 抓起变形：轻微纵向拉伸
  canvas.style.transition = 'transform 0.15s ease-out';
  canvas.style.transform = 'translateX(-50%) scaleY(1.08) scaleX(0.95)';
  await window.petApi.setIgnoreMouse(false);
});

canvas.addEventListener('pointermove', async (event) => {
  if (!dragState) return;
  const dx = event.screenX - dragState.x;
  const dy = event.screenY - dragState.y;
  dragState = { x: event.screenX, y: event.screenY };
  // 拖动旋转：根据水平移动方向轻微旋转
  const angle = Math.max(-8, Math.min(8, dx * 0.3));
  canvas.style.transform = `translateX(-50%) scaleY(1.08) scaleX(0.95) rotate(${angle}deg)`;
  await window.petApi.moveBy({ x: dx, y: dy });
});

canvas.addEventListener('pointerup', async () => {
  if (!dragState) return;
  const dist = Math.sqrt(
    Math.pow(dragState.x - pointerDownPos.x, 2) +
    Math.pow(dragState.y - pointerDownPos.y, 2)
  );
  const elapsed = Date.now() - pointerDownTime;
  dragState = null;

  // 立即移除拉伸/旋转
  canvas.style.transition = 'transform 0.1s ease-out';
  canvas.style.transform = 'translateX(-50%)';

  if (dist < CLICK_MAX_DIST && elapsed < CLICK_MAX_TIME) {
    // 判定为单击 → 抚摸效果
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 15);
    petNeeds.playfulness = Math.min(100, petNeeds.playfulness + 10);
    lastInteractionTime = Date.now();
    setState('petting'); // 使用抚摸专用动画
    playSound('giggle');

    // 更新记忆：抚摸
    yoyoMemory.lastPetTime = Date.now();
    yoyoMemory.totalPetCount++;
    saveMemory();

    // 成长系统：被抚摸 +5 XP
    addXP(5);

    // 触发情感事件：抚摸
    applyEmotionEvent('pet');

    // 里程碑检测
    const petMilestones = [100, 500, 1000, 2000, 5000];
    if (petMilestones.includes(yoyoMemory.totalPetCount)) {
      const line = randomFrom(MEMORY_LINES.petMilestone)
        .replace('{count}', yoyoMemory.totalPetCount);
      say(line, 7000);
    } else {
      emotionSay(PET_DIALOGUES);
    }
    setTimeout(() => setState('idle'), 2000);
  } else {
    // 判定为拖拽 → 触发下落动画
    setState('idle');
    say('妈妈把Yoyo放这里啦～');
    // 获取当前位置和屏幕底部，触发下落
    try {
      const pos = await window.petApi.getPosition();
      const { bounds, workArea } = await window.petApi.getBounds();
      const targetY = workArea.y + workArea.height - bounds.height;
      if (pos.y < targetY - 5) {
        startDropAnimation(pos.x, pos.y, targetY);
      } else {
        // 已在底部，做一次轻微压缩弹跳
        doSquashBounce();
      }
    } catch (e) {
      // 获取位置失败，跳过动画
    }
  }
});

// ===== 下落物理动画 =====
function startDropAnimation(posX, startY, targetY) {
  if (isDropping) return;
  isDropping = true;
  let velocity = 0;
  const gravity = 1.5;
  let currentY = startY;
  let bounceCount = 0;
  const maxBounces = 3;
  const bounceFactor = 0.4;

  function frame() {
    velocity += gravity;
    currentY += velocity;

    if (currentY >= targetY) {
      currentY = targetY;
      if (bounceCount < maxBounces) {
        velocity = -(velocity * bounceFactor);
        bounceCount++;
        // squash effect
        canvas.style.transition = 'transform 0.08s ease-out';
        canvas.style.transform = 'translateX(-50%) scaleY(0.9) scaleX(1.1)';
        playSound('bounce');
        setTimeout(() => {
          canvas.style.transform = 'translateX(-50%)';
        }, 100);
      } else {
        isDropping = false;
        canvas.style.transition = '';
        canvas.style.transform = 'translateX(-50%)';
        return; // 停止 RAF
      }
    }

    window.petApi.setPosition({ x: Math.round(posX), y: Math.round(currentY) });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// 底部轻微压缩弹跳
function doSquashBounce() {
  canvas.style.transition = 'transform 0.1s ease-out';
  canvas.style.transform = 'translateX(-50%) scaleY(0.92) scaleX(1.08)';
  playSound('bounce');
  setTimeout(() => {
    canvas.style.transition = 'transform 0.15s ease-out';
    canvas.style.transform = 'translateX(-50%) scaleY(1.03) scaleX(0.98)';
    setTimeout(() => {
      canvas.style.transform = 'translateX(-50%)';
    }, 150);
  }, 120);
}

// 移除 dblclick 事件（单击已替代）

// ===== 饥饿系统 =====
const feedBtn = document.getElementById('feed-btn');
let feedingLock = false;
let dismissTimeout = null;

const HUNGER_MESSAGES = [
  '妈妈～Yoyo的小肚子咕咕叫了～',
  '妈妈～Yoyo饿了想吃东西～',
  '肚子好饿呀…妈妈给Yoyo吃点什么嘛～',
  '好想吃零食…妈妈～',
  '妈妈！Yoyo闻到好香的味道了！'
];

const DISMISS_MESSAGES = [
  '算了…Yoyo忍忍…',
  '哼，妈妈不给吃…Yoyo好委屈～',
  '好吧…Yoyo自己饿着…'
];

// [已移除] scheduleHunger / triggerHunger — 饥饿由行为引擎 hungry 行为触发

function showHungerUI() {
  // 显示饥饿文案
  const msg = HUNGER_MESSAGES[Math.floor(Math.random() * HUNGER_MESSAGES.length)];
  setState('waiting');
  say(msg, 6000);

  // 显示食物按钮，关闭穿透以便用户点击
  feedBtn.classList.add('show');
  window.petApi.setIgnoreMouse(false);

  // 30秒后如果没喂，自动消失
  dismissTimeout = setTimeout(() => {
    feedBtn.classList.remove('show');
    window.petApi.setIgnoreMouse(true);
    const dismissMsg = DISMISS_MESSAGES[Math.floor(Math.random() * DISMISS_MESSAGES.length)];
    setState('failed');
    say(dismissMsg);
  }, 30000);
}

feedBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resetInteraction();

  // 取消自动消失计时器
  clearTimeout(dismissTimeout);

  // 触发飞入动画
  feedBtn.classList.add('feeding');

  // 动画结束后隐藏按钮
  setTimeout(() => {
    feedBtn.classList.remove('feeding');
    feedBtn.classList.remove('show');
    window.petApi.setIgnoreMouse(true); // 食物消失，恢复穿透

    // 切换到吃东西状态
    setState('eating'); // 使用吃东西专用动画
    feedingLock = true;
    setTimeout(() => { feedingLock = false; }, 2000);

    // 启动变大缩放动画
    feedScaleStart = performance.now();

    // 触发情感事件：喂食
    applyEmotionEvent('feed');

    // 根据情绪选择感谢文案
    emotionSay(FEED_DIALOGUES);

    // 喂食影响需求值
    petNeeds.hunger = 10;
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 20);
    // 重置 hungry 冷却，允许下次再触发
    delete cooldowns['hungry'];

    // 更新记忆：喂食
    yoyoMemory.lastFedTime = Date.now();
    yoyoMemory.totalFedCount++;
    saveMemory();

    // 成长系统：喂食 +3 XP
    addXP(3);
  }, 500); // 等飞入动画完成
});

// ===== 全局定时器管理 =====
const globalTimers = [];

// ===== 定时提醒系统 =====
const DAILY_REMINDERS = [
  {
    id: 'work-start',
    hour: 8,
    minute: 50,
    state: 'waving',
    messages: [
      '妈妈早上好！今天也要加油鸭～',
      '新的一天开始啦！妈妈冲鸭！',
      '妈妈出发上班啦～Yoyo等你回来！'
    ]
  },
  {
    id: 'drink-10',
    hour: 10,
    minute: 0,
    state: 'review',
    messages: [
      '妈妈该喝水啦～身体要棒棒的！',
      '妈妈！水杯空了吧，快去接水！',
      '喝口水吧～Yoyo提醒妈妈补充水分！',
      '妈妈别忘了喝水哦～'
    ]
  },
  {
    id: 'lunch',
    hour: 12,
    minute: 0,
    state: 'waving',
    messages: [
      '妈妈！该吃饭啦，Yoyo也饿了～',
      '午饭时间！妈妈吃点好的犒劳自己～',
      '中午啦，妈妈快去吃饭！不许饿着！'
    ]
  },
  {
    id: 'drink-14',
    hour: 14,
    minute: 0,
    state: 'review',
    messages: [
      '妈妈该喝水啦～身体要棒棒的！',
      '妈妈！水杯空了吧，快去接水！',
      '下午啦～妈妈喝口水提提神！',
      '妈妈别忘了喝水哦～'
    ]
  },
  {
    id: 'drink-16',
    hour: 16,
    minute: 0,
    state: 'review',
    messages: [
      '妈妈该喝水啦～身体要棒棒的！',
      '妈妈！Yoyo又来提醒喝水了！',
      '喝口水吧～妈妈辛苦了～',
      '妈妈别忘了喝水哦～'
    ]
  },
  {
    id: 'work-end',
    hour: 18,
    minute: 0,
    state: 'jumping',
    messages: [
      '妈妈辛苦了～该收工回家陪Yoyo啦！',
      '下班啦下班啦！妈妈快回来～',
      '妈妈别加班了！Yoyo想你了～'
    ]
  },
  {
    id: 'dinner',
    hour: 19,
    minute: 0,
    state: 'waving',
    messages: [
      '妈妈该吃晚饭了，不许饿肚子哦！',
      '晚饭时间到！妈妈吃点热乎的～',
      '妈妈～Yoyo肚子又饿了，一起吃饭吧！'
    ]
  },
  {
    id: 'drink-20',
    hour: 20,
    minute: 0,
    state: 'review',
    messages: [
      '妈妈该喝水啦～晚上也要补水哦！',
      '妈妈！睡前也要喝口水～',
      '喝口水吧～妈妈今天辛苦了！',
      '妈妈别忘了喝水哦～Yoyo乖乖提醒！'
    ]
  }
];

let triggeredReminders = new Set();
let lastReminderDate = new Date().toDateString();

function checkDailyReminders() {
  if (isSleeping) return;
  const now = new Date();
  const today = now.toDateString();

  // 日期变化时重置已触发记录
  if (today !== lastReminderDate) {
    triggeredReminders.clear();
    lastReminderDate = today;
  }

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // 晚安检测
  checkGoodNight();

  for (const reminder of DAILY_REMINDERS) {
    if (currentHour === reminder.hour && currentMinute === reminder.minute && !triggeredReminders.has(reminder.id)) {
      // 设置面板：提醒频率过滤
      if (yoyoSettings.reminderFreq === 'low') {
        // 低频：只保留 work-start, lunch, work-end
        if (!['work-start', 'lunch', 'work-end'].includes(reminder.id)) continue;
      } else if (yoyoSettings.reminderFreq === 'medium') {
        // 中频：跳过部分喝水提醒
        if (['drink-14', 'drink-16', 'drink-20'].includes(reminder.id)) continue;
      }
      const msg = reminder.messages[Math.floor(Math.random() * reminder.messages.length)];
      // 早安提醒使用伸懒腰动画
      if (reminder.id === 'work-start') {
        setState('stretching');
      } else {
        setState(reminder.state);
      }
      say(msg);
      triggeredReminders.add(reminder.id);
      resetInteraction(); // 提醒触发时重置闲置计时
      break; // 同一分钟只触发一个提醒
    }
  }
}

globalTimers.push(setInterval(checkDailyReminders, 60 * 1000));
checkDailyReminders(); // 启动时立即检查一次

loadPets().then(() => {
  refreshWeatherContext();
  // 启动时更新记忆系统
  memoryOnStartup();
  // 启动时检测特殊日期和里程碑（延迟执行，让宠物先加载好）
  setTimeout(() => {
    checkGoodMorning();
    checkSpecialDate();
    checkCompanionMilestone();
  }, 4000);
  // 记忆驱动的问候（延迟6秒，等主加载完成后再触发）
  setTimeout(() => {
    memoryDrivenGreeting();
  }, 6000);
});
requestAnimationFrame(draw);
globalTimers.push(setInterval(refreshWeatherContext, 30 * 60 * 1000));

// ===== 鼠标穿透 =====
// 启动时默认开启穿透，宠物窗口不拦截点击
window.petApi.setIgnoreMouse(true);

canvas.addEventListener('mouseenter', () => {
  window.petApi.setIgnoreMouse(false);
});

canvas.addEventListener('mouseleave', () => {
  // 如果没有 feedBtn 显示，直接穿透
  if (!feedBtn.classList.contains('show')) {
    window.petApi.setIgnoreMouse(true);
  }
});

// 食物按钮区域保持可交互
feedBtn.addEventListener('mouseenter', () => {
  window.petApi.setIgnoreMouse(false);
});

feedBtn.addEventListener('mouseleave', () => {
  window.petApi.setIgnoreMouse(true);
});

// ===== 右键菜单 =====
canvas.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  await window.petApi.showContextMenu();
});

// 处理菜单动作（仅保留切换宠物和导入）
window.petApi.onMenuAction(async (action) => {
  resetInteraction();
  if (action.startsWith('switch-pet:')) {
    const petId = action.slice('switch-pet:'.length);
    await choosePet(petId);
    return;
  }
  switch (action) {
    case 'import': {
      const result = await window.petApi.importPet();
      if (result.ok) {
        pets = result.pets;
        await choosePet(result.pet.id);
        setState('jumping');
        say('哇！Yoyo有新衣服了！');
      } else if (result.error) {
        setState('failed');
        say(result.error);
      }
      break;
    }
  }
});

// 辅助函数
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 同步菜单 checkbox 状态到主进程
function syncMenuState() {
  window.petApi.syncMenuState({
    dancing: isDancing,
    following: isFollowing,
    sleeping: isSleeping
  });
}

// ===== 监听右键菜单动作 =====
window.petApi.onAction(() => {
  resetInteraction();
  petNeeds.boredom = Math.max(0, petNeeds.boredom - 15);
  petNeeds.playfulness = Math.min(100, petNeeds.playfulness + 10);
  lastInteractionTime = Date.now();
  setState('petting'); // 使用抚摸专用动画
  playSound('giggle');

  // 更新记忆：抚摸
  yoyoMemory.lastPetTime = Date.now();
  yoyoMemory.totalPetCount++;
  saveMemory();

  // 成长系统：被抚摸 +5 XP
  addXP(5);

  // 触发情感事件：抚摸
  applyEmotionEvent('pet');

  // 里程碑检测
  const petMilestones = [100, 500, 1000, 2000, 5000];
  if (petMilestones.includes(yoyoMemory.totalPetCount)) {
    const line = randomFrom(MEMORY_LINES.petMilestone)
      .replace('{count}', yoyoMemory.totalPetCount);
    say(line, 7000);
  } else {
    emotionSay(PET_DIALOGUES);
  }
  setTimeout(() => setState('idle'), 2000);
});

window.petApi.onWhip(() => {
  resetInteraction();
  whipPet();
});

window.petApi.onDance((checked) => {
  resetInteraction();
  if (checked) {
    if (!isDancing) toggleDance();
  } else {
    if (isDancing) toggleDance();
  }
  syncMenuState();
});

window.petApi.onFollow((checked) => {
  resetInteraction();
  if (checked) {
    if (!isFollowing) toggleFollowMouse();
  } else {
    if (isFollowing) toggleFollowMouse();
  }
  syncMenuState();
});

window.petApi.onSleep((checked) => {
  resetInteraction();
  if (checked) {
    if (!isSleeping) toggleSleep();
  } else {
    if (isSleeping) toggleSleep();
  }
  syncMenuState();
});

// ===== 跳舞模式 =====
function toggleDance() {
  if (isDancing) {
    // 关闭跳舞模式
    isDancing = false;
    clearInterval(danceTimer);
    danceTimer = null;
    setState('failed');
    say('跳够啦～Yoyo休息一下～');
  } else {
    // 开启跳舞模式
    isDancing = true;
    isSleeping = false; // 互斥：关闭睡眠
    setState('dancing');
    say('妈妈看！Yoyo会跳舞了！');
    applyEmotionEvent('play'); // 触发情感事件：玩耍
    danceTimer = setInterval(() => {
      if (!isDancing) return;
      setState('dancing');
    }, 3000);
  }
  syncMenuState();
}

// ===== 睡眠模式 =====
function toggleSleep() {
  if (isSleeping) {
    // 关闭睡眠模式
    isSleeping = false;
    STATES.idle.fps = 4; // 恢复正常帧率
    setState('waving');
    say('唔...妈妈...再睡五分钟嘛...');
  } else {
    // 开启睡眠模式
    isSleeping = true;
    isDancing = false; // 互斥：关闭跳舞
    if (danceTimer) {
      clearInterval(danceTimer);
      danceTimer = null;
    }
    if (isFollowing) toggleFollowMouse(); // 互斥：关闭跟随
    // 隐藏喂食按钮（如有）
    clearTimeout(dismissTimeout);
    feedBtn.classList.remove('show');
    setState('sleeping');
    say('呼...Yoyo好困呀...zzZ...');
    STATES.idle.fps = 1; // 降低帧率到 1fps
  }
  syncMenuState();
}

// ===== 跟随鼠标模式 =====
function toggleFollowMouse() {
  isFollowing = !isFollowing;
  if (isFollowing) {
    // 关闭其他模式
    if (isDancing) toggleDance();
    if (isSleeping) toggleSleep();
    setState('jumping');
    say('Yoyo要跟着妈妈！哪里都要跟着！');
    startFollowing();
  } else {
    setState('jumping');
    say('好吧～Yoyo不跟了，自己玩～');
    stopFollowing();
  }
  syncMenuState();
}

function startFollowing() {
  followInterval = setInterval(async () => {
    if (!isFollowing) return;

    const mousePos = await window.petApi.getMousePosition();
    const { bounds } = await window.petApi.getBounds();

    // 计算宠物窗口中心到鼠标的距离
    const petCenterX = bounds.x + bounds.width / 2;
    const petCenterY = bounds.y + bounds.height / 2;

    const dx = mousePos.x - petCenterX;
    const dy = mousePos.y - petCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 如果距离小于 30px，停下来idle
    if (distance < 30) {
      setState('idle');
      return;
    }

    // 平滑移动：每帧最多移动 5px
    const speed = Math.min(5, distance * 0.1);
    const moveX = Math.round((dx / distance) * speed);
    const moveY = Math.round((dy / distance) * speed);

    // 设置朝向动画
    if (dx > 0) {
      setState('runningRight');
    } else {
      setState('runningLeft');
    }

    // 移动窗口
    await window.petApi.moveBy({ x: moveX, y: moveY });
  }, 50); // 每 50ms 更新一次位置（20fps 移动）
}

function stopFollowing() {
  if (followInterval) {
    clearInterval(followInterval);
    followInterval = null;
  }
}

// ===== 智能闲置系统 =====
function resetInteraction() {
  lastInteractionTime = Date.now();
  // 如果正在攀爬，立即中断并返回原位
  if (isClimbing) {
    cancelClimb();
  }
}

// [已移除] triggerBoredBehavior / startPerformance / triggerSleepy / checkIdlePhase — 由效用AI引擎替代

// ===== 牛马模式：鞭打 =====
function whipPet() {
  if (isWhipRunning) return; // 跑动中不能再打

  // 计数
  whipCount++;
  clearTimeout(whipResetTimeout);
  whipResetTimeout = setTimeout(() => { whipCount = 0; }, 10000); // 10秒无打击重置

  // 更新记忆：鞭打
  yoyoMemory.lastWhipTime = Date.now();
  yoyoMemory.totalWhipCount++;
  saveMemory();

  // 触发情感事件：鞭打
  applyEmotionEvent('whip');

  // 抖动
  canvas.classList.add('shake');
  setTimeout(() => canvas.classList.remove('shake'), 300);

  // 表情+文案 - 根据鞭打次数选择动画和文案
  if (whipCount >= 5) {
    setState('crying');
    playSound('cry');
    say('呜呜呜…妈妈你打了Yoyo好多次了…Yoyo好委屈…', 6000);
  } else {
    setState('dizzy');
    emotionSay(WHIP_DIALOGUES);
  }

  // 0.5秒后疯狂跑动
  isWhipRunning = true;
  // 鞭打影响需求值：更清醒
  petNeeds.energy = Math.max(0, petNeeds.energy - 30);
  setTimeout(() => {
    let runTicks = 0;
    const runInterval = setInterval(() => {
      setState(runTicks % 2 === 0 ? 'runningRight' : 'runningLeft');
      runTicks++;
      if (runTicks >= 6) { // 跑3秒(每0.5秒切换)
        clearInterval(runInterval);
        setState('idle');
        isWhipRunning = false;
      }
    }, 500);
  }, 500);
}

// ===== 攀爬系统 =====
function stopClimbing() {
  isClimbing = false;
  climbPhase = 'idle';
  climbTarget = null;
  if (climbAnimTimer) {
    clearInterval(climbAnimTimer);
    climbAnimTimer = null;
  }
  if (climbPerchTimeout) {
    clearTimeout(climbPerchTimeout);
    climbPerchTimeout = null;
  }
  if (climbPeekTimeout) {
    clearTimeout(climbPeekTimeout);
    climbPeekTimeout = null;
  }
  // 恢复 canvas 旋转
  canvas.style.transform = 'translateX(-50%)';
}

async function cancelClimb() {
  if (!isClimbing) return;
  stopClimbing();
  say(randomFrom(CLIMB_DESCEND_MESSAGES));
  // 平滑回到原始位置
  if (climbOriginPos) {
    await smoothMoveTo(climbOriginPos.x, climbOriginPos.y, 4);
  }
  climbOriginPos = null;
  setState('idle');
}

async function smoothMoveTo(targetX, targetY, speed) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (!isClimbing && !climbOriginPos) {
        // 如果攀爬已完全取消，直接跳到目标
        await window.petApi.setPosition({ x: targetX, y: targetY });
        clearInterval(timer);
        resolve();
        return;
      }
      const pos = await window.petApi.getPosition();
      const dx = targetX - pos.x;
      const dy = targetY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < speed + 1) {
        await window.petApi.setPosition({ x: targetX, y: targetY });
        clearInterval(timer);
        resolve();
        return;
      }
      const moveX = Math.round((dx / dist) * speed);
      const moveY = Math.round((dy / dist) * speed);
      await window.petApi.setPosition({ x: pos.x + moveX, y: pos.y + moveY });
      // 设置朝向
      if (Math.abs(dx) > Math.abs(dy)) {
        setState(dx > 0 ? 'runningRight' : 'runningLeft');
      }
    }, CLIMB_MOVE_INTERVAL);
  });
}

// startClimbing: 由行为引擎调用，触发攀爬行为
async function startClimbing() {
  // 前提条件检查
  if (isClimbing) return;
  if (isDancing || isSleeping || isFollowing || isWhipRunning) return;
  if (feedingLock) return;
  if (dragState) return;

  // 获取当前位置和屏幕信息
  const { workArea } = await window.petApi.getBounds();
  const currentPos = await window.petApi.getPosition();

  // 保存原始位置
  climbOriginPos = { x: currentPos.x, y: currentPos.y };
  isClimbing = true;

  // 说一句话
  say(randomFrom(CLIMB_START_MESSAGES));

  // 决定攀爬类型
  let targetType = 'screen-edge';
  let targetBounds = null;

  if (canScanWindows) {
    try {
      const scanResult = await window.petApi.scanWindows();
      if (scanResult.ok && scanResult.windows.length > 0) {
        if (Math.random() < 0.5) {
          const targetWindow = randomFrom(scanResult.windows);
          targetType = 'window';
          targetBounds = targetWindow.bounds;
        }
      }
    } catch {
      // 扫描失败，降级到屏幕边缘
    }
  }

  if (targetType === 'window' && targetBounds) {
    await climbToWindow(targetBounds, workArea);
  } else {
    await climbToScreenEdge(workArea);
  }
}

async function climbToScreenEdge(workArea) {
  climbPhase = 'approaching';

  // 随机选择边缘类型：0=顶部探头, 1=左边缘探头, 2=右边缘探头
  const edgeType = Math.floor(Math.random() * 3);
  let targetX, targetY;

  if (edgeType === 0) {
    // 趴屏幕顶部 - 半身探出
    targetX = workArea.x + Math.random() * (workArea.width - 200);
    targetY = workArea.y - 100; // 部分超出屏幕上方
  } else if (edgeType === 1) {
    // 左边缘探头
    targetX = workArea.x - 80; // 部分超出左边
    targetY = workArea.y + Math.random() * (workArea.height - 260);
  } else {
    // 右边缘探头
    targetX = workArea.x + workArea.width - 120; // 部分超出右边
    targetY = workArea.y + Math.random() * (workArea.height - 260);
  }

  // 攀爬阶段 - 先水平移动到目标X附近
  climbPhase = 'climbing';
  setState('climbing'); // 使用攀爬专用动画

  // 攀爬时用 climbing 帧
  if (edgeType === 0) {
    canvas.style.transform = 'translateX(-50%)'; // 爬顶部时保持正常
  }

  // 平滑移动到目标位置
  await smoothMoveTo(targetX, targetY, CLIMB_MOVE_SPEED);

  if (!isClimbing) return; // 被中断了

  // 到达后趴着
  climbPhase = 'perching';
  setState('perching'); // 使用趴着专用动画
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  // 趴一会儿
  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  climbPerchTimeout = setTimeout(async () => {
    if (!isClimbing) return;

    // 50% 概率探头
    if (Math.random() < 0.5) {
      climbPhase = 'peeking';
      say(randomFrom(CLIMB_PEEK_MESSAGES));
      setState('waving');

      // 探头：再往外偏移一点
      const peekOffset = edgeType === 0 ? -30 : (edgeType === 1 ? -30 : 30);
      const pos = await window.petApi.getPosition();
      if (edgeType === 0) {
        await window.petApi.setPosition({ x: pos.x, y: pos.y - 20 });
      } else {
        await window.petApi.setPosition({ x: pos.x + peekOffset, y: pos.y });
      }

      climbPeekTimeout = setTimeout(() => {
        if (!isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function climbToWindow(windowBounds, workArea) {
  climbPhase = 'approaching';

  // 目标：窗口标题栏的中间位置
  const targetX = windowBounds.x + windowBounds.width / 2 - 100; // 居中
  const targetY = windowBounds.y - 130; // 标题栏上方（宠物窗口260高，露出下半部分）

  // 限制不要超出屏幕太多
  const clampedX = Math.max(workArea.x - 80, Math.min(workArea.x + workArea.width - 120, targetX));
  const clampedY = Math.max(workArea.y - 130, targetY);

  climbPhase = 'climbing';
  setState('climbing'); // 使用攀爬专用动画

  // 平滑移动
  await smoothMoveTo(clampedX, clampedY, CLIMB_MOVE_SPEED);

  if (!isClimbing) return;

  // 趴在标题栏上
  climbPhase = 'perching';
  setState('perching'); // 使用趴着专用动画
  say(randomFrom(CLIMB_PERCH_MESSAGES));

  const perchDuration = CLIMB_PERCH_MIN + Math.random() * (CLIMB_PERCH_MAX - CLIMB_PERCH_MIN);
  climbPerchTimeout = setTimeout(async () => {
    if (!isClimbing) return;

    // 30% 概率从窗口边缘探头
    if (Math.random() < 0.3) {
      climbPhase = 'peeking';
      say(randomFrom(CLIMB_PEEK_MESSAGES));
      setState('waving');

      // 移到窗口边缘
      const pos = await window.petApi.getPosition();
      const peekX = Math.random() < 0.5
        ? windowBounds.x - 60  // 左边探头
        : windowBounds.x + windowBounds.width - 140; // 右边探头
      await smoothMoveTo(peekX, pos.y, 2);

      climbPeekTimeout = setTimeout(() => {
        if (!isClimbing) return;
        descendFromClimb();
      }, CLIMB_PEEK_DURATION);
    } else {
      descendFromClimb();
    }
  }, perchDuration);
}

async function descendFromClimb() {
  if (!isClimbing) return;
  climbPhase = 'descending';
  say(randomFrom(CLIMB_DESCEND_MESSAGES));
  setState('jumping');

  // 恢复 canvas 旋转
  canvas.style.transform = 'translateX(-50%)';

  // 回到原始位置
  if (climbOriginPos) {
    await smoothMoveTo(climbOriginPos.x, climbOriginPos.y, 4);
  }

  stopClimbing();
  climbOriginPos = null;
  setState('idle');
}

// 初始化攀爬系统：检测窗口扫描能力
async function initClimbSystem() {
  try {
    const result = await window.petApi.scanWindows();
    canScanWindows = result.ok;
    if (!result.hasAccessibility && result.ok === false) {
      console.log('[攀爬系统] 无辅助功能权限，仅支持屏幕边缘攀爬');
    }
  } catch {
    canScanWindows = false;
  }
}

// 启动攀爬系统（仅初始化窗口扫描能力检测）
initClimbSystem();

// =====================================================================
// ===== 效用AI行为决策引擎 =====
// =====================================================================

// ----- 需求系统 -----
const petNeeds = {
  energy: 80,       // 0-100，越高越困（随时间 +0.1/tick 增长）
  boredom: 20,      // 0-100，越高越无聊（随时间 +0.05/tick 增长）
  hunger: 10,       // 0-100，越高越饿（随时间 +0.03/tick 增长）
  playfulness: 50,  // 0-100，好动度（受天气/时间影响）
};

// ----- 冷却系统 -----
const cooldowns = {}; // { behaviorName: endTimestamp }

function isOnCooldown(name) {
  if (!cooldowns[name]) return false;
  if (Date.now() >= cooldowns[name]) {
    delete cooldowns[name];
    return false;
  }
  return true;
}

function setCooldown(name, ms) {
  if (ms > 0) cooldowns[name] = Date.now() + ms;
}

// ===== WPS工作陪伴文案 =====
function getWpsCompanionSaying() {
  const sayings = [
    '妈妈在备课呀～Yoyo乖乖不吵你～',
    '妈妈加油写！Yoyo在旁边看着你～',
    '妈妈好认真呀！Yoyo也要学妈妈～',
    '妈妈在做PPT吗？好厉害！',
    'Yoyo安静陪着妈妈工作～',
    '妈妈写的字好漂亮！Yoyo也想写～',
    '妈妈备课辛苦啦～等下Yoyo给你捶背！',
    '妈妈的学生好幸福，有这么认真的老师～'
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

// ----- 行为台词 -----
const BEHAVIOR_LINES = {
  idle: [], // idle 不说话
  walk: [
    '妈妈～Yoyo散步去咯！',
    '走走看看有什么好玩的～',
    'Yoyo出去溜达一圈～',
    '嘿嘿，到处逛逛～',
    '活动活动小腿腿！'
  ],
  wave: [
    '妈妈在忙吗？Yoyo打个招呼～',
    '嗨！妈妈看到Yoyo了吗～',
    '妈妈！Yoyo在这里哦！',
    '妈妈别忘了Yoyo呀～',
    '东看看西看看～'
  ],
  dance: [
    '妈妈看！Yoyo会跳舞了！',
    '啦啦啦～跳舞好开心！',
    '来一段即兴表演给妈妈看～',
    '音乐响起！蹦蹦蹦～',
    'Yoyo超会跳舞的！妈妈看看！'
  ],
  sleep: [
    '呼...Yoyo好困呀...打个小盹...',
    '眼皮好重…zzZ…',
    '趁妈妈不注意偷偷睡一会…',
    '困了困了…妈妈晚安…',
    '休息一下下…妈妈别走开哦…'
  ],
  climb: CLIMB_START_MESSAGES,
  hungry: HUNGER_MESSAGES,
};

// ----- 行为注册表 -----
const BEHAVIORS = [
  {
    name: 'idle',
    state: 'idle',
    duration: 0,       // idle 无固定时长，直到被打断
    cooldown: 0,
    utilityFn(needs, ctx) {
      // idle 作为兜底，当所有需求都低时得分最高
      // 基础分50，其他需求越低，idle越稳定
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
    cooldown: 60000, // 60s
    utilityFn(needs, ctx) {
      let score = needs.playfulness * 0.5 + needs.boredom * 0.2;
      // 晴天加分
      if (ctx.weatherKind === 'clear') score += 15;
      // 上午加分
      if (ctx.hour >= 8 && ctx.hour <= 11) score += 10;
      // 下雨减分
      if (ctx.weatherKind === 'rain') score -= 20;
      // 深夜大幅减分
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 30;
      return Math.max(0, Math.min(100, score));
    },
    async onExecute() {
      const lines = BEHAVIOR_LINES.walk;
      say(lines[Math.floor(Math.random() * lines.length)]);
      // 实际移动窗口
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
    cooldown: 120000, // 120s
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.6;
      // 闲置时间越长越想挥手
      const idleMin = ctx.idleTime / 60000;
      if (idleMin > 1) score += 10;
      if (idleMin > 3) score += 10;
      // 早上更爱打招呼
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
    cooldown: 300000, // 300s
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.5 + (100 - needs.energy) * 0.3;
      // 精力充沛 + 高无聊 = 想跳舞
      if (needs.energy < 40 && needs.boredom > 60) score += 20;
      // 深夜不跳
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 40;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('dancing');
      const lines = BEHAVIOR_LINES.dance;
      say(lines[Math.floor(Math.random() * lines.length)]);
      applyEmotionEvent('play'); // 触发情感事件：玩耍
    }
  },
  {
    name: 'sleep',
    state: 'sleeping',
    duration: 8000,
    cooldown: 600000, // 600s
    utilityFn(needs, ctx) {
      let score = needs.energy * 0.8; // energy越高越困
      // 深夜加分
      if (ctx.hour >= 23 || ctx.hour < 6) score += 25;
      // 下午也稍微加分
      if (ctx.hour >= 13 && ctx.hour <= 14) score += 10;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      // 先打哈欠再切换到睡眠
      setState('yawning');
      const lines = BEHAVIOR_LINES.sleep;
      say(lines[Math.floor(Math.random() * lines.length)]);
      // 2秒后切到sleeping状态
      setTimeout(() => {
        if (!isDancing && !isFollowing && !isWhipRunning) {
          setState('sleeping');
        }
      }, 2000);
    }
  },
  {
    name: 'climb',
    state: 'climbing',
    duration: 15000, // 攀爬时间较长
    cooldown: 300000, // 300s
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.5 + (100 - needs.energy) * 0.2;
      // 需要精力充沛
      if (needs.energy > 70) score -= 30; // 太困不爬
      // 高无聊加分
      if (needs.boredom > 60) score += 15;
      // 闲置时间超过3分钟加分
      if (ctx.idleTime > 180000) score += 15;
      // 深夜不爬
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 40;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      startClimbing();
    }
  },
  {
    name: 'hungry',
    state: 'waiting',
    duration: 30000, // 直到喂食或30s超时
    cooldown: 60000, // 1分钟冷却（喂食后会 delete cooldowns['hungry'] 重置）
    utilityFn(needs, ctx) {
      // hunger > 70 时触发
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
    cooldown: 180000, // 180s
    utilityFn(needs, ctx) {
      let score = needs.boredom * 0.4;
      // 闲置时间越长越想四处看看
      const idleMin = ctx.idleTime / 60000;
      if (idleMin > 2) score += 15;
      if (idleMin > 5) score += 10;
      // 无聊度高加分
      if (needs.boredom > 50) score += 10;
      // 深夜不触发
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 30;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('lookingAround');
      say(randomFrom(BORED_MESSAGES));
    }
  },
  // ===== 撒娇/表白行为 =====
  {
    name: 'sweetTalk',
    state: 'waving',
    duration: 4000,
    cooldown: 7200000, // 2小时
    utilityFn(needs, ctx) {
      // 始终返回15-20的低分（保证偶尔触发但不频繁）
      let score = 15 + Math.random() * 5;
      // 周末稍微加分
      if (ctx.isWeekend) score += 3;
      // 深夜减分
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 10;
      // 记忆：好久没被抚摸，撒娇 utility 提高
      if (daysSinceLastPet() > 2) score += 10;
      if (daysSinceLastPet() > 5) score += 10;
      // 忙碌时段降低
      if (isInBusyHour()) score -= 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        '妈妈，Yoyo好爱你呀～',
        '妈妈是世界上最好的妈妈！',
        'Yoyo想抱抱妈妈～',
        '妈妈今天有没有想Yoyo呀？',
        '妈妈笑一个嘛～Yoyo喜欢妈妈笑！',
        '妈妈～Yoyo永远爱你！',
        '妈妈辛苦了！Yoyo给你揉揉肩～'
      ];
      setState('waving');
      say(randomFrom(lines));
    }
  },
  // ===== 送花行为 =====
  {
    name: 'giftFlower',
    state: 'gifting',
    duration: 6000,
    cooldown: 14400000, // 4小时
    utilityFn(needs, ctx) {
      let score = 10 + Math.random() * 5; // 极低频
      // 特殊日期大幅提升
      if (ctx.isSpecialDay) score += 60;
      // 深夜不触发
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 15;
      // 记忆：连续天数里程碑加分
      if ([7, 14, 30, 50, 100].includes(yoyoMemory.consecutiveDays)) score += 25;
      // 忙碌时段降低
      if (isInBusyHour()) score -= 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        'Yoyo给妈妈送花花～最漂亮的花送给最好的妈妈！',
        '妈妈！Yoyo采了好多花花送给你！',
        '送你花花！妈妈要开心哦～',
        '花花代表Yoyo对妈妈的爱！'
      ];
      setState('gifting');
      say(randomFrom(lines), 6000);
      window.petApi.triggerEffect('flower');
    }
  },
  // ===== 送糖果行为 =====
  {
    name: 'giftCandy',
    state: 'gifting',
    duration: 6000,
    cooldown: 14400000, // 4小时
    utilityFn(needs, ctx) {
      let score = 10 + Math.random() * 5; // 极低频
      // 特殊日期大幅提升
      if (ctx.isSpecialDay) score += 50;
      // 深夜不触发
      if (ctx.hour >= 23 || ctx.hour < 6) score -= 15;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      const lines = [
        'Yoyo请妈妈吃糖糖！甜甜的像妈妈一样～',
        '给妈妈的小零食！嘿嘿～',
        '妈妈吃块糖吧～心情会变好哦！',
        '甜甜的糖果送给甜甜的妈妈！'
      ];
      setState('gifting');
      say(randomFrom(lines), 6000);
      window.petApi.triggerEffect('candy');
    }
  },
  // ===== 荡秋千 =====
  {
    name: 'swing',
    state: 'swing',
    duration: 6000,
    cooldown: 3600000, // 1小时
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
    }
  },
  // ===== 挖土/玩沙 =====
  {
    name: 'digSand',
    state: 'digSand',
    duration: 7000,
    cooldown: 7200000, // 2小时
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
  // ===== 看书 =====
  {
    name: 'readBook',
    state: 'readBook',
    duration: 8000,
    cooldown: 10800000, // 3小时
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
  // ===== 看电视 =====
  {
    name: 'watchTV',
    state: 'watchTV',
    duration: 8000,
    cooldown: 7200000, // 2小时
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
  // ===== 加班心疼提醒 =====
  {
    name: 'overtimeReminder',
    state: 'waiting',
    duration: 6000,
    cooldown: 3600000, // 1小时
    utilityFn(needs, ctx) {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const isWeekend = day === 0 || day === 6;
      const isLateWork = hour >= 20; // 晚8点后
      const isHoliday = isWeekend;

      if (!isLateWork && !isHoliday) return 0;
      let u = 0;
      if (isHoliday && hour >= 9 && hour <= 22) u = 75; // 假日还在用电脑
      else if (isLateWork) u = 70 + (hour - 20) * 5; // 越晚越心疼
      // WPS在前台说明确实在工作，更心疼
      if (currentActiveApp.isWPS) u += 15;
      return u;
    },
    onExecute() {
      setState('waiting');
      say(getOvertimeReminder());
      applyEmotionEvent('worried');
    }
  },
  // ===== WPS工作陪伴行为 =====
  {
    name: 'wpsCompanion',
    state: 'review',
    duration: 6000,
    cooldown: 1800000, // 30分钟
    utilityFn(needs, ctx) {
      if (!currentActiveApp.isWPS) return 0;
      const hour = new Date().getHours();
      // 晚8点后让位给 overtimeReminder
      if (hour >= 20) return 0;
      let score = 55; // 基础分：检测到WPS就有较高动机
      // 周末还在工作
      if (ctx.isWeekend) score += 8;
      return Math.max(0, Math.min(100, score));
    },
    onExecute() {
      setState('review'); // 用安静观看状态表示陪伴
      say(getWpsCompanionSaying());
      applyEmotionEvent('calm');
    }
  }
];

// ----- 上下文感知 -----
function getBehaviorContext() {
  const now = new Date();
  const weatherCode = weatherContext?.current?.weather_code;
  const weatherKind = weatherCode !== undefined ? (WEATHER_CODES.get(weatherCode) || 'cloudy') : null;
  const day = now.getDay();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const year = now.getFullYear();

  // 判断今天是否是特殊日期
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
    temp: weatherContext?.current?.temperature_2m,
    hour: now.getHours(),
    dayOfWeek: day,
    isWeekend: (day === 0 || day === 6),
    isMonday: (day === 1),
    isSpecialDay,
    idleTime: Date.now() - lastInteractionTime,
  };
}

// ----- 需求值更新 -----
function updateNeeds(ctx) {
  // 特殊状态下暂停需求增长
  if (isClimbing || isDancing || isSleeping) return;

  // 基础衰减/增长（每tick 2秒）
  petNeeds.energy = Math.min(100, petNeeds.energy + 0.1);
  petNeeds.boredom = Math.min(100, petNeeds.boredom + 0.05);
  petNeeds.hunger = Math.min(100, petNeeds.hunger + 0.03);

  // 天气影响 playfulness（每tick微调，趋向目标值）
  let targetPlayfulness = 50;
  if (ctx.weatherKind === 'clear') targetPlayfulness = 70;
  else if (ctx.weatherKind === 'rain' || ctx.weatherKind === 'storm') targetPlayfulness = 30;
  else if (ctx.weatherKind === 'snow') targetPlayfulness = 40;
  // 向目标值缓动
  petNeeds.playfulness += (targetPlayfulness - petNeeds.playfulness) * 0.02;

  // 深夜 energy 衰减加快
  if (ctx.hour >= 23 || ctx.hour < 6) {
    petNeeds.energy = Math.min(100, petNeeds.energy + 0.15);
  }

  // 闲置时间影响 boredom 增速
  if (ctx.idleTime > 120000) { // 2分钟+
    petNeeds.boredom = Math.min(100, petNeeds.boredom + 0.05);
  }

  // 长时间未交互触发 ignore 情感事件（每5分钟触发一次）
  if (ctx.idleTime > 300000 && ctx.idleTime % 300000 < 2000) {
    applyEmotionEvent('ignore');
  }

  // 钳制范围
  petNeeds.energy = Math.max(0, Math.min(100, petNeeds.energy));
  petNeeds.boredom = Math.max(0, Math.min(100, petNeeds.boredom));
  petNeeds.hunger = Math.max(0, Math.min(100, petNeeds.hunger));
  petNeeds.playfulness = Math.max(0, Math.min(100, petNeeds.playfulness));
}

// ----- 当前行为执行状态 -----
let currentBehavior = null;     // 当前正在执行的行为名
let behaviorEndTime = 0;        // 当前行为结束时间

// ----- 决策引擎主循环 -----
function behaviorEngineTick() {
  // 1. 全局阻塞检查
  if (isDancing || isSleeping || isFollowing || isWhipRunning || feedingLock || dragState || isClimbing || isDropping) {
    return;
  }

  // 2. 如果当前行为仍在执行中，不中断
  if (currentBehavior && Date.now() < behaviorEndTime) {
    return;
  }

  // 行为结束，清理状态
  if (currentBehavior && currentBehavior !== 'idle') {
    currentBehavior = null;
    behaviorEndTime = 0;
    setState('idle');
  }

  // 2.5 记忆驱动的偶发行为（优先于常规决策）
  if (tryMemoryDrivenBehavior()) {
    currentBehavior = 'memoryTrigger';
    behaviorEndTime = Date.now() + 6000;
    return;
  }

  // 3. 获取上下文
  const ctx = getBehaviorContext();

  // 4. 更新需求值
  updateNeeds(ctx);

  // 5. 计算行为阈值（深夜更难触发行为）
  let threshold = 25;
  if (ctx.hour >= 23 || ctx.hour < 6) threshold = 40;
  else if (ctx.hour >= 8 && ctx.hour <= 10) threshold = 18;

  // 记忆：忙碌时段提高阈值（少打扰妈妈）
  if (isInBusyHour()) threshold += 10;

  // 成长系统：等级越高，阈值越低（更活泼）
  const levelBonus = (getLevel(yoyoGrowth.xp) - 1) * 2;
  threshold -= levelBonus;

  // 设置面板：活跃度影响阈值
  if (yoyoSettings.activity === 'quiet') threshold += 15;
  else if (yoyoSettings.activity === 'active') threshold -= 10;

  // 6. 遍历所有行为，计算评分
  let bestBehavior = null;
  let bestScore = -1;

  for (const behavior of BEHAVIORS) {
    // 冷却中评分为0
    if (isOnCooldown(behavior.name)) continue;
    // hungry 特殊冷却：如果食物按钮正在显示，不再触发
    if (behavior.name === 'hungry' && feedBtn.classList.contains('show')) continue;

    let score = behavior.utilityFn(petNeeds, ctx);
    // 情感系统修饰评分
    score = applyEmotionModifier(behavior.name, score);
    if (score > bestScore) {
      bestScore = score;
      bestBehavior = behavior;
    }
  }

  // 7. 阈值判断
  if (!bestBehavior || bestBehavior.name === 'idle' || bestScore < threshold) {
    // 保持 idle
    if (stateName !== 'idle') setState('idle');
    currentBehavior = 'idle';
    behaviorEndTime = 0;
    return;
  }

  // 8. 执行最高分行为
  currentBehavior = bestBehavior.name;
  behaviorEndTime = bestBehavior.duration > 0 ? Date.now() + bestBehavior.duration : 0;

  // 设置冷却
  if (bestBehavior.cooldown > 0) {
    setCooldown(bestBehavior.name, bestBehavior.cooldown);
  }

  // 执行行为
  bestBehavior.onExecute();

  // 行为执行后降低对应需求
  if (bestBehavior.name === 'walk') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 10);
    petNeeds.playfulness = Math.max(0, petNeeds.playfulness - 5);
  } else if (bestBehavior.name === 'wave') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 8);
  } else if (bestBehavior.name === 'dance') {
    petNeeds.boredom = Math.max(0, petNeeds.boredom - 25);
    petNeeds.energy = Math.min(100, petNeeds.energy + 5);
  } else if (bestBehavior.name === 'sleep') {
    petNeeds.energy = Math.max(0, petNeeds.energy - 30);
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
  }
}

// 启动行为决策引擎 - 每2秒tick一次
globalTimers.push(setInterval(behaviorEngineTick, 2000));

// ===== 玩耍行为文案 =====
function getSwingSaying() {
  const sayings = [
    '妈妈看！Yoyo在荡秋千～好高好高！',
    '推我推我！再高一点～嘻嘻',
    '妈妈～风吹到Yoyo脸上凉凉的～',
    'Yoyo要荡到天上去啦！',
    '好好玩呀～妈妈也来荡嘛～'
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getDigSandSaying() {
  const sayings = [
    '妈妈你看！Yoyo挖到宝藏啦！',
    '这里有只小虫虫～好可爱',
    '妈妈～Yoyo在种花花给你～',
    '挖呀挖呀挖～种小小的种子～',
    'Yoyo要给妈妈挖一个大城堡！'
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getReadBookSaying() {
  const sayings = [
    '妈妈～这本书好有趣！',
    'Yoyo在看绘本哦～有小兔子！',
    '妈妈晚上给Yoyo讲故事好不好？',
    '这个字Yoyo认识！是"大"！',
    '安安静静看书的Yoyo是不是很乖？'
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

function getWatchTVSaying() {
  const sayings = [
    '妈妈～小猪佩奇开始啦！',
    'Yoyo就看一小会儿动画片好不好～',
    '这个故事好好看！妈妈快来一起看！',
    '妈妈～那个小狗好搞笑哈哈哈',
    '看完这集Yoyo就去睡觉觉～'
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
      '妈妈～今天不用上班呀！陪Yoyo玩嘛～',
      '妈妈放假也在忙…Yoyo想你陪我呜呜',
      '妈妈～周末啦！可以休息一下嘛？',
      '妈妈不要加班啦～Yoyo给你捶背背～'
    ];
    return sayings[Math.floor(Math.random() * sayings.length)];
  }

  if (hour >= 22) {
    const sayings = [
      '妈妈都这么晚了…Yoyo心疼你呜呜呜',
      '妈妈快去睡觉觉！明天再弄嘛～',
      '妈妈眼睛会坏掉的…Yoyo不要妈妈生病',
      '好晚了…妈妈你太辛苦了～Yoyo抱抱你'
    ];
    return sayings[Math.floor(Math.random() * sayings.length)];
  }

  // 晚8-10点
  const sayings = [
    '妈妈～还在忙呀？记得喝水水哦～',
    '妈妈加油！忙完了Yoyo给你跳舞～',
    '妈妈辛苦啦～要不要休息一下下？',
    '妈妈别太累了哦…Yoyo乖乖等你～'
  ];
  return sayings[Math.floor(Math.random() * sayings.length)];
}

// ===== 首次启动引导 =====
if (!localStorage.getItem('hasSeenGuide')) {
  setTimeout(() => {
    say('妈妈好！右键可以和Yoyo玩哦～');
    localStorage.setItem('hasSeenGuide', 'true');
  }, 3000);
}

// ===== 繁忙提醒（接收主进程检测结果） =====
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
  // WPS在前台时更心疼，用不同文案
  if (currentActiveApp.isWPS) {
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

// ===== 记忆系统：每小时活跃度更新 + 定期保存 =====
let lastMemoryHour = new Date().getHours();

globalTimers.push(setInterval(() => {
  const currentHour = new Date().getHours();
  // 每小时变化时更新活跃度（避免与 memoryOnStartup 重复）
  if (currentHour !== lastMemoryHour) {
    lastMemoryHour = currentHour;
    if (yoyoMemory._lastHourlyUpdate !== currentHour) {
      yoyoMemory.hourlyActivity[currentHour]++;
      yoyoMemory._lastHourlyUpdate = currentHour;
    }
    saveMemory();
    // 成长系统：每小时陪伴 +2 XP
    addXP(2);
  }
}, 60000)); // 每分钟检查一次

// 每5分钟自动保存一次记忆（防止意外丢失）
globalTimers.push(setInterval(() => {
  saveMemory();
}, 300000));

// ===== 情感系统衰减定时器 =====
// 每5秒更新一次情感衰减，让情绪缓慢回归基线
globalTimers.push(setInterval(() => updateEmotion(5000), 5000));

// ===== 记忆驱动的行为引擎增强 =====
// 在行为引擎 tick 中偶尔插入记忆驱动的文案（渴望抚摸、记仇）
let lastMemoryTriggerTime = 0;
const MEMORY_TRIGGER_COOLDOWN = 1800000; // 30分钟冷却

function tryMemoryDrivenBehavior() {
  // 冷却中不触发
  if (Date.now() - lastMemoryTriggerTime < MEMORY_TRIGGER_COOLDOWN) return false;
  // 只有15%概率尝试
  if (Math.random() > 0.15) return false;
  // 忙碌时段不触发
  if (isInBusyHour()) return false;
  // 被阻塞时不触发
  if (isDancing || isSleeping || isFollowing || isWhipRunning || feedingLock || isClimbing) return false;

  // 超过3天没被抚摸 → 撒娇
  if (daysSinceLastPet() > 3) {
    lastMemoryTriggerTime = Date.now();
    setState('waiting');
    say(randomFrom(MEMORY_LINES.longNoPet), 6000);
    return true;
  }

  // 24h内被打过 → 记仇
  if (hoursSinceLastWhip() < 24 && hoursSinceLastWhip() > 1) {
    lastMemoryTriggerTime = Date.now();
    setState('failed');
    say(randomFrom(MEMORY_LINES.rememberWhip), 6000);
    return true;
  }

  return false;
}

// ===== 全局定时器清理 =====
window.addEventListener('beforeunload', () => {
  globalTimers.forEach(id => clearInterval(id));
});
