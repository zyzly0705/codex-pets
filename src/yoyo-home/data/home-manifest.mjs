export const HOME_ACTIONS = ['feed', 'sleep', 'bath', 'play', 'comfort', 'study', 'watchAnime', 'playSwitch', 'buildBlocks'];

export const HOME_TASK_LIFECYCLE = [
  'approach',
  'invite',
  'active',
  'result',
  'careDelta',
  'aftermath',
  'idle',
];

export const HOME_ACTION_PRESENTATION = {
  feed: {
    inviteLine: '要开动啦',
    activeLine: '接住饭团！',
    resultLine: '吃到啦',
    aftermathLine: '好满足～',
    startAnimation: 'eat_start',
    loopAnimation: 'eat_loop',
    endAnimation: 'eat_end',
    completeAnimation: 'happy_idle',
  },
  sleep: {
    inviteLine: '有点困啦',
    activeLine: '窝一下下',
    resultLine: '眼皮变重了',
    aftermathLine: '晚安～',
    startAnimation: 'sleep_start',
    loopAnimation: 'sleep_loop',
    endAnimation: 'sleep_end',
    completeAnimation: 'sleepy_idle',
  },
  bath: {
    inviteLine: '洗香香',
    activeLine: '泡泡好多',
    resultLine: '干净啦',
    aftermathLine: '清清爽爽～',
    startAnimation: 'bath_start',
    loopAnimation: 'bath_loop',
    endAnimation: 'bath_end',
    completeAnimation: 'fresh_idle',
  },
  play: {
    inviteLine: '玩一会儿',
    activeLine: '积木时间',
    resultLine: '搭好啦',
    aftermathLine: '真开心～',
    startAnimation: 'play_start',
    loopAnimation: 'play_loop',
    endAnimation: 'play_end',
    completeAnimation: 'happy_idle',
  },
  comfort: {
    inviteLine: '陪我坐坐',
    activeLine: '贴贴一下',
    resultLine: '心里暖暖的',
    aftermathLine: '妈妈最好啦～',
    startAnimation: 'comfort_start',
    loopAnimation: 'comfort_loop',
    endAnimation: 'comfort_end',
    completeAnimation: 'happy_idle',
  },
  study: {
    inviteLine: '学习时间',
    activeLine: '认真想想',
    resultLine: '我会啦',
    aftermathLine: '聪明一点点～',
    startAnimation: 'study_start',
    loopAnimation: 'study_loop',
    endAnimation: 'study_end',
    completeAnimation: 'happy_idle',
  },
  watchAnime: {
    inviteLine: '看一集',
    activeLine: '好精彩',
    resultLine: '记住啦',
    aftermathLine: '还想看～',
    startAnimation: 'watch_start',
    loopAnimation: 'watch_loop',
    endAnimation: 'watch_end',
    completeAnimation: 'happy_idle',
  },
  playSwitch: {
    inviteLine: '开一局',
    activeLine: '按准节奏',
    resultLine: '赢啦',
    aftermathLine: '手感很好～',
    startAnimation: 'game_start',
    loopAnimation: 'game_loop',
    endAnimation: 'game_end',
    completeAnimation: 'happy_idle',
  },
  buildBlocks: {
    inviteLine: '叠高高',
    activeLine: '小心一点',
    resultLine: '房子完成',
    aftermathLine: '好有成就感～',
    startAnimation: 'blocks_start',
    loopAnimation: 'blocks_loop',
    endAnimation: 'blocks_end',
    completeAnimation: 'happy_idle',
  },
};

