# Yoyo Special Action Agent Split

This is the combined control note for the two-agent rebuild path.

## Ownership

| Owner | Scope | Runtime type | Primary files |
| --- | --- | --- | --- |
| Agent A | `clone-heart` / 分身, `dharma-manifest` / 法相 | Pixi fullscreen effects | `src/pixi-effect-stage.js`, `assets-src/yoyo/effects/*/timeline.json`, `assets/yoyo/effects/*/timeline.json` |
| Agent B | `digSand` / 遁地 | Main atlas row 17 | `assets-src/yoyo/frames/digSand/*.png`, `assets-src/yoyo/manifest.json`, `assets/yoyo/spritesheet.webp` |
| Agent C | `cook-pot` / 入锅温泉 | Pixi sequence performance | `src/pixi-effect-stage.js`, `assets-src/yoyo/effects/cook-pot/timeline.json`, `assets/yoyo/effects/cook-pot/timeline.json` |

The shared visual rule is the same for all three actions: Yoyo is a human little girl, not a dog or mascot pet. Do not accept half-body source art unless a foreground authored layer physically occludes the body inside the frame.

## Prepared Runs

Create all three run folders:

```bash
npm run design:yoyo-effects-video -- --force
npm run design:yoyo-digsand-video -- --force
```

This creates:

```text
output/yoyo-effect-video-runs/clone-heart/
output/yoyo-effect-video-runs/dharma-manifest/
output/yoyo-digsand-video-runs/digSand/
```

Each folder contains the generation prompt, request JSON, source drop folder, processing folder, and QA checklist.

## Visual Production Order

1. Generate `digSand` first, because it fixes the "half body / floating above ground" problem in the main Yoyo atlas.
2. Generate `clone-heart` second, because it mainly needs stable full-body duplicates and clean formation timing.
3. Generate `dharma-manifest` third, because it has the most layering risk: normal Yoyo in front, large translucent Yoyo-like spirit behind, rings/lightning in front.

## Runtime Ingest

For `digSand`:

1. Put the source video or image sequence in `output/yoyo-digsand-video-runs/digSand/sources/`.
2. Extract 24 reference frames into `output/yoyo-digsand-video-runs/digSand/frames/reference-24/`.
3. Select 8 runtime frames into `assets-src/yoyo/frames/digSand/00.png` through `07.png`.
4. Rebuild and review:

```bash
npm run build:pet-assets -- --strict --scan-alpha
npm run qa:animations -- --actions=digSand
```

For `clone-heart`, `dharma-manifest`, and `cook-pot`:

1. Put source video or image sequences in the matching `sources/` folder.
2. Extract frames into the matching `frames/` folder.
3. Clean candidate transparent layers into `processed/`.
4. Update source timelines in `assets-src/yoyo/effects/<effect-id>/timeline.json`.
5. Copy accepted runtime timelines to `assets/yoyo/effects/<effect-id>/timeline.json`.
6. Verify in `src/pixi-effect-stage.js` with overlay screenshots or a short capture. For `cook-pot`, run `npm run capture:effect -- --effect-type cook-pot --effect-id cook-pot --out output/yoyo-asset-runs/yoyo-redesign-v2/assets/13-cook-pot-pixi/qa/cook-pot-pixi.png`.

## Final Gates

Run these before calling the split complete:

```bash
node --test tests/yoyo-effect-video-workflow.test.mjs tests/yoyo-digsand-video-workflow.test.mjs
npm test
npm run check
```

Visual acceptance still requires reviewing the generated contact sheets. Passing tests only proves the workflow, scopes, paths, and runtime contracts are wired correctly.
