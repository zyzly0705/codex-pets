# Yoyo Lightweight Chat Handoff

Use this document to continue the `codex-desktop-pet` work from a fresh Codex chat without loading the old image-heavy conversation.

## Reactivation Prompt

Paste this into a new Codex chat:

```text
We are continuing work in /Users/zhangyazhou/Downloads/work/codex-desktop-pet from docs/codex-handoffs/2026-05-29-yoyo-lightweight-chat-handoff.md.

Read that handoff first, inspect the current repo state, and continue from the next steps. Do not rely on old chat images or old chat history. For image-heavy work, create repo-local reports, contact sheets, or gallery HTML files and reference their paths instead of embedding many images in chat.
```

## Repo State

- Repo: `/Users/zhangyazhou/Downloads/work/codex-desktop-pet`
- Branch: `codex/yoyo-asset-system-refactor`
- App: Electron desktop pet, package name `codex-desktop-pet`, product name `Yoyo`
- Main entry: `src/main.js`
- Package version seen in `package.json`: `0.5.1`
- User data path: `/Users/zhangyazhou/Library/Application Support/codex-desktop-pet`

This repo currently has many modified and untracked files. Treat the worktree as user-owned and do not revert unrelated changes.

## Why The Old Chat Is Slow

The old Codex chat likely became slow because it accumulated many generated images, screenshots, long command outputs, and asset-review messages. The project itself is also asset-heavy:

- `node_modules`: about 739 MB
- `.git`: about 348 MB
- `dist`: about 259 MB
- `assets-src`: about 200 MB
- `assets`: about 66 MB
- user data: about 130 MB, mostly installed pet assets and Electron cache

The fastest path is to continue in a new lightweight chat and use repo-local artifacts for image review.

## Current Product Direction

Yoyo is a desktop companion with:

- main pet window and home room UI
- behavior engine, emotion, growth, relationship, daily memory, and weather/seasonal modules
- optional DeepSeek-backed line generation
- special action and final-art effect pipelines
- asset pack/runtime work for desktop pet assets

The current branch appears focused on a Yoyo asset-system refactor and v3/full asset rebuild.

## Important Files And Areas

Core app:

- `src/main.js`
- `src/preload.js`
- `src/renderer.js`
- `src/home.js`
- `src/home.html`
- `src/home.css`
- `src/styles.css`

Main-process modules:

- `src/main/pets.js`
- `src/main/pet-pack.js`
- `src/main/effects.js`
- `src/main/life.js`
- `src/main/tray-menu.js`
- `src/main/debug-log.js`

Renderer modules:

- `src/modules/render-engine.js`
- `src/modules/behavior-engine.js`
- `src/modules/state-machine.js`
- `src/modules/interaction.js`
- `src/modules/ai-dialogue.js`
- `src/modules/desktop-pixi-runner.js`
- `src/modules/desktop-roaming.js`
- `src/modules/desktop-toys.js`
- `src/modules/speech-queue.js`

Shared runtime:

- `src/shared/home-scene.js`
- `src/shared/yoyo-actions.js`
- `src/shared/desktop-action-dispatcher.js`

Asset roots:

- `assets/yoyo/`
- `assets/yoyo/home/`
- `assets/yoyo/effects/`
- `assets/yoyo/desktop-rig/`
- `assets/yoyo/live2d/`
- `assets/yoyo/qa/`
- `assets-src/yoyo/`

Planning docs:

- `docs/superpowers/plans/2026-05-29-yoyo-asset-system-refactor.md`
- `docs/superpowers/specs/2026-05-29-yoyo-asset-system-refactor-design.md`
- `docs/superpowers/plans/2026-05-29-yoyo-v3-full-asset-rebuild.md`
- `docs/Yoyo-Asset-Hatch-Workflow.md`
- `docs/Yoyo-Effect-Video-Workflow.md`
- `docs/Yoyo-Live2D-Spine-Rig-Workflow.md`
- `docs/Yoyo-Spine-Action-Runtime.md`
- `docs/Yoyo-AI-Design-Toolchain.md`

