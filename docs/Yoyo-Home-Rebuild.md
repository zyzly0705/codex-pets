# Yoyo Home Full Rebuild Plan

Date: 2026-06-02

## Decision

Yoyo Home should be rebuilt as a small life-simulation game, not patched as the current static room plus menu-action surface.

The rebuild is intentionally not backward-compatible with the current `src/home.js` runtime. The current home implementation may stay available during development behind a temporary flag, but the new runtime should have its own scene, simulation, asset manifest, tests, and debug tools. Compatibility with the desktop pet window and shared life data is preserved through a narrow adapter only.

## Product Target

Yoyo Home is a warm desktop companion nook where Yoyo lives inside the room. The room should feel alive even when the user does nothing:

- Yoyo idles, blinks, looks around, shifts weight, reacts to nearby room objects, and occasionally chooses a need-driven activity.
- Room objects are real interaction targets with state, not decorative images.
- User clicks should cause Yoyo to move to the object, face it, perform an animation, update needs, and return or settle naturally.
- Mini games should be embedded in room objects and write back to Yoyo's state.
- Desktop pet roaming and Yoyo Home share emotion and needs, but do not share rendering code.

The first version is successful when Yoyo can idle on the rug, become hungry, walk to the meal table, sit or stand correctly, eat with a real animation, update hunger and mood, and return to idle without any static replacement scene.

## Non-Negotiables

- Do not build another pile of static composites.
- Do not reintroduce `room-stage-v2`, old room-stage variants, or dog-bowl/pet-care room semantics.
- Do not use CSS-only particles or random temporary decorations as substitutes for authored interaction assets.
- Do not keep menu actions as the primary interaction model for Yoyo Home.
- Do not let the renderer own gameplay state.
- Do not make Yoyo teleport between actions unless a debug command explicitly requests it.
- Do not put all UI inside the game canvas; keep text-heavy HUD and debug controls in DOM.
- Do not delete `assets/yoyo/spritesheet.webp` until the desktop pet runtime has an accepted replacement driver.

## Current Evidence

Useful current assets and contracts:

- `assets/yoyo/home/room-v3-day-safe.webp`
- `assets/yoyo/home/room-v3-night-safe.webp`
- `assets/yoyo/home/room-v3-rainy-safe.webp`
- `assets/yoyo/home/room-v3-party-safe.webp`
- `assets/yoyo/desktop-rig/v1/manifest.json`
- `assets/yoyo/effects/*/timeline.json`
- `assets/yoyo/pack-manifest.json`
- `src/shared/desktop-edge-patrol.mjs`
- `src/modules/desktop-roaming.js`
- `src/main/life.js`
- `src/shared/yoyo-actions.js`

Current implementation to replace:

- `src/home.js` mixes DOM rendering, object creation, room art swapping, state handling, timers, mini-game routing, and animation decisions.
- `src/home.css` carries large layout and animation responsibilities that should move into the game renderer or typed scene config.
- `src/shared/home-scene.js` is a useful source of object names and rough coordinates, but it is not a clean simulation contract.
- `src/home-games.js` and `src/home-phaser-games.js` are useful prototypes, but mini games are currently attached to the room as overlays rather than part of a coherent home loop.

## Current Coupling To Stop Carrying

Do not continue the current Home runtime by gradually adding more state to the existing files.

The strongest anti-patterns to remove are:

- `src/home.js` acts as one giant orchestrator for DOM lookup, preferences, room scale, scene render, actor state, bubble text, care API, mini games, concert mode, wardrobe, ambient events, and debug behavior.
- `src/home.js` writes `dataset` attributes as an implicit state bus, then `src/home.css` interprets those attributes as gameplay state. The rebuild may still output dataset values for rendering, but business state must live in the simulation.
- `src/shared/home-scene.js` currently has overlapping action concepts: `interactionSystem.tasks`, action timelines, placement data, and older interaction tables. Rebuild with one schema.
- `src/home.css` mixes background generation, object placement, occlusion, action effects, mini-game UI, tool drawers, and modal surfaces. Rebuild CSS should style HUD and debug UI; room composition belongs in Phaser and manifest data.
- `src/home-games.js` currently owns overlay lifecycle, game implementation, reward settlement, `careForYoyo`, and `startHomeAnimation`. Rebuild games return `GameResult`; the home orchestrator applies rewards.
- `src/home-phaser-games.js` registers games globally. Rebuild games should be loaded by manifest keys through a `GameHost`.
- Concert, wardrobe, ambient beats, and decor controls should be feature modules. They must not live in the core room runtime.

