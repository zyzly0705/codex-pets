# Yoyo Asset System Refactor Design

Date: 2026-05-29

## Context

Yoyo's main bottleneck is now the asset system, not the behavior code. The project already has meaningful runtime modules for state, behavior, emotion, growth, relationship, desktop effects, home scenes, and action dispatch. Continuing to add isolated images or action rows will make the product feel more fragmented unless the asset foundation is cleaned up first.

This design focuses on borrowing the right lessons from two reference projects:

- Ark-Pets: model library, role selection, runtime asset profiles, desktop pet settings, and clear launcher-driven asset management.
- Agentic-Desktop-Pet: mod/theme thinking, where character bodies, behavior flavor, memory, emotion, and growth can be swapped or extended without rewriting the whole app.

The goal is not to switch to Java, libGDX, Godot, or Python. The goal is to make the current Electron/Pixi Yoyo project behave like a small desktop companion platform with a clean asset pipeline.

## Current Problems

The existing asset library has enough material, but it is not yet governed by one clear production standard.

### Mixed Asset Systems

Current assets include:

- `assets/yoyo/spritesheet.webp`
- `assets/yoyo/pet.json`
- `assets/yoyo/home/*`
- `assets/yoyo/scenes/*`
- `assets/yoyo/effects/*`
- `assets/yoyo/desktop-rig/*`
- `assets/yoyo/live2d/*`
- `assets-src/yoyo/*`
- `output/yoyo-asset-runs/*`

These represent several different production paths: classic spritesheet rows, home scene composites, timeline-based special actions, rig experiments, Live2D placeholders, and generated QA outputs. They are useful, but they are not yet organized as a coherent asset product.

### Style Drift

The Yoyo character is intended to be a clean 2D chibi human-like companion. Some room and care-scene assets are more detailed and pixel-illustrative than the character, which can make Yoyo look pasted into the scene rather than naturally present in it.

### Product Semantics Drift

The art bible says Yoyo is `妈妈的小伴侣`, not an animal pet. Some current room details still read as pet-care props: bowls, paw motifs, pet beds, or animal-style room logic. These details weaken the intended human companion framing.

### Too Many Actions Before Core Quality Is Locked

The main spritesheet already contains many rows. More actions are not the fastest path to better product feel. The high-frequency actions must be polished first:

- idle
- walk
- greet
- eat
- sleep
- study or work companion
- comfort
- play

If those actions are visually weak, extra special actions will not fix the experience.

## Design Goals

1. Turn Yoyo assets into structured installable packs.
2. Separate runtime assets from sources, experiments, and generated evidence.
3. Lock a small golden asset set before adding more actions.
4. Make each asset pack self-validating through manifest checks and visual QA.
5. Keep the current Electron/Pixi runtime, but make future Spine, rig, or Live2D bodies easier to plug in.
6. Preserve useful existing assets while clearly labeling redraw, removal, and experimental material.

## Non-Goals

- Do not rewrite the app in Java, Godot, or another engine.
- Do not immediately migrate all assets to Live2D.
- Do not keep adding large action rows before the core style and pack protocol are stable.
- Do not delete historical source or output folders as part of this design unless a later cleanup pass proves they are redundant.
- Do not block current Yoyo runtime behavior while the asset system is being normalized.

## Recommended Architecture

Introduce a first-class asset pack layer.

```text
Pet Pack
├── manifest.json
├── identity/
├── avatar/
├── home/
├── care-scenes/
├── special-actions/
├── rig/
├── qa/
└── sources/
```

The pack is the unit that the launcher, runtime, and future asset tools understand. Yoyo can start as the first pack, and later forms such as Gaga or seasonal looks can become separate dependent packs.

## Pack Directory Contract

### `identity/`

Stores canonical identity references:

- character master
- palette lock
- expression sheet
- scale reference
- accepted style board

These files answer: "Is this still Yoyo?"

### `avatar/`

Stores desktop runtime body assets:

- base spritesheet
- action rows
- optional split sheets
- frame metadata
- collision or anchor metadata

This is the direct runtime replacement for the current flat `spritesheet.webp` plus row declarations inside `pet.json`.

### `home/`

Stores room background and reusable home props:

- day room
- night room
- rainy room
- layered props
- room zones
- UI-safe zones

The home room should be treated as a designed stage, not a loose folder of images.

### `care-scenes/`

Stores care-specific scene assets:

- feed
- sleep
- bath
- play
- pet or comfort

Each care scene should declare foreground, background, character pose, contact zones, and expected UI placement.

