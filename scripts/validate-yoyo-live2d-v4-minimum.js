const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { readPsd } = require('ag-psd');

const repoRoot = path.join(__dirname, '..');
const rigDir = path.join(repoRoot, 'assets-src', 'yoyo', 'rig', 'live2d-yoyo-v4');
const outDir = path.join(repoRoot, 'output', 'yoyo-live2d-v4-minimum-validation');

const exportFiles = [
  'yoyo.model3.json',
  'yoyo.moc3',
  'motions/idle.motion3.json',
  'motions/talk_loop.motion3.json',
];

const renderOrder = [
  'hair_back',
  'bun',
  'face_base',
  'hair_front',
  'bangs_center',
  'side_hair_left',
  'side_hair_right',
  'collar',
  'torso_top',
  'bow_left',
  'bow_center',
  'bow_right',
  'button_left',
  'button_right',
  'arm_left',
  'arm_right',
  'hand_left',
  'hand_right',
  'skirt',
  'leg_left',
  'leg_right',
  'shoe_left',
  'shoe_right',
  'brow_left',
  'brow_right',
  'blush_left',
  'blush_right',
];

const expressionLayerNames = [
  'eye_left_open',
  'eye_right_open',
  'eye_left_blink',
  'eye_right_blink',
  'eye_left_smile',
  'eye_right_smile',
  'mouth_closed',
  'mouth_flat',
  'mouth_small',
  'mouth_open',
  'mouth_smile',
  'mouth_o',
];

function exists(relPath) {
  return fs.existsSync(path.join(rigDir, relPath));
}

function findLocalCubism() {
  const candidates = [];
  for (const cmd of ['live2d', 'cubism', 'Live2D', 'Cubism']) {
    try {
      const found = execFileSync('which', [cmd], { encoding: 'utf8' }).trim();
      if (found) candidates.push(found);
    } catch (_) {
      // Command is not installed.
    }
  }
  for (const root of ['/Applications', path.join(process.env.HOME || '', 'Applications')]) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (/live2d|cubism/i.test(entry.name)) candidates.push(full);
        if (entry.isDirectory() && current.split(path.sep).length - root.split(path.sep).length < 3) {
          stack.push(full);
        }
      }
    }
  }
  return [...new Set(candidates)];
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(rigDir, file), 'utf8'));
}

function flattenPsdGroups(nodes = [], depth = 0, rows = []) {
  for (const node of nodes) {
    rows.push({
      name: node.name,
      type: node.children ? 'group' : 'layer',
      depth,
      bounds: node.children ? null : {
        left: node.left,
        top: node.top,
        right: node.right,
        bottom: node.bottom,
      },
    });
    if (node.children) flattenPsdGroups(node.children, depth + 1, rows);
  }
  return rows;
}

async function alphaBox(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }
  return count
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, alphaPixels: count }
    : { x: 0, y: 0, width: 0, height: 0, alphaPixels: 0 };
}

async function renderExpression({ id, visibleLayers }, manifest, layerByName) {
  const composites = [];
  const names = new Set([...renderOrder, ...visibleLayers]);
  for (const name of names) {
    if (expressionLayerNames.includes(name) && !visibleLayers.includes(name)) continue;
    const layer = layerByName.get(name);
    if (!layer) continue;
    composites.push({
      input: path.join(rigDir, layer.file),
      left: layer.left,
      top: layer.top,
    });
  }
  const out = path.join(outDir, `state-${id}.png`);
  await sharp({
    create: {
      width: manifest.document.width,
      height: manifest.document.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(out);
  return out;
}

async function makeContactSheet(files) {
  const thumbW = 260;
  const thumbH = 260;
  const gap = 18;
  const labelH = 34;
  const width = files.length * thumbW + (files.length + 1) * gap;
  const height = thumbH + labelH + gap * 2;
  const composites = [];
  for (let i = 0; i < files.length; i += 1) {
    const { file, id } = files[i];
    const thumb = await sharp(file)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
      .resize(thumbW, thumbH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${thumbW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${thumbW / 2}" y="24" text-anchor="middle" font-size="19" fill="#e8edf8" font-family="Arial, sans-serif">${id}</text>
    </svg>`);
    const left = gap + i * (thumbW + gap);
    composites.push({ input: thumb, left, top: gap });
    composites.push({ input: label, left, top: gap + thumbH });
  }
  const sheet = path.join(outDir, 'contact-sheet.png');
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 24, g: 26, b: 34, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(sheet);
  return sheet;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = loadJson('manifest.json');
  const visibilityMap = loadJson('cubism-expression-visibility-map.json');
  const bindingProfile = loadJson('live2d-binding-profile.json');
  const psdPath = path.join(rigDir, 'yoyo-live2d-rig-v4.psd');
  const psd = readPsd(fs.readFileSync(psdPath), {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });
  const layerByName = new Map(manifest.layers.map((layer) => [layer.name, layer]));

  const rendered = [];
  for (const state of visibilityMap.states) {
    const file = await renderExpression(state, manifest, layerByName);
    rendered.push({ id: state.id, file });
  }
  const contactSheet = await makeContactSheet(rendered);

  const layerAudit = [];
  for (const layer of manifest.layers) {
    const filePath = path.join(rigDir, layer.file);
    layerAudit.push({
      name: layer.name,
      file: layer.file,
      declared: { left: layer.left, top: layer.top, width: layer.width, height: layer.height },
      alphaBox: await alphaBox(filePath),
    });
  }

  const missingExports = exportFiles.filter((file) => !exists(file));
  const cubismCandidates = findLocalCubism();
  const report = {
    generatedAt: new Date().toISOString(),
    rigDir,
    outDir,
    cubismCandidates,
    realLive2DExport: {
      expectedFiles: exportFiles,
      missingFiles: missingExports,
      status: missingExports.length ? 'blocked-no-exported-model' : 'present',
    },
    psd: {
      file: psdPath,
      width: psd.width,
      height: psd.height,
      tree: flattenPsdGroups(psd.children),
    },
    manifest: {
      version: manifest.version,
      source: manifest.source,
      document: manifest.document,
      layerCount: manifest.layers.length,
      groups: manifest.groups,
      notes: manifest.notes || [],
    },
    bindingProfile: {
      parameters: bindingProfile.parameters.map((parameter) => parameter.id),
      expressions: bindingProfile.expressions.map((expression) => expression.id),
    },
    renderedStates: rendered.map((item) => ({ id: item.id, file: path.relative(repoRoot, item.file) })),
    contactSheet: path.relative(repoRoot, contactSheet),
    layerAudit,
    conclusion: missingExports.length
      ? 'This validates PSD/layer composition only. It is not a real Live2D runtime validation because Cubism-exported model files are missing.'
      : 'Export files are present; next step is runtime loading validation.',
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), [
    '# Yoyo Live2D v4 Minimum Validation',
    '',
    `- Cubism app/tool found: ${cubismCandidates.length ? cubismCandidates.join(', ') : 'no'}`,
    `- Real Live2D export status: ${report.realLive2DExport.status}`,
    `- Missing export files: ${missingExports.length ? missingExports.join(', ') : 'none'}`,
    `- PSD: ${psd.width}x${psd.height}, ${manifest.layers.length} declared layers`,
    `- Contact sheet: ${report.contactSheet}`,
    '',
    'Conclusion:',
    report.conclusion,
    '',
  ].join('\n'));

  console.log(`Wrote ${path.relative(repoRoot, contactSheet)}`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(outDir, 'report.md'))}`);
  if (missingExports.length) {
    console.log(`Blocked: missing ${missingExports.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
