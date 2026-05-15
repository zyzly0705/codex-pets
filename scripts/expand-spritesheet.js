/**
 * expand-spritesheet.js
 * 
 * 将现有 8×9 spritesheet (1536×1872) 扩展为 8×26 (1536×5408)
 * 新增17行动画帧，通过对现有帧进行变换生成
 * 
 * 用法: node scripts/expand-spritesheet.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const OLD_ROWS = 9;
const NEW_ROWS = 26;
const NEW_WIDTH = COLS * CELL_W;  // 1536
const NEW_HEIGHT = NEW_ROWS * CELL_H; // 5408

const INPUT_PATH = path.join(__dirname, '..', 'assets', 'yoyo', 'spritesheet.webp');
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'yoyo', 'spritesheet_expanded.png');

/**
 * 从原始像素数据中提取一帧
 */
function extractFrame(rawData, width, row, col) {
  const frame = Buffer.alloc(CELL_W * CELL_H * 4);
  const srcX = col * CELL_W;
  const srcY = row * CELL_H;
  for (let y = 0; y < CELL_H; y++) {
    const srcOffset = ((srcY + y) * width + srcX) * 4;
    const dstOffset = y * CELL_W * 4;
    rawData.copy(frame, dstOffset, srcOffset, srcOffset + CELL_W * 4);
  }
  return frame;
}

/**
 * 将一帧写入目标像素数据
 */
function placeFrame(targetData, targetWidth, row, col, frameData) {
  const dstX = col * CELL_W;
  const dstY = row * CELL_H;
  for (let y = 0; y < CELL_H; y++) {
    const srcOffset = y * CELL_W * 4;
    const dstOffset = ((dstY + y) * targetWidth + dstX) * 4;
    frameData.copy(targetData, dstOffset, srcOffset, srcOffset + CELL_W * 4);
  }
}

/**
 * 旋转帧90度（顺时针）- 用于攀爬动画
 * 输入: CELL_W × CELL_H -> 输出: 适配回 CELL_W × CELL_H
 */
function rotateFrame90(frameData) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4, 0);
  // 先旋转到 CELL_H × CELL_W 的临时buffer
  const tempW = CELL_H;
  const tempH = CELL_W;
  const temp = Buffer.alloc(tempW * tempH * 4, 0);
  
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const srcIdx = (y * CELL_W + x) * 4;
      // 顺时针90度: (x, y) -> (CELL_H - 1 - y, x)
      const newX = CELL_H - 1 - y;
      const newY = x;
      const dstIdx = (newY * tempW + newX) * 4;
      temp[dstIdx] = frameData[srcIdx];
      temp[dstIdx + 1] = frameData[srcIdx + 1];
      temp[dstIdx + 2] = frameData[srcIdx + 2];
      temp[dstIdx + 3] = frameData[srcIdx + 3];
    }
  }
  
  // 将旋转后的图像缩放/裁剪回 CELL_W × CELL_H（居中放置）
  const scaleX = CELL_W / tempW;
  const scaleY = CELL_H / tempH;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = Math.round(tempW * scale);
  const scaledH = Math.round(tempH * scale);
  const offsetX = Math.round((CELL_W - scaledW) / 2);
  const offsetY = Math.round((CELL_H - scaledH) / 2);
  
  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcIdx = (srcY * tempW + srcX) * 4;
      const dstIdx = ((y + offsetY) * CELL_W + (x + offsetX)) * 4;
      if (dstIdx + 3 < result.length && srcIdx + 3 < temp.length) {
        result[dstIdx] = temp[srcIdx];
        result[dstIdx + 1] = temp[srcIdx + 1];
        result[dstIdx + 2] = temp[srcIdx + 2];
        result[dstIdx + 3] = temp[srcIdx + 3];
      }
    }
  }
  
  return result;
}

/**
 * 水平翻转帧
 */