### `special-actions/`

Stores richer actions that are too large for the core desktop spritesheet:

- study
- watch anime
- watch TV
- cook
- play Switch
- build blocks
- gift

These actions can use timelines, Spine exports, frame sequences, or future runtime drivers, but each action must expose the same high-level metadata.

### `rig/`

Stores experimental or future body systems:

- desktop-rig
- Spine
- Live2D
- layered PSD or Cubism prep

This folder is allowed to be incomplete, but it must be marked as experimental unless wired into runtime.

### `qa/`

Stores evidence:

- contact sheets
- action previews
- home scene screenshots
- runtime screenshots
- rejected examples when useful
- validation reports

No asset should be considered accepted without QA evidence.

### `sources/`

Stores editable or high-resolution source material:

- original generated images
- accepted source PNGs
- Aseprite files
- PSDs
- reference boards
- prompt packs

Runtime code should not load from `sources/`.

## Manifest Shape

The current `assets/yoyo/pet.json` should evolve from a spritesheet config into a pack manifest.

```json
{
  "id": "yoyo",
  "displayName": "Yoyo",
  "type": "companion",
  "style": "clean-2d-chibi",
  "semantics": {
    "species": "human-like companion",
    "avoid": ["dog bowl", "kibble", "paw motif", "animal bed", "animal ears", "tail"]
  },
  "identity": {
    "master": "identity/yoyo-character-master.png",
    "palette": "identity/palette.json",
    "styleBoard": "identity/style-board.png"
  },
  "avatar": {
    "driver": "pixi-spritesheet",
    "sheet": "avatar/spritesheet.webp",
    "cellWidth": 192,
    "cellHeight": 208,
    "scale": 0.75,
    "anchor": { "x": 0.5, "y": 1 },
    "actions": "avatar/actions.json"
  },
  "home": {
    "defaultRoom": "home/rooms/day.webp",
    "rooms": "home/rooms.json",
    "zones": "home/zones.json"
  },
  "careScenes": {
    "feed": "care-scenes/feed/scene.json",
    "sleep": "care-scenes/sleep/scene.json",
    "bath": "care-scenes/bath/scene.json",
    "play": "care-scenes/play/scene.json",
    "comfort": "care-scenes/comfort/scene.json"
  },
  "specialActions": {
    "study": "special-actions/study/action.json",
    "watchAnime": "special-actions/watch-anime/action.json"
  },
  "qa": {
    "contactSheet": "qa/avatar-contact-sheet.png",
    "homeScreenshot": "qa/home-default.png",
    "validatedAt": "2026-05-29"
  }
}
```

The exact file names can change during implementation. The important decision is that the manifest becomes the source of truth for every runtime asset, source boundary, and QA artifact.

## Asset Status Taxonomy

Every current asset should be assigned one status:

| Status | Meaning |
| --- | --- |
| `keep` | Good enough to remain in the accepted runtime pack. |
| `redraw` | Concept is useful, but style, scale, pose, or quality must be remade. |
| `remove` | Conflicts with Yoyo's companion semantics or is no longer needed. |
| `experimental` | Useful for future rig, Live2D, Spine, or toolchain work, but not accepted runtime art. |
| `archive` | Historical output or generated work that should be moved out of active production paths. |

This taxonomy prevents emotional indecision. Assets can be preserved without pretending all of them are production-ready.

## Golden Asset Set V1

Before adding more actions, define a small accepted set.

### Identity

- one character master
- one expression reference sheet
- one palette lock
- one scale guide against room props

### Desktop Avatar

- idle
- walk left and right
- greet or wave
- eat
- sleep
- study or work companion
- comfort or bashful
- play

### Home

- day room
- night room
- shared prop set
- safe UI zones

### Care Scenes

- feed
- sleep
- bath
- play
- comfort or pet

### Special Actions

- study
- watch anime or watch TV
- cook or drink water

This set is intentionally small. It should become visually coherent before the project invests in more animation volume.

## Runtime Integration

The runtime should keep compatibility with the current `pet.json` during migration.

Recommended flow:

```text
PackManifest
  -> PetManifestLoader
  -> AvatarRuntime
  -> BehaviorEngine / Interaction / HomeScene
```

The behavior engine should not care whether an action is rendered by a spritesheet row, a timeline, a Spine asset, or a future Live2D driver. It should ask for semantic actions:

```js
avatar.perform({
  action: "greet",
  emotion: "happy",
  intensity: 0.7
})
```

The asset pack decides how that action is rendered.

