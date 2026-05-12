// render-engine.js - Canvas 渲染主循环（drawFrame, 动画帧计算）
import { state, canvas, ctx, bubble, STATES, CELL_W, CELL_H, FEED_SCALE_DURATION, FEED_SCALE_MAX, playSound, reactionState } from './core-state.js';
import { drawOutfitLayers } from './outfit-system.js';
import { getEmotionExpression, yoyoEmotion } from './emotion-system.js';
import { updateSeasonalParticles, drawSeasonalParticles } from './weather-seasonal.js';
import { startupAnim, updateStartupAnimation, drawStartupParticles } from './startup-animation.js';

// ===== 逻辑尺寸（CSS 像素），由 startRenderLoop 初始化 =====
let _logW = 120;
let _logH = 130;
let _currentDpr = window.devicePixelRatio || 1;

// ===== 绘制小星星 =====
function drawSmallStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ===== 跳舞专用演出效果 =====
// spritesheet 里的 dancing 行本身只是有限帧，真正的“舞台感”在渲染时加。
// 这里把动作节奏改成更明确的 let-go 风格编排：开肩、踩点、前冲、收拍。
const DANCE_STEP_MS = 220;
const DANCE_POSES = [
  { x: 0,   y: -2,  rotation: 0.00, scaleX: 1.03, scaleY: 0.98 },
  { x: -10, y: -8,  rotation: -0.18, scaleX: 1.09, scaleY: 0.95 },
  { x: -15, y: -14, rotation: -0.26, scaleX: 0.96, scaleY: 1.08 },
  { x: -6,  y: -6,  rotation: -0.08, scaleX: 1.10, scaleY: 0.94 },
  { x: 0,   y: -18, rotation: 0.02, scaleX: 0.95, scaleY: 1.10 },
  { x: 9,   y: -7,  rotation: 0.12, scaleX: 1.08, scaleY: 0.96 },
  { x: 15,  y: -14, rotation: 0.26, scaleX: 0.96, scaleY: 1.08 },
  { x: 7,   y: -6,  rotation: 0.08, scaleX: 1.10, scaleY: 0.94 },
  { x: 0,   y: -20, rotation: 0.00, scaleX: 0.94, scaleY: 1.11 },
  { x: -12, y: -10, rotation: -0.14, scaleX: 1.08, scaleY: 0.97 },
  { x: 12,  y: -10, rotation: 0.14, scaleX: 1.08, scaleY: 0.97 },
  { x: 0,   y: -4,  rotation: 0.00, scaleX: 1.02, scaleY: 1.00 },
];

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function getDancePose(now) {
  const cycleMs = DANCE_STEP_MS * DANCE_POSES.length;
  const cycle = ((now % cycleMs) + cycleMs) % cycleMs;
  const index = Math.floor(cycle / DANCE_STEP_MS);
  const t = smoothstep((cycle - index * DANCE_STEP_MS) / DANCE_STEP_MS);
  const a = DANCE_POSES[index];
  const b = DANCE_POSES[(index + 1) % DANCE_POSES.length];
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    rotation: mix(a.rotation, b.rotation, t),
    scaleX: mix(a.scaleX, b.scaleX, t),
    scaleY: mix(a.scaleY, b.scaleY, t),
  };
}

function drawMusicNote(ctx, x, y, size, alpha, text, color) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI Symbol", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDanceBackdrop(ctx, cx, baseY, now, logW, logH) {
  const t = now / 1000;
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // 柔和追光灯
  const spotlight = ctx.createRadialGradient(cx, baseY - 62, 8, cx, baseY - 58, 88);
  spotlight.addColorStop(0, 'rgba(255, 244, 170, 0.28)');
  spotlight.addColorStop(0.52, 'rgba(255, 120, 210, 0.12)');
  spotlight.addColorStop(1, 'rgba(120, 190, 255, 0)');
  ctx.fillStyle = spotlight;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 58, Math.min(logW * 0.55, 72), Math.min(logH * 0.58, 82), 0, 0, Math.PI * 2);
  ctx.fill();

  // 舞台地面光圈，随节拍呼吸
  const floorPulse = 1 + Math.sin(t * 6.4) * 0.08;
  ctx.fillStyle = 'rgba(255, 120, 190, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 4, 35 * floorPulse, 8 * floorPulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 背景小彩灯
  const colors = ['#ffd166', '#ff7ab8', '#7bdff2', '#b8f7a1', '#c9a3ff'];
  for (let i = 0; i < 6; i++) {
    const phase = t * 2.1 + i * 1.2;
    const x = cx + Math.sin(phase) * (32 + (i % 3) * 12);
    const y = baseY - 88 + Math.cos(phase * 0.75) * 18 + (i % 2) * 16;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.45 + Math.sin(phase * 1.7) * 0.25;
    drawSmallStar(ctx, x, y, 3 + (i % 2));
  }
  ctx.restore();
}

