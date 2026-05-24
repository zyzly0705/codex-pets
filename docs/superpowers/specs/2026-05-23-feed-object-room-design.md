# Feed Object Room Design

## Goal

Make Yoyo's home feel less like a static background plus pasted animation by turning the `feed` interaction into a small object-driven scene.

## Scope

This is a vertical slice, not a full room rewrite. The existing room background stays in place. Only the food bowl becomes a scene object with state, layered rendering, and interaction timing.

## Runtime Model

The home stage gains an object layer between the room image and the pet:

1. `room-art`: current background scene.
2. `home-scene-objects`: interactive scene objects.
3. `pet-zone`: Yoyo canvas.
4. `object foreground`: object-front layers that can visually overlap the pet.
5. `room-effects` and UI.

For the first slice, the only object is `foodBowl`.

## Food Bowl Object

`foodBowl` has these states:

- `idle`: quiet bowl.
- `full`: food appears after the user clicks feed.
- `eating`: food is partly consumed while Yoyo plays the eating animation.
- `done`: bowl empties and shows the interaction result.

The object has separate visual layers:

- `back`: bowl body and shadow.
- `mealFull`: full food layer.
- `mealLow`: partially eaten food layer.
- `front`: bowl rim/foreground layer.

## Interaction Flow

When the user triggers `feed`:

1. Set `foodBowl` to `full`.
2. Move Yoyo visually toward the bowl.
3. Start the `eating` pet animation.
4. After a short delay, set `foodBowl` to `eating`.
5. While eating, apply a small nibble motion so the action reads as alive instead of a static pose.
6. Near the end, set `foodBowl` to `done` and apply a short satisfied bounce.
7. Reset the object to `idle` after the interaction ends.

The existing life state and care backend stay unchanged. This slice changes presentation, not the storage model.

## Asset Pipeline

`scripts/build-home-assets.js` should emit the layered food bowl assets alongside the existing home assets:

- `assets/yoyo/home/prop-food-back.webp`
- `assets/yoyo/home/prop-food-meal-full.webp`
- `assets/yoyo/home/prop-food-meal-low.webp`
- `assets/yoyo/home/prop-food-front.webp`

The source SVGs should also be written under `assets-src/yoyo/home/` for auditability.

## Acceptance

The slice is acceptable when:

- Clicking the food area visibly changes the food bowl state.
- Yoyo moves closer to the bowl for the feed action.
- The feed action has approach, eating, and satisfied phases.
- The bowl foreground layer remains visible above the interaction.
- Other home interactions still work.
- `npm run build:home-assets`, `npm test`, and `npm run check` pass or failures are explained.
