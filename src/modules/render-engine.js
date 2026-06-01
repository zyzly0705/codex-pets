// render-engine.js - Canvas 渲染主循环（drawFrame, 动画帧计算）
import { state, canvas, ctx, bubble, feedBtn, bubbleAvatar, CELL_W, CELL_H, FEED_SCALE_DURATION, FEED_SCALE_MAX, BREATH_PERIOD, BREATH_AMPLITUDE, GLANCE_DURATION, GLANCE_MAX_OFFSET, GLANCE_INTERVAL_MIN, GLANCE_INTERVAL_MAX, reactionState, getPetCell, getPetStateSpec } from './core-state.js';
import { playSound } from './audio.js';
import { registerSpeechStartHook } from './speech-queue.js';
import { getEmotionExpression, yoyoEmotion } from './emotion-system.js';
import { updateSeasonalParticles, drawSeasonalParticles } from './weather-seasonal.js';
import { startupAnim, updateStartupAnimation, drawStartupParticles } from './startup-animation.js';

const expressionControls = globalThis.YOYO_EXPRESSION_CONTROLS || {};
const normalizeExpressionPreset = expressionControls.normalizeExpressionPreset || ((expr, fallback = 'neutral') => expr || fallback);
const runtimeExpressionForPreset = expressionControls.runtimeExpressionForPreset || ((expr, fallback = 'neutral') => expr || fallback);
const expressionForBehavior = expressionControls.expressionForBehavior || ((behavior) => {
  const fallbackMap = {
    pet: 'happy',
    feed: 'happy',
    bath: 'happy',
    sleep: 'sleepy',
    play: 'happy',
    whip: 'sad',
    talk: 'talk_small',
  };
  return fallbackMap[behavior] || 'neutral';
});

// ── 微表情 override ──────────────────────────────────────────────────────────
// 台词开始时由 setSpeechExpression() 设置，自发微表情由 triggerMicroExpr() 设置
// resolveAutoExpression() 最高优先级读取
let _microExprOverride = null;
let _microExprRuntimeOverride = null;
let _microExprEndMs = 0;

function applyBubbleAvatarExpression(expr, durationMs) {
  if (!bubbleAvatar) return;
  const preset = normalizeExpressionPreset(expr);
  const runtimeExpr = runtimeExpressionForPreset(expr || preset);
  bubbleAvatar.setAttribute('data-preset', preset);
  bubbleAvatar.setAttribute('data-expr', runtimeExpr);
  setTimeout(() => {
    if (Date.now() >= _microExprEndMs) {
      bubbleAvatar.removeAttribute('data-preset');
      bubbleAvatar.removeAttribute('data-expr');
    }
  }, durationMs);
}

export function setSpeechExpression(expr, durationMs) {
  _microExprOverride = normalizeExpressionPreset(expr);
  _microExprRuntimeOverride = runtimeExpressionForPreset(expr || _microExprOverride);
  _microExprEndMs = Date.now() + durationMs;
  applyBubbleAvatarExpression(expr, durationMs);
}

export function triggerMicroExpr(expr, durationMs = 1500) {
  _microExprOverride = normalizeExpressionPreset(expr);
  _microExprRuntimeOverride = runtimeExpressionForPreset(expr || _microExprOverride);
  _microExprEndMs = Date.now() + durationMs;
  applyBubbleAvatarExpression(expr, durationMs);
}

// 根据台词文字内容推断最匹配的表情
export function inferExpressionFromText(text) {
  if (!text) return null;
  if (/呜|哭|委屈|难过|疼|生气|哼|不理|烦/.test(text)) return 'sad';
  if (/嘿嘿|哈哈|开心|好棒|耶|太好了|嘻嘻|好玩|快乐/.test(text)) return 'sparkle';
  if (/爱你|喜欢|抱抱|心心|最好|妈妈最棒/.test(text)) return 'heart';
  if (/困|睡|眯|打盹|呼噜|zzZ/.test(text)) return 'sleepy';
  if (/害羞|脸红|嘿嘿.*妈妈|不好意思/.test(text)) return 'shy';
  if (/生气|哼！|不原谅|再也不/.test(text)) return 'angry';
  if (/嗯|好舒服|温暖|轻轻|舒服/.test(text)) return 'happy';
  return null;
}

// ===== 呼吸感静态状态集合（模块级常量，避免每帧重建） =====
const STATIC_STATES = new Set([
  'idle', 'waiting', 'bashful', 'review', 'sleeping',
  'typingCompanion', 'workModeReady', 'waving', 'petting',
  'readBook', 'watchTV', 'swimming', 'eating'
]);

const PERSONA_DRAW_SCALE_DEFAULT = 0.82;
const PERSONA_FOOT_BASELINE_Y = 0.965;
const PERSONA_HEAD_SPLIT_Y = 0.54;
const PERSONA_TORSO_SPLIT_Y = 0.76;

function getPersonaIdlePose(now, stateName) {
  const phase = ((now % BREATH_PERIOD) / BREATH_PERIOD) * Math.PI * 2;
  const wave = Math.sin(phase);
  const settle = Math.cos(phase);
  const quiet = stateName === 'sleeping' || stateName === 'readBook' || stateName === 'watchTV';
  const amplitude = BREATH_AMPLITUDE * (quiet ? 0.52 : 1.08);
  const blinkWindow = (now % 4300) > 4140;
  return {
    x: Math.sin(phase * 0.5) * (quiet ? 0.35 : 0.74),
    y: -1.2 + wave * (quiet ? 0.42 : 1.15),
    rotation: Math.sin(phase * 0.5) * (quiet ? 0.006 : 0.016),
    scaleX: 1 - amplitude * settle * 0.36,
    scaleY: 1 + amplitude * settle,
    torsoX: Math.sin(phase * 0.5 + 0.35) * (quiet ? 0.22 : 0.55),
    torsoY: wave * (quiet ? 0.22 : 0.55),
    torsoRotation: Math.sin(phase * 0.5 + 0.25) * (quiet ? 0.004 : 0.010),
    headX: Math.sin(phase * 0.5 + 0.9) * (quiet ? 0.42 : 1.15),
    headY: -1.0 + Math.sin(phase + 0.55) * (quiet ? 0.45 : 1.12),
    headRotation: Math.sin(phase * 0.5 + 0.8) * (quiet ? 0.007 : 0.022),
    blinkWindow,
  };
}

// ===== 视线追踪：定期采样鼠标方向（避免每帧 IPC） =====
let _lastMouseDir = { x: 0, y: 0 };
let _lastMouseSampleAt = 0;
const MOUSE_SAMPLE_INTERVAL = 5000; // 5 秒采样一次

const dynamicSheetCache = new Map();
const performanceSheetCache = new Map();

const PERFORMANCE_SHEETS = {
  danceLetGo: {
    src: '../assets/yoyo/effects/dance-let-go/sheet.webp',
    frames: 24,
    speed: 75,
  },
};

