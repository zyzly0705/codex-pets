# Yoyo V3 Full Asset Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Yoyo's visual asset system as a coherent V3 kit: rooms, props, composites, prompt records, QA evidence, and runtime wiring, while keeping the current spritesheet as a compatibility layer until a future rig migration is ready.

**Architecture:** Treat V3 as a new art kit, not a patch pile. Store editable sources, prompt packs, and generation manifests under `assets-src/yoyo/v3/`; store accepted runtime assets under existing packaged runtime folders such as `assets/yoyo/home/`; validate the kit through a dedicated audit script, `node:test`, and Electron runtime captures before switching defaults. The current `spritesheet.webp` remains the desktop avatar driver during this plan, but the plan creates a character-rig contract so Live2D/Spine/Pixi-layered migration has a clean next step.

**Tech Stack:** Electron renderer, Pixi spritesheet compatibility, plain JavaScript, Node.js `node:test`, Sharp for image metadata and alpha validation, built-in `image_gen` for bitmap generation, local chroma-key removal helper for transparent props, existing `npm run capture:home`, `npm run audit:asset-pack`, `npm test`, and `npm run check`.

---

## File Structure

- Create `assets-src/yoyo/v3/style-guide.json`: canonical V3 visual rules, avoid list, camera, palette, and asset dimensions.
- Create `assets-src/yoyo/v3/prompt-pack.json`: exact prompts for room, prop, composite, and character-rig source generation.
- Create `assets-src/yoyo/v3/manifest.json`: source-to-runtime mapping for every accepted V3 asset.
- Create `assets-src/yoyo/v3/rooms/`: generated source PNGs for day, night, rainy, and party rooms.
- Create `assets-src/yoyo/v3/props/`: source PNGs with alpha for V3 props.
- Create `assets-src/yoyo/v3/composites/`: source PNGs for care/action composites.
- Create `assets-src/yoyo/v3/character-rig/rig-contract.json`: non-runtime V3 character rig contract.
- Create `assets/yoyo/qa/v3/`: contact sheets, runtime captures, and V3 audit report.
- Create `scripts/audit-yoyo-v3-kit.js`: validates manifest paths, dimensions, alpha, prompt coverage, and QA evidence.
- Create `tests/yoyo-v3-asset-kit.test.mjs`: tests the V3 kit contract.
- Modify `assets/yoyo/pack-manifest.json`: registers V3 rooms/props/composites and keeps spritesheet compatibility explicit.
- Modify `assets/yoyo/asset-status.json`: marks accepted V3 assets as `keep`, old conflicting assets as `archive` or `redraw`, and rig migration as `experimental`.
- Modify `scripts/audit-yoyo-asset-pack.js`: includes V3 assets in inventory and reports.
- Modify `src/shared/home-scene.js`: switches default room layout and object layers to V3 assets after validation.
- Modify `src/shared/yoyo-actions.js`: updates room scene assets to V3 defaults.
- Modify `src/home.html`: updates initial room art path.
- Modify `src/home.css`: keeps saved-art mode, removes old duplicate-shell assumptions for V3, and ensures prop slots fit.
- Modify `src/home.js`: preserves current interaction flow while reading V3 asset paths from the scene manifest.

---

### Task 1: V3 Contract Tests

**Files:**
- Create: `tests/yoyo-v3-asset-kit.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const styleGuidePath = join(repoRoot, 'assets-src/yoyo/v3/style-guide.json');
const promptPackPath = join(repoRoot, 'assets-src/yoyo/v3/prompt-pack.json');
const manifestPath = join(repoRoot, 'assets-src/yoyo/v3/manifest.json');
const runtimeManifestPath = join(repoRoot, 'assets/yoyo/pack-manifest.json');
const qaReportPath = join(repoRoot, 'assets/yoyo/qa/v3/v3-kit-report.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('Yoyo V3 full asset kit contract', () => {
  test('defines a coherent V3 style guide and prompt pack', () => {
    const styleGuide = readJson(styleGuidePath);
    const promptPack = readJson(promptPackPath);

    assert.equal(styleGuide.id, 'yoyo-v3');
    assert.equal(styleGuide.character.identity, 'human-like little-girl desktop companion');
    assert.equal(styleGuide.character.runtimeDriver, 'pixi-spritesheet-compat');
    assert.deepEqual(styleGuide.rooms.size, { width: 1080, height: 720 });
    assert.ok(styleGuide.avoid.includes('dog bowl'));
    assert.ok(styleGuide.avoid.includes('kibble'));
    assert.ok(styleGuide.avoid.includes('paw motif'));
    assert.ok(styleGuide.mustPreserve.includes('compact lively room-stage-v2 mood'));

    const promptIds = new Set(promptPack.prompts.map((prompt) => prompt.id));
    for (const id of [
      'room-v3-day',
      'room-v3-night',
      'room-v3-rainy',
      'room-v3-party',
      'prop-v3-meal-table',
      'prop-v3-bed',
      'prop-v3-wash-stand',
      'prop-v3-study-desk',
      'composite-v3-feed',
      'composite-v3-sleep',
      'character-rig-v3-source',
    ]) {
      assert.ok(promptIds.has(id), `missing prompt ${id}`);
    }
  });

  test('maps every V3 source asset to a runtime asset and QA evidence', () => {
    const manifest = readJson(manifestPath);

    assert.equal(manifest.id, 'yoyo-v3-full-asset-kit');
    assert.equal(manifest.runtimeCompatibility.avatarDriver, 'pixi-spritesheet');
    assert.equal(manifest.runtimeCompatibility.keepCurrentSpritesheet, true);
    assert.equal(manifest.rooms.length, 4);
    assert.equal(manifest.props.length, 9);
    assert.equal(manifest.composites.length, 5);

    for (const group of ['rooms', 'props', 'composites']) {
      for (const asset of manifest[group]) {
        assert.ok(asset.id.startsWith(`${group.slice(0, -1)}-v3-`) || asset.id.startsWith('composite-v3-'));
        assert.ok(asset.source.startsWith(`assets-src/yoyo/v3/`), `${asset.id} source must live in v3 sources`);
        assert.ok(asset.runtime.startsWith('assets/yoyo/home/'), `${asset.id} runtime asset must be packaged under home`);
        assert.ok(asset.qaPreview.startsWith('assets/yoyo/qa/v3/'), `${asset.id} needs V3 QA evidence`);
      }
    }
  });

  test('runtime manifest registers V3 without removing spritesheet compatibility', () => {
    const runtimeManifest = readJson(runtimeManifestPath);

    assert.equal(runtimeManifest.avatar.driver, 'pixi-spritesheet');
    assert.equal(runtimeManifest.avatar.sheet, 'spritesheet.webp');
    assert.equal(runtimeManifest.v3.active, true);
    assert.equal(runtimeManifest.v3.rooms.day, 'home/room-v3-day.webp');
    assert.equal(runtimeManifest.v3.props.feed, 'home/prop-v3-meal-table.webp');
    assert.equal(runtimeManifest.v3.composites.sleep, 'home/composite-v3-sleep-yoyo.webp');
  });

  test('V3 audit report exists after the audit command runs', () => {
    assert.ok(existsSync(qaReportPath), 'V3 QA report should be generated by scripts/audit-yoyo-v3-kit.js');
    const report = readFileSync(qaReportPath, 'utf8');
    assert.match(report, /# Yoyo V3 Full Asset Kit QA Report/u);
    assert.match(report, /Spritesheet Compatibility/u);
    assert.match(report, /Runtime Captures/u);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: FAIL because the V3 style guide, prompt pack, manifest, runtime manifest fields, and QA report do not exist yet.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add tests/yoyo-v3-asset-kit.test.mjs
git commit -m "test: define yoyo v3 asset kit contract"
```

