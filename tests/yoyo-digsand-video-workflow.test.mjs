import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const manifestPath = join(repoRoot, 'assets-src/yoyo/actions/digSand-video-workflow-manifest.json');
const atlasManifestPath = join(repoRoot, 'assets-src/yoyo/manifest.json');

test('digSand video workflow is scoped to grounded human Yoyo burrow action', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.workflow, 'yoyo-digsand-video-reference');
  assert.equal(manifest.actionId, 'digSand');
  assert.equal(manifest.runtime.row, 17);
  assert.equal(manifest.videoReference.targetFrames, 24);
  assert.equal(manifest.videoReference.fps, 12);
  assert.equal(manifest.videoReference.runtimeKeyframes, 8);

  assert.match(manifest.characterContract.join('\n'), /human little girl/i);
  assert.match(manifest.characterContract.join('\n'), /ground/i);
  assert.match(manifest.characterContract.join('\n'), /foreground ground lip/i);
  assert.match(manifest.characterContract.join('\n'), /never a dog/i);

  assert.ok(manifest.layers.some((layer) => layer.role === 'foreground-occluder'));
  assert.ok(manifest.layers.some((layer) => layer.role === 'character'));
  assert.ok(manifest.acceptanceGates.some((gate) => /full-body/i.test(gate)));
  assert.ok(manifest.acceptanceGates.some((gate) => /not by cropping/i.test(gate)));
  assert.ok(manifest.nonGoals.some((item) => /clone-heart/i.test(item)));
  assert.ok(manifest.nonGoals.some((item) => /dharma-manifest/i.test(item)));
});

test('digSand atlas row matches runtime 8-frame contract', () => {
  const atlas = JSON.parse(readFileSync(atlasManifestPath, 'utf8'));
  const row = atlas.rows.find((item) => item.name === 'digSand');

  assert.ok(row, 'digSand row should exist');
  assert.equal(row.row, 17);
  assert.equal(row.frames, 8);
  assert.equal(row.type, 'prop-action');

  for (let index = 0; index < 8; index += 1) {
    const file = join(repoRoot, 'assets-src/yoyo/frames/digSand', `${String(index).padStart(2, '0')}.png`);
    assert.ok(existsSync(file), `${file} should exist`);
  }
});

test('prepares digSand video-reference run folder without clone or dharma outputs', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-digsand-video-'));

  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-digsand-video-run.js'),
      '--output-dir',
      runRoot,
      '--force',
    ],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  const runDir = join(runRoot, 'digSand');
  assert.ok(existsSync(join(runDir, 'action-request.json')));
  assert.ok(existsSync(join(runDir, 'prompts/video-reference.md')));
  assert.ok(existsSync(join(runDir, 'qa/review-checklist.md')));
  assert.ok(existsSync(join(runDir, 'frames/reference-24/.gitkeep')));

  const request = JSON.parse(readFileSync(join(runDir, 'action-request.json'), 'utf8'));
  assert.equal(request.actionId, 'digSand');
  assert.equal(request.status, 'prepared');
  assert.equal(request.videoReference.runtimeKeyframes, 8);

  const prompt = readFileSync(join(runDir, 'prompts/video-reference.md'), 'utf8');
  assert.match(prompt, /Yoyo is a human little girl/i);
  assert.match(prompt, /foreground ground lip/i);
  assert.match(prompt, /Do not crop her body/i);
  assert.match(prompt, /clone-heart/i);
  assert.match(prompt, /dharma-manifest/i);

  assert.equal(existsSync(join(runRoot, 'clone-heart')), false);
  assert.equal(existsSync(join(runRoot, 'dharma-manifest')), false);
});
