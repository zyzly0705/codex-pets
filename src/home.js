const SHARED = window.YOYO_ACTIONS || {};

const NEEDS = SHARED.NEEDS || [
  { key: 'satiety', label: '饱腹', className: 'satiety' },
  { key: 'cleanliness', label: '清洁', className: 'cleanliness' },
  { key: 'mood', label: '心情', className: 'mood' },
  { key: 'energy', label: '体力', className: 'energy' },
  { key: 'affection', label: '亲密', className: 'affection' },
];

const CARE_ACTIONS = SHARED.CARE_ACTIONS || {
  feed: { label: '喂饭', icon: 'food', stateName: 'eating', homeScene: 'default', homeBubble: '吃饱啦' },
  bath: { label: '洗澡', icon: 'bath', stateName: 'fanCooling', homeScene: 'default', homeBubble: '清爽' },
  sleep: { label: '休息', icon: 'bed', stateName: 'sleeping', homeScene: 'default', homeBubble: '晚安' },
  play: { label: '陪玩', icon: 'toy', stateName: 'jumping', homeScene: 'default', homeBubble: '再来' },
  pet: { label: '摸摸', icon: 'heart', stateName: 'petting', homeScene: 'default', homeBubble: '贴贴' },
};

const ROOM_SCENES = SHARED.ROOM_SCENES || {
  default: { label: '日常小屋', asset: '../assets/yoyo/home/room-v3-day-safe.webp', artMode: 'saved-compact-room' },
  night: { label: '夜晚小屋', asset: '../assets/yoyo/home/room-v3-night-safe.webp', artMode: 'saved-compact-room' },
  rainy: { label: '雨天小屋', asset: '../assets/yoyo/home/room-v3-rainy-safe.webp', artMode: 'saved-compact-room' },
  party: { label: '派对小屋', asset: '../assets/yoyo/home/room-v3-party-safe.webp', artMode: 'saved-compact-room' },
};

const ACTION_HINTS = SHARED.ACTION_HINTS || {
  feed: '饿了',
  bath: '想洗澡',
  sleep: '困了',
  play: '想玩',
  pet: '抱抱',
};

const HOME_STATES = SHARED.HOME_STATES || {
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
  concert: { row: 37, frames: 8, fps: 6 },
  heartSign: { row: 38, frames: 8, fps: 5 },
  nascentSoul: { row: 39, frames: 8, fps: 4 },
};

const COMPANION_ACTIONS = ['feed', 'bath', 'sleep', 'play', 'pet', 'watchAnime', 'playSwitch', 'buildBlocks', 'study'];

const HOME_SCENE = window.YOYO_HOME_SCENE || { objects: [], interactions: {} };

const DECOR_DEFAULTS = {
  fairyLights: true,
  floorStars: false,
  softGlow: true,
  keepsakes: false,
};

const HOME_EVENT_LINES = {
  morning: ['妈妈早安！新的一天开始啦～', '早上好妈妈！Yoyo等你好久了！', '妈妈早！今天也要元气满满哦～'],
  afternoon: ['妈妈来啦！Yoyo好想你哦～', '妈妈终于回来了！Yoyo有点等不住了～', '妈妈妈妈！快来看Yoyo！'],
  evening: ['妈妈辛苦啦～Yoyo在等你呢！', '妈妈回来了！Yoyo一直在守着小屋哦！', '傍晚啦～妈妈今天过得好吗？'],
  night: ['妈妈晚安～做个好梦哦！', '夜深啦，妈妈早点休息呀～', '妈妈，Yoyo等你睡着了再睡～'],
  comeback: ['妈妈回来啦！Yoyo好高兴！', '妈妈！你去哪啦，Yoyo等了你好久！', '妈妈终于回来了！要摸摸Yoyo吗？'],
};

const CARE_FOLLOWUP_LINES = {
  feed: ['吃饱饱了～谢谢妈妈！', '好香好香！妈妈做的最好吃！', '嗯嗯嗯！Yoyo吃得好开心～'],
  bath: ['好清爽呀～像小花一样香！', '洗完澡好舒服～Yoyo要飞起来了！', '干干净净的Yoyo最可爱了！'],
  sleep: ['嗯…妈妈晚安…呼…', '好困好困…Yoyo要睡了…zZ', 'Yoyo闭眼睛了…妈妈轻点哦…'],
  play: ['哇！好好玩！再来再来！', '耶耶耶！Yoyo最喜欢和妈妈玩了！', '妈妈陪Yoyo玩最幸福啦！'],
  pet: ['嘿嘿～妈妈的手好温暖！', '再摸一下嘛！Yoyo还没够呢～', '妈妈摸摸！Yoyo要飞上天啦！'],
  watchAnime: ['粉色小猪这一集好可爱～', 'Yoyo坐得很乖哦～', '再看一小会儿嘛～'],
  playSwitch: ['Switch这一局Yoyo超认真！', '妈妈妈妈，快按这个！', '赢啦赢啦！再来一局～'],
  buildBlocks: ['搭高高啦～不要倒不要倒！', 'Yoyo的小房子做好啦！', '这一块放这里刚刚好～'],
  study: ['Yoyo学会一个新东西啦！', '妈妈陪着，Yoyo就很专心。', '这一页好有意思～'],
};

const HOME_INTENT_COPY = {
  feed: { title: '要吃一点吗？', detail: 'Yoyo 会去现有的小餐桌旁吃饭，不会凭空变出第二套餐。', confirm: '吃一点' },
  bath: { title: '要洗香香吗？', detail: '先看看清洁状态，再去房间里的洗漱区。', confirm: '去洗手' },
  sleep: { title: '要休息一下吗？', detail: '这是一个持续休息活动，不是点一下床就结束。', confirm: '去休息' },
  play: { title: '想玩什么呢？', detail: '先回应 Yoyo 的心情，再选择玩具或小游戏。', confirm: '陪她玩' },
  pet: { title: '摸摸 Yoyo？', detail: '点击 Yoyo 应该是安抚和亲密互动。', confirm: '摸摸她' },
  watchAnime: { title: '看一会儿动画？', detail: '这是持续活动，Yoyo 会坐到电视区。', confirm: '看一会儿' },
  playSwitch: { title: '玩一局游戏？', detail: '先进入游戏状态，再根据结果反馈心情。', confirm: '玩一局' },
  buildBlocks: { title: '搭积木吗？', detail: 'Yoyo 会去玩具区，不额外生成重复家具。', confirm: '搭高高' },
  study: { title: '学习一下？', detail: '学习应该消耗精力并增加成长反馈。', confirm: '开始学' },
};

const STATUS_BUBBLES = {
  urgent: '妈妈快看看我',
  'needs-care': '想你陪陪我',
  close: '贴贴',
  steady: '',
};

const DEFAULT_ACTIONS = SHARED.listCareActions
  ? SHARED.listCareActions()
  : Object.entries(CARE_ACTIONS)
    .filter(([id]) => COMPANION_ACTIONS.includes(id))
    .map(([id, action]) => ({
    id,
    label: action.label,
    icon: action.icon,
    stateName: action.stateName,
    homeScene: action.homeScene,
    homeBubble: action.homeBubble,
    recommended: false,
  }));