function drawDanceForeground(ctx, cx, cy, now) {
  const t = now / 1000;
  const notes = ['♪', '♫', '✦', '♡'];
  const colors = ['#ff5fa2', '#5bd8ff', '#ffd166', '#b06cff'];
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const phase = t * 1.25 + i * 0.9;
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + side * (24 + (i % 3) * 10) + Math.sin(phase * 1.3) * 7;
    const y = cy - 40 - ((phase * 14 + i * 9) % 62);
    const alpha = 0.2 + 0.65 * (1 - ((phase * 0.3 + i * 0.17) % 1));
    drawMusicNote(ctx, x, y, 10 + (i % 3) * 2, alpha, notes[i % notes.length], colors[i % colors.length]);
  }
  ctx.restore();
}

// ===== 秋千专用演出效果 =====
const SWING_PERIOD_MS = 1680;
const SWING_MAX_ANGLE = 0.34;

function getSwingPose(now) {
  const cycleIndex = Math.floor(now / SWING_PERIOD_MS) % 8;
  const ramp = [0.42, 0.50, 0.58, 0.68, 0.80, 0.92, 1.0, 0.88][cycleIndex];
  const cycleT = (now % SWING_PERIOD_MS) / SWING_PERIOD_MS;
  const easedT = cycleT + 0.11 * Math.sin(cycleT * Math.PI * 2);
  const phase = easedT * Math.PI * 2;
  const angleWave = Math.sin(phase);
  const angle = angleWave * SWING_MAX_ANGLE * ramp;
  const lift = Math.abs(angleWave);
  const bottomSpeed = Math.pow(Math.max(0, Math.cos(phase)), 1.6);
  const kick = Math.max(0, Math.cos(phase * 2)) * (0.55 + ramp * 0.45);
  return {
    angle,
    x: Math.sin(angle) * (10 + ramp * 8),
    y: -8 - lift * (5 + ramp * 6) + bottomSpeed * 1.2,
    scaleX: 1 + kick * 0.035 + bottomSpeed * 0.02,
    scaleY: 1 - kick * 0.028 - bottomSpeed * 0.01,
    ropeSway: angle * 0.25,
    seatBounce: kick * 2.5 + bottomSpeed * 1.2,
    ramp,
  };
}

function drawSwingBackdrop(ctx, cx, topY, pose) {
  const seatY = topY + 68 + pose.seatBounce;
  const leftSeatX = cx - 19 + pose.x;
  const rightSeatX = cx + 19 + pose.x;

  ctx.save();
  ctx.lineCap = 'round';

  const glow = ctx.createRadialGradient(cx, topY + 26, 8, cx, topY + 34, 88);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.20)');
  glow.addColorStop(0.55, 'rgba(255, 165, 210, 0.10)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, topY + 34, 78, 74, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(121, 86, 57, 0.82)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 34, topY + 2);
  ctx.quadraticCurveTo(cx, topY - 8, cx + 34, topY + 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(244, 213, 150, 0.95)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - 23, topY + 3);
  ctx.lineTo(leftSeatX, seatY);
  ctx.moveTo(cx + 23, topY + 3);
  ctx.lineTo(rightSeatX, seatY);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx + pose.x, seatY);
  ctx.rotate(pose.angle * 0.18);
  ctx.fillStyle = 'rgba(255, 201, 125, 0.96)';
  ctx.strokeStyle = 'rgba(166, 108, 61, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-24, -4, 48, 8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ===== 情绪驱动的“原生脸” =====
