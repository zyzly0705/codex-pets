# Yoyo Sleep Scene Rig V2 Plan

## Purpose

This document defines the local plan for replacing the current sleep home action with a high-quality clean-2d scene rig. The immediate goal is to fix positioning drift and duplicated assets in the sleep scene before migrating other care scenes.

Sleep is the pilot because it has the strictest contact and occlusion requirements: Yoyo must rest naturally in a bed, the blanket must cover the body believably, and the runtime must never draw a second Yoyo or second bed.

## Current Problem

The current home sleep path has several overlapping mechanisms:

- `src/shared/home-scene.js` defines `specialPoses.sleep` using `assets/yoyo/home/home-sleep-yoyo.webp`.
- The same file defines `actionComposites.sleep` using `assets/yoyo/home/composite-sleep-bed-yoyo.webp`.
- The same scene also keeps `objects.sleepBed` with layered bed props: `prop-bed-back`, `prop-bed-blanket`, and `prop-bed-front`.
- `src/home.js` still draws the normal `home-pet` canvas from `assets/yoyo/spritesheet.webp`.
- `assets/yoyo/effects/sleep-final` is a separate Pixi final-art scene with its own full-scene image.

These are individually valid experiments, but they are unsafe together. A clean-2d composite can already contain Yoyo and the bed, while the runtime still draws the sprite canvas and layered bed props. This causes duplicate Yoyo, duplicate bed pieces, inaccurate placement, and fragile CSS offsets.

## Design Principle

Sleep should stop being a normal sprite-and-prop action. It should become a single scene rig with an explicit rendering contract.

The sleep scene must choose exactly one mode:

- `atomicScene`: one full scene image already contains room, bed, Yoyo, and foreground. Runtime does not draw normal Yoyo or layered props.
- `layeredRig`: the scene is split into ordered layers in one coordinate system. Runtime draws only the layers declared by the rig.

For the high-quality sleep pilot, use `layeredRig`, not `atomicScene`. Layered rig gives better control over blanket occlusion, breathing motion, shadows, and small sleep effects.

## Target Structure

Create a source scene package:

```text
assets-src/yoyo/scenes/sleep/
  scene.rig.json
  sources/
    room.png
    bed-back.png
    yoyo-sleep.png
    blanket-front.png
    soft-shadow.png
    sleep-fx.png
  processed/
    room.webp
    bed-back.webp
    yoyo-sleep.webp
    blanket-front.webp
    soft-shadow.webp
    sleep-fx.webp
  qa/
    sleep-rig-contact.png
    sleep-rig-runtime.png
```

Create runtime output:

```text
assets/yoyo/scenes/sleep/
  scene.rig.json
  room.webp
  bed-back.webp
  yoyo-sleep.webp
  blanket-front.webp
  soft-shadow.webp
  sleep-fx.webp
```

## Rig Contract

Use a fixed stage coordinate system. For the first pilot, prefer full-stage layers so positioning is deterministic.

Recommended stage:

```json
{
  "stage": { "width": 512, "height": 384 }
}
```

Recommended rig shape:

```json
{
  "id": "sleep",
  "version": 2,
  "mode": "layeredRig",
  "stage": { "width": 512, "height": 384 },
  "runtime": {
    "disablePetCanvas": true,
    "disableLegacyObjects": ["sleepBed"],
    "disableActionComposite": true,
    "containsCharacter": true,
    "containsProps": ["bed"]
  },
  "layers": [
    { "id": "room", "role": "room", "src": "room.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 0 },
    { "id": "soft-shadow", "role": "shadow", "src": "soft-shadow.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 5 },
    { "id": "bed-back", "role": "propBack", "src": "bed-back.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 10 },
    { "id": "yoyo-sleep", "role": "character", "src": "yoyo-sleep.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 20 },
    { "id": "blanket-front", "role": "propFront", "src": "blanket-front.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 30 },
    { "id": "sleep-fx", "role": "fx", "src": "sleep-fx.webp", "x": 0, "y": 0, "w": 512, "h": 384, "z": 40 }
  ],
  "motion": {
    "breathing": {
      "targets": ["yoyo-sleep", "blanket-front"],
      "periodMs": 1800,
      "translateY": 2,
      "scaleY": 1.01
    },
    "fx": {
      "targets": ["sleep-fx"],
      "periodMs": 2200,
      "translateY": -3,
      "alpha": [0.18, 0.42]
    }
  }
}
```