const els = {
  shell: document.querySelector('.home-shell'),
  roomStage: document.querySelector('.room-stage'),
  roomWorld: document.getElementById('room-world'),
  roomArt: document.getElementById('room-art'),
  decorLayer: document.getElementById('home-decor-layer'),
  sceneObjectsBack: document.getElementById('home-scene-objects-back'),
  sceneObjectsFront: document.getElementById('home-scene-objects-front'),
  sceneRigLayer: document.getElementById('home-scene-rig-layer'),
  actionComposite: document.getElementById('home-action-composite'),
  canvas: document.getElementById('home-pet'),
  petCutout: document.getElementById('home-pet-cutout'),
  carePose: document.getElementById('home-care-pose'),
  bubble: document.getElementById('life-bubble-text'),
  tip: document.getElementById('home-tip'),
  intentPopover: document.getElementById('home-intent-popover'),
  intentTitle: document.getElementById('home-intent-title'),
  intentDetail: document.getElementById('home-intent-detail'),
  intentConfirm: document.getElementById('home-intent-confirm'),
  intentCancel: document.getElementById('home-intent-cancel'),
  needsList: document.getElementById('needs-list'),
  refresh: document.getElementById('refresh-life'),
  ctrlToggle: document.getElementById('ctrl-toggle'),
  ctrlPanel: document.getElementById('ctrl-panel'),
  sceneButtons: Array.from(document.querySelectorAll('[data-room-scene]')),
  decorButtons: Array.from(document.querySelectorAll('[data-decor]')),
  hotspots: Array.from(document.querySelectorAll('.room-hotspot')),
  profile: {
    level: document.getElementById('profile-level'),
    intimacy: document.getElementById('profile-intimacy'),
  },
};

const sprite = new Image();
let lastLife = null;
let activeRoomScene = 'default';
let selectedRoomScene = '';
let homePrefs = { selectedScene: '', decor: { ...DECOR_DEFAULTS }, visitCount: 0, lastVisitAt: 0 };
let effectTimer = 0;
let uiIdleTimer = 0;
let homeAnimation = { stateName: 'idle', action: '', until: 0, startedAt: 0 };
let sceneObjectTimers = [];
let actionRoomFrameTimer = 0;
let careInProgress = false;
let suppressHotspotTipUntil = 0;
let pendingHomeIntent = '';
let pendingPetTravelAction = '';
let petTravelFrame = 0;
let petTravelFinishTimer = 0;

function pct(value) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
}

let _typewriterTimer = null;
function typewriteBubble(text, onDone) {
  if (!els.bubble) return;
  if (_typewriterTimer) clearInterval(_typewriterTimer);
  els.bubble.textContent = '';
  els.bubble.classList.add('typing');
  const speed = text.length <= 8 ? 55 : 85;
  let i = 0;
  _typewriterTimer = setInterval(() => {
    els.bubble.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(_typewriterTimer);
      _typewriterTimer = null;
      els.bubble.classList.remove('typing');
      if (onDone) onDone();
    }
  }, speed);
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interactionTask(action) {
  return HOME_SCENE.interactionSystem?.tasks?.[action] || HOME_SCENE.interactions?.[action] || null;
}

function currentScene(life = lastLife) {
  return homeAnimation.action || life?.redirectedAction || life?.recommendedAction || '';
}

function defaultRoomScene(life = lastLife) {
  const hour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());
  if (life?.status === 'urgent') return 'rainy';
  if (hour >= 22 || hour < 6) return 'night';
  const mood = pct(life?.mood);
  const energy = pct(life?.energy);
  if (mood < 35 || energy < 30) return 'night';
  if (isWeekend && mood > 65) return 'party';
  return 'default';
}

function roomSceneForAction(action) {
  if (HOME_SCENE.actionRooms?.[action]?.roomScene) return HOME_SCENE.actionRooms[action].roomScene;
  if (HOME_SCENE.roomLayout?.baseAsset) return 'default';
  return CARE_ACTIONS[action]?.homeScene || '';
}

function roomSceneForLife(life = lastLife) {
  const actionScene = roomSceneForAction(currentScene(life));
  if (actionScene) return actionScene;
  if (selectedRoomScene) return selectedRoomScene;
  return defaultRoomScene(life);
}

function clearActionRoomFrameTimer() {
  if (!actionRoomFrameTimer) return;
  clearInterval(actionRoomFrameTimer);
  actionRoomFrameTimer = 0;
}

function setRoomArtSource(sceneAsset) {
  const nextUrl = new URL(sceneAsset, window.location.href).href;
  if (els.roomArt.src === nextUrl) return;
  els.roomArt.classList.add('switching');
  els.roomArt.onload = () => {
    els.roomArt.classList.remove('switching');
  };
  els.roomArt.src = nextUrl;
}

function setRoomScene(sceneName) {
  const nextScene = ROOM_SCENES[sceneName] ? sceneName : 'default';
  els.roomStage.dataset.room = nextScene;
  for (const button of els.sceneButtons) {
    button.classList.toggle('active', button.dataset.roomScene === nextScene);
  }
  activeRoomScene = nextScene;
  const actionRoom = HOME_SCENE.actionRooms?.[currentScene()];
  const sceneArtMode = actionRoom?.artMode || ROOM_SCENES[nextScene].artMode || HOME_SCENE.roomLayout?.artMode || '';
  els.roomStage.dataset.roomArtMode = sceneArtMode;
  clearActionRoomFrameTimer();

  if (Array.isArray(actionRoom?.frames) && actionRoom.frames.length > 0) {
    let frameIndex = 0;
    setRoomArtSource(actionRoom.frames[frameIndex]);
    const frameDuration = Math.max(260, Number(actionRoom.frameDuration) || 900);
    actionRoomFrameTimer = setInterval(() => {
      if (HOME_SCENE.actionRooms?.[currentScene()] !== actionRoom) {
        clearActionRoomFrameTimer();
        return;
      }
      frameIndex = (frameIndex + 1) % actionRoom.frames.length;
      setRoomArtSource(actionRoom.frames[frameIndex]);
    }, frameDuration);
    return;
  }

  const sceneAsset = actionRoom?.asset || ROOM_SCENES[nextScene].asset;
  setRoomArtSource(sceneAsset);
}

function saveHomePrefs() {
  if (!window.petApi?.storeSet) return;
  window.petApi.storeSet('home', homePrefs).catch(() => {});
}

function chooseRoomScene(sceneName) {
  selectedRoomScene = ROOM_SCENES[sceneName] ? sceneName : '';
  homePrefs.selectedScene = selectedRoomScene;
  saveHomePrefs();
  renderScene(lastLife);
}

