#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CELL_W = 192;
const CELL_H = 208;
const COLUMNS = 8;

const STRIPS = [
  {
    action: 'fanCooling',
    source: 'assets-src/yoyo/reference-strips/fanCooling-strip.png',
  },
  {
    action: 'whip',
    source: 'assets-src/yoyo/reference-strips/whip-strip.png',
  },
];

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isWhiteMatte(raw, index) {
  const r = raw[index];
  const g = raw[index + 1];
  const b = raw[index + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 238 && max - min <= 22;
}

function removeEdgeMatte(raw, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const index = p * 4;
    if (raw[index + 3] === 0 || isWhiteMatte(raw, index)) {
      seen[p] = 1;
      queue.push(p);
    }
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const p = queue.pop();
    const x = p % width;
    const y = Math.floor(p / width);
    raw[p * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return raw;
}

function alphaBox(raw, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = raw[(y * width + x) * 4 + 3];
      if (alpha > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function importStrip(config) {
  const sourcePath = path.join(ROOT, config.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing reference strip: ${rel(sourcePath)}`);
  }

  const meta = await sharp(sourcePath).metadata();
  if (meta.width !== CELL_W * COLUMNS || meta.height < CELL_H) {
    throw new Error(`${rel(sourcePath)} must be ${CELL_W * COLUMNS}x${CELL_H}+; got ${meta.width}x${meta.height}`);
  }

  const outputDir = path.join(ROOT, 'assets-src', 'yoyo', 'frames', config.action);
  ensureDir(outputDir);

  const summaries = [];
  for (let col = 0; col < COLUMNS; col += 1) {
    const { data, info } = await sharp(sourcePath)
      .extract({ left: col * CELL_W, top: 0, width: CELL_W, height: CELL_H })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cleaned = removeEdgeMatte(data, info.width, info.height);
    const box = alphaBox(cleaned, info.width, info.height);
    const output = path.join(outputDir, `${String(col).padStart(2, '0')}.png`);

    await sharp(cleaned, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(output);

    summaries.push({
      frame: col,
      opaqueBox: box,
    });
  }

  console.log(`Imported ${config.action}: ${rel(sourcePath)} -> ${rel(outputDir)}`);
  return summaries;
}

async function main() {
  const report = {};
  for (const strip of STRIPS) {
    report[strip.action] = await importStrip(strip);
  }

  const reportPath = path.join(ROOT, 'assets-src', 'yoyo', 'qa', 'reference-strip-import.json');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${rel(reportPath)}`);
}

main().catch((error) => {
  console.error(`Reference strip import failed: ${error.message}`);
  process.exit(1);
});
