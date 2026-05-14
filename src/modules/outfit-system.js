// outfit-system.js - 分层换装 spritesheet
import { state, say, playSound, localFileUrl } from './core-state.js';
import { set } from './store-client.js';
import { logOutfitLayers } from './debug-log.js';

// ===== 目录 =====
// 所有换装项都使用预生成好的透明图层 spritesheet，避免运行时用固定锚点贴 SVG 导致动作帧漂移。
export const ACCESSORY_CATALOG = {
  hair: [
    { id: 'none',    name: '无' },
    { id: 'flower',  name: '小花发夹', unlock: 'default' },
    { id: 'starclip', name: '星星发卡', unlock: 'default' },
    { id: 'pearlpin', name: '珍珠发针', unlock: 'level_3' },
  ],
  hat: [
    { id: 'none',    name: '无' },
    { id: 'ribbon',  name: '蝴蝶结',  unlock: 'default' },
    { id: 'crown',   name: '花冠',    unlock: 'level_3' },
    { id: 'catears', name: '猫耳',    unlock: 'streak_7' },
    { id: 'santa',   name: '圣诞帽',  unlock: 'season_winter' },
    { id: 'halo',    name: '光环',    unlock: 'level_5' },
  ],
  accessory: [
    { id: 'none',    name: '无' },
    { id: 'bow',     name: '红领结',  unlock: 'default' },
    { id: 'scarf',   name: '彩虹围巾', unlock: 'default' },
    { id: 'wings',   name: '小翅膀',  unlock: 'level_5' },
    { id: 'butterfly_wings', name: '蝴蝶翅膀', unlock: 'default' },
    { id: 'devil_wings', name: '小恶魔翼', unlock: 'default' },
    { id: 'jetpack', name: '喷气背包', unlock: 'default' },
    { id: 'star_backpack', name: '星星背包', unlock: 'default' },
  ],
  clothes: [
    { id: 'none',    name: '无' },
    { id: 'hoodie',  name: '蓝色卫衣', unlock: 'default' },
    { id: 'dress',   name: '粉色裙子', unlock: 'default' },
    { id: 'cape',    name: '小披风',   unlock: 'streak_7' },
    { id: 'sweater', name: '暖暖毛衣', unlock: 'season_winter' },
    { id: 'party',   name: '派对套装', unlock: 'dance_5' },
    { id: 'angel',   name: '天使套装', unlock: 'level_5' },
  ],
  face: [
    { id: 'none',    name: '默认' },
    { id: 'happy',   name: '开心',    unlock: 'default' },
    { id: 'shy',     name: '害羞',    unlock: 'default' },
    { id: 'sparkle', name: '星星眼',  unlock: 'dance_5' },
    { id: 'heart',   name: '爱心眼',  unlock: 'streak_30' },
    { id: 'sleepy',  name: '困困',    unlock: 'default' },
  ],
};

const OUTFIT_DEFAULTS = { hair: 'none', hat: 'none', accessory: 'none', clothes: 'none', face: 'none' };

const BASE_SPRITESHEET_VARIANTS = {
  face: {
    happy: 'spritesheet_face_happy.webp',
    shy: 'spritesheet_face_shy.webp',
    sparkle: 'spritesheet_face_sparkle.webp',
    heart: 'spritesheet_face_heart.webp',
    sleepy: 'spritesheet_face_sleepy.webp',
  },
  hair: {
    flower: 'spritesheet_hair_flower.webp',
    starclip: 'spritesheet_hair_starclip.webp',
    pearlpin: 'spritesheet_hair_pearlpin.webp',
  },
  hat: {
    ribbon: 'spritesheet_hat_ribbon.webp',
    crown: 'spritesheet_hat_crown.webp',
    catears: 'spritesheet_hat_catears.webp',
    santa: 'spritesheet_hat_santa.webp',
    halo: 'spritesheet_hat_halo.webp',
  },
  accessory: {
    bow: 'spritesheet_accessory_bow.webp',
    scarf: 'spritesheet_accessory_scarf.webp',
    wings: 'spritesheet_accessory_wings.webp',
    butterfly_wings: 'spritesheet_accessory_butterfly_wings.webp',
    devil_wings: 'spritesheet_accessory_devil_wings.webp',
    jetpack: 'spritesheet_accessory_jetpack.webp',
    star_backpack: 'spritesheet_accessory_star_backpack.webp',
  },
  clothes: {
    hoodie: 'spritesheet_clothes_hoodie.webp',
    dress: 'spritesheet_clothes_dress.webp',
    cape: 'spritesheet_clothes_cape.webp',
    sweater: 'spritesheet_clothes_sweater.webp',
    party: 'spritesheet_party.webp',
    angel: 'spritesheet_angel.webp',
  },
};

