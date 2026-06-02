import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HOME_ACTIONS,
  HOME_ACTION_PRESENTATION,
  YOYO_HOME_MANIFEST,
  getHomeObjectForAction,
  validateHomeManifest,
} from '../src/yoyo-home/data/home-manifest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function assetExists(assetPath) {
  return existsSync(join(repoRoot, assetPath.replace(/^\.\.\//u, '')));
}

describe('Yoyo Home Phaser scene contract', () => {
  test('uses the rebuilt Phaser Home manifest as the room source of truth', () => {
    assert.deepEqual(validateHomeManifest(YOYO_HOME_MANIFEST), { ok: true, errors: [] });
    assert.equal(YOYO_HOME_MANIFEST.runtime.engine, 'phaser');
    assert.equal(YOYO_HOME_MANIFEST.runtime.stateOwner, 'simulation');
    assert.equal(YOYO_HOME_MANIFEST.runtime.renderOwner, 'phaser');
    assert.equal(YOYO_HOME_MANIFEST.runtime.hudOwner, 'dom');
    assert.deepEqual(YOYO_HOME_MANIFEST.room.size, { width: 1272, height: 720 });
  });

  test('loads only accepted v3-safe room backgrounds', () => {
    const activeManifest = JSON.stringify({ ...YOYO_HOME_MANIFEST, forbiddenSources: [] });

    for (const [variant, asset] of Object.entries(YOYO_HOME_MANIFEST.room.backgrounds)) {
      assert.match(asset, new RegExp(`room-v3-${variant === 'day' ? 'day' : variant}-safe\\.webp`, 'u'));
      assert.ok(assetExists(asset), `${asset} should exist`);
    }

    for (const forbidden of YOYO_HOME_MANIFEST.forbiddenSources) {
      assert.equal(activeManifest.includes(forbidden), false, `${forbidden} should not appear in active Home manifest data`);
    }
    assert.doesNotMatch(activeManifest, /dog bowl|kibble|paw motif|animal bed/u);
  });

  test('models every home action as a room object task', () => {
    const objectIds = new Set(YOYO_HOME_MANIFEST.objects.map((object) => object.id));

    for (const actionId of HOME_ACTIONS) {
      const object = getHomeObjectForAction(YOYO_HOME_MANIFEST, actionId);
      assert.ok(object, `${actionId} should have a room object`);
      assert.ok(objectIds.has(object.id), `${actionId} object should belong to the manifest`);
      assert.ok(object.capabilities.includes(actionId), `${object.id} should expose ${actionId}`);
      assert.equal(object.nativeRoomPolicy.bakedFurniture, true);
      assert.equal(object.nativeRoomPolicy.renderPropSprite, false);
      assert.equal(object.nativeRoomPolicy.renderHitArea, true);
      assert.ok(Number.isFinite(object.hitArea.x));
      assert.ok(Number.isFinite(object.hitArea.y));
      assert.ok(Number.isFinite(object.hitArea.width));
      assert.ok(Number.isFinite(object.hitArea.height));
      assert.ok(Number.isFinite(object.actorSpot.x));
      assert.ok(Number.isFinite(object.actorSpot.y));
      assert.ok(['left', 'right'].includes(object.actorSpot.facing));
    }
  });

  test('keeps Yoyo movement and activity presentation in the new runtime contract', () => {
    const requiredAnimations = new Set(YOYO_HOME_MANIFEST.actor.requiredAnimations);
    const actorSource = readFileSync(join(repoRoot, 'src/yoyo-home/render/yoyo-actor.mjs'), 'utf8');
    const activityStageSource = readFileSync(join(repoRoot, 'src/yoyo-home/render/home-activity-stage.mjs'), 'utf8');
    assert.equal(YOYO_HOME_MANIFEST.actor.driver, 'spine-or-layered-rig');
    assert.equal(YOYO_HOME_MANIFEST.actor.fallbackDriver, 'spritesheet');
    assert.ok(assetExists(YOYO_HOME_MANIFEST.actor.fallbackSprite));
    assert.match(actorSource, /motionTween/u);
    assert.match(actorSource, /animation === 'sleep_loop'/u);
    assert.match(actorSource, /animation === 'bath_loop'/u);
    assert.match(actorSource, /animation === 'comfort_loop'/u);
    assert.match(actorSource, /animation === 'watch_loop'/u);
    assert.match(activityStageSource, /drawProgress/u);
    assert.match(activityStageSource, /drawMotif/u);

    for (const actionId of HOME_ACTIONS) {
      const presentation = HOME_ACTION_PRESENTATION[actionId];
      assert.ok(presentation, `${actionId} should have presentation copy and animations`);
      for (const key of ['startAnimation', 'loopAnimation', 'endAnimation', 'completeAnimation']) {
        assert.ok(requiredAnimations.has(presentation[key]), `${actionId} should require ${presentation[key]}`);
      }
      for (const key of ['inviteLine', 'activeLine', 'resultLine', 'aftermathLine']) {
        assert.equal(typeof presentation[key], 'string');
        assert.ok(presentation[key].length > 0, `${actionId} should have ${key}`);
      }
    }
  });

  test('keeps mini games embedded in room tasks instead of old overlay pages', () => {
    const byAction = new Map(HOME_ACTIONS.map((actionId) => [actionId, getHomeObjectForAction(YOYO_HOME_MANIFEST, actionId)]));

    assert.equal(byAction.get('feed').miniGame, 'catchFood');
    assert.equal(byAction.get('study').miniGame, 'guessMood');
    assert.equal(byAction.get('study').id, 'studyDesk');
    assert.equal(byAction.get('play').miniGame, 'toyTrail');
    assert.equal(byAction.get('play').id, 'toyShelf');
    assert.equal(byAction.get('buildBlocks').miniGame, 'toyTrail');
    assert.equal(byAction.get('buildBlocks').id, 'blocks');
    assert.equal(byAction.get('playSwitch').miniGame, 'rhythmPat');
    assert.equal(byAction.get('playSwitch').id, 'gameConsole');
    assert.equal(byAction.get('sleep').miniGame || null, null);
    assert.equal(byAction.get('bath').miniGame || null, null);
    assert.equal(byAction.get('comfort').miniGame || null, null);
    assert.equal(byAction.get('watchAnime').miniGame || null, null);
  });

  test('mini-game host renders furniture-specific play instead of generic tap buttons', () => {
    const source = readFileSync(join(repoRoot, 'src/yoyo-home/minigames/room-tap-sequence.mjs'), 'utf8');

    assert.match(source, /resolveMiniGamePresentation/u);
    assert.match(source, /motifId: 'toy-trail'/u);
    assert.match(source, /motifId: 'block-tower'/u);
    assert.match(source, /motifId: 'console-rhythm'/u);
    assert.match(source, /motifId: 'study-cards'/u);
    assert.match(source, /drawFurnitureMotif/u);
    assert.match(source, /drawToyTrail/u);
    assert.match(source, /drawBlockTower/u);
    assert.match(source, /drawRhythmLane/u);
    assert.match(source, /drawStudyCards/u);
    assert.match(source, /interactionKind: this\.presentation\.interactionKind/u);
    assert.match(source, /objectId: this\.object\.id/u);
  });

  test('active Home files do not load the deleted DOM Home chain', () => {
    const electronHtml = readFileSync(join(repoRoot, 'src/yoyo-home.html'), 'utf8');
    const previewHtml = readFileSync(join(repoRoot, 'src/yoyo-home-preview.html'), 'utf8');
    const scene = readFileSync(join(repoRoot, 'src/yoyo-home/scenes/RoomScene.mjs'), 'utf8');
    const bridge = readFileSync(join(repoRoot, 'src/yoyo-home/bridge/electron-life-bridge.mjs'), 'utf8');
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

    for (const source of [electronHtml, previewHtml, scene, bridge]) {
      assert.doesNotMatch(source, /home\.js|home\.css|home-games|home-phaser-games|home-spine-action|shared\/home-scene/u);
    }
    assert.equal(packageJson.build.files.includes('src/**/*'), true);
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
      assert.ok(packageJson.build.files.includes(`!${legacyFile}`), `${legacyFile} should remain excluded from packages`);
    }
  });

  test('asset pack points Home zones at the rebuilt manifest', () => {
    const packManifest = JSON.parse(readFileSync(join(repoRoot, 'assets/yoyo/pack-manifest.json'), 'utf8'));

    assert.equal(packManifest.home.roomMode, 'phaser-v3-safe-room');
    assert.equal(packManifest.home.zoneSource, '../../src/yoyo-home/data/home-manifest.mjs');
    assert.equal(packManifest.home.runtimeEntry, '../../src/yoyo-home.html');
    assert.equal(packManifest.home.runtimeCharacter, 'home/yoyo-home-v7-room-palette.webp');
    assert.deepEqual(packManifest.home.rooms, {
      default: 'home/room-v3-day-safe.webp',
      night: 'home/room-v3-night-safe.webp',
      rainy: 'home/room-v3-rainy-safe.webp',
      party: 'home/room-v3-party-safe.webp',
    });
  });

  test('legacy DOM Home source files are removed from the rebuild line', () => {
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
      assert.equal(existsSync(join(repoRoot, legacyFile)), false, `${legacyFile} should not remain as active source`);
    }
  });
});
