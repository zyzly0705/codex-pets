# Yoyo Art Bible

This is the style lock for the full Yoyo asset redesign. It is the acceptance baseline for character poses, home objects, rooms, action rows, and effects. The target style is `clean-2d`, not pixel art.

## Canonical Style

- Clean 2D chibi desktop pet, not pixel art and not polished anime key art.
- Full-body readability at actual runtime size comes before detail.
- Refined line art, clean contours, restrained cel shading, and readable edges.
- Yoyo keeps black straight bangs, a small top bun, round soft face, tiny limbs, navy outfit, white shirt, and red bow/ribbon accents.
- The room may be richer than the character, but character and props must still share scale, contact, and color temperature.

## Palette Lock

- Outline: `#171a20`
- Navy: `#2b3147`
- Skin: `#f5d0b8`
- Red accent: `#a84855`
- Cream: `#f4e9d0`
- Wall teal: `#73b7b6`
- Wood: `#b97551`
- Soft pink: `#e7949e`
- Green: `#5e7f61`
- Gold: `#d8ad54`
- Shadow: `#53677b`
- Highlight: `#fff7e8`

## Acceptance Rules

- Full body stays readable unless a foreground object physically explains partial cover.
- Every pose needs visible weight: feet, seat, bed, waterline, hands, or lower-body contact.
- A pose that only works by hiding the body is rejected.
- A character that looks pasted onto the room is rejected.
- Action rows should use high-frame source planning: core rows target 24 frames at 12 fps; complex rows target 32 frames at 12 fps.
- Low-resolution, blurry, or mosaic-like input must go through `enhanced/` before becoming accepted source art.

## Tool Strategy

- Use image generation for high-resolution character masters or pose redraws when the source idea is weak.
- Use Aseprite for frame timing, layer separation, cleanup, palette control, and spritesheet export.
- Use super-resolution tools such as Real-ESRGAN or chaiNNer only as an intermediate for sources that are compositionally right but too small or blurry.
- Use Figma only for UI/vector planning or shape references; it is not the main sprite production path.

## Current Style Board

The accepted visual style board is saved at:

`output/yoyo-asset-runs/yoyo-redesign-v1/assets/00-style-system/sources/yoyo-style-board.png`

## Character Master

The accepted clean 2D character master is saved at:

`assets-src/yoyo/identity/yoyo-character-master.png`

Use this as the identity lock for new pose and action generation. The older pixel sprite may be used as historical reference only, not as the quality ceiling.
