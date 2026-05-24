import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('prepares a hatch-style Yoyo asset run with spec, prompt, and QA checklist', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-asset-run-'));

  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-asset-run.js'),
      '--name',
      'sleep-pose',
      '--kind',
      'pose',
      '--brief',
      'Full-body side sleeping Yoyo pose for the home bed.',
      '--output-dir',
      runRoot,
      '--style-profile',
      'clean-2d',
      '--force',
    ],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  const runDir = join(runRoot, 'sleep-pose');
  const requestPath = join(runDir, 'asset-request.json');
  const promptPath = join(runDir, 'prompts/visual-prompt.md');
  const checklistPath = join(runDir, 'qa/review-checklist.md');
  const manifestPath = join(runDir, 'workflow-manifest.json');

  assert.ok(existsSync(requestPath), 'asset request should exist');
  assert.ok(existsSync(promptPath), 'visual prompt should exist');
  assert.ok(existsSync(checklistPath), 'review checklist should exist');
  assert.ok(existsSync(manifestPath), 'workflow manifest should exist');

  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  assert.equal(request.name, 'sleep-pose');
  assert.equal(request.kind, 'pose');
  assert.equal(request.workflow, 'yoyo-asset-hatch');
  assert.equal(request.styleProfile, 'clean-2d');
  assert.match(request.styleContract.join('\n'), /clean 2D/u);
  assert.doesNotMatch(request.styleContract.join('\n'), /pixel-adjacent/u);
  assert.deepEqual(request.motion, {
    frames: 1,
    fps: 1,
    cellWidth: 384,
    cellHeight: 384,
    loop: false,
  });
  assert.deepEqual(request.acceptance, [
    'full body visible unless an explicit foreground object justifies occlusion',
    'grounded contact with the target prop or floor',
    'same Yoyo identity, palette, hair, and face language',
    'transparent or clean chroma-key background for extraction',
    'passes browser screenshot review at home UI size',
  ]);

  const prompt = readFileSync(promptPath, 'utf8');
  assert.match(prompt, /Full-body side sleeping Yoyo pose/u);
  assert.match(prompt, /Do not crop the body/u);
  assert.match(prompt, /flat chroma-key background/u);

  const checklist = readFileSync(checklistPath, 'utf8');
  assert.match(checklist, /Visual Gate/u);
  assert.match(checklist, /Runtime Gate/u);
});

test('prepares a full redesign batch with ordered asset jobs', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-redesign-run-'));

  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-asset-run.js'),
      '--batch',
      'full-redesign',
      '--name',
      'yoyo-redesign-v1',
      '--brief',
      'Rebuild Yoyo character, home, care objects, poses, and action rows as one coherent asset system.',
      '--output-dir',
      runRoot,
      '--style-profile',
      'clean-2d',
      '--force',
    ],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  const runDir = join(runRoot, 'yoyo-redesign-v1');
  const batchPath = join(runDir, 'batch-manifest.json');
  const boardPath = join(runDir, 'production-board.md');
  const stylePromptPath = join(runDir, 'assets/00-style-system/prompts/visual-prompt.md');
  const sleepRequestPath = join(runDir, 'assets/04-home-sleep-pose/asset-request.json');

  assert.ok(existsSync(batchPath), 'batch manifest should exist');
  assert.ok(existsSync(boardPath), 'production board should exist');
  assert.ok(existsSync(stylePromptPath), 'style system prompt should exist');
  assert.ok(existsSync(sleepRequestPath), 'sleep pose job should exist');

  const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
  assert.equal(batch.workflow, 'yoyo-asset-redesign-batch');
  assert.equal(batch.name, 'yoyo-redesign-v1');
  assert.equal(batch.styleProfile, 'clean-2d');
  assert.deepEqual(
    batch.phases.map((phase) => phase.id),
    ['style-lock', 'character-lock', 'home-kit', 'pose-kit', 'action-kit', 'runtime-qa'],
  );
  assert.ok(batch.assets.length >= 10, 'batch should include the main redesign asset queue');

  const board = readFileSync(boardPath, 'utf8');
  assert.match(board, /Style Lock/u);
  assert.match(board, /Runtime QA/u);

  const stylePrompt = readFileSync(stylePromptPath, 'utf8');
  assert.match(stylePrompt, /style board/u);
  assert.match(stylePrompt, /clean 2D/u);
  assert.doesNotMatch(stylePrompt, /Pixel-adjacent/u);
  assert.doesNotMatch(stylePrompt, /chroma-key background/u);

  const sleepRequest = JSON.parse(readFileSync(sleepRequestPath, 'utf8'));
  assert.equal(sleepRequest.name, '04-home-sleep-pose');
  assert.equal(sleepRequest.kind, 'pose');
  assert.equal(sleepRequest.phase, 'pose-kit');

  const coreRowsRequest = JSON.parse(
    readFileSync(join(runDir, 'assets/09-core-action-rows/asset-request.json'), 'utf8'),
  );
  assert.equal(coreRowsRequest.motion.frames, 24);
  assert.equal(coreRowsRequest.motion.fps, 12);
  assert.equal(coreRowsRequest.motion.cellWidth, 384);
  assert.equal(coreRowsRequest.motion.cellHeight, 416);
  assert.match(readFileSync(join(runDir, 'assets/09-core-action-rows/prompts/visual-prompt.md'), 'utf8'), /24 frames/u);

  const specialRowsRequest = JSON.parse(
    readFileSync(join(runDir, 'assets/10-special-action-rows/asset-request.json'), 'utf8'),
  );
  assert.equal(specialRowsRequest.motion.frames, 32);
  assert.equal(specialRowsRequest.motion.fps, 12);
  assert.match(readFileSync(join(runDir, 'production-board.md'), 'utf8'), /high-frame action previews/u);
});
