import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const CARE_ACTION_IDS = ['bath', 'buildBlocks', 'feed', 'pet', 'play', 'playSwitch', 'sleep', 'study', 'watchAnime'];

function loadHomeScene() {
  const source = readFileSync(join(repoRoot, 'src/shared/home-scene.js'), 'utf8');
  const context = createContext({ window: {} });
  new Script(source).runInContext(context);
  return JSON.parse(JSON.stringify(context.window.YOYO_HOME_SCENE));
}

describe('home scene manifest', () => {
  test('uses room object hotspots instead of the bottom action dock', () => {
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');

    assert.match(html, /id="care-actions"[^>]*hidden/, 'bottom action dock should stay hidden');
    assert.doesNotMatch(html, /食盆/u, 'feed hotspot should use human table language');
    assert.match(html, /aria-label="小餐桌：喂饭"/u, 'feed hotspot should read as a small table');
    for (const action of CARE_ACTION_IDS) {
      assert.match(
        html,
        new RegExp(`class="room-hotspot[^"]*"[^>]*data-action="${action}"`),
        `${action} should be triggered from a room hotspot`,
      );
    }
  });

  test('defines scene objects for every care action', () => {
    const scene = loadHomeScene();
    const byAction = Object.fromEntries(scene.objects.map((object) => [object.action, object]));

    assert.deepEqual(Object.keys(byAction).sort(), CARE_ACTION_IDS);

    for (const action of CARE_ACTION_IDS) {
      assert.ok(scene.interactions[action], `${action} interaction should exist`);
      assert.equal(scene.interactions[action].objectId, byAction[action].id);
      assert.ok(byAction[action].layers.some((layer) => layer.id === 'back'), `${action} needs a back layer`);
      assert.ok(byAction[action].layers.some((layer) => layer.id === 'front'), `${action} needs a front layer`);
      assert.deepEqual(
        scene.interactions[action].phases.map((phase) => phase.stagePhase),
        ['approach', 'active', 'satisfied'],
        `${action} should have approach, active, and satisfied phases`,
      );
    }
  });

  test('defines a unified in-room interaction system', () => {
    const scene = loadHomeScene();
    const system = scene.interactionSystem;
    const byAction = Object.fromEntries(scene.objects.map((object) => [object.action, object]));

    assert.ok(system, 'interaction system should exist');
    assert.deepEqual(Object.keys(system.tasks).sort(), CARE_ACTION_IDS);
    assert.ok(system.zones.default, 'default zone should exist');

    for (const action of CARE_ACTION_IDS) {
      const task = system.tasks[action];
      assert.ok(task.zone, `${action} task should declare a zone`);
      assert.ok(system.zones[task.zone], `${action} zone should exist`);
      assert.equal(task.objectId, byAction[action].id);
      assert.equal(typeof task.yoyoState, 'string');
      assert.deepEqual(
        task.phases.map((phase) => phase.stagePhase),
        ['approach', 'active', 'satisfied'],
        `${action} should use the shared phase contract`,
      );
      assert.equal(task.resetDelay, 5200);
    }

    assert.equal(system.tasks.feed.mode, 'localized-composite');
  });

  test('defines a modular room layout with slots for every care action', () => {
    const scene = loadHomeScene();
    const layout = scene.roomLayout;

    assert.ok(layout, 'room layout should exist');
    assert.equal(layout.baseAsset, '../assets/yoyo/home/room-v3-day.webp');
    assert.equal(layout.artMode, 'saved-compact-room');
    assert.deepEqual(layout.designSize, { width: 2160, height: 720 });
    assert.ok(
      existsSync(join(repoRoot, layout.baseAsset.replace('../', ''))),
      `saved compact room art is missing: ${layout.baseAsset}`,
    );

    for (const action of CARE_ACTION_IDS) {
      const slot = layout.slots?.[action];
      assert.ok(slot, `${action} slot should exist`);
      assert.ok(
        typeof slot.left === 'string' || typeof slot.right === 'string',
        `${action} slot should define horizontal placement`,
      );
      assert.equal(typeof slot.bottom, 'string');
      assert.equal(typeof slot.width, 'string');
      assert.ok(Number(slot.zIndex) >= 1, `${action} slot should have a z-index`);
    }

    assert.deepEqual(
      Object.fromEntries(Object.entries(layout.slots).map(([key, slot]) => [key, slot.semantic])),
      {
        feed: 'meal-table',
        bath: 'wash-stand',
        sleep: 'child-bed',
        play: 'toy-shelf',
        pet: 'companionship-spot',
        watchAnime: 'media-screen',
        playSwitch: 'game-console',
        buildBlocks: 'block-play',
        study: 'study-desk',
      },
    );

    for (const object of scene.objects) {
      assert.equal(
        object.slot,
        object.action,
        `${object.id} should bind to its action slot instead of ad-hoc CSS placement`,
      );
    }
  });

  test('defines grounded pet placements for every care action', () => {
    const scene = loadHomeScene();

    assert.ok(scene.petPlacements.default, 'default placement should exist');
    for (const action of CARE_ACTION_IDS) {
      const placement = scene.petPlacements[action];
      assert.ok(placement, `${action} placement should exist`);
      assert.equal(typeof placement.left, 'string');
      assert.equal(typeof placement.bottom, 'string');
      assert.equal(typeof placement.scale, 'number');
      assert.ok(placement.scale > 0 && placement.scale <= 1, `${action} scale should be normalized`);
    }
  });

  test('does not use the legacy dedicated home sleep pose for the localized sleep composite', () => {
    const scene = loadHomeScene();
    assert.equal(scene.sceneRigs?.sleep, undefined);
    assert.equal(scene.specialPoses?.sleep, undefined);
  });

  test('uses V3 localized composites for core care interactions', () => {
    const scene = loadHomeScene();
    const expected = {
      feed: ['foodBowl', '../assets/yoyo/home/composite-v3-feed-yoyo.webp'],
      sleep: ['sleepBed', '../assets/yoyo/home/composite-v3-sleep-yoyo.webp'],
      bath: ['bathTub', '../assets/yoyo/home/composite-v3-bath-yoyo.webp'],
      play: ['toyBox', '../assets/yoyo/home/composite-v3-play-yoyo.webp'],
      pet: ['heartSpot', '../assets/yoyo/home/composite-v3-comfort-yoyo.webp'],
    };

    for (const [action, [objectId, src]] of Object.entries(expected)) {
      const composite = scene.actionComposites?.[action];
      assert.ok(composite, `${action} should use a localized V3 composite`);
      assert.equal(composite.objectId, objectId);
      assert.equal(composite.src, src);
      assert.ok(composite.slot?.width, `${action} composite should declare placement overrides`);
      assert.ok(
        existsSync(join(repoRoot, composite.src.replace('../', ''))),
        `${action} composite is missing: ${composite.src}`,
      );
      assert.equal(scene.interactionSystem.tasks[action].mode, 'localized-composite');
    }

    assert.match(
      readFileSync(join(repoRoot, 'src/home.js'), 'utf8'),
      /Object\.entries\(\{\s*\.\.\.slot,\s*\.\.\.\(composite\.slot \|\| \{\}\),?\s*\}\)/s,
      'home runtime should let localized composites override object slot placement',
    );

    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');
    for (const action of Object.keys(expected)) {
      assert.match(
        css,
        new RegExp(`data-scene="${action}"\\]\\[data-has-composite="true"\\]\\[data-interaction-phase="active"\\] \\.home-action-composite`),
        `${action} composite should animate during the active interaction phase`,
      );
    }
  });

  test('does not use full action rooms for modular slot scenes', () => {
    const scene = loadHomeScene();

    assert.deepEqual(scene.actionRooms || {}, {});
  });

  test('all scene object layer assets exist', () => {
    const scene = loadHomeScene();

    for (const object of scene.objects) {
      for (const layer of object.layers) {
        const assetPath = layer.src.replace('../', '');
        assert.ok(
          existsSync(join(repoRoot, assetPath)),
          `${object.id}.${layer.id} layer asset is missing: ${assetPath}`,
        );
      }
    }
  });

  test('uses the saved compact room art without duplicating modular furniture', () => {
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');

    assert.match(
      html,
      /id="room-art"[^>]*src="\.\.\/assets\/yoyo\/home\/room-v3-day\.webp"/,
      'initial room image should be the V3 saved compact room art',
    );
    assert.match(
      css,
      /\.scene-object\s*\{[^}]*opacity:\s*1;/s,
      'scene furniture should remain visible by default for generated shells',
    );
    assert.match(
      css,
      /\.room-stage\[data-room-art-mode="saved-compact-room"\]\s+\.home-fixture/s,
      'saved compact room mode should suppress generated room fixtures',
    );
    assert.match(
      css,
      /\.room-stage\[data-room-art-mode="saved-compact-room"\]\s+\.room-world/s,
      'saved compact room mode should use a single saved image viewport',
    );
    assert.match(
      css,
      /\.room-stage\[data-room-art-mode="saved-compact-room"\]\s+\.room-art/s,
      'saved compact room mode should display the saved room image',
    );
    assert.match(
      css,
      /\.room-stage\[data-room-art-mode="saved-compact-room"\]:not\(\[data-task\]\)\s+\.scene-object/s,
      'saved compact room mode should hide idle modular objects to prevent duplicate furniture',
    );
    assert.doesNotMatch(
      css,
      /data-has-composite="true"\]\s+\.home-decor-item\s*\{[^}]*opacity:\s*0(?:\.|;)/s,
      'composite actions should not hide the rest of the furniture',
    );
  });

  test('adds non-interactive home fixtures so the room reads as a lived-in home', () => {
    const scene = loadHomeScene();
    const fixtureIds = new Set((scene.decor || []).filter((item) => item.className?.includes('home-fixture')).map((item) => item.id));

    for (const id of [
      'wallAirConditioner',
      'wallClock',
      'lightSwitch',
      'floorOutlet',
      'houseSlippers',
      'softStorageBasket',
      'kitchenWallTiles',
      'kitchenCounter',
      'kitchenRange',
      'kitchenFridge',
      'kitchenUpperCabinet',
      'livingWindow',
      'livingSofa',
      'livingCoffeeTable',
      'livingFloorLamp',
      'playFloorMat',
      'sleepCurtain',
      'bedsideDrawer',
      'sleepRug',
    ]) {
      assert.ok(fixtureIds.has(id), `${id} fixture should be present`);
    }
  });

  test('uses an expanded multi-zone house with camera stops', () => {
    const scene = loadHomeScene();
    const house = scene.expandedHouse;

    assert.equal(house?.enabled, true);
    assert.equal(house.worldWidth, 2160);
    assert.equal(house.viewportWidth, 1080);
    assert.deepEqual(Object.keys(house.cameraStops).sort(), ['kitchen', 'living', 'play', 'sleep']);
    assert.equal(house.actionCamera.feed, 'kitchen');
    assert.equal(house.actionCamera.pet, 'living');
    assert.equal(house.actionCamera.play, 'play');
    assert.equal(house.actionCamera.study, 'play');
    assert.equal(house.actionCamera.sleep, 'sleep');
    assert.equal(house.actionCamera.bath, 'sleep');
  });

  test('keeps the rejected readBook sprite out of home study interactions', () => {
    const scene = loadHomeScene();
    assert.equal(scene.interactionSystem.tasks.study.yoyoState, 'review');
  });
});
