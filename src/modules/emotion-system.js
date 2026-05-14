// emotion-system.js - PAD 情感模型 + 性格系统 + 情感事件
import { clamp, lerp, say } from './core-state.js';
import { logEmotionDecay, logEmotionEvent } from './debug-log.js';

// ===== Yoyo 拟人化情感系统 =====
export const yoyoEmotion = {
  valence: 55,
  arousal: 55,
  dominance: 50,
  baselineValence: 55,
  baselineArousal: 55,
  baselineDominance: 50,
  personality: {
    extraversion: 75,
    agreeableness: 80,
    neuroticism: 45,
    openness: 70,
  },
};

// 情感事件响应配置
export const EMOTION_EVENTS = {
  pet: { valence: +30, arousal: +20, dominance: +10 },
  whip: { valence: -50, arousal: +35, dominance: -40 },
  feed: { valence: +40, arousal: +10, dominance: +5 },
  play: { valence: +25, arousal: +30, dominance: +15 },
  ignore: { valence: -10, arousal: -5, dominance: -5 },
  happy: { valence: +20, arousal: +15, dominance: +10 },
  curious: { valence: +15, arousal: +20, dominance: +5 },
  calm: { valence: +10, arousal: -20, dominance: +5 },
  relaxed: { valence: +15, arousal: -15, dominance: +5 },
  worried: { valence: -15, arousal: +10, dominance: -10 },
  sad: { valence: -30, arousal: +20, dominance: -15 },
};

function between(value, min, max) {
  return value >= min && value <= max;
}

function clampMultiplier(value) {
  return Math.max(0.55, Math.min(1.55, value));
}

// 情感衰减更新
export function updateEmotion(dt_ms) {
  const dt = dt_ms / 1000;
  const decay = 0.015;
  yoyoEmotion.valence = lerp(yoyoEmotion.valence, yoyoEmotion.baselineValence, decay * dt);
  yoyoEmotion.arousal = lerp(yoyoEmotion.arousal, yoyoEmotion.baselineArousal, decay * dt);
  yoyoEmotion.dominance = lerp(yoyoEmotion.dominance, yoyoEmotion.baselineDominance, decay * dt);
  logEmotionDecay({
    valence: Number(yoyoEmotion.valence.toFixed(2)),
    arousal: Number(yoyoEmotion.arousal.toFixed(2)),
    dominance: Number(yoyoEmotion.dominance.toFixed(2)),
  });
}

// 应用情感事件（性格调节）
export function applyEmotionEvent(eventType) {
  const ev = EMOTION_EVENTS[eventType];
  if (!ev) return;

  let vMod = 1, aMod = 1, dMod = 1;
  const p = yoyoEmotion.personality;

  if (eventType === 'pet') {
    vMod = 1 + (p.agreeableness - 50) / 100;
  } else if (eventType === 'whip') {
    vMod = 1 + (p.neuroticism - 50) / 100;
    dMod = 1 + (p.agreeableness - 50) / 100;
  } else if (eventType === 'play') {
    aMod = 1 + (p.extraversion - 50) / 100;
  }

  yoyoEmotion.valence = clamp(yoyoEmotion.valence + ev.valence * vMod, -100, 100);
  yoyoEmotion.arousal = clamp(yoyoEmotion.arousal + ev.arousal * aMod, 0, 100);
  yoyoEmotion.dominance = clamp(yoyoEmotion.dominance + ev.dominance * dMod, 0, 100);
  logEmotionEvent(eventType, {
    valence: Number(yoyoEmotion.valence.toFixed(2)),
    arousal: Number(yoyoEmotion.arousal.toFixed(2)),
    dominance: Number(yoyoEmotion.dominance.toFixed(2)),
  });
}

// 获取当前情绪标签
export function getEmotionLabel() {
  const { valence, arousal, dominance } = yoyoEmotion;
  if (valence > 70 && arousal > 60) return 'excited';
  if (arousal < 28 && valence > 35) return 'calm';
  if (valence < -50 && dominance < 30) return 'sad';
  if (valence < -35 && arousal > 45 && dominance > 50) return 'angry';
  if (valence > 50) return 'happy';
  if (arousal < 25) return 'calm';
  return 'neutral';
}

// 情绪 → 表情的自动映射。表情不再作为“换装贴片”手动选择，而是由 PAD 情绪、行为和反应共同驱动。
export function getEmotionExpression() {
  const { valence, arousal, dominance } = yoyoEmotion;
  if (valence > 82 && arousal > 68) return 'sparkle';
  if (valence > 72 && dominance < 48) return 'heart';
  if (valence > 58 && arousal > 45) return 'happy';
  if (valence > 45 && arousal < 35) return 'sleepy';
  if (valence < -58 && dominance < 42) return 'sad';
  if (valence < -36 && dominance > 52) return 'angry';
  if (arousal < 26) return 'sleepy';
  if (arousal > 76 && valence > 40) return 'sparkle';
  return 'neutral';
}

// 情感驱动文案选择器
export function emotionSay(dialogueMap, fallback) {
  const mood = getEmotionLabel();
  const pool = dialogueMap[mood] || dialogueMap.neutral || dialogueMap.happy;
  if (pool && pool.length > 0) {
    say(pool[Math.floor(Math.random() * pool.length)]);
  } else if (fallback) {
    say(fallback);
  }
}

