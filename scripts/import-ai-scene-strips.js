#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CELL_W = 192;
const CELL_H = 208;
const COLUMNS = 8;

const SOURCES = [
  {
    action: 'fanCooling',
    source: 'assets-src/yoyo/ai-sources/fanCooling-strip.png',
    chroma: 'green',
    extraction: 'components',
    anchorY: 0.58,
    scale: 0.98,
  },
  {
    action: 'swing',
    source: 'assets-src/yoyo/ai-sources/swing-strip.png',
    chroma: 'green',
    anchorY: 0.52,
    scale: 0.96,
  },
  {
    action: 'swimming',
    source: 'assets-src/yoyo/ai-sources/swimming-strip.png',
    chroma: 'magenta',
    anchorY: 0.58,
    scale: 1,
  },
  {
    action: 'sofaLying',
    source: 'assets-src/yoyo/ai-sources/sofaLying-strip.png',
    chroma: null,
    matte: 'checker',
    anchorY: 0.58,
    scale: 1,
  },
  {
    action: 'whip',
    source: 'assets-src/yoyo/ai-sources/whip-strip.png',
    chroma: 'green',
    extraction: 'components',
    minComponentPixels: 180,
    minRenderedComponentPixels: 500,
    anchorY: 0.6,
    scale: 0.9,
  },
];

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isChroma(pixel, chroma) {
  const [r, g, b] = pixel;
  if (chroma === 'green') {
    return g > 150 && r < 105 && b < 105;
  }
  if (chroma === 'magenta') {
    return r > 165 && b > 145 && g < 120;
  }
  return false;
}

function removeChroma(raw, chroma) {
  if (!chroma) return raw;
  for (let i = 0; i < raw.length; i += 4) {
    if (isChroma([raw[i], raw[i + 1], raw[i + 2]], chroma)) {
      raw[i + 3] = 0;
    }
  }
  return raw;
}

function isCheckerMatte(raw, index) {
  const r = raw[index];
  const g = raw[index + 1];
  const b = raw[index + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min > 205 && max - min < 12;
}

function removeCheckerMatte(raw, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (raw[i + 3] === 0 || isCheckerMatte(raw, i)) {
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
    const p = queue.shift();
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

function components(raw, width, height, minPixels = 35) {
  const seen = new Uint8Array(width * height);
  const out = [];
  const queue = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start] || raw[start * 4 + 3] <= 24) continue;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let count = 0;
      let sumX = 0;
      queue.length = 0;
      seen[start] = 1;
      queue.push(start);
      while (queue.length > 0) {
        const p = queue.pop();
        const px = p % width;
        const py = Math.floor(p / width);
        count += 1;
        sumX += px;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
        const neighbors = [p - 1, p + 1, p - width, p + width];
        for (const n of neighbors) {
          if (n < 0 || n >= width * height || seen[n]) continue;
          const nx = n % width;
          if ((n === p - 1 && nx === width - 1) || (n === p + 1 && nx === 0)) continue;
          if (raw[n * 4 + 3] > 24) {
            seen[n] = 1;
            queue.push(n);
          }
        }
      }
      if (count >= minPixels) {
        out.push({ minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, count, cx: sumX / count });
      }
    }
  }
  return out;
}