## Contracts Worth Preserving

The rebuild is not a rejection of all existing work. These contracts are worth carrying forward:

- The room action timeline model with timed phases: `at`, `phase`, `stagePhase`, `pose`, and `animation`.
- `entity-prop` actions, where furniture is an interaction entity and not a static replacement scene.
- `inside-prop` and foreground mask semantics for actions like feed, sleep, bath, study, and playSwitch.
- The rule that a baked native room should not have duplicate prop art layered on top of it.
- The Spine/Pixi target plus cutout/canvas fallback strategy until the final actor driver is accepted.
- The desktop roaming pattern where pure geometry lives in `src/shared/desktop-edge-patrol.mjs` and the Electron/window-specific orchestration lives elsewhere.
- The shared care/life contract in `src/main/life.js` and `src/shared/yoyo-actions.js`, but only through a narrow adapter.

## Engine Choice

Use Phaser for the new Yoyo Home runtime.

Reasons:

- The project already depends on `phaser`.
- Yoyo Home is a 2D room with sprites, hotspots, object interaction, simple pathing, embedded mini games, and DOM HUD.
- Phaser gives a stable scene lifecycle, loader, animation manager, input system, camera, scale handling, and arcade-friendly debug tools.
- Pixi and Spine remain useful for desktop effects and authored action assets, but the room itself should not be another hand-built DOM renderer.

Do not use Three.js for this rebuild. The product target is a 2D cozy room, not a 3D scene.

## New Runtime Shape

Create a new home runtime under `src/yoyo-home/`.

```text
src/yoyo-home/
  index.js
  boot.js
  domain/
    home-action.js
    home-event.js
    timeline-step.js
    game-result.js
  scenes/
    BootScene.js
    RoomScene.js
    MiniGameScene.js
  sim/
    home-sim.js
    needs.js
    behavior-planner.js
    room-objects.js
    action-runner.js
    save-state.js
  render/
    asset-loader.js
    yoyo-actor.js
    room-renderer.js
    object-renderer.js
    animation-player.js
    camera.js
  input/
    action-map.js
    pointer-router.js
  ui/
    home-hud.js
    debug-panel.js
  data/
    home-manifest.js
    room-v3-safe-layout.js
```

The old `src/home.js` should not be incrementally reshaped into this. Build the new runtime beside it, prove the MVP, switch Electron Home to `src/yoyo-home.html`, then remove the old Home runtime files.

## Boundaries

Simulation owns:

- Yoyo needs: hunger, energy, hygiene, fun, focus, affection.
- Mood inputs and derived emotion.
- Room object state.
- Behavior choice.
- Current activity and activity lock.
- Saveable state.
- Rewards and mini-game results.

Renderer owns:

- Phaser scene lifecycle.
- Asset loading.
- Room background and object sprites.
- Yoyo animation playback.
- Camera and scale.
- Hit areas.
- Visual effects.
- Debug overlays.

DOM UI owns:

- Tool tray.
- Speech bubble.
- Need meters.
- Debug log view.
- Developer controls.
- Mini-game instructions only when text-heavy.

Main process owns:

- Window creation.
- IPC bridge.
- Persistent store.
- Shared life-state adapter.
- Desktop pet coordination.

Feature modules own:

- Wardrobe.
- Concert or performance mode.
- Ambient idle beats.
- Seasonal/decor controls.
- Optional special actions.

Feature modules register capabilities with the orchestrator. They do not directly mutate simulation state or renderer internals.

## Core Data Contracts

### Home Manifest

The new home should load from a manifest instead of hardcoded DOM selectors.

```js
{
  id: 'yoyo-home-v1',
  room: {
    size: { width: 1272, height: 720 },
    backgrounds: {
      day: 'assets/yoyo/home/room-v3-day-safe.webp',
      night: 'assets/yoyo/home/room-v3-night-safe.webp',
      rainy: 'assets/yoyo/home/room-v3-rainy-safe.webp',
      party: 'assets/yoyo/home/room-v3-party-safe.webp'
    }
  },
  actor: {
    id: 'yoyo',
    driver: 'spine-or-layered-rig',
    fallbackDriver: 'spritesheet',
    scale: 0.62,
    anchor: { x: 0.5, y: 1 }
  },
  objects: []
}
```

