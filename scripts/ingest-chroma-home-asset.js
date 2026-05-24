#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const removeChroma = path.join(
  process.env.HOME,
  '.codex',
  'skills',
  '.system',
  'imagegen',
  'scripts',
  'remove_chroma_key.py',
);

function usage() {
  console.error(`Usage: node scripts/ingest-chroma-home-asset.js --input <png> --name <asset-name> [--width <px>] [--run <dir>] [--force]`);
}

function parseArgs(argv) {
  const args = { width: 420, run: '', force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };
    if (arg === '--input') args.input = path.resolve(next());
    else if (arg === '--name') args.name = next();
    else if (arg === '--width') args.width = Number(next());
    else if (arg === '--run') args.run = path.resolve(next());
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!args.input || !args.name) throw new Error('--input and --name are required');
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(args.name)) throw new Error('--name must be a slug');
  return args;
}

async function alphaBounds(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const meta = await image.metadata();
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });
  let minX = meta.width;
  let minY = meta.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < meta.height; y += 1) {
    for (let x = 0; x < meta.width; x += 1) {
      const alpha = data[(y * meta.width + x) * meta.channels + 3];
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('No opaque pixels after chroma removal');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, meta };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }

  const runDir = args.run || path.join(repoRoot, 'output', 'home-asset-ingest', args.name);
  const alphaPath = path.join(runDir, 'processed', `${args.name}-alpha.png`);
  const sourcePath = path.join(runDir, 'sources', `${args.name}.png`);
  const sourceAssetPath = path.join(repoRoot, 'assets-src', 'yoyo', 'home', `${args.name}.png`);
  const runtimePath = path.join(repoRoot, 'assets', 'yoyo', 'home', `${args.name}.webp`);
  const qaPath = path.join(runDir, 'qa', `${args.name}-review.png`);

  for (const dir of [
    path.join(runDir, 'candidates'),
    path.dirname(alphaPath),
    path.dirname(sourcePath),
    path.dirname(sourceAssetPath),
    path.dirname(runtimePath),
    path.dirname(qaPath),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.copyFileSync(args.input, path.join(runDir, 'candidates', path.basename(args.input)));
  if (args.force) {
    for (const file of [alphaPath, sourcePath, sourceAssetPath, runtimePath, qaPath]) {
      fs.rmSync(file, { force: true });
    }
  }
  execFileSync('python3', [
    removeChroma,
    '--input', args.input,
    '--out', alphaPath,
    '--auto-key', 'border',
    '--soft-matte',
    '--transparent-threshold', '12',
    '--opaque-threshold', '220',
    '--despill',
    ...(args.force ? ['--force'] : []),
  ], { stdio: 'inherit' });

  const b = await alphaBounds(alphaPath);
  const pad = 28;
  const left = Math.max(0, b.left - pad);
  const top = Math.max(0, b.top - pad);
  const crop = {
    left,
    top,
    width: Math.min(b.meta.width - left, b.width + pad * 2),
    height: Math.min(b.meta.height - top, b.height + pad * 2),
  };

  await sharp(alphaPath)
    .ensureAlpha()
    .extract(crop)
    .resize({ width: args.width, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(sourcePath);
  fs.copyFileSync(sourcePath, sourceAssetPath);
  fs.copyFileSync(sourcePath, qaPath);
  await sharp(sourcePath).webp({ quality: 94 }).toFile(runtimePath);

  console.log(JSON.stringify({
    name: args.name,
    source: path.relative(repoRoot, sourceAssetPath),
    runtime: path.relative(repoRoot, runtimePath),
    qa: path.relative(repoRoot, qaPath),
    crop,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
