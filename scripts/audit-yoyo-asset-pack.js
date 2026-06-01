#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const yoyoRoot = path.join(repoRoot, 'assets/yoyo');
const manifestPath = path.join(yoyoRoot, 'pack-manifest.json');
const statusPath = path.join(yoyoRoot, 'asset-status.json');
const petJsonPath = path.join(yoyoRoot, 'pet.json');

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');
const shouldWriteReport = args.has('--write-report');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function yoyoPath(assetPath) {
  return path.resolve(yoyoRoot, assetPath);
}

function repoPath(assetPath) {
  return path.resolve(repoRoot, assetPath);
}

function pathExists(assetPath) {
  return existsSync(yoyoPath(assetPath));
}

function candidatePath(candidatePath) {
  if (!candidatePath) return '';
  if (path.isAbsolute(candidatePath)) return candidatePath;
  if (/^(assets|assets-src|output|tmp|docs)\//u.test(candidatePath)) {
    return repoPath(candidatePath);
  }
  return yoyoPath(candidatePath);
}

function flattenManifestPaths(manifest) {
  const paths = [];

  paths.push(manifest.runtimeCompatibility?.currentPetJson);
  paths.push(manifest.avatar?.sheet);
  paths.push(manifest.home?.runtimeSheet);
  paths.push(manifest.home?.runtimeCharacter);
  paths.push(...Object.values(manifest.home?.rooms || {}));
  for (const scene of Object.values(manifest.careScenes || {})) {
    paths.push(scene.composite);
    paths.push(scene.prop);
  }
  paths.push(...Object.values(manifest.specialActions || {}).map((action) => action.timeline));
  paths.push(...(manifest.imageChecks || []).map((check) => check.path));

  return [...new Set(paths.filter(Boolean))];
}

function parseSipsDimensions(filePath) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
    encoding: 'utf8',
  });
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return { width, height };
}

function tryParseDimensions(filePath) {
  try {
    return parseSipsDimensions(filePath);
  } catch {
    return { width: null, height: null };
  }
}

function statusCounts(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
  }
  return counts;
}

function slugifyAssetPath(assetPath) {
  return assetPath.replace(/\.[^.]+$/u, '').replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase();
}

function redrawKind(assetPath) {
  if (/\/room-stage-/u.test(assetPath)) return 'room';
  if (/\/composite-/u.test(assetPath)) return 'composite';
  if (/\/prop-/u.test(assetPath)) return 'prop';
  return 'asset';
}

function redrawPriority(assetPath) {
  if (assetPath === 'home/room-stage-v2.webp') return 'high';
  if (assetPath === 'home/prop-food.webp') return 'high';
  return 'medium';
}

function kindAcceptance(kind) {
  if (kind === 'room') {
    return 'Room composition keeps a cozy child-scale desktop companion space with clear usable zones.';
  }
  if (kind === 'composite') {
    return 'Composite keeps Yoyo readable at runtime scale and frames the interaction as care or comfort.';
  }
  if (kind === 'prop') {
    return 'Prop reads as human tableware, furniture, or daily object instead of animal-care equipment.';
  }
  return 'Asset preserves the Yoyo companion identity and runtime readability.';
}

function redrawReferences(assetPath, kind, manifest) {
  const references = [manifest.identity?.styleBible].filter(Boolean);
  if (kind === 'room') references.push('home/room-shell-clean-2d.webp');
  if (kind === 'prop' && assetPath.includes('prop-food')) references.push('home/prop-food-meal-full.webp');
  if (kind === 'composite') references.push('home/composite-sleep-bed-yoyo.webp');
  return references;
}