const INTEGRATED_SCENE_STATES = new Set([
  'swing',
  'fanCooling',
  'swimming',
  'airConditioning',
  'sofaLying',
]);

function getPerformanceSequence(name, now) {
  const spec = PERFORMANCE_SHEETS[name];
  if (!spec) return null;
  let img = performanceSheetCache.get(name);
  if (!img) {
    img = new Image();
    img.src = spec.src;
    performanceSheetCache.set(name, img);
  }
  if (!img.complete || !img.naturalWidth) return null;
  const frame = Math.floor(now / spec.speed) % spec.frames;
  return { img, frame, spec };
}

async function sampleMouseDirection() {
  try {
    const mousePos = await window.petApi.getMousePosition();
    const { bounds } = await window.petApi.getBounds();
    const petCenterX = bounds.x + bounds.width / 2;
    const petCenterY = bounds.y + bounds.height / 2;
    const dx = mousePos.x - petCenterX;
    const dy = mousePos.y - petCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 10) {
      // 避免太近时方向抖动
      _lastMouseDir = { x: Math.sign(dx), y: Math.sign(dy) };
    }
  } catch (e) {
    // 静默忽略，不影响渲染
  }
}

function getDrawableSheet(stateObj) {
  if (stateObj.sheetPath) {
    let img = dynamicSheetCache.get(stateObj.sheetPath);
    if (!img) {
      img = new Image();
      img.src = stateObj.sheetPath.startsWith('file://') ? stateObj.sheetPath : `file://${stateObj.sheetPath.replaceAll('\\', '/')}`;
      dynamicSheetCache.set(stateObj.sheetPath, img);
    }
    return { sprite: img, usesBaseSheet: false };
  }
  const sheetId = stateObj.sheet || stateObj.sheetId || 'base';
  if (sheetId && sheetId !== 'base') {
    return { sprite: state.spriteSheets?.[sheetId] || state.sprite, usesBaseSheet: false };
  }
  return { sprite: state.sprite, usesBaseSheet: true };
}

function normalizeFrameRef(ref, fallbackRow = 0) {
  if (Array.isArray(ref)) {
    return {
      row: Number(ref[0] ?? fallbackRow),
      frame: Number(ref[1] ?? 0),
    };
  }
  if (ref && typeof ref === 'object') {
    return {
      row: Number(ref.row ?? fallbackRow),
      frame: Number(ref.frame ?? ref.col ?? ref.column ?? 0),
    };
  }
  return {
    row: Number(fallbackRow),
    frame: Number(ref ?? 0),
  };
}

function buildStateTimeline(stateObj) {
  const fallbackRow = Number(stateObj.row ?? 0);

  if (Array.isArray(stateObj.sequence)) {
    return stateObj.sequence.map((item) => normalizeFrameRef(item, fallbackRow));
  }

  if (Array.isArray(stateObj.frameSequence)) {
    return stateObj.frameSequence.map((item) => normalizeFrameRef(item, fallbackRow));
  }

  if (Array.isArray(stateObj.clips)) {
    return stateObj.clips.flatMap((clip) => {
      const row = Number(clip.row ?? fallbackRow);
      const start = Number(clip.start ?? clip.frameStart ?? 0);
      const frames = Math.max(1, Number(clip.frames ?? stateObj.frames ?? 1));
      return Array.from({ length: frames }, (_, i) => ({ row, frame: start + i }));
    });
  }

  const frames = Math.max(1, Number(stateObj.frames || 1));
  const linear = Array.from({ length: frames }, (_, frame) => ({ row: fallbackRow, frame }));
  if ((stateObj.loop === 'pingpong' || stateObj.pingPong === true) && frames > 2) {
    const back = linear.slice(1, -1).reverse();
    return [...linear, ...back];
  }
  return linear;
}

function getPlaybackFrameCount(stateObj) {
  return Math.max(1, buildStateTimeline(stateObj).length);
}

function getMaxReferencedRow(stateObj) {
  return buildStateTimeline(stateObj)
    .reduce((max, item) => Math.max(max, Number(item.row || 0)), Number(stateObj.row || 0));
}

function resolveSourceFrame(stateObj, frameIndex, maxRow, maxCol) {
  const timeline = buildStateTimeline(stateObj);
  const item = timeline[frameIndex % timeline.length] || { row: stateObj.row || 0, frame: 0 };
  return {
    row: Math.max(0, Math.min(maxRow, Number(item.row || 0))),
    frame: Math.max(0, Math.min(maxCol, Number(item.frame || 0))),
  };
}

// ===== 逻辑尺寸（CSS 像素），由 startRenderLoop 初始化 =====
let _logW = 120;
let _logH = 130;
let _currentDpr = window.devicePixelRatio || 1;

function drawPersonaGroundShadow(ctx, cx, baseY, width, alpha = 0.22) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const gradient = ctx.createRadialGradient(cx, baseY, 2, cx, baseY, width * 0.55);
  gradient.addColorStop(0, `rgba(63, 35, 48, ${alpha})`);
  gradient.addColorStop(0.72, `rgba(63, 35, 48, ${alpha * 0.28})`);
  gradient.addColorStop(1, 'rgba(63, 35, 48, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, width * 0.52, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPersonaSpriteBand(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, top, bottom) {
  const srcX = sourceFrame.frame * cell.width;
  const srcY = sourceFrame.row * cell.height + cell.height * top;
  const srcH = cell.height * (bottom - top);
  ctx.drawImage(
    drawSprite,
    srcX,
    srcY,
    cell.width,
    srcH,
    offsetX,
    offsetY + drawH * top,
    drawW,
    drawH * (bottom - top)
  );
}

function drawPersonaSpriteWithLayerMotion(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, personaIdlePose) {
  if (!personaIdlePose) {
    ctx.drawImage(drawSprite, sourceFrame.frame * cell.width, sourceFrame.row * cell.height, cell.width, cell.height, offsetX, offsetY, drawW, drawH);
    return;
  }

  drawPersonaSpriteBand(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, PERSONA_TORSO_SPLIT_Y, 1);

  const torsoPivotX = offsetX + drawW * 0.5;
  const torsoPivotY = offsetY + drawH * 0.78;
  ctx.save();
  ctx.translate(torsoPivotX + personaIdlePose.torsoX, torsoPivotY + personaIdlePose.torsoY);
  ctx.rotate(personaIdlePose.torsoRotation);
  ctx.scale(personaIdlePose.scaleX, personaIdlePose.scaleY);
  ctx.translate(-torsoPivotX, -torsoPivotY);
  drawPersonaSpriteBand(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, PERSONA_HEAD_SPLIT_Y - 0.015, PERSONA_TORSO_SPLIT_Y + 0.015);
  ctx.restore();

  const headPivotX = offsetX + drawW * 0.5;
  const headPivotY = offsetY + drawH * 0.56;
  ctx.save();
  ctx.translate(headPivotX + personaIdlePose.headX, headPivotY + personaIdlePose.headY);
  ctx.rotate(personaIdlePose.headRotation);
  ctx.scale(1 + BREATH_AMPLITUDE * 0.5, 1 - BREATH_AMPLITUDE * 0.35);
  ctx.translate(-headPivotX, -headPivotY);
  drawPersonaSpriteBand(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, 0, PERSONA_HEAD_SPLIT_Y + 0.018);
  ctx.restore();
}

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

