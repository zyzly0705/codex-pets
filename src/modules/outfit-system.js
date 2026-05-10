// outfit-system.js - 换装系统（ACCESSORY_CATALOG + Canvas Path 绘制）
import { state, say, playSound } from './core-state.js';
import { getCurrentSeason } from './weather-seasonal.js';

// ===== 配件目录 =====
export const ACCESSORY_CATALOG = {
  hat: [
    { id: 'none', name: '无', draw: null },
    { id: 'ribbon', name: '蝴蝶结', draw: drawRibbon, unlock: 'default' },
    { id: 'crown', name: '花冠', draw: drawFlowerCrown, unlock: 'level_3' },
    { id: 'catears', name: '猫耳', draw: drawCatEars, unlock: 'streak_7' },
    { id: 'santa', name: '圣诞帽', draw: drawSantaHat, unlock: 'season_winter' },
    { id: 'halo', name: '光环', draw: drawHalo, unlock: 'level_5' },
  ],
  accessory: [
    { id: 'none', name: '无', draw: null },
    { id: 'scarf', name: '围巾', draw: drawScarf, unlock: 'default' },
    { id: 'glasses', name: '圆眼镜', draw: drawGlasses, unlock: 'pet_50' },
    { id: 'wings', name: '天使翅膀', draw: drawWings, unlock: 'level_5' },
    { id: 'bow', name: '领结', draw: drawBowTie, unlock: 'streak_14' },
  ],
  face: [
    { id: 'none', name: '默认', draw: null },
    { id: 'happy', name: '开心', draw: drawFaceHappy, unlock: 'default' },
    { id: 'shy', name: '害羞', draw: drawFaceShy, unlock: 'default' },
    { id: 'sparkle', name: '星星眼', draw: drawFaceSparkle, unlock: 'dance_5' },
    { id: 'heart', name: '爱心眼', draw: drawFaceHeart, unlock: 'streak_30' },
    { id: 'sleepy', name: '困困', draw: drawFaceSleepy, unlock: 'default' },
  ]
};

const ACCESSORY_OFFSETS = {
  hat: { x: 0, y: -38 },
  accessory: { x: 0, y: 5 },
  face: { x: 0, y: -18 },
};

function saveOutfit() {
  localStorage.setItem('yoyo_outfit', JSON.stringify(state.currentOutfit));
}

function equipItem(category, itemId) {
  state.currentOutfit[category] = itemId;
  saveOutfit();
}

// --- 帽子绘制 ---
function drawRibbon(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath(); ctx.ellipse(-8, 0, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, 0, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF1493';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFlowerCrown(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const colors = ['#FFB6C1', '#FFD700', '#DDA0DD', '#87CEEB', '#FFA07A'];
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI + (i / 4) * Math.PI;
    const fx = Math.cos(angle) * 14;
    const fy = Math.sin(angle) * 6;
    ctx.fillStyle = colors[i];
    ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCatEars(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-8, -14); ctx.lineTo(-2, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(8, -14); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(8, -10); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSantaHat(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#CC0000';
  ctx.beginPath(); ctx.moveTo(-14, 4); ctx.quadraticCurveTo(0, -20, 12, -8); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-16, 2, 32, 6);
  ctx.beginPath(); ctx.arc(12, -8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHalo(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5;
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(0, -4, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// --- 配饰绘制 ---
function drawScarf(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const colors = ['#FF6B6B', '#FFA500', '#FFD700', '#4ECDC4', '#45B7D1'];
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = colors[i];
    ctx.beginPath(); ctx.moveTo(-16, i * 3 - 4); ctx.quadraticCurveTo(0, i * 3 - 8, 16, i * 3 - 4); ctx.stroke();
  }
  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(16, 16); ctx.lineTo(10, 16); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawGlasses(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = '#333333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-7, 0, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(-16, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -1); ctx.lineTo(16, -2); ctx.stroke();
  ctx.restore();
}

function drawWings(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalAlpha = 0.6;
  const gradL = ctx.createLinearGradient(-30, 0, -5, 0);
  gradL.addColorStop(0, 'rgba(255,255,255,0)'); gradL.addColorStop(1, 'rgba(255,255,255,0.8)');
  ctx.fillStyle = gradL;
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-20, -14, -28, -4); ctx.quadraticCurveTo(-24, 8, -5, 6); ctx.closePath(); ctx.fill();
  const gradR = ctx.createLinearGradient(30, 0, 5, 0);
  gradR.addColorStop(0, 'rgba(255,255,255,0)'); gradR.addColorStop(1, 'rgba(255,255,255,0.8)');
  ctx.fillStyle = gradR;
  ctx.beginPath(); ctx.moveTo(5, 0); ctx.quadraticCurveTo(20, -14, 28, -4); ctx.quadraticCurveTo(24, 8, 5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBowTie(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#CC0000';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -5); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FF0000';
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- 表情绘制 ---
function drawFaceHappy(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-6, -2, 4, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, -2, 4, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI); ctx.stroke();
  ctx.globalAlpha = 0.4; ctx.fillStyle = 'rgba(255,150,150,1)';
  ctx.beginPath(); ctx.ellipse(-10, 3, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, 3, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFaceShy(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-3, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(9, -2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 4, 3, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(255,130,130,1)';
  ctx.beginPath(); ctx.ellipse(-9, 4, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9, 4, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const sx = cx + r * Math.cos(angle);
    const sy = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath(); ctx.fill();
}

function drawFaceSparkle(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#FFD700';
  drawStar(ctx, -6, -2, 5, 2.5, 5);
  drawStar(ctx, 6, -2, 5, 2.5, 5);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 5, 3, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx, cx, cy, size) {
  const s = size / 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 2);
  ctx.bezierCurveTo(cx - s * 3, cy - s, cx - s, cy - s * 3, cx, cy - s);
  ctx.bezierCurveTo(cx + s, cy - s * 3, cx + s * 3, cy - s, cx, cy + s * 2);
  ctx.closePath(); ctx.fill();
}

function drawFaceHeart(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#FF4081';
  drawHeart(ctx, -6, -2, 5);
  drawHeart(ctx, 6, -2, 5);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 5, 4, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.restore();
}

function drawFaceSleepy(ctx, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(-3, -1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(9, -1); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 6, 4, 5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '8px sans-serif'; ctx.fillStyle = '#9999CC'; ctx.globalAlpha = 0.7;
  ctx.fillText('Z', 12, -6); ctx.fillText('z', 16, -10); ctx.fillText('z', 19, -14);
  ctx.restore();
}

// --- 配件叠加绘制 ---
export function drawEquippedAccessories(drawCtx, cx, cy, scale) {
  for (const category of ['accessory', 'hat', 'face']) {
    const itemId = state.currentOutfit[category];
    if (!itemId || itemId === 'none') continue;
    const catalog = ACCESSORY_CATALOG[category];
    const item = catalog.find(i => i.id === itemId);
    if (!item || !item.draw) continue;
    const offset = ACCESSORY_OFFSETS[category];
    item.draw(drawCtx, cx + offset.x, cy + offset.y, scale);
  }
}

// --- 季节自动换装 ---
function checkSeasonalOutfit() {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month === 1 || month === 2) {
    if (state.currentOutfit.hat === 'none' || state.currentOutfit.hat === 'ribbon') {
      equipItem('hat', 'santa');
    }
  }
}

// --- 初始化换装系统 ---
export function initOutfitSystem() {
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
