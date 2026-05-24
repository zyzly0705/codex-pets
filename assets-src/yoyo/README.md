# Yoyo Source Frames

This folder is the design-tool source pipeline for `assets/yoyo/spritesheet.webp`.

Export transparent PNG frames from Aseprite, Photoshop, Krita, Clip Studio, or another design tool into:

```text
assets-src/yoyo/frames/<action-name>/<frame>.png
```

Accepted frame names are:

```text
00.png, 01.png, 02.png ... 07.png
0.png, 1.png, 2.png ... 7.png
frame-00.png, frame-01.png ... frame-07.png
```

Each frame must be exactly `192x208` with transparency. Full-scene actions such as `swing`, `fanCooling`, `swimming`, `whip`, `airConditioning`, `sofaLying`, and `typingCompanion` should be drawn as complete frames, not split into loose runtime props.

Existing AI scene strips are kept in:

```text
assets-src/yoyo/ai-sources/
```

To reimport the current AI-authored full-scene strips for `swing`, `swimming`, and `sofaLying`:

```bash
npm run import:ai-scenes
npm run build:pet-assets
npm run qa:animations
```

Build the runtime sheet:

```bash
npm run build:pet-assets
```

If Aseprite is installed, put editable source files here:

```text
assets-src/yoyo/aseprite/<action-name>.aseprite
```

Then export and build:

```bash
npm run export:aseprite
npm run build:pet-assets
```

Pixelorama is installed as a free local GUI editor on this machine, but it is not the primary automated exporter for this project. Use it to draw or adjust PNG frames, then place the exported frames under `frames/<action-name>/`. For fully automated `.aseprite -> PNG frames -> spritesheet.webp`, use Aseprite.

Run a strict design-source check:

```bash
npm run build:pet-assets -- --strict
```

Default mode fills missing source rows from the existing runtime spritesheet so you can replace one action at a time. Strict mode fails when any required source frame is missing.

Outputs:

```text
assets/yoyo/spritesheet.webp
assets-src/yoyo/qa/contact-sheet.png
assets-src/yoyo/qa/build-report.json
```

For complex action review, generate animated previews:

```bash
npm run qa:animations
```

Outputs:

```text
assets-src/yoyo/qa/animation-previews/<action>.gif
assets-src/yoyo/qa/animation-previews/<action>-contact.png
assets-src/yoyo/qa/animation-previews/review.json
```

Do not accept a full-scene action from a still image alone. Review the GIF at app scale and the contact sheet before updating the runtime sheet.

Generated mini-scene actions also write frame-level contact anchors:

```text
assets-src/yoyo/anchors/<action>.json
```

These anchors mark character points such as `face`, `hips`, and `feet`, plus scene points such as `waterline`, `seatTop`, and `bodyRestBounds`. `npm run qa:animations` reads them and reports concrete positioning failures before visual review.
