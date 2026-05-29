import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('Yoyo Live2D export has a fixed QA command and package target', () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

  assert.equal(
    packageJson.scripts['qa:yoyo-live2d'],
    'node scripts/verify-yoyo-live2d-export.js',
  );
  assert.ok(
    packageJson.build.files.includes('assets/yoyo/live2d/**/*'),
    'packaged app should include accepted Live2D exports',
  );
  assert.ok(
    existsSync(join(repoRoot, 'scripts/verify-yoyo-live2d-export.js')),
    'QA wrapper should exist',
  );
});
