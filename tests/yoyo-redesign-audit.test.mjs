import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('audits a prepared redesign batch and reports pending asset gates', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-redesign-audit-'));
  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-asset-run.js'),
      '--batch',
      'full-redesign',
      '--name',
      'audit-redesign',
      '--brief',
      'Auditable full redesign batch.',
      '--output-dir',
      runRoot,
      '--force',
    ],
    { cwd: repoRoot },
  );

  const runDir = join(runRoot, 'audit-redesign');
  const output = execFileSync(
    process.execPath,
    [join(repoRoot, 'scripts/audit-yoyo-redesign.js'), runDir, '--allow-pending'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  assert.match(output, /Yoyo redesign audit/u);
  assert.match(output, /prepared: 12/u);
  assert.match(output, /pending: 12/u);
});

test('strict redesign audit fails when accepted asset evidence is missing', () => {
  const runRoot = mkdtempSync(join(tmpdir(), 'yoyo-redesign-strict-'));
  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'scripts/prepare-yoyo-asset-run.js'),
      '--batch',
      'full-redesign',
      '--name',
      'strict-redesign',
      '--brief',
      'Strict full redesign batch.',
      '--output-dir',
      runRoot,
      '--force',
    ],
    { cwd: repoRoot },
  );

  const runDir = join(runRoot, 'strict-redesign');
  const styleManifestPath = join(runDir, 'assets/00-style-system/workflow-manifest.json');
  const styleManifest = JSON.parse(readFileSync(styleManifestPath, 'utf8'));
  styleManifest.status = 'accepted';
  writeFileSync(styleManifestPath, `${JSON.stringify(styleManifest, null, 2)}\n`);

  assert.throws(
    () => execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts/audit-yoyo-redesign.js'), runDir],
      { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' },
    ),
    /accepted asset 00-style-system is missing source evidence/u,
  );
});