function applyDecor() {
  const decor = { ...DECOR_DEFAULTS, ...(homePrefs.decor || {}) };
  homePrefs.decor = decor;
  els.roomStage.dataset.decorFairy = String(Boolean(decor.fairyLights));
  els.shell.dataset.decorStars = String(Boolean(decor.floorStars));
  els.shell.dataset.decorGlow = String(Boolean(decor.softGlow));
  els.shell.dataset.decorKeepsakes = String(Boolean(decor.keepsakes));
  for (const button of els.decorButtons) {
    button.classList.toggle('active', Boolean(decor[button.dataset.decor]));
  }
}

function toggleDecor(key) {
  homePrefs.decor = { ...DECOR_DEFAULTS, ...(homePrefs.decor || {}) };
  homePrefs.decor[key] = !homePrefs.decor[key];
  applyDecor();
  saveHomePrefs();
}

function setRoomEffect(action, duration = 5200) {
  clearTimeout(effectTimer);
  els.roomStage.dataset.effect = action || '';
  if (action) {
    effectTimer = setTimeout(() => {
      if (homeAnimation.action !== action) return;
      els.roomStage.dataset.effect = '';
    }, duration);
  }
}

function clearSceneObjectTimers() {
  for (const timer of sceneObjectTimers) clearTimeout(timer);
  sceneObjectTimers = [];
}

function renderHomeSceneObjects() {
  if (!els.sceneObjectsBack || !els.sceneObjectsFront) return;
  els.sceneObjectsBack.innerHTML = '';
  els.sceneObjectsFront.innerHTML = '';
  renderHomeDecor();
  for (const object of HOME_SCENE.objects || []) {
    const backNode = createSceneObjectNode(object, false);
    const frontNode = createSceneObjectNode(object, true);

    els.sceneObjectsBack.appendChild(backNode);
    els.sceneObjectsFront.appendChild(frontNode);
  }
}

function renderHomeDecor() {
  if (!els.decorLayer) return;
  els.decorLayer.innerHTML = '';
  for (const decor of HOME_SCENE.decor || []) {
    const node = decor.src ? document.createElement('img') : document.createElement('div');
    node.className = `home-decor-item ${decor.className || ''}`.trim();
    node.dataset.decorId = decor.id;
    if (decor.src) {
      node.src = new URL(decor.src, window.location.href).href;
      node.alt = decor.label || '';
    } else {
      node.setAttribute('aria-label', decor.label || decor.id);
    }
    const slot = decor.slot || {};
    for (const [key, value] of Object.entries(slot)) {
      const cssName = `--decor-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
      node.style.setProperty(cssName, String(value));
    }
    els.decorLayer.appendChild(node);
  }
}

function createSceneObjectNode(object, foreground) {
  const node = document.createElement('div');
  node.className = `scene-object ${object.className || ''}`.trim();
  node.dataset.objectId = object.id;
  node.dataset.action = object.action || '';
  node.dataset.state = object.initialState || 'idle';
  node.dataset.layerGroup = foreground ? 'front' : 'back';
  node.dataset.slot = object.slot || object.action || '';
  node.setAttribute('aria-label', object.label || object.id);

  const slot = HOME_SCENE.roomLayout?.slots?.[object.slot || object.action];
  if (slot) {
    for (const [key, value] of Object.entries(slot)) {
      const cssName = `--slot-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
      node.style.setProperty(cssName, String(value));
    }
  }

  for (const layer of object.layers || []) {
    const isFront = layer.id === 'front';
    if (isFront !== foreground) continue;
    const img = document.createElement('img');
    img.className = `scene-object-layer ${layer.className || ''}`.trim();
    img.dataset.layerId = layer.id;
    img.src = new URL(layer.src, window.location.href).href;
    img.alt = '';
    node.appendChild(img);
  }

  return node;
}

function sceneObjectNode(objectId) {
  return [
    ...Array.from(els.sceneObjectsBack?.querySelectorAll?.(`[data-object-id="${objectId}"]`) || []),
    ...Array.from(els.sceneObjectsFront?.querySelectorAll?.(`[data-object-id="${objectId}"]`) || []),
  ];
}

function setSceneObjectState(objectId, state) {
  for (const node of sceneObjectNode(objectId)) {
    node.dataset.state = state || 'idle';
  }
}

function activeSceneRig(scene) {
  return HOME_SCENE.sceneRigs?.[scene] || null;
}

function setSceneRigObjectDisables(rig) {
  const nodes = [
    ...Array.from(els.sceneObjectsBack?.querySelectorAll?.('.scene-object') || []),
    ...Array.from(els.sceneObjectsFront?.querySelectorAll?.('.scene-object') || []),
  ];
  for (const node of nodes) {
    delete node.dataset.sceneRigDisabled;
  }

  for (const objectId of rig?.runtime?.disableLegacyObjects || []) {
    for (const node of sceneObjectNode(objectId)) {
      node.dataset.sceneRigDisabled = 'true';
    }
  }
}

