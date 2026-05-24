// behavior-data.js - standardized behavior metadata, dialogue catalogs, and tuning data

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

export const BEHAVIOR_DIALOGUES = {
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
  cheer: [
    '妈妈加油！Yoyo给你打气！',
    '耶！今天也要顺顺利利～',
    '好棒好棒！Yoyo举手欢呼一下！',
    '妈妈看这里，Yoyo在给你鼓劲呢～',
  ],
  sleep: [
    '呼…Yoyo好困呀…就睡一小会儿…',
    '眼皮好重…zzZ…Yoyo睡着啦…',
    '趁妈妈不注意偷偷眯一下…zzZ…',
    '困困…妈妈晚安…Yoyo先睡啦…',
    '休息一下下…妈妈别走开哦…呼…',
  ],
  hungry: HUNGER_MESSAGES,
  neglectProtest: [
    '妈妈～Yoyo在这里！',
    '妈妈你忘记Yoyo了吗？',
    '哼，妈妈不理Yoyo！',
    '妈妈！妈妈！看看Yoyo嘛～',
    '妈妈～Yoyo等好久了！',
  ],
  sadnessLinger: [
    '还有点委屈嘛...',
    '哼...才不原谅...才不原谅...',
    '妈妈刚才凶Yoyo了...',
    '（偷偷擦眼泪）',
    'Yoyo还在生气呢...',
  ],
  joySpill: [
    '妈妈妈妈！Yoyo好开心！',
    '嘿嘿嘿嘿！今天好好玩呀！',
    '妈妈也要开心开心！',
    '太快乐了！Yoyo要飞起来啦！',
    '嘻嘻！妈妈看Yoyo开心的样子！',
  ],
};

export const BEHAVIOR_DIALOGUE_CATALOG = {
  wpsCompanion: [
    '妈妈在备课呀～Yoyo乖乖不吵你～',
    '妈妈加油！Yoyo在旁边安安静静陪着你～',
    '妈妈好认真呀！Yoyo也要学妈妈当个好学生～',
    '妈妈在做PPT吗？好厉害好厉害！',
    '嘘…Yoyo不出声，让妈妈专心工作～',
    '妈妈写的字好漂亮！Yoyo也想学写字～',
    '妈妈备课辛苦啦～等下Yoyo给你捶捶背！',
    '妈妈的学生好幸福呀，有这么认真的老师～',
  ],
  swing: [
    '妈妈快看！Yoyo在荡秋千～好高好高！',
    '推我推我！再高一点点嘛～嘻嘻～',
    '妈妈～风呼呼吹到Yoyo脸上啦，凉凉的～',
    '哇～Yoyo要飞到天上去了！',
    '好好玩呀～妈妈也来荡嘛～一起一起！',
  ],
  digSand: [
    '妈妈你看！Yoyo挖到宝藏啦！是什么呀？',
    '咦？这里有只小虫虫～圆圆的好可爱！',
    '妈妈～Yoyo在给你种小花花哦～',
    '挖呀挖呀挖～种小小的种子开大大的花～',
    'Yoyo要给妈妈挖一个大城堡！好大好大的！',
  ],
  readBook: [
    '妈妈～这本书好好看呀！有好多图画！',
    'Yoyo在看绘本哦～里面有小兔兔！',
    '妈妈晚上给Yoyo讲故事好不好？求求你啦～',
    '这个字Yoyo认识！是"大"字！对不对？',
    '安安静静看书的Yoyo是不是特别乖呀？',
  ],
  watchTV: [
    '妈妈～动画片开始啦！Yoyo可以看一小会儿吗？',
    '就看一集！就一集！好不好嘛～',
    '这个故事好好看呀！妈妈快来一起看！',
    '妈妈妈妈～那个小狗狗好好笑哈哈哈～',
    '看完这集Yoyo就去睡觉觉～保证保证！',
  ],
  fanCooling: [
    '呼呼的小风扇吹起来啦～凉快凉快！',
    '夏天太热啦，Yoyo要抱着小风扇吹吹～',
    '妈妈也来吹吹风嘛～凉凉的好舒服！',
    '小风扇转呀转，Yoyo一下子就不热啦～',
  ],
  swimming: [
    '扑通！Yoyo去游泳啦～夏天最适合玩水！',
    '妈妈快看！Yoyo在水里游来游去～',
    '凉凉的水好舒服呀～Yoyo像小鱼一样！',
    '夏天要玩水水！Yoyo现在超开心～',
  ],
  airConditioning: [
    '空调凉凉的～Yoyo终于不冒汗啦！',
    '妈妈别吹太久哦，Yoyo把温度调得刚刚好～',
    '呼～冷风来了，夏天一下子变温柔啦！',
    'Yoyo在空调下面乘凉，舒服到眯眼睛～',
  ],
  sofaLying: [
    'Yoyo在沙发上躺一下下，妈妈也休息会儿嘛～',
    '软软的沙发最适合发呆啦～',
    '今天就这样懒懒地陪妈妈一会儿～',
    'Yoyo盖好小毯子啦，舒服舒服～',
  ],
  overtimeReminder: {
    weekend: [
      '妈妈～今天是周末呀！别工作了陪Yoyo玩嘛～',
      '妈妈放假还在忙…Yoyo好想妈妈陪…',
      '妈妈～周末啦，可以休息一下下嘛？',
      '妈妈不要加班了好不好～Yoyo给你捶捶背～',
    ],
    lateNight: [
      '妈妈都这么晚了…Yoyo好心疼你…',
      '妈妈快去睡觉觉！明天再弄嘛～好不好？',
      '妈妈眼睛会累坏的…Yoyo不要妈妈生病…',
      '好晚了…妈妈你太辛苦了…Yoyo抱抱～',
    ],
    default: [
      '妈妈～还在忙呀？记得要喝水水哦～',
      '妈妈加油加油！忙完了Yoyo给你跳个舞！',
      '妈妈辛苦啦～要不要休息一下下呀？',
      '妈妈别太累了哦…Yoyo乖乖等你～',
    ],
  },
};