### Room Object

Every object has a stable id, semantic role, hit area, actor position, facing, capabilities, and optional mini-game.

```js
{
  id: 'mealTable',
  kind: 'meal-table',
  label: '吃饭',
  layer: 'floor',
  hitArea: { x: 56, y: 480, width: 270, height: 170 },
  actorSpot: { x: 230, y: 610, facing: 'left' },
  capabilities: ['feed'],
  miniGame: 'catchFood',
  state: {
    mealVisible: true,
    cleanliness: 1
  }
}
```

Native-room prop policy:

```js
{
  nativeRoomPolicy: {
    bakedFurniture: true,
    renderPropSprite: false,
    renderHitArea: true,
    renderForegroundMask: 'only-during-active-phase'
  }
}
```

This policy prevents the old failure mode where a complete room background is loaded and then the runtime adds another bed, table, shelf, or toy pile on top of it.

### Action Definition

Actions are behavior sequences, not one-off callbacks.

```js
{
  id: 'feed',
  objectId: 'mealTable',
  requiredNeed: 'hunger',
  phases: [
    { type: 'notice', animation: 'look_food', durationMs: 400 },
    { type: 'moveToObject', pathPolicy: 'floor-line' },
    { type: 'faceObject' },
    { type: 'perform', animation: 'eat_loop', durationMs: 3200 },
    { type: 'applyState', needs: { hunger: +35, mood: +8 } },
    { type: 'settle', animation: 'happy_idle', durationMs: 900 }
  ]
}
```

## Behavior Loop

The sim ticks at a fixed cadence, independent of render FPS.

The core loop is:

```text
Input -> Intent -> HomeEvent -> Reducer -> Behavior Planner -> Action Runner -> Render
```

The reducer is the source of truth. The renderer receives state snapshots and render commands; it does not decide gameplay outcomes.

Each tick:

1. Decay needs over time.
2. Read external context from the desktop app: time of day, weather, recent user activity, latest direct care action.
3. Convert user input, mini-game results, and external life changes into `HomeEvent` objects.
4. Reduce events into `HomeState`.
5. If no activity is locked, score possible behaviors.
6. Select one behavior only when it has a clear reason and cooldown is satisfied.
7. Emit an action request to the action runner.
8. Renderer plays the sequence and reports phase completion.
9. Sim applies state changes and saves.

`HomeState` must contain at least:

- Needs.
- Relationship.
- Current task.
- Active mini game.
- Room entities.
- Aftermath state.
- Daily quests or lightweight goals.
- Cooldowns.
- RNG seed.
- Event log.

Initial needs:

| Need | Starts | Decays | Restored by |
| --- | ---: | --- | --- |
| hunger | 70 | slowly | meal table, food mini game |
| energy | 70 | medium | bed, quiet idle |
| hygiene | 70 | slowly | wash stand |
| fun | 60 | medium | toy shelf, Switch, blocks |
| focus | 55 | slowly | study desk |
| affection | 65 | slowly | cushion, user click, desktop petting |

## First MVP

Build only one real loop first: feed.

MVP scope:

- New Phaser-backed room loads `room-v3-day-safe.webp`.
- Yoyo appears on the rug using the accepted current appearance or a temporary rig-compatible fallback.
- Meal table is a real room object with hit area and actor spot.
- User clicks meal table.
- Yoyo turns toward the table, walks there, faces it, performs an eating animation, updates hunger/mood, speaks one short line, then returns to idle.
- Hunger can also trigger the same action automatically after a cooldown.
- Debug panel logs every phase: selected behavior, path start, path end, animation, state delta, completion.

MVP exit criteria:

- No static feed composite replaces the room.
- No old room-stage asset is referenced.
- Yoyo's feet stay on the floor line during movement.
- Yoyo faces the target during the active phase.
- Interaction can be repeated without accumulating duplicate DOM nodes or timers.
- A screenshot proves room, Yoyo, meal table, bubble, and debug overlay are visible.

## Asset Plan

