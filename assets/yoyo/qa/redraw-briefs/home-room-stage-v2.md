# Redraw Brief: home/room-stage-v2.webp

## Intent

Rebuild `home/room-stage-v2.webp` for the Yoyo asset pack. Yoyo is a human-like companion, so the result should feel like a small desktop life companion asset rather than animal-pet care art.

## Production

- Priority: `high`
- Kind: `room`
- Target path: `home/room-stage-v2.webp`
- Status: `queued`
- Reason: Runtime now uses the saved compact room art for the current v1 mood; animal-pet semantics remain a later companion-aligned cleanup task.

## Acceptance

- Reads as a human-like companion asset, not an animal pet asset.
- Avoid these semantics: dog bowl, kibble, paw motif, animal bed, animal ears, tail.
- Matches the clean-2d-chibi Yoyo style with soft linework and low visual noise.
- Preserves the target runtime path so existing Electron and Pixi code keeps working.
- Room composition keeps a cozy child-scale desktop companion space with clear usable zones.

## References

- `../../docs/Yoyo-Art-Bible.md`
- `home/room-shell-clean-2d.webp`
