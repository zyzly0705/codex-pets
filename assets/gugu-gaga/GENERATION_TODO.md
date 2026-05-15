# 咕咕嘎嘎 Generation TODO

The package is wired into the app. The current visual atlas is a runnable local prototype, but it should be replaced by a higher-fidelity reference-matched atlas.

## Current Blocker

This Codex session does not expose the built-in `image_gen` tool, and the local environment does not have `OPENAI_API_KEY`, so the final reference-matched sprite cannot be generated in this run.

Do not treat the current `spritesheet.webp` as final art. It exists so the second-pet flow can run.

## Prepared Run

Run directory:

```text
output/hatch-pet/gugu-gaga
```

Ready job:

```bash
python3 /Users/zhangyazhou/.codex/skills/hatch-pet/scripts/pet_job_status.py \
  --run-dir /Users/zhangyazhou/Downloads/work/codex-desktop-pet/output/hatch-pet/gugu-gaga
```

The first prompt is:

```text
output/hatch-pet/gugu-gaga/prompts/base-pet.md
```

## Expected Flow

1. Generate and approve the base pet from `prompts/base-pet.md`.
2. Record the selected generated image:

```bash
python3 /Users/zhangyazhou/.codex/skills/hatch-pet/scripts/record_imagegen_result.py \
  --run-dir /Users/zhangyazhou/Downloads/work/codex-desktop-pet/output/hatch-pet/gugu-gaga \
  --job-id base \
  --source /absolute/path/to/generated/ig_xxx.png
```

3. Generate the row-strip jobs shown by `pet_job_status.py`.
4. Finalize the standard Codex atlas:

```bash
python3 /Users/zhangyazhou/.codex/skills/hatch-pet/scripts/finalize_pet_run.py \
  --run-dir /Users/zhangyazhou/Downloads/work/codex-desktop-pet/output/hatch-pet/gugu-gaga
```

5. Expand the standard 9-row Codex atlas into this app's 37-row Yoyo atlas:

```bash
npm run expand:codex-atlas -- \
  output/hatch-pet/gugu-gaga/final/spritesheet.webp \
  assets/gugu-gaga/spritesheet.webp
```

6. Validate:

```bash
npm run check
node scripts/audit-pet-assets.js assets/gugu-gaga --strict
```

## Final Art Direction

Use the user-provided references as visual direction:

- Penguin-suit little girl, not plain penguin.
- Big head, short rounded body, human girl face inside hood.
- Yellow beak and eye spots on hood.
- Black bob haircut, straight bangs, blue hair clip.
- Silver paperclip-like chest pendant.
- Long right-side tail/cape shape.
- Yellow webbed feet.
- Flag/spear form is a special action or outfit concept, not baseline idle.