### Keep For Now

- `assets/yoyo/home/room-v3-*-safe.webp`
- `assets/yoyo/home/yoyo-home-v7-room-palette.webp`
- `assets/yoyo/home/prop-v3-*.webp`
- `assets/yoyo/desktop-rig/v1/*`
- `assets/yoyo/effects/*/timeline.json`
- `assets/yoyo/spritesheet.webp`
- `assets/yoyo/pet.json`

### Ban From New Runtime

- Deleted `room-stage-*` room backgrounds.
- Deleted `home-room-stage-v2-candidate-*` QA candidates.
- Static care composites as primary action output.
- Dog-bowl, kibble, paw motif, animal bed, animal ears, tail, kennel semantics.
- Ad hoc CSS particles as a replacement for authored effects.

### Required New Assets

For the feed MVP:

- Yoyo rig or Spine action set with `idle`, `walk_left`, `walk_right`, `turn_left`, `turn_right`, `eat_start`, `eat_loop`, `eat_end`, `happy_idle`.
- Meal table object metadata with hit area, actor spot, and optional foreground mask.
- Optional hand/utensil overlay only if authored in the same rig system.

For full rebuild:

- Sleep set: `sleepy`, `walk_to_bed`, `sit_or_lie`, `sleep_loop`, `wake`.
- Wash set: `walk_to_wash`, `wash_loop`, `fresh_idle`.
- Play set: `notice_toy`, `walk_to_toy`, `play_loop`, `cheer`.
- Study set: `walk_to_desk`, `sit_focus`, `write_or_read_loop`, `star`.
- Comfort set: `walk_to_cushion`, `sit`, `happy_pat_loop`, `relaxed_idle`.

## Asset Package V4

The rebuild should introduce a clean asset package instead of extending the mixed `home/prop-*`, `home/prop-v3-*`, `composite-*`, and experimental effect naming.

Recommended structure:

```text
assets/yoyo/home-v4/
  manifest.json
  rooms/
    room-v4-day.webp
    room-v4-night.webp
    room-v4-rainy.webp
    room-v4-party.webp
    room-v4-day-foreground.webp
    room-v4-night-foreground.webp
    room-v4-rainy-foreground.webp
    room-v4-party-foreground.webp
  slots/
    room-v4-slot-map.json
  props/
    prop-v4-meal-table.webp
    prop-v4-bed.webp
    prop-v4-wash-stand.webp
    prop-v4-toy-shelf.webp
    prop-v4-comfort-cushion.webp
    prop-v4-media-screen.webp
    prop-v4-game-console.webp
    prop-v4-blocks.webp
    prop-v4-study-desk.webp
  character/
    yoyo-v4-rig.json
    parts/
  actions/
    action-v4-feed/manifest.json
    action-v4-sleep/manifest.json
    action-v4-bath/manifest.json
    action-v4-play/manifest.json
    action-v4-comfort/manifest.json
    action-v4-study/manifest.json
    action-v4-watch-anime/manifest.json
    action-v4-play-switch/manifest.json
    action-v4-build-blocks/manifest.json
  qa/
    contact-sheets/
    runtime/
```

The V4 manifest should be explicit about identity, accepted assets, temporary assets, forbidden inputs, and QA requirements.

```json
{
  "version": 4,
  "id": "yoyo-home-v4",
  "style": "clean-2d-chibi",
  "identityLock": "assets-src/yoyo/identity/yoyo-character-master.png",
  "runtimeDriver": "pixi-layered-rig",
  "temporaryFallbackDriver": "pixi-spritesheet",
  "rooms": [],
  "props": [],
  "actions": [],
  "forbiddenSources": [],
  "qaRequired": [
    "contactSheet",
    "runtimeScreenshot",
    "dimensionCheck",
    "semanticCheck",
    "duplicateFurnitureCheck",
    "contactPointCheck"
  ]
}
```

Allowed asset statuses:

| Status | Meaning | Runtime allowed |
| --- | --- | --- |
| `accepted` | Approved for the new Home runtime. | yes |
| `temporary` | Short-lived bridge while the accepted asset is missing. | yes, with a removal issue |
| `experimental` | Prototype or research asset. | no |
| `reference-only` | Useful style or pose reference. | no |
| `forbidden` | Must not be used or regenerated from. | no |
| `archived` | Historical backup. | no |