export const YOYO_HOME_MANIFEST = {
  id: 'yoyo-home-v1',
  runtime: {
    engine: 'phaser',
    stateOwner: 'simulation',
    renderOwner: 'phaser',
    hudOwner: 'dom',
  },
  room: {
    size: { width: 1272, height: 720 },
    backgrounds: {
      day: '../assets/yoyo/home/room-v3-day-safe.webp',
      night: '../assets/yoyo/home/room-v3-night-safe.webp',
      rainy: '../assets/yoyo/home/room-v3-rainy-safe.webp',
      party: '../assets/yoyo/home/room-v3-party-safe.webp',
    },
  },
  actor: {
    id: 'yoyo',
    driver: 'spine-or-layered-rig',
    fallbackDriver: 'spritesheet',
    fallbackSprite: '../assets/yoyo/home/yoyo-home-v7-room-palette.webp',
    scale: 0.62,
    anchor: { x: 0.5, y: 1 },
    requiredAnimations: [
      'idle',
      'walk_left',
      'walk_right',
      'turn_left',
      'turn_right',
      'eat_start',
      'eat_loop',
      'eat_end',
      'sleep_start',
      'sleep_loop',
      'sleep_end',
      'sleepy_idle',
      'bath_start',
      'bath_loop',
      'bath_end',
      'fresh_idle',
      'play_start',
      'play_loop',
      'play_end',
      'comfort_start',
      'comfort_loop',
      'comfort_end',
      'study_start',
      'study_loop',
      'study_end',
      'watch_start',
      'watch_loop',
      'watch_end',
      'game_start',
      'game_loop',
      'game_end',
      'blocks_start',
      'blocks_loop',
      'blocks_end',
      'happy_idle',
    ],
  },
  forbiddenSources: [
    'room-stage-v2',
    'home-room-stage-v2',
    'room-stage-night',
    'room-stage-rainy',
    'room-stage-party',
    'room-shell-clean-2d',
    'saved-compact-room',
  ],
  objects: [
    {
      id: 'mealTable',
      kind: 'meal-table',
      label: '吃饭',
      hitArea: { x: 48, y: 462, width: 300, height: 190 },
      actorSpot: { x: 232, y: 616, facing: 'left' },
      capabilities: ['feed'],
      miniGame: 'catchFood',
      nativeRoomPolicy: {
        bakedFurniture: true,
        renderPropSprite: false,
        renderHitArea: true,
        renderForegroundMask: 'only-during-active-phase',
      },
    },
    {
      id: 'washStand',
      kind: 'wash-stand',
      label: '洗漱',
      hitArea: { x: 532, y: 464, width: 190, height: 180 },
      actorSpot: { x: 574, y: 610, facing: 'right' },
      capabilities: ['bath'],
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'bed',
      kind: 'bed',
      label: '休息',
      hitArea: { x: 954, y: 278, width: 285, height: 230 },
      actorSpot: { x: 1032, y: 512, facing: 'right' },
      capabilities: ['sleep'],
      nativeRoomPolicy: {
        bakedFurniture: true,
        renderPropSprite: false,
        renderHitArea: true,
        renderForegroundMask: 'only-during-active-phase',
      },
    },
    {
      id: 'toyShelf',
      kind: 'toy-shelf',
      label: '玩耍',
      hitArea: { x: 1080, y: 514, width: 180, height: 160 },
      actorSpot: { x: 1082, y: 622, facing: 'right' },
      capabilities: ['play'],
      miniGame: 'toyTrail',
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'comfortCushion',
      kind: 'comfort-cushion',
      label: '陪伴',
      hitArea: { x: 430, y: 500, width: 190, height: 148 },
      actorSpot: { x: 560, y: 618, facing: 'left' },
      capabilities: ['comfort'],
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'mediaScreen',
      kind: 'media-screen',
      label: '看动画',
      hitArea: { x: 760, y: 116, width: 230, height: 170 },
      actorSpot: { x: 796, y: 616, facing: 'right' },
      capabilities: ['watchAnime'],
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'gameConsole',
      kind: 'game-console',
      label: '玩 Switch',
      hitArea: { x: 1050, y: 500, width: 205, height: 158 },
      actorSpot: { x: 1070, y: 620, facing: 'right' },
      capabilities: ['playSwitch'],
      miniGame: 'rhythmPat',
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'blocks',
      kind: 'blocks',
      label: '叠积木',
      hitArea: { x: 1118, y: 612, width: 140, height: 84 },
      actorSpot: { x: 1088, y: 626, facing: 'right' },
      capabilities: ['buildBlocks'],
      miniGame: 'toyTrail',
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
    {
      id: 'studyDesk',
      kind: 'study-desk',
      label: '学习',
      hitArea: { x: 36, y: 240, width: 250, height: 190 },
      actorSpot: { x: 224, y: 612, facing: 'left' },
      capabilities: ['study'],
      miniGame: 'guessMood',
      nativeRoomPolicy: { bakedFurniture: true, renderPropSprite: false, renderHitArea: true },
    },
  ],
};

export function getHomeObjectById(manifest, objectId) {
  return manifest.objects.find((object) => object.id === objectId) || null;
}

export function getHomeObjectForAction(manifest, actionId) {
  return manifest.objects.find((object) => object.capabilities.includes(actionId)) || null;
}

export function getHomeActionPresentation(actionId) {
  return HOME_ACTION_PRESENTATION[actionId] || HOME_ACTION_PRESENTATION.feed;
}

export function validateHomeManifest(manifest = YOYO_HOME_MANIFEST) {
  const errors = [];
  if (manifest.id !== 'yoyo-home-v1') errors.push('manifest id must be yoyo-home-v1');
  if (manifest.runtime?.engine !== 'phaser') errors.push('home runtime must use phaser');
  if (manifest.runtime?.stateOwner !== 'simulation') errors.push('simulation must own gameplay state');
  if (manifest.room?.size?.width !== 1272 || manifest.room?.size?.height !== 720) {
    errors.push('room size must be 1272x720');
  }

  const serialized = JSON.stringify(manifest);
  for (const forbidden of manifest.forbiddenSources || []) {
    const withoutList = JSON.stringify({ ...manifest, forbiddenSources: [] });
    if (withoutList.includes(forbidden)) errors.push(`forbidden source leaked into active manifest: ${forbidden}`);
  }

  for (const variant of ['day', 'night', 'rainy', 'party']) {
    const asset = manifest.room?.backgrounds?.[variant];
    if (!asset || !asset.includes(`room-v3-${variant === 'day' ? 'day' : variant}-safe.webp`)) {
      errors.push(`missing v3-safe ${variant} room background`);
    }
  }

  for (const action of HOME_ACTIONS) {
    if (!getHomeObjectForAction(manifest, action)) errors.push(`missing room object capability for ${action}`);
    if (!HOME_ACTION_PRESENTATION[action]) errors.push(`missing action presentation for ${action}`);
  }

  const requiredAnimations = new Set(manifest.actor?.requiredAnimations || []);
  for (const [action, presentation] of Object.entries(HOME_ACTION_PRESENTATION)) {
    for (const animation of [
      presentation.startAnimation,
      presentation.loopAnimation,
      presentation.endAnimation,
      presentation.completeAnimation,
    ]) {
      if (!requiredAnimations.has(animation)) {
        errors.push(`missing required actor animation ${animation} for ${action}`);
      }
    }
  }

  for (const object of manifest.objects || []) {
    if (!object.id || !object.kind) errors.push('room object must have id and kind');
    if (!object.hitArea || !object.actorSpot) errors.push(`${object.id} must have hitArea and actorSpot`);
    if (object.nativeRoomPolicy?.bakedFurniture && object.nativeRoomPolicy.renderPropSprite !== false) {
      errors.push(`${object.id} must not render duplicate prop sprites over baked room art`);
    }
  }

  if (!serialized.includes('spine-or-layered-rig')) errors.push('actor must prefer a rig-capable driver');

  return { ok: errors.length === 0, errors };
}
