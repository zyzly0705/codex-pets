/**
 * generate-face-spritesheets.js
 *
 * 为默认宠物生成“表情版整张 spritesheet”。
 *
 * 为什么不是继续把 face_*.svg 作为普通配件叠在 canvas 上？
 * - 普通贴片只有一个固定 offset，跑步/睡觉/跳舞等动作会出现漂移或双脸。
 * - Codex/Shimeji/VPet 这类桌宠更常见的是：动作帧资产负责表情，帽子/围巾等才作为可叠加层。
 *
 * 本脚本只处理头部位置相对稳定的动作行：先用肤色小椭圆“擦掉”原眼睛/嘴，
 * 再叠加当前表情 SVG，输出 spritesheet_face_*.webp。
 * 跑步/睡觉/哭泣/攀爬等头部变化大的动作保留原帧，避免固定锚点造成漂移或双脸。
 *
 * 用法：node scripts/generate-face-spritesheets.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PET_DIR = path.join(__dirname, '..', 'assets', 'xiao-hong');
const ACCESSORY_DIR = path.join(__dirname, '..', 'assets', 'accessories');
const BASE_SPRITESHEET = path.join(PET_DIR, 'spritesheet.webp');

const CELL_W = 192;
const CELL_H = 208;
const FACE_IDS = ['happy', 'shy', 'sparkle', 'heart', 'sleepy'];

// 只给头部位置稳定的行换表情；其它行保留原始帧，避免“固定锚点硬贴”的漂移问题。
// 对应：idle, waving, waiting, bashful, review, petting, yawning,
// lookingAround, gifting, stretching, clapping。
const SAFE_FACE_ROWS = new Set([0, 3, 6, 7, 8, 11, 12, 15, 23, 24, 25]);

// 当前 Xiao Hong 头脸位置的统一近似锚点。后续如果做 manifest，可把这些移到 pet.json。
const FACE_ANCHOR = {
  x: 64,
  y: 43,
  width: 64,
  height: 44,
};

const FACE_ERASE = {
  left: FACE_ANCHOR.x - 3,
  top: FACE_ANCHOR.y + 4,
  width: FACE_ANCHOR.width + 6,
  height: FACE_ANCHOR.height - 2,
  fill: '#e7a777',
  opacity: 0.96,
};

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function eraseFaceSvg() {
  const { left, top, width, height, fill, opacity } = FACE_ERASE;
  const rx = Math.round(width * 0.45);
  const ry = Math.round(height * 0.48);
  const cx = left + width / 2;
  const cy = top + height / 2;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${escapeXml(fill)}" opacity="${opacity}"/>
    </svg>
  `);
}

async function metadata(file) {
  return sharp(file).metadata();
}

async function main() {
  const baseMeta = await metadata(BASE_SPRITESHEET);
  if (!baseMeta.width || !baseMeta.height) {
    throw new Error(`无法读取 spritesheet 尺寸：${BASE_SPRITESHEET}`);
  }
  if (baseMeta.width % CELL_W !== 0 || baseMeta.height % CELL_H !== 0) {
    throw new Error(`spritesheet 尺寸不是 ${CELL_W}×${CELL_H} 的整数倍：${baseMeta.width}×${baseMeta.height}`);
  }

  const cols = baseMeta.width / CELL_W;
  const rows = baseMeta.height / CELL_H;
  const frameCount = cols * rows;
  console.log(`基础 spritesheet: ${baseMeta.width}×${baseMeta.height}, ${cols}×${rows} = ${frameCount} 帧`);

  const erase = eraseFaceSvg();

  for (const faceId of FACE_IDS) {
    const faceSvg = path.join(ACCESSORY_DIR, `face_${faceId}.svg`);
    const output = path.join(PET_DIR, `spritesheet_face_${faceId}.webp`);
    if (!fs.existsSync(faceSvg)) {
      console.warn(`跳过 ${faceId}: 缺少 ${faceSvg}`);
      continue;
    }

    const facePng = await sharp(faceSvg)
      .resize(FACE_ANCHOR.width, FACE_ANCHOR.height, { fit: 'contain' })
      .png()
      .toBuffer();

    const composites = [];
    for (let row = 0; row < rows; row++) {
      if (!SAFE_FACE_ROWS.has(row)) continue;
      for (let col = 0; col < cols; col++) {
        const frameLeft = col * CELL_W;
        const frameTop = row * CELL_H;
        composites.push({ input: erase, left: frameLeft, top: frameTop });
        composites.push({
          input: facePng,
          left: frameLeft + FACE_ANCHOR.x,
          top: frameTop + FACE_ANCHOR.y,
        });
      }
    }

    await sharp(BASE_SPRITESHEET, { animated: false })
      .ensureAlpha()
      .composite(composites)
      .webp({ quality: 92, effort: 6 })
      .toFile(output);

    const outMeta = await metadata(output);
    console.log(`生成 ${path.basename(output)}: ${outMeta.width}×${outMeta.height}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});