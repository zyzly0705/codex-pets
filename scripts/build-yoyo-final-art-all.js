const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const manifests = [
  'assets-src/yoyo/final-art/bath-final-effect.manifest.json',
  'assets-src/yoyo/final-art/eat-final-effect.manifest.json',
  'assets-src/yoyo/final-art/sleep-final-effect.manifest.json',
  'assets-src/yoyo/final-art/play-final-effect.manifest.json',
  'assets-src/yoyo/final-art/pet-final-effect.manifest.json',
  'assets-src/yoyo/final-art/watch-anime-final-effect.manifest.json',
  'assets-src/yoyo/final-art/play-switch-final-effect.manifest.json',
  'assets-src/yoyo/final-art/build-blocks-final-effect.manifest.json',
  'assets-src/yoyo/final-art/study-final-effect.manifest.json',
];

for (const manifest of manifests) {
  const result = spawnSync(
    process.execPath,
    [join(repoRoot, 'scripts/build-yoyo-final-art-effect.js'), '--manifest', manifest],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