const LAYER_SPRITESHEETS = {
  hair: BASE_SPRITESHEET_VARIANTS.hair,
  hat: BASE_SPRITESHEET_VARIANTS.hat,
  accessory: BASE_SPRITESHEET_VARIANTS.accessory,
  clothes: BASE_SPRITESHEET_VARIANTS.clothes,
};

const BEHIND_LAYERS = {
  accessory: {
    wings: 'spritesheet_accessory_wings.webp',
    butterfly_wings: 'spritesheet_accessory_butterfly_wings.webp',
    devil_wings: 'spritesheet_accessory_devil_wings.webp',
    jetpack: 'spritesheet_accessory_jetpack.webp',
    star_backpack: 'spritesheet_accessory_star_backpack.webp',
  },
  clothes: {
    party: 'spritesheet_party_behind.webp',
    angel: 'spritesheet_angel_behind.webp',
  },
};

const BACK_ACCESSORY_IDS = new Set([
  'wings',
  'butterfly_wings',
  'devil_wings',
  'jetpack',
  'star_backpack',
]);

const DRAW_ORDER = [
  { category: 'accessory', position: 'behind' },
  { category: 'clothes', position: 'behind' },
  { category: 'clothes', position: 'front' },
  { category: 'accessory', position: 'front' },
  { category: 'hat', position: 'front' },
  { category: 'hair', position: 'front' },
];

function siblingSpritesheet(fileName) {
  if (!state.currentPet || !fileName) return state.currentPet?.spritesheetPath;
  return state.currentPet.spritesheetPath.replace(/[^/\\]+$/, fileName);
}

function getVariantSpritesheetPath() {
  if (!state.currentPet) return '';
  // 表情不再切换整张 face spritesheet。固定使用原始底图，再由 render-engine 根据情绪算法实时绘制脸部。
  return state.currentPet.spritesheetPath;
}

function buildLayerDescriptors(outfit = state.currentOutfit) {
  if (!state.currentPet) return [];
  const layers = [];
  for (const entry of DRAW_ORDER) {
    const itemId = outfit[entry.category];
    if (!itemId || itemId === 'none') continue;
    if (entry.category === 'accessory') {
      const isBackAccessory = BACK_ACCESSORY_IDS.has(itemId);
      if (entry.position === 'front' && isBackAccessory) continue;
      if (entry.position === 'behind' && !isBackAccessory) continue;
    }
    const file = entry.position === 'behind'
      ? BEHIND_LAYERS[entry.category]?.[itemId]
      : LAYER_SPRITESHEETS[entry.category]?.[itemId];
    if (!file) continue;
    layers.push({
      category: entry.category,
      itemId,
      position: entry.position,
      file,
      path: siblingSpritesheet(file),
    });
  }
  return layers;
}

function loadImageLayer(layer) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ...layer, image: img });
    img.onerror = () => resolve(null);
    img.src = localFileUrl(layer.path);
  });
}

async function applyOutfitLayers() {
  const descriptors = buildLayerDescriptors();
  const loaded = await Promise.all(descriptors.map(loadImageLayer));
  state.outfitLayerImages = loaded.filter(Boolean);
  logOutfitLayers(state.currentOutfit, descriptors);
}

export function applyOutfitSpritesheet() {
  if (!state.currentPet) return;
  const nextPath = getVariantSpritesheetPath();
  applyOutfitLayers();
  if (!nextPath || state.activeSpritesheetPath === nextPath) return;

  const nextSprite = new Image();
  nextSprite.onload = () => {
    state.sprite = nextSprite;
    state.activeSpritesheetPath = nextPath;
    window.petApi.setActiveSpritesheet(nextPath);
  };
  nextSprite.onerror = () => {
    // 素材缺失时安全回退到默认 spritesheet。
    if (nextPath !== state.currentPet.spritesheetPath) {
      state.currentOutfit.hair = 'none';
      state.currentOutfit.hat = 'none';
      state.currentOutfit.clothes = 'none';
      state.currentOutfit.accessory = 'none';
      state.currentOutfit.face = 'none';
      state.outfitLayerImages = [];
      saveOutfit();
      applyOutfitSpritesheet();
    }
  };
  nextSprite.src = localFileUrl(nextPath);
}

// 兼容旧 import 名称。
export const applyFaceSpritesheet = applyOutfitSpritesheet;

// ===== 存取 =====
function saveOutfit() {
  set('outfit', state.currentOutfit);
}

function equipItem(category, itemId) {
  state.currentOutfit = { ...OUTFIT_DEFAULTS, ...state.currentOutfit };
  if (category === 'face') {
    state.currentOutfit.face = 'none';
    saveOutfit();
    return;
  }
  state.currentOutfit[category] = itemId;
  saveOutfit();
}

function normalizeOutfit() {
  state.currentOutfit = { ...OUTFIT_DEFAULTS, ...state.currentOutfit };
  state.currentOutfit.face = 'none';
}

