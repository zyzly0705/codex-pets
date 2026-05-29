# Redraw Brief: home/composite-pet-cushion-yoyo.webp

## Intent

Rebuild `home/composite-pet-cushion-yoyo.webp` for the Yoyo asset pack. Yoyo is a human-like companion, so the result should feel like a small desktop life companion asset rather than animal-pet care art.

## Production

- Priority: `medium`
- Kind: `composite`
- Target path: `home/composite-pet-cushion-yoyo.webp`
- Status: `queued`
- Reason: Useful comfort concept, but label and framing should shift from petting to companion comfort.

## Acceptance

- Reads as a human-like companion asset, not an animal pet asset.
- Avoid these semantics: dog bowl, kibble, paw motif, animal bed, animal ears, tail.
- Matches the clean-2d-chibi Yoyo style with soft linework and low visual noise.
- Preserves the target runtime path so existing Electron and Pixi code keeps working.
- Composite keeps Yoyo readable at runtime scale and frames the interaction as care or comfort.

## References

- `../../docs/Yoyo-Art-Bible.md`
- `home/composite-sleep-bed-yoyo.webp`