// 不再把 face_*.svg 当成固定贴片糊上去；这里在当前动画帧的脸部区域内，先小范围擦除原五官，
// 再按 PAD 情绪 + 即时反应绘制会眨眼、会呼吸、会发光/流泪的五官，让表情跟行为一起变化。
const FACE_ROWS = new Set([0, 3, 5, 6, 7, 8, 11, 12, 15, 20, 21, 22, 23, 24, 25]);
const FACE_ANCHOR = { x: 64, y: 43, width: 64, height: 44 };

function resolveAutoExpression() {
  if (reactionState.whip) {
    if (reactionState.whip.phase === 'hit') return 'crying';
    if (reactionState.whip.phase === 'rub') return 'sad';
    return yoyoEmotion.dominance > 58 ? 'angry' : 'sad';
  }
  if (reactionState.feed) {
    if (reactionState.feed.phase === 'excited') return 'sparkle';
    if (reactionState.feed.phase === 'satisfied') return 'heart';
    return 'happy';
  }
  if (reactionState.pat) {
    if (reactionState.pat.phase === 'purring') return 'heart';
    return reactionState.pat.count >= 2 ? 'shy' : 'happy';
  }
  switch (state.stateName) {
    case 'dancing':
    case 'clapping':
      return 'sparkle';
    case 'bashful':
      return 'shy';
    case 'yawning':
    case 'sleeping':
      return 'sleepy';
    case 'crying':
    case 'failed':
      return 'sad';
    case 'dizzy':
      return 'dizzy';
    case 'gifting':
    case 'petting':
      return 'happy';
    default:
      return getEmotionExpression();
  }
}

function faceRect(offsetX, offsetY, drawW, drawH) {
  const s = drawW / CELL_W;
  return {
    x: offsetX + FACE_ANCHOR.x * s,
    y: offsetY + FACE_ANCHOR.y * s,
    w: FACE_ANCHOR.width * s,
    h: FACE_ANCHOR.height * s,
    s,
  };
}

function eraseNativeFeatures(drawCtx, r) {
  drawCtx.save();
  drawCtx.fillStyle = '#e7a777';
  drawCtx.globalAlpha = 0.92;
  // 只擦五官所在的小区域，避免整块椭圆“补丁感”。
  drawCtx.beginPath();
  drawCtx.ellipse(r.x + r.w * 0.31, r.y + r.h * 0.42, r.w * 0.18, r.h * 0.23, 0, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.69, r.y + r.h * 0.42, r.w * 0.18, r.h * 0.23, 0, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.50, r.y + r.h * 0.70, r.w * 0.24, r.h * 0.18, 0, 0, Math.PI * 2);
  drawCtx.fill();

  // 用半透明暖色羽化边缘，让新五官更像长在脸上。
  drawCtx.globalAlpha = 0.20;
  drawCtx.fillStyle = '#f4bd8e';
  drawCtx.beginPath();
  drawCtx.ellipse(r.x + r.w * 0.50, r.y + r.h * 0.56, r.w * 0.43, r.h * 0.38, 0, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
}

function strokeFace(drawCtx, color, width, cap = 'round') {
  drawCtx.strokeStyle = color;
  drawCtx.lineWidth = width;
  drawCtx.lineCap = cap;
  drawCtx.lineJoin = 'round';
}

function drawArcEye(drawCtx, x, y, w, h, flip = 1) {
  drawCtx.beginPath();
  drawCtx.moveTo(x - w / 2, y);
  drawCtx.quadraticCurveTo(x, y - h * flip, x + w / 2, y);
  drawCtx.stroke();
}

function drawHeart(drawCtx, x, y, size, color) {
  drawCtx.save();
  drawCtx.translate(x, y);
  drawCtx.scale(size / 12, size / 12);
  drawCtx.fillStyle = color;
  drawCtx.beginPath();
  drawCtx.moveTo(0, 4);
  drawCtx.bezierCurveTo(-9, -3, -5, -10, 0, -5);
  drawCtx.bezierCurveTo(5, -10, 9, -3, 0, 4);
  drawCtx.fill();
  drawCtx.restore();
}

function drawStarShape(drawCtx, x, y, r, color) {
  drawCtx.save();
  drawCtx.fillStyle = color;
  drawCtx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) drawCtx.moveTo(px, py); else drawCtx.lineTo(px, py);
  }
  drawCtx.closePath();
  drawCtx.fill();
  drawCtx.restore();
}