function drawPersonaIdleAccent(ctx, offsetX, offsetY, drawW, drawH, now, personaIdlePose) {
  if (!personaIdlePose) return;
  const phase = now / 1000;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.42 + Math.sin(phase * 2.6) * 0.08;
  ctx.fillStyle = '#ff6f9f';
  drawHeart(ctx, offsetX + drawW * 0.78 + Math.sin(phase * 2.1) * 2, offsetY + drawH * 0.26 + Math.cos(phase * 2.4) * 2, 5, '#ff6f9f');
  ctx.globalAlpha = 0.50 + Math.sin(phase * 3.2) * 0.12;
  ctx.fillStyle = '#fff4bc';
  drawSmallStar(ctx, offsetX + drawW * 0.23, offsetY + drawH * 0.36 + Math.sin(phase * 2.8) * 2, 2.4);
  if (personaIdlePose.blinkWindow) {
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = '#2b1b24';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const eyeY = offsetY + drawH * 0.365;
    ctx.beginPath();
    ctx.moveTo(offsetX + drawW * 0.40, eyeY);
    ctx.lineTo(offsetX + drawW * 0.46, eyeY + 0.5);
    ctx.moveTo(offsetX + drawW * 0.56, eyeY + 0.5);
    ctx.lineTo(offsetX + drawW * 0.62, eyeY);
    ctx.stroke();
  }
  ctx.restore();
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
  const hangerY = topY + 4;
  const ropeLen = 82 + pose.ramp * 4;
  const seatY = ropeLen + pose.seatBounce;
  const seatHalfWidth = 21;
  const topHalfWidth = 22;

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

  ctx.save();
  ctx.translate(cx, hangerY);
  ctx.rotate(pose.angle);
  ctx.translate(pose.x, pose.y * 0.6);

  ctx.strokeStyle = 'rgba(244, 213, 150, 0.95)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-topHalfWidth, 0);
  ctx.lineTo(-seatHalfWidth, seatY);
  ctx.moveTo(topHalfWidth, 0);
  ctx.lineTo(seatHalfWidth, seatY);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, seatY);
  ctx.rotate(pose.angle * 0.12);
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

function drawSwingForeground(ctx, cx, cy, now, pose) {
  const t = now / 1000;
  const direction = Math.sign(pose.angle) || 1;
  const gustAlpha = 0.10 + pose.ramp * 0.16;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${gustAlpha})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const trailY = cy - 12 + i * 9;
    const baseX = cx - direction * (26 + i * 7);
    ctx.beginPath();
    ctx.moveTo(baseX, trailY);
    ctx.quadraticCurveTo(baseX + direction * 12, trailY - 3, baseX + direction * 24, trailY + 2);
    ctx.stroke();
  }

  const sparkleCount = 3;
  for (let i = 0; i < sparkleCount; i++) {
    const phase = t * 1.6 + i * 0.9;
    const orbitX = cx + Math.sin(phase) * (18 + i * 6);
    const orbitY = cy - 30 - ((phase * 18 + i * 5) % 22);
    ctx.globalAlpha = 0.28 + pose.ramp * 0.28;
    ctx.fillStyle = i % 2 === 0 ? '#ffd166' : '#ffffff';
    drawSmallStar(ctx, orbitX, orbitY, 2 + (i % 2));
  }
  ctx.restore();
}

function getClimbVisualPose(now) {
  const edgeType = state.climbEdgeType ?? 0;
  const phase = state.climbPhase || 'idle';
  const t = now / 1000;
  const bob = Math.sin(t * 5.2);
  const side = edgeType === 1 ? -1 : edgeType === 2 ? 1 : 0;

  const sideGrip = Math.abs(side) * 5;

  if (phase === 'perching') {
    return { x: side * (6 + sideGrip), y: -4 + bob * 1.7, rotation: side * 0.12 + bob * 0.012, scaleX: 1.03, scaleY: 0.97 };
  }
  if (phase === 'peeking') {
    return { x: side * (12 + sideGrip), y: -8 + bob * 2.1, rotation: side * 0.16, scaleX: 1.05, scaleY: 0.96 };
  }
  if (phase === 'descending') {
    return { x: side * (4 + sideGrip), y: 2 + Math.abs(bob) * 1.6, rotation: side * 0.07, scaleX: 0.99, scaleY: 1.01 };
  }
  return { x: side * (5 + sideGrip), y: -1 + bob * 1.6, rotation: side * 0.10 + bob * 0.015, scaleX: 1.02, scaleY: 0.98 };
}

function getRunningPose(now, direction) {
  const step = Math.sin((now / 1000) * 24);
  const lift = Math.abs(step);
  return {
    x: direction * (2.2 + lift * 1.8),
    y: -lift * 7.2,
    rotation: direction * (0.075 + lift * 0.05),
    scaleX: 1.055 + lift * 0.045,
    scaleY: 0.975 - lift * 0.052,
  };
}

function drawClimbBackdrop(ctx, logW, logH, edgeType, phase, now) {
  const t = now / 1000;
  ctx.save();
  ctx.globalAlpha = 0.82;

  if (edgeType === 0) {
    ctx.fillStyle = 'rgba(255, 234, 196, 0.75)';
    ctx.fillRect(10, 4, logW - 20, 10);
    ctx.strokeStyle = 'rgba(188, 146, 92, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(logW - 12, 14);
    ctx.stroke();
  } else if (edgeType === 1) {
    ctx.fillStyle = 'rgba(230, 236, 248, 0.72)';
    ctx.fillRect(3, 8, 12, logH - 20);
    ctx.strokeStyle = 'rgba(168, 181, 206, 0.86)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15, 10);
    ctx.lineTo(15, logH - 12);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(230, 236, 248, 0.72)';
    ctx.fillRect(logW - 15, 8, 12, logH - 20);
    ctx.strokeStyle = 'rgba(168, 181, 206, 0.86)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(logW - 15, 10);
    ctx.lineTo(logW - 15, logH - 12);
    ctx.stroke();
  }

  if (phase === 'peeking') {
    ctx.fillStyle = `rgba(255, 214, 94, ${0.35 + Math.sin(t * 8) * 0.15})`;
    drawSmallStar(ctx, logW * 0.5 + Math.sin(t * 3) * 6, 24, 4);
  }
  ctx.restore();
}

