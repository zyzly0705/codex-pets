# Yoyo Asset Hatch Workflow

Yoyo assets should be made through a repeatable hatch-style run instead of one-off drawing. The goal is to make every pose, prop, room, or effect carry a written visual contract, generated/imported source files, processing notes, and runtime screenshot proof.

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