function renderSceneRig(scene) {
  const rig = activeSceneRig(scene);
  els.roomStage.dataset.hasSceneRig = rig ? 'true' : 'false';
  els.roomStage.dataset.sceneRigDisablePetCanvas = rig?.runtime?.disablePetCanvas ? 'true' : 'false';
  els.roomStage.dataset.sceneRigDisableActionComposite = rig?.runtime?.disableActionComposite ? 'true' : 'false';
  setSceneRigObjectDisables(rig);

  if (!els.sceneRigLayer) return rig;
  els.sceneRigLayer.innerHTML = '';
  if (!rig) return null;

  const stage = rig.stage || { width: 512, height: 384 };
  const width = Number(stage.width || 512);
  const height = Number(stage.height || 384);
  const frame = rig.frame || {};
  const frameVars = {
    left: frame.left || 'auto',
    right: frame.right || 'auto',
    bottom: frame.bottom || 'auto',
    top: frame.top || 'auto',
    width: frame.width || '430px',
    zIndex: frame.zIndex || 8,
    translateX: frame.translateX || '0',
    aspectRatio: `${width} / ${height}`,
  };
  for (const [key, value] of Object.entries(frameVars)) {
    const cssName = `--scene-rig-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
    els.sceneRigLayer.style.setProperty(cssName, String(value));
  }
  const layers = [...(rig.layers || [])].sort((a, b) => Number(a.z || 0) - Number(b.z || 0));

  for (const layer of layers) {
    if (!layer.src) continue;
    const img = document.createElement('img');
    img.className = 'scene-rig-layer';
    img.dataset.layerId = layer.id || '';
    img.dataset.role = layer.role || '';
    if (layer.motion) img.dataset.motion = layer.motion;
    img.src = new URL(layer.src, window.location.href).href;
    img.alt = '';
    img.style.left = `${(Number(layer.x || 0) / width) * 100}%`;
    img.style.top = `${(Number(layer.y || 0) / height) * 100}%`;
    img.style.width = `${(Number(layer.w || width) / width) * 100}%`;
    img.style.height = `${(Number(layer.h || height) / height) * 100}%`;
    img.style.zIndex = String(Number(layer.z || 0));
    els.sceneRigLayer.appendChild(img);
  }

  return rig;
}

function resetSceneObjectStates() {
  for (const object of HOME_SCENE.objects || []) {
    setSceneObjectState(object.id, object.initialState || 'idle');
  }
  delete els.roomStage.dataset.interactionPhase;
  delete els.roomStage.dataset.motionPhase;
  delete els.roomStage.dataset.actionPhase;
  delete els.roomStage.dataset.actionPose;
  delete els.roomStage.dataset.actionAnimation;
}

function stopSceneObjectInteraction() {
  clearSceneObjectTimers();
  resetSceneObjectStates();
}

function startSceneObjectInteraction(action, duration = 0) {
  clearSceneObjectTimers();
  const interaction = interactionTask(action);
  if (!interaction) {
    resetSceneObjectStates();
    return;
  }

  resetSceneObjectStates();
  const timeline = Array.isArray(interaction.timeline) && interaction.timeline.length
    ? interaction.timeline
    : interaction.phases || [];
  for (const phase of timeline) {
    const timer = setTimeout(() => {
      if (phase.state) setSceneObjectState(interaction.objectId, phase.state);
      const visualPhase = phase.stagePhase || phase.phase;
      if (visualPhase) els.roomStage.dataset.interactionPhase = visualPhase;
      if (visualPhase || phase.phase) els.roomStage.dataset.motionPhase = visualPhase || phase.phase;
      if (phase.phase) els.roomStage.dataset.actionPhase = phase.phase;
      if (phase.pose) els.roomStage.dataset.actionPose = phase.pose;
      if (phase.animation) els.roomStage.dataset.actionAnimation = phase.animation;
    }, Math.max(0, Number(phase.at) || 0));
    sceneObjectTimers.push(timer);
  }

  const resetDelay = Number(interaction.resetDelay || duration || 0);
  if (resetDelay > 0) {
    sceneObjectTimers.push(setTimeout(() => {
      setSceneObjectState(interaction.objectId, 'idle');
    }, resetDelay));
  }
}

function petPlacementForScene(scene) {
  const task = interactionTask(scene);
  const zone = task ? HOME_SCENE.interactionSystem?.zones?.[task.zone] : null;
  const placementKey = zone?.placement || task?.zone || scene;
  return HOME_SCENE.petPlacements?.[placementKey] || HOME_SCENE.petPlacements?.default;
}

function setPetPlacementVars(placement) {
  if (!placement) return;
  els.roomStage.style.setProperty('--pet-left', placement.left);
  els.roomStage.style.setProperty('--pet-bottom', placement.bottom);
  els.roomStage.style.setProperty('--pet-scale', String(placement.scale));
}

function clearPetTravelTimers() {
  if (petTravelFrame) {
    cancelAnimationFrame(petTravelFrame);
    petTravelFrame = 0;
  }
  if (petTravelFinishTimer) {
    clearTimeout(petTravelFinishTimer);
    petTravelFinishTimer = 0;
  }
}

function resetPetTravelState() {
  pendingPetTravelAction = '';
  clearPetTravelTimers();
  delete els.roomStage.dataset.petTravel;
  delete els.roomStage.dataset.petTravelAction;
  els.roomStage.style.removeProperty('--pet-travel-duration');
  els.roomStage.style.removeProperty('--pet-travel-easing');
}

function petTravelForAction(action, fallbackPlacement) {
  const travel = HOME_SCENE.actionMotion?.[action]?.petTravel;
  if (!travel) return null;
  const from = HOME_SCENE.petPlacements?.[travel.from] || HOME_SCENE.petPlacements?.default;
  const to = HOME_SCENE.petPlacements?.[travel.to] || fallbackPlacement;
  if (!from || !to) return null;
  return {
    from,
    to,
    duration: Math.max(260, Number(travel.durationMs) || 960),
    easing: travel.easing || 'var(--spring)',
  };
}

function startPetTravel(action, placement) {
  const travel = petTravelForAction(action, placement);
  if (!travel) return false;

  clearPetTravelTimers();
  setPetPlacementVars(travel.from);
  els.roomStage.dataset.petTravel = `${action}-run`;
  els.roomStage.dataset.petTravelAction = action;
  els.roomStage.style.setProperty('--pet-travel-duration', `${travel.duration}ms`);
  els.roomStage.style.setProperty('--pet-travel-easing', travel.easing);

  petTravelFrame = requestAnimationFrame(() => {
    petTravelFrame = requestAnimationFrame(() => {
      setPetPlacementVars(travel.to);
      els.roomStage.dataset.petTravel = `${action}-run-active`;
      petTravelFrame = 0;
      petTravelFinishTimer = setTimeout(() => {
        petTravelFinishTimer = 0;
        if (homeAnimation.action === action && els.roomStage.dataset.petTravelAction === action) {
          els.roomStage.dataset.petTravel = `${action}-arrived`;
        }
      }, travel.duration + 80);
    });
  });
  return true;
}

function applyPetPlacement(scene) {
  const placement = petPlacementForScene(scene);
  if (!placement) return;
  if (pendingPetTravelAction === scene && startPetTravel(scene, placement)) {
    pendingPetTravelAction = '';
    return;
  }
  if (els.roomStage.dataset.petTravelAction && els.roomStage.dataset.petTravelAction !== scene) {
    resetPetTravelState();
  }
  setPetPlacementVars(placement);
}

function cameraZoneForScene(scene) {
  const task = interactionTask(scene);
  const zone = task ? HOME_SCENE.interactionSystem?.zones?.[task.zone] : null;
  return zone?.camera
    || HOME_SCENE.expandedHouse?.actionCamera?.[scene]
    || HOME_SCENE.expandedHouse?.defaultCamera
    || 'living';
}

function applyCamera(scene) {
  if (!els.roomWorld || !HOME_SCENE.expandedHouse?.enabled) return;
  const cameraName = cameraZoneForScene(scene);
  const stop = HOME_SCENE.expandedHouse.cameraStops?.[cameraName]
    || HOME_SCENE.expandedHouse.cameraStops?.[HOME_SCENE.expandedHouse.defaultCamera]
    || { x: 0 };
  const viewportWidth = Number(HOME_SCENE.expandedHouse.viewportWidth || 1080);
  const scale = els.roomStage.clientWidth / viewportWidth;
  const worldWidth = (Number(HOME_SCENE.expandedHouse.worldWidth || 2160) * scale);
  const maxOffset = Math.max(0, worldWidth - els.roomStage.clientWidth);
  const offset = Math.max(0, Math.min(maxOffset, Number(stop.x || 0) * scale));
  els.roomWorld.style.setProperty('--camera-x', `${-offset}px`);
  els.roomStage.dataset.camera = cameraName;
}

function applyCarePose(scene) {
  const pose = HOME_SCENE.specialPoses?.[scene];
  els.roomStage.dataset.hasCarePose = pose ? 'true' : 'false';
  if (!els.carePose) return Boolean(pose);
  if (!pose?.src) {
    els.carePose.removeAttribute('src');
    return false;
  }
  const nextSrc = new URL(pose.src, window.location.href).href;
  if (els.carePose.src !== nextSrc) els.carePose.src = nextSrc;
  els.carePose.style.setProperty('--care-pose-width', pose.width || '240px');
  els.carePose.style.setProperty('--care-pose-bottom', pose.bottom || '18px');
  els.carePose.style.setProperty('--care-pose-left', pose.left || '50%');
  return true;
}

function applyActionComposite(scene, rig = activeSceneRig(scene)) {
  const composite = HOME_SCENE.actionComposites?.[scene];
  if (!els.actionComposite) return;
  const hasActionRoom = Boolean(HOME_SCENE.actionRooms?.[scene]);
  if (rig?.runtime?.disableActionComposite) {
    els.roomStage.dataset.hasActionRoom = hasActionRoom ? 'true' : 'false';
    els.roomStage.dataset.hasComposite = 'false';
    els.roomStage.dataset.compositeObject = '';
    return;
  }
  els.roomStage.dataset.hasActionRoom = hasActionRoom ? 'true' : 'false';
  els.roomStage.dataset.hasComposite = composite && !hasActionRoom ? 'true' : 'false';
  els.roomStage.dataset.compositeObject = composite?.objectId || '';
  if (composite?.src) {
    const nextSrc = new URL(composite.src, window.location.href).href;
    if (els.actionComposite.src !== nextSrc) els.actionComposite.src = nextSrc;
  }
  const object = (HOME_SCENE.objects || []).find((item) => item.id === composite?.objectId);
  const slot = object ? HOME_SCENE.roomLayout?.slots?.[object.slot || object.action] : null;
  if (slot || composite?.slot) {
    for (const [key, value] of Object.entries({ ...slot, ...(composite.slot || {}) })) {
      const cssName = `--composite-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
      els.actionComposite.style.setProperty(cssName, String(value));
    }
  }
}

