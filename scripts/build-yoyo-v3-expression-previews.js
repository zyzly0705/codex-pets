#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const expressionControls = require('../src/shared/yoyo-expression-controls.js');

const repoRoot = path.resolve(__dirname, '..');
const contractPath = path.join(repoRoot, 'assets-src/yoyo/v3/character-rig/rig-contract.json');
const manifestPath = path.join(repoRoot, 'assets-src/yoyo/rig/live2d-yoyo-v5/manifest.json');
const sourceReferencePath = path.join(repoRoot, 'assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v3-alpha.png');
const sourceLockPath = path.join(repoRoot, 'assets-src/yoyo/v3/character-rig/yoyo-v3-reference-lock.png');
const outDir = path.join(repoRoot, 'assets-src/yoyo/v3/character-rig/expressions');
const qaDir = path.join(repoRoot, 'assets/yoyo/qa/v3');
const contactSheetPath = path.join(qaDir, 'expression-presets-contact-sheet.png');
const galleryPath = path.join(qaDir, 'expression-presets-gallery.html');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function layerByName(manifest) {
  return new Map(manifest.layers.map((layer) => [layer.name, layer]));
}

function pngForLayer(manifest, layer) {
  return path.join(repoRoot, manifest.output, layer.file);
}

function resolveEyeLayers(eyes) {
  if (['happy_arc', 'soft_smile'].includes(eyes)) {
    return ['eye_left_smile', 'eye_right_smile'];
  }
  if (['half_closed', 'closed'].includes(eyes)) {
    return ['eye_left_blink', 'eye_right_blink'];
  }
  return ['eye_left_open', 'eye_right_open'];
}

function resolveMouthLayer(mouth) {
  if (['open_smile'].includes(mouth)) return 'mouth_smile';
  if (['round_o'].includes(mouth)) return 'mouth_o';
  if (['pout', 'downturned', 'flat'].includes(mouth)) return 'mouth_flat';
  if (['talk_small', 'tiny_relaxed', 'small_smile'].includes(mouth)) return 'mouth_small';
  return 'mouth_small';
}

function baseLayerOrder() {
  return [
    'leg_left',
    'leg_right',
    'shoe_left',
    'shoe_right',
    'arm_left',
    'arm_right',
    'hand_left',
    'hand_right',
    'torso_top',
    'collar',
    'skirt',
    'button_left',
    'button_right',
    'bow_left',
    'bow_center',
    'bow_right',
    'hair_back',
    'face_base',
  ];
}

function upperHairLayerOrder() {
  return [
    'side_hair_left',
    'side_hair_right',
    'hair_front',
    'bangs_center',
    'bun',
  ];
}

function compositesForPreset(manifest, layers, preset) {
  const parts = preset.parts || {};
  const names = [
    ...baseLayerOrder(),
    ...(parts.blush && parts.blush !== 'none' ? ['blush_left', 'blush_right'] : []),
    ...resolveEyeLayers(parts.eyes),
    'brow_left',
    'brow_right',
    resolveMouthLayer(parts.mouth),
    ...upperHairLayerOrder(),
  ];

  return names
    .map((name) => layers.get(name))
    .filter(Boolean)
    .map((layer) => ({
      input: pngForLayer(manifest, layer),
      left: Number(layer.left || 0),
      top: Number(layer.top || 0),
    }));
}

async function buildPresetImage(manifest, layers, preset, outPath) {
  await sharp({
    create: {
      width: manifest.document.width,
      height: manifest.document.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositesForPreset(manifest, layers, preset))
    .png()
    .toFile(outPath);
}

function labelSvg(width, height, text) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#f9f3ea"/>
      <text x="${width / 2}" y="25" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        font-size="17" font-weight="700" fill="#40352f">${text}</text>
    </svg>`,
  );
}

async function makeContactSheet(presets, files) {
  const thumbW = 180;
  const thumbH = 180;
  const labelH = 40;
  const gap = 14;
  const columns = 4;
  const rows = Math.ceil(presets.length / columns);
  const width = columns * thumbW + (columns + 1) * gap;
  const height = rows * (thumbH + labelH) + (rows + 1) * gap;
  const composites = [];

  for (let i = 0; i < presets.length; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = gap + col * (thumbW + gap);
    const y = gap + row * (thumbH + labelH + gap);
    const thumb = await sharp(files[i])
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: thumbW, height: thumbH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    composites.push({ input: labelSvg(thumbW, labelH, presets[i].id), left: x, top: y });
    composites.push({ input: thumb, left: x, top: y + labelH });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#fffaf3',
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
}

function writeGallery(presets) {
  const cards = presets.map((preset) => {
    const rel = path.posix.relative(
      path.posix.dirname(path.posix.relative(repoRoot, galleryPath)),
      path.posix.join('assets-src/yoyo/v3/character-rig/expressions', `${preset.id}.png`),
    );
    return `<figure><img src="${rel}" alt="${preset.id}"><figcaption>${preset.id}</figcaption></figure>`;
  }).join('\n');

  fs.writeFileSync(galleryPath, `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>Yoyo V3 Expression Presets</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;background:#fffaf3;color:#40352f}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
figure{margin:0;padding:12px;border:1px solid #ead8c4;background:#fff;border-radius:8px}
img{width:100%;height:190px;object-fit:contain}
figcaption{text-align:center;font-weight:700}
</style>
<h1>Yoyo V3 Expression Presets</h1>
<p>Built from <code>assets-src/yoyo/rig/live2d-yoyo-v5</code> using the accepted reference-lock source.</p>
<div class="grid">
${cards}
</div>
</html>
`);
}

async function main() {
  const contract = readJson(contractPath);
  const manifest = readJson(manifestPath);
  const layers = layerByName(manifest);
  const presets = expressionControls
    .TALK_CYCLE
    ? contract.expression.presets
    : Object.values(expressionControls.EXPRESSION_PRESETS);

  ensureDir(path.dirname(sourceLockPath));
  ensureDir(outDir);
  ensureDir(qaDir);

  fs.copyFileSync(sourceReferencePath, sourceLockPath);

  const files = [];
  for (const preset of presets) {
    const outPath = path.join(outDir, `${preset.id}.png`);
    await buildPresetImage(manifest, layers, preset, outPath);
    files.push(outPath);
  }

  await makeContactSheet(presets, files);
  writeGallery(presets);

  console.log(`Wrote ${path.relative(repoRoot, outDir)}`);
  console.log(`Wrote ${path.relative(repoRoot, contactSheetPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, galleryPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