function getHungryPromptPose(now) {
  const t = now / 1000;
  return {
    x: Math.sin(t * 3.8) * 2.2,
    y: -1 + Math.sin(t * 7.2) * 1.4,
    rotation: Math.sin(t * 3.8) * 0.035,
    scaleX: 1.01 + Math.sin(t * 7.2) * 0.02,
    scaleY: 0.99 - Math.sin(t * 7.2) * 0.015,
  };
}

function drawHungryForeground(ctx, cx, cy, now) {
  const t = now / 1000;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.36)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 8);
  ctx.quadraticCurveTo(cx + 32, cy - 18 + Math.sin(t * 3) * 3, cx + 44, cy - 28);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 193, 94, 0.82)';
  ctx.beginPath();
  ctx.arc(cx + 48, cy - 30 + Math.sin(t * 4) * 2, 4.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  drawSmallStar(ctx, cx + 30, cy - 26, 2);
  drawSmallStar(ctx, cx + 40, cy - 16, 1.8);
  ctx.restore();
}

function getWhipPose(now) {
  if (!reactionState.whip) return null;
  const elapsed = now - reactionState.whip.startTime;
  const side = reactionState.whip.side || 1;
  const hitStrength = reactionState.whip.severity === 'heavy' ? 1.35 : 1;
  if (reactionState.whip.phase === 'hit') {
    return {
      x: -side * (5.5 * hitStrength) + Math.sin(elapsed / 30) * 1.8,
      y: 1.5 + Math.cos(elapsed / 48) * 1.4,
      rotation: -side * 0.12 * hitStrength + Math.sin(elapsed / 32) * 0.025,
      scaleX: 1.04,
      scaleY: 0.97,
    };
  }
  if (reactionState.whip.phase === 'rub') {
    return {
      x: -side * 3.5,
      y: 2.5 + Math.sin(elapsed / 140) * 1.2,
      rotation: -side * 0.085,
      scaleX: 0.985,
      scaleY: 1.015,
    };
  }
  return {
    x: side * 2.5,
    y: 0,
    rotation: side * 0.08,
    scaleX: 1.0,
    scaleY: 1.0,
  };
}

