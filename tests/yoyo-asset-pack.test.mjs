import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const manifestPath = join(repoRoot, 'assets/yoyo/pack-manifest.json');
const statusPath = join(repoRoot, 'assets/yoyo/asset-status.json');
const reportPath = join(repoRoot, 'assets/yoyo/qa/asset-pack-report.md');
const inventoryPath = join(repoRoot, 'assets/yoyo/qa/asset-inventory.json');
const redrawQueuePath = join(repoRoot, 'assets/yoyo/qa/redraw-queue.json');
const candidateRegistryPath = join(repoRoot, 'assets/yoyo/qa/candidate-registry.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('Yoyo asset pack contract', () => {
  test('declares Yoyo as a human-like companion pack with golden runtime assets', () => {
    const manifest = readJson(manifestPath);

    assert.equal(manifest.id, 'yoyo');
    assert.equal(manifest.type, 'companion');
    assert.equal(manifest.style, 'clean-2d-chibi');
    assert.equal(manifest.semantics.species, 'human-like companion');
    assert.ok(manifest.semantics.avoid.includes('dog bowl'));

    assert.equal(manifest.avatar.driver, 'pixi-spritesheet');
    assert.equal(manifest.avatar.sheet, 'spritesheet.webp');
    assert.equal(manifest.avatar.actions, 'pet.json#/states');
    assert.deepEqual(manifest.avatar.goldenActions, [
      'idle',
      'runningLeft',
      'runningRight',
      'waving',
      'eating',
      'sleeping',
      'review',
      'petting',
      'dancing',
    ]);

    assert.equal(manifest.home.rooms.day, 'home/room-v3-day-safe.webp');
    assert.equal(manifest.home.rooms.night, 'home/room-v3-night-safe.webp');
    assert.equal(manifest.home.rooms.rainy, 'home/room-v3-rainy-safe.webp');
    assert.equal(manifest.home.rooms.party, 'home/room-v3-party-safe.webp');
    assert.equal(manifest.careScenes.feed.prop, 'home/prop-v3-meal-table.webp');
    assert.equal(manifest.careScenes.sleep.prop, 'home/prop-v3-bed.webp');
    assert.equal(manifest.careScenes.bath.prop, 'home/prop-v3-wash-stand.webp');
    assert.equal(manifest.careScenes.play.prop, 'home/prop-v3-toy-shelf.webp');
    assert.equal(manifest.careScenes.comfort.prop, 'home/prop-v3-comfort-cushion.webp');
    assert.equal(manifest.home.runtimeCharacter, 'home/yoyo-home-v7-room-palette.webp');
    for (const scene of ['feed', 'sleep', 'bath', 'play', 'comfort']) {
      assert.equal(manifest.careScenes[scene].status, 'native-room-zone');
    }
    assert.equal(manifest.specialActions.watchAnime.timeline, 'effects/watch-anime-final/timeline.json');
  });

  test('classifies current assets with the approved status taxonomy', () => {
    const status = readJson(statusPath);
    const allowed = new Set(['keep', 'redraw', 'remove', 'experimental', 'archive']);

    assert.equal(status.version, 1);
    assert.ok(status.generatedFrom.includes('Yoyo Asset System Refactor Design'));
    assert.ok(status.assets.length >= 24);

    for (const entry of status.assets) {
      assert.ok(allowed.has(entry.status), `${entry.path} uses invalid status ${entry.status}`);
      assert.equal(typeof entry.reason, 'string');
      assert.ok(entry.reason.length > 0, `${entry.path} needs a reason`);
    }

    const byPath = new Map(status.assets.map((entry) => [entry.path, entry]));
    assert.equal(byPath.get('spritesheet.webp').status, 'keep');
    assert.equal(byPath.get('pet.json').status, 'keep');
    assert.equal(byPath.get('desktop-rig/').status, 'experimental');
    assert.equal(byPath.get('live2d/').status, 'experimental');
    assert.equal(byPath.get('home/room-stage-v2.webp').status, 'redraw');
    assert.equal(byPath.get('home/prop-food.webp').status, 'keep');
    assert.equal(byPath.get('home/prop-food-back.webp').status, 'keep');
    assert.equal(byPath.get('home/prop-food-front.webp').status, 'keep');
  });

  test('audit script validates manifest and writes a QA report', () => {
    const output = execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts/audit-yoyo-asset-pack.js'), '--check', '--write-report'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    assert.match(output, /Yoyo asset pack audit passed/u);
    assert.ok(existsSync(reportPath), 'QA report should be written');

    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /# Yoyo Asset Pack QA Report/u);
    assert.match(report, /Golden Asset Set V1/u);
    assert.match(report, /Status Summary/u);
    assert.match(report, /Companion Semantics Watchlist/u);
  });

  test('audit script writes a full inventory with status coverage for active assets', () => {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts/audit-yoyo-asset-pack.js'), '--check', '--write-report'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    assert.ok(existsSync(inventoryPath), 'asset inventory should be written');

    const inventory = readJson(inventoryPath);
    assert.equal(inventory.pack, 'yoyo');
    assert.ok(inventory.assets.length >= 40, 'inventory should cover the current Yoyo asset tree');
    assert.deepEqual(inventory.uncovered, []);

    const byPath = new Map(inventory.assets.map((entry) => [entry.path, entry]));
    assert.equal(byPath.get('home/room-stage-v2.webp').status, 'redraw');
    assert.equal(byPath.get('home/prop-bed.webp').status, 'keep');
    assert.equal(byPath.get('effects/clone-heart/timeline.json').status, 'experimental');
    assert.equal(byPath.get('desktop-rig/v1/manifest.json').status, 'experimental');
  });

  test('audit script writes a redraw production queue with generated briefs', () => {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts/audit-yoyo-asset-pack.js'), '--check', '--write-report'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    assert.ok(existsSync(redrawQueuePath), 'redraw queue should be written');

    const queue = readJson(redrawQueuePath);
    assert.equal(queue.pack, 'yoyo');
    assert.equal(queue.total, 5);
    assert.equal(queue.items.length, 5);
    assert.equal(
      queue.items.some((item) => item.path === 'home/prop-food.webp'),
      false,
      'accepted food prop should not remain queued for redraw',
    );

    for (const item of queue.items) {
      assert.equal(item.status, 'queued');
      assert.ok(['high', 'medium'].includes(item.priority), `${item.path} needs a production priority`);
      assert.ok(['room', 'composite', 'prop'].includes(item.kind), `${item.path} needs an asset kind`);
      assert.ok(item.briefPath.startsWith('qa/redraw-briefs/'), `${item.path} needs a generated brief path`);
      assert.ok(item.acceptance.length >= 4, `${item.path} needs concrete acceptance checks`);
      assert.ok(item.acceptance.some((rule) => /human-like companion/u.test(rule)));
      assert.ok(existsSync(join(repoRoot, 'assets/yoyo', item.briefPath)), `${item.path} brief should exist`);
    }

    const roomItem = queue.items.find((item) => item.path === 'home/room-stage-v2.webp');
    assert.equal(roomItem.kind, 'room');
    assert.equal(roomItem.priority, 'high');

    const roomBrief = readFileSync(join(repoRoot, 'assets/yoyo', roomItem.briefPath), 'utf8');
    assert.match(roomBrief, /human-like companion/u);
    assert.match(roomBrief, /dog bowl/u);
    assert.match(roomBrief, /paw motif/u);

    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Redraw Production Queue/u);
    assert.match(report, /qa\/redraw-briefs\/home-room-stage-v2\.md/u);
  });

  test('audit script writes a candidate registry for found and generated redraw material', () => {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'scripts/audit-yoyo-asset-pack.js'), '--check', '--write-report'],
      { cwd: repoRoot, encoding: 'utf8' },
    );

    assert.ok(existsSync(candidateRegistryPath), 'candidate registry should be written');

    const registry = readJson(candidateRegistryPath);
    assert.equal(registry.pack, 'yoyo');
    assert.ok(registry.items.length >= 5);

    const byTarget = new Map(registry.items.map((item) => [item.targetPath, item]));
    const dayRoom = byTarget.get('home/room-stage-v2.webp');
    assert.ok(dayRoom.candidates.some((candidate) => candidate.disposition === 'v1-vibe'));
    assert.ok(dayRoom.candidates.some((candidate) => candidate.path === 'assets/yoyo/qa/candidates/home-room-stage-v2-candidate-01.webp'));
    assert.ok(dayRoom.candidates.every((candidate) => candidate.exists), 'day room candidates should exist');

    const nightRoom = byTarget.get('home/room-stage-night.webp');
    assert.ok(nightRoom.candidates.some((candidate) => candidate.path === 'assets-src/yoyo/home/ai/yoyo-room-night.png'));
    assert.ok(nightRoom.candidates.some((candidate) => candidate.path === 'assets-src/yoyo/home/aseprite/yoyo-home-room-night.png'));

    assert.equal(byTarget.has('home/prop-food.webp'), false, 'accepted food prop should leave the redraw candidate registry');

    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Candidate Registry/u);
    assert.match(report, /v1-vibe/u);
  });
});
