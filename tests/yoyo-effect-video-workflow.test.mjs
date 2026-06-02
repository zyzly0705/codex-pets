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
const performancePath = join(repoRoot, 'src/modules/performance-script.js');
const preloadPath = join(repoRoot, 'src/preload.js');
const effectsPath = join(repoRoot, 'src/main/effects.js');
const cookTimelinePath = join(repoRoot, 'assets/yoyo/effects/cook-pot/timeline.json');
const watchTvTimelinePath = join(repoRoot, 'assets/yoyo/effects/watch-tv/timeline.json');
const playSwitchTimelinePath = join(repoRoot, 'assets/yoyo/effects/play-switch/timeline.json');
const packagePath = join(repoRoot, 'package.json');

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

test('right-click menu treats clone and dharma as growth rewards', () => {
  const traySource = readFileSync(trayMenuPath, 'utf8');
  const interactionSource = readFileSync(interactionPath, 'utf8');
  const performanceSource = readFileSync(performancePath, 'utf8');

  assert.match(traySource, /label: '成长奖励'/);
  assert.doesNotMatch(traySource, /label: '特殊演出'/);
  assert.match(traySource, /requiredLevel: 4/);
  assert.match(traySource, /requiredLevel: 5/);
  assert.match(traySource, /requiredIntimacy: 80/);
  assert.match(traySource, /menu-action', 'special:clone'/);
  assert.match(traySource, /menu-action', 'special:giant'/);
  assert.match(interactionSource, /action === 'special:clone'/);
  assert.match(interactionSource, /runGrowthReward\('special:clone'/);
  assert.match(interactionSource, /startPerformance\('cloneHeart', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerCloneEffect\(\)/);
  assert.match(interactionSource, /action === 'special:giant'/);
  assert.match(interactionSource, /runGrowthReward\('special:giant'/);
  assert.match(interactionSource, /startPerformance\('dharmaManifest', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerGiantEffect\(\)/);
  assert.match(interactionSource, /getLife\(\)/);
  assert.match(interactionSource, /还没解锁/);
  assert.match(performanceSource, /cloneHeart:[\s\S]*requiredLevel: 4/);
  assert.match(performanceSource, /dharmaManifest:[\s\S]*requiredLevel: 5/);
  assert.match(performanceSource, /dharmaManifest:[\s\S]*requiredIntimacy: 80/);
  assert.match(performanceSource, /performance_reward_locked/);
});

test('cook pot uses Pixi sequence performance instead of static pose', () => {
  const traySource = readFileSync(trayMenuPath, 'utf8');
  const interactionSource = readFileSync(interactionPath, 'utf8');
  const preloadSource = readFileSync(preloadPath, 'utf8');
  const effectsSource = readFileSync(effectsPath, 'utf8');
  const pixiSource = readFileSync(pixiStagePath, 'utf8');
  const timeline = JSON.parse(readFileSync(cookTimelinePath, 'utf8'));

  assert.equal(timeline.id, 'cook-pot');
  assert.equal(timeline.engine, 'pixi-stage');
  assert.equal(timeline.effectType, 'cook-pot');
  assert.ok(timeline.sequenceFrameCount >= 16, 'cook pot should budget enough frames for real motion');
  assert.ok(timeline.layers.includes('pot-back'));
  assert.ok(timeline.layers.includes('character-sprite-sequence'));
  assert.ok(timeline.layers.includes('pot-front-mask'));
  assert.ok(timeline.layers.includes('steam-particles'));

  assert.match(traySource, /menu-action', 'special:cook'/);
  assert.match(interactionSource, /action === 'special:cook'/);
  assert.match(interactionSource, /startPerformance\('cookPotScene', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerCookEffect\(\)/);
  assert.match(preloadSource, /triggerCookEffect: \(\) => ipcRenderer\.invoke\('effect:cook'\)/);
  assert.match(effectsSource, /function triggerCookEffect\(deps\)/);
  assert.match(effectsSource, /effectType: 'cook-pot'/);
  assert.match(pixiSource, /function makeCookPotStage\(image, options\)/);
  assert.match(pixiSource, /state\.effectType === 'cook-pot'/);
});

test('watch tv uses Spine action runtime instead of hand-positioned Pixi props', () => {
  const traySource = readFileSync(trayMenuPath, 'utf8');
  const interactionSource = readFileSync(interactionPath, 'utf8');
  const preloadSource = readFileSync(preloadPath, 'utf8');
  const effectsSource = readFileSync(effectsPath, 'utf8');
  const pixiSource = readFileSync(pixiStagePath, 'utf8');
  const timeline = JSON.parse(readFileSync(watchTvTimelinePath, 'utf8'));
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

  assert.equal(timeline.id, 'watch-tv');
  assert.equal(timeline.engine, 'spine-pixi-v8');
  assert.equal(timeline.effectType, 'spine-action');
  assert.equal(timeline.runtimeMode, 'spine-action');
  assert.equal(timeline.spine.animation, 'watch_tv');
  assert.equal(timeline.spine.idleAnimation, 'idle_sit');
  assert.equal(timeline.spine.skin, 'default');
  assert.ok(timeline.spine.skeleton.endsWith('yoyo.skel.json'));
  assert.ok(timeline.spine.atlas.endsWith('yoyo.atlas'));
  assert.ok(pkg.dependencies['@esotericsoftware/spine-pixi-v8']);
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/watch-tv/spine/yoyo.skel.json')));
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/watch-tv/spine/yoyo.atlas')));
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/watch-tv/spine/yoyo.png')));

  assert.match(traySource, /menu-action', 'special:watch-tv'/);
  assert.match(interactionSource, /action === 'special:watch-tv'/);
  assert.match(interactionSource, /startPerformance\('watchTvScene', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerWatchTvEffect\(\)/);
  assert.match(preloadSource, /triggerWatchTvEffect: \(\) => ipcRenderer\.invoke\('effect:watch-tv'\)/);
  assert.match(effectsSource, /function triggerWatchTvEffect\(deps\)/);
  assert.match(effectsSource, /effectType: 'spine-action'/);
  assert.match(effectsSource, /resolveSpineTimelineAssets\(spritePath, effectId, timeline\)/);
  assert.match(pixiSource, /async function makeSpineActionStage\(options\)/);
  assert.match(pixiSource, /window\.spine\.Spine\.from/);
  assert.match(pixiSource, /tvScreen\.clear\(\)/);
  assert.match(pixiSource, /state\.effectType === 'spine-action'/);
  assert.doesNotMatch(pixiSource, /function makeWatchTvStage\(image, options\)/);
});

test('watch tv Spine action is strict and does not fall back to atlas proxy', () => {
  const timeline = JSON.parse(readFileSync(watchTvTimelinePath, 'utf8'));
  const pixiSource = readFileSync(pixiStagePath, 'utf8');

  assert.equal(timeline.strictAssets, true);
  assert.equal(timeline.fallback, undefined);
  assert.doesNotMatch(pixiSource, /makeSpineFallbackStage/);
  assert.doesNotMatch(pixiSource, /atlas-proxy/);
  assert.match(pixiSource, /makeMissingSpineAssetStage\(options\)/);
  assert.match(pixiSource, /spine_missing_required_assets/);
});

test('play switch reuses Spine action runtime with a dynamic game screen', () => {
  const traySource = readFileSync(trayMenuPath, 'utf8');
  const interactionSource = readFileSync(interactionPath, 'utf8');
  const preloadSource = readFileSync(preloadPath, 'utf8');
  const effectsSource = readFileSync(effectsPath, 'utf8');
  const pixiSource = readFileSync(pixiStagePath, 'utf8');
  const timeline = JSON.parse(readFileSync(playSwitchTimelinePath, 'utf8'));

  assert.equal(timeline.id, 'play-switch');
  assert.equal(timeline.effectType, 'spine-action');
  assert.equal(timeline.runtimeMode, 'spine-action');
  assert.equal(timeline.strictAssets, true);
  assert.equal(timeline.spine.animation, 'play_switch');
  assert.equal(timeline.scene.mode, 'game');
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/play-switch/spine/yoyo.skel.json')));
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/play-switch/spine/yoyo.atlas')));
  assert.ok(existsSync(join(repoRoot, 'assets/yoyo/effects/play-switch/spine/yoyo.png')));

  assert.match(traySource, /menu-action', 'special:play-switch'/);
  assert.match(interactionSource, /action === 'special:play-switch'/);
  assert.match(interactionSource, /startPerformance\('playSwitchScene', \{ manual: true, force: true \}\)/);
  assert.match(interactionSource, /window\.petApi\.triggerPlaySwitchEffect\(\)/);
  assert.match(preloadSource, /triggerPlaySwitchEffect: \(\) => ipcRenderer\.invoke\('effect:play-switch'\)/);
  assert.match(effectsSource, /function triggerPlaySwitchEffect\(deps\)/);
  assert.match(effectsSource, /effectId: 'play-switch'/);
  assert.match(pixiSource, /sceneMode === 'game'/);
});