function drawWhipModel(ctx, cx, cy, now) {
  if (!reactionState.whip) return;

  const { phase, startTime, side = 1, severity = 'light' } = reactionState.whip;
  const elapsed = now - startTime;
  const heavy = severity === 'heavy';
  const hitX = cx + side * 20;
  const hitY = cy + 10;
  const handleX = cx + side * 74;
  const handleY = cy - 12;

  let tipX = hitX;
  let tipY = hitY;
  let ctrl1X = cx + side * 62;
  let ctrl1Y = cy - 32;
  let ctrl2X = cx + side * 36;
  let ctrl2Y = cy - 4;
  let alpha = 0.95;

  if (phase === 'hit') {
    const strikeT = Math.min(1, elapsed / 180);
    const overshoot = (1 - strikeT) * side * 22;
    tipX += overshoot;
    tipY -= (1 - strikeT) * 20;
    ctrl1Y -= 10 + (1 - strikeT) * 12;
    ctrl2Y -= 6 + Math.sin(strikeT * Math.PI) * 8;
  } else if (phase === 'rub') {
    const sway = Math.sin(elapsed / 180) * 4;
    tipX = cx + side * 30 + sway;
    tipY = cy + 24;
    ctrl1X = cx + side * 64;
    ctrl1Y = cy - 12;
    ctrl2X = cx + side * 48;
    ctrl2Y = cy + 14;
    alpha = 0.72;
  } else {
    tipX = cx + side * 34;
    tipY = cy + 2;
    ctrl1X = cx + side * 58;
    ctrl1Y = cy - 16;
    ctrl2X = cx + side * 46;
    ctrl2Y = cy - 2;
    alpha = 0.78;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (phase === 'hit') {
    ctx.strokeStyle = 'rgba(255, 236, 170, 0.26)';
    ctx.lineWidth = heavy ? 6.5 : 5;
    ctx.beginPath();
    ctx.moveTo(handleX + side * 4, handleY - 2);
    ctx.bezierCurveTo(ctrl1X + side * 6, ctrl1Y - 4, ctrl2X + side * 5, ctrl2Y - 2, tipX + side * 8, tipY + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = heavy ? '#5d2f18' : '#6a371d';
  ctx.lineWidth = heavy ? 3.6 : 3.1;
  ctx.beginPath();
  ctx.moveTo(handleX, handleY);
  ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, tipX, tipY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(213, 165, 104, 0.95)';
  ctx.lineWidth = heavy ? 1.35 : 1.15;
  ctx.beginPath();
  ctx.moveTo(handleX - side * 1.5, handleY - 1.5);
  ctx.bezierCurveTo(ctrl1X - side * 1.5, ctrl1Y - 1.5, ctrl2X - side * 1.5, ctrl2Y - 1, tipX - side * 1.2, tipY - 0.8);
  ctx.stroke();

  const handleAngle = Math.atan2(ctrl1Y - handleY, ctrl1X - handleX);
  ctx.save();
  ctx.translate(handleX, handleY);
  ctx.rotate(handleAngle);
  ctx.fillStyle = '#3b2417';
  ctx.strokeStyle = '#8f5f37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-15, -3, 17, 6, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c79b61';
  for (let i = -10; i <= -2; i += 4) {
    ctx.fillRect(i, -2.2, 1.1, 4.4);
  }
  ctx.restore();

  if (phase === 'hit') {
    ctx.fillStyle = 'rgba(255, 248, 220, 0.85)';
    ctx.beginPath();
    ctx.arc(tipX, tipY, heavy ? 2.8 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function getFanPose(now) {
  const t = now / 1000;
  return {
    x: Math.sin(t * 2.2) * 1.2,
    y: Math.sin(t * 4.4) * 1.4,
    rotation: Math.sin(t * 2.6) * 0.02,
    scaleX: 1.0,
    scaleY: 1.0,
    breeze: 0.65 + (Math.sin(t * 6) * 0.5 + 0.5) * 0.35,
  };
}

function drawFanBackdrop(ctx, cx, cy, pose) {
  ctx.save();
  const fanX = cx + 38;
  const fanY = cy + 14;
  ctx.fillStyle = 'rgba(198, 240, 255, 0.88)';
  ctx.strokeStyle = 'rgba(104, 172, 194, 0.92)';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.roundRect(fanX - 12, fanY + 10, 24, 18, 8);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(fanX, fanY + 28);
  ctx.lineTo(fanX, fanY + 42);
  ctx.stroke();

  ctx.fillStyle = 'rgba(224, 250, 255, 0.96)';
  ctx.beginPath();
  ctx.arc(fanX, fanY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(fanX, fanY);
  ctx.rotate(performance.now() * 0.03);
  ctx.fillStyle = 'rgba(129, 197, 223, 0.85)';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -7, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = `rgba(182, 239, 255, ${0.22 + pose.breeze * 0.24})`;
  for (let i = 0; i < 3; i++) {
    const lineY = cy - 12 + i * 12;
    ctx.beginPath();
    ctx.moveTo(fanX - 14, lineY);
    ctx.bezierCurveTo(fanX - 26, lineY - 4, cx + 10, lineY - 2, cx - 18, lineY + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAirConditioningScene(ctx, logW, logH, now) {
  const t = now / 1000;
  const unitX = logW * 0.5;
  const unitY = 28;
  ctx.save();

  ctx.fillStyle = 'rgba(210, 235, 248, 0.18)';
  ctx.beginPath();
  ctx.roundRect(22, 10, logW - 44, 118, 14);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.strokeStyle = 'rgba(111, 177, 207, 0.74)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(unitX - 58, unitY - 12, 116, 27, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(99, 184, 224, 0.85)';
  ctx.beginPath();
  ctx.roundRect(unitX - 42, unitY + 9, 84, 5, 2.5);
  ctx.fill();

  ctx.fillStyle = 'rgba(98, 196, 238, 0.95)';
  ctx.beginPath();
  ctx.arc(unitX + 45, unitY, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(132, 216, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = unitX - 38 + i * 25;
    const drift = Math.sin(t * 2.1 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(x, unitY + 20);
    ctx.bezierCurveTo(x - 8 + drift, unitY + 48, x + 10 - drift, unitY + 77, x + drift * 0.5, unitY + 107);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.beginPath();
  ctx.ellipse(unitX, logH - 19, 58, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getSwimmingPose(now) {
  const t = now / 1000;
  return {
    x: Math.sin(t * 3.1) * 4,
    y: Math.sin(t * 5.6) * 3.2,
    rotation: Math.sin(t * 3.1) * 0.06,
    scaleX: 1 + Math.sin(t * 5.6) * 0.03,
    scaleY: 1 - Math.sin(t * 5.6) * 0.02,
    bob: Math.sin(t * 2.8) * 3.4,
  };
}

function drawSwimmingBackdrop(ctx, cx, baseY, now) {
  const t = now / 1000;
  ctx.save();
  const poolTop = baseY + 18;
  const wavePhase = t * 2.5;

  ctx.fillStyle = 'rgba(146, 221, 255, 0.75)';
  ctx.beginPath();
  ctx.roundRect(cx - 62, poolTop, 124, 42, 14);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const y = poolTop + 8 + i * 10;
    ctx.beginPath();
    for (let x = -58; x <= 58; x += 10) {
      const px = cx + x;
      const py = y + Math.sin(wavePhase + x * 0.08 + i * 0.7) * 2;
      if (x === -58) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 196, 97, 0.88)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, poolTop + 18, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSwimmingForeground(ctx, cx, cy, now) {
  const t = now / 1000;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  for (let i = 0; i < 5; i++) {
    const px = cx - 28 + i * 14 + Math.sin(t * 2 + i) * 2;
    const py = cy + 22 + Math.cos(t * 3 + i) * 2;
    ctx.beginPath();
    ctx.arc(px, py, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(132, 223, 255, 0.72)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 2; i++) {
    const splashX = cx + (i === 0 ? -22 : 22);
    const splashY = cy + 14;
    ctx.beginPath();
    ctx.moveTo(splashX, splashY);
    ctx.quadraticCurveTo(splashX - 4, splashY - 10 - Math.sin(t * 6 + i) * 2, splashX - 8, splashY - 2);
    ctx.moveTo(splashX, splashY);
    ctx.quadraticCurveTo(splashX + 3, splashY - 12 - Math.cos(t * 6 + i) * 2, splashX + 8, splashY - 3);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== 情绪驱动的“原生脸” =====
// 这套覆盖式动态五官在像素头身上容易和原始脸叠出“双脸/额头脸”。
// 默认关闭，保留代码只作为后续重新做逐帧表情素材前的实验入口。
const ENABLE_DYNAMIC_FACE = false;
const FACE_ROWS = new Set([0, 3, 5, 6, 7, 8, 11, 12, 15, 20, 21, 22, 23, 24, 25, 32]);
const FACE_ANCHOR = { x: 64, y: 43, width: 64, height: 44 };

function resolveAutoExpression() {
  // 微表情 override 优先级最高（台词驱动 or 自发）
  if (_microExprOverride && Date.now() < _microExprEndMs) {
    return _microExprRuntimeOverride || _microExprOverride;
  }
  _microExprOverride = null;
  _microExprRuntimeOverride = null;

  if (reactionState.whip) {
    if (reactionState.whip.phase === 'hit') return 'crying';
    if (reactionState.whip.phase === 'rub') return expressionForBehavior('whip');
    return yoyoEmotion.dominance > 58 ? expressionForBehavior('whip', { preferFallback: true }) : expressionForBehavior('whip');
  }
  if (reactionState.feed) {
    if (reactionState.feed.phase === 'excited') return expressionForBehavior('play', { preferFallback: true });
    if (reactionState.feed.phase === 'satisfied') return 'heart';
    return expressionForBehavior('feed');
  }
  if (reactionState.pat) {
    if (reactionState.pat.phase === 'purring') return 'heart';
    return reactionState.pat.count >= 2
      ? expressionForBehavior('pet', { preferFallback: true })
      : expressionForBehavior('pet');
  }
  switch (state.stateName) {
    case 'dancing':
    case 'clapping':
      return expressionForBehavior('play', { preferFallback: true });
    case 'typingCompanion':
      return expressionForBehavior('talk');
    case 'swing': {
      const swingPose = getSwingPose(Date.now());
      if (swingPose.ramp > 0.85 && Math.abs(swingPose.angle) > SWING_MAX_ANGLE * 0.78) {
        return expressionForBehavior('play', { preferFallback: true });
      }
      return expressionForBehavior('play');
    }
    case 'swimming':
      return expressionForBehavior('play', { preferFallback: true });
    case 'fanCooling':
    case 'airConditioning':
      return expressionForBehavior('bath');
    case 'sofaLying':
      return expressionForBehavior('sleep');
    case 'whip':
      return expressionForBehavior('whip');
    case 'waiting':
      if (state.hungerPromptStartedAt && feedBtn.classList.contains('show')) return expressionForBehavior('whip');
      return expressionForBehavior('pet');
    case 'bashful':
      return expressionForBehavior('pet', { preferFallback: true });
    case 'yawning':
    case 'sleeping':
      return expressionForBehavior('sleep');
    case 'crying':
    case 'failed':
      return expressionForBehavior('whip');
    case 'dizzy':
      return 'dizzy';
    case 'gifting':
    case 'petting':
      return expressionForBehavior('pet');
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
  // 擦掉原始眉眼嘴，避免和自动情绪脸叠出“额头残留”。
  drawCtx.beginPath();
  drawCtx.ellipse(r.x + r.w * 0.31, r.y + r.h * 0.26, r.w * 0.16, r.h * 0.10, -0.08, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.69, r.y + r.h * 0.26, r.w * 0.16, r.h * 0.10, 0.08, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.31, r.y + r.h * 0.42, r.w * 0.18, r.h * 0.23, 0, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.69, r.y + r.h * 0.42, r.w * 0.18, r.h * 0.23, 0, 0, Math.PI * 2);
  drawCtx.ellipse(r.x + r.w * 0.50, r.y + r.h * 0.70, r.w * 0.24, r.h * 0.18, 0, 0, Math.PI * 2);
  drawCtx.fill();

  // 用半透明暖色羽化边缘，让新五官更像长在脸上。
  drawCtx.globalAlpha = 0.18;
  drawCtx.fillStyle = '#f4bd8e';
  drawCtx.beginPath();
  drawCtx.ellipse(r.x + r.w * 0.50, r.y + r.h * 0.50, r.w * 0.45, r.h * 0.44, 0, 0, Math.PI * 2);
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
  if (!ENABLE_DYNAMIC_FACE) return;
  if (!FACE_ROWS.has(row)) return;
  const expr = runtimeExpressionForPreset(resolveAutoExpression());
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
    drawArcEye(drawCtx, leftX, eyeY, r.w * 0.16, r.h * 0.10, 1);
    drawArcEye(drawCtx, rightX, eyeY, r.w * 0.16, r.h * 0.10, 1);
    drawCtx.beginPath();
    drawCtx.moveTo(mouthX - r.w * 0.11, mouthY);
    drawCtx.quadraticCurveTo(mouthX, mouthY + r.h * (0.10 + beat * 0.015), mouthX + r.w * 0.11, mouthY);
    drawCtx.stroke();
    drawBlush(drawCtx, r, 0.8 + beat * 0.2);
  } else if (expr === 'shy') {
    drawArcEye(drawCtx, leftX, eyeY + r.h * 0.02, r.w * 0.17, r.h * 0.10, 1);
    drawArcEye(drawCtx, rightX, eyeY + r.h * 0.02, r.w * 0.17, r.h * 0.10, 1);
    drawCtx.beginPath();
    drawCtx.arc(mouthX, mouthY + r.h * 0.03, r.w * 0.035, 0, Math.PI * 2);
    drawCtx.stroke();
    drawBlush(drawCtx, r, 1.9);
  } else if (expr === 'sparkle' || expr === 'surprised') {
    drawStarShape(drawCtx, leftX, eyeY, r.w * (0.085 + beat * 0.012), '#ffd43b');
    drawStarShape(drawCtx, rightX, eyeY, r.w * (0.085 + beat * 0.012), '#ffd43b');
    strokeFace(drawCtx, '#d99400', Math.max(0.8, r.s * 1.2));
    drawCtx.stroke();
    strokeFace(drawCtx, ink, lw * 0.85);
    drawCtx.beginPath();
    drawCtx.ellipse(mouthX, mouthY + r.h * 0.035, r.w * 0.08, r.h * (0.085 + beat * 0.02), 0, 0, Math.PI * 2);
    drawCtx.fillStyle = '#b83b46';
    drawCtx.fill();
    drawCtx.stroke();
    drawSmallStar(drawCtx, r.x + r.w * 0.02, r.y + r.h * 0.10, r.w * 0.045);
    drawSmallStar(drawCtx, r.x + r.w * 0.98, r.y + r.h * 0.08, r.w * 0.045);
  } else if (expr === 'heart') {
    drawHeart(drawCtx, leftX, eyeY, r.w * (0.15 + beat * 0.015), '#ff4f90');
    drawHeart(drawCtx, rightX, eyeY, r.w * (0.15 + beat * 0.015), '#ff4f90');
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
    const { phase, startTime, side = 1, severity = 'light' } = reactionState.whip;
    const hitX = cx + side * 22;
    const hitY = cy + 12;
    if (phase === 'hit') {
      ctx.strokeStyle = severity === 'heavy' ? 'rgba(255, 96, 120, 0.92)' : 'rgba(255, 132, 120, 0.86)';
      ctx.lineWidth = severity === 'heavy' ? 2.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(hitX - side * 10, hitY - 10);
      ctx.lineTo(hitX + side * 5, hitY + 4);
      ctx.moveTo(hitX - side * 8, hitY - 2);
      ctx.lineTo(hitX + side * 7, hitY + 11);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 214, 94, 0.82)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hitX - side * 14, hitY - 4);
      ctx.lineTo(hitX - side * 20, hitY - 10);
      ctx.moveTo(hitX - side * 10, hitY + 6);
      ctx.lineTo(hitX - side * 17, hitY + 12);
      ctx.stroke();

      ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(cx + 11, cy - 20, 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 13, cy - 18, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (phase === 'rub') {
      const t = (Date.now() - startTime) / 200;
      ctx.strokeStyle = 'rgba(255, 150, 150, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + side * 16 + Math.sin(t) * 3, cy + 31, 6, 0, Math.PI);
      ctx.stroke();
    } else if (phase === 'pout') {
      ctx.fillStyle = 'rgba(255, 110, 150, 0.72)';
      ctx.font = '11px sans-serif';
      ctx.fillText('...', cx + side * 14, cy - 24);
    }
  }

  // 喂食 - 星星眼
  if (reactionState.feed && reactionState.feed.phase === 'excited') {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    drawSmallStar(ctx, cx - 10, cy - 25, 3);
    drawSmallStar(ctx, cx + 10, cy - 25, 3);
  } else if (reactionState.feed && reactionState.feed.phase === 'satisfied') {
    ctx.fillStyle = 'rgba(255, 186, 214, 0.78)';
    drawSmallStar(ctx, cx - 14, cy - 24, 2.5);
    drawSmallStar(ctx, cx + 12, cy - 20, 2);
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

  const cell = getPetCell();
  let stateObj = getPetStateSpec(state.stateName);
  let { sprite: drawSprite, usesBaseSheet } = getDrawableSheet(stateObj);
  if (!drawSprite?.complete || !drawSprite.naturalWidth) return;
  const maxRow = Math.floor(drawSprite.naturalHeight / cell.height) - 1;
  if (getMaxReferencedRow(stateObj) > maxRow) {
    state.stateName = 'idle';
    stateObj = getPetStateSpec('idle');
    ({ sprite: drawSprite, usesBaseSheet } = getDrawableSheet(stateObj));
    if (!drawSprite?.complete || !drawSprite.naturalWidth) return;
    state.frame = 0;
  }
  const maxCol = Math.floor(drawSprite.naturalWidth / cell.width) - 1;
  const playbackFrames = getPlaybackFrameCount(stateObj);
  const frameInterval = Number(stateObj.speed || (stateObj.fps ? 1000 / stateObj.fps : 250));
  if (!state.lastFrameAt || now - state.lastFrameAt >= frameInterval) {
    state.frame = (state.frame + 1) % playbackFrames;
    state.lastFrameAt = now;
  }
  const sourceFrame = resolveSourceFrame(stateObj, state.frame, maxRow, maxCol);

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

  // 呼吸感微动画改由脚底锚点姿态处理，避免整只角色围绕画布中心漂浮。

  // === 视线追踪：偶尔一瞥 ===
  let glanceOffsetX = 0;
  let glanceOffsetY = 0;

  // 定期采样鼠标方向（fire-and-forget，不阻塞渲染帧）
  if (now - _lastMouseSampleAt > MOUSE_SAMPLE_INTERVAL) {
    _lastMouseSampleAt = now;
    sampleMouseDirection();
  }

  // 初始化下次触发时间
  if (state.nextGlanceAt === 0) {
    state.nextGlanceAt = now + GLANCE_INTERVAL_MIN + Math.random() * (GLANCE_INTERVAL_MAX - GLANCE_INTERVAL_MIN);
  }

  // 仅在静态状态且未拖拽时触发
  if (STATIC_STATES.has(state.stateName) && !state.dragState) {
    if (state.glanceStart > 0) {
      // 正在执行一瞥
      const elapsed = now - state.glanceStart;
      if (elapsed < GLANCE_DURATION) {
        // ease-in-out: 用 sin 曲线 0→1→0
        const progress = elapsed / GLANCE_DURATION;
        const eased = Math.sin(progress * Math.PI);
        glanceOffsetX = state.glanceDirectionX * GLANCE_MAX_OFFSET * eased;
        glanceOffsetY = state.glanceDirectionY * GLANCE_MAX_OFFSET * 0.5 * eased; // Y 方向幅度减半
      } else {
        // 一瞥结束，重置
        state.glanceStart = 0;
        state.nextGlanceAt = now + GLANCE_INTERVAL_MIN + Math.random() * (GLANCE_INTERVAL_MAX - GLANCE_INTERVAL_MIN);
      }
    } else if (now >= state.nextGlanceAt) {
      // 触发新的一瞥
      state.glanceStart = now;
      state.glanceDirectionX = _lastMouseDir.x;
      state.glanceDirectionY = _lastMouseDir.y;
    }
  }

  // ===== 气泡动态定位：根据动画状态调整气泡高度 =====
  const bubbleBaseMap = {
    sleeping: 95,
    failed: 105,
    digSand: 105,
    readBook: 105,
    watchTV: 105,
    fanCooling: 112,
    airConditioning: 112,
    sofaLying: 102,
    whip: 108,
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
    swimming: 122,
    jumping: 132,
    climbing: 138,
    perching: 138,
  };
  const bubbleBottom = bubbleBaseMap[state.stateName] || 115;
  const feedOffset = (scale - 1) * 15;
  if (bubble) bubble.style.setProperty('--bubble-bottom', `${bubbleBottom + feedOffset}px`);

  const DRAW_SCALE = Number(state.currentPet?.asset?.scale) || PERSONA_DRAW_SCALE_DEFAULT;
  const drawW = _logW * DRAW_SCALE;
  const drawH = _logH * DRAW_SCALE;
  const centerX = _logW / 2;
  const centerY = _logH / 2;
  const offsetX = centerX - drawW / 2;
  const offsetY = _logH - drawH;
  const isDancing = state.stateName === 'dancing';
  const danceSequence = isDancing ? getPerformanceSequence('danceLetGo', now) : null;
  const isSwinging = state.stateName === 'swing';
  const isFanCooling = state.stateName === 'fanCooling';
  const isAirConditioning = state.stateName === 'airConditioning';
  const isSwimming = state.stateName === 'swimming';
  const usesIntegratedScene = INTEGRATED_SCENE_STATES.has(state.stateName);
  const isHungryPromptActive = Boolean(state.hungerPromptStartedAt && feedBtn.classList.contains('show'));
  const isClimbingVisual = state.climbPhase && state.climbPhase !== 'idle';
  const runningPose = state.stateName === 'runningRight'
    ? getRunningPose(now, 1)
    : state.stateName === 'runningLeft'
      ? getRunningPose(now, -1)
      : null;
  const dancePose = isDancing && !danceSequence ? getDancePose(now) : null;
  const swingPose = isSwinging && !usesIntegratedScene ? getSwingPose(now) : null;
  const fanPose = isFanCooling && !usesIntegratedScene ? getFanPose(now) : null;
  const swimmingPose = isSwimming && !usesIntegratedScene ? getSwimmingPose(now) : null;
  const hungryPose = isHungryPromptActive ? getHungryPromptPose(now) : null;
  const climbPose = isClimbingVisual ? getClimbVisualPose(now) : null;
  const personaIdlePose = state.feedScaleStart <= 0 && STATIC_STATES.has(state.stateName) && !usesIntegratedScene
    ? getPersonaIdlePose(now, state.stateName)
    : null;
  const whipPose = reactionState.whip ? getWhipPose(now) : null;
  const dancePivotX = offsetX + drawW * 0.5;
  const dancePivotY = offsetY + drawH * 0.68;
  const swingPivotX = offsetX + drawW * 0.5;
  const swingPivotY = offsetY - 8;

  if (!isClimbingVisual && !usesIntegratedScene) {
    const shadowPulse = STATIC_STATES.has(state.stateName)
      ? 0.19 + Math.sin((now % BREATH_PERIOD) / BREATH_PERIOD * Math.PI * 2) * 0.025
      : 0.16;
    drawPersonaGroundShadow(ctx, centerX, _logH - 8, drawW * 0.62, shadowPulse);
  }
  if (isClimbingVisual) {
    drawClimbBackdrop(ctx, _logW, _logH, state.climbEdgeType ?? 0, state.climbPhase, now);
  }
  if (isDancing && !danceSequence) {
    drawDanceBackdrop(ctx, dancePivotX, offsetY + drawH, now, _logW, _logH);
  }
  if (isSwinging && swingPose) {
    drawSwingBackdrop(ctx, swingPivotX, Math.max(8, offsetY - 20), swingPose);
  }
  if (isFanCooling && fanPose) {
    drawFanBackdrop(ctx, offsetX + drawW * 0.5, offsetY + drawH * 0.55, fanPose);
  }
  if (isAirConditioning && !usesIntegratedScene) {
    drawAirConditioningScene(ctx, _logW, _logH, now);
  }
  if (isSwimming && !usesIntegratedScene) {
    drawSwimmingBackdrop(ctx, offsetX + drawW * 0.5, offsetY + drawH * 0.64, now);
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
  // 视线追踪偏移
  if (glanceOffsetX !== 0 || glanceOffsetY !== 0) {
    ctx.translate(glanceOffsetX, glanceOffsetY);
  }
  if (personaIdlePose) {
    const personaPivotX = offsetX + drawW * 0.5;
    const personaPivotY = offsetY + drawH * PERSONA_FOOT_BASELINE_Y;
    ctx.translate(personaPivotX + personaIdlePose.x, personaPivotY + personaIdlePose.y);
    ctx.rotate(personaIdlePose.rotation);
    ctx.scale(personaIdlePose.scaleX, personaIdlePose.scaleY);
    ctx.translate(-personaPivotX, -personaPivotY);
  }
  if (dancePose) {
    ctx.translate(dancePivotX + dancePose.x, dancePivotY + dancePose.y);
    ctx.rotate(dancePose.rotation);
    ctx.scale(dancePose.scaleX, dancePose.scaleY);
    ctx.translate(-dancePivotX, -dancePivotY);
  }
  if (runningPose) {
    const runPivotX = offsetX + drawW * 0.5;
    const runPivotY = offsetY + drawH * 0.82;
    ctx.translate(runPivotX + runningPose.x, runPivotY + runningPose.y);
    ctx.rotate(runningPose.rotation);
    ctx.scale(runningPose.scaleX, runningPose.scaleY);
    ctx.translate(-runPivotX, -runPivotY);
  }
  if (swingPose) {
    ctx.translate(swingPivotX, swingPivotY);
    ctx.rotate(swingPose.angle);
    ctx.translate(swingPose.x, swingPose.y);
    ctx.scale(swingPose.scaleX, swingPose.scaleY);
    ctx.translate(-swingPivotX, -swingPivotY);
  }
  if (fanPose) {
    const fanPivotX = offsetX + drawW * 0.48;
    const fanPivotY = offsetY + drawH * 0.62;
    ctx.translate(fanPivotX + fanPose.x, fanPivotY + fanPose.y);
    ctx.rotate(fanPose.rotation);
    ctx.scale(fanPose.scaleX, fanPose.scaleY);
    ctx.translate(-fanPivotX, -fanPivotY);
  }
  if (swimmingPose) {
    const swimPivotX = offsetX + drawW * 0.5;
    const swimPivotY = offsetY + drawH * 0.68;
    ctx.translate(swimPivotX + swimmingPose.x, swimPivotY + swimmingPose.y);
    ctx.rotate(swimmingPose.rotation);
    ctx.scale(swimmingPose.scaleX, swimmingPose.scaleY);
    ctx.translate(-swimPivotX, -swimPivotY);
  }
  if (climbPose) {
    const climbPivotX = offsetX + drawW * 0.5;
    const climbPivotY = offsetY + drawH * 0.72;
    ctx.translate(climbPivotX + climbPose.x, climbPivotY + climbPose.y);
    ctx.rotate(climbPose.rotation);
    ctx.scale(climbPose.scaleX, climbPose.scaleY);
    ctx.translate(-climbPivotX, -climbPivotY);
  }
  if (hungryPose) {
    const hungryPivotX = offsetX + drawW * 0.5;
    const hungryPivotY = offsetY + drawH * 0.62;
    ctx.translate(hungryPivotX + hungryPose.x, hungryPivotY + hungryPose.y);
    ctx.rotate(hungryPose.rotation);
    ctx.scale(hungryPose.scaleX, hungryPose.scaleY);
    ctx.translate(-hungryPivotX, -hungryPivotY);
  }
  if (whipPose) {
    const whipPivotX = offsetX + drawW * 0.5;
    const whipPivotY = offsetY + drawH * 0.66;
    ctx.translate(whipPivotX + whipPose.x, whipPivotY + whipPose.y);
    ctx.rotate(whipPose.rotation);
    ctx.scale(whipPose.scaleX, whipPose.scaleY);
    ctx.translate(-whipPivotX, -whipPivotY);
  }
  ctx.imageSmoothingEnabled = false; // keep sprite edges crisp inside the persona shadow pass
  if (danceSequence) {
    ctx.drawImage(
      danceSequence.img,
      danceSequence.frame * cell.width,
      0,
      cell.width,
      cell.height,
      offsetX,
      offsetY,
      drawW,
      drawH
    );
  } else {
    drawPersonaSpriteWithLayerMotion(ctx, drawSprite, sourceFrame, cell, offsetX, offsetY, drawW, drawH, personaIdlePose);
  }
  if (usesBaseSheet && !danceSequence) {
    drawExpressionFace(ctx, sourceFrame.row, offsetX, offsetY, drawW, drawH, now);
  }
  ctx.restore();

  drawPersonaIdleAccent(ctx, offsetX, offsetY, drawW, drawH, now, personaIdlePose);

  // 绘制特效锚点
  const petCX = offsetX + drawW / 2 + (dancePose?.x || 0) + (runningPose?.x || 0) + (swingPose?.x || 0) + (fanPose?.x || 0) + (swimmingPose?.x || 0) + (climbPose?.x || 0) + (hungryPose?.x || 0) + (whipPose?.x || 0);
  const petCY = offsetY + drawH / 2 + (dancePose?.y || 0) + (runningPose?.y || 0) + (swingPose?.y || 0) + (fanPose?.y || 0) + (swimmingPose?.y || 0) + (climbPose?.y || 0) + (hungryPose?.y || 0) + (whipPose?.y || 0);

  if (isDancing && !danceSequence) {
    drawDanceForeground(ctx, petCX, petCY, now);
  }
  if (isSwinging && swingPose) {
    drawSwingForeground(ctx, petCX, petCY, now, swingPose);
  }
  if (isSwimming && !usesIntegratedScene) {
    drawSwimmingForeground(ctx, petCX, petCY, now);
  }
  if (isHungryPromptActive) {
    drawHungryForeground(ctx, petCX, petCY, now);
  }
  drawWhipModel(ctx, petCX, petCY, now);

  // 反应叠加
  drawReactionOverlay(ctx, petCX, petCY);

  // 启动动画拖尾粒子（传入逻辑尺寸）
  drawStartupParticles(ctx, _logW, _logH);

  // 季节粒子
  updateSeasonalParticles(deltaTime);
  drawSeasonalParticles(ctx);
}

export function startRenderLoop() {
  // 注册台词→微表情钩子：台词开始显示时自动推断匹配表情
  registerSpeechStartHook((text) => {
    const expr = inferExpressionFromText(text);
    if (expr) setSpeechExpression(expr, Math.min(text.length * 120 + 1500, 6000));
  });

  // ===== HiDPI / Retina 支持 =====
  _logW = canvas.offsetWidth || 120;
  _logH = canvas.offsetHeight || 130;
  _currentDpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(_logW * _currentDpr);
  canvas.height = Math.round(_logH * _currentDpr);
  ctx.scale(_currentDpr, _currentDpr);

  requestAnimationFrame(draw);
}