---

### Task 2: V3 Style Guide And Prompt Pack

**Files:**
- Create: `assets-src/yoyo/v3/style-guide.json`
- Create: `assets-src/yoyo/v3/prompt-pack.json`
- Create directory: `assets-src/yoyo/v3/rooms/`
- Create directory: `assets-src/yoyo/v3/props/`
- Create directory: `assets-src/yoyo/v3/composites/`
- Create directory: `assets-src/yoyo/v3/character-rig/`

- [ ] **Step 1: Add the V3 style guide**

Create `assets-src/yoyo/v3/style-guide.json`:

```json
{
  "id": "yoyo-v3",
  "date": "2026-05-29",
  "character": {
    "identity": "human-like little-girl desktop companion",
    "runtimeDriver": "pixi-spritesheet-compat",
    "description": "Yoyo is a small chibi human companion with straight black bangs, a small top bun, navy-and-red outfit language, soft friendly face, and clean 2D proportions."
  },
  "style": {
    "name": "compact lively clean-2d chibi room",
    "rendering": "polished clean 2D illustration with soft painterly pixel-like detail, readable at desktop-pet scale",
    "camera": "front-facing 2.5D room stage, fixed 1080x720 composition",
    "lighting": "warm, cozy, bright, high-energy, no cinematic darkness",
    "palette": ["mint teal wall", "warm honey wood", "soft pink accents", "cream rug", "small golden lights"]
  },
  "rooms": {
    "size": { "width": 1080, "height": 720 },
    "safeZone": {
      "centerRug": "clear floor/rug space for Yoyo between x=380..680 and y=430..650",
      "rightControls": "avoid critical detail in the lower-right 170x210 UI zone",
      "leftButtons": "avoid critical detail in the upper-left 110x110 and lower-left 110x110 UI zones"
    }
  },
  "props": {
    "background": "transparent PNG/WebP after chroma-key removal",
    "maxWidth": 360,
    "maxHeight": 260,
    "shadow": "soft painted contact shadow only when embedded in composite, no shadow in transparent prop source"
  },
  "mustPreserve": [
    "compact lively room-stage-v2 mood",
    "cozy shelves and plants",
    "large usable center rug",
    "desktop-pet stage readability",
    "Yoyo as a human companion"
  ],
  "avoid": [
    "dog bowl",
    "kibble",
    "paw motif",
    "animal bed",
    "animal ears",
    "tail",
    "pet kennel",
    "large realistic full-room interior",
    "empty quiet hotel room",
    "dark blurred stock-art atmosphere"
  ]
}
```

- [ ] **Step 2: Add the V3 prompt pack**

Create `assets-src/yoyo/v3/prompt-pack.json` with this structure:

```json
{
  "id": "yoyo-v3-prompt-pack",
  "generator": "built-in image_gen",
  "sourceReferences": [
    "assets/yoyo/home/room-stage-v2.webp",
    "assets/yoyo/qa/candidates/existing-runtime-rooms-contact.png",
    "assets-src/yoyo/reference/style/yoyo-style-board.png",
    "assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v2-alpha.png"
  ],
  "sharedNegativePrompt": "No dog bowl, no kibble, no paw motif, no animal bed, no animal ears, no tail, no kennel, no pet-store props, no large realistic room, no dark stock-art mood, no text, no watermark.",
  "prompts": [
    {
      "id": "room-v3-day",
      "type": "room",
      "runtime": "assets/yoyo/home/room-v3-day.webp",
      "prompt": "Create a 1080x720 compact lively clean-2D chibi desktop companion room for Yoyo. Preserve the warm busy energy of the existing room-stage-v2 reference: mint teal wall, honey wood floor, pink curtains, cozy shelves, plants, small golden lights, large cream center rug, and a tight desktop-pet stage feeling. Make it a human little-girl companion room, not an animal pet room. Include a small human meal table area, child bed/sofa area, study shelf, toy area, and warm lamp details. Keep the center rug clear for Yoyo. No dog bowl, kibble, paw motif, animal bed, animal ears, tail, kennel, text, or watermark."
    },
    {
      "id": "room-v3-night",
      "type": "room",
      "runtime": "assets/yoyo/home/room-v3-night.webp",
      "prompt": "Create a 1080x720 night variant of the Yoyo V3 compact lively clean-2D chibi room. Same layout, same object positions, same scale, with moonlit window, warm bedside lamp, soft shelf glow, and cozy sleep mood. Preserve the lively compact desktop-pet stage, not a large room. Human companion room only. No dog bowl, kibble, paw motif, animal bed, animal ears, tail, kennel, text, or watermark."
    },
    {
      "id": "room-v3-rainy",
      "type": "room",
      "runtime": "assets/yoyo/home/room-v3-rainy.webp",
      "prompt": "Create a 1080x720 rainy-day variant of the Yoyo V3 compact lively clean-2D chibi room. Same layout, same object positions, same scale, with rain visible outside the window, cozy indoor warm lights, plants, shelves, and a clear center rug. Human little-girl companion room only. No dog bowl, kibble, paw motif, animal bed, animal ears, tail, kennel, text, or watermark."
    },
    {
      "id": "room-v3-party",
      "type": "room",
      "runtime": "assets/yoyo/home/room-v3-party.webp",
      "prompt": "Create a 1080x720 cheerful party variant of the Yoyo V3 compact lively clean-2D chibi room. Same layout, same object positions, same scale, with balloons, bunting, tiny wrapped gifts, soft confetti, and a festive but readable desktop-pet stage. Human companion birthday-room feeling, not animal pet party props. No dog bowl, kibble, paw motif, animal bed, animal ears, tail, kennel, text, or watermark."
    },
    {
      "id": "prop-v3-meal-table",
      "type": "transparent-prop",
      "runtime": "assets/yoyo/home/prop-v3-meal-table.webp",
      "prompt": "Create a clean-2D chibi transparent prop source on a perfectly flat #00ff00 chroma-key background: a small low human meal table for Yoyo, with rice bowl, omelet, fruit, spoon, cup, and a soft pink tablecloth. The table must read as human food, not pet food. No dog bowl, no kibble, no paw motifs. Subject only, generous padding, no cast shadow, no text, no watermark."
    },
    {
      "id": "prop-v3-bed",
      "type": "transparent-prop",
      "runtime": "assets/yoyo/home/prop-v3-bed.webp",
      "prompt": "Create a clean-2D chibi transparent prop source on a perfectly flat #00ff00 chroma-key background: a small childlike cozy bed or daybed for Yoyo with pink blanket, star pillow, and rounded wooden frame. It must read as a human child's cozy resting place, not an animal bed. No paw motifs. Subject only, generous padding, no cast shadow, no text, no watermark."
    },
    {
      "id": "prop-v3-wash-stand",
      "type": "transparent-prop",
      "runtime": "assets/yoyo/home/prop-v3-wash-stand.webp",
      "prompt": "Create a clean-2D chibi transparent prop source on a perfectly flat #00ff00 chroma-key background: a small wash stand for Yoyo with basin, towel, bubbles, tiny bath items, and warm home style. It should feel like washing up for a human little companion, not pet grooming. Subject only, generous padding, no cast shadow, no text, no watermark."
    },
    {
      "id": "prop-v3-study-desk",
      "type": "transparent-prop",
      "runtime": "assets/yoyo/home/prop-v3-study-desk.webp",
      "prompt": "Create a clean-2D chibi transparent prop source on a perfectly flat #00ff00 chroma-key background: a tiny study desk with open book, pencil, lamp, notebook, and cozy wood details for Yoyo. Human companion learning scene. Subject only, generous padding, no cast shadow, no text, no watermark."
    },
    {
      "id": "composite-v3-feed",
      "type": "composite",
      "runtime": "assets/yoyo/home/composite-v3-feed-yoyo.webp",
      "prompt": "Create a clean-2D chibi composite scene on transparent background style using Yoyo beside a small human meal table. Yoyo is a human little-girl desktop companion with black straight bangs, small top bun, navy-and-red outfit, and happy eating expression. She stands beside the table, not on it. Human meal tray, rice, fruit, egg, cup. No dog bowl, kibble, paw motif, animal ears, tail, text, or watermark."
    },
    {
      "id": "composite-v3-sleep",
      "type": "composite",
      "runtime": "assets/yoyo/home/composite-v3-sleep-yoyo.webp",
      "prompt": "Create a clean-2D chibi composite scene of Yoyo sleeping in a cozy human childlike bed/daybed. Yoyo keeps black bangs, small top bun, navy-and-red outfit language, soft face, and peaceful sleeping expression. Warm blanket and star pillow. No animal bed, no paw motif, no animal ears, no tail, no text, no watermark."
    },
    {
      "id": "character-rig-v3-source",
      "type": "character-rig-source",
      "runtime": "assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png",
      "prompt": "Create a clean front-facing source image of Yoyo for future layered rig extraction. Full body, neutral standing pose, arms slightly separated from torso, legs visible, clean edges, black straight bangs, small top bun, navy vest and skirt, white shirt, red bow, soft friendly face. Plain light background, no props, no text, no watermark."
    }
  ]
}
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: FAIL moves forward: style guide and prompt pack assertions pass, but `assets-src/yoyo/v3/manifest.json`, runtime manifest V3 fields, and QA report still fail.

- [ ] **Step 4: Commit the V3 art contract**

```bash
git add assets-src/yoyo/v3/style-guide.json assets-src/yoyo/v3/prompt-pack.json
git commit -m "docs: add yoyo v3 style guide and prompt pack"
```

---

### Task 3: Generation Manifest And Folder Contract

**Files:**
- Create: `assets-src/yoyo/v3/manifest.json`
- Create: `assets/yoyo/qa/v3/README.md`

- [ ] **Step 1: Add the source-to-runtime manifest**

Create `assets-src/yoyo/v3/manifest.json`:

```json
{
  "id": "yoyo-v3-full-asset-kit",
  "date": "2026-05-29",
  "runtimeCompatibility": {
    "avatarDriver": "pixi-spritesheet",
    "keepCurrentSpritesheet": true,
    "nextCharacterDriver": "pixi-layered-rig"
  },
  "rooms": [
    {
      "id": "room-v3-day",
      "source": "assets-src/yoyo/v3/rooms/room-v3-day.png",
      "runtime": "assets/yoyo/home/room-v3-day.webp",
      "qaPreview": "assets/yoyo/qa/v3/room-v3-day-runtime.png",
      "width": 1080,
      "height": 720
    },
    {
      "id": "room-v3-night",
      "source": "assets-src/yoyo/v3/rooms/room-v3-night.png",
      "runtime": "assets/yoyo/home/room-v3-night.webp",
      "qaPreview": "assets/yoyo/qa/v3/room-v3-night-runtime.png",
      "width": 1080,
      "height": 720
    },
    {
      "id": "room-v3-rainy",
      "source": "assets-src/yoyo/v3/rooms/room-v3-rainy.png",
      "runtime": "assets/yoyo/home/room-v3-rainy.webp",
      "qaPreview": "assets/yoyo/qa/v3/room-v3-rainy-runtime.png",
      "width": 1080,
      "height": 720
    },
    {
      "id": "room-v3-party",
      "source": "assets-src/yoyo/v3/rooms/room-v3-party.png",
      "runtime": "assets/yoyo/home/room-v3-party.webp",
      "qaPreview": "assets/yoyo/qa/v3/room-v3-party-runtime.png",
      "width": 1080,
      "height": 720
    }
  ],
  "props": [
    { "id": "prop-v3-meal-table", "source": "assets-src/yoyo/v3/props/prop-v3-meal-table.png", "runtime": "assets/yoyo/home/prop-v3-meal-table.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-meal-table.png", "width": 210, "height": 150, "transparent": true },
    { "id": "prop-v3-bed", "source": "assets-src/yoyo/v3/props/prop-v3-bed.png", "runtime": "assets/yoyo/home/prop-v3-bed.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-bed.png", "width": 360, "height": 260, "transparent": true },
    { "id": "prop-v3-wash-stand", "source": "assets-src/yoyo/v3/props/prop-v3-wash-stand.png", "runtime": "assets/yoyo/home/prop-v3-wash-stand.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-wash-stand.png", "width": 260, "height": 220, "transparent": true },
    { "id": "prop-v3-toy-shelf", "source": "assets-src/yoyo/v3/props/prop-v3-toy-shelf.png", "runtime": "assets/yoyo/home/prop-v3-toy-shelf.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-toy-shelf.png", "width": 260, "height": 220, "transparent": true },
    { "id": "prop-v3-comfort-cushion", "source": "assets-src/yoyo/v3/props/prop-v3-comfort-cushion.png", "runtime": "assets/yoyo/home/prop-v3-comfort-cushion.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-comfort-cushion.png", "width": 260, "height": 180, "transparent": true },
    { "id": "prop-v3-media-screen", "source": "assets-src/yoyo/v3/props/prop-v3-media-screen.png", "runtime": "assets/yoyo/home/prop-v3-media-screen.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-media-screen.png", "width": 300, "height": 220, "transparent": true },
    { "id": "prop-v3-game-console", "source": "assets-src/yoyo/v3/props/prop-v3-game-console.png", "runtime": "assets/yoyo/home/prop-v3-game-console.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-game-console.png", "width": 220, "height": 160, "transparent": true },
    { "id": "prop-v3-blocks", "source": "assets-src/yoyo/v3/props/prop-v3-blocks.png", "runtime": "assets/yoyo/home/prop-v3-blocks.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-blocks.png", "width": 220, "height": 170, "transparent": true },
    { "id": "prop-v3-study-desk", "source": "assets-src/yoyo/v3/props/prop-v3-study-desk.png", "runtime": "assets/yoyo/home/prop-v3-study-desk.webp", "qaPreview": "assets/yoyo/qa/v3/prop-v3-study-desk.png", "width": 300, "height": 230, "transparent": true }
  ],
  "composites": [
    { "id": "composite-v3-feed", "source": "assets-src/yoyo/v3/composites/composite-v3-feed-yoyo.png", "runtime": "assets/yoyo/home/composite-v3-feed-yoyo.webp", "qaPreview": "assets/yoyo/qa/v3/composite-v3-feed-yoyo.png", "width": 360, "height": 260, "transparent": true },
    { "id": "composite-v3-sleep", "source": "assets-src/yoyo/v3/composites/composite-v3-sleep-yoyo.png", "runtime": "assets/yoyo/home/composite-v3-sleep-yoyo.webp", "qaPreview": "assets/yoyo/qa/v3/composite-v3-sleep-yoyo.png", "width": 440, "height": 344, "transparent": true },
    { "id": "composite-v3-bath", "source": "assets-src/yoyo/v3/composites/composite-v3-bath-yoyo.png", "runtime": "assets/yoyo/home/composite-v3-bath-yoyo.webp", "qaPreview": "assets/yoyo/qa/v3/composite-v3-bath-yoyo.png", "width": 390, "height": 300, "transparent": true },
    { "id": "composite-v3-play", "source": "assets-src/yoyo/v3/composites/composite-v3-play-yoyo.png", "runtime": "assets/yoyo/home/composite-v3-play-yoyo.webp", "qaPreview": "assets/yoyo/qa/v3/composite-v3-play-yoyo.png", "width": 390, "height": 300, "transparent": true },
    { "id": "composite-v3-comfort", "source": "assets-src/yoyo/v3/composites/composite-v3-comfort-yoyo.png", "runtime": "assets/yoyo/home/composite-v3-comfort-yoyo.webp", "qaPreview": "assets/yoyo/qa/v3/composite-v3-comfort-yoyo.png", "width": 360, "height": 260, "transparent": true }
  ],
  "characterRig": {
    "contract": "assets-src/yoyo/v3/character-rig/rig-contract.json",
    "source": "assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png",
    "runtimeStatus": "experimental"
  }
}
```

- [ ] **Step 2: Add the QA folder note**

Create `assets/yoyo/qa/v3/README.md`:

```markdown
# Yoyo V3 QA Evidence

