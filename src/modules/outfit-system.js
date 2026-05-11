// outfit-system.js - 换装系统（SVG 图片叠加渲染）
import { state, say, playSound } from './core-state.js';
import { set } from './store-client.js';

// ===== 配件目录（仅保留元数据，不含 draw 函数）=====
export const ACCESSORY_CATALOG = {
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
    { id: 'scarf',   name: '围巾',    unlock: 'default' },
    { id: 'glasses', name: '圆眼镜',  unlock: 'pet_50' },
    { id: 'wings',   name: '天使翅膀', unlock: 'level_5' },
    { id: 'bow',     name: '领结',    unlock: 'streak_14' },
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

// ===== 配件相对于精灵中心的偏移量（canvas 像素）=====
// petCY ≈ 81.25，头顶 ≈ y37，眼部 ≈ y47，颈部 ≈ y72
const ACCESSORY_OFFSETS = {
  hat:       { x: 0, y: -44 },   // 帽子中心：朝头顶
  face:      { x: 0, y: -34 },   // 表情中心：朝眼部
  accessory: { x: 0, y: -10 },   // 配饰中心：颈肩区
};

// ===== 图片缓存 =====
const _imgCache = {};

const ACC_BASE = '../assets/accessories';

function _getImg(category, id) {
  const key = `${category}_${id}`;
  if (!_imgCache[key]) {
    const img = new Image();
    img.src = `${ACC_BASE}/${key}.svg`;
    _imgCache[key] = img;
  }
  return _imgCache[key];
}

/** 启动时预加载所有配件图片 */
function preloadAll() {
  for (const [cat, items] of Object.entries(ACCESSORY_CATALOG)) {
    for (const item of items) {
      if (item.id !== 'none') _getImg(cat, item.id);
    }
  }
}

// ===== 存取 =====
function saveOutfit() {
  set('outfit', state.currentOutfit);
}

function equipItem(category, itemId) {
  state.currentOutfit[category] = itemId;
  saveOutfit();
}

// ===== 绘制所有已装备配件 =====
export function drawEquippedAccessories(drawCtx, cx, cy, scale) {
  for (const category of ['accessory', 'hat', 'face']) {
    const itemId = state.currentOutfit[category];
    if (!itemId || itemId === 'none') continue;
    const img = _getImg(category, itemId);
    if (!img.complete || !img.naturalWidth) continue;
    const offset = ACCESSORY_OFFSETS[category];
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    drawCtx.drawImage(img, cx + offset.x - w / 2, cy + offset.y - h / 2, w, h);
  }
}

// ===== 季节自动换装 =====
function checkSeasonalOutfit() {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month === 1 || month === 2) {
    if (state.currentOutfit.hat === 'none' || state.currentOutfit.hat === 'ribbon') {
      equipItem('hat', 'santa');
    }
  }
}

// ===== 初始化 =====
export function initOutfitSystem() {
  preloadAll();
  checkSeasonalOutfit();

  window.petApi.onOutfitChange((category, itemId) => {
    equipItem(category, itemId);
    const catalog = ACCESSORY_CATALOG[category];
    const item = catalog ? catalog.find(i => i.id === itemId) : null;
    say(`换上${item ? item.name : '新装'}啦~`);
    playSound('giggle');
  });

  window.petApi.onOutfitRandom(() => {
    const categories = ['hat', 'accessory', 'face'];
    for (const cat of categories) {
      const items = ACCESSORY_CATALOG[cat].filter(i => i.id !== 'none');
      const random = items[Math.floor(Math.random() * items.length)];
      state.currentOutfit[cat] = random.id;
    }
    saveOutfit();
    say('随机搭配完成！好看吗~');
    playSound('giggle');
  });

  window.petApi.onOutfitReset(() => {
    state.currentOutfit = { hat: 'none', accessory: 'none', face: 'none' };
    saveOutfit();
    say('已经全部脱下啦~');
  });
}
