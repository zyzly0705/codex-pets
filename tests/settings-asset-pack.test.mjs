import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('settings page exposes asset pack QA summary placeholders', () => {
  const html = readFileSync(join(repoRoot, 'src/settings.html'), 'utf8');

  assert.match(html, /id="assetPackCard"/u);
  assert.match(html, /id="assetPackName"/u);
  assert.match(html, /id="assetPackGolden"/u);
  assert.match(html, /id="assetPackStatus"/u);
  assert.match(html, /id="assetPackReport"/u);
  assert.match(html, /id="assetPackRedrawQueue"/u);
  assert.match(html, /id="assetPackCandidates"/u);
});

test('settings page loads pets list and renders asset pack status counts', () => {
  const html = readFileSync(join(repoRoot, 'src/settings.html'), 'utf8');

  assert.match(html, /ipcRenderer\.invoke\('pets:list'\)/u);
  assert.match(html, /renderAssetPackSummary/u);
  assert.match(html, /assetPack\.inventorySummary/u);
  assert.match(html, /assetPack\.redrawQueueSummary/u);
  assert.match(html, /assetPack\.candidateRegistrySummary/u);
  assert.match(html, /redraw/u);
  assert.match(html, /experimental/u);
  assert.match(html, /待生产/u);
  assert.match(html, /候选来源/u);
});

test('main process supports opening settings directly for QA', () => {
  const main = readFileSync(join(repoRoot, 'src/main.js'), 'utf8');

  assert.match(main, /--open-settings/u);
  assert.match(main, /openSettings\(\)/u);
});