function resetRoomScroll() {
  if (els.roomStage) {
    els.roomStage.scrollLeft = 0;
    els.roomStage.scrollTop = 0;
  }
  if (els.roomWorld) {
    els.roomWorld.scrollLeft = 0;
    els.roomWorld.scrollTop = 0;
  }
}

function renderScene(life = lastLife) {
  const scene = currentScene(life);
  const task = interactionTask(scene);
  resetRoomScroll();
  els.roomStage.dataset.scene = scene;
  els.roomStage.dataset.task = task ? scene : '';
  els.roomStage.dataset.zone = task?.zone || '';
  els.roomStage.dataset.hasCarePose = 'false';
  const rig = renderSceneRig(scene);
  applyActionComposite(scene, rig);
  applyPetPlacement(scene || 'default');
  applyCamera(scene || '');
  setRoomScene(roomSceneForLife(life));
  for (const hotspot of els.hotspots) {
    hotspot.classList.toggle('active', Boolean(scene && hotspot.dataset.action === scene));
  }
}

function applyHomeCharacterMode() {
  const character = HOME_SCENE.homeCharacter || {};
  const mode = character.mode || 'sprite-canvas';
  els.roomStage.dataset.homeCharacterMode = mode;
  if (els.petCutout && character.cutout) {
    const nextSrc = new URL(character.cutout, window.location.href).href;
    if (els.petCutout.src !== nextSrc) els.petCutout.src = nextSrc;
  }
}

function drawPet(now = performance.now()) {
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  if (activeSceneRig(currentScene())?.runtime?.disablePetCanvas) return;
  if (!sprite.complete || !sprite.naturalWidth) return;
  if (homeAnimation.until && Date.now() > homeAnimation.until) {
    homeAnimation = { stateName: 'idle', action: '', until: 0, startedAt: now };
    setRoomEffect('');
    stopSceneObjectInteraction();
    resetPetTravelState();
    renderScene();
  }
  const stateName = HOME_STATES[homeAnimation.stateName] ? homeAnimation.stateName : 'idle';
  const meta = HOME_STATES[stateName];
  const elapsed = Math.max(0, now - homeAnimation.startedAt);
  const frame = Math.floor(elapsed / (1000 / meta.fps)) % meta.frames;
  ctx.drawImage(sprite, frame * 192, meta.row * 208, 192, 208, 0, 0, 192, 208);
}

function stopHomeAnimation() {
  homeAnimation = { stateName: 'idle', action: '', until: 0, startedAt: 0 };
  suppressHotspotTipUntil = 0;
  setRoomEffect('');
  stopSceneObjectInteraction();
  resetPetTravelState();
  renderScene();
}

function startHomeAnimation(stateName = 'idle', action = '', duration = 5200) {
  hideTip();
  resetRoomScroll();
  suppressHotspotTipUntil = action && duration > 0 ? Date.now() + duration : 0;
  // 先清理旧的交互定时器，防止叠加
  stopSceneObjectInteraction();
  resetPetTravelState();
  clearActionRoomFrameTimer();
  homeAnimation = {
    stateName: HOME_STATES[stateName] ? stateName : 'idle',
    action,
    until: duration > 0 ? Date.now() + duration : 0,
    startedAt: performance.now(),
  };
  pendingPetTravelAction = petTravelForAction(action) ? action : '';
  setRoomEffect(action, duration);
  startSceneObjectInteraction(action, duration);
  renderScene();
}

function tickPet(now) {
  drawPet(now);
  requestAnimationFrame(tickPet);
}

// 道具 action → hotspot 元素映射
const ACTION_HOTSPOT = {
  feed: document.querySelector('.hotspot-food'),
  bath: document.querySelector('.hotspot-bath'),
  sleep: document.querySelector('.hotspot-bed'),
  play: document.querySelector('.hotspot-toy'),
  pet: document.querySelector('.hotspot-heart'),
  watchAnime: document.querySelector('.hotspot-tv'),
  playSwitch: document.querySelector('.hotspot-switch'),
  buildBlocks: document.querySelector('.hotspot-blocks'),
  study: document.querySelector('.hotspot-study'),
};

function renderNeeds(life) {
  els.needsList.innerHTML = '';
  // 清除所有热区注意力状态
  for (const hs of els.hotspots) {
    hs.classList.remove('needs-attention', 'urgent-attention');
  }
  for (const need of NEEDS) {
    const value = pct(life[need.key]);
    const orb = document.createElement('div');
    orb.className = `need-orb ${need.className}`;
    orb.style.setProperty('--value', value);
    orb.dataset.value = value;
    orb.tabIndex = 0;
    orb.setAttribute('aria-label', `${need.label} ${value}`);
    orb.title = `${need.label} ${value}`;
    const tip = document.createElement('span');
    tip.className = 'need-tip';
    tip.textContent = `${need.label} ${value}`;
    orb.appendChild(tip);
    if (life.lowestNeed?.key === need.key && value < 70) {
      orb.classList.add(value < 42 ? 'need-care' : 'watch');
    }
    els.needsList.appendChild(orb);
  }
  // 驱动热区注意力状态
  if (life.lowestNeed?.key && life.lowestNeed.value < 70) {
    const actionKey = NEEDS.find(n => n.key === life.lowestNeed.key)?.key;
    // need.key → care action 映射
    const needToAction = { satiety: 'feed', cleanliness: 'bath', energy: 'sleep', mood: 'play', affection: 'pet' };
    const action = needToAction[actionKey];
    const hs = action && ACTION_HOTSPOT[action];
    if (hs) {
      hs.classList.add(life.lowestNeed.value < 42 ? 'urgent-attention' : 'needs-attention');
    }
  }
}