The runtime may reference only `accepted` assets and explicitly named `temporary` fallbacks.

## Asset MVP Checklist

MVP assets must prove the new system can support real room interaction:

- 4 room backgrounds at 1272x720: day, night, rainy, party.
- 4 foreground/mask layers matching the same room variants.
- 1 `slot-map.json` with feed, bath, sleep, play, comfort, watchAnime, playSwitch, buildBlocks, and study slots.
- 9 transparent props: meal table, bed, wash stand, toy shelf, comfort cushion, media screen, game console, blocks, study desk.
- 1 accepted Yoyo layered rig with head, bangs, bun, face, eyes, mouth, torso, bow, arms, hands, legs, and shoes.
- Expression set: neutral, happy, shy, sleepy, angry, sad, surprised, blink, talk_small, talk_round, talk_flat.
- Feed action chain with contact points, loop segment, foreground mask policy, and return-to-idle transition.
- QA evidence: room contact sheet, prop contact sheet, expression contact sheet, feed runtime screenshot, dimension check, semantic check, duplicate furniture check, contact-point check.

The current `room-v3-safe` set can serve as temporary room backgrounds. It should not be treated as the final V4 room package until foreground masks, slot map, and QA evidence are complete.

## Mini Games

Mini games are optional object capabilities, not the main care system.

Rules:

- A room object starts a mini game only after Yoyo reaches the object.
- Mini-game result writes to simulation state.
- Closing or failing a mini game returns to the room action flow.
- Phaser may host the playfield; DOM may host text-heavy prompts or debug data.
- Mini games are the `active` phase of a `HomeTask`, not independent overlays.
- Life state updates exactly once per completed task.
- Failed or low-score mini games still create aftermath and feedback; they do not silently do nothing.

Initial mapping:

| Object | Action | Mini game |
| --- | --- | --- |
| mealTable | feed | catchFood |
| toyShelf | play | toyTrail |
| gameConsole | playSwitch | rhythmPat |
| studyDesk | study | guessMood |
| blocks | buildBlocks | toyTrail variant |

Task lifecycle:

```text
approach -> invite -> active -> result -> careDelta -> aftermath -> idle
```

`active` carries an `activeTask` payload. If the room object has an embedded mini game,
`activeTask.mode` is `miniGame`; otherwise it is `interaction`.

Example feed task:

1. Yoyo walks to the meal table.
2. The table/plate area becomes the `catchFood` playfield.
3. Score creates a `GameResult`.
4. The reducer applies hunger, mood, relationship, and quest deltas.
5. The meal table enters `after-meal`.
6. Yoyo reacts and returns to idle.

## Desktop Pet Integration

Desktop roaming remains separate.

Keep:

- Edge patrol and gravity system.
- Desktop action dispatcher.
- Shared emotion and needs inputs.
- Debug logs from `src/main/life.js`.

Replace:

- Home-specific menu action shortcuts as the main interaction path.
- Static desktop props for care actions when the Home window is open.

Bridge:

```js
desktopLifeState -> homeSim.applyExternalEvent(event)
homeSim completion -> desktopLifeState.applyCareResult(result)
```

The bridge should be the only shared surface between desktop roaming and Home. Desktop roaming keeps its own renderer and window behavior; Home keeps its own Phaser renderer and simulation.

## Character Driver Strategy

The actor driver is the riskiest part of the rebuild, so it needs an explicit fallback ladder.

Preferred driver:

- Spine or a project-local layered rig with named animations, named attachment parts, and expression controls.

Temporary fallback:

- Current spritesheet or `home/yoyo-home-v7-room-palette.webp` only for bootstrapping placement and movement.

Fallback limits:

- Fallback may prove pathing, click routing, and behavior state.
- Fallback may not be accepted as the final "alive" character result.
- The feed MVP must still expose the same animation names the final driver will use.

Required driver API:

```js
actor.play('idle');
actor.play('walk_left');
actor.play('turn_right');
actor.play('eat_loop');
actor.setFacing('left');
actor.setExpression('happy');
actor.moveTo({ x: 230, y: 610 });
```

The renderer may implement this API with Spine, a layered rig, or the fallback spritesheet. The simulation must not know which driver is active.