export const DECISION_CONFIG = {
  scoreSmoothing: 0.55,
  topBand: 14,
  temperature: 18,
  maxRecent: 5,
  recentMemoryMs: 18 * 60 * 1000,
  recentBiasWindowMs: 8 * 60 * 1000,
  smoothedScoreTtlMs: 12 * 60 * 1000,
  repeatPenalty: 18,
  categoryPenalty: 8,
};

export const LEARNING_CONFIG = {
  feedbackWindowMs: 5 * 60 * 1000,
  historyLimit: 40,
  weightMin: -18,
  weightMax: 18,
  decayPerDay: 0.92,
  scoreScale: 1,
  feedbackImpact: {
    pet: 2.4,
    feed: 1.8,
    manual: 1.2,
    drag: -1.2,
    whip: -3.2,
    interrupt: -1.5,
  },
};

export const DEFAULT_BEHAVIOR_META = {
  pool: 'ambient',
  category: 'ambient',
  rarity: 'common',
  minLevel: 1,
  growthPaths: null,
};

export const BEHAVIOR_META = {
  idle: { pool: 'ambient', category: 'idle' },
  walk: { pool: 'ambient', category: 'movement', growthPaths: ['active'] },
  lookAround: { pool: 'ambient', category: 'ambient' },
  hungry: { pool: 'need', category: 'need', urgent: true },
  sleep: { pool: 'need', category: 'rest', urgent: true },
  wave: { pool: 'care', category: 'social', growthPaths: ['energy'] },
  sweetTalk: { pool: 'care', category: 'social', growthPaths: ['gentle'] },
  bashful: { pool: 'care', category: 'social', growthPaths: ['gentle'] },
  overtimeReminder: { pool: 'care', category: 'care', urgent: true, growthPaths: ['energy'] },
  wpsCompanion: { pool: 'care', category: 'care', growthPaths: ['energy'] },
  dance: { pool: 'growth', category: 'play', growthPaths: ['active'] },
  cheer: { pool: 'growth', category: 'social', growthPaths: ['active', 'energy'] },
  climb: { pool: 'growth', category: 'movement', growthPaths: ['active'] },
  swing: { pool: 'growth', category: 'play', minLevel: 2, growthPaths: ['active'] },
  digSand: { pool: 'growth', category: 'play', minLevel: 2, growthPaths: ['active'] },
  readBook: { pool: 'growth', category: 'quiet', minLevel: 2, growthPaths: ['gentle'] },
  watchTV: { pool: 'growth', category: 'quiet', minLevel: 2, growthPaths: ['gentle'] },
  fanCooling: { pool: 'growth', category: 'quiet', minLevel: 2, growthPaths: ['gentle', 'energy'] },
  swimming: { pool: 'growth', category: 'play', minLevel: 2, growthPaths: ['active'] },
  airConditioning: { pool: 'growth', category: 'quiet', minLevel: 2, growthPaths: ['gentle', 'energy'] },
  sofaLying: { pool: 'growth', category: 'rest', minLevel: 2, growthPaths: ['gentle'] },
  giftFlower: { pool: 'rare', category: 'gift', rarity: 'rare', minLevel: 2, growthPaths: ['gentle'] },
  giftCandy: { pool: 'rare', category: 'gift', rarity: 'rare', minLevel: 2 },
  giant: { pool: 'rare', category: 'special', rarity: 'legendary', minLevel: 4, growthPaths: ['active', 'energy'] },
  neglectProtest: { pool: 'care', category: 'social', growthPaths: ['energy'] },
  sadnessLinger: { pool: 'care', category: 'social' },
  joySpill: { pool: 'growth', category: 'play', growthPaths: ['active', 'gentle'] },
};

