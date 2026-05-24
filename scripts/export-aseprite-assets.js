#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const manifestArg = args.find((arg) => arg.startsWith('--manifest='));
const asepriteArg = args.find((arg) => arg.startsWith('--aseprite='));
const manifestPath = manifestArg
  ? path.resolve(manifestArg.slice('--manifest='.length))
  : path.join(repoRoot, 'assets-src', 'yoyo', 'manifest.json');

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findAseprite() {
  if (asepriteArg) return path.resolve(asepriteArg.slice('--aseprite='.length));
  const candidates = [
    '/Applications/Aseprite.app/Contents/MacOS/aseprite',
    '/Applications/Aseprite.app/Contents/MacOS/Aseprite',
    path.join(process.env.HOME || '', 'deps/aseprite-build/build/bin/aseprite.app/Contents/MacOS/aseprite'),
  ];
  const shell = spawnSync('zsh', ['-lc', 'command -v aseprite || true'], { encoding: 'utf8' });
  const fromPath = shell.stdout.trim();
  if (fromPath) return fromPath;
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function splitSheet(sheetPath, frameDir, row, cellWidth, cellHeight, columns) {
  const image = sharp(sheetPath).ensureAlpha();
  const meta = await image.metadata();
  if (meta.height !== cellHeight || meta.width < cellWidth * row.frames) {
    throw new Error(`${rel(sheetPath)} is ${meta.width}x${meta.height}; expected at least ${cellWidth * row.frames}x${cellHeight}`);
  }
  fs.mkdirSync(frameDir, { recursive: true });
  for (let col = 0; col < columns; col += 1) {
    const sourceCol = Math.min(col, row.frames - 1);
    await sharp(sheetPath)
      .extract({ left: sourceCol * cellWidth, top: 0, width: cellWidth, height: cellHeight })
      .png()
      .toFile(path.join(frameDir, `${String(col).padStart(2, '0')}.png`));
  }
}

async function main() {
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const aseprite = findAseprite();
  const cellWidth = Number(manifest.cellWidth || 192);
  const cellHeight = Number(manifest.cellHeight || 208);
  const columns = Number(manifest.columns || 8);
  const sourceDir = path.join(manifestDir, 'aseprite');
  const framesRoot = path.resolve(manifestDir, manifest.sourceFramesDir || 'frames');
  const tempDir = path.join(manifestDir, 'qa', 'aseprite-export');

  if (!aseprite) {
    throw new Error('Aseprite not found. Install Aseprite or pass --aseprite=/path/to/aseprite');
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`${rel(sourceDir)} is missing. Put <action-name>.aseprite files there.`);
  }

  fs.mkdirSync(tempDir, { recursive: true });
  let exported = 0;
  for (const row of manifest.rows) {
    const source = path.join(sourceDir, `${row.name}.aseprite`);
    if (!fs.existsSync(source)) continue;

    const sheetPath = path.join(tempDir, `${row.name}.png`);
    const dataPath = path.join(tempDir, `${row.name}.json`);
    const result = spawnSync(aseprite, [
      '-b',
      source,
      '--sheet',
      sheetPath,
      '--sheet-type',
      'horizontal',
      '--sheet-width',
      String(cellWidth * columns),
      '--sheet-height',
      String(cellHeight),
      '--data',
      dataPath,
      '--format',
      'json-array',
    ], { encoding: 'utf8' });

    if (result.status !== 0) {
      throw new Error(`Aseprite export failed for ${rel(source)}:\n${result.stderr || result.stdout}`);
    }

    await splitSheet(sheetPath, path.join(framesRoot, row.name), row, cellWidth, cellHeight, columns);
    exported += 1;
    console.log(`Exported ${row.name}: ${rel(source)} -> ${rel(path.join(framesRoot, row.name))}`);
  }

  if (exported === 0) {
    console.warn(`No .aseprite files found under ${rel(sourceDir)}`);
  } else {
    console.log(`Aseprite export OK: ${exported} action(s)`);
  }
}

main().catch((error) => {
  console.error(`Aseprite export failed: ${error.message}`);
  process.exit(1);
});
