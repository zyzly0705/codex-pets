# Yoyo Redraw Candidate Review - 2026-05-29

## Candidate 01: Room Stage V2

- Target: `home/room-stage-v2.webp`
- Candidate: `assets/yoyo/qa/candidates/home-room-stage-v2-candidate-01.webp`
- Source: `assets-src/yoyo/redraw-runs/2026-05-29-room-stage-v2-candidate-01/source.png`
- Generator: built-in `image_gen`
- Runtime size: `1080x720`
- Review preview: `assets/yoyo/qa/candidates/home-room-stage-v2-candidate-01-yoyo-preview.png`

Verdict: keep as a strong candidate. The room now reads as a human-like companion room instead of a pet room. It keeps a clear central rug for Yoyo overlay, has a study corner, bed, shelves, plants, and no dog bowl, kibble, paw motif, animal bed, animal ears, or tail.

Direction update: this candidate is useful as a cleanup reference, but it is too calm to replace the livelier compact v1 room mood. The current target is to keep the warm, busy, high-energy `room-stage-v2.webp` feeling while removing animal-pet details. Do not use the larger full-room candidates as the main room direction.

Runtime decision: use the saved `assets/yoyo/home/room-stage-v2.webp` compact room directly as the default home background for now. The app now marks this mode as `saved-compact-room`, displays the saved room image, and suppresses generated shell furniture so the stored art is not duplicated. Proof captures:

- `assets/yoyo/qa/home-saved-room-stage-v2-runtime.png`
- `assets/yoyo/qa/home-saved-room-stage-v2-feed-runtime.png`

## Candidate 01: Prop Food

- Target: `home/prop-food.webp`
- Candidate: `assets/yoyo/qa/candidates/home-prop-food-candidate-01.webp`
- Source: `assets-src/yoyo/redraw-runs/2026-05-29-prop-food-candidate-01/source-alpha.png`
- Generator: built-in `image_gen` plus chroma-key removal
- Runtime size: `210x150`
- Alpha check: passed, all four corners transparent
- Review preview: `assets/yoyo/qa/candidates/home-room-stage-v2-candidate-01-feed-preview-v2.png`

Verdict: accepted into runtime. The prop reads as a human meal tray with tableware, rice, fruit, egg, and a cup. It avoids animal-feed semantics and fits the clean 2D chibi room style.

## Integration Note

The first feed placement preview put Yoyo too close to the tray and made her look like she was standing on the table. The corrected preview uses Yoyo beside the tray, with the tray composited in front.

Accepted runtime paths:

- `assets/yoyo/home/prop-food.webp`
- `assets/yoyo/home/prop-food-back.webp`
- `assets-src/yoyo/home/prop-food.png`
- `assets-src/yoyo/home/prop-food-back.png`
- `assets/yoyo/qa/home-feed-human-meal-runtime.png`

The previous food front and meal-state overlays were converted to transparent compatibility layers so the old bowl rim does not reappear during feed phases.
