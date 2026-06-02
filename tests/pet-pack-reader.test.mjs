import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);

const { readAssetPack } = require('../src/main/pet-pack.js');

test('reads bundled Yoyo asset pack metadata for pet list snapshots', () => {
  const pack = readAssetPack(join(repoRoot, 'assets/yoyo'));

  assert.ok(pack, 'Yoyo pack should be readable');
  assert.equal(pack.id, 'yoyo');
  assert.equal(pack.type, 'companion');
  assert.equal(pack.style, 'clean-2d-chibi');
  assert.equal(pack.manifestPath, join(repoRoot, 'assets/yoyo/pack-manifest.json'));
  assert.equal(pack.qa.reportPath, join(repoRoot, 'assets/yoyo/qa/asset-pack-report.md'));
  assert.equal(pack.inventorySummary.uncovered, 0);
  assert.ok(pack.inventorySummary.total >= 40);
  assert.ok(pack.inventorySummary.statusCounts.keep >= 1);
  assert.equal(pack.redrawQueueSummary.total, 1);
  assert.equal(pack.redrawQueueSummary.highPriority, 0);
  assert.equal(pack.redrawQueueSummary.next.path, 'home/composite-pet-cushion-yoyo.webp');
  assert.equal(pack.candidateRegistrySummary.totalTargets, 1);
  assert.equal(pack.candidateRegistrySummary.totalCandidates, 2);
  assert.equal(pack.candidateRegistrySummary.dispositionCounts.reference, 2);
  assert.deepEqual(pack.avatar.goldenActions.slice(0, 3), ['idle', 'runningLeft', 'runningRight']);
});

test('returns null for legacy pet directories without an asset pack manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'legacy-pet-'));
  writeFileSync(join(dir, 'pet.json'), JSON.stringify({ id: 'legacy' }));

  assert.equal(readAssetPack(dir), null);
});