function buildRedrawQueue(manifest, status) {
  const avoidList = manifest.semantics?.avoid || [];
  const avoidText = avoidList.join(', ');
  const redrawItems = (status.assets || [])
    .filter((entry) => entry.status === 'redraw')
    .map((entry, index) => {
      const kind = redrawKind(entry.path);
      const id = slugifyAssetPath(entry.path);
      return {
        id,
        path: entry.path,
        targetPath: entry.path,
        sourceStatusPath: entry.path,
        status: 'queued',
        priority: redrawPriority(entry.path),
        kind,
        reason: entry.reason,
        briefPath: `qa/redraw-briefs/${id}.md`,
        references: redrawReferences(entry.path, kind, manifest),
        acceptance: [
          'Reads as a human-like companion asset, not an animal pet asset.',
          `Avoid these semantics: ${avoidText}.`,
          'Matches the clean-2d-chibi Yoyo style with soft linework and low visual noise.',
          'Preserves the target runtime path so existing Electron and Pixi code keeps working.',
          kindAcceptance(kind),
        ],
        order: index + 1,
      };
    });

  const priorityRank = { high: 0, medium: 1, low: 2 };
  redrawItems.sort((a, b) => {
    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    return byPriority || a.order - b.order;
  });

  return {
    pack: manifest.id,
    generatedAt: new Date().toISOString(),
    source: 'asset-status.json',
    total: redrawItems.length,
    items: redrawItems,
  };
}

function renderRedrawBrief(item, manifest) {
  const acceptance = item.acceptance.map((rule) => `- ${rule}`).join('\n');
  const references = item.references.map((reference) => `- \`${reference}\``).join('\n');

  return `# Redraw Brief: ${item.path}

## Intent

Rebuild \`${item.path}\` for the Yoyo asset pack. Yoyo is a ${manifest.semantics.species}, so the result should feel like a small desktop life companion asset rather than animal-pet care art.

## Production

- Priority: \`${item.priority}\`
- Kind: \`${item.kind}\`
- Target path: \`${item.targetPath}\`
- Status: \`${item.status}\`
- Reason: ${item.reason}

## Acceptance

${acceptance}

## References

${references || '- None'}
`;
}

function writeRedrawArtifacts(redrawQueue, manifest) {
  const queuePath = yoyoPath('qa/redraw-queue.json');
  const briefsDir = yoyoPath('qa/redraw-briefs');
  mkdirSync(path.dirname(queuePath), { recursive: true });
  mkdirSync(briefsDir, { recursive: true });
  const activeBriefNames = new Set(redrawQueue.items.map((item) => path.basename(item.briefPath)));
  for (const fileName of readdirSync(briefsDir)) {
    if (fileName.endsWith('.md') && !activeBriefNames.has(fileName)) {
      unlinkSync(path.join(briefsDir, fileName));
    }
  }
  writeFileSync(queuePath, `${JSON.stringify(redrawQueue, null, 2)}\n`);
  for (const item of redrawQueue.items) {
    writeFileSync(yoyoPath(item.briefPath), renderRedrawBrief(item, manifest));
  }
}

function buildCandidateRegistry(manifest, status) {
  const items = (status.assets || [])
    .filter((entry) => entry.status === 'redraw')
    .map((entry) => {
      const candidates = (entry.candidates || []).map((candidate) => {
        const filePath = candidatePath(candidate.path);
        const exists = existsSync(filePath);
        const dimensions = exists ? tryParseDimensions(filePath) : { width: null, height: null };
        return {
          path: candidate.path,
          disposition: candidate.disposition || 'reference',
          note: candidate.note || '',
          exists,
          width: dimensions.width,
          height: dimensions.height,
        };
      });
      return {
        targetPath: entry.path,
        kind: redrawKind(entry.path),
        reason: entry.reason,
        candidates,
      };
    });

  const dispositionCounts = {};
  for (const item of items) {
    for (const candidate of item.candidates) {
      dispositionCounts[candidate.disposition] = (dispositionCounts[candidate.disposition] || 0) + 1;
    }
  }

  return {
    pack: manifest.id,
    generatedAt: new Date().toISOString(),
    source: 'asset-status.json#/assets[].candidates',
    totalTargets: items.length,
    totalCandidates: items.reduce((total, item) => total + item.candidates.length, 0),
    dispositionCounts,
    items,
  };
}

