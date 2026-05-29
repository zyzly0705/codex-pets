# Yoyo AI Design Toolchain

This is the practical tool plan for rebuilding Yoyo assets without staying trapped in pixel-style patchwork. Yoyo is defined as `妈妈的小伴侣`: a human-like companion who lives, learns, rests, eats, watches animation, plays Switch, builds blocks, and studies with her mom. She is not a pet.

## Decision

Use a staged design pipeline:

1. Figma defines the visual contract.
2. Character-consistency generation creates Yoyo-safe poses.
3. Video generation creates motion references for complex actions.
4. Aseprite cleans and exports production art.
5. Codex scripts import, wire, screenshot, and test the result.

Figma CLI or Figma MCP is useful for reading and syncing design intent, but it is not the whole answer. The main improvement is separating layout, character identity, motion, cleanup, and runtime QA.

## Tool Roles

| Tool | Use It For | Do Not Use It For |
| --- | --- | --- |
| Figma | Style board, room floor plan, prop slots, layer split, scale proof, rejection examples | Final sprite frames or character animation quality |
| Scenario / character-consistency image tools | Full-body Yoyo master, pose candidates, identity-stable action keyframes | Room placement, UI layout, final edge cleanup |
| Runway / Krea / Kling / Luma | Motion references, timing, body mechanics, dramatic effect rhythm | Direct runtime sprites without cleanup |
| Aseprite | Frame cleanup, palette/edge control, layer separation, timing, sprite export | Fixing fundamentally wrong composition or identity |
| Codex scripts | Prompt packs, manifests, imports, chroma cleanup, spritesheets, screenshots, tests | Judging visual taste without screenshot evidence |

## Asset Routes

### Character Master

Output: `assets-src/yoyo/identity/yoyo-character-master.png`

Route:

1. Figma board locks approved Yoyo references and rejection examples.
2. Character-consistency generator produces front, side, back, expression, and pose-safe sheets.
3. Aseprite cleans the selected source.
4. Codex stores the accepted source and adds QA evidence.

Acceptance:

- Yoyo is human-like, not a dog or animal mascot.
- Product language should describe Yoyo as mom's little companion, not as a pet-care subject.
- Feeding uses normal human food on a table or in human dishes, never pet bowls or kibble.
- Sleeping means a bed, pillow, blanket, or cushion that reads as human furniture, not a pet bed.
- Full body is readable.
- Hair, face, outfit, palette, and proportions remain stable.

### Room

Output: `assets/yoyo/home/room-*.webp`

Route:

1. Figma defines camera, floor, wall, contact zones, and object slots.
2. Image generation creates room-shell candidates from that map.
3. Aseprite or image cleanup removes artifacts.
4. Browser/Electron capture proves Yoyo and props sit naturally in the room.

Acceptance:

- The room has intentional empty space.
- Furniture has clear floor contact and believable scale.
- No baked app UI or duplicate care props unless specified.

### Care Poses

Output: `assets-src/yoyo/home/poses/*.png` and runtime WebP exports.

Route:

1. Figma checks contact against bed, bath, food, toy, or affection prop.
2. Character-consistency generation creates full-body pose candidates.
3. Aseprite cleans the selected candidate and splits layers if needed.
4. Runtime screenshot proves the pose is grounded.

Acceptance:

- No half-body shortcuts.
- No floating Yoyo.
- No dog bowls, kibble, pet beds, paw motifs, or animal-mascot styling.
- Occlusion is allowed only when the foreground object physically explains it.

### Action Rows

Output: `assets/yoyo/spritesheet.webp`

Route:

1. Video reference for complex timing when needed.
2. Character-consistency generation for 24-frame core rows and 32-frame complex rows.
3. Aseprite cleanup and timing.
4. Contact sheets and GIF/preview videos.

Acceptance:

- Identity stays stable across frames.
- Motion reads from body mechanics, not pasted effects.
- High frame count improves motion, not hides bad art.

## Local Commands

Prepare a single asset run:

```bash
npm run design:yoyo-asset -- \
  --name home-feed-pose-v2 \
  --kind pose \
  --brief "Full-body Yoyo feeding pose with grounded contact beside the food bowl." \
  --reference assets/yoyo/spritesheet.webp \
  --reference assets/yoyo/home/prop-food.webp \
  --target assets-src/yoyo/home/poses/feed.png \
  --style-profile clean-2d
```

Prepare the whole redesign queue:

```bash
npm run design:yoyo-asset -- \
  --batch full-redesign \
  --name yoyo-redesign-v2 \
  --brief "Rebuild Yoyo character, home, care objects, poses, and action rows with a clean 2D toolchain." \
  --style-profile clean-2d
```

## Operating Rule

Do not integrate an asset just because it exists. Integrate it only when its run folder contains source, processed output, and QA proof.
