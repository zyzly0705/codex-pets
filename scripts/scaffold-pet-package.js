#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceManifestPath = path.join(repoRoot, 'assets', 'yoyo', 'pet.json');
const slug = process.argv[2];
const displayName = process.argv[3] || slug;

if (!slug || !/^[a-z0-9][a-z0-9-]*$/u.test(slug)) {
  console.error('Usage: node scripts/scaffold-pet-package.js <pet-slug> [display-name]');
  console.error('Example: node scripts/scaffold-pet-package.js gugu-gaga 咕咕嘎嘎');
  process.exit(1);
}

const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
const targetDir = path.join(repoRoot, 'assets', slug);
const targetManifestPath = path.join(targetDir, 'pet.json');

if (fs.existsSync(targetManifestPath)) {
  console.error(`${path.relative(repoRoot, targetManifestPath)} already exists`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const manifest = {
  id: slug,
  displayName,
  description: `${displayName} desktop companion package.`,
  spritesheetPath: 'spritesheet.webp',
  asset: {
    ...sourceManifest.asset,
    spritesheetPath: 'spritesheet.webp',
  },
  states: sourceManifest.states,
  layers: {
    coveragePolicy: 'best-effort',
    expectedColumns: sourceManifest.asset?.columns || 8,
    notes: 'Optional layer spritesheets should match the base sheet dimensions when present.',
  },
  render: sourceManifest.render,
};

fs.writeFileSync(targetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Created ${path.relative(repoRoot, targetManifestPath)}`);
console.log(`Add ${path.relative(repoRoot, path.join(targetDir, 'spritesheet.webp'))} before running asset audit.`);