## Production Workflow

New assets should pass through these gates:

1. Spec: asset purpose, target path, references, style constraints.
2. Layout: room placement, contact zones, prop scale, foreground/background layering.
3. Identity: Yoyo still matches the canonical master.
4. Source quality: source is high-resolution enough for cleanup and export.
5. Cleanup: edges, palette, transparency, frame timing, and clipping inspected.
6. Runtime: loaded in the app and captured in a screenshot or preview.
7. Manifest: declared in the pack manifest and validated by script.

This matches the existing art bible direction while making acceptance enforceable.

## Borrowed Lessons

### From Ark-Pets

- Treat characters and models as browsable assets, not hardcoded files.
- Make model management a product surface.
- Put runtime settings next to model settings: scale, bounds, behavior, frame rate, transparency.
- Support external model libraries later, but start with one clean local pack.

### From Agentic-Desktop-Pet

- Treat character themes as mods.
- Let personality, emotion, growth, and assets evolve together.
- Keep the "body" replaceable so future characters do not require behavior-engine rewrites.
- Make a character pack feel like a living role, not only an image folder.

## Migration Plan

### Phase 1: Audit

- Generate an inventory of all assets under `assets/yoyo`, `assets-src/yoyo`, and relevant `output/yoyo-asset-runs`.
- Assign each asset `keep`, `redraw`, `remove`, `experimental`, or `archive`.
- Identify pet-semantics conflicts such as bowls, paw motifs, pet beds, and animal-care objects.
- Identify style mismatches between Yoyo and room art.

### Phase 2: Pack Skeleton

- Create the new pack folder shape.
- Move or copy only accepted runtime files into the skeleton.
- Keep existing runtime paths working until loader compatibility is ready.
- Add a first draft of the new pack manifest.

### Phase 3: Manifest Loader

- Add a loader that can read the new manifest.
- Keep old `pet.json` support as a compatibility path.
- Add validation for required pack fields, missing files, action names, dimensions, and QA references.

### Phase 4: Golden Asset Cleanup

- Redraw or replace only the golden V1 set.
- Remove or hide visual elements that push Yoyo back into animal-pet semantics.
- Produce contact sheets and runtime screenshots for each accepted action or scene.

### Phase 5: Launcher and Mod Surface

- Add a simple asset pack view in the existing UI or settings flow.
- Show pack identity, accepted actions, rooms, and status.
- Later, support enabling optional forms such as Gaga, seasonal rooms, or work-companion packs.

## Testing And QA

### Automated Checks

- manifest JSON schema validation
- required file existence
- image dimensions match declared dimensions
- action names match behavior/action taxonomy
- no runtime paths point into `sources/` or `output/`
- no accepted pack references files marked `experimental` or `archive`

### Visual Checks

- desktop avatar contact sheet
- core action GIF or screenshot preview
- day room screenshot
- night room screenshot
- care-scene screenshots
- special-action screenshot or frame contact sheet

### Product Checks

- Yoyo reads as a human-like companion.
- High-frequency actions look polished at runtime size.
- Yoyo is grounded in the room scene.
- Props and UI do not obscure key poses.
- The asset pack can be understood without reading runtime code.

## Risks

### Risk: Spending Too Long On Asset Theory

Mitigation: lock Golden Asset Set V1 and avoid expanding scope until it passes QA.

### Risk: Breaking Current Runtime Paths

Mitigation: add the new pack structure alongside existing `pet.json`, then switch loaders incrementally.

### Risk: Keeping Too Much Historical Output

Mitigation: mark historical output as `archive` and keep it outside accepted runtime manifests.

### Risk: Redrawing Everything

Mitigation: only redraw assets that affect high-frequency product feel or violate the companion identity.

## Acceptance Criteria

This refactor is successful when:

- Yoyo has one clearly documented asset pack manifest.
- The golden V1 set is declared and has QA evidence.
- Current accepted runtime assets are separated from sources and experiments.
- Every accepted asset has an explicit status.
- Pet-semantics conflicts are either removed from accepted runtime scenes or documented for redraw.
- The runtime can still launch Yoyo during migration.
- Future character or theme packs can follow the same folder contract.

## Recommended First Implementation Scope

The first implementation should be narrow:

1. Create an asset inventory script or report.
2. Add status metadata for current Yoyo assets.
3. Draft the new pack manifest without changing runtime behavior.
4. Validate file existence and image dimensions.
5. Produce a short QA report showing which assets are accepted, need redraw, or are experimental.

Only after this should the runtime loader be changed.
