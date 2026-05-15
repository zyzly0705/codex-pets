#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = process.argv[2] || '/Users/zhangyazhou/Downloads/image.png';
const OUT = path.join(ROOT, 'assets', 'gugu-gaga', 'spritesheet.webp');
const CONTACT = path.join(ROOT, 'assets', 'gugu-gaga', 'contact-sheet.png');
const FRAME_DIR = path.join(ROOT, 'assets', 'gugu-gaga', 'reference-frames');

const SRC_COLS = 6;
const SRC_ROWS = 8;
const CELL_W = 192;
const CELL_H = 208;
const TARGET_COLS = 8;
const TARGET_ROWS = 37;

const ROW_SOURCES = {
  0: [0, 0],   // idle / happy
  1: [0, 1],   // running right fallback
  2: [2, 0],   // side/walk
  3: [0, 0],   // waving
  4: [3, 0],   // jumping / excited
  5: [6, 2],   // crying/failed
  6: [2, 3],   // waiting side/front mix
  7: [0, 4],   // bashful/heart
  8: [3, 2],   // review / laptop
  9: [2, 0],   // climbing fallback
  10: [5, 4],  // perching / back
  11: [0, 3],  // petting/happy
  12: [2, 3],  // yawning
  13: [4, 0],  // eating/gold snack
  14: [6, 2],  // dizzy/cry fallback
  15: [2, 1],  // looking around
  16: [3, 3],  // swing/excited
  17: [4, 1],  // dig/special item fallback
  18: [3, 2],  // read/review fallback
  19: [3, 3],  // watch/game fallback
  20: [7, 0],  // sleeping/back fallback
  21: [3, 0],  // dancing
  22: [6, 2],  // crying
  23: [0, 4],  // gifting / hearts
  24: [0, 2],  // stretching
  25: [3, 5],  // clapping
  26: [2, 4],  // fan cooling fallback
  27: [2, 2],  // swimming fallback
  28: [6, 3],  // whip / hurt
  29: [0, 5],  // air conditioning fallback
  30: [7, 2],  // sofa lying/back fallback
  31: [0, 0],
  32: [3, 2],  // typing companion / laptop
  33: [0, 0],
  34: [0, 4],
  35: [7, 1],
  36: [0, 1],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function removeConnectedBackground(input) {
  const image = sharp(input).ensureAlpha();
  const meta = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function idx(x, y) {
    return y * width + x;
  }
  function rgbaAt(i) {
    const offset = i * 4;
    return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
  }
  function push(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = idx(x, y);
    if (visited[i]) return;
    visited[i] = 1;
    queue.push(i);
  }

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  const cornerColors = [
    rgbaAt(idx(0, 0)),
    rgbaAt(idx(width - 1, 0)),
    rgbaAt(idx(0, height - 1)),
    rgbaAt(idx(width - 1, height - 1)),
  ];
  const bg = cornerColors
    .sort((a, b) => {
      const scoreA = cornerColors.reduce((sum, color) => sum + colorDistance(a, color), 0);
      const scoreB = cornerColors.reduce((sum, color) => sum + colorDistance(b, color), 0);
      return scoreA - scoreB;
    })[0];
  const removed = new Uint8Array(width * height);
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = Math.floor(i / width);
    const color = rgbaAt(i);
    const fromBackground = color[3] < 12 || colorDistance(color, bg) < 34;
    if (!fromBackground) continue;
    removed[i] = 1;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      const nColor = rgbaAt(ni);
      if (nColor[3] < 12 || colorDistance(nColor, bg) < 34) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }

  for (let i = 0; i < removed.length; i++) {
    if (!removed[i]) continue;
    data[i * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function trimToCell(input) {
  const keyed = await removeConnectedBackground(input);
  const png = await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .png()
    .toBuffer()
    .catch(async () => keyed);

  const meta = await sharp(png).metadata();
  const scale = Math.min(1, 176 / meta.width, 194 / meta.height);
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));
  const resized = await sharp(png)
    .resize(width, height, { fit: 'contain' })
    .png()
    .toBuffer();
  const left = Math.round((CELL_W - width) / 2);
  const top = Math.round(CELL_H - height - 6);
  return sharp({
    create: {
      width: CELL_W,
      height: CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: clamp(left, 0, CELL_W - width), top: clamp(top, 0, CELL_H - height) }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  if (!meta.width || !meta.height) throw new Error(`Cannot read ${SOURCE}`);
  const frames = [];
  for (let row = 0; row < SRC_ROWS; row++) {
    frames[row] = [];
    for (let col = 0; col < SRC_COLS; col++) {
      const left = Math.round((col * meta.width) / SRC_COLS);
      const right = Math.round(((col + 1) * meta.width) / SRC_COLS);
      const top = Math.round((row * meta.height) / SRC_ROWS);
      const bottom = Math.round(((row + 1) * meta.height) / SRC_ROWS);
      const raw = await sharp(SOURCE)
        .extract({
          left,
          top,
          width: right - left,
          height: bottom - top,
        })
        .png()
        .toBuffer();
      const cell = await trimToCell(raw);
      frames[row][col] = cell;
      await sharp(cell).png().toFile(path.join(FRAME_DIR, `r${row}_c${col}.png`));
    }
  }

  const composites = [];
  for (let targetRow = 0; targetRow < TARGET_ROWS; targetRow++) {
    const [srcRow, offset] = ROW_SOURCES[targetRow] || [0, 0];
    for (let col = 0; col < TARGET_COLS; col++) {
      const sourceCol = (col + offset) % SRC_COLS;
      composites.push({
        input: frames[clamp(srcRow, 0, SRC_ROWS - 1)][sourceCol],
        left: col * CELL_W,
        top: targetRow * CELL_H,
      });
    }
  }

  await sharp({
    create: {
      width: TARGET_COLS * CELL_W,
      height: TARGET_ROWS * CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 94, effort: 6 })
    .toFile(OUT);

  const contactComposites = [];
  for (let row = 0; row < Math.min(33, TARGET_ROWS); row++) {
    const [srcRow, offset] = ROW_SOURCES[row] || [0, 0];
    for (let col = 0; col < TARGET_COLS; col++) {
      const sourceCol = (col + offset) % SRC_COLS;
      const small = await sharp(frames[clamp(srcRow, 0, SRC_ROWS - 1)][sourceCol])
        .resize(96, 104, { fit: 'contain' })
        .png()
        .toBuffer();
      contactComposites.push({ input: small, left: col * 96, top: row * 104 });
    }
  }
  await sharp({
    create: { width: TARGET_COLS * 96, height: 33 * 104, channels: 4, background: '#f2f4f6' },
  })
    .composite(contactComposites)
    .png()
    .toFile(CONTACT);

  const outMeta = await sharp(OUT).metadata();
  console.log(`Imported ${SOURCE}`);
  console.log(`Generated ${path.relative(ROOT, OUT)} ${outMeta.width}x${outMeta.height}`);
  console.log(`Generated ${path.relative(ROOT, CONTACT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
