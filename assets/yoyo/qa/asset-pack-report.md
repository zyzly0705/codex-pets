# Yoyo Asset Pack QA Report

Generated: 2026-05-29T20:31:35.008Z

## Pack

- Pack: `yoyo`
- Type: `companion`
- Style: `clean-2d-chibi`
- Species: `human-like companion`
- Runtime compatibility: current `pet.json` paths are preserved.

## Golden Asset Set V1

- `idle`
- `runningLeft`
- `runningRight`
- `waving`
- `eating`
- `sleeping`
- `review`
- `petting`
- `dancing`

## Status Summary

| Status | Count |
| --- | ---: |
| `keep` | 53 |
| `redraw` | 5 |
| `remove` | 0 |
| `experimental` | 104 |
| `archive` | 1 |

## Redraw Queue

- `home/room-stage-v2.webp`: Runtime now uses the saved compact room art for the current v1 mood; animal-pet semantics remain a later companion-aligned cleanup task.
- `home/room-stage-night.webp`: Strong mood reference, but it should be normalized with the clean companion room kit.
- `home/room-stage-rainy.webp`: Useful weather variant, but should follow the same cleaned room contract as day and night.
- `home/room-stage-party.webp`: Useful event variant, but should be rebuilt after the base room style is locked.
- `home/composite-pet-cushion-yoyo.webp`: Useful comfort concept, but label and framing should shift from petting to companion comfort.

## Redraw Production Queue

| Priority | Kind | Asset | Brief |
| --- | --- | --- | --- |
| `high` | `room` | `home/room-stage-v2.webp` | `qa/redraw-briefs/home-room-stage-v2.md` |
| `medium` | `room` | `home/room-stage-night.webp` | `qa/redraw-briefs/home-room-stage-night.md` |
| `medium` | `room` | `home/room-stage-rainy.webp` | `qa/redraw-briefs/home-room-stage-rainy.md` |
| `medium` | `room` | `home/room-stage-party.webp` | `qa/redraw-briefs/home-room-stage-party.md` |
| `medium` | `composite` | `home/composite-pet-cushion-yoyo.webp` | `qa/redraw-briefs/home-composite-pet-cushion-yoyo.md` |

## Candidate Registry

| Target | Candidates | Recommended disposition | Recommended path |
| --- | ---: | --- | --- |
| `home/room-stage-v2.webp` | 5 | `v1-vibe` | `assets/yoyo/home/room-stage-v2.webp` |
| `home/room-stage-night.webp` | 4 | `base` | `assets/yoyo/home/room-shell-clean-2d.webp` |
| `home/room-stage-rainy.webp` | 4 | `base` | `assets/yoyo/home/room-shell-clean-2d.webp` |
| `home/room-stage-party.webp` | 4 | `base` | `assets/yoyo/home/room-shell-clean-2d.webp` |
| `home/composite-pet-cushion-yoyo.webp` | 2 | `reference` | `assets/yoyo/home/composite-pet-cushion-yoyo.webp` |

## Experimental Queue

- `scenes/sleep/`: Layered sleep scene is valuable, but not yet the accepted runtime scene contract.
- `effects/`: Default status for timeline, rig, Spine, and special-action experiments until the action driver is stabilized.
- `effects/eat-final/`: Special-action timeline path should stay available while the action driver contract stabilizes.
- `effects/study-final/`: Special-action timeline path should stay available while the action driver contract stabilizes.
- `effects/watch-anime-final/`: Special-action timeline path should stay available while the action driver contract stabilizes.
- `effects/watch-tv/`: Spine-backed action is useful but should be gated behind the special action driver.
- `effects/play-switch-final/`: Special-action timeline path should stay available while the action driver contract stabilizes.
- `effects/cook-pot/`: Special-action timeline path should stay available while the action driver contract stabilizes.
- `desktop-rig/`: Layered rig is a future body system and not yet accepted runtime art.
- `live2d/`: Live2D directory is a future integration placeholder.

## Companion Semantics Watchlist

- `home/room-stage-v2.webp` (redraw): Runtime now uses the saved compact room art for the current v1 mood; animal-pet semantics remain a later companion-aligned cleanup task.
- `home/room-stage-night.webp` (redraw): Strong mood reference, but it should be normalized with the clean companion room kit.
- `home/room-stage-rainy.webp` (redraw): Useful weather variant, but should follow the same cleaned room contract as day and night.
- `home/room-stage-party.webp` (redraw): Useful event variant, but should be rebuilt after the base room style is locked.
- `home/composite-pet-cushion-yoyo.webp` (redraw): Useful comfort concept, but label and framing should shift from petting to companion comfort.
- `home/prop-food.webp` (keep): Accepted human meal tray candidate with rice bowl, plate, fruit, egg, cup, and tableware.
- `home/prop-food-back.webp` (keep): Accepted meal tray now lives in the persistent back layer so the kitchen reads as human tableware.
- `home/prop-food-front.webp` (keep): Legacy bowl rim was removed; front layer is now a transparent compatibility layer.
- `home/prop-food-meal-full.webp` (keep): Transparent compatibility layer; visible food is now authored into the accepted meal tray.
- `home/prop-food-meal-low.webp` (keep): Transparent compatibility layer; phase animation remains available without reintroducing old bowl art.

## Manifest Runtime Paths

- `pet.json`
- `spritesheet.webp`
- `home/yoyo-home-sheet.webp`
- `home/room-v3-day.webp`
- `home/room-v3-night.webp`
- `home/room-v3-rainy.webp`
- `home/room-v3-party.webp`
- `home/composite-v3-feed-yoyo.webp`
- `home/composite-v3-sleep-yoyo.webp`
- `home/composite-v3-bath-yoyo.webp`
- `home/composite-v3-play-yoyo.webp`
- `home/composite-v3-comfort-yoyo.webp`
- `effects/study-final/timeline.json`
- `effects/watch-anime-final/timeline.json`
- `effects/watch-tv/timeline.json`
- `effects/cook-pot/timeline.json`
- `effects/play-switch-final/timeline.json`
- `home/room-stage-v2.webp`
- `home/composite-sleep-bed-yoyo.webp`

## Image Dimension Checks

| Asset | Actual | Expected |
| --- | ---: | ---: |
| `spritesheet.webp` | 1536x8736 | 1536x8736 |
| `home/room-stage-v2.webp` | 1080x720 | 1080x720 |
| `home/yoyo-home-sheet.webp` | 1536x8736 | 1536x8736 |
| `home/composite-sleep-bed-yoyo.webp` | 440x344 | 440x344 |

## Warnings

- None