function drawBlush(drawCtx, r, intensity = 1) {
  drawCtx.save();
  drawCtx.globalAlpha = 0.30 * intensity;
  drawCtx.fillStyle = '#ff6f9f';
  drawCtx.beginPath();
  drawCtx.ellipse(r.x + r.w * 0.16, r.y + r.h * 0.62, r.w * 0.15, r.h * 0.10, -0.15, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.84, r.y + r.h * 0.62, r.w * 0.15, r.h * 0.10, 0.15, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
}

function drawExpressionFace(drawCtx, row, offsetX, offsetY, drawW, drawH, now) {
  if (!FACE_ROWS.has(row)) return;
  const expr = resolveAutoExpression();
  const r = faceRect(offsetX, offsetY, drawW, drawH);
  const t = now / 1000;
  const beat = 0.5 + Math.sin(t * 6) * 0.5;
  const blink = (now % 4200) > 4040;
  const ink = '#2d1a2e';
  const eyeY = r.y + r.h * 0.40;
  const leftX = r.x + r.w * 0.31;
  const rightX = r.x + r.w * 0.69;
  const mouthX = r.x + r.w * 0.50;
  const mouthY = r.y + r.h * 0.70;
  const lw = Math.max(1.25, r.s * 3.0);

  drawCtx.save();
  eraseNativeFeatures(drawCtx, r);
  strokeFace(drawCtx, ink, lw);

  if (blink && !['sparkle', 'heart', 'crying', 'sad', 'angry', 'dizzy'].includes(expr)) {
    drawArcEye(drawCtx, leftX, eyeY, r.w * 0.18, r.h * 0.03, 1);
    drawArcEye(drawCtx, rightX, eyeY, r.w * 0.18, r.h * 0.03, 1);
  } else if (expr === 'happy') {
    drawArcEye(drawCtx, leftX, eyeY, r.w * 0.20, r.h * 0.15, 1);
    drawArcEye(drawCtx, rightX, eyeY, r.w * 0.20, r.h * 0.15, 1);
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.16, mouthY);
    drawCtx.quadraticCurveTo(mouthX, mouthY + r.h * (0.18 + beat * 0.03), mouthX + r.w * 0.16, mouthY);
    drawCtx.stroke();
    drawBlush(drawCtx, r, 1 + beat * 0.3);
  } else if (expr === 'shy') {
    drawArcEye(drawCtx, leftX, eyeY + r.h * 0.02, r.w * 0.17, r.h * 0.10, 1);
    drawArcEye(drawCtx, rightX, eyeY + r.h * 0.02, r.w * 0.17, r.h * 0.10, 1);
    drawCtx.beginPath();
    drawCtx.arc(mouthX, mouthY + r.h * 0.03, r.w * 0.035, 0, Math.PI * 2);
    drawCtx.stroke();
    drawBlush(drawCtx, r, 1.9);
  } else if (expr === 'sparkle') {
    drawStarShape(drawCtx, leftX, eyeY, r.w * (0.11 + beat * 0.015), '#ffd43b');
    drawStarShape(drawCtx, rightX, eyeY, r.w * (0.11 + beat * 0.015), '#ffd43b');
    strokeFace(drawCtx, '#d99400', Math.max(0.8, r.s * 1.2));
    drawCtx.stroke();
    strokeFace(drawCtx, ink, lw * 0.85);
    drawCtx.beginPath();
    drawCtx.ellipse(mouthX, mouthY + r.h * 0.04, r.w * 0.12, r.h * (0.13 + beat * 0.03), 0, 0, Math.PI * 2);
    drawCtx.fillStyle = '#b83b46';
    drawCtx.fill();
    drawCtx.stroke();
    drawSmallStar(drawCtx, r.x + r.w * 0.02, r.y + r.h * 0.10, r.w * 0.045);
    drawSmallStar(drawCtx, r.x + r.w * 0.98, r.y + r.h * 0.08, r.w * 0.045);
  } else if (expr === 'heart') {
    drawHeart(drawCtx, leftX, eyeY, r.w * (0.20 + beat * 0.02), '#ff4f90');
    drawHeart(drawCtx, rightX, eyeY, r.w * (0.20 + beat * 0.02), '#ff4f90');
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.13, mouthY);
    drawCtx.quadraticCurveTo(mouthX, mouthY + r.h * 0.16, mouthX + r.w * 0.13, mouthY);
    drawCtx.stroke();
    drawBlush(drawCtx, r, 1.6);
  } else if (expr === 'sleepy') {
    drawArcEye(drawCtx, leftX, eyeY, r.w * 0.19, r.h * 0.04, -1);
    drawArcEye(drawCtx, rightX, eyeY, r.w * 0.19, r.h * 0.04, -1);
    drawCtx.beginPath();
    drawCtx.ellipse(mouthX, mouthY + r.h * 0.05, r.w * 0.055, r.h * 0.075, 0, 0, Math.PI * 2);
    drawCtx.stroke();
    drawCtx.font = `bold ${Math.max(7, r.s * 15)}px sans-serif`;
    drawCtx.fillStyle = 'rgba(90, 110, 180, 0.75)';
    drawCtx.fillText('Z', r.x + r.w * 0.84, r.y + r.h * 0.16 - beat * 3);
  } else if (expr === 'sad' || expr === 'crying') {
    drawArcEye(drawCtx, leftX, eyeY, r.w * 0.19, r.h * 0.08, -1);
    drawArcEye(drawCtx, rightX, eyeY, r.w * 0.19, r.h * 0.08, -1);
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.12, mouthY + r.h * 0.08);
    drawCtx.quadraticCurveTo(mouthX, mouthY - r.h * 0.06, mouthX + r.w * 0.12, mouthY + r.h * 0.08);
    drawCtx.stroke();
    drawCtx.fillStyle = 'rgba(88, 190, 255, 0.82)';
    drawCtx.beginPath();
    drawCtx.ellipse(leftX + r.w * 0.07, eyeY + r.h * (0.12 + beat * 0.08), r.w * 0.035, r.h * 0.09, 0, 0, Math.PI * 2);
    drawCtx.ellipse(rightX - r.w * 0.07, eyeY + r.h * (0.10 + beat * 0.08), r.w * 0.035, r.h * 0.09, 0, 0, Math.PI * 2);
    drawCtx.fill();
  } else if (expr === 'angry') {
    drawCtx.beginPath();
    drawCtx.moveTo(leftX - r.w * 0.12, eyeY - r.h * 0.10);
    drawCtx.lineTo(leftX + r.w * 0.10, eyeY - r.h * 0.01);
    drawCtx.moveTo(rightX - r.w * 0.10, eyeY - r.h * 0.01);
    drawCtx.lineTo(rightX + r.w * 0.12, eyeY - r.h * 0.10);
    drawCtx.stroke();
    drawArcEye(drawCtx, leftX, eyeY + r.h * 0.04, r.w * 0.13, r.h * 0.03, 1);
    drawArcEye(drawCtx, rightX, eyeY + r.h * 0.04, r.w * 0.13, r.h * 0.03, 1);
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.11, mouthY + r.h * 0.08);
    drawCtx.quadraticCurveTo(mouthX, mouthY - r.h * 0.03, mouthX + r.w * 0.11, mouthY + r.h * 0.08);
    drawCtx.stroke();
    drawCtx.fillStyle = '#ff5b5b';
    drawCtx.fillRect(r.x + r.w * 0.86, r.y + r.h * 0.15, r.w * 0.045, r.h * 0.16);
    drawCtx.fillRect(r.x + r.w * 0.82, r.y + r.h * 0.20, r.w * 0.13, r.h * 0.04);
  } else if (expr === 'dizzy') {
    drawCtx.font = `bold ${Math.max(8, r.s * 18)}px sans-serif`;
    drawCtx.fillStyle = ink;
    drawCtx.fillText('×', leftX - r.w * 0.05, eyeY + r.h * 0.06);
    drawCtx.fillText('×', rightX - r.w * 0.05, eyeY + r.h * 0.06);
    drawCtx.beginPath();
    drawCtx.arc(mouthX, mouthY + r.h * 0.04, r.w * 0.055, 0, Math.PI * 2);
    drawCtx.stroke();
  } else {
    drawCtx.fillStyle = ink;
    drawCtx.beginPath();
    drawCtx.ellipse(leftX, eyeY, r.w * 0.045, r.h * 0.075, 0, 0, Math.PI * 2);
    drawCtx.ellipse(rightX, eyeY, r.w * 0.045, r.h * 0.075, 0, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.08, mouthY);
    drawCtx.quadraticCurveTo(mouthX, mouthY + r.h * 0.05, mouthX + r.w * 0.08, mouthY);
    drawCtx.stroke();
  }

  drawCtx.restore();
}

