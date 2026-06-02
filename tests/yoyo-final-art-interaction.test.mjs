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
  const partPath = join(effectDir, 'rig/parts/bath-front.png');
  mkdirSync(dirname(partPath), { recursive: true });

  const resolved = resolveAutoRigPartPath({
    spritePath: join(packageRoot, 'pets/yoyo/spritesheet.webp'),
    effectId: 'bath-final',
    effectDir,
    partFile: 'assets/yoyo/effects/bath-final/rig/parts/bath-front.png',
  });

  assert.equal(resolved, partPath);
});

test('bath final-art uses an animated layered rig instead of a static scene image', () => {
  const timeline = JSON.parse(readFileSync(join(repoRoot, 'assets/yoyo/effects/bath-final/timeline.json'), 'utf8'));
  const rig = JSON.parse(readFileSync(join(repoRoot, 'assets/yoyo/effects/bath-final/rig/yoyo.rig.json'), 'utf8'));
  const partIds = rig.parts.map((part) => part.id);

  assert.equal(timeline.id, 'bath-final');
  assert.equal(timeline.motion, 'bath-final');
  assert.equal(timeline.scene.mode, 'bath');
  assert.equal(timeline.qa.requireOcclusionPass, true);
  assert.deepEqual(partIds, ['bath.back', 'yoyo.body', 'bath.water', 'bath.bubbles', 'bath.frontMask']);
  assert.equal(partIds.includes('scene.full'), false);
  assert.equal(rig.masks[0].id, 'bath-front-occlusion');
  assert.ok(rig.motions['bath-final'].keyframes.some((frame) => frame.bobY !== 0));
  assert.ok(rig.motions['bath-final'].keyframes.some((frame) => frame.foamY !== 0));
});

test('auto-rig final effects are sized around the desktop pet instead of the screen', () => {
  const stageSource = readFileSync(join(repoRoot, 'src/pixi-effect-stage.js'), 'utf8');
  const autoRigSource = stageSource.slice(
    stageSource.indexOf('async function makeAutoRigActionStage'),
    stageSource.indexOf('function makeMissingSpineAssetStage'),
  );

  assert.match(autoRigSource, /const rigScaleBase = Math\.max\(\(options\.petSize && options\.petSize\.w\) \|\| FRAME_W/);
  assert.match(autoRigSource, /const stageScale = clamp\(rigScaleBase \/ stage\.width/);
  assert.match(autoRigSource, /const effectCenter = options\.sourceCenter \|\| options\.arenaCenter/);
  assert.match(autoRigSource, /const dimAlpha = Number\(timeline\.scene\?\.dimAlpha\) \|\| 0/);
  assert.match(autoRigSource, /dim\.alpha = dimAlpha \* fadeOut/);
  assert.doesNotMatch(autoRigSource, /Math\.min\(W \/ stage\.width, H \/ stage\.height\) \* 0\.84/);
  assert.doesNotMatch(autoRigSource, /dim\.alpha = 0\.06 \* fadeOut/);
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

test('right-click menu follows the care-first Yoyo 2.0 structure', () => {
  const traySource = readFileSync(join(repoRoot, 'src/main/tray-menu.js'), 'utf8');

  assert.match(traySource, /label: '看看 Yoyo'/);
  assert.match(traySource, /label: '打开小屋'/);
  assert.match(traySource, /label: '喂点东西'/);
  assert.match(traySource, /label: '摸摸'/);
  assert.match(traySource, /label: '照顾一下'/);
  assert.match(traySource, /label: '工作陪伴'/);
  assert.match(traySource, /work-mode:focus/);
  assert.match(traySource, /work-mode:balanced/);
  assert.match(traySource, /work-mode:wrapup/);
  assert.match(traySource, /label: '成长奖励'/);
  assert.doesNotMatch(traySource, /label: '小惊喜'/);
  assert.doesNotMatch(traySource, /label: '泛资讯'/);
});
