# Yoyo Effect Video Workflow

This document defines the rebuild path for Yoyo's special effects and action-engine performances: Pixi effects (`clone-heart`, `dharma-manifest`, `cook-pot`) and Spine actions such as `watch-tv`. It intentionally excludes `digSand`; that action belongs to a separate main-atlas workflow.

## Current Entrypoints

| Effect | Runtime trigger | Stage renderer | Runtime timeline | Source timeline |
| --- | --- | --- | --- | --- |
| 分身 / `clone-heart` | `src/main/effects.js` -> `triggerCloneEffect()` -> IPC `effect:clone` | `src/pixi-effect-stage.js` -> `makeCloneStage()` | `assets/yoyo/effects/clone-heart/timeline.json` | `assets-src/yoyo/effects/clone-heart/timeline.json` |
| 法相 / `dharma-manifest` | `src/main/effects.js` -> `triggerGiantEffect()` -> IPC `effect:giant` | `src/pixi-effect-stage.js` -> `makeDharmaStage()` | `assets/yoyo/effects/dharma-manifest/timeline.json` | `assets-src/yoyo/effects/dharma-manifest/timeline.json` |
| 入锅温泉 / `cook-pot` | `src/main/effects.js` -> `triggerCookEffect()` -> IPC `effect:cook` | `src/pixi-effect-stage.js` -> `makeCookPotStage()` | `assets/yoyo/effects/cook-pot/timeline.json` | `assets-src/yoyo/effects/cook-pot/timeline.json` |
| 看电视 / `watch-tv` | `src/main/effects.js` -> `triggerWatchTvEffect()` -> IPC `effect:watch-tv` | `src/pixi-effect-stage.js` -> `makeSpineActionStage()` | `assets/yoyo/effects/watch-tv/timeline.json` | `assets-src/yoyo/effects/watch-tv/timeline.json` |
| 打游戏 / `play-switch` | `src/main/effects.js` -> `triggerPlaySwitchEffect()` -> IPC `effect:play-switch` | `src/pixi-effect-stage.js` -> `makeSpineActionStage()` | `assets/yoyo/effects/play-switch/timeline.json` | `assets-src/yoyo/effects/play-switch/timeline.json` |

The product-level performance scripts are in `src/modules/performance-script.js` as `cloneHeart`, `dharmaManifest`, `cookPotScene`, `watchTvScene`, and `playSwitchScene`. The action taxonomy marks `clone` and `giant` as `fullscreen-performance` in `src/modules/action-taxonomy.js`; `cook-pot` is a Pixi sequence performance with authored foreground occlusion; `watch-tv` and `play-switch` are Spine action-engine contracts. Existing spritesheet rows for法相 sources live in `assets-src/yoyo/manifest.json` as `dharmaCharge`, `dharmaSpirit`, `dharmaManifest`, and `dharmaStable`.

## Character Lock

Yoyo is a human little girl and companion, not a dog, puppy, animal mascot, or generic pet. The video reference must keep her full body visible, grounded, and consistent with the clean-2d identity sheet in `assets-src/yoyo/identity/yoyo-character-master.png`.

Reject references with half-body crops, floating busts, pasted faces, animal ears, paws, collars, pet bowls, pet beds, or animal semantics.

## Workflow Manifest

The machine-readable plan is in:

```text
assets-src/yoyo/effects/video-workflow-manifest.json
```

Prepare run folders with:

```bash
npm run design:yoyo-effects-video -- --force
```

This creates:

```text
output/yoyo-effect-video-runs/clone-heart/
output/yoyo-effect-video-runs/dharma-manifest/
```

Each run contains `effect-request.json`, `prompts/video-reference.md`, `sources/`, `frames/`, `processed/`, and `qa/review-checklist.md`.

## 分身 Video Plan

Generate one short clean-2d video reference:

- Duration: about 2.6s.
- Extract: 24 frames at 12fps.
- Composition: original full-body Yoyo at center; two clones split from her shoulders; more full-body clones fan outward; formation resolves into a heart shape.
- Layer intent: character-composite reference for original plus clones, plus a small foreground heart burst.
- Runtime destination: keep PixiJS stage as the main renderer; use the video to correct clone scale, path, timing, and any future authored small effect pieces.

