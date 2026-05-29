import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('generates deterministic Yoyo auto-rig v0 assets and occlusion QA', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-auto-rig-v0-'));

  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/generate-yoyo-auto-rig-v0.js'),
      '--output-dir',
      runRoot,
      '--no-write-assets',
    ],
    { cwd: repoRoot, stdio: 'pipe' },
  );

  const rigPath = join(runRoot, 'yoyo.rig.json');
  const timelinePath = join(runRoot, 'timeline.json');
  const reportPath = join(runRoot, 'qa/report.json');
  const contactSheetPath = join(runRoot, 'qa/bath-contact-sheet.png');

  assert.ok(existsSync(rigPath), 'rig json should exist');
  assert.ok(existsSync(timelinePath), 'timeline json should exist');
  assert.ok(existsSync(reportPath), 'QA report should exist');
  assert.ok(existsSync(contactSheetPath), 'contact sheet should exist');

  const rig = JSON.parse(readFileSync(rigPath, 'utf8'));
  assert.equal(rig.format, 'codex-pet-auto-rig');
  assert.equal(rig.stage.width, 512);
  assert.equal(rig.stage.height, 384);
  assert.deepEqual(
    rig.parts.map((part) => part.id),
    ['bath.back', 'yoyo.body', 'bath.water', 'bath.bubbles', 'bath.frontMask'],
  );
  assert.equal(rig.masks[0].id, 'bath-front-occlusion');
  assert.equal(rig.motions.bath.keyframes.length, 6);

  const timeline = JSON.parse(readFileSync(timelinePath, 'utf8'));
  assert.equal(timeline.engine, 'codex-pet-auto-rig');
  assert.equal(timeline.effectType, 'auto-rig-action');
  assert.equal(timeline.motion, 'bath');

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.pass, true);
  assert.equal(report.checks.sourceFilesPresent, true);
  assert.ok(report.checks.occlusion.uncoveredRatio <= 0.08);
});