This folder stores evidence for the full V3 asset rebuild:

- generated contact sheets
- runtime home captures
- prop alpha previews
- audit reports
- rejected or superseded candidate notes when useful

An asset is not accepted into the V3 runtime set until it has a source path, runtime path, manifest entry, and QA evidence path.
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: FAIL moves forward: manifest mapping assertions pass, runtime manifest and QA report still fail.

- [ ] **Step 4: Commit the manifest contract**

```bash
git add assets-src/yoyo/v3/manifest.json assets/yoyo/qa/v3/README.md
git commit -m "docs: define yoyo v3 generation manifest"
```

---

### Task 4: V3 Audit Script

**Files:**
- Create: `scripts/audit-yoyo-v3-kit.js`
- Generate: `assets/yoyo/qa/v3/v3-kit-report.md`
- Modify: `package.json`

- [ ] **Step 1: Write the audit script**

Create `scripts/audit-yoyo-v3-kit.js`:

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const styleGuidePath = path.join(repoRoot, 'assets-src/yoyo/v3/style-guide.json');
const promptPackPath = path.join(repoRoot, 'assets-src/yoyo/v3/prompt-pack.json');
const manifestPath = path.join(repoRoot, 'assets-src/yoyo/v3/manifest.json');
const reportPath = path.join(repoRoot, 'assets/yoyo/qa/v3/v3-kit-report.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

async function imageMetadata(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) return null;
  return sharp(absPath).metadata();
}

