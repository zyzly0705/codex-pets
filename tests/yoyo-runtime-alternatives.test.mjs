import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('runtime alternative probe is wired as a project script', () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

  assert.equal(
    packageJson.scripts['probe:runtime-alternatives'],
    'node scripts/probe-yoyo-runtime-alternatives.js',
  );
  assert.ok(existsSync(join(repoRoot, 'scripts/probe-yoyo-runtime-alternatives.js')));
});