function flipHorizontal(frameData) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const srcIdx = (y * CELL_W + x) * 4;
      const dstIdx = (y * CELL_W + (CELL_W - 1 - x)) * 4;
      result[dstIdx] = frameData[srcIdx];
      result[dstIdx + 1] = frameData[srcIdx + 1];
      result[dstIdx + 2] = frameData[srcIdx + 2];
      result[dstIdx + 3] = frameData[srcIdx + 3];
    }
  }
  return result;
}

/**
 * 垂直位移帧
 */
function shiftY(frameData, offsetY) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4, 0);
  for (let y = 0; y < CELL_H; y++) {
    const newY = y + offsetY;
    if (newY < 0 || newY >= CELL_H) continue;
    const srcOffset = y * CELL_W * 4;
    const dstOffset = newY * CELL_W * 4;
    frameData.copy(result, dstOffset, srcOffset, srcOffset + CELL_W * 4);
  }
  return result;
}

/**
 * 水平位移帧
 */
function shiftX(frameData, offsetX) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4, 0);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const newX = x + offsetX;
      if (newX < 0 || newX >= CELL_W) continue;
      const srcIdx = (y * CELL_W + x) * 4;
      const dstIdx = (y * CELL_W + newX) * 4;
      result[dstIdx] = frameData[srcIdx];
      result[dstIdx + 1] = frameData[srcIdx + 1];
      result[dstIdx + 2] = frameData[srcIdx + 2];
      result[dstIdx + 3] = frameData[srcIdx + 3];
    }
  }
  return result;
}

/**
 * 缩放帧（中心缩放）
 */
function scaleFrame(frameData, scaleX, scaleY) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4, 0);
  const centerX = CELL_W / 2;
  const centerY = CELL_H / 2;
  
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      // 从目标坐标反推源坐标
      const srcX = Math.round(centerX + (x - centerX) / scaleX);
      const srcY = Math.round(centerY + (y - centerY) / scaleY);
      if (srcX < 0 || srcX >= CELL_W || srcY < 0 || srcY >= CELL_H) continue;
      const srcIdx = (srcY * CELL_W + srcX) * 4;
      const dstIdx = (y * CELL_W + x) * 4;
      result[dstIdx] = frameData[srcIdx];
      result[dstIdx + 1] = frameData[srcIdx + 1];
      result[dstIdx + 2] = frameData[srcIdx + 2];
      result[dstIdx + 3] = frameData[srcIdx + 3];
    }
  }
  return result;
}

/**
 * 小角度旋转帧（以中心为圆心旋转 degrees 度）
 */
function rotateSmall(frameData, degrees) {
  const result = Buffer.alloc(CELL_W * CELL_H * 4, 0);
  const rad = degrees * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const centerX = CELL_W / 2;
  const centerY = CELL_H / 2;
  
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const srcX = Math.round(centerX + dx * cos + dy * sin);
      const srcY = Math.round(centerY - dx * sin + dy * cos);
      if (srcX < 0 || srcX >= CELL_W || srcY < 0 || srcY >= CELL_H) continue;
      const srcIdx = (srcY * CELL_W + srcX) * 4;
      const dstIdx = (y * CELL_W + x) * 4;
      result[dstIdx] = frameData[srcIdx];
      result[dstIdx + 1] = frameData[srcIdx + 1];
      result[dstIdx + 2] = frameData[srcIdx + 2];
      result[dstIdx + 3] = frameData[srcIdx + 3];
    }
  }
  return result;
}

