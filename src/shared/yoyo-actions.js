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
      homeScene: 'default',
      homeBubble: '晚安',
      desktopLine: 'Yoyo眯一会儿，醒来继续陪你。',
      delta: { satiety: -4, cleanliness: -2, mood: 3, energy: 28, affection: 0.8 },
    },
    play: {
      label: '陪玩',
      icon: 'toy',
      needKey: 'mood',
      stateName: 'dancing',
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
      homeScene: 'default',
      homeBubble: '贴贴',
      desktopLine: '嘿嘿，被妈妈摸摸啦～',
      delta: { satiety: 0, cleanliness: 0, mood: 10, energy: 1, affection: 2.2 },
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
      asset: '../assets/yoyo/home/room-shell-clean-2d.webp',
    },
    night: {
      label: '夜晚小屋',
      asset: '../assets/yoyo/home/room-stage-night.webp',
    },
    rainy: {
      label: '雨天小屋',
      asset: '../assets/yoyo/home/room-stage-rainy.webp',
    },
    party: {
      label: '派对小屋',
      asset: '../assets/yoyo/home/room-stage-party.webp',
    },
  };

  const ACTION_HINTS = {
    feed: '饿了',
    bath: '想洗澡',
    sleep: '困了',
    play: '想玩',
    pet: '抱抱',
  };

  const DECAY_PER_HOUR = {
    satiety: -2.4,
    cleanliness: -1.4,
    mood: -1.1,
    energy: -0.8,
    affection: -0.12,
  };

  const HOME_STATES = {
    idle: { row: 0, frames: 6, fps: 4 },
    waiting: { row: 6, frames: 6, fps: 3 },
    bashful: { row: 7, frames: 6, fps: 4 },
    petting: { row: 11, frames: 4, fps: 4 },
    yawning: { row: 12, frames: 5, fps: 3 },
    eating: { row: 13, frames: 6, fps: 5 },
    fanCooling: { row: 26, frames: 8, fps: 5 },
    sleeping: { row: 20, frames: 8, fps: 3 },
    dancing: { row: 21, frames: 8, fps: 5 },
    crying: { row: 22, frames: 8, fps: 4 },
    jumping: { row: 4, frames: 5, fps: 7 },
  };

  function listCareActions(recommendedAction = null) {
    return Object.entries(CARE_ACTIONS).map(([id, config]) => ({
      id,
      label: config.label,
      icon: config.icon,
      stateName: config.stateName,
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
