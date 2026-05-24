import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function loadHomeScene() {
  const source = readFileSync(join(repoRoot, 'src/shared/home-scene.js'), 'utf8');
  const context = createContext({ window: {} });
  new Script(source).runInContext(context);
  return JSON.parse(JSON.stringify(context.window.YOYO_HOME_SCENE));
}

describe('home scene manifest', () => {
  test('defines scene objects for every care action', () => {
    const scene = loadHomeScene();
    const byAction = Object.fromEntries(scene.objects.map((object) => [object.action, object]));

    assert.deepEqual(Object.keys(byAction).sort(), ['bath', 'feed', 'pet', 'play', 'sleep']);

    for (const action of ['feed', 'bath', 'sleep', 'play', 'pet']) {
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

  test('defines a modular room layout with slots for every care action', () => {
    const scene = loadHomeScene();
    const layout = scene.roomLayout;

    assert.ok(layout, 'room layout should exist');
    assert.equal(layout.baseAsset, '../assets/yoyo/home/room-shell-clean-2d.webp');
    assert.deepEqual(layout.designSize, { width: 1080, height: 720 });
    assert.ok(
      existsSync(join(repoRoot, layout.baseAsset.replace('../', ''))),
      `modular room shell is missing: ${layout.baseAsset}`,
    );

    for (const action of ['feed', 'bath', 'sleep', 'play', 'pet']) {
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
    for (const action of ['feed', 'bath', 'sleep', 'play', 'pet']) {
      const placement = scene.petPlacements[action];
      assert.ok(placement, `${action} placement should exist`);
      assert.equal(typeof placement.left, 'string');
      assert.equal(typeof placement.bottom, 'string');
      assert.equal(typeof placement.scale, 'number');
      assert.ok(placement.scale > 0 && placement.scale <= 1, `${action} scale should be normalized`);
    }
  });

  test('defines a dedicated home sleep pose asset', () => {
    const scene = loadHomeScene();
    const pose = scene.specialPoses?.sleep;

    assert.ok(pose, 'sleep should use a dedicated home pose');
    assert.equal(pose.objectId, 'sleepBed');
    assert.equal(pose.src, '../assets/yoyo/home/home-sleep-yoyo.webp');
    assert.ok(
      existsSync(join(repoRoot, pose.src.replace('../', ''))),
      `sleep pose asset is missing: ${pose.src}`,
    );
  });

  test('defines an action composite for contact-heavy sleep scene', () => {
    const scene = loadHomeScene();
    const composite = scene.actionComposites?.sleep;

    assert.ok(composite, 'sleep should use an integrated action composite');
    assert.equal(composite.objectId, 'sleepBed');
    assert.equal(composite.src, '../assets/yoyo/home/composite-sleep-bed-yoyo.webp');
    assert.equal(composite.semantic, 'child-bed-sleep');
    assert.ok(
      existsSync(join(repoRoot, composite.src.replace('../', ''))),
      `sleep action composite is missing: ${composite.src}`,
    );
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
});