function renderCandidateRegistry(registry) {
  const sections = registry.items.map((item) => {
    const rows = item.candidates.map((candidate) => (
      `| \`${candidate.disposition}\` | \`${candidate.path}\` | ${candidate.exists ? 'yes' : 'no'} | ${candidate.width || '-'}x${candidate.height || '-'} | ${candidate.note} |`
    )).join('\n');
    return `## ${item.targetPath}

${item.reason}

| Disposition | Path | Exists | Size | Note |
| --- | --- | --- | ---: | --- |
${rows || '| - | - | - | - | - |'}
`;
  }).join('\n');

  return `# Yoyo Candidate Registry

Generated: ${registry.generatedAt}

- Pack: \`${registry.pack}\`
- Redraw targets: ${registry.totalTargets}
- Candidate assets: ${registry.totalCandidates}

${sections}
`;
}

function writeCandidateArtifacts(candidateRegistry, manifest) {
  const registryPath = yoyoPath(manifest.qa?.candidateRegistry || 'qa/candidate-registry.json');
  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(candidateRegistry, null, 2)}\n`);
  writeFileSync(yoyoPath('qa/candidate-registry.md'), renderCandidateRegistry(candidateRegistry));
}

function formatStatusCounts(entries) {
  const counts = statusCounts(entries);
  return ['keep', 'redraw', 'remove', 'experimental', 'archive']
    .map((status) => `| \`${status}\` | ${counts.get(status) || 0} |`)
    .join('\n');
}

function renderReport({ manifest, status, inventory, redrawQueue, candidateRegistry, checkedPaths, imageResults, warnings }) {
  const statusRows = formatStatusCounts(inventory.assets);
  const goldenActions = manifest.avatar.goldenActions.map((action) => `- \`${action}\``).join('\n');
  const redrawItems = status.assets
    .filter((entry) => entry.status === 'redraw')
    .map((entry) => `- \`${entry.path}\`: ${entry.reason}`)
    .join('\n');
  const redrawProductionRows = redrawQueue.items
    .map((item) => `| \`${item.priority}\` | \`${item.kind}\` | \`${item.path}\` | \`${item.briefPath}\` |`)
    .join('\n');
  const candidateRows = candidateRegistry.items
    .map((item) => {
      const candidateCount = item.candidates.length;
      const best = item.candidates.find((candidate) => candidate.disposition === 'v1-vibe')
        || item.candidates.find((candidate) => candidate.disposition === 'candidate')
        || item.candidates.find((candidate) => candidate.disposition === 'base')
        || item.candidates.find((candidate) => candidate.disposition === 'cleanup-base')
        || item.candidates[0];
      return `| \`${item.targetPath}\` | ${candidateCount} | \`${best?.disposition || '-'}\` | \`${best?.path || '-'}\` |`;
    })
    .join('\n');
  const experimentalItems = status.assets
    .filter((entry) => entry.status === 'experimental')
    .map((entry) => `- \`${entry.path}\`: ${entry.reason}`)
    .join('\n');
  const pathRows = checkedPaths.map((assetPath) => `- \`${assetPath}\``).join('\n');
  const imageRows = imageResults
    .map((result) => `| \`${result.path}\` | ${result.width}x${result.height} | ${result.expectedWidth}x${result.expectedHeight} |`)
    .join('\n');
  const watchlist = status.assets
    .filter((entry) => /food|room-stage|pet-cushion/u.test(entry.path))
    .map((entry) => `- \`${entry.path}\` (${entry.status}): ${entry.reason}`)
    .join('\n');
  const warningText = warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- None';

  return `# Yoyo Asset Pack QA Report

Generated: ${new Date().toISOString()}

## Pack

- Pack: \`${manifest.id}\`
- Type: \`${manifest.type}\`
- Style: \`${manifest.style}\`
- Species: \`${manifest.semantics.species}\`
- Runtime compatibility: current \`pet.json\` paths are preserved.

## Golden Asset Set V1

${goldenActions}

## Status Summary

| Status | Count |
| --- | ---: |
${statusRows}

## Redraw Queue

${redrawItems || '- None'}

## Redraw Production Queue

| Priority | Kind | Asset | Brief |
| --- | --- | --- | --- |
${redrawProductionRows || '| - | - | - | - |'}

## Candidate Registry

| Target | Candidates | Recommended disposition | Recommended path |
| --- | ---: | --- | --- |
${candidateRows || '| - | - | - | - |'}

## Experimental Queue

${experimentalItems || '- None'}

## Companion Semantics Watchlist

${watchlist || '- None'}

## Manifest Runtime Paths

${pathRows}

## Image Dimension Checks

| Asset | Actual | Expected |
| --- | ---: | ---: |
${imageRows}

## Warnings

${warningText}
`;
}

