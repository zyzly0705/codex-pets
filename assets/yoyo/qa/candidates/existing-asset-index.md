# Existing Yoyo Asset Index - 2026-05-29

This index captures the existing room, food, and comfort assets found before generating more redraw candidates.

## Contact Sheets

- Runtime rooms: `assets/yoyo/qa/candidates/existing-runtime-rooms-contact.png`
- Source room variants: `assets/yoyo/qa/candidates/existing-source-room-variants-contact.png`
- Food and comfort: `assets/yoyo/qa/candidates/existing-food-comfort-contact.png`
- Older output room candidates: `assets/yoyo/qa/candidates/existing-output-room-candidates-contact.png`

## Runtime Room Assets

| Asset | Size | Current take |
| --- | ---: | --- |
| `assets/yoyo/home/room-stage-v2.webp` | 1080x720 | Current runtime base. Preferred compact v1-vibe direction: bright, busy, cozy, and more fun than the cleaner candidate. Keep the energy, remove only the animal-pet props in a later local cleanup. |
| `assets/yoyo/home/room-stage-night.webp` | 1080x720 | Existing night room, same pet-care semantics. Useful mood reference only. |
| `assets/yoyo/home/room-stage-rainy.webp` | 1080x720 | Existing rainy room, same pet-care semantics. Useful weather reference only. |
| `assets/yoyo/home/room-stage-party.webp` | 1080x720 | Existing party room, but still uses toy/pet framing. Useful event reference only. |
| `assets/yoyo/home/room-shell-clean-2d.webp` | 1080x720 | Cleaner compact shell with fewer pet signals. Useful cleanup base, but too quiet to become the final mood by itself. |

## Source Room Assets

| Asset | Size | Current take |
| --- | ---: | --- |
| `assets-src/yoyo/home/ai/yoyo-room-refined.png` | 1536x1024 | Source version of current day room; pet semantics remain. |
| `assets-src/yoyo/home/ai/yoyo-room-night.png` | 1536x1024 | Source night variant; pet semantics remain. |
| `assets-src/yoyo/home/ai/yoyo-room-rainy.png` | 1536x1024 | Source rainy variant; pet semantics remain. |
| `assets-src/yoyo/home/ai/yoyo-room-party.png` | 1536x1024 | Source party variant; pet semantics remain. |
| `assets-src/yoyo/home/aseprite/yoyo-home-room-default.png` | 1080x720 | Aseprite export of day room; pet semantics remain. |
| `assets-src/yoyo/home/aseprite/yoyo-home-room-night.png` | 1080x720 | Aseprite export of night room; pet semantics remain. |
| `assets-src/yoyo/home/aseprite/yoyo-home-room-rainy.png` | 1080x720 | Aseprite export of rainy room; pet semantics remain. |
| `assets-src/yoyo/home/aseprite/yoyo-home-room-party.png` | 1080x720 | Aseprite export of party room; pet semantics remain. |

## Food And Comfort Assets

| Asset | Size | Current take |
| --- | ---: | --- |
| `assets/yoyo/home/prop-food.webp` | 210x150 | Existing table prop. It is not dog food, but it is visually empty and less useful than the new meal-tray candidate. |
| `assets/yoyo/home/composite-feed-table-yoyo.webp` | 240x273 | Existing accepted feed composite. Keep unless feed interaction is redesigned. |
| `assets/yoyo/home/composite-pet-cushion-yoyo.webp` | 280x220 | Existing comfort composite, but naming and framing still say petting/cushion. Needs semantic rename or redraw. |
| `assets/yoyo/qa/candidates/found/prop-food-redesign-v1.webp` | 210x150 | Same lineage as runtime `prop-food.webp`; reference only. |
| `assets/yoyo/qa/candidates/found/composite-pet-cushion-yoyo-redesign-v1.webp` | 280x220 | Same lineage as runtime comfort composite; reference only. |

## Older Output Candidates Worth Reviewing

| Asset | Size | Current take |
| --- | ---: | --- |
| `assets/yoyo/qa/candidates/found/room-full-clean2d-v3-candidate.png` | 1536x1024 | Rich human-room reference, but too large/full-room for the current compact Yoyo stage target. Do not integrate as the main room. |
| `assets/yoyo/qa/candidates/found/room-human-clean2d-v4-candidate.png` | 1536x1024 | High-detail full-room reference, but rejected for the current main room direction because it feels like a large room rather than a tight desktop-pet stage. |

## Recommendation

Do not regenerate the night/rainy/party rooms from scratch yet. Reuse the found source variants as references, but keep them in `redraw` because they still contain animal-pet semantics. The best next integration path is:

1. Use `room-stage-v2.webp` directly as the current runtime background: compact, lively, warm, and visually busy.
2. Use `room-shell-clean-2d.webp` and `home-room-stage-v2-candidate-01.webp` only as cleanup references for removing animal-pet semantics later.
3. Do not promote the large `room-human-clean2d-v4-candidate.png` style into the current main room.

Runtime proof captures:

- `assets/yoyo/qa/home-saved-room-stage-v2-runtime.png`
- `assets/yoyo/qa/home-saved-room-stage-v2-feed-runtime.png`