// ===== 绘制反应叠加效果 =====
function drawReactionOverlay(ctx, cx, cy) {
  // 鞭打 - 泪珠 + 揉屁股效果
  if (reactionState.whip) {
    const { phase, startTime } = reactionState.whip;
    if (phase === 'hit') {
      ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(cx + 15, cy - 20, 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 12, cy - 18, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (phase === 'rub') {
      const t = (Date.now() - startTime) / 200;
      ctx.strokeStyle = 'rgba(255, 150, 150, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(t) * 3, cy + 35, 6, 0, Math.PI);
      ctx.stroke();
    }
  }

  // 喂食 - 星星眼
  if (reactionState.feed && reactionState.feed.phase === 'excited') {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    drawSmallStar(ctx, cx - 10, cy - 25, 3);
    drawSmallStar(ctx, cx + 10, cy - 25, 3);
  }

  // 抚摸 - 爱心
  if (reactionState.pat && reactionState.pat.phase === 'purring') {
    const t = (Date.now() - reactionState.pat.startTime) / 1000;
    ctx.fillStyle = `rgba(255, 100, 150, ${0.5 + Math.sin(t * 3) * 0.3})`;
    ctx.font = '12px serif';
    ctx.fillText('\u2665', cx + 20, cy - 30 - Math.sin(t * 2) * 5);
  }
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!state.sprite.complete || !state.sprite.naturalWidth) return;

  // ===== DPR 变化检测（窗口在不同 DPI 显示器间切换时自动更新）=====
  const dpr = window.devicePixelRatio || 1;
  if (dpr !== _currentDpr) {
    _currentDpr = dpr;
    canvas.width = Math.round(_logW * dpr);
    canvas.height = Math.round(_logH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 重置并应用新 DPR 缩放
  }

  const deltaTime = state.lastDrawTime ? (now - state.lastDrawTime) : 16;
  state.lastDrawTime = now;

  let stateObj = STATES[state.stateName];
  const maxRow = Math.floor(state.sprite.naturalHeight / CELL_H) - 1;
  if (stateObj.row > maxRow) {
    state.stateName = 'idle';
    stateObj = STATES.idle;
    state.frame = 0;
  }
  const frameInterval = stateObj.speed || (1000 / stateObj.fps);
  if (!state.lastFrameAt || now - state.lastFrameAt >= frameInterval) {
    state.frame = (state.frame + 1) % stateObj.frames;
    state.lastFrameAt = now;
  }

  // 脚步声频率控制
  if (state.stateName === 'runningRight' || state.stateName === 'runningLeft') {
    state.stepSoundCounter++;
    if (state.stepSoundCounter % 12 === 0) {
      playSound('step');
    }
  } else {
    state.stepSoundCounter = 0;
  }

  // 使用逻辑尺寸（CSS 像素）清屏，ctx.scale(dpr,dpr) 已在 startRenderLoop 设置
  ctx.clearRect(0, 0, _logW, _logH);

  // 更新启动动画状态
  if (startupAnim.active) {
    updateStartupAnimation();
  }

  // 喂食缩放
  let scale = 1;
  if (state.feedScaleStart > 0) {
    const elapsed = now - state.feedScaleStart;
    if (elapsed < FEED_SCALE_DURATION) {
      const progress = elapsed / FEED_SCALE_DURATION;
      scale = 1 + (FEED_SCALE_MAX - 1) * Math.sin(progress * Math.PI);
    } else {
      state.feedScaleStart = 0;
      scale = 1;
    }
  }

  // ===== 气泡动态定位：根据动画状态调整气泡高度 =====
  const bubbleBaseMap = {
    sleeping: 95,
    failed: 105,
    digSand: 105,
    readBook: 105,
    watchTV: 105,
    eating: 108,
    petting: 108,
    dizzy: 108,
    crying: 108,
    waving: 110,
    gifting: 110,
    bashful: 112,
    idle: 115,
    runningRight: 115,
    runningLeft: 115,
    waiting: 115,
    review: 115,
    lookingAround: 115,
    clapping: 115,
    yawning: 112,
    stretching: 118,
    dancing: 122,
    swing: 125,
    jumping: 132,
    climbing: 138,
    perching: 138,
  };
  const bubbleBottom = bubbleBaseMap[state.stateName] || 115;
  const feedOffset = (scale - 1) * 15;
  if (bubble) bubble.style.setProperty('--bubble-bottom', `${bubbleBottom + feedOffset}px`);

  const DRAW_SCALE = 0.75;
  const drawW = _logW * DRAW_SCALE;
  const drawH = _logH * DRAW_SCALE;
  const centerX = _logW / 2;
  const centerY = _logH / 2;
  const offsetX = centerX - drawW / 2;
  const offsetY = _logH - drawH;
  const isDancing = state.stateName === 'dancing';
  const isSwinging = state.stateName === 'swing';
  const dancePose = isDancing ? getDancePose(now) : null;
  const swingPose = isSwinging ? getSwingPose(now) : null;
  const dancePivotX = offsetX + drawW * 0.5;
  const dancePivotY = offsetY + drawH * 0.68;
  const swingPivotX = offsetX + drawW * 0.5;
  const swingPivotY = offsetY + drawH * 0.20;

  if (isDancing) {
    drawDanceBackdrop(ctx, dancePivotX, offsetY + drawH, now, _logW, _logH);
  }
  if (isSwinging) {
    drawSwingBackdrop(ctx, swingPivotX, offsetY - 12, swingPose);
  }

  ctx.save();
  if (startupAnim.active) {
    // 启动动画：旋转 + 缩放 + 位移变换
    ctx.translate(centerX + startupAnim.offsetX, centerY + startupAnim.offsetY);
    ctx.rotate(startupAnim.rotation);
    ctx.scale(startupAnim.scale * scale, startupAnim.scale * scale);
    ctx.translate(-centerX, -centerY);
  } else {
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
  }
  if (dancePose) {
    ctx.translate(dancePivotX + dancePose.x, dancePivotY + dancePose.y);
    ctx.rotate(dancePose.rotation);
    ctx.scale(dancePose.scaleX, dancePose.scaleY);
    ctx.translate(-dancePivotX, -dancePivotY);
  }
  if (swingPose) {
    ctx.translate(swingPivotX, swingPivotY);
    ctx.rotate(swingPose.angle);
    ctx.translate(swingPose.x, swingPose.y);
    ctx.scale(swingPose.scaleX, swingPose.scaleY);
    ctx.translate(-swingPivotX, -swingPivotY);
  }
  ctx.imageSmoothingEnabled = false; // pixel art：关闭插值，保持像素锐利
  drawOutfitLayers(ctx, state.frame, stateObj.row, offsetX, offsetY, drawW, drawH, 'behind');
  ctx.drawImage(state.sprite, state.frame * CELL_W, stateObj.row * CELL_H, CELL_W, CELL_H, offsetX, offsetY, drawW, drawH);
  drawExpressionFace(ctx, stateObj.row, offsetX, offsetY, drawW, drawH, now);
  drawOutfitLayers(ctx, state.frame, stateObj.row, offsetX, offsetY, drawW, drawH, 'front');
  ctx.restore();

  // 绘制特效锚点
  const petCX = offsetX + drawW / 2;
  const petCY = offsetY + drawH / 2;

  if (isDancing) {
    drawDanceForeground(ctx, petCX, petCY, now);
  }

  // 反应叠加
  drawReactionOverlay(ctx, petCX, petCY);

  // 启动动画拖尾粒子（传入逻辑尺寸）
  drawStartupParticles(ctx, _logW, _logH);

  // 季节粒子
  updateSeasonalParticles(deltaTime);
  drawSeasonalParticles(ctx);
}

export function startRenderLoop() {
  // ===== HiDPI / Retina 支持 =====
  _logW = canvas.offsetWidth || 120;
  _logH = canvas.offsetHeight || 130;
  _currentDpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(_logW * _currentDpr);
  canvas.height = Math.round(_logH * _currentDpr);
  ctx.scale(_currentDpr, _currentDpr);

  requestAnimationFrame(draw);
}
