const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const result = spawnSync(
  process.execPath,
  [
    join(repoRoot, 'scripts/build-yoyo-final-art-effect.js'),
    '--manifest',
    'assets-src/yoyo/final-art/bath-final-effect.manifest.json',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
