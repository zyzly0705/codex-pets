import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const manifestPath = join(repoRoot, 'assets-src/yoyo/effects/video-workflow-manifest.json');
const pixiStagePath = join(repoRoot, 'src/pixi-effect-stage.js');
const trayMenuPath = join(repoRoot, 'src/main/tray-menu.js');
const interactionPath = join(repoRoot, 'src/modules/interaction.js');

test('Yoyo effect video manifest scopes only dharma and clone rebuilds', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.workflow, 'yoyo-effect-video-reference');
  assert.deepEqual(Object.keys(manifest.effects).sort(), ['clone-heart', 'dharma-manifest']);
  assert.ok(manifest.excludedEffects.includes('digSand'), 'digSand should stay out of this agent scope');

  assert.match(manifest.characterContract.join('\n'), /human little girl/i);
  assert.match(manifest.characterContract.join('\n'), /full body/i);
  assert.match(manifest.characterContract.join('\n'), /never a dog/i);

  const clone = manifest.effects['clone-heart'];
  assert.equal(clone.runtime.effectType, 'clone');
  assert.equal(clone.runtime.effectId, 'clone-heart');
  assert.equal(clone.videoReference.targetFrames, 24);
  assert.equal(clone.videoReference.fps, 12);
  assert.ok(clone.layers.some((layer) => layer.role === 'character-composite'));
  assert.ok(clone.acceptanceGates.some((gate) => /not half-body/i.test(gate)));

  const dharma = manifest.effects['dharma-manifest'];
  assert.equal(dharma.runtime.effectType, 'dharma');
  assert.equal(dharma.runtime.effectId, 'dharma-manifest');
  assert.equal(dharma.videoReference.targetFrames, 32);
  assert.equal(dharma.videoReference.fps, 12);
  assert.ok(dharma.layers.some((layer) => layer.role === 'background-effect'));
  assert.ok(dharma.layers.some((layer) => layer.role === 'foreground-effect'));
});

test('prepares video-reference run folders for clone and dharma without touching digSand', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-effect-video-'));

  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-effect-video-run.js'),
      '--output-dir',
      runRoot,
      '--force',
    ],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  for (const effectId of ['clone-heart', 'dharma-manifest']) {
    const runDir = join(runRoot, effectId);
    assert.ok(existsSync(join(runDir, 'effect-request.json')), `${effectId} request should exist`);
    assert.ok(existsSync(join(runDir, 'prompts/video-reference.md')), `${effectId} prompt should exist`);
    assert.ok(existsSync(join(runDir, 'qa/review-checklist.md')), `${effectId} checklist should exist`);

    const request = JSON.parse(readFileSync(join(runDir, 'effect-request.json'), 'utf8'));
    assert.equal(request.effectId, effectId);
    assert.equal(request.status, 'prepared');
    assert.ok(request.runtimeTimeline.endsWith(`assets/yoyo/effects/${effectId}/timeline.json`));
    assert.ok(request.sourceTimeline.endsWith(`assets-src/yoyo/effects/${effectId}/timeline.json`));

    const prompt = readFileSync(join(runDir, 'prompts/video-reference.md'), 'utf8');
    assert.match(prompt, /Yoyo is a human little girl/i);
    assert.match(prompt, /Do not crop her body/i);
    assert.match(prompt, /digSand/i, 'prompt should explicitly exclude the other agent scope');
  }

  assert.equal(existsSync(join(runRoot, 'digSand')), false);
});

test('dharma runtime uses the authored dharma spirit row, not later extension rows', () => {
  const source = readFileSync(pixiStagePath, 'utf8');

  assert.match(source, /const DHARMA_SPIRIT_ROW = 34;/);
  assert.match(source, /const GUARDIAN_ROW = DHARMA_SPIRIT_ROW;/);
  assert.doesNotMatch(source, /const NASCENT_ROW = 39/);
  assert.match(source, /背后大型法相/);
});

test('clone runtime uses timeline clone count to keep the formation readable', () => {
  const source = readFileSync(pixiStagePath, 'utf8');

  assert.match(source, /const cloneCount = clamp\(Number\(timeline\.cloneCount\) \|\| 9, 5, 12\);/);
  assert.match(source, /for \(let i = 0; i < cloneCount; i\+\+\)/);
  assert.match(source, /默认 9 个全身 Yoyo/);
});

test('right-click menu exposes clone and dharma as manual special performances', () => {
  const traySource = readFileSync(trayMenuPath, 'utf8');
  const interactionSource = readFileSync(interactionPath, 'utf8');

  assert.match(traySource, /label: '特殊演出'/);
  assert.match(traySource, /menu-action', 'special:clone'/);
  assert.match(traySource, /menu-action', 'special:giant'/);
  assert.match(interactionSource, /action === 'special:clone'/);
  assert.match(interactionSource, /startPerformance\('cloneHeart', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerCloneEffect\(\)/);
  assert.match(interactionSource, /action === 'special:giant'/);
  assert.match(interactionSource, /startPerformance\('dharmaManifest', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerGiantEffect\(\)/);
});