## Quality Bar

Sleep is accepted only if all of these are true:

- Yoyo reads as the same clean-2d character from the identity master.
- The pose is a believable human-like sleeping pose, not a hidden half-body shortcut.
- The bed, pillow, blanket, and body contact are physically plausible.
- The blanket foreground explains all occlusion.
- The scene has exactly one Yoyo and one bed.
- The runtime does not draw the legacy `home-pet` canvas during the sleep scene.
- The runtime does not draw `prop-bed-*` or `composite-sleep-bed-yoyo.webp` at the same time as the new rig.
- Breathing motion is subtle and only affects Yoyo/blanket, not the whole room.
- The scene looks good at actual home UI size, not only as a source image.

## Implementation Plan

1. Audit the current sleep scene sources and runtime outputs:
   - `assets-src/yoyo/home/home-sleep-yoyo.png`
   - `assets-src/yoyo/home/composite-sleep-bed-yoyo.png`
   - `assets-src/yoyo/final-art/sleep-final-art-v1.png`
   - `assets/yoyo/effects/sleep-final/rig/parts/scene-full.png`
   - `output/yoyo-asset-runs/yoyo-redesign-v1/assets/04-home-sleep-pose/qa/*`

2. Pick the best existing sleep source as the visual baseline.

3. Create the scene source folder under `assets-src/yoyo/scenes/sleep/`.

4. Build a first full-stage layered rig from existing assets. Do not regenerate art yet.

5. Add a runtime loader for `HOME_SCENE.sceneRigs.sleep` in `src/home.js`.

6. Update `src/shared/home-scene.js` so sleep uses the new rig and disables legacy sleep paths.

7. Add a guard test that fails if a scene rig with `containsCharacter: true` also renders `home-pet`.

8. Capture before/after screenshots for the sleep home scene.

9. If positioning is correct, generate or clean higher-quality sleep layers.

10. Only after sleep passes, repeat the mechanism for bath, feed, play, and pet.

## Validation

Run these checks during the pilot:

```bash
npm run check
npm test -- tests/home-scene-assets.test.mjs
npm test -- tests/yoyo-final-art-interaction.test.mjs
```

Capture visual proof:

```bash
npm run capture:home -- --action sleep
```

If the capture command needs adjustment, add the smallest script support needed to capture only the sleep scene with the new rig enabled.

## Risks

- Existing tests currently expect `specialPoses.sleep` and `actionComposites.sleep`; those expectations need to move to the new rig contract.
- Current CSS contains sleep-specific rules for `.home-sleep-pose`, `.home-action-composite`, `.sleep-bed-object`, and `#home-pet`. Some must become legacy-only.
- If layers are cropped too early, contact precision may drift. Use full-stage layers for v1.
- If final-art Pixi scenes and Home scenes remain separate, they may diverge visually. Sleep should establish a shared rig schema that Pixi can adopt later.

## Decision

Proceed with a high-quality `sleep` layered rig pilot using full-stage layers first. Do not batch migrate other scenes until sleep proves the new positioning and duplication rules.

## Pilot Update

The first automatic exclusive pixel split produced visible seams when scaled in the Home UI. A second pass using overlapping bleed masks removed those scale seams while keeping runtime layers separate.

The accepted interim runtime contract is now:

- `soft-shadow`
- `bed-back-bleed`
- `yoyo-visible-bleed`
- `blanket-front-bleed`
- `bed-front-bleed`
- `sleep-micro-expression`

The `*-bleed` layers intentionally overlap by a few pixels. Do not animate the character and blanket independently until fully hand-authored or generated native layers replace the bleed split, because the overlap is designed to avoid seams rather than expose hidden moving parts.

The generated six-cell native layer sheet attempts under `assets-src/yoyo/scenes/sleep/native-v1/` did not preserve exact coordinates. Keep them as research evidence only; do not wire them into runtime without alignment QA.