## Current Asset Snapshot

Observed generated/runtime assets include:

- `assets/yoyo/spritesheet.webp`
- `assets/yoyo/spritesheet.before-running-leg-fix.webp`
- `assets/yoyo/pet.json`
- `assets/yoyo/pack-manifest.json`
- `assets/yoyo/asset-status.json`
- `assets/yoyo/home/yoyo-home-sheet.webp`
- `assets/yoyo/home/room-v3-day.webp`
- `assets/yoyo/home/room-v3-night.webp`
- `assets/yoyo/home/room-v3-rainy.webp`
- `assets/yoyo/home/room-v3-party.webp`
- `assets/yoyo/home/composite-v3-feed-yoyo.webp`
- `assets/yoyo/home/composite-v3-sleep-yoyo.webp`
- `assets/yoyo/home/composite-v3-play-yoyo.webp`
- `assets/yoyo/home/composite-v3-bath-yoyo.webp`
- `assets/yoyo/home/composite-v3-comfort-yoyo.webp`
- multiple `assets/yoyo/effects/*` final-art and action folders
- `assets-src/yoyo/final-art/*-final-art-v1.png`
- `assets-src/yoyo/v3/manifest.json`
- `assets-src/yoyo/v3/prompt-pack.json`
- `assets-src/yoyo/v3/style-guide.json`

The old chat image history should not be treated as source of truth. The repo files should be.

## Known Issue

The user reported that the old Codex chat window is slow and missing many images. The desired fix is workflow-level:

- avoid continuing in the old image-heavy thread
- use this handoff to start fresh
- keep images in repo/output paths
- show only 1-3 key previews in chat
- generate contact sheets or gallery HTML for bulk review

## Recommended Image Workflow

For missing-image or asset completeness work, do this instead of scrolling old chat:

1. Scan manifests and runtime references.
2. Compare references to files on disk.
3. Write a machine-readable report such as `output/yoyo-asset-audit/missing-assets.json`.
4. Write a human-readable report such as `output/yoyo-asset-audit/summary.md`.
5. Generate a compact `contact-sheet.png` or `gallery.html` for review.
6. In chat, link the reports and show only the most important preview image.

Do not paste or embed dozens of images in the chat.

## Commands Worth Trying First

Use these from `/Users/zhangyazhou/Downloads/work/codex-desktop-pet`:

```bash
npm test
npm run check
node scripts/audit-yoyo-asset-pack.js --check --write-report
node scripts/audit-yoyo-v3-kit.js --check --write-report
node scripts/verify-yoyo-final-art-assets.js
node scripts/verify-yoyo-live2d-export.js
```

If a full `npm run check` is too slow or too broad, run targeted checks first:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/renderer.js
node --test tests/pet-pack-reader.test.mjs
node --test tests/yoyo-asset-pack.test.mjs
node --test tests/yoyo-v3-asset-kit.test.mjs
```

## Next Steps

1. Start a new Codex chat with the reactivation prompt above.
2. In the new chat, run a fresh `git status --short` and read the plan/spec docs listed above.
3. Run the asset audit scripts and save results under `output/yoyo-asset-audit/`.
4. Build a missing-asset matrix from `assets/yoyo/pack-manifest.json`, `assets/yoyo/asset-status.json`, `assets-src/yoyo/v3/manifest.json`, and runtime references in `src/`.
5. Produce one lightweight gallery/contact sheet for the missing or questionable images.
6. Only after the audit is clear, decide whether to regenerate assets, repair references, or update manifests.
7. Keep future chat messages path-based and summary-based; avoid bulk image embedding.

## Do Not Touch Without Explicit Approval

- Do not delete or overwrite generated image assets.
- Do not revert modified files just because the worktree is large.
- Do not clean `dist`, `assets`, `assets-src`, or user data unless the user explicitly asks.
- Do not archive or remove old Codex chats from inside this repo task.
- Do not assume old chat images are authoritative when the repo has a local asset file.