function hourEventLine() {
  const hour = new Date().getHours();
  if (homePrefs.visitCount > 1 && Date.now() - Number(homePrefs.lastVisitAt || 0) > 6 * 60 * 60 * 1000) {
    return randomFrom(HOME_EVENT_LINES.comeback);
  }
  if (hour < 6 || hour >= 22) return randomFrom(HOME_EVENT_LINES.night);
  if (hour < 11) return randomFrom(HOME_EVENT_LINES.morning);
  if (hour < 18) return randomFrom(HOME_EVENT_LINES.afternoon);
  return randomFrom(HOME_EVENT_LINES.evening);
}

function showVisitEvent() {
  const line = hourEventLine();
  if (!line) return;
  const lifeBubble = document.getElementById('life-bubble');
  if (lifeBubble) {
    lifeBubble.classList.add('care-bounce');
    lifeBubble.addEventListener('animationend', () => lifeBubble.classList.remove('care-bounce'), { once: true });
  }
  typewriteBubble(line, () => {
    setTimeout(() => {
      if (!currentScene(lastLife)) {
        const fallback = shortBubble(lastLife || { status: 'steady' });
        if (fallback) typewriteBubble(fallback);
        else els.bubble.textContent = fallback;
      }
    }, 4200);
  });
}

function renderProfile(profile = {}) {
  els.profile.level.textContent = Number(profile.level || 1);
  els.profile.intimacy.textContent = Math.round(Number(profile.intimacy || 0));
}

function shortBubble(life) {
  if (life.action && CARE_ACTIONS[life.action]) return CARE_ACTIONS[life.action].homeBubble;
  const actionId = life.redirectedAction || life.recommendedAction;
  if (ACTION_HINTS[actionId]) return ACTION_HINTS[actionId];
  return STATUS_BUBBLES[life.status] || STATUS_BUBBLES.steady;
}

function renderLife(life, { skipAnimation = false } = {}) {
  lastLife = life;
  const status = life.status || 'steady';
  els.shell.dataset.status = status;
  els.bubble.textContent = shortBubble(life);
  if (!skipAnimation && !careInProgress) {
    if (life.action) startHomeAnimation(life.stateName, life.action, life.blocked ? 2800 : 5600);
    else renderScene(life);
  }
  renderNeeds(life);
  renderProfile(life.profile);
}

async function refreshLife() {
  try {
    const life = await window.petApi.getLife();
    renderLife(life);
  } catch (error) {
    els.bubble.textContent = '断线了';
  }
}

async function loadHomePrefs() {
  try {
    const data = await window.petApi.storeLoad();
    homePrefs = {
      ...homePrefs,
      ...(data?.home || {}),
      decor: { ...DECOR_DEFAULTS, ...(data?.home?.decor || {}) },
    };
    selectedRoomScene = ROOM_SCENES[homePrefs.selectedScene] ? homePrefs.selectedScene : '';
    homePrefs.visitCount = Number(homePrefs.visitCount || 0) + 1;
    homePrefs.lastVisitAt = Date.now();
    applyDecor();
    saveHomePrefs();
  } catch {
    applyDecor();
  }
}

function wakeUi() {
  els.shell.classList.remove('idle-ui');
  clearTimeout(uiIdleTimer);
  uiIdleTimer = setTimeout(() => {
    els.shell.classList.add('idle-ui');
  }, 3600);
}

function showTipFor(element) {
  if (
    element?.classList?.contains('room-hotspot')
    && (careInProgress || Date.now() < suppressHotspotTipUntil)
  ) {
    hideTip();
    return;
  }
  const text = element?.dataset?.tip || element?.getAttribute?.('aria-label') || '';
  if (!text) return;
  const stageRect = els.roomStage.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  els.tip.textContent = text;
  els.tip.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
  els.tip.style.top = `${rect.top - stageRect.top}px`;
  els.tip.classList.add('visible');
}

function hideTip() {
  els.tip.classList.remove('visible');
}

function bindTip(element) {
  element.addEventListener('pointerenter', () => showTipFor(element));
  element.addEventListener('pointermove', () => showTipFor(element));
  element.addEventListener('pointerleave', hideTip);
  element.addEventListener('mouseenter', () => showTipFor(element));
  element.addEventListener('mousemove', () => showTipFor(element));
  element.addEventListener('mouseleave', hideTip);
  element.addEventListener('focus', () => showTipFor(element));
  element.addEventListener('blur', hideTip);
}

function hideHomeIntent() {
  pendingHomeIntent = '';
  if (!els.intentPopover) return;
  els.intentPopover.hidden = true;
  els.intentPopover.setAttribute('aria-hidden', 'true');
}

function positionHomeIntent(anchor) {
  if (!els.intentPopover || !anchor) return;
  const stageRect = els.roomStage.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(138, Math.min(stageRect.width - 160, rect.left - stageRect.left + rect.width / 2));
  const top = Math.max(88, Math.min(stageRect.height - 170, rect.top - stageRect.top - 18));
  els.intentPopover.style.left = `${left}px`;
  els.intentPopover.style.top = `${top}px`;
}

function resolveHomeIntent(action, anchor) {
  if (!action || careInProgress) return;
  resetRoomScroll();
  wakeUi();
  hideTip();
  pendingHomeIntent = action;
  const copy = HOME_INTENT_COPY[action] || {
    title: CARE_ACTIONS[action]?.label || '看看这里',
    detail: '先看看 Yoyo 的状态，再决定要不要行动。',
    confirm: '开始',
  };
  if (els.intentTitle) els.intentTitle.textContent = copy.title;
  if (els.intentDetail) els.intentDetail.textContent = copy.detail;
  if (els.intentConfirm) els.intentConfirm.textContent = copy.confirm;
  if (els.intentPopover) {
    els.intentPopover.hidden = false;
    els.intentPopover.setAttribute('aria-hidden', 'false');
    positionHomeIntent(anchor || ACTION_HOTSPOT[action]);
  }
  typewriteBubble(copy.title);
}

function confirmHomeIntent() {
  const action = pendingHomeIntent;
  hideHomeIntent();
  if (action) care(action);
}