function collectAssetFiles(dir, baseDir = dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;

    const filePath = path.join(dir, name);
    const assetPath = path.relative(baseDir, filePath).replace(/\\/g, '/');

    if (assetPath === 'pack-manifest.json') continue;
    if (assetPath === 'asset-status.json') continue;
    if (assetPath === 'qa') continue;
    if (assetPath.startsWith('qa/')) continue;

    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      entries.push(...collectAssetFiles(filePath, baseDir));
    } else {
      entries.push({
        path: assetPath,
        bytes: stats.size,
      });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function resolveStatus(assetPath, statusEntries) {
  const sorted = [...statusEntries].sort((a, b) => b.path.length - a.path.length);
  return sorted.find((entry) => {
    if (entry.path.endsWith('/')) return assetPath.startsWith(entry.path);
    return assetPath === entry.path;
  });
}

function buildInventory(manifest, status) {
  const files = collectAssetFiles(yoyoRoot);
  const uncovered = [];
  const assets = files.map((file) => {
    const match = resolveStatus(file.path, status.assets || []);
    if (!match) {
      uncovered.push(file.path);
      return {
        path: file.path,
        bytes: file.bytes,
        status: 'uncovered',
        sourceStatusPath: null,
        reason: '',
      };
    }
    return {
      path: file.path,
      bytes: file.bytes,
      status: match.status,
      sourceStatusPath: match.path,
      reason: match.reason,
    };
  });

  return {
    pack: manifest.id,
    generatedAt: new Date().toISOString(),
    assets,
    uncovered,
  };
}

function audit() {
  const errors = [];
  const warnings = [];

  if (!existsSync(manifestPath)) errors.push(`${rel(manifestPath)} is missing`);
  if (!existsSync(statusPath)) errors.push(`${rel(statusPath)} is missing`);
  if (!existsSync(petJsonPath)) errors.push(`${rel(petJsonPath)} is missing`);
  if (errors.length) return { errors, warnings };

  const manifest = readJson(manifestPath);
  const status = readJson(statusPath);
  const pet = readJson(petJsonPath);
  const inventory = buildInventory(manifest, status);
  const redrawQueue = buildRedrawQueue(manifest, status);
  const candidateRegistry = buildCandidateRegistry(manifest, status);

  if (manifest.id !== 'yoyo') errors.push('pack manifest id must be yoyo');
  if (manifest.type !== 'companion') errors.push('pack manifest type must be companion');
  if (manifest.semantics?.species !== 'human-like companion') {
    errors.push('pack manifest must classify Yoyo as a human-like companion');
  }
  if (!Array.isArray(manifest.avatar?.goldenActions) || manifest.avatar.goldenActions.length === 0) {
    errors.push('pack manifest must declare avatar.goldenActions');
  }

  const checkedPaths = flattenManifestPaths(manifest);
  for (const assetPath of checkedPaths) {
    if (assetPath.includes('sources/') || assetPath.startsWith('output/')) {
      errors.push(`runtime manifest path must not point to sources or output: ${assetPath}`);
    }
    if (!pathExists(assetPath)) errors.push(`manifest path does not exist: assets/yoyo/${assetPath}`);
  }

  const petStates = new Set(Object.keys(pet.states || {}));
  for (const action of manifest.avatar?.goldenActions || []) {
    if (!petStates.has(action)) errors.push(`golden action is missing from pet.json states: ${action}`);
  }

  const allowedStatuses = new Set(status.taxonomy || []);
  for (const required of ['keep', 'redraw', 'remove', 'experimental', 'archive']) {
    if (!allowedStatuses.has(required)) errors.push(`asset-status taxonomy is missing ${required}`);
  }
  if (!Array.isArray(status.assets) || status.assets.length === 0) {
    errors.push('asset-status assets must be a non-empty array');
  }

  const seenStatusPaths = new Set();
  for (const entry of status.assets || []) {
    if (!entry.path) errors.push('asset-status entry is missing path');
    if (!allowedStatuses.has(entry.status)) {
      errors.push(`${entry.path} uses invalid status ${entry.status}`);
    }
    if (!entry.reason || typeof entry.reason !== 'string') {
      errors.push(`${entry.path} must include a non-empty reason`);
    }
    if (entry.status === 'redraw') {
      if (!Array.isArray(entry.candidates) || entry.candidates.length === 0) {
        errors.push(`${entry.path} must list candidate source material`);
      }
      for (const candidate of entry.candidates || []) {
        if (!candidate.path) errors.push(`${entry.path} has a candidate without path`);
        if (!candidate.disposition) errors.push(`${entry.path} candidate ${candidate.path} needs disposition`);
        if (candidate.path && !existsSync(candidatePath(candidate.path))) {
          errors.push(`${entry.path} candidate does not exist: ${candidate.path}`);
        }
      }
    }
    if (seenStatusPaths.has(entry.path)) errors.push(`duplicate asset-status entry: ${entry.path}`);
    seenStatusPaths.add(entry.path);

    if (!pathExists(entry.path)) {
      warnings.push(`status entry does not currently exist under assets/yoyo: ${entry.path}`);
    }
  }

  if (inventory.uncovered.length > 0) {
    for (const assetPath of inventory.uncovered) {
      errors.push(`asset inventory has no status coverage: ${assetPath}`);
    }
  }

  const imageResults = [];
  for (const check of manifest.imageChecks || []) {
    const filePath = yoyoPath(check.path);
    if (!existsSync(filePath)) {
      errors.push(`image check target does not exist: ${check.path}`);
      continue;
    }
    const dimensions = parseSipsDimensions(filePath);
    imageResults.push({
      path: check.path,
      width: dimensions.width,
      height: dimensions.height,
      expectedWidth: check.width,
      expectedHeight: check.height,
    });
    if (dimensions.width !== check.width || dimensions.height !== check.height) {
      errors.push(
        `${check.path} dimensions are ${dimensions.width}x${dimensions.height}, expected ${check.width}x${check.height}`,
      );
    }
  }

  if (shouldWriteReport && manifest.qa?.report) {
    const reportPath = yoyoPath(manifest.qa.report);
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(
      yoyoPath('qa/asset-inventory.json'),
      `${JSON.stringify(inventory, null, 2)}\n`,
    );
    writeRedrawArtifacts(redrawQueue, manifest);
    writeCandidateArtifacts(candidateRegistry, manifest);
    writeFileSync(
      reportPath,
      renderReport({ manifest, status, inventory, redrawQueue, candidateRegistry, checkedPaths, imageResults, warnings }),
    );
  }

  return { errors, warnings, checkedPaths, imageResults };
}

const result = audit();

if (result.errors.length) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  if (shouldCheck) process.exit(1);
}

for (const warning of result.warnings) console.warn(`WARN: ${warning}`);

console.log(
  `Yoyo asset pack audit passed (${result.checkedPaths?.length || 0} paths, ${result.imageResults?.length || 0} image checks)`,
);
