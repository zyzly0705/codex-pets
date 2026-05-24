# Yoyo DigSand Video Workflow

This document defines the rebuild path for Yoyo's `digSand` action only. It intentionally excludes `clone-heart` and `dharma-manifest`; those fullscreen effects belong to the other agent.

## Current Entrypoints

| Concern | Path |
| --- | --- |
| Runtime state | `src/modules/core-state.js` -> `STATES.digSand` |
| Behavior trigger | `src/modules/behavior-engine.js` -> behavior named `digSand` |
| Dialogue catalog | `src/modules/behavior-data.js` -> `BEHAVIOR_DIALOGUE_CATALOG.digSand` |
| Action taxonomy | `src/modules/action-taxonomy.js` -> `digSand` |
| Runtime draw path | `src/modules/render-engine.js` draws row 17 from the active spritesheet |
| Source frames | `assets-src/yoyo/frames/digSand/00.png` through `07.png` |
| Source manifest | `assets-src/yoyo/manifest.json` row 17 |
| Runtime atlas | `assets/yoyo/spritesheet.webp` |
| Build script | `scripts/build-pet-assets.js` |
| QA script | `scripts/qa-animation-previews.js` |

`digSand` is not a Pixi fullscreen effect. It is a fixed 8-frame row in the main Yoyo atlas, so the video workflow should produce richer reference material and then select the best 8 runtime keyframes.

## Character And Contact Lock

Yoyo is a human little girl and companion, not a dog, puppy, animal mascot, or generic pet. The action should read as a playful magical ground-dive, not animal digging.

The hard part is physical contact:

- Start and end frames must show full-body grounded Yoyo.
- Middle frames may hide legs or body only behind an authored foreground ground lip.
- The ground lip must touch Yoyo's hands, feet, or body; no floating sticker pose above dust.
- Dust must stay attached to the hole/rim, not drift as loose detached clouds.
- The source image must not be cropped into a half-body Yoyo. Occlusion belongs inside the frame.

## Recommended Video Reference

Generate one short clean-2d video reference:

- Duration: about 2.4s.
- Extract: 24 frames at 12fps.
- Runtime selection: choose 8 keyframes for row 17.
- Canvas: 768x768 reference video, later cropped and normalized into 192x208 transparent cells.
- Composition: full-body Yoyo crouches, touches the ground, sinks through a rounded soil/floor lip, briefly disappears with a small same-frame hint, then pushes herself back out and stands stable.

Suggested 8 runtime phases:

1. Full-body crouch, both feet on the ground.
2. Hands touch ground, first attached dust.
3. Lower legs pass behind foreground ground lip.
4. Torso sinks, face still readable.
5. Brief hidden beat, small top-of-head or hand hint only if needed.
6. Head and hands emerge through the same rim.
7. Full body pushes out, feet reconnect.
8. Stable full-body recovery pose.

## Ingest Path

The machine-readable plan is:

```text
assets-src/yoyo/actions/digSand-video-workflow-manifest.json
```

Prepare a run folder with:

```bash
npm run design:yoyo-digsand-video -- --force
```

This creates:

```text
output/yoyo-digsand-video-runs/digSand/
  action-request.json
  prompts/video-reference.md
  sources/
  frames/reference-24/
  processed/
  qa/review-checklist.md
```

After generation:

1. Save the source video under `sources/`.
2. Extract 24 reference frames into `frames/reference-24/`.
3. Pick and clean 8 runtime keyframes into `assets-src/yoyo/frames/digSand/00.png` through `07.png`.
4. Build the atlas with `npm run build:pet-assets`.
5. Generate animation QA with `npm run qa:animations`.
6. Review `assets-src/yoyo/qa/animation-previews/digSand-contact.png` and the GIF preview before acceptance.

Recommended checks:

```bash
node --test tests/yoyo-digsand-video-workflow.test.mjs
npm run build:pet-assets -- --strict --scan-alpha
npm run qa:animations
npm run check
```

## Rejection Rules

Reject the run if:

- Yoyo looks like a dog, pet, mascot, animal digger, or floating doll.
- The whole row is just a half-body bust going up and down.
- The ground does not physically overlap the body in sink/emerge frames.
- The dust is detached from the hole.
- The selected frames change Yoyo's scale or face identity.
- The sequence cannot be understood at actual app size without pausing.