function renderCompanionActions() {
  const dock = document.getElementById('care-actions');
  if (!dock || dock.hidden) return;
  dock.innerHTML = '';
  const actions = DEFAULT_ACTIONS.filter((action) => COMPANION_ACTIONS.includes(action.id));
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `companion-action ${action.recommended ? 'recommended' : ''}`.trim();
    button.dataset.action = action.id;
    button.dataset.tip = action.label;
    button.setAttribute('aria-label', action.label);

    const visual = document.createElement('span');
    visual.className = `action-visual ${action.icon}`;
    visual.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'action-label';
    label.textContent = action.label;

    button.append(visual, label);
    button.addEventListener('click', () => care(action.id));
    bindTip(button);
    dock.appendChild(button);
  }
}

async function care(action) {
  if (!action || careInProgress) return;
  careInProgress = true;
  hideHomeIntent();
  hideTip();
  document.activeElement?.blur?.();
  // 先禁用热区，防止重复点击
  for (const hs of els.hotspots) hs.style.pointerEvents = 'none';
  const lifeBubble = document.getElementById('life-bubble');
  // 先播气泡反馈（轻量，不涉及动画状态）
  if (lifeBubble) {
    lifeBubble.classList.remove('care-bounce');
    void lifeBubble.offsetWidth;
    lifeBubble.classList.add('care-bounce');
    lifeBubble.addEventListener('animationend', () => lifeBubble.classList.remove('care-bounce'), { once: true });
  }
  typewriteBubble(CARE_ACTIONS[action]?.homeBubble || '好呀');
  try {
    // API 先行——拿到真实状态再决定动画
    const life = await window.petApi.careForYoyo({
      actionId: action,
      source: 'home',
      suppressFinalEffect: true,
    });
    if (life.ok === false) {
      // blocked：用返回的状态播提示动画，不播 care 动画
      typewriteBubble(life.message || '还不行哦…');
      if (life.stateName) {
        startHomeAnimation(life.stateName, '', 2800);
      } else {
        stopHomeAnimation();
      }
      return;
    }
    // 成功：播 care 动画
    const task = interactionTask(action);
    startHomeAnimation(task?.yoyoState || life.stateName || CARE_ACTIONS[action]?.stateName || 'idle', action, 5200);
    renderLife(life, { skipAnimation: true });
    const followLines = CARE_FOLLOWUP_LINES[action];
    if (followLines) {
      setTimeout(() => {
        if (lifeBubble) {
          lifeBubble.classList.remove('care-bounce');
          void lifeBubble.offsetWidth;
          lifeBubble.classList.add('care-bounce');
          lifeBubble.addEventListener('animationend', () => lifeBubble.classList.remove('care-bounce'), { once: true });
        }
        typewriteBubble(randomFrom(followLines));
      }, 2400);
    }
  } catch (error) {
    typewriteBubble('失败了…');
    stopHomeAnimation();
  } finally {
    careInProgress = false;
    for (const hs of els.hotspots) hs.style.pointerEvents = '';
  }
}

sprite.onload = () => drawPet();
sprite.src = new URL('../assets/yoyo/spritesheet.webp', window.location.href).href;

renderHomeSceneObjects();
applyHomeCharacterMode();
renderScene();
renderCompanionActions();

for (const scene of Object.values(ROOM_SCENES)) {
  const img = new Image();
  img.src = new URL(scene.asset, window.location.href).href;
}

for (const hotspot of els.hotspots) {
  hotspot.addEventListener('click', () => resolveHomeIntent(hotspot.dataset.action, hotspot));
  bindTip(hotspot);
}
for (const button of els.sceneButtons) {
  button.addEventListener('click', () => chooseRoomScene(button.dataset.roomScene));
  bindTip(button);
}
for (const button of els.decorButtons) {
  button.addEventListener('click', () => toggleDecor(button.dataset.decor));
  bindTip(button);
}

// ctrl-panel 开关
if (els.ctrlToggle && els.ctrlPanel) {
  els.ctrlToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = els.ctrlPanel.classList.toggle('open');
    els.ctrlPanel.setAttribute('aria-hidden', String(!open));
    els.ctrlToggle.classList.toggle('active', open);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#room-controls')) {
      els.ctrlPanel.classList.remove('open');
      els.ctrlPanel.setAttribute('aria-hidden', 'true');
      els.ctrlToggle.classList.remove('active');
    }
  });
}

els.intentConfirm?.addEventListener('click', confirmHomeIntent);
els.intentCancel?.addEventListener('click', hideHomeIntent);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideHomeIntent();
});
document.addEventListener('click', (event) => {
  if (
    els.intentPopover
    && !els.intentPopover.hidden
    && !event.target.closest('#home-intent-popover')
    && !event.target.closest('.room-hotspot')
  ) {
    hideHomeIntent();
  }
});

for (const eventName of ['mousemove', 'pointerdown', 'keydown', 'focusin']) {
  window.addEventListener(eventName, wakeUi, { passive: true });
}
els.refresh.addEventListener('click', refreshLife);
bindTip(els.refresh);
if (window.petApi?.onLifeChanged) {
  window.petApi.onLifeChanged((life) => renderLife(life));
}

loadHomePrefs()
  .then(refreshLife)
  .then(showVisitEvent);
wakeUi();
requestAnimationFrame(tickPet);

// ====================================================================
// 演唱会：Let it Go
// ====================================================================
(function initConcert() {
  const btn = document.getElementById('concert-launcher');
  if (!btn) return;

  const LYRICS = [
    '♪ The snow glows white on the mountain tonight~',
    '♪ Not a footprint to be seen~',
    '♪ A kingdom of isolation~',
    '♪ And it looks like I\'m the queen~',
    '♪ Let it go, let it go~',
    '♪ Can\'t hold it back anymore~',
    '♪ Let it go, let it go~',
    '♪ Turn away and slam the door~',
    '♪ I don\'t care what they\'re going to say~',
    '♪ Let the storm rage on~',
    '♪ The cold never bothered me anyway~ ✨',
  ];

  let concertActive = false;
  let lyricIndex = 0;
  let lyricTimer = null;
  let snowInterval = null;
  const stage = document.querySelector('.room-stage');

  function createSnowflake() {
    const flake = document.createElement('span');
    flake.className = 'concert-snow';
    flake.textContent = ['❄️', '⭐', '✨', '💎'][Math.floor(Math.random() * 4)];
    flake.style.left = Math.random() * 100 + '%';
    flake.style.animationDuration = (2 + Math.random() * 3) + 's';
    flake.style.fontSize = (12 + Math.random() * 14) + 'px';
    stage.appendChild(flake);
    flake.addEventListener('animationend', () => flake.remove());
  }

  function startConcert() {
    if (concertActive) return;
    concertActive = true;
    lyricIndex = 0;
    btn.disabled = true;

    stage.classList.add('concert-mode');
    startHomeAnimation('concert', 'concert', 0); // duration=0 → 持续播放

    // 歌词滚动
    function showNextLyric() {
      if (lyricIndex >= LYRICS.length) {
        endConcert();
        return;
      }
      typewriteBubble(LYRICS[lyricIndex]);
      lyricIndex++;
      lyricTimer = setTimeout(showNextLyric, 3200);
    }
    showNextLyric();

    // 雪花粒子
    snowInterval = setInterval(createSnowflake, 400);
  }

  function endConcert() {
    concertActive = false;
    clearTimeout(lyricTimer);
    clearInterval(snowInterval);
    stage.classList.remove('concert-mode');
    startHomeAnimation('clapping', '', 3000);
    typewriteBubble('谢谢大家！Yoyo爱你们！🎤✨');
    setTimeout(() => {
      btn.disabled = false;
      startHomeAnimation('idle', '', 0);
    }, 3500);
  }

  btn.addEventListener('click', startConcert);
  bindTip(btn);
})();

