# Yoyo Home V7 Interaction Design

## Goal

Make Yoyo's home feel like one coherent illustrated scene by replacing the home-only runtime character preview with the V7 room-palette Yoyo cutout, while adding a reusable interaction timeline that gives care actions visible anticipation, movement, active loops, completion feedback, and settle timing.

## Scope

This first pass is intentionally narrow:

- Add a reversible V7 home character mode for `src/home.html`.
- Keep the existing spritesheet path available as fallback.
- Add timeline metadata to every `interactionSystem.tasks` care action.
- Implement timeline-driven semantic, motion, pose, and animation attributes in `src/home.js`.
- Polish CSS fallback motion for the current V7 cutout while keeping the target runtime open for Spine/Pixi.
- Preserve the existing audit and capture workflows.

## Interaction Model

Each care action can define `timeline` entries with:

- `at`: milliseconds from action start.
- `phase`: semantic action phase such as `notice`, `walk`, `active`, `complete`, or `settle`.
- `stagePhase`: motion phase for CSS fallback, usually `anticipate`, `enter`, `active`, `complete`, or `settle`.
- `state`: object state to apply to the action prop.
- `pose`: optional home character pose hint.
- `animation`: the stable clip name that a future Spine/Pixi driver should play.

The runtime writes these values onto `.room-stage` as data attributes: `data-action-phase`, `data-motion-phase`, `data-action-pose`, and `data-action-animation`. CSS consumes `data-motion-phase` and selected clip names for fallback motion. A future Spine/Pixi driver should consume `data-action-animation` directly.

## Native Room Prop Rule

If the saved room background already contains the target furniture or care prop, the interaction must use `mode: native-room-zone` and must not reveal an additional layered prop for the same object. This is a product rule, not a one-off cleanup: avoid duplicate beds, duplicate food, duplicate sinks, or any other repeated native-room object. Layered props are reserved for objects that are missing from the room art or intentionally need a separate animation layer.

For the current saved compact room, every home action is treated as `native-room-zone`. The V3 prop files remain registered as source/reference assets, but the active runtime must not reveal them on top of the saved room image. Until a proper expanded room or authored action rig exists, Yoyo and lightweight effects move; room furniture stays native.

The saved room viewport must also remain non-scrollable and uncropped. `.room-world` uses `overflow: clip`, preserves the source 1080x720 aspect ratio, and fits inside the available window instead of using `cover`. The runtime resets `scrollLeft`/`scrollTop` during scene render so automated or browser-assisted hit testing cannot expose the stage background.

## V7 Character Strategy

The V7 art is used only inside Yoyo home. It does not replace `assets/yoyo/spritesheet.webp` yet. The page renders a new image layer above the existing `home-pet` canvas. When `data-home-character-mode="v7-cutout"` is active, the canvas fades out and the V7 cutout is shown with room-native filtering, shadow, and timeline motion.

## Action Behavior

- `feed`: Yoyo reacts, hops/steps toward the native food table in the room art, does a small eating loop, then pops up satisfied. It does not add a second meal table.
- `bath`: Yoyo moves to the wash stand, bobs with bubble effects, then settles clean and happy.
- `sleep`: Yoyo moves to the bed area more slowly, the room softens, breathing/zzz feedback appears, then settles without a harsh snap.
- `play`, `pet`, `watchAnime`, `playSwitch`, `buildBlocks`, and `study`: each now has the same full action chain and stable animation clip names, even while the visible fallback remains lightweight.

## Validation

- Unit tests should confirm V7 mode and timeline metadata exist.
- `npm run capture:home` should still produce screenshots.
- The interaction audit at `output/home-interaction-audit-2026-05-31/summary.md` should show every hotspot resolving to an active runtime animation without click interception.