## Debug Requirements

The rebuild must include a visible debug mode from day one.

Debug panel shows:

- Current sim tick.
- Needs.
- Mood.
- Current activity.
- Current task lifecycle phase.
- Active scene.
- RNG seed.
- Selected behavior reason.
- Current target object.
- Current animation.
- Timer count.
- Last state delta.
- Last care delta.
- Last mini-game result.
- Asset load errors.

Debug logs must be structured and searchable:

```js
{
  channel: 'yoyo-home',
  event: 'action_phase',
  actionId: 'feed',
  phase: 'perform',
  objectId: 'mealTable',
  animation: 'eat_loop',
  at: 123456
}
```

Debug controls:

- Pause sim.
- Single-step tick.
- Force need value.
- Force action.
- Fix RNG seed.
- Export the latest 200 `HomeEvent` entries.

## Test Plan

Unit tests:

- Need decay and restoration.
- Behavior scoring and cooldown.
- Action phase sequencing.
- Room object manifest validation.
- Save-state serialization.
- Desktop-to-home event adapter.

Integration tests:

- Feed action starts from a click.
- Hunger can auto-select feed.
- Action lock prevents overlapping actions.
- Mini-game result updates needs.
- Renderer receives ordered action phases.
- A hotspot click produces the full task lifecycle: `approach -> invite -> active -> result -> careDelta -> aftermath -> idle`.
- Life state updates exactly once for one completed task.
- Low-score mini-game results still produce aftermath feedback.
- Closing and reopening Home does not leak timers or duplicate input handlers.

Asset tests:

- No banned room-stage files are referenced.
- All manifest assets exist.
- Rig declares required MVP animations.
- Room background dimensions are 1272x720.

Visual/playtest gates:

- Playwright opens the Home window.
- Screenshot confirms v3-safe room loaded.
- Pixel check confirms the canvas is not blank.
- Yoyo moves at least 120 px during feed action.
- The feed action stays in the same room scene and does not switch to a static overlay scene.
- Meal-table aftermath is visible after feed completion.
- Debug panel records all feed phases.

## Current Implementation Progress

As of 2026-06-02, the rebuild has replaced the active legacy Home runtime:

- `src/yoyo-home-preview.html` runs the new Home preview over HTTP.
- `src/yoyo-home.html` is the Electron-ready rebuild entry.
- `src/yoyo-home/data/home-manifest.mjs` owns the first new room/object manifest.
- `src/yoyo-home/sim/home-sim.mjs` owns needs, task lifecycle, task result reduction, and aftermath.
- `src/yoyo-home/scenes/RoomScene.mjs` loads the v3-safe room in Phaser and routes room clicks into reducer events.
- `src/yoyo-home/minigames/feed-catch.mjs` implements the first embedded room mini game for the feed active phase.
- `src/yoyo-home/minigames/room-tap-sequence.mjs` implements the first shared in-room mini-game host for `toyTrail`, `rhythmPat`, and `guessMood`.
- `src/yoyo-home/render/home-activity-stage.mjs` renders action-specific non-mini-game activity stages for sleep, bath, comfort, and watchAnime, with per-action motifs, progress, particles, and task result detail.
- `src/yoyo-home/render/yoyo-actor.mjs` gives the fallback actor action-specific loop motion for sleep, bath, comfort, study, watch, game, eating, and completion states while the accepted rig driver is still pending.
- `src/yoyo-home/bridge/electron-life-bridge.mjs` maps Electron life snapshots into Home needs and sends completed Home tasks back through `life:care`.
- `src/yoyo-home/render/yoyo-actor.mjs` provides the temporary actor fallback while the accepted rig driver is not ready.
- `scripts/check-yoyo-home-entry.js` proves the active Electron Home entry is `src/yoyo-home.html` and does not load the old Home runtime chain.
- `scripts/check-yoyo-home-quarantine.js` proves the old `src/home.*` runtime line stays deleted from active source and excluded from packaged app files.
- `scripts/capture-home-scene.js` now captures `src/yoyo-home.html` and drives actions through `YOYO_HOME_REBUILD_RUNTIME.startAction`, not old DOM menu globals.
- `tests/yoyo-home-rebuild.test.mjs` includes a Playwright smoke test proving the preview boots, renders a nonblank Phaser canvas, starts feed from the meal table, runs `catchFood`, starts study from the study desk, runs `guessMood`, starts sleep from the bed, runs `sleepActivity`, and writes aftermath.
- `tests/home-scene-assets.test.mjs` now tests the Phaser Home manifest, object tasks, accepted v3-safe room assets, and deleted legacy DOM Home files.
- The Playwright rebuild smoke now proves feed, study, sleep, and bath all complete inside the same Phaser room, with sleep and bath returning distinct activity-stage motifs.

