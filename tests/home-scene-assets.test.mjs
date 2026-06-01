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

  test('keeps home utility actions in one human-facing tool tray', () => {
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');

    assert.match(html, /class="home-tools"[^>]*aria-label="小屋工具"/u);
    for (const id of ['ctrl-toggle', 'wardrobe-launcher', 'game-launcher', 'concert-launcher', 'refresh-life']) {
      assert.match(
        html,
        new RegExp(`id="${id}"[^>]*class="[^"]*tool-button|class="[^"]*tool-button[^"]*"[^>]*id="${id}"`, 'u'),
        `${id} should be presented as a tray tool button`,
      );
    }
    assert.match(css, /\.home-tools\s*\{[^}]*display:\s*flex;/s);
    assert.match(css, /\.home-tools\s+\.refresh-button,\s*\.home-tools\s+\.game-launcher,\s*\.home-tools\s+\.wardrobe-launcher,\s*\.home-tools\s+\.concert-launcher\s*\{[^}]*position:\s*relative;/s);
    assert.match(css, /\.home-shell\.idle-ui\s+\.home-tools\s*\{/s);
    assert.doesNotMatch(css, /\.home-shell\.idle-ui\s+\.wardrobe-launcher\s*\{\s*opacity:\s*0;/s);
  });

  test('routes room clicks through an intent resolver instead of immediate care execution', () => {
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');
    const js = readFileSync(join(repoRoot, 'src/home.js'), 'utf8');

    assert.match(html, /id="home-intent-popover"/u, 'room intent popover should exist');
    assert.match(js, /function\s+resolveHomeIntent\s*\(/u, 'hotspots should enter an intent resolver first');
    assert.match(js, /function\s+confirmHomeIntent\s*\(/u, 'confirmed intents should explicitly execute care');
    assert.match(js, /hotspot\.addEventListener\('click',\s*\(\)\s*=>\s*resolveHomeIntent\(hotspot\.dataset\.action/u);
    assert.doesNotMatch(
      js,
      /hotspot\.addEventListener\('click',\s*\(\)\s*=>\s*care\(hotspot\.dataset\.action\)\)/u,
      'room hotspots must not execute care directly',
    );
  });

  test('defines scene objects for every care action', () => {
    const scene = loadHomeScene();
    const byAction = Object.fromEntries(scene.objects.map((object) => [object.action, object]));

    assert.deepEqual(Object.keys(byAction).sort(), CARE_ACTION_IDS);

    for (const action of CARE_ACTION_IDS) {
      assert.ok(scene.interactions[action], `${action} interaction should exist`);
      assert.equal(scene.interactions[action].objectId, byAction[action].id);
      assert.ok(byAction[action].layers.length >= 1, `${action} needs at least one V3 prop layer`);
      assert.ok(
        byAction[action].layers.every((layer) => /\/prop-v3-/u.test(layer.src)),
        `${action} should use only V3 prop layers`,
      );
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

    for (const action of CARE_ACTION_IDS) {
      assert.equal(
        system.tasks[action].mode,
        'native-room-zone',
        `${action} should use the saved room object instead of revealing a second layered prop`,
      );
    }
  });

  test('supports the V7 room-native home character preview without deleting the spritesheet fallback', () => {
    const scene = loadHomeScene();
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');

    assert.equal(scene.homeCharacter.mode, 'v7-cutout');
    assert.equal(scene.homeCharacter.fallbackMode, 'sprite-canvas');
    assert.equal(scene.homeCharacter.cutout, '../assets/yoyo/home/yoyo-home-v7-room-palette.webp');
    assert.ok(
      existsSync(join(repoRoot, 'assets/yoyo/home/yoyo-home-v7-room-palette.webp')),
      'V7 home cutout asset should exist',
    );
    assert.match(html, /id="home-pet-cutout"/u);
    assert.match(html, /id="home-pet"[^>]*width="192"[^>]*height="208"/u, 'spritesheet canvas fallback should remain');
    assert.match(css, /data-home-character-mode="v7-cutout"/u);
  });

  test('declares a Spine/Pixi-ready home action runtime with CSS cutout fallback', () => {
    const scene = loadHomeScene();

    assert.equal(scene.actionRuntime?.targetDriver, 'spine-pixi-v8');
    assert.equal(scene.actionRuntime?.fallbackDriver, 'css-v7-cutout');
    assert.equal(scene.actionRuntime?.stateAttribute, 'data-action-animation');
    assert.equal(scene.actionRuntime?.phaseAttribute, 'data-action-phase');
    assert.equal(scene.actionRuntime?.motionAttribute, 'data-motion-phase');
    assert.equal(scene.actionRuntime?.assetStatus, 'desktop-rig-v1-local');
    assert.equal(scene.actionRuntime?.desktopRig?.manifest, '../assets/yoyo/desktop-rig/v1/manifest.json');
    assert.equal(scene.actionRuntime?.desktopRig?.driver, 'pixi-layered-rig');
    assert.deepEqual(scene.actionRuntime?.desktopRig?.actions?.sort(), CARE_ACTION_IDS);
    assert.ok(
      existsSync(join(repoRoot, scene.actionRuntime.desktopRig.manifest.replace('../', ''))),
      'desktop rig manifest should exist for home action runtime',
    );
    assert.deepEqual(Object.keys(scene.actionRuntime?.requiredAnimations || {}).sort(), CARE_ACTION_IDS);
    assert.deepEqual(
      scene.actionRuntime?.requiredAnimations?.feed,
      ['feed_notice', 'feed_walk_to_table', 'feed_inspect_food', 'feed_eat_loop', 'feed_satisfied', 'feed_return_idle'],
    );
    for (const action of CARE_ACTION_IDS) {
      const timeline = scene.interactionSystem.tasks[action].timeline;
      assert.deepEqual(
        scene.actionRuntime.requiredAnimations[action],
        timeline.map((step) => step.animation),
        `${action} required animations should be generated from the runtime timeline`,
      );
    }
  });

  test('wires the feed action to repo-local Spine assets instead of transient overlay props', () => {
    const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');
    const runtime = readFileSync(join(repoRoot, 'src/home-spine-action.js'), 'utf8');
    const feedPack = readFileSync(join(repoRoot, 'src/home-spine-feed-assets.js'), 'utf8');
    const feedSkeleton = JSON.parse(readFileSync(join(repoRoot, 'assets/yoyo/effects/feed/spine/yoyo.skel.json'), 'utf8'));
    const feedTimeline = JSON.parse(readFileSync(join(repoRoot, 'assets/yoyo/effects/feed/timeline.json'), 'utf8'));

    assert.match(html, /id="home-spine-host"/u, 'home should expose a Pixi/Spine mount point');
    assert.match(html, /pixi\.min\.js/u, 'home should load Pixi for action animation');
    assert.match(html, /spine-pixi-v8\.min\.js/u, 'home should load the Spine Pixi runtime');
    assert.match(html, /home-spine-feed-assets\.js/u, 'feed action should use a repo-local Spine asset pack');
    assert.match(html, /home-spine-action\.js/u, 'feed action should use the Spine action controller');
    assert.match(runtime, /YOYO_HOME_FEED_SPINE/u, 'runtime should use the generated feed asset pack');
    assert.match(runtime, /Cache/u, 'runtime should cache inline Spine skeleton JSON without file fetch');
    assert.match(runtime, /spineTextureAtlasLoader/u, 'runtime should explicitly load blob-backed Spine atlases');
    assert.match(runtime, /homeSpineActive/u, 'runtime should publish active Spine state to the stage');
    assert.match(runtime, /RIG_MANIFEST_URL/u, 'runtime should load the local desktop rig manifest as a fallback action driver');
    assert.match(runtime, /desktop-rig\/v1\/manifest\.json/u, 'runtime should use the checked-in desktop rig source');
    assert.match(runtime, /homeSpineDriver/u, 'runtime should publish whether Spine or the desktop rig is active');
    assert.match(runtime, /PIXI\.Sprite/u, 'desktop rig fallback should render real local rig layers through Pixi');
    assert.match(feedPack, /window\.YOYO_HOME_FEED_SPINE/u, 'feed pack should be browser-loadable without fetch');
    assert.ok(feedSkeleton.animations?.eat_table, 'feed skeleton should define an eat_table animation');
    assert.ok(feedSkeleton.animations?.idle_stand, 'feed skeleton should define an idle_stand animation');
    assert.equal(feedTimeline.runtimeMode, 'home-spine-action');
    assert.equal(feedTimeline.spine?.animation, 'eat_table');
  });

  test('defines feed as a complete stateful action chain instead of a single click animation', () => {
    const scene = loadHomeScene();
    const js = readFileSync(join(repoRoot, 'src/home.js'), 'utf8');
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');
    const feed = scene.interactionSystem.tasks.feed;

    assert.deepEqual(
      feed.timeline.map((step) => step.animation),
      ['feed_notice', 'feed_walk_to_table', 'feed_inspect_food', 'feed_eat_loop', 'feed_satisfied', 'feed_return_idle'],
    );
    assert.ok(
      feed.timeline.every((step) => typeof step.at === 'number' && typeof step.pose === 'string' && typeof step.animation === 'string'),
      'feed timeline should expose timed pose and animation names for the runtime driver',
    );
    assert.equal(feed.mode, 'native-room-zone');
    assert.deepEqual(scene.actionMotion?.feed?.petTravel?.from, 'default');
    assert.deepEqual(scene.actionMotion?.feed?.petTravel?.to, 'feed');
    assert.ok(scene.actionMotion?.feed?.petTravel?.durationMs >= 900, 'feed should visibly travel before eating');
    assert.match(js, /dataset\.actionAnimation/u, 'home runtime should publish the current action animation');
    assert.match(js, /dataset\.actionPhase/u, 'home runtime should expose semantic action phases separately from CSS motion phases');
    assert.match(js, /pendingPetTravelAction/u, 'home runtime should stage feed motion from the current room spot');
    assert.match(js, /dataset\.petTravel/u, 'home runtime should publish pet travel state for CSS animation');
    assert.match(css, /data-pet-travel="feed-run-active"/u, 'feed should have a travel transition state');
    assert.match(css, /v7FeedRunSteps/u, 'feed walk should use visible run-step motion');
  });

  test('adds timeline metadata for the first V7 interaction samples', () => {
    const scene = loadHomeScene();

    for (const action of CARE_ACTION_IDS) {
      const timeline = scene.interactionSystem.tasks[action].timeline;
      assert.deepEqual(
        timeline.map((step) => step.stagePhase),
        action === 'feed'
          ? ['anticipate', 'enter', 'inspect', 'active', 'complete', 'settle']
          : ['anticipate', 'enter', 'active', 'complete', 'settle'],
        `${action} should have a full runtime timeline`,
      );
      assert.ok(
        timeline.every((step) => typeof step.at === 'number' && typeof step.pose === 'string' && typeof step.animation === 'string'),
        `${action} timeline should be timed, pose-aware, and animation-addressable`,
      );
    }
  });

  test('defines a modular room layout with slots for every care action', () => {
    const scene = loadHomeScene();
    const layout = scene.roomLayout;

    assert.ok(layout, 'room layout should exist');
    assert.equal(layout.baseAsset, '../assets/yoyo/home/room-v3-day-safe.webp');
    assert.equal(layout.artMode, 'saved-compact-room');
    assert.deepEqual(layout.designSize, { width: 1272, height: 720 });
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
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');

    assert.ok(scene.petPlacements.default, 'default placement should exist');
    for (const action of CARE_ACTION_IDS) {
      const placement = scene.petPlacements[action];
      assert.ok(placement, `${action} placement should exist`);
      assert.equal(typeof placement.left, 'string');
      assert.equal(typeof placement.bottom, 'string');
      assert.equal(typeof placement.scale, 'number');
      assert.ok(placement.scale > 0 && placement.scale <= 1, `${action} scale should be normalized`);
    }
    assert.ok(
      CARE_ACTION_IDS.every((action) => scene.petPlacements[action].scale >= 0.6),
      'home V7 action placements should keep Yoyo at a child-sized room proportion',
    );
    assert.match(css, /height:\s*var\(--home-v7-height,\s*clamp\(330px,\s*46vh,\s*386px\)\)/u);
  });

  test('does not use the legacy dedicated home sleep pose for the localized sleep composite', () => {
    const scene = loadHomeScene();
    assert.equal(scene.sceneRigs?.sleep, undefined);
    assert.equal(scene.specialPoses?.sleep, undefined);
  });

  test('keeps saved-room actions native instead of revealing duplicate prop layers', () => {
    const scene = loadHomeScene();
    const css = readFileSync(join(repoRoot, 'src/home.css'), 'utf8');

    assert.deepEqual(scene.actionComposites, {});

    for (const action of CARE_ACTION_IDS) {
      const object = scene.objects.find((item) => item.action === action);
      assert.ok(object, `${action} should have a scene object`);
      assert.equal(object.layers.length, 1, `${action} should have one canonical V3 prop layer`);
      assert.ok(
        existsSync(join(repoRoot, object.layers[0].src.replace('../', ''))),
        `${action} V3 prop is missing: ${object.layers[0].src}`,
      );
      assert.equal(scene.interactionSystem.tasks[action].mode, 'native-room-zone');
      assert.doesNotMatch(
        css,
        new RegExp(`data-scene="${action}"\\]\\s+\\.scene-object\\[data-action="${action}"\\]`, 'u'),
        `${action} should not reveal a duplicate saved-room prop layer`,
      );
    }

    const sleepObject = scene.objects.find((item) => item.action === 'sleep');
    assert.equal(sleepObject.id, 'sleepBed');
    const feedObject = scene.objects.find((item) => item.action === 'feed');
    assert.equal(feedObject.id, 'foodBowl');
  });

  test('does not reference legacy home props or baked Yoyo composites in the active home runtime', () => {
    const activeSources = [
      readFileSync(join(repoRoot, 'src/home.html'), 'utf8'),
      readFileSync(join(repoRoot, 'src/home.css'), 'utf8'),
      readFileSync(join(repoRoot, 'src/shared/home-scene.js'), 'utf8'),
      readFileSync(join(repoRoot, 'assets/yoyo/pack-manifest.json'), 'utf8'),
    ].join('\n');

    for (const legacy of [
      'prop-food',
      'prop-bath',
      'prop-bed.webp',
      'prop-toy.webp',
      'prop-heart.webp',
      'decor-tv-game-toys',
      'decor-wall-soft-furnishing',
      'composite-sleep-bed-yoyo',
      'composite-v3-feed-yoyo',
      'composite-v3-sleep-yoyo',
      'composite-v3-bath-yoyo',
      'composite-v3-play-yoyo',
      'composite-v3-comfort-yoyo',
      'home-sleep-yoyo',
      'home-sleep-pose',
    ]) {
      assert.doesNotMatch(activeSources, new RegExp(legacy.replaceAll('.', '\\.')), `${legacy} should not be active`);
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
      /id="room-art"[^>]*src="\.\.\/assets\/yoyo\/home\/room-v3-day-safe\.webp"/,
      'initial room image should be the no-dog-bowl safe V3 room art',
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
    assert.match(css, /aspect-ratio:\s*1272\s*\/\s*720;/u, 'saved room viewport should preserve the safe room aspect ratio');
    assert.match(css, /width:\s*min\(100vw,\s*calc\(100vh\s*\*\s*1\.7666667\)\);/u, 'saved room viewport should fit without horizontal crop');
    assert.match(css, /margin:\s*auto;/u, 'saved room viewport should center without horizontal transform drift');
    assert.match(css, /transform:\s*translateY\(-50%\);/u, 'saved room viewport should only use vertical transform');
    assert.doesNotMatch(css, /transform:\s*translate\(-50%,\s*-50%\);/u);
    assert.match(css, /\.room-world\s*\{[^}]*overflow:\s*clip;/s, 'room world should not become an internally scrollable hit-test container');
    assert.match(html + readFileSync(join(repoRoot, 'src/home.js'), 'utf8'), /roomWorld\.scrollLeft\s*=\s*0/u);
    assert.match(html + readFileSync(join(repoRoot, 'src/home.js'), 'utf8'), /roomStage\.scrollLeft\s*=\s*0/u);
    assert.match(
      css,
      /\.room-stage\[data-room-art-mode="saved-compact-room"\]\s+\.room-art/s,
      'saved compact room mode should display the saved room image',
    );
    assert.match(css, /object-fit:\s*fill;/u, 'saved room art should fill the aspect-locked viewport without cover-cropping the room');
    assert.doesNotMatch(css, /data-room-art-mode="saved-compact-room"\]\s+\.room-art\s*\{[^}]*object-fit:\s*cover;/s);
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

  test('keeps compact V3 room as a single viewport instead of mixing in expanded-house scrolling', () => {
    const scene = loadHomeScene();
    const house = scene.expandedHouse;

    assert.equal(house?.enabled, false);
    assert.equal(house.worldWidth, 1272);
    assert.equal(house.viewportWidth, 1272);
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
