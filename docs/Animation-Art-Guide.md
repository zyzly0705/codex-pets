# Animation Art Guide

This guide is the visual contract for Yoyo animation work. It exists because complex actions cannot be made attractive by stacking runtime props on top of a generic standing sprite.

## Baseline Taste

Yoyo should read as a small, cute, pixel-adjacent desktop companion:

- Compact chibi proportions, readable at `192x208`.
- Full body visible unless the action has a physically justified foreground object.
- Soft, friendly expressions. Avoid pasted-on face marks, forehead marks, duplicated eyes, or oversized symbolic effects.
- A clear center of gravity. Feet, seat, water, sofa, or props must visually support the body.
- One coherent scene per frame. Do not mix a full-scene spritesheet with runtime-drawn duplicate props.

## Hard Rules

- Complex actions are drawn as complete frames in `assets-src/yoyo/aseprite/<action>.aseprite`.
- Runtime rendering must not draw a second water pool, sofa, air conditioner, swing, or fan over full-scene actions.
- Each complex action must have:
  - editable Aseprite source,
  - exported PNG frames,
  - frame-level anchor metadata under `assets-src/yoyo/anchors/`,
  - runtime spritesheet row,
  - contact sheet,
  - animated GIF preview,
  - visual review notes.
- If a pose only works because half the body is hidden, it is not accepted.
- If the frame looks like "character pasted beside prop", it is not accepted.
- If dialogue says one action but the sprite performs another, it is not accepted.

## Layer Model

Use this layer order for mini-scene `.aseprite` files:

1. `background`: room, pool, glow, quiet ambient shape.
2. `prop-back`: ropes, back cushions, water body behind character, air stream behind head.
3. `character`: Yoyo body, outfit, hair, face.
4. `prop-front`: seat lip, blanket edge, waterline, hands-on-prop overlap.
5. `fx`: small attached sparkles, bubbles, cooling lines.
6. `mask-guide`: optional hidden construction guides; never exported visibly.

## Action Standards

### `swimming`

Goal: playful pool motion, not a floating bust.

- Face and head remain readable in every frame.
- Body remains visible enough to understand full-body pose.
- Waterline should sit around lower chest or waist, not across eyes or mouth.
- Add small bubbles or waves around hands/feet, but no large blue rectangle over the face.
- Motion should alternate: bob, small arm reach, recovery.

### `swing`

Goal: Yoyo is using the swing, not standing beside it.

- Seat belongs under the body, not across the face.
- Ropes align with the seat and swing arc.
- Body leans slightly with the arc.
- Feet and hands should imply balance or grip.
- The whole silhouette must stay inside the cell.

### `sofaLying`

Goal: cozy rest, not a rotated standing sprite.

- Body lies on the sofa surface with head support.
- Blanket or cushion may cover part of the torso, but face, head, and enough body remain readable.
- Sofa perspective and body angle should match.
- Breathing motion should be small and slow.

### `fanCooling`

Goal: relief from heat.

- Fan is placed beside or behind Yoyo, not growing from the head.
- Wind lines should point consistently toward hair/clothes.
- Expression should be calm, relieved, or softly smiling.

### `airConditioning`

Goal: cool indoor rest.

- Air conditioner is a background object on wall space, not attached to Yoyo.
- Cold stream should occupy negative space and avoid covering the face.
- Yoyo should look relaxed, not alarmed.

### `digSand`

Goal: playful magical ground-dive, not animal digging and not a floating half-body sticker.

- Yoyo is a human little girl. Do not use paws, animal burrowing, pet tunnels, collars, or dog-like digging language.
- The first and last frames must be full-body grounded poses.
- Middle-frame partial cover is allowed only when a same-frame foreground ground lip physically overlaps the body.
- Hands, feet, or body must visibly touch the ground rim during sink and emerge frames.
- Dust must stay attached to the hole/rim; no detached floating clouds.
- Use the 24-frame video-reference workflow in `docs/Yoyo-DigSand-Video-Workflow.md`, then select 8 runtime keyframes for atlas row 17.

## Runtime Rules

Full-scene actions currently include:

- `swing`
- `fanCooling`
- `swimming`
- `airConditioning`
- `sofaLying`

For these states, `src/modules/render-engine.js` must only draw the spritesheet frame plus general global effects. It must not draw action-specific duplicate scenes.

## AI Scene Source Policy

Some full-scene strips are better started from AI-authored whole-scene frames than from procedural prop assembly. Keep those source strips under `assets-src/yoyo/ai-sources/`, then import them with:

```bash
npm run import:ai-scenes
npm run build:pet-assets
npm run qa:animations
```

The current imported AI scene rows are `fanCooling`, `swing`, `swimming`, `sofaLying`, and `whip`. Their visual contact should be reviewed by GIF/contact sheet first because older procedural anchors may be too strict or stale for AI-composited scene geometry.

## Review Checklist

Before accepting a complex action:

- Does `assets-src/yoyo/qa/animation-previews/review.json` have zero anchor-contact warnings?
- Does the GIF read correctly without pausing?
- Does the first frame alone explain the action?
- Are head, eyes, body, and prop readable at actual app size?
- Is there any duplicated prop from runtime rendering?
- Does the action match the dialogue in `src/modules/performance-script.js`?
- Does `npm run check` pass?