Local preview command:

```bash
npm run preview:yoyo-home
```

The new Phaser runtime is now the shipped Home window. The rebuild is not complete until all required room-object actions are implemented and the old `src/home.js` line is removed or fully quarantined outside the active product.

Electron migration status:

- The default Home entry is `src/yoyo-home.html`.
- `openHome()` no longer has a legacy `src/home.html` fallback path.
- `npm run check` validates the active `yoyo-home.html` entry, the new `src/yoyo-home/` runtime, and the quarantine boundary instead of checking `src/home.js` as active Home code.
- The packaged app explicitly excludes the deleted legacy Home files: `src/home.html`, `src/home.css`, `src/home.js`, `src/home-games.js`, `src/home-phaser-games.js`, `src/home-spine-action.js`, `src/home-spine-feed-assets.js`, and `src/shared/home-scene.js`.
- `assets/yoyo/pack-manifest.json` now points Home zones to `../../src/yoyo-home/data/home-manifest.mjs`, not `../../src/shared/home-scene.js`.
- `YOYO_HOME_DEBUG=1` adds debug query parameters for the rebuild entry.
- The bridge is intentionally narrow: `life:get` hydrates the Home sim, completed Home tasks call `life:care` with `source: 'home'`, and `life:changed` syncs needs back into the Phaser state/debug panel.

## Migration Plan

### Phase 0: Remove Old Home

- Delete the old DOM runtime from active source.
- Stop adding features to `src/home.js`; it no longer exists in the active rebuild line.
- Keep tests that prevent banned assets from returning.
- Keep old Home source excluded from packaged app files so accidental re-adds do not ship.

### Phase 1: New Shell

- Add `src/yoyo-home/`.
- Add Phaser boot scene and room scene.
- Load `room-v3-day-safe.webp`.
- Add DOM HUD and debug panel.
- Add manifest validation tests.

### Phase 2: Yoyo Actor

- Implement `YoyoActor`.
- Use current sprite fallback only until rig/Spine MVP is accepted.
- Add floor-line movement and facing.
- Add idle variants.

### Phase 3: Feed MVP

- Add meal table object.
- Add feed action phases.
- Add need updates.
- Add debug logs.
- Add visual test.

### Phase 4: More Objects

- Add sleep, wash, play, study, comfort.
- Add foreground masks only where needed.
- Add object state changes.

### Phase 5: Mini Games

- Move current prototypes into object-triggered Phaser scenes.
- Add result contracts.
- Add pause/resume behavior.

### Phase 6: Switch Runtime

- Make `src/yoyo-home.html` the default Home entry.
- Remove old home runtime files after tests and visual gates pass.
- Update packaging and docs.

## Open Decisions

- Whether the accepted actor driver is Spine, a custom layered rig, or a short-lived spritesheet fallback.
- Whether room object foreground masks are authored as separate images or generated from metadata.
- Whether Home saves independently or only through the existing main-process store.
- Whether Home can run while the desktop pet is actively roaming, or whether entering Home pauses roaming.

## Definition Of Done

The rebuild is not done until:

- `src/yoyo-home/` owns the Home runtime.
- `src/home.js` is no longer the default active room implementation.
- At least feed, sleep, wash, play, study, and comfort are room-object actions.
- Yoyo moves through the room for every action.
- Non-mini-game furniture actions have action-specific in-room activity presentation, not one generic placeholder overlay.
- Actions update persistent needs and mood.
- At least one mini game is object-triggered and writes back to the sim.
- No banned v1/stage room asset can be found in active runtime sources or manifests.
- `npm run check` passes.
- `npm test` passes.
- A Playwright visual test proves the Home scene renders and the feed MVP moves.
- `capture:home` captures the Phaser rebuild, not the old static Home page.
