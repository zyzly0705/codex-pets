#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CELL_W = 192;
const CELL_H = 208;
const FRAMES = 8;

function usage() {
  console.error(`Usage: node scripts/import-digsand-video-strip.js --source <strip.png> [options]

Options:
  --output-dir <dir>       Default: assets-src/yoyo/frames/digSand
  --processed-dir <dir>    Default: output/yoyo-digsand-video-runs/digSand/processed
  --force                  Replace existing digSand frames.`);
}

function parseArgs(argv) {
  const args = {
    outputDir: path.join(ROOT, 'assets-src', 'yoyo', 'frames', 'digSand'),
    processedDir: path.join(ROOT, 'output', 'yoyo-digsand-video-runs', 'digSand', 'processed'),
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };

    if (arg === '--source') args.source = path.resolve(next());
    else if (arg === '--output-dir') args.outputDir = path.resolve(next());
    else if (arg === '--processed-dir') args.processedDir = path.resolve(next());
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!args.source) throw new Error('--source is required');
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isGreenKey(raw, index) {
  const r = raw[index];
  const g = raw[index + 1];
  const b = raw[index + 2];
  return g > 175 && g - r > 95 && g - b > 75;
}

function removeGreenKey(raw, width, height) {
  const out = Buffer.from(raw);
  for (let p = 0; p < width * height; p += 1) {
    const index = p * 4;
    if (isGreenKey(out, index)) {
      out[index + 3] = 0;
      out[index] = 0;
      out[index + 1] = 0;
      out[index + 2] = 0;
    } else if (out[index + 3] > 0) {
      // Simple despill for antialiased edges near the chroma background.
      const excessGreen = Math.max(0, out[index + 1] - Math.max(out[index], out[index + 2]) - 18);
      if (excessGreen > 0) out[index + 1] = Math.max(out[index], out[index + 2]) + 18;
    }
  }
  return out;
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

async function makeCell(sourceRaw, sourceWidth, sourceHeight, frameIndex) {
  const slotW = Math.floor(sourceWidth / FRAMES);
  const left = frameIndex === FRAMES - 1 ? sourceWidth - slotW : frameIndex * slotW;
  const extractW = frameIndex === FRAMES - 1 ? slotW : Math.min(slotW, sourceWidth - left);
  const slot = await sharp(sourceRaw, {
    raw: { width: sourceWidth, height: sourceHeight, channels: 4 },
  })
    .extract({ left, top: 0, width: extractW, height: sourceHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const box = alphaBox(slot.data, slot.info.width, slot.info.height);
  if (!box) throw new Error(`No visible pixels in frame ${frameIndex}`);

  const padX = Math.ceil(box.width * 0.12);
  const padY = Math.ceil(box.height * 0.12);
  const cropLeft = Math.max(0, box.minX - padX);
  const cropTop = Math.max(0, box.minY - padY);
  const cropWidth = Math.min(slot.info.width - cropLeft, box.width + padX * 2);
  const cropHeight = Math.min(slot.info.height - cropTop, box.height + padY * 2);

  const cropped = await sharp(slot.data, {
    raw: { width: slot.info.width, height: slot.info.height, channels: 4 },
  })
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  const maxContentW = frameIndex === FRAMES - 1 ? 112 : 150;
  const maxContentH = frameIndex === FRAMES - 1 ? 174 : 146;
  const fit = Math.min(maxContentW / cropWidth, maxContentH / cropHeight, 1);
  const outW = Math.max(1, Math.round(cropWidth * fit));
  const outH = Math.max(1, Math.round(cropHeight * fit));
  const resized = await sharp(cropped).resize(outW, outH, { kernel: 'lanczos3' }).png().toBuffer();
  const x = Math.round((CELL_W - outW) / 2);
  const y = Math.max(0, CELL_H - outH - 10);
  const cell = await sharp({
    create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: x, top: y }])
    .png()
    .toBuffer();
  const cellRaw = await sharp(cell).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  return {
    buffer: cell,
    sourceSlot: { left, width: extractW, height: sourceHeight },
    sourceBox: box,
    cellBox: alphaBox(cellRaw.data, cellRaw.info.width, cellRaw.info.height),
  };
}

async function makeContactSheet(framePaths, outputPath) {
  const labelH = 24;
  const width = CELL_W * FRAMES;
  const height = CELL_H + labelH;
  const composites = [];

  for (let index = 0; index < FRAMES; index += 1) {
    const label = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${labelH}" viewBox="0 0 ${CELL_W} ${labelH}">
        <rect width="${CELL_W}" height="${labelH}" fill="#f7f7fb"/>
        <text x="8" y="16" font-family="Arial, sans-serif" font-size="12" fill="#333">digSand ${String(index).padStart(2, '0')}</text>
      </svg>
    `);
    composites.push({ input: framePaths[index], left: index * CELL_W, top: 0 });
    composites.push({ input: label, left: index * CELL_W, top: CELL_H });
  }

  ensureDir(path.dirname(outputPath));
  await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.source)) throw new Error(`Missing source: ${args.source}`);
  if (fs.existsSync(args.outputDir) && !args.force) {
    const existing = fs.readdirSync(args.outputDir).filter((name) => /^0[0-7]\.png$/.test(name));
    if (existing.length > 0) throw new Error(`${rel(args.outputDir)} already has frames; use --force`);
  }

  ensureDir(args.outputDir);
  ensureDir(args.processedDir);
  const source = await sharp(args.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = removeGreenKey(source.data, source.info.width, source.info.height);
  const processedStrip = path.join(args.processedDir, 'digsand-generated-strip-v1-alpha.png');
  await sharp(keyed, { raw: { width: source.info.width, height: source.info.height, channels: 4 } })
    .png()
    .toFile(processedStrip);

  const report = {
    source: rel(args.source),
    processedStrip: rel(processedStrip),
    frames: [],
  };
  const framePaths = [];

  for (let index = 0; index < FRAMES; index += 1) {
    const frame = await makeCell(keyed, source.info.width, source.info.height, index);
    const output = path.join(args.outputDir, `${String(index).padStart(2, '0')}.png`);
    fs.writeFileSync(output, frame.buffer);
    framePaths.push(output);
    report.frames.push({
      index,
      output: rel(output),
      sourceSlot: frame.sourceSlot,
      sourceBox: frame.sourceBox,
      cellBox: frame.cellBox,
    });
  }

  const contactSheet = path.join(args.processedDir, 'digsand-runtime-contact-v1.png');
  await makeContactSheet(framePaths, contactSheet);
  report.contactSheet = rel(contactSheet);

  const reportPath = path.join(args.processedDir, 'digsand-strip-import-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Imported digSand strip: ${rel(args.source)} -> ${rel(args.outputDir)}`);
  console.log(`Processed strip: ${rel(processedStrip)}`);
  console.log(`Contact sheet: ${rel(contactSheet)}`);
}

main().catch((error) => {
  console.error(`digSand strip import failed: ${error.message}`);
  process.exit(1);
});
