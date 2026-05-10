// startup-animation.js - 启动旋转飞入动画
import { state } from './core-state.js';

// 启动动画状态
export const startupAnim = {
  active: false,
  startTime: 0,
  duration: 1800, // 总时长 1.8 秒
  phase: 'idle',   // 'flying' | 'landing' | 'done'
  rotation: 0,     // 当前旋转角度
  scale: 1,        // 当前缩放
  offsetX: 0,      // 相对最终位置的偏移
  offsetY: 0,
  particles: [],   // 拖尾粒子
};

const MAX_PARTICLES = 15;

export function startEntryAnimation() {
  // 仅首次启动播放
  if (sessionStorage.getItem('yoyo_entered')) return;

  startupAnim.active = true;
  startupAnim.startTime = Date.now();
  startupAnim.phase = 'flying';
  startupAnim.rotation = Math.PI * 6; // 初始旋转量（3圈）
  startupAnim.scale = 0.2;
  startupAnim.offsetX = 150;  // 从右上方飞入
  startupAnim.offsetY = -120;
  startupAnim.particles = [];
}

export function updateStartupAnimation() {
  if (!startupAnim.active) return false;

  const elapsed = Date.now() - startupAnim.startTime;
  const progress = Math.min(elapsed / startupAnim.duration, 1);

  if (progress < 0.7) {
    // 飞入阶段 (0-70%)：旋转减速 + 位移趋零
    const flyProgress = progress / 0.7;
    const eased = 1 - Math.pow(1 - flyProgress, 3); // easeOutCubic

    startupAnim.rotation = Math.PI * 6 * (1 - eased);
    startupAnim.scale = 0.2 + 0.8 * eased;
    startupAnim.offsetX = 150 * (1 - eased);
    startupAnim.offsetY = -120 * (1 - eased);
    startupAnim.phase = 'flying';

    // 生成拖尾粒子（限制最大数量）
    if (Math.random() < 0.4 && startupAnim.particles.length < MAX_PARTICLES) {
      startupAnim.particles.push({
        x: startupAnim.offsetX + (Math.random() - 0.5) * 20,
        y: startupAnim.offsetY + (Math.random() - 0.5) * 20,
        life: 1,
        size: 2 + Math.random() * 3,
        color: `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 20}%)`,
      });
    }
  } else if (progress < 1) {
    // 着陆阶段 (70-100%)：弹跳 squash & stretch
    const landProgress = (progress - 0.7) / 0.3;
    startupAnim.rotation = 0;
    startupAnim.offsetX = 0;
    startupAnim.offsetY = 0;
    startupAnim.phase = 'landing';

    // 弹跳效果：先压扁再恢复
    const bounce = Math.sin(landProgress * Math.PI * 2) * (1 - landProgress) * 0.15;
    startupAnim.scale = 1 + bounce;
  } else {
    // 完成
    startupAnim.active = false;
    startupAnim.phase = 'done';
    startupAnim.rotation = 0;
    startupAnim.scale = 1;
    startupAnim.offsetX = 0;
    startupAnim.offsetY = 0;
    startupAnim.particles = [];
    sessionStorage.setItem('yoyo_entered', '1');
    return false;
  }

  // 更新粒子
  startupAnim.particles = startupAnim.particles.filter(p => {
    p.life -= 0.03;
    p.y += 0.5;
    p.x *= 0.98;
    return p.life > 0;
  });

  return true;
}

// 绘制拖尾粒子（在 render-engine 的 drawFrame 中调用）
export function drawStartupParticles(ctx, canvasW, canvasH) {
  if (!startupAnim.active || startupAnim.particles.length === 0) return;

  for (const p of startupAnim.particles) {
    ctx.globalAlpha = p.life * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(canvasW / 2 + p.x, canvasH / 2 + p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
