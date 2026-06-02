import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  HOME_ACTION_PRESENTATION,
  HOME_TASK_LIFECYCLE,
  YOYO_HOME_MANIFEST,
  validateHomeManifest,
} from '../src/yoyo-home/data/home-manifest.mjs';
import {
  loadInitialLifeBridgeOptions,
  mapHomeActionToLifeAction,
  mapLifeSnapshotToHomeNeeds,
} from '../src/yoyo-home/bridge/electron-life-bridge.mjs';
import { YoyoActor } from '../src/yoyo-home/render/yoyo-actor.mjs';
import {
  advanceCurrentTask,
  createHomeState,
  reduceHomeEvent,
  selectNeedDrivenBehavior,
} from '../src/yoyo-home/sim/home-sim.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function assetExists(assetPath) {
  return existsSync(join(repoRoot, assetPath.replace(/^\.\.\//u, '')));
}

const contentTypes = new Map([
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.css', 'text/css'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
]);

async function withStaticServer(callback) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/u, '') || 'src/yoyo-home-preview.html';
    const full = join(repoRoot, requested);
    if (!full.startsWith(repoRoot) || !existsSync(full) || statSync(full).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = full.slice(full.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': contentTypes.get(ext) || 'application/octet-stream' });
    createReadStream(full).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

describe('Yoyo Home rebuild skeleton', () => {
  test('declares a Phaser-owned home runtime with simulation-owned state', () => {
    assert.equal(YOYO_HOME_MANIFEST.runtime.engine, 'phaser');
    assert.equal(YOYO_HOME_MANIFEST.runtime.stateOwner, 'simulation');
    assert.equal(YOYO_HOME_MANIFEST.runtime.renderOwner, 'phaser');
    assert.equal(YOYO_HOME_MANIFEST.runtime.hudOwner, 'dom');

    const validation = validateHomeManifest(YOYO_HOME_MANIFEST);
    assert.deepEqual(validation, { ok: true, errors: [] });
  });

  test('uses only active v3-safe room backgrounds and no deleted v1 room line', () => {
    assert.deepEqual(YOYO_HOME_MANIFEST.room.size, { width: 1272, height: 720 });
    for (const asset of Object.values(YOYO_HOME_MANIFEST.room.backgrounds)) {
      assert.match(asset, /room-v3-.+-safe\.webp/u);
      assert.ok(assetExists(asset), `${asset} should exist`);
    }

    const serialized = JSON.stringify(YOYO_HOME_MANIFEST);
    for (const forbidden of YOYO_HOME_MANIFEST.forbiddenSources) {
      const activeManifest = JSON.stringify({ ...YOYO_HOME_MANIFEST, forbiddenSources: [] });
      assert.equal(activeManifest.includes(forbidden), false, `${forbidden} should not be active`);
    }
    assert.equal(serialized.includes('dog bowl'), false);
  });

  test('models room objects as task-capable native-room zones', () => {
    const byAction = new Map();
    for (const object of YOYO_HOME_MANIFEST.objects) {
      assert.equal(object.nativeRoomPolicy.bakedFurniture, true);
      assert.equal(object.nativeRoomPolicy.renderPropSprite, false);
      assert.equal(object.nativeRoomPolicy.renderHitArea, true);
      assert.ok(Number.isFinite(object.hitArea.x));
      assert.ok(Number.isFinite(object.actorSpot.x));
      for (const action of object.capabilities) byAction.set(action, object);
    }

    for (const action of ['feed', 'sleep', 'bath', 'play', 'comfort', 'study', 'watchAnime', 'playSwitch', 'buildBlocks']) {
      assert.ok(byAction.has(action), `${action} should have a room object`);
    }
    assert.equal(byAction.get('feed').miniGame, 'catchFood');
    assert.equal(byAction.get('study').miniGame, 'guessMood');
    assert.equal(byAction.get('play').id, 'toyShelf');
    assert.equal(byAction.get('buildBlocks').id, 'blocks');
    assert.equal(byAction.get('playSwitch').id, 'gameConsole');
  });

  test('declares every action animation for the fallback actor contract', () => {
    const manifestAnimations = new Set(YOYO_HOME_MANIFEST.actor.requiredAnimations);
    const fallbackAnimations = new Set(YoyoActor.supportedFallbackAnimations);

    for (const [actionId, presentation] of Object.entries(HOME_ACTION_PRESENTATION)) {
      for (const animation of [
        presentation.startAnimation,
        presentation.loopAnimation,
        presentation.endAnimation,
        presentation.completeAnimation,
      ]) {
        assert.ok(manifestAnimations.has(animation), `${actionId} should require ${animation}`);
        assert.ok(fallbackAnimations.has(animation), `fallback actor should accept ${animation}`);
      }
    }
  });

  test('starts feed as a HomeTask instead of a detached overlay reward', () => {
    let state = createHomeState({ manifest: YOYO_HOME_MANIFEST, now: 1000 });
    state = reduceHomeEvent(state, { type: 'objectClick', objectId: 'mealTable', actionId: 'feed' });

    assert.equal(state.currentTask.actionId, 'feed');
    assert.equal(state.currentTask.objectId, 'mealTable');
    assert.equal(state.currentTask.lifecycle, 'approach');
    assert.equal(state.currentTask.miniGame, 'catchFood');
    assert.equal(state.currentTask.activeMode, 'miniGame');
    assert.equal(state.activeTask, null);
    assert.equal(state.activeMiniGame, null);

    for (const expectedPhase of HOME_TASK_LIFECYCLE.slice(1, 3)) {
      state = advanceCurrentTask(state);
      assert.equal(state.currentTask.lifecycle, expectedPhase);
    }
    assert.deepEqual(state.activeTask, {
      actionId: 'feed',
      objectId: 'mealTable',
      mode: 'miniGame',
      gameId: 'catchFood',
    });
    assert.deepEqual(state.activeMiniGame, { id: 'catchFood', actionId: 'feed', objectId: 'mealTable' });
  });

  test('runs non-mini-game furniture as a real HomeTask interaction', () => {
    let state = createHomeState({ manifest: YOYO_HOME_MANIFEST, now: 1000, needs: { energy: 30, mood: 40 } });
    state = reduceHomeEvent(state, { type: 'objectClick', objectId: 'bed', actionId: 'sleep' });

    assert.equal(state.currentTask.actionId, 'sleep');
    assert.equal(state.currentTask.objectId, 'bed');
    assert.equal(state.currentTask.lifecycle, 'approach');
    assert.equal(state.currentTask.miniGame, null);
    assert.equal(state.currentTask.activeMode, 'interaction');

    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'invite');
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'active');
    assert.deepEqual(state.activeTask, {
      actionId: 'sleep',
      objectId: 'bed',
      mode: 'interaction',
      gameId: null,
    });
    assert.equal(state.activeMiniGame, null);

    state = reduceHomeEvent(state, {
      type: 'taskResult',
      gameId: 'sleepActivity',
      score: 1,
      target: 1,
      mode: 'interaction',
      detail: { source: 'phaser-room-activity-stage', stageId: 'sleep', objectId: 'bed' },
    });
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'result');
    assert.equal(state.activeTask, null);
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'careDelta');
    assert.equal(state.needs.energy, 62);
    assert.equal(state.needs.mood, 44);
    state = advanceCurrentTask(state);
    assert.equal(state.aftermath.actionId, 'sleep');
    assert.equal(state.aftermath.result.detail.source, 'phaser-room-activity-stage');
    assert.equal(state.aftermath.result.detail.stageId, 'sleep');
  });

  test('applies mini-game result once through task lifecycle and leaves aftermath', () => {
    let state = createHomeState({ manifest: YOYO_HOME_MANIFEST, now: 1000, needs: { hunger: 20, mood: 50 } });
    state = reduceHomeEvent(state, { type: 'objectClick', objectId: 'mealTable', actionId: 'feed' });
    state = advanceCurrentTask(state);
    state = advanceCurrentTask(state);
    state = reduceHomeEvent(state, { type: 'taskResult', gameId: 'catchFood', score: 9, target: 18, mode: 'miniGame' });
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'result');
    assert.equal(state.activeTask, null);
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'careDelta');
    assert.equal(state.needs.hunger, 37.5);
    assert.equal(state.needs.mood, 54);
    assert.equal(state.relationship.xp, 3);
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask.lifecycle, 'aftermath');
    assert.equal(state.roomEntities.mealTable.state, 'aftermath');
    state = advanceCurrentTask(state);
    assert.equal(state.currentTask, null);
    assert.equal(state.activeMiniGame, null);
    assert.equal(state.aftermath.actionId, 'feed');
  });

  test('selects need-driven behavior without renderer involvement', () => {
    const state = createHomeState({ manifest: YOYO_HOME_MANIFEST, needs: { hunger: 18, energy: 80, fun: 70 } });
    const behavior = selectNeedDrivenBehavior(state, YOYO_HOME_MANIFEST);

    assert.equal(behavior.actionId, 'feed');
    assert.equal(behavior.objectId, 'mealTable');
    assert.match(behavior.reason, /hunger/u);
  });

  test('documents the full rebuild direction before implementation continues', () => {
    const md = readFileSync(join(repoRoot, 'docs/Yoyo-Home-Rebuild.md'), 'utf8');
    assert.match(md, /Yoyo Home should be rebuilt as a small life-simulation game/u);
    assert.match(md, /Input -> Intent -> HomeEvent -> Reducer -> Behavior Planner -> Action Runner -> Render/u);
    assert.match(md, /assets\/yoyo\/home-v4\//u);
    assert.match(md, /The runtime may reference only `accepted` assets and explicitly named `temporary` fallbacks/u);
  });

  test('provides a standalone Phaser preview page for the rebuild runtime', () => {
    const html = readFileSync(join(repoRoot, 'src/yoyo-home-preview.html'), 'utf8');
    const electronHtml = readFileSync(join(repoRoot, 'src/yoyo-home.html'), 'utf8');
    const index = readFileSync(join(repoRoot, 'src/yoyo-home/index.js'), 'utf8');
    const css = readFileSync(join(repoRoot, 'src/yoyo-home/styles.css'), 'utf8');

    assert.match(html, /id="yoyo-home-game"/u);
    assert.match(html, /node_modules\/phaser\/dist\/phaser\.min\.js/u);
    assert.match(html, /type="module" src="\.\/yoyo-home\/index\.js"/u);
    assert.match(electronHtml, /id="yoyo-home-game"/u);
    assert.match(electronHtml, /type="module" src="\.\/yoyo-home\/index\.js"/u);
    assert.match(index, /createYoyoHomeGame/u);
    assert.match(index, /phase-2-room-preview/u);
    assert.match(index, /phase-3-electron-bridge/u);
    assert.match(css, /\.yoyo-home-game/u);
    assert.match(css, /aspect-ratio:\s*1272 \/ 720/u);
  });

  test('uses the Phaser rebuild as the only Electron Home entry', () => {
    const appWindows = readFileSync(join(repoRoot, 'src/main/app-windows.js'), 'utf8');
    const entryCheck = readFileSync(join(repoRoot, 'scripts/check-yoyo-home-entry.js'), 'utf8');
    const quarantineCheck = readFileSync(join(repoRoot, 'scripts/check-yoyo-home-quarantine.js'), 'utf8');
    const captureHome = readFileSync(join(repoRoot, 'scripts/capture-home-scene.js'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    const buildFiles = pkg.build.files;

    assert.match(appWindows, /function getHomeEntryFile\(\)/u);
    assert.match(appWindows, /return 'yoyo-home\.html'/u);
    assert.doesNotMatch(appWindows, /YOYO_HOME_REBUILD/u);
    assert.doesNotMatch(appWindows, /YOYO_HOME_LEGACY/u);
    assert.doesNotMatch(appWindows, /['"]home\.html['"]/u);
    assert.match(appWindows, /homeWindow\.loadFile\(path\.join\(__dirname,\s*'\.\.',\s*entryFile\),\s*loadOptions\)/u);
    assert.match(entryCheck, /Yoyo Home entry OK/u);
    assert.match(entryCheck, /forbiddenActiveRefs/u);
    assert.match(quarantineCheck, /Yoyo Home quarantine OK/u);
    assert.match(captureHome, /yoyo-home\.html/u);
    assert.match(captureHome, /YOYO_HOME_REBUILD_RUNTIME\?\.startAction/u);
    assert.doesNotMatch(captureHome, /src['"],\s*'home\.html'/u);
    assert.doesNotMatch(captureHome, /care\(/u);
    assert.match(pkg.scripts.check, /scripts\/check-yoyo-home-entry\.js/u);
    assert.match(pkg.scripts.check, /scripts\/check-yoyo-home-runtime\.js/u);
    assert.match(pkg.scripts.check, /scripts\/check-yoyo-home-quarantine\.js/u);
    assert.doesNotMatch(pkg.scripts.check, /node --check src\/home\.js/u);
    for (const legacyFile of [
      'src/home.html',
      'src/home.css',
      'src/home.js',
      'src/home-games.js',
      'src/home-phaser-games.js',
      'src/home-spine-action.js',
      'src/home-spine-feed-assets.js',
      'src/shared/home-scene.js',
    ]) {
      assert.ok(buildFiles.includes(`!${legacyFile}`), `${legacyFile} should be excluded from packaged app files`);
    }
  });

  test('maps Electron life snapshots and care actions through a narrow bridge', async () => {
    const needs = mapLifeSnapshotToHomeNeeds({
      satiety: 22,
      energy: 44,
      cleanliness: 66,
      mood: 77,
      affection: 88,
    });
    assert.deepEqual(needs, {
      hunger: 22,
      energy: 44,
      hygiene: 66,
      fun: 77,
      focus: 55,
      affection: 88,
      mood: 77,
    });
    assert.equal(mapHomeActionToLifeAction('comfort'), 'pet');
    assert.equal(mapHomeActionToLifeAction('playSwitch'), 'playSwitch');

    const bridgeOptions = await loadInitialLifeBridgeOptions({
      life: {
        get: async () => ({
          satiety: 31,
          cleanliness: 52,
          energy: 63,
          mood: 74,
          profile: { intimacy: 9, xp: 12 },
        }),
      },
    });
    assert.equal(bridgeOptions.needs.hunger, 31);
    assert.equal(bridgeOptions.needs.hygiene, 52);
    assert.equal(bridgeOptions.intimacy, 9);
    assert.equal(bridgeOptions.xp, 12);
  });

  test('RoomScene adapts input into reducer events and renders feed as an in-room task', () => {
    const scene = readFileSync(join(repoRoot, 'src/yoyo-home/scenes/RoomScene.mjs'), 'utf8');
    const actor = readFileSync(join(repoRoot, 'src/yoyo-home/render/yoyo-actor.mjs'), 'utf8');
    const debug = readFileSync(join(repoRoot, 'src/yoyo-home/ui/debug-panel.mjs'), 'utf8');
    const feedGame = readFileSync(join(repoRoot, 'src/yoyo-home/minigames/feed-catch.mjs'), 'utf8');
    const tapGame = readFileSync(join(repoRoot, 'src/yoyo-home/minigames/room-tap-sequence.mjs'), 'utf8');
    const activityStage = readFileSync(join(repoRoot, 'src/yoyo-home/render/home-activity-stage.mjs'), 'utf8');

    assert.match(scene, /class RoomScene extends Phaser\.Scene/u);
    assert.match(scene, /new FeedCatchMiniGame\(this,\s*\{\s*object\s*\}\)\.start\(\)/u);
    assert.match(scene, /new RoomTapSequenceMiniGame\(this/u);
    assert.match(scene, /new HomeActivityStage\(this,\s*\{\s*task,\s*object\s*\}\)\.start\(\)/u);
    assert.match(scene, /runInteraction\(task,\s*object\)/u);
    assert.match(scene, /reduceHomeEvent\(this\.state,\s*\{\s*type: 'objectClick'/u);
    assert.match(scene, /advanceCurrentTask\(this\.state\)/u);
    assert.match(scene, /type: 'taskResult'/u);
    assert.doesNotMatch(scene, /type: 'miniGameResult'/u);
    assert.doesNotMatch(scene, /missing-mini-game/u);
    assert.match(scene, /startAction: \(actionId\)/u);
    assert.match(scene, /getHomeObjectForAction\(this\.manifest,\s*actionId\)/u);
    assert.match(scene, /this\.actor\.moveTo\(object\.actorSpot\)/u);
    assert.match(scene, /this\.add\.image\(0,\s*0,\s*'room\.day'\)/u);
    assert.doesNotMatch(scene, /careForYoyo/u);
    assert.doesNotMatch(scene, /startHomeGame/u);
    assert.match(actor, /class YoyoActor/u);
    assert.match(actor, /walk_left/u);
    assert.match(actor, /eat_loop/u);
    assert.match(debug, /Yoyo Home Debug/u);
    assert.match(debug, /data-debug="phase"/u);
    assert.match(debug, /data-debug="mode"/u);
    assert.match(feedGame, /class FeedCatchMiniGame/u);
    assert.match(feedGame, /setInteractive\(\{\s*cursor: 'pointer'\s*\}\)/u);
    assert.match(feedGame, /gameId: 'catchFood'/u);
    assert.match(feedGame, /source: 'phaser-room-mini-game'/u);
    for (const gameId of ['toyTrail', 'rhythmPat', 'guessMood']) {
      assert.match(tapGame, new RegExp(`${gameId}`, 'u'));
    }
    assert.match(tapGame, /class RoomTapSequenceMiniGame/u);
    assert.match(tapGame, /resolveMiniGamePresentation/u);
    assert.match(tapGame, /blockTower/u);
    assert.match(tapGame, /motifId: this\.presentation\.motifId/u);
    assert.match(tapGame, /interactionKind: this\.presentation\.interactionKind/u);
    assert.match(tapGame, /drawRhythmLane/u);
    assert.match(tapGame, /drawBlockTower/u);
    assert.match(tapGame, /drawStudyCards/u);
    assert.match(tapGame, /source: 'phaser-room-mini-game'/u);
    assert.match(activityStage, /class HomeActivityStage/u);
    assert.match(activityStage, /source: 'phaser-room-activity-stage'/u);
    assert.match(activityStage, /motifId: this\.style\.motif/u);
    assert.match(activityStage, /particleCount: this\.particleCount/u);
    assert.match(activityStage, /drawMotif\(x,\s*y,\s*width,\s*height\)/u);
    assert.match(activityStage, /drawProgress\(x,\s*y,\s*width,\s*height\)/u);
    for (const motif of ['sleep', 'bubbles', 'comfort', 'screen']) {
      assert.match(activityStage, new RegExp(`motif: '${motif}'`, 'u'));
    }
    assert.doesNotMatch(activityStage, /interaction-pulse/u);
    for (const actionId of ['sleep', 'bath', 'comfort', 'watchAnime']) {
      assert.match(activityStage, new RegExp(`${actionId}`, 'u'));
    }
    for (const animation of ['sleep_loop', 'bath_loop', 'comfort_loop', 'watch_loop']) {
      assert.match(actor, new RegExp(`${animation}`, 'u'));
    }
  });

  test('implements every declared mini-game key in the rebuild runtime', () => {
    const scene = readFileSync(join(repoRoot, 'src/yoyo-home/scenes/RoomScene.mjs'), 'utf8');
    const tapGame = readFileSync(join(repoRoot, 'src/yoyo-home/minigames/room-tap-sequence.mjs'), 'utf8');
    const implemented = `${scene}\n${tapGame}`;
    const miniGames = new Set(YOYO_HOME_MANIFEST.objects.map((object) => object.miniGame).filter(Boolean));

    for (const miniGame of miniGames) {
      assert.match(implemented, new RegExp(`${miniGame}`, 'u'), `${miniGame} should be implemented`);
    }
  });

  test('Electron rebuild entry boots the same Phaser runtime without legacy home scripts', async () => {
    await withStaticServer(async (baseUrl) => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
        const errors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));

        await page.goto(`${baseUrl}/src/yoyo-home.html?debug=1`);
        await page.waitForFunction(() => window.YOYO_HOME_REBUILD?.phase === 'phase-2-room-preview');
        await page.waitForSelector('canvas');
        const entryState = await page.evaluate(() => ({
          task: window.YOYO_HOME_REBUILD_STATE?.currentTask || null,
          bridgeConnected: Boolean(window.YOYO_HOME_REBUILD?.bridge?.connected),
          legacyHomeLoaded: Boolean(window.homeState || window.startHomeGame),
        }));
        assert.equal(entryState.task, null);
        assert.equal(entryState.bridgeConnected, false);
        assert.equal(entryState.legacyHomeLoaded, false);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    });
  });

  test('Electron bridge hydrates life state and sends completed Home tasks to life care', async () => {
    await withStaticServer(async (baseUrl) => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
        await page.addInitScript(() => {
          window.__yoyoHomeCareCalls = [];
          window.petApi = {
            debugLog: () => {},
            life: {
              get: async () => ({
                satiety: 23,
                cleanliness: 81,
                energy: 72,
                mood: 64,
                affection: 58,
                profile: { intimacy: 5, xp: 11 },
              }),
              care: async (payload) => {
                window.__yoyoHomeCareCalls.push(payload);
                return {
                  satiety: 91,
                  cleanliness: 81,
                  energy: 72,
                  mood: 76,
                  affection: 59,
                  profile: { intimacy: 6, xp: 13 },
                };
              },
              onChanged: (callback) => {
                window.__yoyoHomeLifeChanged = callback;
              },
            },
          };
        });

        await page.goto(`${baseUrl}/src/yoyo-home.html?debug=1`);
        await page.waitForFunction(() => window.YOYO_HOME_REBUILD?.phase === 'phase-3-electron-bridge');
        await page.waitForSelector('canvas');
        const hydrated = await page.evaluate(() => ({
          bridgeConnected: window.YOYO_HOME_REBUILD?.bridge?.connected,
          hunger: window.YOYO_HOME_REBUILD_STATE?.needs?.hunger,
          intimacy: window.YOYO_HOME_REBUILD_STATE?.relationship?.intimacy,
          xp: window.YOYO_HOME_REBUILD_STATE?.relationship?.xp,
        }));
        assert.deepEqual(hydrated, { bridgeConnected: true, hunger: 23, intimacy: 5, xp: 11 });

        const mealClick = await page.evaluate(() => {
          const rect = document.querySelector('canvas').getBoundingClientRect();
          return { x: rect.left + 190, y: rect.top + 520 };
        });
        await page.mouse.click(mealClick.x, mealClick.y);
        await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'catchFood');
        const foodClick = await page.evaluate(() => {
          const rect = document.querySelector('canvas').getBoundingClientRect();
          return { x: rect.left + 126, y: rect.top + 535 };
        });
        await page.mouse.click(foodClick.x, foodClick.y);
        await page.waitForFunction(() => window.__yoyoHomeCareCalls?.length === 1);
        await page.waitForFunction(() => window.YOYO_HOME_LIFE_BRIDGE?.latestLife?.satiety === 91);
        const bridged = await page.evaluate(() => ({
          payload: window.__yoyoHomeCareCalls[0],
          hunger: window.YOYO_HOME_REBUILD_STATE?.needs?.hunger,
          latestLife: window.YOYO_HOME_LIFE_BRIDGE?.latestLife,
        }));
        assert.equal(bridged.payload.actionId, 'feed');
        assert.equal(bridged.payload.source, 'home');
        assert.equal(bridged.payload.homeTask.actionId, 'feed');
        assert.equal(bridged.payload.homeTask.result.gameId, 'catchFood');
        assert.equal(bridged.hunger, 91);
        assert.equal(bridged.latestLife.satiety, 91);
      } finally {
        await browser.close();
      }
    });
  });

  test('Home HUD makes relationship and today care visible outside debug mode', async () => {
    await withStaticServer(async (baseUrl) => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
        await page.addInitScript(() => {
          window.__yoyoHomeCareCalls = [];
          window.petApi = {
            life: {
              get: async () => ({
                satiety: 68,
                cleanliness: 74,
                energy: 63,
                mood: 82,
                affection: 77,
                summary: '心情很好',
                today: {
                  date: '2026-06-02',
                  feed: 1,
                  bath: 0,
                  sleep: 1,
                  play: 0,
                  pet: 2,
                  watchAnime: 0,
                  playSwitch: 0,
                  buildBlocks: 0,
                  study: 0,
                },
                profile: { intimacy: 32, xp: 48, stage: 'close', companionDays: 6 },
              }),
              care: async (payload) => {
                window.__yoyoHomeCareCalls.push(payload);
                return {
                  satiety: 94,
                  cleanliness: 74,
                  energy: 63,
                  mood: 88,
                  affection: 79,
                  summary: '刚吃饱',
                  message: '刚好饿了！这口饭把 Yoyo 救回来啦～',
                  today: {
                    date: '2026-06-02',
                    feed: 2,
                    bath: 0,
                    sleep: 1,
                    play: 0,
                    pet: 2,
                    watchAnime: 0,
                    playSwitch: 0,
                    buildBlocks: 0,
                    study: 0,
                  },
                  profile: { intimacy: 33, xp: 50, stage: 'close', companionDays: 6 },
                };
              },
              onChanged: () => {},
            },
          };
        });

        await page.goto(`${baseUrl}/src/yoyo-home.html`);
        await page.waitForFunction(() => window.YOYO_HOME_REBUILD?.phase === 'phase-3-electron-bridge');
        await page.waitForSelector('[data-home-hud="root"]');
        const hydratedHud = await page.evaluate(() => ({
          debugVisible: Boolean(document.querySelector('.yoyo-home-debug')),
          stage: document.querySelector('[data-home-hud="relationship-stage"]')?.textContent,
          today: document.querySelector('[data-home-hud="today-care"]')?.textContent,
          feedback: document.querySelector('[data-home-hud="feedback"]')?.textContent,
          affection: document.querySelector('[data-home-need="affection"]')?.textContent,
        }));
        assert.equal(hydratedHud.debugVisible, false);
        assert.match(hydratedHud.stage, /亲近/u);
        assert.match(hydratedHud.today, /喂饭 1/u);
        assert.match(hydratedHud.today, /摸摸 2/u);
        assert.match(hydratedHud.feedback, /心情很好/u);
        assert.match(hydratedHud.affection, /77/u);

        const mealClick = await page.evaluate(() => {
          const rect = document.querySelector('canvas').getBoundingClientRect();
          return { x: rect.left + 190, y: rect.top + 520 };
        });
        await page.mouse.click(mealClick.x, mealClick.y);
        await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'catchFood');
        const foodClick = await page.evaluate(() => {
          const rect = document.querySelector('canvas').getBoundingClientRect();
          return { x: rect.left + 126, y: rect.top + 535 };
        });
        await page.mouse.click(foodClick.x, foodClick.y);
        await page.waitForFunction(() => window.__yoyoHomeCareCalls?.length === 1);
        await page.waitForFunction(() => /喂饭 2/u.test(document.querySelector('[data-home-hud="today-care"]')?.textContent || ''));
        const afterHud = await page.evaluate(() => ({
          stage: document.querySelector('[data-home-hud="relationship-stage"]')?.textContent,
          today: document.querySelector('[data-home-hud="today-care"]')?.textContent,
          feedback: document.querySelector('[data-home-hud="feedback"]')?.textContent,
          affection: document.querySelector('[data-home-need="affection"]')?.textContent,
        }));
        assert.match(afterHud.stage, /亲近/u);
        assert.match(afterHud.today, /喂饭 2/u);
        assert.match(afterHud.feedback, /救回来/u);
        assert.match(afterHud.affection, /79/u);
      } finally {
        await browser.close();
      }
    });
  });

  test('preview boots a nonblank Phaser room and completes feed in the same scene', async () => {
    await withStaticServer(async (baseUrl) => {
      const browser = await chromium.launch({ headless: true });
      try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(`${baseUrl}/src/yoyo-home-preview.html?debug=1`);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD?.phase === 'phase-2-room-preview');
      await page.waitForSelector('canvas');
      await page.waitForTimeout(600);

      const before = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return {
          width: canvas?.width,
          height: canvas?.height,
          hasWebgl: Boolean(canvas?.getContext('webgl') || canvas?.getContext('webgl2')),
          phase: window.YOYO_HOME_REBUILD_STATE?.currentTask?.lifecycle || 'idle',
        };
      });
      assert.deepEqual(before, { width: 1272, height: 720, hasWebgl: true, phase: 'idle' });

      const mealClick = await page.evaluate(() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: rect.left + 190, y: rect.top + 520 };
      });
      await page.mouse.click(mealClick.x, mealClick.y);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask?.actionId === 'feed');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'catchFood');
      const foodClick = await page.evaluate(() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: rect.left + 126, y: rect.top + 535 };
      });
      await page.mouse.click(foodClick.x, foodClick.y);
      const during = await page.evaluate(() => ({
        task: window.YOYO_HOME_REBUILD_STATE?.currentTask?.actionId,
        phase: window.YOYO_HOME_REBUILD_STATE?.currentTask?.lifecycle,
        activeMode: window.YOYO_HOME_REBUILD_STATE?.activeTask?.mode || 'none',
        miniGame: window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId || 'none',
        debugTask: document.querySelector('[data-debug="task"]')?.textContent,
        debugMode: document.querySelector('[data-debug="mode"]')?.textContent,
      }));
      assert.equal(during.task, 'feed');
      assert.equal(during.activeMode, 'miniGame');
      assert.equal(during.miniGame, 'catchFood');
      assert.equal(during.debugTask, 'feed');
      assert.equal(during.debugMode, 'miniGame');
      assert.ok(['approach', 'invite', 'active', 'result', 'careDelta', 'aftermath'].includes(during.phase));

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'feed');
      const after = await page.evaluate(() => ({
        task: window.YOYO_HOME_REBUILD_STATE?.currentTask?.actionId || 'idle',
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        hunger: window.YOYO_HOME_REBUILD_STATE?.needs?.hunger,
      }));
      assert.equal(after.aftermath.objectId, 'mealTable');
      assert.equal(after.aftermath.result.gameId, 'catchFood');
      assert.equal(after.aftermath.result.detail.source, 'phaser-room-mini-game');
      assert.ok(after.aftermath.result.score >= 0);
      assert.ok(after.hunger > 70);

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask === null);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.isRunningTask === false);
      const studyClick = await page.evaluate(() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: rect.left + 120, y: rect.top + 330 };
      });
      await page.mouse.click(studyClick.x, studyClick.y);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'guessMood');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.actorAnimation === 'study_loop');
      const moodTap = await page.evaluate(() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: rect.left + 102, y: rect.top + 353 };
      });
      await page.mouse.click(moodTap.x, moodTap.y);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'study');
      const studyAfter = await page.evaluate(() => ({
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        focus: window.YOYO_HOME_REBUILD_STATE?.needs?.focus,
      }));
      assert.equal(studyAfter.aftermath.result.gameId, 'guessMood');
      assert.equal(studyAfter.aftermath.result.detail.source, 'phaser-room-mini-game');
      assert.ok(studyAfter.focus > 55);

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask === null);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.isRunningTask === false);
      const bedClick = await page.evaluate(() => {
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: rect.left + 1030, y: rect.top + 392 };
      });
      await page.mouse.click(bedClick.x, bedClick.y);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.actionId === 'sleep');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.mode === 'interaction');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.actorAnimation === 'sleep_loop');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'sleep');
      const sleepAfter = await page.evaluate(() => ({
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        energy: window.YOYO_HOME_REBUILD_STATE?.needs?.energy,
      }));
      assert.equal(sleepAfter.aftermath.result.gameId, 'sleepActivity');
      assert.equal(sleepAfter.aftermath.result.detail.source, 'phaser-room-activity-stage');
      assert.equal(sleepAfter.aftermath.result.detail.stageId, 'sleep');
      assert.equal(sleepAfter.aftermath.result.detail.motifId, 'sleep');
      assert.ok(sleepAfter.aftermath.result.detail.particleCount >= 5);
      assert.ok(sleepAfter.energy > 70);

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask === null);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.isRunningTask === false);
      const bathStarted = await page.evaluate(() => window.YOYO_HOME_REBUILD_RUNTIME.startAction('bath'));
      assert.equal(bathStarted, true);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.actionId === 'bath');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.actorAnimation === 'bath_loop');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'bath');
      const bathAfter = await page.evaluate(() => ({
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        hygiene: window.YOYO_HOME_REBUILD_STATE?.needs?.hygiene,
      }));
      assert.equal(bathAfter.aftermath.result.gameId, 'bathActivity');
      assert.equal(bathAfter.aftermath.result.detail.motifId, 'bubbles');
      assert.ok(bathAfter.aftermath.result.detail.particleCount >= 9);
      assert.ok(bathAfter.hygiene > 70);

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask === null);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.isRunningTask === false);
      const playSwitchStarted = await page.evaluate(() => window.YOYO_HOME_REBUILD_RUNTIME.startAction('playSwitch'));
      assert.equal(playSwitchStarted, true);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'rhythmPat');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.actorAnimation === 'game_loop');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'playSwitch');
      const switchAfter = await page.evaluate(() => ({
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        fun: window.YOYO_HOME_REBUILD_STATE?.needs?.fun,
      }));
      assert.equal(switchAfter.aftermath.objectId, 'gameConsole');
      assert.equal(switchAfter.aftermath.result.gameId, 'rhythmPat');
      assert.equal(switchAfter.aftermath.result.detail.motifId, 'console-rhythm');
      assert.equal(switchAfter.aftermath.result.detail.interactionKind, 'rhythm-console');
      assert.equal(switchAfter.aftermath.result.detail.objectId, 'gameConsole');
      assert.ok(switchAfter.fun > 60);

      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.currentTask === null);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.isRunningTask === false);
      const blocksStarted = await page.evaluate(() => window.YOYO_HOME_REBUILD_RUNTIME.startAction('buildBlocks'));
      assert.equal(blocksStarted, true);
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.activeTask?.gameId === 'toyTrail');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_RUNTIME?.actorAnimation === 'blocks_loop');
      await page.waitForFunction(() => window.YOYO_HOME_REBUILD_STATE?.aftermath?.actionId === 'buildBlocks');
      const blocksAfter = await page.evaluate(() => ({
        aftermath: window.YOYO_HOME_REBUILD_STATE?.aftermath,
        focus: window.YOYO_HOME_REBUILD_STATE?.needs?.focus,
      }));
      assert.equal(blocksAfter.aftermath.objectId, 'blocks');
      assert.equal(blocksAfter.aftermath.result.gameId, 'toyTrail');
      assert.equal(blocksAfter.aftermath.result.detail.motifId, 'block-tower');
      assert.equal(blocksAfter.aftermath.result.detail.interactionKind, 'block-building');
      assert.equal(blocksAfter.aftermath.result.detail.objectId, 'blocks');
      assert.ok(blocksAfter.focus > 55);
      assert.deepEqual(errors, []);
      } finally {
      await browser.close();
      }
    });
  });
});
