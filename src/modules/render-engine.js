// render-engine.js - Canvas 渲染主循环（drawFrame, 动画帧计算）
import { state, canvas, ctx, STATES, CELL_W, CELL_H, FEED_SCALE_DURATION, FEED_SCALE_MAX, playSound, reactionState, braidPhysics } from './core-state.js';
import { drawEquippedAccessories } from './outfit-system.js';
import { updateSeasonalParticles, drawSeasonalParticles } from './weather-seasonal.js';
import { startupAnim, updateStartupAnimation, drawStartupParticles } from './startup-animation.js';

// ===== 辫子物理更新 =====
function updateBraidPhysics(velX, velY) {
  const { points, stiffness, damping, gravity } = braidPhysics;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = prev.x - curr.x;
    const dy = (prev.y + 8) - curr.y;
    curr.vx += dx * stiffness - velX * 0.3;
    curr.vy += dy * stiffness + gravity;
    curr.vx *= damping;
    curr.vy *= damping;
    curr.x += curr.vx;
    curr.y += curr.vy;
  }
}

// ===== 绘制辫子 =====
function drawBraid(ctx, baseX, baseY) {
  const { points } = braidPhysics;
  ctx.save();
  ctx.strokeStyle = '#4a2800';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX + points[0].x, baseY + points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.quadraticCurveTo(
      baseX + points[i - 1].x + (points[i].x - points[i - 1].x) * 0.5,
      baseY + points[i - 1].y + (points[i].y - points[i - 1].y) * 0.5,
      baseX + points[i].x, baseY + points[i].y
    );
  }
  ctx.stroke();
  // 末端发饰小球
  const last = points[points.length - 1];
  ctx.fillStyle = '#ff6b9d';
  ctx.beginPath();
  ctx.arc(baseX + last.x, baseY + last.y, 3, 0, Math.PI * 2);
  ctx.fill();
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  const DRAW_SCALE = 0.75;
  const drawW = canvas.width * DRAW_SCALE;
  const drawH = canvas.height * DRAW_SCALE;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const offsetX = centerX - drawW / 2;
  const offsetY = canvas.height - drawH;

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
  ctx.drawImage(state.sprite, state.frame * CELL_W, stateObj.row * CELL_H, CELL_W, CELL_H, offsetX, offsetY, drawW, drawH);
  ctx.restore();

  // 绘制配件
  const petCX = offsetX + drawW / 2;
  const petCY = offsetY + drawH / 2;
  drawEquippedAccessories(ctx, petCX, petCY, DRAW_SCALE * scale);

  // 辫子物理更新和绘制
  const vel = reactionState.drag ? reactionState.drag.velocity : { x: 0, y: 0 };
  updateBraidPhysics(vel.x, vel.y);
  drawBraid(ctx, offsetX + drawW * 0.76, offsetY + drawH * 0.1);

  // 反应叠加
  drawReactionOverlay(ctx, petCX, petCY);

  // 启动动画拖尾粒子
  drawStartupParticles(ctx, canvas.width, canvas.height);

  // 季节粒子
  updateSeasonalParticles(deltaTime);
  drawSeasonalParticles(ctx);
}

export function startRenderLoop() {
  requestAnimationFrame(draw);
}