// ====================================================================
// 换装系统
// ====================================================================
(function initWardrobe() {
  const ACCESSORIES = {
    hat: [
      { id: 'hat_crown',    emoji: '👑', label: '皇冠',   unlockAt: 0,   pos: { top: '-14px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'hat_catears',  emoji: '🐱', label: '猫耳',   unlockAt: 0,   pos: { top: '-8px',  left: '50%', transform: 'translateX(-50%)' } },
      { id: 'hat_halo',     emoji: '😇', label: '光环',   unlockAt: 20,  pos: { top: '-12px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'hat_santa',    emoji: '🎅', label: '圣诞帽', unlockAt: 50,  pos: { top: '-10px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'hat_ribbon',   emoji: '🎀', label: '蝴蝶结', unlockAt: 100, pos: { top: '-6px',  left: '50%', transform: 'translateX(-50%)' } },
    ],
    face: [
      { id: 'face_happy',   emoji: '😊', label: '开心脸', unlockAt: 0,   pos: { top: '28px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'face_heart',   emoji: '🥰', label: '爱心眼', unlockAt: 10,  pos: { top: '28px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'face_shy',     emoji: '😳', label: '害羞脸', unlockAt: 30,  pos: { top: '28px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'face_sparkle', emoji: '🤩', label: '闪亮眼', unlockAt: 80,  pos: { top: '28px', left: '50%', transform: 'translateX(-50%)' } },
    ],
    clothes: [
      { id: 'clothes_bow',      emoji: '🎀', label: '领结',   unlockAt: 0,   pos: { top: '68px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'clothes_hoodie',   emoji: '🧥', label: '连帽衫', unlockAt: 15,  pos: { top: '62px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'clothes_sweater',  emoji: '👕', label: '毛衣',   unlockAt: 40,  pos: { top: '62px', left: '50%', transform: 'translateX(-50%)' } },
      { id: 'clothes_dress',    emoji: '👗', label: '裙子',   unlockAt: 70,  pos: { top: '62px', left: '50%', transform: 'translateX(-50%)' } },
    ],
    hair: [
      { id: 'hair_flower',   emoji: '🌸', label: '小花',   unlockAt: 0,   pos: { top: '4px', left: '72%' } },
      { id: 'hair_starclip', emoji: '⭐', label: '星星夹', unlockAt: 25,  pos: { top: '4px', left: '72%' } },
      { id: 'hair_pearlpin', emoji: '🔮', label: '珍珠发饰', unlockAt: 60, pos: { top: '4px', left: '72%' } },
    ],
  };

  const drawer = document.getElementById('wardrobe-drawer');
  const launcherBtn = document.getElementById('wardrobe-launcher');
  const closeBtn = document.getElementById('wardrobe-close');
  const tabsEl = document.getElementById('wardrobe-tabs');
  const gridEl = document.getElementById('wardrobe-grid');
  const resetBtn = document.getElementById('wardrobe-reset');
  const accessoryLayer = document.getElementById('accessory-layer');

  if (!drawer || !launcherBtn || !gridEl || !accessoryLayer) return;

  let currentTab = 'hat';
  // equipped: { hat: id|null, face: id|null, clothes: id|null, hair: id|null }
  let equipped = { hat: null, face: null, clothes: null, hair: null };
  let currentIntimacy = 0;

  // 读取已保存的配件
  async function loadEquipped() {
    try {
      const data = await window.petApi.storeLoad();
      const saved = data?.wardrobe?.equipped;
      if (saved) equipped = { hat: null, face: null, clothes: null, hair: null, ...saved };
    } catch {}
    renderAccessoryLayer();
  }

  async function saveEquipped() {
    try {
      await window.petApi.storeSet('wardrobe', { equipped });
    } catch {}
  }

  function findAccessory(id) {
    for (const items of Object.values(ACCESSORIES)) {
      const found = items.find(a => a.id === id);
      if (found) return found;
    }
    return null;
  }

  function renderAccessoryLayer() {
    accessoryLayer.innerHTML = '';
    for (const [, id] of Object.entries(equipped)) {
      if (!id) continue;
      const acc = findAccessory(id);
      if (!acc) continue;
      const span = document.createElement('span');
      span.className = 'accessory-item';
      span.textContent = acc.emoji;
      span.title = acc.label;
      Object.assign(span.style, acc.pos);
      accessoryLayer.appendChild(span);
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    const items = ACCESSORIES[currentTab] || [];
    for (const acc of items) {
      const locked = acc.unlockAt > currentIntimacy;
      const active = equipped[currentTab] === acc.id;
      const btn = document.createElement('button');
      btn.className = 'wacc-btn' + (active ? ' active' : '') + (locked ? ' locked' : '');
      btn.title = locked ? `亲密度 ${acc.unlockAt} 解锁` : acc.label;
      btn.innerHTML = `<span class="wacc-emoji">${acc.emoji}</span><span class="wacc-label">${acc.label}</span>${locked ? `<span class="wacc-lock">🔒${acc.unlockAt}</span>` : ''}`;
      if (!locked) {
        btn.addEventListener('click', () => {
          equipped[currentTab] = active ? null : acc.id;
          saveEquipped();
          renderGrid();
          renderAccessoryLayer();
          typewriteBubble(active ? '好的，摘掉啦～' : randomFrom(['好可爱！', '哇！Yoyo变漂亮了！', '喜欢！']));
        });
      }
      gridEl.appendChild(btn);
    }
  }

  // 标签切换
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.wtab');
    if (!btn) return;
    tabsEl.querySelectorAll('.wtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderGrid();
  });

  // 清除配件
  resetBtn.addEventListener('click', () => {
    equipped = { hat: null, face: null, clothes: null, hair: null };
    saveEquipped();
    renderGrid();
    renderAccessoryLayer();
    typewriteBubble('嗯…回到素颜啦～');
  });

  // 开关抽屉
  launcherBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = drawer.classList.toggle('open');
    drawer.setAttribute('aria-hidden', String(!open));
    if (open) renderGrid();
  });
  closeBtn.addEventListener('click', () => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#wardrobe-drawer') && !e.target.closest('#wardrobe-launcher')) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
  });

  // 亲密度更新时重渲格子（解锁新配件）
  if (window.petApi?.onLifeChanged) {
    window.petApi.onLifeChanged((life) => {
      currentIntimacy = Math.round(Number(life?.profile?.intimacy || 0));
      if (drawer.classList.contains('open')) renderGrid();
    });
  }

  loadEquipped();
})();