async function hasTransparentCorners(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) return false;
  const image = sharp(absPath).ensureAlpha();
  const meta = await image.metadata();
  const samples = [
    { left: 0, top: 0 },
    { left: Math.max(0, meta.width - 1), top: 0 },
    { left: 0, top: Math.max(0, meta.height - 1) },
    { left: Math.max(0, meta.width - 1), top: Math.max(0, meta.height - 1) },
  ];
  for (const sample of samples) {
    const pixel = await image
      .clone()
      .extract({ ...sample, width: 1, height: 1 })
      .raw()
      .toBuffer();
    if (pixel[3] > 8) return false;
  }
  return true;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const writeReport = args.has('--write-report');
  const errors = [];
  const warnings = [];

  for (const filePath of [styleGuidePath, promptPackPath, manifestPath]) {
    if (!fs.existsSync(filePath)) errors.push(`Missing ${path.relative(repoRoot, filePath)}`);
  }

  const styleGuide = fs.existsSync(styleGuidePath) ? readJson(styleGuidePath) : null;
  const promptPack = fs.existsSync(promptPackPath) ? readJson(promptPackPath) : null;
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;

  if (styleGuide && !styleGuide.avoid.includes('dog bowl')) {
    errors.push('style-guide avoid list must include dog bowl');
  }

  if (promptPack && manifest) {
    const promptIds = new Set(promptPack.prompts.map((prompt) => prompt.id));
    for (const item of [...manifest.rooms, ...manifest.props, ...manifest.composites]) {
      if (!promptIds.has(item.id)) errors.push(`Missing prompt for ${item.id}`);
    }
  }

  const accepted = manifest ? [...manifest.rooms, ...manifest.props, ...manifest.composites] : [];
  for (const item of accepted) {
    if (!exists(item.source)) warnings.push(`Source not generated yet: ${item.source}`);
    if (!exists(item.runtime)) warnings.push(`Runtime not generated yet: ${item.runtime}`);
    if (!exists(item.qaPreview)) warnings.push(`QA preview not generated yet: ${item.qaPreview}`);

    const runtimeMeta = await imageMetadata(item.runtime);
    if (runtimeMeta) {
      if (item.width && runtimeMeta.width !== item.width) errors.push(`${item.runtime} width ${runtimeMeta.width} != ${item.width}`);
      if (item.height && runtimeMeta.height !== item.height) errors.push(`${item.runtime} height ${runtimeMeta.height} != ${item.height}`);
      if (item.transparent && !(await hasTransparentCorners(item.runtime))) {
        errors.push(`${item.runtime} should have transparent corners`);
      }
    }
  }

  if (writeReport) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, [
      '# Yoyo V3 Full Asset Kit QA Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Spritesheet Compatibility',
      '',
      manifest?.runtimeCompatibility?.keepCurrentSpritesheet
        ? '- Current `assets/yoyo/spritesheet.webp` remains the active avatar driver.'
        : '- V3 manifest does not preserve spritesheet compatibility.',
      '',
      '## Asset Coverage',
      '',
      `- Rooms: ${manifest?.rooms?.length || 0}`,
      `- Props: ${manifest?.props?.length || 0}`,
      `- Composites: ${manifest?.composites?.length || 0}`,
      '',
      '## Runtime Captures',
      '',
      '- `assets/yoyo/qa/v3/home-v3-day-runtime.png`',
      '- `assets/yoyo/qa/v3/home-v3-feed-runtime.png`',
      '- `assets/yoyo/qa/v3/home-v3-night-runtime.png`',
      '',
      '## Warnings',
      '',
      ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None']),
      '',
      '## Errors',
      '',
      ...(errors.length ? errors.map((error) => `- ${error}`) : ['- None']),
      '',
    ].join('\n'));
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    if (check) process.exit(1);
  }

  console.log('Yoyo V3 kit audit passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package script**

Modify `package.json` scripts:

```json
"audit:yoyo-v3": "node scripts/audit-yoyo-v3-kit.js --check --write-report"
```

- [ ] **Step 3: Run the audit before assets exist**

Run:

```bash
npm run audit:yoyo-v3
```

Expected: PASS if only warnings are missing generated image files. The audit should write `assets/yoyo/qa/v3/v3-kit-report.md`.

- [ ] **Step 4: Run the focused test**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: FAIL moves forward: QA report exists, runtime manifest V3 fields still fail.

- [ ] **Step 5: Commit the audit layer**

```bash
git add scripts/audit-yoyo-v3-kit.js package.json assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "feat: add yoyo v3 asset kit audit"
```

---

### Task 5: Generate Room Kit V3

**Files:**
- Generate: `assets-src/yoyo/v3/rooms/room-v3-day.png`
- Generate: `assets-src/yoyo/v3/rooms/room-v3-night.png`
- Generate: `assets-src/yoyo/v3/rooms/room-v3-rainy.png`
- Generate: `assets-src/yoyo/v3/rooms/room-v3-party.png`
- Generate: `assets/yoyo/home/room-v3-day.webp`
- Generate: `assets/yoyo/home/room-v3-night.webp`
- Generate: `assets/yoyo/home/room-v3-rainy.webp`
- Generate: `assets/yoyo/home/room-v3-party.webp`
- Generate: `assets/yoyo/qa/v3/rooms-contact-sheet.png`

- [ ] **Step 1: Generate the day room**

Use built-in `image_gen` with prompt id `room-v3-day` from `assets-src/yoyo/v3/prompt-pack.json`. Treat `assets/yoyo/home/room-stage-v2.webp` and `assets/yoyo/qa/candidates/existing-runtime-rooms-contact.png` as visual references.

Save the selected generated source image to:

```text
assets-src/yoyo/v3/rooms/room-v3-day.png
```

- [ ] **Step 2: Generate the night, rainy, and party rooms**

Use built-in `image_gen` once per prompt id:

```text
room-v3-night
room-v3-rainy
room-v3-party
```

Save selected source images to:

```text
assets-src/yoyo/v3/rooms/room-v3-night.png
assets-src/yoyo/v3/rooms/room-v3-rainy.png
assets-src/yoyo/v3/rooms/room-v3-party.png
```

- [ ] **Step 3: Export runtime WebP room files**

Run:

```bash
node - <<'NODE'
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const items = [
  ['assets-src/yoyo/v3/rooms/room-v3-day.png', 'assets/yoyo/home/room-v3-day.webp'],
  ['assets-src/yoyo/v3/rooms/room-v3-night.png', 'assets/yoyo/home/room-v3-night.webp'],
  ['assets-src/yoyo/v3/rooms/room-v3-rainy.png', 'assets/yoyo/home/room-v3-rainy.webp'],
  ['assets-src/yoyo/v3/rooms/room-v3-party.png', 'assets/yoyo/home/room-v3-party.webp'],
];
(async () => {
  for (const [src, out] of items) {
    await sharp(path.join(repo, src))
      .resize(1080, 720, { fit: 'cover', position: 'center' })
      .webp({ quality: 92 })
      .toFile(path.join(repo, out));
  }
})();
NODE
```

Expected: four `room-v3-*.webp` files exist at `1080x720`.

- [ ] **Step 4: Create a room contact sheet**

Run:

```bash
node - <<'NODE'
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const files = [
  'assets/yoyo/home/room-v3-day.webp',
  'assets/yoyo/home/room-v3-night.webp',
  'assets/yoyo/home/room-v3-rainy.webp',
  'assets/yoyo/home/room-v3-party.webp',
];
(async () => {
  const thumbs = await Promise.all(files.map((file) => sharp(path.join(repo, file)).resize(360, 240).toBuffer()));
  await sharp({
    create: { width: 720, height: 480, channels: 4, background: '#f6eedf' },
  })
    .composite(thumbs.map((input, index) => ({
      input,
      left: (index % 2) * 360,
      top: Math.floor(index / 2) * 240,
    })))
    .png()
    .toFile(path.join(repo, 'assets/yoyo/qa/v3/rooms-contact-sheet.png'));
})();
NODE
```

- [ ] **Step 5: Run audit**

Run:

```bash
npm run audit:yoyo-v3
```

Expected: PASS. Room-related missing-runtime warnings disappear.

- [ ] **Step 6: Commit the room kit**

```bash
git add assets-src/yoyo/v3/rooms assets/yoyo/home/room-v3-*.webp assets/yoyo/qa/v3/rooms-contact-sheet.png assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "feat: add yoyo v3 room kit"
```

---

### Task 6: Generate Transparent Prop Kit V3

**Files:**
- Generate source/runtime pairs for all nine prop entries in `assets-src/yoyo/v3/manifest.json`
- Generate: `assets/yoyo/qa/v3/props-contact-sheet.png`

- [ ] **Step 1: Generate chroma-key prop sources**

Use built-in `image_gen` once per prompt id:

```text
prop-v3-meal-table
prop-v3-bed
prop-v3-wash-stand
prop-v3-toy-shelf
prop-v3-comfort-cushion
prop-v3-media-screen
prop-v3-game-console
prop-v3-blocks
prop-v3-study-desk
```

Each generated source must use a perfectly flat `#00ff00` background. Save raw generated images under:

```text
assets-src/yoyo/v3/props/raw/<prompt-id>-raw.png
```

- [ ] **Step 2: Remove chroma-key backgrounds**

Run:

```bash
mkdir -p assets-src/yoyo/v3/props
for id in meal-table bed wash-stand toy-shelf comfort-cushion media-screen game-console blocks study-desk; do
  python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "assets-src/yoyo/v3/props/raw/prop-v3-${id}-raw.png" \
    --out "assets-src/yoyo/v3/props/prop-v3-${id}.png" \
    --auto-key border \
    --soft-matte \
    --transparent-threshold 12 \
    --opaque-threshold 220 \
    --despill
done
```

Expected: each output PNG has transparent corners and no green fringe.

- [ ] **Step 3: Export runtime WebP props**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  for (const item of manifest.props) {
    await sharp(path.join(repo, item.source))
      .resize(item.width, item.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 95 })
      .toFile(path.join(repo, item.runtime));
  }
})();
NODE
```

- [ ] **Step 4: Generate prop QA previews**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  for (const item of manifest.props) {
    await sharp(path.join(repo, item.runtime))
      .flatten({ background: '#f6eedf' })
      .png()
      .toFile(path.join(repo, item.qaPreview));
  }
})();
NODE
```