export function drawOutfitLayers(drawCtx, frame, row, offsetX, offsetY, drawW, drawH, position = 'front') {
  const now = performance.now() / 1000;
  for (const layer of state.outfitLayerImages || []) {
    if (layer.position !== position || !layer.image?.complete) continue;
    const maxCol = Math.floor(layer.image.naturalWidth / 192) - 1;
    const maxRow = Math.floor(layer.image.naturalHeight / 208) - 1;
    if (frame > maxCol || row > maxRow) continue;
    drawCtx.save();
    const cx = offsetX + drawW / 2;
    const cy = offsetY + drawH / 2;
    const isDance = state.stateName === 'dancing';
    const isSwing = state.stateName === 'swing';
    const motionAmp = isDance ? 1 : isSwing ? 0.75 : (state.stateName === 'runningLeft' || state.stateName === 'runningRight') ? 0.45 : 0.18;

    if (layer.category === 'accessory' && ['wings', 'butterfly_wings', 'devil_wings'].includes(layer.itemId)) {
      drawCtx.translate(cx, cy - 8);
      drawCtx.scale(1 + Math.sin(now * 10) * 0.025 * motionAmp, 1 + Math.cos(now * 10) * 0.02 * motionAmp);
      drawCtx.translate(-cx, -(cy - 8));
    } else if (layer.category === 'accessory' && layer.itemId === 'scarf') {
      drawCtx.translate(cx + 6, cy + 2);
      drawCtx.rotate(Math.sin(now * 5.5) * 0.05 * motionAmp);
      drawCtx.translate(-(cx + 6), -(cy + 2));
    } else if (layer.category === 'clothes' && ['cape', 'party', 'angel'].includes(layer.itemId)) {
      drawCtx.translate(cx, cy + 4);
      drawCtx.rotate(Math.sin(now * 4.6) * 0.035 * motionAmp);
      drawCtx.scale(1, 1 + Math.abs(Math.cos(now * 4.6)) * 0.018 * motionAmp);
      drawCtx.translate(-cx, -(cy + 4));
    } else if (layer.category === 'hat' && layer.itemId === 'halo') {
      drawCtx.translate(cx, offsetY + drawH * 0.18 + Math.sin(now * 3.2) * 2.2);
      drawCtx.scale(1 + Math.sin(now * 3.2) * 0.02, 1 + Math.sin(now * 3.2) * 0.02);
      drawCtx.translate(-cx, -(offsetY + drawH * 0.18));
    } else if (layer.category === 'hair') {
      drawCtx.translate(cx, offsetY + drawH * 0.22);
      drawCtx.rotate(Math.sin(now * 4.2) * 0.012 * motionAmp);
      drawCtx.translate(-cx, -(offsetY + drawH * 0.22));
    }

    drawCtx.drawImage(layer.image, frame * 192, row * 208, 192, 208, offsetX, offsetY, drawW, drawH);
    drawCtx.restore();
  }
}

export function drawEquippedAccessories() {
  // 兼容旧调用名。换装现在通过 drawOutfitLayers 分层绘制。
}

// ===== 季节自动换装 =====
function checkSeasonalOutfit() {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month === 1 || month === 2) {
    const hasOutfit = Object.values(state.currentOutfit).some((itemId) => itemId && itemId !== 'none');
    if (!hasOutfit) {
      equipItem('hat', 'santa');
    }
  }
}

// ===== 初始化 =====
export function initOutfitSystem() {
  normalizeOutfit();
  saveOutfit();
  checkSeasonalOutfit();
  applyOutfitSpritesheet();

  window.petApi.onOutfitChange((category, itemId) => {
    equipItem(category, itemId);
    applyOutfitSpritesheet();
    const catalog = ACCESSORY_CATALOG[category];
    const item = catalog ? catalog.find(i => i.id === itemId) : null;
    if (itemId !== 'none') {
      say(`换上${item ? item.name : '新装'}成品啦~`);
    } else {
      say(`换上${item ? item.name : '新装'}啦~`);
    }
    playSound('giggle');
  });

  window.petApi.onOutfitRandom(() => {
    const categories = Object.keys(OUTFIT_DEFAULTS).filter(cat => cat !== 'face');
    state.currentOutfit = { ...OUTFIT_DEFAULTS };
    for (const cat of categories) {
      if (Math.random() > 0.65) continue;
      const items = ACCESSORY_CATALOG[cat].filter(i => i.id !== 'none');
      const random = items[Math.floor(Math.random() * items.length)];
      state.currentOutfit[cat] = random.id;
    }
    if (Object.values(state.currentOutfit).every(itemId => itemId === 'none')) {
      state.currentOutfit.hat = 'ribbon';
    }
    saveOutfit();
    applyOutfitSpritesheet();
    say('随机搭配完成！好看吗~');
    playSound('giggle');
  });

  window.petApi.onOutfitReset(() => {
    state.currentOutfit = { ...OUTFIT_DEFAULTS };
    saveOutfit();
    applyOutfitSpritesheet();
    say('已经全部脱下啦~');
  });
}
