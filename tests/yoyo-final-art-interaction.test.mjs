import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const { CARE_ACTIONS, listCareActions } = require('../src/shared/yoyo-actions.js');

test('maps every care action to a final-art runtime effect', () => {
  const actionEntries = Object.entries(CARE_ACTIONS);
  assert.equal(actionEntries.length, 9);

  for (const [id, action] of actionEntries) {
    assert.ok(action.finalEffectId, `${id} should declare finalEffectId`);
    assert.equal(action.finalEffectId.endsWith('-final'), true);
    assert.ok(
      existsSync(join(repoRoot, 'assets/yoyo/effects', action.finalEffectId, 'timeline.json')),
      `${id} timeline should exist`,
    );
    assert.ok(
      existsSync(join(repoRoot, 'assets/yoyo/effects', action.finalEffectId, 'rig/yoyo.rig.json')),
      `${id} rig should exist`,
    );
  }

  assert.deepEqual(
    Object.fromEntries(actionEntries.map(([id, action]) => [id, action.finalEffectId])),
    {
      feed: 'eat-final',
      bath: 'bath-final',
      sleep: 'sleep-final',
      play: 'play-final',
      pet: 'pet-final',
      watchAnime: 'watch-anime-final',
      playSwitch: 'play-switch-final',
      buildBlocks: 'build-blocks-final',
      study: 'study-final',
    },
  );
  assert.equal(listCareActions().every((action) => action.finalEffectId), true);
});

test('resolves final-art rig parts inside copied app pet packages', () => {
  const { resolveAutoRigPartPath } = require('../src/main/effects.js');
  const packageRoot = join(tmpdir(), `yoyo-final-art-package-${Date.now()}`);
  const effectDir = join(packageRoot, 'pets/yoyo/effects/bath-final');
  const partPath = join(effectDir, 'rig/parts/scene-full.png');
  mkdirSync(dirname(partPath), { recursive: true });

  const resolved = resolveAutoRigPartPath({
    spritePath: join(packageRoot, 'pets/yoyo/spritesheet.webp'),
    effectId: 'bath-final',
    effectDir,
    partFile: 'assets/yoyo/effects/bath-final/rig/parts/scene-full.png',
  });

  assert.equal(resolved, partPath);
});

test('main care flow triggers final-art effect after successful care', () => {
  const lifeSource = readFileSync(join(repoRoot, 'src/main/life.js'), 'utf8');
  const homeBridgeSource = readFileSync(join(repoRoot, 'src/yoyo-home/bridge/electron-life-bridge.mjs'), 'utf8');
  const mainSource = readFileSync(join(repoRoot, 'src/main.js'), 'utf8');
  const effectsSource = readFileSync(join(repoRoot, 'src/main/effects.js'), 'utf8');
  const traySource = readFileSync(join(repoRoot, 'src/main/tray-menu.js'), 'utf8');

  assert.match(lifeSource, /normalizeCareRequest/);
  assert.match(lifeSource, /YOYO_TEST_DESKTOP_RUN/);
  assert.match(lifeSource, /buildDesktopAction/);
  assert.match(lifeSource, /desktopAction: buildDesktopAction\(actionId/);
  assert.match(lifeSource, /!suppressFinalEffect && !snapshot\.blocked/);
  assert.match(lifeSource, /triggerCareEffect\(action\.finalEffectId, actionId\)/);
  assert.match(homeBridgeSource, /source: 'home'/);
  assert.match(homeBridgeSource, /homeTask: aftermath/);
  assert.match(lifeSource, /source === 'home'/);
  assert.match(lifeSource, /propId: source === 'desktop-menu' \? null : undefined/);
  assert.match(lifeSource, /source: source === 'desktop-menu' \? 'desktop-menu' : 'care-result'/);
  assert.match(mainSource, /triggerCareEffect: \(effectId, actionId\) => triggerFinalArtEffect/);
  assert.match(mainSource, /YOYO_TEST_FINAL_ART/);
  assert.match(mainSource, /YOYO_TEST_OPEN_HOME/);
  assert.match(readFileSync(join(repoRoot, 'src/renderer.js'), 'utf8'), /playDesktopAction\(data\.action/);
  assert.match(effectsSource, /function resolveAutoRigTimelineAssets/);
  assert.match(effectsSource, /effectType: 'auto-rig-action'/);
  assert.match(traySource, /Object\.entries\(CARE_ACTIONS\)/);
});

test('desktop care flow uses unified desktop action dispatcher', () => {
  const interactionSource = readFileSync(join(repoRoot, 'src/modules/interaction.js'), 'utf8');
  const toysSource = readFileSync(join(repoRoot, 'src/modules/desktop-toys.js'), 'utf8');

  assert.match(interactionSource, /import \{ playDesktopAction, playDesktopClickToyReaction \}/);
  assert.match(interactionSource, /source: 'desktop-menu'/);
  assert.doesNotMatch(interactionSource, /source: 'desktop-menu',\s*suppressFinalEffect: true/s);
  assert.match(readFileSync(join(repoRoot, 'src/renderer.js'), 'utf8'), /import \{ playDesktopAction \}/);
  assert.match(toysSource, /buildDesktopAction/);
  assert.match(toysSource, /export function playDesktopAction/);
});
