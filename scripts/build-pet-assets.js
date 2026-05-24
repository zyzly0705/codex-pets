#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const scanAlpha = args.includes('--scan-alpha');
const manifestArg = args.find((arg) => arg.startsWith('--manifest='));
const manifestPath = manifestArg
  ? path.resolve(manifestArg.slice('--manifest='.length))
  : path.join(repoRoot, 'assets-src', 'yoyo', 'manifest.json');

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function resolveFrom(baseDir, value) {
  return path.resolve(baseDir, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function frameCandidates(actionDir, index) {
  const two = String(index).padStart(2, '0');
  return [
    path.join(actionDir, `${two}.png`),
    path.join(actionDir, `${index}.png`),
    path.join(actionDir, `frame-${two}.png`),
    path.join(actionDir, `frame_${two}.png`),
  ];
}

function rowMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const index = Number(row.row);
    if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid row index for ${row.name}`);
    if (map.has(index)) throw new Error(`Duplicate row index ${index}`);
    map.set(index, row);
  }
  return map;
}

function copyCell(source, sourceWidth, sx, sy, target, targetWidth, dx, dy, cellWidth, cellHeight) {
  const rowBytes = cellWidth * 4;
  for (let y = 0; y < cellHeight; y += 1) {
    const sourceOffset = ((sy + y) * sourceWidth + sx) * 4;
    const targetOffset = ((dy + y) * targetWidth + dx) * 4;
    source.copy(target, targetOffset, sourceOffset, sourceOffset + rowBytes);
  }
}

function alphaPixels(raw) {
  let count = 0;
  for (let i = 3; i < raw.length; i += 4) {
    if (raw[i] !== 0) count += 1;
  }
  return count;
}

async function readFrameRaw(filePath, cellWidth, cellHeight, rowName, col) {
  const image = sharp(filePath).ensureAlpha();
  const meta = await image.metadata();
  if (meta.width !== cellWidth || meta.height !== cellHeight) {
    throw new Error(`${rel(filePath)} is ${meta.width}x${meta.height}; ${rowName}[${col}] must be ${cellWidth}x${cellHeight}`);
  }
  return image.raw().toBuffer();
}

async function writeContactSheet(sheetRaw, rows, cellWidth, cellHeight, columns, outputPath) {
  const labelW = 172;
  const scale = 0.5;
  const thumbW = Math.round(cellWidth * scale);
  const thumbH = Math.round(cellHeight * scale);
  const width = labelW + columns * thumbW;
  const height = rows.length * thumbH;
  const sourceWidth = columns * cellWidth;
  const composites = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const top = i * thumbH;
    const label = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="${thumbH}" viewBox="0 0 ${labelW} ${thumbH}">
        <rect width="${labelW}" height="${thumbH}" fill="${i % 2 ? '#f7f7fb' : '#ffffff'}"/>
        <text x="8" y="22" font-family="Arial, sans-serif" font-size="12" fill="#222">${row.row}. ${row.name}</text>
        <text x="8" y="42" font-family="Arial, sans-serif" font-size="10" fill="#666">${row.type || 'action'} / ${row.frames}f</text>
      </svg>
    `);
    composites.push({ input: label, left: 0, top });
    for (let col = 0; col < columns; col += 1) {
      const frame = await sharp(sheetRaw, {
        raw: {
          width: sourceWidth,
          height: (Math.max(...rows.map((item) => item.row)) + 1) * cellHeight,
          channels: 4,
        },
      })
        .extract({ left: col * cellWidth, top: row.row * cellHeight, width: cellWidth, height: cellHeight })
        .resize(thumbW, thumbH, { kernel: 'nearest' })
        .png()
        .toBuffer();
      composites.push({ input: frame, left: labelW + col * thumbW, top });
    }
  }

  ensureDir(outputPath);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function main() {
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const cellWidth = Number(manifest.cellWidth || 192);
  const cellHeight = Number(manifest.cellHeight || 208);
  const columns = Number(manifest.columns || 8);
  const rows = [...manifest.rows].sort((a, b) => Number(a.row) - Number(b.row));
  const rowsByIndex = rowMap(rows);
  const maxRow = Math.max(...rows.map((row) => Number(row.row)));
  const outputSpritesheet = resolveFrom(manifestDir, manifest.outputSpritesheet);
  const outputPreview = resolveFrom(manifestDir, manifest.outputPreview || 'qa/contact-sheet.png');
  const outputReport = resolveFrom(manifestDir, manifest.outputReport || 'qa/build-report.json');
  const sourceFramesDir = resolveFrom(manifestDir, manifest.sourceFramesDir || 'frames');
  const fallbackSpritesheet = resolveFrom(manifestDir, manifest.fallbackSpritesheet || manifest.outputSpritesheet);
  const targetWidth = columns * cellWidth;
  const targetHeight = (maxRow + 1) * cellHeight;
  const targetRaw = Buffer.alloc(targetWidth * targetHeight * 4, 0);
  let fallbackRaw = null;
  let fallbackRows = 0;

  if (!cellWidth || !cellHeight || !columns) {
    throw new Error('cellWidth, cellHeight, and columns must be positive numbers');
  }

  if (fs.existsSync(fallbackSpritesheet)) {
    const fallback = sharp(fallbackSpritesheet).ensureAlpha();
    const meta = await fallback.metadata();
    if (meta.width !== targetWidth || meta.height % cellHeight !== 0) {
      throw new Error(`${rel(fallbackSpritesheet)} does not match ${columns} columns x ${cellWidth} by N x ${cellHeight}`);
    }
    fallbackRows = Math.floor(meta.height / cellHeight);
    fallbackRaw = await fallback.raw().toBuffer();
  } else if (!strict) {
    throw new Error(`Fallback spritesheet is missing: ${rel(fallbackSpritesheet)}`);
  }

  const report = {
    manifest: rel(manifestPath),
    outputSpritesheet: rel(outputSpritesheet),
    outputPreview: rel(outputPreview),
    strict,
    scanAlpha,
    rows: [],
    warnings: [],
  };

  for (let rowIndex = 0; rowIndex <= maxRow; rowIndex += 1) {
    const row = rowsByIndex.get(rowIndex);
    const rowName = row?.name || `unused-${rowIndex}`;
    const frameCount = Number(row?.frames || columns);
    const sourceDir = path.join(sourceFramesDir, rowName);
    const summary = {
      row: rowIndex,
      name: rowName,
      type: row?.type || 'unused',
      frames: frameCount,
      sourceFrames: 0,
      fallbackFrames: 0,
      missingFrames: [],
      blankFrames: [],
    };

    for (let col = 0; col < columns; col += 1) {
      const sourceFrame = frameCandidates(sourceDir, col).find((candidate) => fs.existsSync(candidate));
      const dx = col * cellWidth;
      const dy = rowIndex * cellHeight;
      let frameRaw = null;

      if (sourceFrame) {
        frameRaw = await readFrameRaw(sourceFrame, cellWidth, cellHeight, rowName, col);
        copyCell(frameRaw, cellWidth, 0, 0, targetRaw, targetWidth, dx, dy, cellWidth, cellHeight);
        summary.sourceFrames += 1;
      } else if (fallbackRaw && rowIndex < fallbackRows) {
        if (col < frameCount) summary.missingFrames.push(col);
        copyCell(fallbackRaw, targetWidth, dx, dy, targetRaw, targetWidth, dx, dy, cellWidth, cellHeight);
        summary.fallbackFrames += 1;
      } else if (col < frameCount) {
        summary.missingFrames.push(col);
        if (strict) throw new Error(`${rowName}[${col}] is missing under ${rel(sourceDir)}`);
      }

      if (strict && col < frameCount && !sourceFrame) {
        throw new Error(`${rowName}[${col}] is missing under ${rel(sourceDir)}`);
      }
      if (scanAlpha && col < frameCount && sourceFrame && alphaPixels(frameRaw) === 0) {
        summary.blankFrames.push(col);
      }
    }

    if (summary.missingFrames.length > 0 && !strict) {
      report.warnings.push(`${rowName} used fallback for frames ${summary.missingFrames.join(', ')}`);
    }
    if (summary.blankFrames.length > 0) {
      report.warnings.push(`${rowName} has blank required frames ${summary.blankFrames.join(', ')}`);
    }
    report.rows.push(summary);
  }

  ensureDir(outputSpritesheet);
  ensureDir(outputPreview);
  ensureDir(outputReport);

  await sharp(targetRaw, {
    raw: { width: targetWidth, height: targetHeight, channels: 4 },
  })
    .webp({ lossless: true, effort: 0 })
    .toFile(`${outputSpritesheet}.tmp`);
  fs.renameSync(`${outputSpritesheet}.tmp`, outputSpritesheet);

  await writeContactSheet(targetRaw, rows, cellWidth, cellHeight, columns, outputPreview);
  fs.writeFileSync(outputReport, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Pet asset build OK: ${rel(outputSpritesheet)} (${columns}x${maxRow + 1} cells)`);
  console.log(`Preview: ${rel(outputPreview)}`);
  console.log(`Report: ${rel(outputReport)}`);
  if (report.warnings.length > 10) {
    console.warn(`Pet asset build warnings: ${report.warnings.length}; see ${rel(outputReport)}`);
  } else {
    for (const warning of report.warnings) {
      console.warn(`Pet asset build warning: ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(`Pet asset build failed: ${error.message}`);
  process.exit(1);
});
