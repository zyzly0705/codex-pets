# Yoyo Asset Hatch Workflow

Yoyo assets should be made through a repeatable hatch-style run instead of one-off drawing. Yoyo is `妈妈的小伴侣`, not a pet: every pose, prop, room, or effect should support human-like companion life and carry a written visual contract, generated/imported source files, processing notes, and runtime screenshot proof.

## Single Asset Command

```bash
npm run design:yoyo-asset -- \
  --name home-sleep-pose \
  --kind pose \
  --brief "Full-body side sleeping Yoyo pose for the home bed." \
  --target assets/yoyo/home/home-sleep-yoyo.webp \
  --reference assets/yoyo/spritesheet.webp \
  --reference assets/yoyo/home/prop-bed-front.webp \
  --reference assets/yoyo/home/prop-bed-back.webp
```

For animation work, specify frame planning instead of accepting a tiny default:

```bash
npm run design:yoyo-asset -- \
  --name core-action-rows-v2 \
  --kind action-row \
  --brief "High-frame idle, waiting, eating, sleeping, petting, dancing, and failed rows." \
  --frames 24 \
  --fps 12 \
  --cell-width 384 \
  --cell-height 416 \
  --target assets/yoyo/spritesheet.webp
```

## Full Redesign Batch

```bash
npm run design:yoyo-asset -- \
  --batch full-redesign \
  --name yoyo-redesign-v1 \
  --brief "Rebuild Yoyo character, home, care objects, poses, and action rows as one coherent asset system."
```

The full batch creates phase-ordered asset jobs:

- Style lock: palette, outline, pixel density, rejection examples.
- Character lock: full-body Yoyo identity sheet.
- Home kit: room and layered care objects.
- Pose kit: feed, bath, sleep, play, and pet home poses.
- Action kit: high-frame rows, defaulting to 24 frames for core rows and 32 frames for complex rows.
- Runtime QA: screenshots, contact sheets, animation previews, tests.

The command creates:

- `asset-request.json`: the stable spec and acceptance rules.
- `prompts/visual-prompt.md`: the image-generation or manual art prompt.
- `candidates/`: raw generated/imported options.
- `sources/`: accepted editable/source art.
- `processed/`: extracted and optimized runtime assets.
- `qa/review-checklist.md`: visual, processing, and runtime gates.
- `workflow-manifest.json`: motion spec, target path, and gate structure.

## AI Design Tool Adapter

The workflow now treats design tools as separate production roles instead of one magic generator.

- Figma: layout contract. Use it for room maps, prop bounding boxes, scale checks, palette/style boards, accepted examples, and rejected examples. It is the place to prove furniture placement and floor contact before runtime wiring.
- Character-consistency image tools: Yoyo identity lock. Use Scenario, Ideogram-style character consistency, or a similar reference-based generator for full-body Yoyo masters, poses, and action strips.
- Video tools: motion reference only. Use Runway, Krea, Kling, Luma, or similar tools to explore timing for complex actions such as `digSand`, `clone`, `dharma`, sofa lying, swing, and bath movement. Do not treat video output as final runtime art until keyframes are selected, cleaned, and inspected.
- Aseprite: final art surgery. Use it for edge cleanup, layer separation, palette control, frame timing, and export.
- Codex scripts: deterministic production. Use them for manifests, prompt packs, chroma/import processing, spritesheets, screenshots, contact sheets, and tests.

Every run now writes tool-specific briefs under `toolchain/`:

- `toolchain/toolchain-brief.md`: which tools should be used and what each must output.
- `toolchain/figma-brief.md`: the board that proves layout, scale, contact zones, and layer splits.
- `toolchain/character-consistency-brief.md`: the prompt pack for Yoyo identity-safe pose generation.
- `toolchain/motion-reference-brief.md`: the video reference brief for high-frame or complex movement.
- `toolchain/aseprite-cleanup-brief.md`: cleanup and export checklist.

This means a bad output is rejected at the right layer:

- Furniture in the wrong place is a Figma/layout failure.
- Yoyo looking like a different character is a character-consistency failure.
- Pet-care semantics such as dog bowls, kibble, pet beds, paw motifs, or animal-mascot styling are a concept failure. Yoyo is a human-like companion.
- Feeding assets must use human food and human tableware; sleep assets must read as bed/blanket/pillow furniture.
- Floating or half-body Yoyo is a pose/source failure.
- Jerky or unclear action is a video/motion-planning failure.
- Jagged edges, stray pixels, or bad frame timing are Aseprite/export failures.
- Looks fine as a source but bad in the app is a runtime QA failure.

## Gates

Every asset must pass these gates before it is accepted:

- Spec: the request, kind, target, and references are explicit.
- Visual: Yoyo keeps the same identity, has full-body readability, and is grounded.
- Motion: frame count, FPS, source cell size, loop behavior, and preview output are explicit.
- Source quality: low-resolution or mosaic-like inputs must be enhanced, redrawn, or regenerated before they become accepted source art.
- Processing: transparent or clean chroma-key extraction, no clipped pixels, high-resolution source saved.
- Runtime: manifest/CSS wired, browser screenshot saved, tests run.

## Source Quality And Tools

If the original image is not detailed enough, do not push it straight into runtime. Route it through one of these paths:

- High-resolution regeneration: use image generation to create a larger master when the pose, style, or composition is wrong.
- Aseprite cleanup: use Aseprite for pixel-level edits, layer cleanup, palette reduction, and spritesheet export.
- Super-resolution pass: use a tool such as Real-ESRGAN or chaiNNer as an intermediate when the source is good but too small or blurry, then inspect and clean the result manually.
- Figma/vector reference: use Figma only for UI/vector layout references or shape planning; do not treat it as the main sprite production tool.

Every enhanced asset must keep evidence in `enhanced/`, accepted source in `sources/`, exported runtime files in `processed/`, and screenshot/contact-sheet evidence in `qa/`.

## Why This Exists

The home scene needs composited assets that behave like puzzle pieces, but the pieces still need designed contact, scale, and identity. Runtime layering can place props behind or in front of Yoyo; it cannot rescue an ugly or half-body pose. For complex poses, generate or draw the full pose first, then wire it into the room.

Higher frame counts help, but only after the style and character master are locked. A 24-frame bad pose is still bad; the workflow makes frame count a production parameter instead of a substitute for art direction.
