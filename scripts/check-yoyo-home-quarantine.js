#!/usr/bin/env node
const { existsSync, readdirSync, readFileSync, statSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const legacyRuntimeFiles = [
  'src/home.html',
  'src/home.css',
  'src/home.js',
  'src/home-games.js',
  'src/home-phaser-games.js',
  'src/home-spine-action.js',
  'src/home-spine-feed-assets.js',
  'src/shared/home-scene.js',
];

const activeRoots = [
  'src/main',
  'src/yoyo-home',
];

const activeFiles = [
  'src/main.js',
  'src/preload.js',
  'src/yoyo-home.html',
  'src/yoyo-home-preview.html',
  'scripts/capture-home-scene.js',
];

const forbiddenActiveRefs = [
  'src/home.html',
  'src/home.css',
  'src/home.js',
  'home-games.js',
  'home-phaser-games.js',
  'home-spine-action.js',
  'home-spine-feed-assets.js',
  'shared/home-scene.js',
  'room-stage-v2.webp',
  'home-room-stage-v2',
];

function walk(relativeDir) {
  const root = path.join(repoRoot, relativeDir);
  const files = [];
  for (const name of readdirSync(root)) {
    const filePath = path.join(root, name);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...walk(path.relative(repoRoot, filePath)));
    } else if (/\.(?:js|mjs|html|css)$/u.test(name)) {
      files.push(path.relative(repoRoot, filePath));
    }
  }
  return files;
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function activeContent(relativePath) {
  const content = read(relativePath);
  if (relativePath === 'src/yoyo-home/data/home-manifest.mjs') {
    return content.replace(/forbiddenSources:\s*\[[\s\S]*?\],/u, 'forbiddenSources: [],');
  }
  return content;
}

const errors = [];
const packageJson = JSON.parse(read('package.json'));
const buildFiles = packageJson.build?.files || [];

for (const legacyFile of legacyRuntimeFiles) {
  if (existsSync(path.join(repoRoot, legacyFile))) {
    errors.push(`legacy DOM Home file must stay deleted from active source: ${legacyFile}`);
  }
  if (!buildFiles.includes(`!${legacyFile}`)) {
    errors.push(`package build must exclude quarantined legacy Home file: !${legacyFile}`);
  }
}

for (const sourceFile of [...activeFiles, ...activeRoots.flatMap(walk)]) {
  const content = activeContent(sourceFile);
  for (const forbidden of forbiddenActiveRefs) {
    if (content.includes(forbidden)) {
      errors.push(`${sourceFile} must not reference legacy Home runtime token: ${forbidden}`);
    }
  }
}

if (!packageJson.scripts?.check?.includes('scripts/check-yoyo-home-quarantine.js')) {
  errors.push('npm run check must include scripts/check-yoyo-home-quarantine.js');
}

if (packageJson.scripts?.check?.includes('node --check src/home.js')) {
  errors.push('npm run check must not syntax-check the legacy src/home.js as active Home code');
}

if (errors.length) {
  console.error('Yoyo Home quarantine check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Yoyo Home quarantine OK: legacy DOM Home source is deleted and excluded from packages');
