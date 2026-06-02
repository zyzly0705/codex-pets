(function initYoyoActions(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.YOYO_ACTIONS = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function createYoyoActions() {
  const CARE_ACTIONS = {
    feed: {
      label: '喂饭',
      icon: 'food',
      needKey: 'satiety',
      stateName: 'eating',
      finalEffectId: 'eat-final',
      homeScene: 'default',
      homeBubble: '吃饱啦',
      desktopLine: '好吃好吃！Yoyo吃饱啦～',
      delta: { satiety: 24, cleanliness: -1, mood: 5, energy: 1, affection: 1.4 },
    },
    bath: {
      label: '洗澡',
      icon: 'bath',
      needKey: 'cleanliness',
      stateName: 'fanCooling',
      finalEffectId: 'bath-final',
      homeScene: 'default',
      homeBubble: '清爽',
      desktopLine: '洗得香香的，Yoyo亮晶晶～',
      delta: { satiety: -1, cleanliness: 30, mood: 4, energy: -3, affection: 1.2 },
    },
    sleep: {
      label: '休息',
      icon: 'bed',
      needKey: 'energy',
      stateName: 'sleeping',
      finalEffectId: 'sleep-final',
      homeScene: 'default',
      homeBubble: '晚安',
      desktopLine: 'Yoyo眯一会儿，醒来继续陪你。',
      delta: { satiety: -4, cleanliness: -2, mood: 3, energy: 28, affection: 0.8 },
    },
    play: {
      label: '陪玩',
      icon: 'toy',
      needKey: 'mood',
      stateName: 'jumping',
      finalEffectId: 'play-final',
      homeScene: 'default',
      homeBubble: '再来',
      desktopLine: '嘿咻！Yoyo玩得超开心～',
      delta: { satiety: -5, cleanliness: -3, mood: 22, energy: -10, affection: 2 },
    },
    pet: {
      label: '摸摸',
      icon: 'heart',
      needKey: 'mood',
      stateName: 'petting',
      finalEffectId: 'pet-final',
      homeScene: 'default',
      homeBubble: '贴贴',
      desktopLine: '嘿嘿，被妈妈摸摸啦～',
      delta: { satiety: 0, cleanliness: 0, mood: 10, energy: 1, affection: 2.2 },
    },
    watchAnime: {
      label: '看动画',
      icon: 'anime',
      needKey: 'mood',
      stateName: 'watchTV',
      finalEffectId: 'watch-anime-final',
      homeScene: 'default',
      homeBubble: '看动画',
      desktopLine: 'Yoyo坐好啦，和妈妈一起看粉色小猪动画～',
      delta: { satiety: -2, cleanliness: -1, mood: 12, energy: -2, affection: 1.4 },
    },
    playSwitch: {
      label: '玩 Switch',
      icon: 'switch',
      needKey: 'mood',
      stateName: 'review',
      finalEffectId: 'play-switch-final',
      homeScene: 'default',
      homeBubble: '开局',
      desktopLine: 'Yoyo拿好 Switch 啦，妈妈一起赢！',
      delta: { satiety: -3, cleanliness: -1, mood: 16, energy: -6, affection: 1.8 },
    },
    buildBlocks: {
      label: '叠积木',
      icon: 'blocks',
      needKey: 'mood',
      stateName: 'review',
      finalEffectId: 'build-blocks-final',
      homeScene: 'default',
      homeBubble: '搭高高',
      desktopLine: 'Yoyo在认真叠积木，一块一块搭高高～',
      delta: { satiety: -2, cleanliness: -2, mood: 13, energy: -4, affection: 1.5 },
    },
    study: {
      label: '学习',
      icon: 'study',
      needKey: 'affection',
      stateName: 'review',
      finalEffectId: 'study-final',
      homeScene: 'default',
      homeBubble: '认真学',
      desktopLine: 'Yoyo开始学习啦，妈妈陪着就更专心。',
      delta: { satiety: -2, cleanliness: 0, mood: 6, energy: -5, affection: 2 },
    },
  };

  const NEEDS = [
    { key: 'satiety', label: '饱腹', className: 'satiety' },
    { key: 'cleanliness', label: '清洁', className: 'cleanliness' },
    { key: 'mood', label: '心情', className: 'mood' },
    { key: 'energy', label: '体力', className: 'energy' },
    { key: 'affection', label: '亲密', className: 'affection' },
  ];

  const ROOM_SCENES = {
    default: {
      label: '日常小屋',
      asset: '../assets/yoyo/home/room-v3-day-safe.webp',
      artMode: 'v3-safe-room',
    },
    night: {
      label: '夜晚小屋',
      asset: '../assets/yoyo/home/room-v3-night-safe.webp',
      artMode: 'v3-safe-room',
    },
    rainy: {
      label: '雨天小屋',
      asset: '../assets/yoyo/home/room-v3-rainy-safe.webp',
      artMode: 'v3-safe-room',
    },
    party: {
      label: '派对小屋',
      asset: '../assets/yoyo/home/room-v3-party-safe.webp',
      artMode: 'v3-safe-room',
    },
  };

  const ACTION_HINTS = {
    feed: '饿了',
    bath: '想洗澡',
    sleep: '困了',
    play: '想玩',
    pet: '抱抱',
    watchAnime: '想看动画',
    playSwitch: '想玩 Switch',
    buildBlocks: '想叠积木',
    study: '想学习',
  };

  const DECAY_PER_HOUR = {
    satiety: -2.4,
    cleanliness: -1.4,
    mood: -1.1,
    energy: -0.8,
    affection: -0.12,
  };

  const HOME_STATES = {
    idle: { row: 0, frames: 8, fps: 4 },
    waiting: { row: 6, frames: 8, fps: 3 },
    bashful: { row: 7, frames: 6, fps: 4 },
    petting: { row: 11, frames: 8, fps: 4 },
    yawning: { row: 12, frames: 5, fps: 3 },
    eating: { row: 13, frames: 6, fps: 5 },
    fanCooling: { row: 26, frames: 8, fps: 5 },
    sleeping: { row: 20, frames: 8, fps: 3 },
    dancing: { row: 21, frames: 8, fps: 5 },
    crying: { row: 22, frames: 8, fps: 4 },
    jumping: { row: 4, frames: 5, fps: 7 },
    watchTV: { row: 19, frames: 8, fps: 3 },
    readBook: { row: 8, frames: 6, fps: 3 },
    review: { row: 8, frames: 6, fps: 4 },
  };

  function listCareActions(recommendedAction = null) {
    return Object.entries(CARE_ACTIONS).map(([id, config]) => ({
      id,
      label: config.label,
      icon: config.icon,
      stateName: config.stateName,
      finalEffectId: config.finalEffectId,
      needKey: config.needKey,
      homeScene: config.homeScene,
      homeBubble: config.homeBubble,
      recommended: id === recommendedAction,
    }));
  }

  return {
    ACTION_HINTS,
    CARE_ACTIONS,
    DECAY_PER_HOUR,
    HOME_STATES,
    NEEDS,
    ROOM_SCENES,
    listCareActions,
  };
}));