- [ ] **Step 5: Create a prop contact sheet**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  const thumbs = await Promise.all(manifest.props.map((item) => sharp(path.join(repo, item.qaPreview)).resize(180, 140).png().toBuffer()));
  await sharp({ create: { width: 540, height: 420, channels: 4, background: '#f6eedf' } })
    .composite(thumbs.map((input, index) => ({ input, left: (index % 3) * 180, top: Math.floor(index / 3) * 140 })))
    .png()
    .toFile(path.join(repo, 'assets/yoyo/qa/v3/props-contact-sheet.png'));
})();
NODE
```

- [ ] **Step 6: Run audit**

Run:

```bash
npm run audit:yoyo-v3
```

Expected: PASS and no prop alpha errors.

- [ ] **Step 7: Commit the prop kit**

```bash
git add assets-src/yoyo/v3/props assets/yoyo/home/prop-v3-*.webp assets/yoyo/qa/v3/prop-v3-*.png assets/yoyo/qa/v3/props-contact-sheet.png assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "feat: add yoyo v3 transparent prop kit"
```

---

### Task 7: Generate Composite Kit V3

**Files:**
- Generate source/runtime pairs for all five composite entries in `assets-src/yoyo/v3/manifest.json`
- Generate: `assets/yoyo/qa/v3/composites-contact-sheet.png`

- [ ] **Step 1: Generate composite sources**

Use built-in `image_gen` once per prompt id:

```text
composite-v3-feed
composite-v3-sleep
composite-v3-bath
composite-v3-play
composite-v3-comfort
```

Save raw generated images under:

```text
assets-src/yoyo/v3/composites/raw/<prompt-id>-raw.png
```

If the generated composite has a flat chroma-key background, remove it with the same helper from Task 6. Save final transparent source PNGs under:

```text
assets-src/yoyo/v3/composites/composite-v3-feed-yoyo.png
assets-src/yoyo/v3/composites/composite-v3-sleep-yoyo.png
assets-src/yoyo/v3/composites/composite-v3-bath-yoyo.png
assets-src/yoyo/v3/composites/composite-v3-play-yoyo.png
assets-src/yoyo/v3/composites/composite-v3-comfort-yoyo.png
```

- [ ] **Step 2: Export runtime composite WebP files**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  for (const item of manifest.composites) {
    await sharp(path.join(repo, item.source))
      .resize(item.width, item.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 95 })
      .toFile(path.join(repo, item.runtime));
  }
})();
NODE
```

- [ ] **Step 3: Generate composite QA previews**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  for (const item of manifest.composites) {
    await sharp(path.join(repo, item.runtime))
      .flatten({ background: '#f6eedf' })
      .png()
      .toFile(path.join(repo, item.qaPreview));
  }
})();
NODE
```

- [ ] **Step 4: Create composite contact sheet**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
const manifest = JSON.parse(fs.readFileSync('assets-src/yoyo/v3/manifest.json', 'utf8'));
(async () => {
  const thumbs = await Promise.all(manifest.composites.map((item) => sharp(path.join(repo, item.qaPreview)).resize(220, 170).png().toBuffer()));
  await sharp({ create: { width: 660, height: 340, channels: 4, background: '#f6eedf' } })
    .composite(thumbs.map((input, index) => ({ input, left: (index % 3) * 220, top: Math.floor(index / 3) * 170 })))
    .png()
    .toFile(path.join(repo, 'assets/yoyo/qa/v3/composites-contact-sheet.png'));
})();
NODE
```

- [ ] **Step 5: Run audit**

Run:

```bash
npm run audit:yoyo-v3
```

Expected: PASS and no composite alpha errors.

- [ ] **Step 6: Commit the composite kit**

```bash
git add assets-src/yoyo/v3/composites assets/yoyo/home/composite-v3-*.webp assets/yoyo/qa/v3/composite-v3-*.png assets/yoyo/qa/v3/composites-contact-sheet.png assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "feat: add yoyo v3 care composite kit"
```

---

### Task 8: Register V3 In The Asset Pack

**Files:**
- Modify: `assets/yoyo/pack-manifest.json`
- Modify: `assets/yoyo/asset-status.json`
- Modify: `scripts/audit-yoyo-asset-pack.js`
- Test: `tests/yoyo-asset-pack.test.mjs`
- Test: `tests/pet-pack-reader.test.mjs`

- [ ] **Step 1: Extend the pack-manifest test**

Add assertions to `tests/yoyo-asset-pack.test.mjs`:

```js
test('declares the active V3 art kit while preserving spritesheet compatibility', () => {
  const manifest = readJson(manifestPath);

  assert.equal(manifest.avatar.driver, 'pixi-spritesheet');
  assert.equal(manifest.runtimeCompatibility.preserveExistingRuntimePaths, true);
  assert.equal(manifest.v3.active, true);
  assert.equal(manifest.v3.rooms.day, 'home/room-v3-day.webp');
  assert.equal(manifest.v3.rooms.night, 'home/room-v3-night.webp');
  assert.equal(manifest.v3.rooms.rainy, 'home/room-v3-rainy.webp');
  assert.equal(manifest.v3.rooms.party, 'home/room-v3-party.webp');
  assert.equal(manifest.v3.props.feed, 'home/prop-v3-meal-table.webp');
  assert.equal(manifest.v3.composites.sleep, 'home/composite-v3-sleep-yoyo.webp');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/yoyo-asset-pack.test.mjs
```

Expected: FAIL because `manifest.v3` does not exist yet.

- [ ] **Step 3: Add V3 fields to the runtime manifest**

Modify `assets/yoyo/pack-manifest.json` by adding:

```json
"v3": {
  "active": true,
  "sourceManifest": "../assets-src/yoyo/v3/manifest.json",
  "rooms": {
    "day": "home/room-v3-day.webp",
    "night": "home/room-v3-night.webp",
    "rainy": "home/room-v3-rainy.webp",
    "party": "home/room-v3-party.webp"
  },
  "props": {
    "feed": "home/prop-v3-meal-table.webp",
    "bath": "home/prop-v3-wash-stand.webp",
    "sleep": "home/prop-v3-bed.webp",
    "play": "home/prop-v3-toy-shelf.webp",
    "pet": "home/prop-v3-comfort-cushion.webp",
    "watchAnime": "home/prop-v3-media-screen.webp",
    "playSwitch": "home/prop-v3-game-console.webp",
    "buildBlocks": "home/prop-v3-blocks.webp",
    "study": "home/prop-v3-study-desk.webp"
  },
  "composites": {
    "feed": "home/composite-v3-feed-yoyo.webp",
    "sleep": "home/composite-v3-sleep-yoyo.webp",
    "bath": "home/composite-v3-bath-yoyo.webp",
    "play": "home/composite-v3-play-yoyo.webp",
    "comfort": "home/composite-v3-comfort-yoyo.webp"
  }
}
```

- [ ] **Step 4: Update asset status**

Modify `assets/yoyo/asset-status.json`:

- add `keep` entries for each `home/room-v3-*.webp`, `home/prop-v3-*.webp`, and `home/composite-v3-*.webp`
- keep `spritesheet.webp` and `pet.json` as `keep`
- keep old accepted assets available until V3 runtime captures pass
- keep `desktop-rig/` and `live2d/` as `experimental`

