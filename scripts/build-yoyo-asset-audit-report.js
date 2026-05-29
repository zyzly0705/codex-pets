#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output/yoyo-asset-audit');
const imageExt = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.avif']);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function existsRel(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function isDirectoryRel(relPath) {
  try {
    return fs.statSync(path.join(repoRoot, relPath)).isDirectory();
  } catch {
    return false;
  }
}

function stripPointer(value) {
  return value.split('#')[0];
}

function normalizeSlashes(value) {
  return value.replaceAll(path.sep, '/');
}

function normalizeAssetPath(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const clean = stripPointer(value.trim());
  if (!clean || /^https?:/u.test(clean)) return null;

  if (/^\.\.\/assets\/yoyo\//u.test(clean)) {
    return clean.replace(/^\.\.\//u, '');
  }

  if (/^\.\.\/assets-src\/yoyo\//u.test(clean)) {
    return clean.replace(/^\.\.\//u, '');
  }

  if (/^\.\.\/\.\.\/docs\//u.test(clean)) {
    return clean.replace(/^\.\.\/\.\.\//u, '');
  }

  if (/^(assets|assets-src|docs|output|src)\//u.test(clean)) {
    return clean;
  }

  if (base === 'assets/yoyo' && /^(home|effects|desktop-rig|live2d|scenes|qa)\//u.test(clean)) {
    return `assets/yoyo/${clean}`;
  }

  if (base === 'assets/yoyo' && /^(pet\.json|spritesheet\.webp)/u.test(clean)) {
    return `assets/yoyo/${clean}`;
  }

  return null;
}

function addRef(map, relPath, source, note = '') {
  if (!relPath) return;
  const key = normalizeSlashes(relPath);
  if (!map.has(key)) {
    map.set(key, {
      path: key,
      exists: existsRel(key),
      isDirectory: isDirectoryRel(key),
      sources: [],
      notes: [],
    });
  }
  const entry = map.get(key);
  if (!entry.sources.includes(source)) entry.sources.push(source);
  if (note && !entry.notes.includes(note)) entry.notes.push(note);
}

function walkJson(value, visit, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, [...trail, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkJson(child, visit, [...trail, key]);
    }
    return;
  }
  visit(value, trail);
}

function collectManifestRefs(refs) {
  const packManifest = readJson('assets/yoyo/pack-manifest.json');
  const status = readJson('assets/yoyo/asset-status.json');
  const v3Manifest = readJson('assets-src/yoyo/v3/manifest.json');

  walkJson(packManifest, (value, trail) => {
    addRef(
      refs,
      normalizeAssetPath(value, 'assets/yoyo'),
      `assets/yoyo/pack-manifest.json#/${trail.join('/')}`,
    );
  });

  for (const item of status.assets || []) {
    addRef(refs, normalizeAssetPath(item.path, 'assets/yoyo'), 'assets/yoyo/asset-status.json', item.status);
    for (const candidate of item.candidates || []) {
      addRef(
        refs,
        normalizeAssetPath(candidate.path, 'repo'),
        'assets/yoyo/asset-status.json#/candidates',
        candidate.disposition || '',
      );
    }
  }

  walkJson(v3Manifest, (value, trail) => {
    addRef(
      refs,
      normalizeAssetPath(value, 'repo'),
      `assets-src/yoyo/v3/manifest.json#/${trail.join('/')}`,
    );
  });

  return { packManifest, status, v3Manifest };
}

function collectRuntimeRefs(refs) {
  const srcFiles = [];
  const stack = [path.join(repoRoot, 'src')];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const abs = path.join(current, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        stack.push(abs);
      } else if (/\.(js|html|css)$/u.test(name)) {
        srcFiles.push(abs);
      }
    }
  }

  const assetPattern = /(?:\.\.\/)?assets\/yoyo\/[A-Za-z0-9_./-]+\.(?:png|webp|jpg|jpeg|gif|json|atlas)/giu;
  const homeNamePattern = /asset\('([A-Za-z0-9_-]+)'\)/gu;

  for (const abs of srcFiles) {
    const relSource = normalizeSlashes(path.relative(repoRoot, abs));
    const content = fs.readFileSync(abs, 'utf8');
    for (const match of content.matchAll(assetPattern)) {
      const normalized = match[0].replace(/^\.\.\//u, '');
      addRef(refs, normalized, `${relSource}:static-reference`);
    }
    for (const match of content.matchAll(homeNamePattern)) {
      addRef(refs, `assets/yoyo/home/${match[1]}.webp`, `${relSource}:home-scene-asset-helper`);
    }
  }
}

function statusCounts(status) {
  return (status.assets || []).reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
}

function galleryItem(relPath, label, note) {
  const fromOutput = normalizeSlashes(path.relative(outputDir, path.join(repoRoot, relPath)));
  return `
      <figure>
        <img src="${fromOutput}" loading="lazy" alt="${label}">
        <figcaption><strong>${label}</strong><span>${note || relPath}</span></figcaption>
      </figure>`;
}

function writeGallery(matrix, status, v3Manifest) {
  const items = [];

  for (const group of ['rooms', 'props', 'composites']) {
    for (const asset of v3Manifest[group] || []) {
      if (existsRel(asset.qaPreview) && imageExt.has(path.extname(asset.qaPreview).toLowerCase())) {
        items.push(galleryItem(asset.qaPreview, asset.id, `${group} QA preview`));
      } else if (existsRel(asset.runtime) && imageExt.has(path.extname(asset.runtime).toLowerCase())) {
        items.push(galleryItem(asset.runtime, asset.id, `${group} runtime asset`));
      }
    }
  }

  for (const item of status.assets || []) {
    if (item.status !== 'redraw') continue;
    for (const candidate of item.candidates || []) {
      const relPath = normalizeAssetPath(candidate.path, 'repo');
      if (relPath && existsRel(relPath) && imageExt.has(path.extname(relPath).toLowerCase())) {
        items.push(galleryItem(relPath, `${item.path} / ${candidate.disposition}`, candidate.note));
      }
    }
  }

  const missingRows = matrix
    .filter((entry) => !entry.exists)
    .map((entry) => `<tr><td><code>${entry.path}</code></td><td>${entry.sources.join('<br>')}</td><td>${entry.notes.join('<br>')}</td></tr>`)
    .join('\n');

  fs.writeFileSync(path.join(outputDir, 'gallery.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Yoyo Asset Audit Gallery</title>
  <style>
    body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f4ef; color: #24211c; }
    header { padding: 24px 28px 12px; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 28px 28px 12px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 0 28px 28px; }
    figure { margin: 0; background: #fff; border: 1px solid #ded7cb; border-radius: 8px; overflow: hidden; }
    img { width: 100%; height: 180px; object-fit: contain; background: repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 50% / 20px 20px; }
    figcaption { display: grid; gap: 3px; padding: 10px 12px 12px; }
    figcaption span { color: #6d6256; font-size: 12px; }
    table { width: calc(100% - 56px); margin: 0 28px 32px; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #ded7cb; padding: 8px 10px; vertical-align: top; }
    th { text-align: left; background: #ece5da; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Yoyo Asset Audit Gallery</h1>
    <p>V3 QA previews plus redraw candidates. Missing references are listed at the bottom.</p>
  </header>
  <section class="grid">${items.join('\n')}</section>
  <h2>Missing References</h2>
  <table>
    <thead><tr><th>Path</th><th>Sources</th><th>Notes</th></tr></thead>
    <tbody>${missingRows || '<tr><td colspan="3">None</td></tr>'}</tbody>
  </table>
</body>
</html>
`);
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const refs = new Map();
  const { status, v3Manifest } = collectManifestRefs(refs);
  collectRuntimeRefs(refs);

  const matrix = [...refs.values()].sort((a, b) => a.path.localeCompare(b.path));
  const missing = matrix.filter((entry) => !entry.exists);
  const concreteMissing = missing.filter((entry) => !entry.path.endsWith('/'));
  const directoriesMissing = missing.filter((entry) => entry.path.endsWith('/'));
  const redrawItems = (status.assets || []).filter((entry) => entry.status === 'redraw');
  const v3Count = ['rooms', 'props', 'composites'].reduce((total, group) => total + (v3Manifest[group] || []).length, 0);

  const summary = [
    '# Yoyo Asset Audit Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Inputs: `assets/yoyo/pack-manifest.json`, `assets/yoyo/asset-status.json`, `assets-src/yoyo/v3/manifest.json`, static refs under `src/`.',
    '- Outputs: `asset-matrix.json`, `missing-assets.json`, `summary.md`, `gallery.html`.',
    '',
    '## Results',
    '',
    `- Total referenced paths: ${matrix.length}`,
    `- Existing paths: ${matrix.length - missing.length}`,
    `- Missing concrete files: ${concreteMissing.length}`,
    `- Missing directories/placeholders: ${directoriesMissing.length}`,
    `- V3 accepted assets tracked: ${v3Count}`,
    `- Redraw targets: ${redrawItems.length}`,
    '',
    '## Status Counts',
    '',
    ...Object.entries(statusCounts(status)).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Missing Concrete Files',
    '',
    ...(concreteMissing.length
      ? concreteMissing.map((entry) => `- \`${entry.path}\` (${entry.sources.join(', ')})`)
      : ['- None']),
    '',
    '## Missing Directories Or Placeholders',
    '',
    ...(directoriesMissing.length
      ? directoriesMissing.map((entry) => `- \`${entry.path}\` (${entry.sources.join(', ')})`)
      : ['- None']),
    '',
    '## Existing QA Reports',
    '',
    '- `assets/yoyo/qa/asset-pack-report.md`',
    '- `assets/yoyo/qa/v3/v3-kit-report.md`',
    '- `assets/yoyo/qa/final-art/contact-sheet.png`',
    '',
    '## Gallery',
    '',
    '- `output/yoyo-asset-audit/gallery.html`',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, 'asset-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'missing-assets.json'), `${JSON.stringify(missing, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'summary.md'), summary);

  for (const relPath of ['assets/yoyo/qa/asset-pack-report.md', 'assets/yoyo/qa/v3/v3-kit-report.md']) {
    if (existsRel(relPath)) {
      fs.copyFileSync(path.join(repoRoot, relPath), path.join(outputDir, path.basename(relPath)));
    }
  }

  writeGallery(matrix, status, v3Manifest);

  console.log(`Wrote ${normalizeSlashes(path.relative(repoRoot, outputDir))}`);
  console.log(`Referenced paths: ${matrix.length}`);
  console.log(`Missing paths: ${missing.length}`);
}

main();
