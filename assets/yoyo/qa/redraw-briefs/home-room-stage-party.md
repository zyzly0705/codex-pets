# Redraw Brief: home/room-stage-party.webp

## Intent

Rebuild `home/room-stage-party.webp` for the Yoyo asset pack. Yoyo is a human-like companion, so the result should feel like a small desktop life companion asset rather than animal-pet care art.

## Production

- Priority: `medium`
- Kind: `room`
- Target path: `home/room-stage-party.webp`
- Status: `queued`
- Reason: Useful event variant, but should be rebuilt after the base room style is locked.

## Acceptance

- Reads as a human-like companion asset, not an animal pet asset.
- Avoid these semantics: dog bowl, kibble, paw motif, animal bed, animal ears, tail.
- Matches the clean-2d-chibi Yoyo style with soft linework and low visual noise.
- Preserves the target runtime path so existing Electron and Pixi code keeps working.
- Room composition keeps a cozy child-scale desktop companion space with clear usable zones.

## References

- `../../docs/Yoyo-Art-Bible.md`
- `home/room-shell-clean-2d.webp`
