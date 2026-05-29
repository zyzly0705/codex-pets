# Yoyo Live2D / Spine Rig Workflow

This workflow replaces the old "programmatically draw a fake Yoyo for Spine" approach.

The new rule is simple:

- Identity comes from the accepted Yoyo master.
- Rig sources are cut from that master into layered parts.
- Motion systems such as Live2D Cubism or Spine rig those real Yoyo parts instead of redrawing a substitute character.

## Current Rig Pack

Generated source pack:

- `assets-src/yoyo/rig/live2d-yoyo-v4/yoyo-live2d-rig-v4.psd`
- `assets-src/yoyo/rig/live2d-yoyo-v4/manifest.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/live2d-binding-profile.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-setup-plan.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-parameter-sheet.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-import-checklist.md`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-motion-spec.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-expression-visibility-map.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-motion-timeline-draft.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-animation-packet.json`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-editor-paste-sheet.md`
- `assets-src/yoyo/rig/live2d-yoyo-v4/cubism-preview-runner.html`
- `assets-src/yoyo/rig/live2d-yoyo-v4/preview-rig-composite.png`

Source image:

- `assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v2-alpha.png`

## Generated Layers

The current `v4` PSD includes grouped layers:

- `hair_back`
- `bun`
- `hair_front`
- `bangs_center`
- `side_hair_left`
- `side_hair_right`
- `face_base`
- `eye_left_open`
- `eye_right_open`
- `eye_left_blink`
- `eye_right_blink`
- `eye_left_smile`
- `eye_right_smile`
- `brow_left`
- `brow_right`
- `blush_left`
- `blush_right`
- `mouth_open`
- `mouth_smile`
- `mouth_closed`
- `mouth_o`
- `mouth_small`
- `mouth_flat`
- `collar`
- `bow_left`
- `bow_center`
- `bow_right`
- `torso_top`
- `skirt`
- `button_left`
- `button_right`
- `arm_left`
- `hand_left`
- `arm_right`
- `hand_right`
- `leg_left`
- `shoe_left`
- `leg_right`
- `shoe_right`

PSD groups:

- `Head`
- `Face`
- `Body`
- `Arms`
- `Legs`

These layers intentionally overlap. That is a feature, not a bug: overlap preserves Yoyo's identity and gives the rigger enough painted area to deform or rotate parts without revealing holes immediately.

## Generation

Run:

```bash
npm run generate:yoyo-rig-psd
```

This writes layered PNG parts plus a Photoshop-compatible PSD using `ag-psd`.
It also emits a `live2d-binding-profile.json` file that maps the facial layers to starter Cubism-style parameters and expression presets.
It also emits a `cubism-setup-plan.json` file that captures the recommended import order, deformer stack, and starter motion sequence.
It also emits a `cubism-parameter-sheet.json` file and a `cubism-import-checklist.md` handoff file for first-pass Cubism setup.
It also emits a `cubism-motion-spec.json` file that defines the first-pass starter motions and their parameter ranges.
It also emits a `cubism-expression-visibility-map.json` file that locks which eye and mouth layers should be visible for each starter expression state.
It also emits a `cubism-motion-timeline-draft.json` file that breaks the starter motions into keyframe-friendly segments.
It also emits a `cubism-animation-packet.json` file with editor-friendly keyframe rows for the first blink and talk loop.
It also emits a `cubism-editor-paste-sheet.md` file that reformats those keyframes into direct markdown tables.
It also emits a `cubism-preview-runner.html` file for a local open-and-play preview of blink and talk_loop.

For structural verification without a canvas dependency, you can read the PSD with:

```js
readPsd(buffer, {
  skipLayerImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
});
```

## Manual Cleanup Pass

Before final rigging, do a short paint cleanup pass in Photoshop, Clip Studio, or similar:

- fill hidden edges behind bangs, sleeves, and skirt overlaps
- repaint cleaner blink lids and polish `eye_left_smile` / `eye_right_smile`
- add extra mouth shapes next to `mouth_open`, `mouth_smile`, `mouth_closed`, `mouth_o`, `mouth_small`, and `mouth_flat` if lip-sync is needed
- separate sleeve from hand further if elbow bending needs cleaner pivots
- add extra underpaint behind torso and hair volume for large rotations

## Recommended Use

For Live2D:

- import the PSD directly
- use `live2d-binding-profile.json` as the starting cheat sheet for parameter names, default values, and facial expression targets
- use `cubism-setup-plan.json` as the practical order-of-operations guide for import, face setup, body deformers, and first motions
- use `cubism-parameter-sheet.json` for the per-parameter layer mapping and `cubism-import-checklist.md` as the literal first-session checklist
- use `cubism-motion-spec.json` when authoring the first idle, blink, happy_idle, and talk_loop motions
- use `cubism-expression-visibility-map.json` to keep expression-layer swaps consistent while the first timelines are being blocked
- use `cubism-motion-timeline-draft.json` as the first segmentation pass when laying down Cubism keyframes
- use `cubism-animation-packet.json` when you want a literal row-by-row table to copy into the first pass of the editor
- use `cubism-editor-paste-sheet.md` when you want the most human-readable paste-oriented table
- open `cubism-preview-runner.html` locally when you want to sanity-check expression swaps and motion rhythm before touching Cubism
- build deformers for head, torso, arms, and skirt
- start with small idle / look / blink / talk motion before gameplay-sized gestures
- use the smile-eye and compact mouth set first for expression switching before attempting big head-angle changes

For Spine:

- use the exported layer PNGs or repaint pass from the PSD
- convert soft-bending areas such as hair and skirt into mesh attachments
- keep bones minimal at first: root, torso, head, upper/lower arms, thighs

## Why This Route

The previous SVG-generated Spine figure could move, but it stopped reading as Yoyo.

This workflow fixes that by preserving:

- Yoyo's eye scale
- Yoyo's bangs and bun silhouette
- the navy dress and red bow proportions
- the exact face language from the accepted master
