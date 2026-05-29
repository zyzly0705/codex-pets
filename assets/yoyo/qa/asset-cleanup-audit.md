# Yoyo Asset Cleanup Audit - 2026-05-29

## Cleanup Scope

- Removed transient `tmp/` captures.
- Removed generated top-level `output/` batches after useful Yoyo references were migrated into canonical repo paths.
- Preserved tracked `output/hatch-pet/` reference material.
- Preserved tracked `output/generated-images-contact.png`.

## Migrated References

| Old source role | Canonical path |
| --- | --- |
| Style board reference | `assets-src/yoyo/reference/style/yoyo-style-board.png` |
| Rig identity source | `assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v2-alpha.png` |
| Older comfort composite reference | `assets/yoyo/qa/candidates/found/composite-pet-cushion-yoyo-redesign-v1.webp` |
| Older food prop reference | `assets/yoyo/qa/candidates/found/prop-food-redesign-v1.webp` |
| Older full-room candidate | `assets/yoyo/qa/candidates/found/room-full-clean2d-v3-candidate.png` |
| Older human-room candidate | `assets/yoyo/qa/candidates/found/room-human-clean2d-v4-candidate.png` |
| Final-art QA contact sheet | `assets/yoyo/qa/final-art/contact-sheet.png` |
| Final-art QA report | `assets/yoyo/qa/final-art/final-art-asset-report.json` |

## Remaining Footprint

| Area | Post-cleanup state |
| --- | --- |
| `output/` | 600K, 22 tracked/reference files |
| `tmp/` | Removed |
| `assets/yoyo/` | 45M, 181 files, runtime pack plus QA material |
| `assets-src/yoyo/` | 162M, 878 files, source art, references, rig packets, and redraw runs |

## Remaining Asset Audit

The current generated report is `assets/yoyo/qa/asset-pack-report.md`.

| Status | Count |
| --- | ---: |
| `keep` | 35 |
| `redraw` | 5 |
| `remove` | 0 |
| `experimental` | 104 |
| `archive` | 1 |

High-priority redraw work remains:

- `home/room-stage-v2.webp`: currently accepted as the saved compact runtime base; later cleanup should remove animal-pet room semantics without changing the lively v1 room direction.

Medium-priority redraw work remains:

- `home/room-stage-night.webp`
- `home/room-stage-rainy.webp`
- `home/room-stage-party.webp`
- `home/composite-pet-cushion-yoyo.webp`

Accepted during follow-up:

- `home/room-stage-v2.webp`: restored as the direct runtime background via `saved-compact-room` mode.
- `home/prop-food.webp`: accepted human meal tray runtime asset.
- `home/prop-food-back.webp`: accepted visible meal tray layer.
- `home/prop-food-front.webp`: transparent compatibility layer after removing the old bowl rim.
- `assets/yoyo/qa/home-feed-human-meal-runtime.png`: runtime feed placement proof with Yoyo beside the table instead of standing on it.
- `assets/yoyo/qa/home-saved-room-stage-v2-runtime.png`: runtime proof for the saved compact room base.
- `assets/yoyo/qa/home-saved-room-stage-v2-feed-runtime.png`: runtime proof for the saved compact room feed state.

## Verification

- `npm run audit:asset-pack`
- `npm run qa:yoyo-final-art`
- `npm test`
- `npm run check`

All verification commands passed after cleanup.
