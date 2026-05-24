#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const sourceArg = args.find((arg) => arg.startsWith('--source='));
const actionsArg = args.find((arg) => arg.startsWith('--actions='));
const SOURCE = sourceArg
  ? path.resolve(sourceArg.slice('--source='.length))
  : path.join(ROOT, 'assets-src', 'yoyo', 'reference-sheets', 'image22.png');
const actionFilter = actionsArg
  ? new Set(actionsArg.slice('--actions='.length).split(',').map((item) => item.trim()).filter(Boolean))
  : null;
const CELL_W = 192;
const CELL_H = 208;

const ACTIONS = [
  { action: 'sleeping', row: { x: 170, y: 68, width: 830, height: 120 }, frames: 6, outputFrames: 8, scale: 1.18, anchorY: 0.6 },
  { action: 'lookingAround', row: { x: 170, y: 216, width: 830, height: 136 }, frames: 6, outputFrames: 8, scale: 1.08, anchorY: 0.58 },
  { action: 'clapping', row: { x: 170, y: 372, width: 830, height: 135 }, frames: 6, outputFrames: 8, scale: 1.08, anchorY: 0.58 },
  { action: 'readBook', row: { x: 170, y: 530, width: 830, height: 125 }, frames: 6, outputFrames: 8, scale: 1.08, anchorY: 0.59 },
  {
    action: 'typingCompanion',
    row: { x: 20, y: 704, width: 980, height: 450 },
    frames: 18,
    outputFrames: 8,
    scale: 1.03,
    anchorY: 0.6,
    rowBands: [
      { y: 704, height: 150 },
      { y: 872, height: 130 },
      { y: 1018, height: 130 },
    ],
  },
  {
    action: 'sofaLying',
    row: { x: 20, y: 1178, width: 980, height: 123 },
    frames: 6,
    outputFrames: 8,
    scale: 1.1,
    anchorY: 0.58,
    extension: { action: 'sofaLying2', sequence: [6, 5, 4, 3, 2, 1, 0, 1] },
  },
  {
    action: 'swimming',
    row: { x: 20, y: 1357, width: 980, height: 126 },
    frames: 6,
    outputFrames: 8,
    scale: 1.08,
    anchorY: 0.58,
    extension: { action: 'swimming2', sequence: [6, 5, 4, 3, 2, 1, 0, 1] },
  },
];

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isEdgeMatte(raw, index) {
  const r = raw[index];
  const g = raw[index + 1];
  const b = raw[index + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 232 && max - min <= 28;
}

function removeEdgeMatte(raw, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (raw[i + 3] === 0 || isEdgeMatte(raw, i)) {
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
    raw[p * 4 + 3] = 0;
    const x = p % width;
    const y = Math.floor(p / width);
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
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = raw[(y * width + x) * 4 + 3];
      if (alpha > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, count };
}

async function alphaBoxForPng(buffer) {
  const image = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return alphaBox(image.data, image.info.width, image.info.height);
}

function sourceIndex(config, outputIndex) {
  if (config.action === 'typingCompanion') {
    return [0, 1, 2, 3, 6, 7, 8, 9][outputIndex];
  }
  if (outputIndex < config.frames) return outputIndex;
  return [4, 2][outputIndex - config.frames] ?? (outputIndex % config.frames);
}

function frameRect(config, index) {
  if (config.rowBands) {
    const cols = Math.ceil(config.frames / config.rowBands.length);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const band = config.rowBands[row];
    return {
      left: Math.round(config.row.x + (config.row.width / cols) * col),
      top: band.y,
      width: Math.round(config.row.width / cols),
      height: band.height,
    };
  }
  return {
    left: Math.round(config.row.x + (config.row.width / config.frames) * index),
    top: config.row.y,
    width: Math.round(config.row.width / config.frames),
    height: config.row.height,
  };
}

async function renderCell(config, rect) {
  const extracted = await sharp(SOURCE)
    .extract(rect)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = removeEdgeMatte(extracted.data, extracted.info.width, extracted.info.height);
  const box = alphaBox(raw, extracted.info.width, extracted.info.height);
  if (!box) {
    return {
      buffer: await sharp({
        create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).png().toBuffer(),
      box,
    };
  }

  const padX = Math.ceil(box.width * 0.08);
  const padY = Math.ceil(box.height * 0.08);
  const left = Math.max(0, box.minX - padX);
  const top = Math.max(0, box.minY - padY);
  const width = Math.min(extracted.info.width - left, box.width + padX * 2);
  const height = Math.min(extracted.info.height - top, box.height + padY * 2);
  const cropped = await sharp(raw, {
    raw: { width: extracted.info.width, height: extracted.info.height, channels: 4 },
  })
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  const fit = Math.min(CELL_W / width, CELL_H / height) * config.scale;
  const outW = Math.max(1, Math.min(CELL_W, Math.round(width * fit)));
  const outH = Math.max(1, Math.min(CELL_H, Math.round(height * fit)));
  const resized = await sharp(cropped).resize(outW, outH, { kernel: 'nearest' }).png().toBuffer();
  const x = Math.round((CELL_W - outW) / 2);
  const y = Math.max(0, Math.min(CELL_H - outH, Math.round(CELL_H * config.anchorY - outH / 2)));

  return {
    buffer: await sharp({
      create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: resized, left: x, top: y }]).png().toBuffer(),
    box,
  };
}

async function importAction(config) {
  const outputDir = path.join(ROOT, 'assets-src', 'yoyo', 'frames', config.action);
  ensureDir(outputDir);
  const frames = [];
  for (let i = 0; i < config.outputFrames; i += 1) {
    const sourceFrame = sourceIndex(config, i);
    const rect = frameRect(config, sourceFrame);
    const { buffer, box } = await renderCell(config, rect);
    const cellBox = await alphaBoxForPng(buffer);
    const output = path.join(outputDir, `${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(output, buffer);
    frames.push({ frame: i, sourceFrame, rect, box, cellBox, output });
  }
  if (config.extension) {
    const extensionDir = path.join(ROOT, 'assets-src', 'yoyo', 'frames', config.extension.action);
    ensureDir(extensionDir);
    for (let i = 0; i < config.extension.sequence.length; i += 1) {
      const source = frames[config.extension.sequence[i]]?.output;
      if (!source) throw new Error(`Missing extension source frame ${config.extension.sequence[i]} for ${config.action}`);
      fs.copyFileSync(source, path.join(extensionDir, `${String(i).padStart(2, '0')}.png`));
    }
  }
  console.log(`Imported ${config.action}: ${rel(outputDir)}`);
  if (config.action === 'sofaLying') {
    writeSofaAnchors(config, frames);
  } else if (config.action === 'swimming') {
    writeSwimmingAnchors(config, frames);
  }
  return frames;
}

function sofaFrameAnchor(frameName, frame) {
  const box = frame.cellBox || { minX: 0, minY: 0, width: CELL_W, height: CELL_H };
  const left = Math.max(8, box.minX);
  const top = Math.max(62, box.minY);
  const width = Math.min(176, box.width);
  return {
    frame: frameName,
    character: {
      box: {
        x: left,
        y: top,
        width,
        height: Math.min(120, box.height || 120),
      },
      anchors: {
        bodyCenter: { x: 86, y: 122 },
        hips: { x: 112, y: 139 },
        feet: { x: 150, y: 149 },
        face: { x: 63, y: 102 },
      },
    },
    scene: {
      bodyRestBounds: { x: 10, y: 70, width: 172, height: 104 },
      cushionBounds: { x: 7, y: 122, width: 176, height: 49 },
    },
  };
}

function writeSofaAnchors(config, frames) {
  const extensionSequence = config.extension?.sequence || [];
  const allFrames = [
    ...frames.map((frame, index) => sofaFrameAnchor(`${String(index).padStart(2, '0')}.png`, frame)),
    ...extensionSequence.map((sourceIndex, index) => (
      sofaFrameAnchor(`${String(frames.length + index).padStart(2, '0')}.png`, frames[sourceIndex])
    )),
  ];
  const anchorPath = path.join(ROOT, 'assets-src', 'yoyo', 'anchors', 'sofaLying.json');
  ensureDir(path.dirname(anchorPath));
  fs.writeFileSync(anchorPath, `${JSON.stringify({
    action: 'sofaLying',
    cell: { width: CELL_W, height: CELL_H },
    generatedAt: new Date().toISOString(),
    frames: allFrames,
  }, null, 2)}\n`);
}

function swimmingFrameAnchor(frameName, frame) {
  const box = frame.cellBox || { minX: 0, minY: 0, width: CELL_W, height: CELL_H };
  return {
    frame: frameName,
    character: {
      box: {
        x: Math.max(18, box.minX),
        y: Math.max(70, box.minY),
        width: Math.min(156, box.width || 156),
        height: Math.min(116, box.height || 116),
      },
      anchors: {
        face: { x: 88, y: 102 },
        bodyCenter: { x: 103, y: 136 },
        hips: { x: 110, y: 154 },
        feet: { x: 133, y: 166 },
      },
    },
    scene: {
      poolBounds: { x: 22, y: 118, width: 148, height: 66 },
      waterline: { y: 142 },
    },
  };
}

function writeSwimmingAnchors(config, frames) {
  const extensionSequence = config.extension?.sequence || [];
  const allFrames = [
    ...frames.map((frame, index) => swimmingFrameAnchor(`${String(index).padStart(2, '0')}.png`, frame)),
    ...extensionSequence.map((sourceIndex, index) => (
      swimmingFrameAnchor(`${String(frames.length + index).padStart(2, '0')}.png`, frames[sourceIndex])
    )),
  ];
  const anchorPath = path.join(ROOT, 'assets-src', 'yoyo', 'anchors', 'swimming.json');
  ensureDir(path.dirname(anchorPath));
  fs.writeFileSync(anchorPath, `${JSON.stringify({
    action: 'swimming',
    cell: { width: CELL_W, height: CELL_H },
    generatedAt: new Date().toISOString(),
    frames: allFrames,
  }, null, 2)}\n`);
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing source sheet: ${SOURCE}`);
  ensureDir(path.join(ROOT, 'assets-src', 'yoyo', 'reference-sheets'));
  fs.copyFileSync(SOURCE, path.join(ROOT, 'assets-src', 'yoyo', 'reference-sheets', 'image22.png'));

  const report = {};
  for (const config of ACTIONS.filter((item) => !actionFilter || actionFilter.has(item.action))) {
    report[config.action] = await importAction(config);
  }
  const reportPath = path.join(ROOT, 'assets-src', 'yoyo', 'qa', 'reference-sheet-import.json');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${rel(reportPath)}`);
}

main().catch((error) => {
  console.error(`Reference sheet import failed: ${error.message}`);
  process.exit(1);
});