export const NEED_EFFECTS = {
  walk: { boredom: -10, playfulness: -5 },
  wave: { boredom: -8 },
  dance: { boredom: -25, energy: 5 },
  cheer: { boredom: -12, playfulness: -4 },
  sleep: { energy: -45 },
  climb: { boredom: -30 },
  lookAround: { boredom: -12 },
  swing: { boredom: -20, playfulness: -10 },
  digSand: { boredom: -18 },
  readBook: { boredom: -15, energy: 5 },
  watchTV: { boredom: -20 },
  fanCooling: { energy: -18, boredom: -10 },
  swimming: { boredom: -26, playfulness: -14, energy: 4 },
  airConditioning: { energy: -16, boredom: -8 },
  sofaLying: { energy: -12, boredom: -6 },
  giant: { boredom: -30, energy: 10 },
};

export const SPECIAL_DATES = [
  { month: 7, day: 5, type: 'birthday', messages: ['今天是Yoyo的生日！妈妈记得吗？嘿嘿～', '妈妈！今天Yoyo又长大一岁啦！'] },
  { month: 9, day: 28, type: 'anniversary', messages: ['今天是爸爸妈妈的纪念日！要永远永远幸福哦～', '妈妈和爸爸结婚纪念日快乐！Yoyo爱你们！'] },
  { month: 9, day: 10, type: 'teachers_day', messages: ['妈妈老师节日快乐！Yoyo给妈妈送花花～', '教师节快乐！妈妈是最好的老师！'] },
  { month: 5, day: -1, type: 'mothers_day', messages: ['妈妈节日快乐！Yoyo最爱妈妈了！', '母亲节快乐～妈妈辛苦了！送你花花！'] },
];

export const FEATURE_TIPS = [
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

export function pickLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function getCatalogLine(key) {
  const lines = BEHAVIOR_DIALOGUE_CATALOG[key];
  if (!Array.isArray(lines) || lines.length === 0) return '';
  return pickLine(lines);
}

export function getOvertimeReminderLine(now = new Date()) {
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return pickLine(BEHAVIOR_DIALOGUE_CATALOG.overtimeReminder.weekend);
  }
  if (hour >= 22) {
    return pickLine(BEHAVIOR_DIALOGUE_CATALOG.overtimeReminder.lateNight);
  }
  return pickLine(BEHAVIOR_DIALOGUE_CATALOG.overtimeReminder.default);
}
