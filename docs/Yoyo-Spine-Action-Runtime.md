# Yoyo Spine Action Runtime

Yoyo's reusable human-like actions should use Spine as the primary motion engine. PixiJS remains the renderer and scene compositor; Spine owns body motion, held props, facial motion, and animation transitions.

## Runtime Contract

Each Spine-backed action has a timeline under:

```text
assets/yoyo/effects/<effect-id>/timeline.json
assets-src/yoyo/effects/<effect-id>/timeline.json
```

For `watch-tv`:

```json
{
  "engine": "spine-pixi-v8",
  "effectType": "spine-action",
  "runtimeMode": "spine-action",
  "spine": {
    "skeleton": "spine/yoyo.skel.json",
    "atlas": "spine/yoyo.atlas",
    "skin": "default",
    "animation": "watch_tv",
    "idleAnimation": "idle_sit",
    "scale": 0.42
  }
}
```

For `play-switch`, the contract is the same except:

```json
{
  "id": "play-switch",
  "effectType": "spine-action",
  "spine": {
    "animation": "play_switch",
    "idleAnimation": "idle_sit"
  },
  "scene": {
    "mode": "game"
  }
}
```

Runtime entrypoint:

```text
src/main/effects.js -> triggerWatchTvEffect() -> effectType: spine-action
src/pixi-effect-stage.js -> makeSpineActionStage()
```

The stage loads the Spine skeleton and atlas through `@esotericsoftware/spine-pixi-v8`, then plays:

```js
character.state.setAnimation(0, 'watch_tv', false);
character.state.addAnimation(0, 'idle_sit', true, 0);
```

## Asset Folder

Expected files:

```text
assets/yoyo/effects/<effect-id>/spine/yoyo.skel.json
assets/yoyo/effects/<effect-id>/spine/yoyo.atlas
assets/yoyo/effects/<effect-id>/spine/yoyo.png
```

Source files should live in:

```text
assets-src/yoyo/effects/watch-tv/spine/
```

## Required Slots

Minimum useful slots for Yoyo:

- `head`
- `hair_back`
- `hair_front`
- `face`
- `eyes`
- `mouth`
- `torso`
- `upper_arm_l`
- `lower_arm_l`
- `hand_l`
- `upper_arm_r`
- `lower_arm_r`
- `hand_r`
- `skirt`
- `leg_l`
- `leg_r`
- `remote`
- `snack`

The `remote` and `snack` slots let actions attach props to hands instead of positioning props manually in Pixi.

## First Actions

Start with these animation names:

```text
idle_stand
idle_sit
watch_tv
eat_table
sleep_bed
play_switch
build_blocks
study
```

## Missing Assets

Spine actions are strict. If a required skeleton, atlas, or atlas page is missing, the runtime shows a missing-asset panel and does not render the old atlas proxy. This keeps unfinished actions visibly unfinished instead of silently turning them into hand-positioned pseudo-actions.

The first generated `watch-tv` and `play-switch` seeds live under `assets/yoyo/effects/<effect-id>/spine/` and can be regenerated with:

```bash
node scripts/generate-watch-tv-spine-assets.js
```