Acceptance:

- Every visible Yoyo is full-body or intentionally covered by a same-frame effect.
- Clones stay human and match Yoyo's identity.
- Formation is readable and does not drift away from the source center.
- The ending has a clean收束 for fade-out.

## 法相 Video Plan

Generate one short clean-2d video reference:

- Duration: about 4.2s.
- Extract: 32 frames at 12fps.
- Composition: normal-size full-body Yoyo grounded in foreground; a large translucent guardian-like Yoyo spirit rises behind her; rune rings and lightning pass as foreground effect layers.
- Layer intent: `dharma-spirit-back` behind Yoyo, `dharma-yoyo-front` for proportion validation, and `dharma-seal-front` for foreground rings/lightning/shockwave.
- Runtime destination: keep PixiJS stage as the main renderer; use the video to replace the current generic spirit silhouette and tune charge, emergence, stable hold, and收束.

Acceptance:

- Foreground Yoyo stays grounded and normal-sized.
- The法相 is a separate back effect layer, not a pasted enlarged Yoyo sitting on top of her.
- The spirit is recognizably human Yoyo.
- Foreground effects never hide her face for too long.

## 入锅温泉 Pixi Plan

`cook-pot` is the first upgraded "sequence performance" example for prop-heavy actions. It uses PixiJS runtime layers instead of a static pose:

- `pot-back`: back half of the pot and broth.
- `character-sprite-sequence`: Yoyo jumps in, settles, bobs, and pops up using atlas animation frames.
- `pot-front-mask`: front rim and pot body occlude Yoyo's lower body.
- `steam-particles`: warm steam and spark particles from the broth.

This action should read as a playful soup-pot hot spring, not harm or cooking Yoyo. If future AI/video frames are generated, keep Yoyo human-like, full-body in the source, and only hidden by the authored pot rim in runtime.

Capture a review frame with:

```bash
npm run capture:effect -- --effect-type cook-pot --effect-id cook-pot --out output/yoyo-asset-runs/yoyo-redesign-v2/assets/13-cook-pot-pixi/qa/cook-pot-pixi.png
```

## 看电视 And 打游戏 Spine Plan

`watch-tv` should be authored as a Spine animation named `watch_tv`, followed by an `idle_sit` loop. `play-switch` should use `play_switch`, also followed by `idle_sit`. Pixi loads the skeleton through `@esotericsoftware/spine-pixi-v8`; it should not hand-position limbs, props, or body parts.

Expected runtime files:

```text
assets/yoyo/effects/watch-tv/spine/yoyo.skel.json
assets/yoyo/effects/watch-tv/spine/yoyo.atlas
assets/yoyo/effects/watch-tv/spine/yoyo.png
assets/yoyo/effects/play-switch/spine/yoyo.skel.json
assets/yoyo/effects/play-switch/spine/yoyo.atlas
assets/yoyo/effects/play-switch/spine/yoyo.png
```

The current generated seed assets come from `scripts/generate-watch-tv-spine-assets.js`. They are intentionally replaceable source scaffolding: the runtime contract is now real Spine skeleton + atlas + PNG, and the TV/game screen is drawn dynamically by Pixi instead of being a static pasted image. If a future action is missing required Spine files, the stage shows a strict missing-asset panel and does not render an atlas proxy. Details are in `docs/Yoyo-Spine-Action-Runtime.md`.

## Ingest And QA

1. Save generated source video or image sequence into the run `sources/` folder.
2. Extract frames into the run `frames/` folder.
3. Clean transparency or chroma key into `processed/`.
4. Make a contact sheet and copy it to the path declared by `video-workflow-manifest.json`.
5. Decide which visual parts become authored assets and which remain Pixi timeline logic.
6. Update source timelines first, then copy accepted runtime timelines into `assets/yoyo/effects/<effect-id>/timeline.json`.
7. Capture overlay proof before accepting.

Recommended checks:

```bash
node --test tests/yoyo-effect-video-workflow.test.mjs
npm run check
```