async function main() {
  console.log('=== Spritesheet 扩展脚本 ===');
  console.log(`输入: ${INPUT_PATH}`);
  console.log(`输出: ${OUTPUT_PATH}`);
  
  // 加载原始 spritesheet
  const inputImage = sharp(INPUT_PATH);
  const metadata = await inputImage.metadata();
  console.log(`原始尺寸: ${metadata.width}×${metadata.height}`);
  
  // 获取原始像素数据 (RGBA)
  const { data: rawData, info } = await inputImage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  console.log(`像素数据: ${info.width}×${info.height}, channels=${info.channels}`);
  
  // 创建新的画布 (全透明)
  const targetData = Buffer.alloc(NEW_WIDTH * NEW_HEIGHT * 4, 0);
  
  // 复制原有9行到新画布
  console.log('复制原有 9 行...');
  for (let y = 0; y < OLD_ROWS * CELL_H; y++) {
    const srcOffset = y * info.width * 4;
    const dstOffset = y * NEW_WIDTH * 4;
    const bytesPerRow = Math.min(info.width, NEW_WIDTH) * 4;
    rawData.copy(targetData, dstOffset, srcOffset, srcOffset + bytesPerRow);
  }
  
  // ===== 第10行 (row 9) - 攀爬动画 =====
  // 取 runningRight (row 1) 的帧，旋转90度
  console.log('生成第10行: 攀爬动画...');
  for (let i = 0; i < 6; i++) {
    const srcFrame = extractFrame(rawData, info.width, 1, i);
    const rotated = rotateFrame90(srcFrame);
    placeFrame(targetData, NEW_WIDTH, 9, i, rotated);
  }
  
  // ===== 第11行 (row 10) - 趴着/探头 =====
  // 取 idle (row 0) 的帧，向下位移 + 轻微左右摇摆
  console.log('生成第11行: 趴着/探头...');
  const perchShifts = [0, 3, -3, 2]; // 左右摇摆偏移
  for (let i = 0; i < 4; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const shifted = shiftY(srcFrame, 40); // 向下位移40px（半身露出）
    const swayed = shiftX(shifted, perchShifts[i]); // 轻微左右摇摆
    placeFrame(targetData, NEW_WIDTH, 10, i, swayed);
  }
  
  // ===== 第12行 (row 11) - 抚摸反应（闭眼享受）=====
  // 取 waving (row 3) 的帧做镜像变换 + 略微缩放（呼吸感）
  console.log('生成第12行: 抚摸反应...');
  const pettingScales = [1.0, 1.03, 1.0, 0.97]; // 呼吸感缩放
  for (let i = 0; i < 4; i++) {
    const srcFrame = extractFrame(rawData, info.width, 3, i);
    const flipped = flipHorizontal(srcFrame);
    const scaled = scaleFrame(flipped, pettingScales[i], pettingScales[i]);
    placeFrame(targetData, NEW_WIDTH, 11, i, scaled);
  }
  
  // ===== 第13行 (row 12) - 打哈欠/伸懒腰 =====
  // 取 idle 帧，加上下拉伸变换（伸懒腰），交替正常/拉伸
  console.log('生成第13行: 打哈欠/伸懒腰...');
  const yawnScales = [1.0, 1.08, 1.12, 1.08, 1.0]; // Y轴拉伸
  for (let i = 0; i < 5; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const stretched = scaleFrame(srcFrame, 1.0, yawnScales[i]);
    placeFrame(targetData, NEW_WIDTH, 12, i, stretched);
  }
  
  // ===== 第14行 (row 13) - 吃东西 =====
  // 取 idle 帧做小幅度上下颤动（咀嚼感）
  console.log('生成第14行: 吃东西...');
  const eatOffsets = [2, -2, 3, -1, 2, -2]; // 咀嚼Y偏移
  for (let i = 0; i < 6; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const shifted = shiftY(srcFrame, eatOffsets[i]);
    placeFrame(targetData, NEW_WIDTH, 13, i, shifted);
  }
  
  // ===== 第15行 (row 14) - 被打晕眩 =====
  // 取 failed (row 5) 的帧，加旋转（左右交替倾斜5-10度）
  console.log('生成第15行: 被打晕眩...');
  const dizzyAngles = [7, -7, 10, -10]; // 交替倾斜角度
  for (let i = 0; i < 4; i++) {
    const srcFrame = extractFrame(rawData, info.width, 5, i);
    const rotated = rotateSmall(srcFrame, dizzyAngles[i]);
    placeFrame(targetData, NEW_WIDTH, 14, i, rotated);
  }
  
  // ===== 第16行 (row 15) - 左顾右盼 =====
  // 取 idle 帧第一帧，做水平翻转交替
  console.log('生成第16行: 左顾右盼...');
  const idleFrame0 = extractFrame(rawData, info.width, 0, 0);
  const idleFrame0Flipped = flipHorizontal(idleFrame0);
  const lookFrames = [idleFrame0, idleFrame0Flipped, idleFrame0, idleFrame0Flipped, idleFrame0];
  for (let i = 0; i < 5; i++) {
    placeFrame(targetData, NEW_WIDTH, 15, i, lookFrames[i]);
  }
  
  // ===== 第17行 (row 16) - 荡秋千 =====
  // 基于idle帧做左右摇摆变换（rotate ±15度交替）
  console.log('生成第17行: 荡秋千...');
  const swingAngles = [-15, -8, 0, 8, 15, 8, 0, -8];
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const rotated = rotateSmall(srcFrame, swingAngles[i]);
    placeFrame(targetData, NEW_WIDTH, 16, i, rotated);
  }
  
  // ===== 第18行 (row 17) - 挖土/玩沙 =====
  // 基于idle帧做蹲下+手臂动作（向下位移+小幅旋转交替）
  console.log('生成第18行: 挖土/玩沙...');
  const digShifts = [20, 25, 30, 25, 20, 25, 30, 25];
  const digAngles = [0, 5, -3, 5, 0, -5, 3, -5];
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const shifted = shiftY(srcFrame, digShifts[i]);
    const rotated = rotateSmall(shifted, digAngles[i]);
    placeFrame(targetData, NEW_WIDTH, 17, i, rotated);
  }
  
  // ===== 第19行 (row 18) - 看书 =====
  // 基于idle帧做坐姿+翻页（下半部分压缩模拟坐姿+轻微左右移动）
  console.log('生成第19行: 看书...');
  const readShiftsX = [0, 1, 2, 1, 0, -1, -2, -1];
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    // 模拟坐姿：压缩Y方向 + 向下位移
    const seated = scaleFrame(srcFrame, 1.0, 0.85);
    const shifted = shiftY(seated, 30);
    const swayed = shiftX(shifted, readShiftsX[i]);
    placeFrame(targetData, NEW_WIDTH, 18, i, swayed);
  }
  
  // ===== 第20行 (row 19) - 看电视 =====
  // 基于idle帧做坐姿+偶尔转头（下半部分压缩+偶尔帧水平翻转）
  console.log('生成第20行: 看电视...');
  const tvFlipFrames = [false, false, false, true, true, false, false, true]; // 偶尔转头
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    // 模拟坐姿
    const seated = scaleFrame(srcFrame, 1.0, 0.85);
    const shifted = shiftY(seated, 30);
    const finalFrame = tvFlipFrames[i] ? flipHorizontal(shifted) : shifted;
    placeFrame(targetData, NEW_WIDTH, 19, i, finalFrame);
  }
  
  // ===== 第21行 (row 20) - 睡觉 (sleeping) =====
  // 基于 idle 帧，模拟闭眼+呼吸起伏
  console.log('生成第21行: 睡觉...');
  const sleepBreathScales = [0.98, 1.0, 1.02, 1.0, 0.98, 1.0, 1.02, 1.0]; // 呼吸Y缩放
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    // 呼吸感：Y方向缩放 + 向下位移模拟躺/趴
    const breathed = scaleFrame(srcFrame, 1.0, sleepBreathScales[i]);
    const shifted = shiftY(breathed, 15); // 重心降低
    placeFrame(targetData, NEW_WIDTH, 20, i, shifted);
  }

  // ===== 第22行 (row 21) - 跳舞 (dancing) =====
  // 基于 idle 帧，模拟扭动/转圈
  console.log('生成第22行: 跳舞...');
  const danceAngles = [10, -10, 8, -8, 10, -10, 8, -8]; // 左右倾斜
  const danceShiftsX = [5, -5, 3, -3, 5, -5, 3, -3];   // 左右位移
  const danceFlip = [false, false, true, false, false, true, false, true]; // 部分帧翻转
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const rotated = rotateSmall(srcFrame, danceAngles[i]);
    const shifted = shiftX(rotated, danceShiftsX[i]);
    const finalFrame = danceFlip[i] ? flipHorizontal(shifted) : shifted;
    placeFrame(targetData, NEW_WIDTH, 21, i, finalFrame);
  }

  // ===== 第23行 (row 22) - 哭/委屈 (crying) =====
  // 基于 idle 帧，模拟擦眼泪+抽泣
  console.log('生成第23行: 哭/委屈...');
  const cryShiftsY = [2, -2, 2, -2, 1, -1, 2, -2]; // 抽泣上下抖动
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    // 整体略微缩小模拟蜷缩
    const shrunk = scaleFrame(srcFrame, 0.95, 0.95);
    const shifted = shiftY(shrunk, cryShiftsY[i]);
    placeFrame(targetData, NEW_WIDTH, 22, i, shifted);
  }

  // ===== 第24行 (row 23) - 送花送礼 (gifting) =====
  // 基于 idle 帧，双手举起动作
  console.log('生成第24行: 送花送礼...');
  const giftShiftsY = [-8, -10, -12, -10, -8, -10, -12, -10]; // 上半部分向上
  const giftShiftsX = [2, -2, 0, 2, -2, 0, 2, -2];            // 左右轻微摆动
  const giftScales = [1.0, 1.03, 1.03, 1.0, 1.03, 1.03, 1.0, 1.0]; // 部分帧放大
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const scaled = scaleFrame(srcFrame, giftScales[i], giftScales[i]);
    const shiftedY = shiftY(scaled, giftShiftsY[i]);
    const shiftedXY = shiftX(shiftedY, giftShiftsX[i]);
    placeFrame(targetData, NEW_WIDTH, 23, i, shiftedXY);
  }

  // ===== 第25行 (row 24) - 伸懒腰 (stretching) =====
  // 基于 idle 帧，模拟起床伸展
  console.log('生成第25行: 伸懒腰...');
  const stretchScalesY = [1.05, 1.08, 1.1, 1.08, 1.05, 1.08, 1.1, 1.08]; // Y拉伸
  const stretchShiftsX = [2, -2, 0, 2, -2, 0, 2, -2]; // 左右轻微扭动
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const stretched = scaleFrame(srcFrame, 1.0, stretchScalesY[i]);
    const shifted = shiftX(stretched, stretchShiftsX[i]);
    placeFrame(targetData, NEW_WIDTH, 24, i, shifted);
  }

  // ===== 第26行 (row 25) - 拍手 (clapping) =====
  // 基于 idle 帧，模拟拍手/鼓掌
  console.log('生成第26行: 拍手...');
  const clapShiftsX = [3, -3, 3, -3, 3, -3, 3, -3]; // 快速左右小幅位移
  const clapShiftsY = [2, -2, 2, -2, 2, -2, 2, -2]; // 轻微上下跳动
  for (let i = 0; i < 8; i++) {
    const srcFrame = extractFrame(rawData, info.width, 0, i % 6);
    const shiftedX = shiftX(srcFrame, clapShiftsX[i]);
    const shiftedXY = shiftY(shiftedX, clapShiftsY[i]);
    placeFrame(targetData, NEW_WIDTH, 25, i, shiftedXY);
  }

  // 输出为 PNG
  console.log('正在写入输出文件...');
  await sharp(targetData, {
    raw: {
      width: NEW_WIDTH,
      height: NEW_HEIGHT,
      channels: 4
    }
  })
    .png()
    .toFile(OUTPUT_PATH);
  
  console.log(`✅ 完成! 输出: ${OUTPUT_PATH}`);
  console.log(`   尺寸: ${NEW_WIDTH}×${NEW_HEIGHT} (${COLS}×${NEW_ROWS} cells)`);
  
  // 同时输出一个 webp 版本
  const webpPath = OUTPUT_PATH.replace('.png', '.webp');
  await sharp(targetData, {
    raw: {
      width: NEW_WIDTH,
      height: NEW_HEIGHT,
      channels: 4
    }
  })
    .webp({ quality: 90, lossless: true })
    .toFile(webpPath);
  
  console.log(`✅ WebP 版本: ${webpPath}`);
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
