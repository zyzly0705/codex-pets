# Yoyo Asset System Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production asset-pack foundation for Yoyo: manifest, status metadata, audit script, QA report, and regression tests without breaking the current runtime.

**Architecture:** Keep the current Electron/Pixi runtime paths intact and add an asset-pack layer beside them. A checked-in manifest describes accepted runtime assets, a status file classifies active/experimental/redraw/archive material, and a Node audit script validates paths, image dimensions, taxonomy, and QA report generation.

**Tech Stack:** Node.js ES modules, `node:test`, built-in `fs/path/child_process`, existing `sips` on macOS for image dimension verification through the audit script.

---

### Task 1: Asset Pack Contract Tests

**Files:**
- Create: `tests/yoyo-asset-pack.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
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

    assert.equal(manifest.home.rooms.day, 'home/room-stage-v2.webp');
    assert.equal(manifest.home.rooms.night, 'home/room-stage-night.webp');
    assert.equal(manifest.careScenes.feed.composite, 'home/composite-feed-table-yoyo.webp');
    assert.equal(manifest.careScenes.sleep.composite, 'home/composite-sleep-bed-yoyo.webp');
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
    assert.equal(byPath.get('home/prop-food.webp').status, 'redraw');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/yoyo-asset-pack.test.mjs`

Expected: FAIL because `assets/yoyo/pack-manifest.json`, `assets/yoyo/asset-status.json`, and `scripts/audit-yoyo-asset-pack.js` do not exist yet.

### Task 2: Pack Manifest And Status Metadata

**Files:**
- Create: `assets/yoyo/pack-manifest.json`
- Create: `assets/yoyo/asset-status.json`

- [ ] **Step 1: Add pack manifest**

Create `assets/yoyo/pack-manifest.json` with Yoyo identity, semantics, avatar golden actions, home room assets, care scene assets, special action timelines, and QA targets.

- [ ] **Step 2: Add status metadata**

Create `assets/yoyo/asset-status.json` with version, design source, allowed status taxonomy, and current Yoyo asset classifications. Mark runtime essentials as `keep`, room/pet-semantics conflicts as `redraw`, future rig systems as `experimental`, and historical backups as `archive`.

- [ ] **Step 3: Run test again**

Run: `node --test tests/yoyo-asset-pack.test.mjs`

Expected: FAIL because the audit script is still missing.

### Task 3: Audit Script And QA Report

**Files:**
- Create: `scripts/audit-yoyo-asset-pack.js`
- Generate: `assets/yoyo/qa/asset-pack-report.md`

- [ ] **Step 1: Implement audit script**

The script must:

- load `assets/yoyo/pack-manifest.json`
- load `assets/yoyo/asset-status.json`
- validate manifest paths under `assets/yoyo`
- validate golden action names against `assets/yoyo/pet.json` states
- validate status taxonomy and reasons
- validate selected image dimensions using `sips`
- write `assets/yoyo/qa/asset-pack-report.md` when `--write-report` is passed
- exit non-zero when `--check` finds errors

- [ ] **Step 2: Run focused test**

Run: `node --test tests/yoyo-asset-pack.test.mjs`

Expected: PASS.

### Task 4: Wire Audit Into Package Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add script**

Add:

```json
"audit:asset-pack": "node scripts/audit-yoyo-asset-pack.js --check --write-report"
```

- [ ] **Step 2: Verify command**

Run: `npm run audit:asset-pack`

Expected: PASS and report written.

### Task 5: Verification

**Files:**
- Existing tests and scripts only.

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
node --test tests/yoyo-asset-pack.test.mjs tests/yoyo-asset-workflow.test.mjs tests/home-scene-assets.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks for changed script**

Run:

```bash
node --check scripts/audit-yoyo-asset-pack.js
```

Expected: PASS.

- [ ] **Step 3: Inspect generated result**

Open `assets/yoyo/qa/asset-pack-report.md` and confirm it summarizes golden assets, status counts, redraw items, experimental items, and companion-semantics risks.

## Self-Review

This plan covers the first implementation scope from the design document: inventory/status metadata, a new pack manifest, validation, and a QA report. Runtime loader changes are intentionally deferred until the manifest and status layer are proven. There are no placeholder steps; each task has concrete files, commands, and expected results.
