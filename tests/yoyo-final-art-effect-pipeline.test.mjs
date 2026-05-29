import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('builds a final-art effect from a manifest', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-final-art-effect-'));
  const manifestPath = join(runRoot, 'manifest.json');
  const manifest = {
    id: 'bath-final-test',
    version: 1,
    rigId: 'yoyo-bath-final-test',
    intent: 'Test final-art manifest build.',
    sourceArt: 'assets-src/yoyo/final-art/bath-final-art-v1.png',
    outputDir: runRoot,
    sourceRigDir: join(runRoot, 'source-rig'),
    runtimeDir: join(runRoot, 'runtime'),
    previewName: 'preview.png',
    stage: { width: 512, height: 384, background: '#f6efe7' },
    motion: {
      id: 'bath-final-test',
      fps: 8,
      loop: true,
      durationMs: 1200,
      keyframes: [
        { t: 0, shimmerX: 0, shimmerAlpha: 0.2, steamY: 0, steamAlpha: 0.2 },
        { t: 125, shimmerX: 1, shimmerAlpha: 0.3, steamY: -1, steamAlpha: 0.3 },
      ],
    },
    overlays: [
      { id: 'scene.shimmer', file: 'scene-shimmer.png', generator: 'water-shimmer-v1', z: 20 },
      { id: 'scene.steam', file: 'scene-steam.png', generator: 'steam-v1', z: 30 },
    ],
    scene: { mode: 'bath-final-art-test' },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  execFileSync(
    process.execPath,
    [join(repoRoot, 'scripts/build-yoyo-final-art-effect.js'), '--manifest', manifestPath],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  assert.ok(existsSync(join(runRoot, 'preview.png')), 'preview should exist');
  assert.ok(existsSync(join(runRoot, 'parts/scene-full.png')), 'full scene part should exist');
  assert.ok(existsSync(join(runRoot, 'parts/scene-shimmer.png')), 'shimmer part should exist');
  assert.ok(existsSync(join(runRoot, 'parts/scene-steam.png')), 'steam part should exist');
  assert.ok(existsSync(join(runRoot, 'runtime/timeline.json')), 'runtime timeline should exist');
  assert.ok(existsSync(join(runRoot, 'runtime/rig/yoyo.rig.json')), 'runtime rig should exist');

  const rig = JSON.parse(readFileSync(join(runRoot, 'yoyo.rig.json'), 'utf8'));
  assert.equal(rig.format, 'codex-pet-auto-rig');
  assert.deepEqual(
    rig.parts.map((part) => part.id),
    ['scene.full', 'scene.shimmer', 'scene.steam'],
  );
  assert.equal(rig.motions['bath-final-test'].keyframes.length, 2);

  const timeline = JSON.parse(readFileSync(join(runRoot, 'timeline.json'), 'utf8'));
  assert.equal(timeline.effectType, 'auto-rig-action');
  assert.equal(timeline.motion, 'bath-final-test');
  assert.equal(timeline.durationMs, 1200);
});