- [ ] **Step 5: Update the audit script**

Modify `scripts/audit-yoyo-asset-pack.js` so it includes `manifest.v3.rooms`, `manifest.v3.props`, and `manifest.v3.composites` in runtime path validation and inventory generation.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs tests/yoyo-asset-pack.test.mjs tests/pet-pack-reader.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit V3 pack registration**

```bash
git add assets/yoyo/pack-manifest.json assets/yoyo/asset-status.json scripts/audit-yoyo-asset-pack.js tests/yoyo-asset-pack.test.mjs tests/pet-pack-reader.test.mjs
git commit -m "feat: register yoyo v3 asset kit"
```

---

### Task 9: Wire V3 Into The Home Runtime

**Files:**
- Modify: `src/shared/home-scene.js`
- Modify: `src/shared/yoyo-actions.js`
- Modify: `src/home.html`
- Modify: `src/home.css`
- Modify: `src/home.js`
- Test: `tests/home-scene-assets.test.mjs`

- [ ] **Step 1: Extend the home scene test**

Modify `tests/home-scene-assets.test.mjs`:

```js
test('uses V3 home assets as the active room and object kit', () => {
  const scene = loadHomeScene();
  const html = readFileSync(join(repoRoot, 'src/home.html'), 'utf8');

  assert.equal(scene.roomLayout.assetSet, 'yoyo-v3');
  assert.equal(scene.roomLayout.baseAsset, '../assets/yoyo/home/room-v3-day.webp');
  assert.equal(scene.roomLayout.artMode, 'saved-compact-room');
  assert.match(html, /room-v3-day\.webp/u);

  const byAction = Object.fromEntries(scene.objects.map((object) => [object.action, object]));
  assert.equal(byAction.feed.layers[0].src, '../assets/yoyo/home/prop-v3-meal-table.webp');
  assert.equal(byAction.sleep.layers[0].src, '../assets/yoyo/home/prop-v3-bed.webp');
  assert.equal(scene.actionComposites.sleep.src, '../assets/yoyo/home/composite-v3-sleep-yoyo.webp');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/home-scene-assets.test.mjs
```

Expected: FAIL because the home runtime still points to previous assets.

- [ ] **Step 3: Update the scene manifest**

Modify `src/shared/home-scene.js`:

- set `roomLayout.assetSet` to `yoyo-v3`
- set `roomLayout.baseAsset` to `asset('room-v3-day')`
- update every object layer to use V3 prop assets
- update `actionComposites` to use V3 composites
- preserve existing interaction phases and placements first, then tune only after runtime captures

- [ ] **Step 4: Update room scene assets**

Modify `src/shared/yoyo-actions.js` and fallback `ROOM_SCENES` in `src/home.js`:

```js
default: { label: '日常小屋', asset: '../assets/yoyo/home/room-v3-day.webp', artMode: 'saved-compact-room' },
night: { label: '夜晚小屋', asset: '../assets/yoyo/home/room-v3-night.webp', artMode: 'saved-compact-room' },
rainy: { label: '雨天小屋', asset: '../assets/yoyo/home/room-v3-rainy.webp', artMode: 'saved-compact-room' },
party: { label: '派对小屋', asset: '../assets/yoyo/home/room-v3-party.webp', artMode: 'saved-compact-room' }
```

- [ ] **Step 5: Update the initial HTML room image**

Modify `src/home.html`:

```html
<img id="room-art" class="room-art" src="../assets/yoyo/home/room-v3-day.webp" alt="">
```

- [ ] **Step 6: Keep saved-art CSS active for V3**

Confirm `src/home.css` still has selectors for:

```css
.room-stage[data-room-art-mode="saved-compact-room"] .room-world
.room-stage[data-room-art-mode="saved-compact-room"] .room-art
.room-stage[data-room-art-mode="saved-compact-room"] .home-fixture
.room-stage[data-room-art-mode="saved-compact-room"]:not([data-task]) .scene-object
```

If V3 props need different proportions, update slot widths in `src/shared/home-scene.js`, not ad-hoc CSS offsets.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test tests/home-scene-assets.test.mjs tests/yoyo-v3-asset-kit.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit runtime wiring**

```bash
git add src/shared/home-scene.js src/shared/yoyo-actions.js src/home.js src/home.html src/home.css tests/home-scene-assets.test.mjs
git commit -m "feat: switch home runtime to yoyo v3 art kit"
```

---

### Task 10: Runtime Visual QA Captures

**Files:**
- Generate: `assets/yoyo/qa/v3/home-v3-day-runtime.png`
- Generate: `assets/yoyo/qa/v3/home-v3-feed-runtime.png`
- Generate: `assets/yoyo/qa/v3/home-v3-night-runtime.png`
- Generate: `assets/yoyo/qa/v3/home-v3-rainy-runtime.png`
- Generate: `assets/yoyo/qa/v3/home-v3-party-runtime.png`
- Modify: `assets/yoyo/qa/v3/v3-kit-report.md`

- [ ] **Step 1: Capture the default room**

Run:

```bash
npm run capture:home -- --out assets/yoyo/qa/v3/home-v3-day-runtime.png --width 1180 --height 820 --wait 1300
```

Expected: screenshot shows V3 day room, clear center rug, no duplicate generated furniture, and Yoyo visible.

- [ ] **Step 2: Capture the feed state**

Run:

```bash
npm run capture:home -- --action feed --out assets/yoyo/qa/v3/home-v3-feed-runtime.png --width 1180 --height 820 --wait 1800
```

Expected: Yoyo stands beside the V3 meal table, not on top of it.

- [ ] **Step 3: Capture alternate rooms**

If `scripts/capture-home-scene.js` does not yet support `--scene`, extend it with a `scene` argument:

```js
else if (arg === '--scene') args.scene = next();
```

and execute after page load:

```js
if (args.scene) {
  await win.webContents.executeJavaScript(`
    document.querySelector('[data-room-scene="${args.scene}"]')?.click();
  `);
}
```

Then run:

```bash
npm run capture:home -- --scene night --out assets/yoyo/qa/v3/home-v3-night-runtime.png --width 1180 --height 820 --wait 1300
npm run capture:home -- --scene rainy --out assets/yoyo/qa/v3/home-v3-rainy-runtime.png --width 1180 --height 820 --wait 1300
npm run capture:home -- --scene party --out assets/yoyo/qa/v3/home-v3-party-runtime.png --width 1180 --height 820 --wait 1300
```

Expected: each screenshot uses the matching V3 room variant.

- [ ] **Step 4: Run audit**

Run:

```bash
npm run audit:yoyo-v3
```

Expected: PASS and runtime capture warnings disappear.

- [ ] **Step 5: Commit QA captures**

```bash
git add scripts/capture-home-scene.js assets/yoyo/qa/v3/home-v3-*-runtime.png assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "test: capture yoyo v3 home runtime states"
```

---

### Task 11: Character Rig Migration Prep

**Files:**
- Create: `assets-src/yoyo/v3/character-rig/rig-contract.json`
- Generate: `assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png`
- Generate: `assets/yoyo/qa/v3/character-rig-v3-source-preview.png`
- Test: `tests/yoyo-v3-asset-kit.test.mjs`