function clusterComponentBoxes(items, totalWidth) {
  if (items.length === 0) return [];
  let centers = Array.from({ length: COLUMNS }, (_, i) => ((i + 0.5) * totalWidth) / COLUMNS);
  for (let iter = 0; iter < 16; iter += 1) {
    const groups = centers.map(() => []);
    for (const item of items) {
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < centers.length; i += 1) {
        const d = Math.abs(item.cx - centers[i]);
        if (d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      }
      groups[best].push(item);
    }
    centers = centers.map((center, i) => {
      if (groups[i].length === 0) return center;
      return groups[i].reduce((sum, item) => sum + item.cx, 0) / groups[i].length;
    });
  }
  const ordered = centers
    .map((center, index) => ({ center, index }))
    .sort((a, b) => a.center - b.center);
  const remap = new Map(ordered.map((item, newIndex) => [item.index, newIndex]));
  const groups = Array.from({ length: COLUMNS }, () => []);
  for (const item of items) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < centers.length; i += 1) {
      const d = Math.abs(item.cx - centers[i]);
      if (d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    }
    groups[remap.get(best)].push(item);
  }
  return groups.map((group) => {
    if (group.length === 0) return null;
    return {
      minX: Math.min(...group.map((item) => item.minX)),
      minY: Math.min(...group.map((item) => item.minY)),
      maxX: Math.max(...group.map((item) => item.maxX)),
      maxY: Math.max(...group.map((item) => item.maxY)),
    };
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function renderFrame(segment, config) {
  const rawImage = sharp(segment).ensureAlpha();
  const meta = await rawImage.metadata();
  let sourceRaw = removeChroma(await rawImage.raw().toBuffer(), config.chroma);
  if (config.matte === 'checker') {
    sourceRaw = removeCheckerMatte(sourceRaw, meta.width, meta.height);
  }
  const box = alphaBox(sourceRaw, meta.width, meta.height);
  if (!box) {
    return sharp({
      create: {
        width: CELL_W,
        height: CELL_H,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png().toBuffer();
  }

  const padX = Math.round(box.width * 0.08);
  const padY = Math.round(box.height * 0.08);
  const left = clamp(box.minX - padX, 0, meta.width - 1);
  const top = clamp(box.minY - padY, 0, meta.height - 1);
  const right = clamp(box.maxX + padX, 0, meta.width - 1);
  const bottom = clamp(box.maxY + padY, 0, meta.height - 1);
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const crop = await sharp(sourceRaw, {
    raw: { width: meta.width, height: meta.height, channels: 4 },
  })
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const fitScale = Math.min(CELL_W / cropW, CELL_H / cropH) * config.scale;
  const width = Math.max(1, Math.round(cropW * fitScale));
  const height = Math.max(1, Math.round(cropH * fitScale));
  const resized = await sharp(crop)
    .resize(width, height, { kernel: 'nearest' })
    .png()
    .toBuffer();
  const x = Math.round((CELL_W - width) / 2);
  const y = clamp(Math.round(CELL_H * config.anchorY - height / 2), 0, CELL_H - height);

  return sharp({
    create: {
      width: CELL_W,
      height: CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: x, top: y }])
    .png()
    .toBuffer();
}

async function removeSmallRenderedComponents(frameBuffer, minPixels) {
  if (!minPixels) return frameBuffer;
  const image = sharp(frameBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height);
  const queue = [];
  const small = [];

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const start = y * info.width + x;
      if (seen[start] || data[start * 4 + 3] <= 24) continue;
      const pixels = [];
      seen[start] = 1;
      queue.length = 0;
      queue.push(start);
      while (queue.length > 0) {
        const p = queue.pop();
        pixels.push(p);
        const px = p % info.width;
        const neighbors = [p - 1, p + 1, p - info.width, p + info.width];
        for (const n of neighbors) {
          if (n < 0 || n >= info.width * info.height || seen[n]) continue;
          const nx = n % info.width;
          if ((n === p - 1 && px === 0) || (n === p + 1 && nx === 0)) continue;
          if (data[n * 4 + 3] > 24) {
            seen[n] = 1;
            queue.push(n);
          }
        }
      }
      if (pixels.length < minPixels) small.push(...pixels);
    }
  }

  for (const p of small) {
    data[p * 4 + 3] = 0;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

async function importStrip(config) {
  const sourcePath = path.join(ROOT, config.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing AI source strip: ${rel(sourcePath)}`);
  }
  const source = sharp(sourcePath).ensureAlpha();
  const meta = await source.metadata();
  let componentBoxes = null;
  if (config.extraction === 'components') {
    const raw = removeChroma(await source.raw().toBuffer(), config.chroma);
    componentBoxes = clusterComponentBoxes(components(raw, meta.width, meta.height, config.minComponentPixels || 35), meta.width);
  }
  const frameW = Math.floor(meta.width / COLUMNS);
  const outputDir = path.join(ROOT, 'assets-src', 'yoyo', 'frames', config.action);
  ensureDir(outputDir);

  for (let col = 0; col < COLUMNS; col += 1) {
    const componentBox = componentBoxes?.[col];
    const left = componentBox ? clamp(componentBox.minX - 12, 0, meta.width - 1) : Math.round((meta.width / COLUMNS) * col);
    const right = componentBox
      ? clamp(componentBox.maxX + 12, 0, meta.width - 1)
      : Math.round((meta.width / COLUMNS) * (col + 1));
    const width = Math.max(1, right - left || frameW);
    const segment = await sharp(sourcePath)
      .extract({ left, top: 0, width, height: meta.height })
      .png()
      .toBuffer();
    const frame = await removeSmallRenderedComponents(await renderFrame(segment, config), config.minRenderedComponentPixels);
    fs.writeFileSync(path.join(outputDir, `${String(col).padStart(2, '0')}.png`), frame);
  }

  console.log(`Imported ${config.action}: ${rel(sourcePath)} -> ${rel(outputDir)}`);
}

async function main() {
  for (const config of SOURCES) {
    await importStrip(config);
  }
}

main().catch((error) => {
  console.error(`AI scene import failed: ${error.message}`);
  process.exit(1);
});
