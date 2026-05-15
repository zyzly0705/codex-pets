# 咕咕嘎嘎 Sprite Brief

## Identity

咕咕嘎嘎 is an original chibi penguin-suit desktop companion. It should feel like a silly, round, slightly clueless little sidekick, not a direct copy of any existing meme image or game character.

The current `spritesheet.webp` is a runnable prototype only. It validates the package, menu, atlas size, and app integration, but it is not the final visual target.

## Visual Rules

- Codex digital pet style: compact chibi mascot, pixel-art-adjacent edges, thick 1-2 px dark outline, flat cel shading.
- Subject: a little girl inside a thick black-and-white penguin suit, not a plain penguin.
- Core recognition points: oversized penguin hood, yellow beak on the hood, hood eye spots, black bob haircut with straight bangs, blue hair clip, pale girl face, blue-gray eyes, blush, silver paperclip-like chest pendant, short yellow webbed feet.
- Body shape: large head, short rounded body, soft penguin-suit volume, small flipper arms, long right-rear tail/cape shape visible from front and side.
- Personality in silhouette: goofy, soft, waddly, slightly magical, easy to read at 120x130 CSS pixels.
- Avoid: official costumes, logos, readable text, watermarks, detailed anime rendering, glossy 3D, shadows, complex backgrounds.

## Reference-Derived Corrections

The local prototype is too generic. The final atlas should correct these points:

- Increase head-to-body ratio; the character should feel chibi and top-heavy.
- Make the face a human girl face inside the penguin hood, not a symbolic animal face.
- Make the penguin hood and body feel like one padded suit.
- Use cleaner anime-style thick outlines rather than flat SVG-like shapes.
- Make the long right-side tail/cape more prominent.
- Preserve the blue hair clip and paperclip pendant as identity anchors.
- Keep the default atlas simple; flag/spear imagery belongs to a special action or future outfit, not every idle frame.

## Atlas Contract

- Output: `spritesheet.webp`
- Cell size: `192x208`
- Columns: `8`
- Rows: `37`
- Full size: `1536x7696`
- Background: transparent.

## Required Rows

Use the row map in `pet.json`. Keep the same identity across all rows. Empty or unsupported rows should still exist as transparent or neutral fallback rows so the atlas dimensions remain exact.