- [ ] **Step 1: Extend the V3 test**

Add this test to `tests/yoyo-v3-asset-kit.test.mjs`:

```js
test('defines the next character rig contract without replacing the current spritesheet', () => {
  const manifest = readJson(manifestPath);
  const rigContract = readJson(join(repoRoot, manifest.characterRig.contract));

  assert.equal(manifest.runtimeCompatibility.keepCurrentSpritesheet, true);
  assert.equal(manifest.characterRig.runtimeStatus, 'experimental');
  assert.equal(rigContract.id, 'yoyo-v3-character-rig-contract');
  assert.equal(rigContract.currentRuntime, 'pixi-spritesheet');
  assert.equal(rigContract.nextRuntime, 'pixi-layered-rig');
  assert.deepEqual(rigContract.requiredParts, [
    'head',
    'bangs',
    'bun',
    'face',
    'eyes',
    'mouth',
    'torso',
    'bow',
    'leftArm',
    'rightArm',
    'leftLeg',
    'rightLeg'
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: FAIL because `rig-contract.json` does not exist yet.

- [ ] **Step 3: Add the rig contract**

Create `assets-src/yoyo/v3/character-rig/rig-contract.json`:

```json
{
  "id": "yoyo-v3-character-rig-contract",
  "currentRuntime": "pixi-spritesheet",
  "nextRuntime": "pixi-layered-rig",
  "source": "assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png",
  "requiredParts": [
    "head",
    "bangs",
    "bun",
    "face",
    "eyes",
    "mouth",
    "torso",
    "bow",
    "leftArm",
    "rightArm",
    "leftLeg",
    "rightLeg"
  ],
  "acceptance": [
    "Yoyo identity matches current accepted clean master",
    "full body visible",
    "arms separated enough for future layer extraction",
    "no props in the source image",
    "no animal ears or tail"
  ]
}
```

- [ ] **Step 4: Generate the layered source**

Use built-in `image_gen` with prompt id `character-rig-v3-source` from `assets-src/yoyo/v3/prompt-pack.json`.

Save the selected image to:

```text
assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png
```

- [ ] **Step 5: Generate a QA preview**

Run:

```bash
node - <<'NODE'
const path = require('path');
const sharp = require('sharp');
const repo = process.cwd();
(async () => {
  await sharp(path.join(repo, 'assets-src/yoyo/v3/character-rig/yoyo-v3-layered-source.png'))
    .resize(320, 420, { fit: 'contain', background: '#f6eedf' })
    .png()
    .toFile(path.join(repo, 'assets/yoyo/qa/v3/character-rig-v3-source-preview.png'));
})();
NODE
```

- [ ] **Step 6: Run focused test**

Run:

```bash
node --test tests/yoyo-v3-asset-kit.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit rig prep**

```bash
git add assets-src/yoyo/v3/character-rig assets/yoyo/qa/v3/character-rig-v3-source-preview.png tests/yoyo-v3-asset-kit.test.mjs
git commit -m "feat: prepare yoyo v3 layered rig contract"
```

---

### Task 12: Documentation And Final Verification

**Files:**
- Modify: `assets/yoyo/qa/asset-cleanup-audit.md`
- Modify: `assets/yoyo/qa/candidates/existing-asset-index.md`
- Modify: `assets/yoyo/qa/candidates/2026-05-29-candidate-review.md`
- Modify: `README.md`

- [ ] **Step 1: Document the V3 decision**

Add a short section to `assets/yoyo/qa/asset-cleanup-audit.md`:

```markdown
## V3 Full Asset Rebuild Decision

Yoyo V3 rebuilds the visual kit as a coherent set instead of patching isolated old assets. The current spritesheet remains the runtime avatar compatibility layer. V3 replaces the active home visual language with a generated room kit, transparent prop kit, and care composite kit while preserving the compact lively `room-stage-v2` mood.

Runtime proof:

- `assets/yoyo/qa/v3/home-v3-day-runtime.png`
- `assets/yoyo/qa/v3/home-v3-feed-runtime.png`
- `assets/yoyo/qa/v3/home-v3-night-runtime.png`
```

- [ ] **Step 2: Update candidate notes**

Update `assets/yoyo/qa/candidates/existing-asset-index.md`:

```markdown
V3 supersedes the old room-stage assets for runtime defaults. Keep `room-stage-v2.webp` as the mood reference and fallback, not as the final art direction.
```

Update `assets/yoyo/qa/candidates/2026-05-29-candidate-review.md`:

```markdown
V3 changes the production strategy from one-off candidate replacement to full-kit generation. Existing accepted assets remain useful as references and fallbacks until V3 passes runtime QA.
```

- [ ] **Step 3: Update README**

Add a concise note to `README.md`:

```markdown
### Yoyo V3 Asset Kit

The active visual direction is the Yoyo V3 full asset kit: coherent generated rooms, transparent props, and care composites. The current Pixi spritesheet remains the avatar runtime driver until the layered rig migration is ready.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run audit:yoyo-v3
npm run audit:asset-pack
npm run qa:yoyo-final-art
npm test
npm run check
```

Expected:

- `npm run audit:yoyo-v3`: PASS
- `npm run audit:asset-pack`: PASS
- `npm run qa:yoyo-final-art`: PASS
- `npm test`: all tests PASS
- `npm run check`: PASS

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended V3 source, runtime assets, tests, scripts, docs, and QA evidence are modified or added.

- [ ] **Step 6: Commit final docs and verification updates**

```bash
git add assets/yoyo/qa/asset-cleanup-audit.md assets/yoyo/qa/candidates/existing-asset-index.md assets/yoyo/qa/candidates/2026-05-29-candidate-review.md README.md assets/yoyo/qa/v3/v3-kit-report.md
git commit -m "docs: document yoyo v3 asset rebuild"
```

---

## Execution Notes

- Do not delete old runtime assets during V3 generation. Keep them as fallbacks until all V3 screenshots and tests pass.
- Do not replace `assets/yoyo/spritesheet.webp` in this plan. It remains the active avatar driver.
- Use built-in `image_gen` for generation. For transparent props and composites, generate on flat `#00ff00`, then remove the background locally with the existing chroma-key helper.
- Accept assets only when they meet all four gates: manifest entry, runtime path, QA preview, and audit pass.
- Reject any generation that reintroduces dog bowl, kibble, paw motif, animal bed, animal ears, tail, kennel, or large quiet full-room framing.
- Preserve the compact, warm, busy, high-energy feeling the user preferred in `room-stage-v2.webp`.

## Self-Review

Spec coverage: this plan covers the user's requested full asset rebuild while keeping the current spritesheet as compatibility. It includes style source, prompt source, generation, post-processing, runtime wiring, QA captures, audit integration, docs, and final verification.

Placeholder scan: no task uses open placeholders. Every generated file has an exact path, and every command has an expected result.

Type consistency: V3 names use `room-v3-*`, `prop-v3-*`, and `composite-v3-*` consistently across prompt pack, source manifest, runtime manifest, tests, runtime wiring, and documentation.