// 情绪分层文案：抚摸
export const PET_DIALOGUES = {
  happy: ['嘿嘿！妈妈摸摸！Yoyo最喜欢啦～', '好开心好开心！再摸一下下嘛～', '妈妈的手好温暖呀～'],
  excited: ['哇！妈妈你好温柔！Yoyo爱你爱你！', '呀呀呀～太幸福啦！再摸摸再摸摸！', 'Yoyo最喜欢妈妈摸摸头了！'],
  neutral: ['嗯～妈妈的手好温暖～', '摸摸头～嘿嘿～', '妈妈最爱Yoyo了对不对？'],
  calm: ['嗯…妈妈摸摸…好舒服…呼…', '轻轻的…Yoyo快睡着了…'],
  sad: ['…妈妈…你终于想起Yoyo了…', '哼…现在才来摸…（嘟嘴但偷偷开心）', '…妈妈…Yoyo好想好想你…'],
  angry: ['…哼！（扭过头但偷偷瞄妈妈）', '…Yoyo不想理妈妈…（但是好舒服哦）', '…哼…算你还知道来摸摸…'],
};

// 情绪分层文案：鞭打
export const WHIP_DIALOGUES = {
  happy: ['哎呀！妈妈坏坏！打不着Yoyo～', '嘿嘿没打疼～妈妈是闹着玩的吧？', '妈妈轻点嘛～Yoyo在笑呢！'],
  excited: ['哎呀！妈妈轻点嘛！', '呜！但是Yoyo心情好所以原谅你啦！'],
  neutral: ['呜…妈妈别打Yoyo…疼…', 'Yoyo知道错了…妈妈轻点…', '呜呜…妈妈别打了好不好…'],
  calm: ['…疼…', '妈妈…为什么打Yoyo呀…'],
  sad: ['呜呜呜…妈妈为什么一直打Yoyo…', '你是不是不爱Yoyo了…（大哭）', '呜…Yoyo最可怜了…'],
  angry: ['够了！！Yoyo生气了！不理你了！！', '哼！！妈妈太过分了！！', '再打Yoyo就真的真的不理你了！！'],
};

// 情绪分层文案：喂食
export const FEED_DIALOGUES = {
  happy: ['好吃好吃！妈妈最好了！', '呀！是Yoyo最爱的！谢谢妈妈～', '嗯嗯好香！妈妈最好了！'],
  excited: ['哇哇哇！太好吃啦！妈妈再给一个嘛～', '好幸福！Yoyo要吃得饱饱的！', '太棒了太棒了！妈妈最好了！'],
  neutral: ['嗯嗯～谢谢妈妈～', '吃饱饱了～谢谢妈妈投喂！', '好吃！妈妈对Yoyo真好～'],
  calm: ['嗯…好吃…谢谢妈妈…', '慢慢吃…好香…好幸福…'],
  sad: ['…哼…妈妈终于想起喂Yoyo了…', '…好吧…谢谢…（委屈地吃）', '…吃了…但Yoyo还是有一点点不开心…'],
  angry: ['…哼！吃了不代表原谅你了！', '…好吧给吃的就勉强原谅一点点…', '…不是给吃的就能解决的！（但还是好香）'],
};

// 情感影响行为引擎评分
export function applyEmotionModifier(behaviorName, baseScore) {
  const { valence, arousal, dominance } = yoyoEmotion;
  const normalizedValence = valence / 100;
  const normalizedArousal = (arousal - 50) / 50;
  const normalizedCalm = (50 - arousal) / 50;
  const normalizedDominance = (dominance - 50) / 50;

  let multiplier = 1;

  switch (behaviorName) {
    case 'sweetTalk':
      multiplier = 1 + Math.max(0, normalizedValence) * 0.22 - Math.max(0, -normalizedArousal) * 0.06;
      break;
    case 'dance':
      multiplier = 1 + Math.max(0, normalizedArousal) * 0.38 - Math.max(0, normalizedCalm) * 0.18;
      break;
    case 'swimming':
      multiplier = 1 + Math.max(0, normalizedValence) * 0.2 + Math.max(0, normalizedArousal) * 0.18;
      if (arousal < 40) multiplier -= 0.12;
      break;
    case 'fanCooling':
    case 'airConditioning':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.28 + Math.max(0, normalizedValence) * 0.08;
      if (arousal > 68) multiplier -= 0.16;
      break;
    case 'sofaLying':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.3 - Math.max(0, normalizedArousal) * 0.12;
      break;
    case 'sleep':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.34 - Math.max(0, normalizedArousal) * 0.24;
      break;
    case 'climb':
      multiplier = 1 + Math.max(0, normalizedDominance) * 0.24 + Math.max(0, normalizedArousal) * 0.1;
      break;
    case 'lookAround':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.06;
      break;
    case 'walk':
      multiplier = 1 + Math.max(0, normalizedArousal) * 0.18 - Math.max(0, normalizedCalm) * 0.08;
      break;
    case 'wave':
      multiplier = 1 + Math.max(0, -normalizedValence) * 0.18 + Math.max(0, normalizedValence) * 0.08;
      break;
    case 'readBook':
    case 'watchTV':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.24 - Math.max(0, normalizedArousal) * 0.16;
      break;
    case 'swing':
      multiplier = 1 + Math.max(0, normalizedValence) * 0.12 + Math.max(0, normalizedArousal) * 0.18;
      break;
    case 'digSand':
      multiplier = 1 + Math.max(0, normalizedArousal) * 0.16;
      break;
    case 'overtimeReminder':
    case 'wpsCompanion':
      multiplier = 1 + Math.max(0, normalizedCalm) * 0.12 + Math.max(0, -normalizedValence) * 0.08;
      break;
    default:
      multiplier = 1;
      break;
  }

  if (between(arousal, 0, 18) && ['dance', 'swimming', 'climb', 'digSand'].includes(behaviorName)) {
    multiplier -= 0.12;
  }
  if (between(arousal, 78, 100) && ['sleep', 'readBook', 'fanCooling', 'airConditioning', 'sofaLying'].includes(behaviorName)) {
    multiplier -= 0.14;
  }

  return baseScore * clampMultiplier(multiplier);
}
