#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const defaultOutputRoot = path.join(repoRoot, 'output', 'yoyo-asset-runs');
const allowedKinds = new Set(['style', 'character', 'pose', 'home-object', 'room', 'action-row', 'effect', 'qa']);

function usage() {
  console.error(`Usage: node scripts/prepare-yoyo-asset-run.js --name <slug> --kind <kind> --brief <text> [options]
       node scripts/prepare-yoyo-asset-run.js --batch full-redesign --name <slug> --brief <text> [options]

Options:
  --batch <template>       Batch template. Currently: full-redesign
  --output-dir <dir>       Parent directory for the run. Default: output/yoyo-asset-runs
  --reference <path>       Add a visual reference path. Can be repeated.
  --target <path>          Intended runtime asset path.
  --notes <text>           Extra constraints for this run.
  --style-profile <name>   Visual style: clean-2d, pixel, or soft-illustration. Default: clean-2d
  --frames <n>             Planned frame count. Defaults by kind.
  --fps <n>                Planned playback fps. Defaults by kind.
  --cell-width <n>         Planned source cell width. Defaults by kind.
  --cell-height <n>        Planned source cell height. Defaults by kind.
  --force                  Replace an existing run directory.

Kinds:
  style, character, pose, home-object, room, action-row, effect, qa`);
}

function parseArgs(argv) {
  const result = {
    references: [],
    outputDir: defaultOutputRoot,
    styleProfile: 'clean-2d',
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };

    if (arg === '--batch') result.batch = next();
    else if (arg === '--name') result.name = next();
    else if (arg === '--kind') result.kind = next();
    else if (arg === '--brief') result.brief = next();
    else if (arg === '--output-dir') result.outputDir = path.resolve(next());
    else if (arg === '--reference') result.references.push(path.resolve(next()));
    else if (arg === '--target') result.target = next();
    else if (arg === '--notes') result.notes = next();
    else if (arg === '--style-profile') result.styleProfile = next();
    else if (arg === '--frames') result.frames = Number(next());
    else if (arg === '--fps') result.fps = Number(next());
    else if (arg === '--cell-width') result.cellWidth = Number(next());
    else if (arg === '--cell-height') result.cellHeight = Number(next());
    else if (arg === '--force') result.force = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return result;
}

function validateRequest(request) {
  if (!request.name || !/^[a-z0-9][a-z0-9-]*$/u.test(request.name)) {
    throw new Error('--name must be a lowercase slug, for example sleep-pose');
  }
  if (!request.batch && !allowedKinds.has(request.kind)) {
    throw new Error(`--kind must be one of: ${Array.from(allowedKinds).join(', ')}`);
  }
  if (!request.brief || request.brief.trim().length < 8) {
    throw new Error('--brief must describe the asset job');
  }
  if (request.styleProfile && !['clean-2d', 'pixel', 'soft-illustration'].includes(request.styleProfile)) {
    throw new Error('--style-profile must be one of: clean-2d, pixel, soft-illustration');
  }
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trimEnd()}\n`);
}

function kindContract(kind) {
  const contracts = {
    style: [
      'Defines the canonical Yoyo asset style before any production asset is accepted.',
      'Must include palette, outline weight, scale rules, lighting, pixel density, and negative examples.',
      'Creates the yardstick used to reject mismatched poses, props, rooms, and action rows.',
    ],
    character: [
      'Canonical full-body Yoyo identity sheet with front, side, back, and key expressions.',
      'Must lock hair shape, face proportions, body scale, outfit palette, and outline weight.',
      'No room, props, UI, text, or dramatic illustration posing.',
    ],
    pose: [
      'One full Yoyo body pose, no room or bed baked into the character layer.',
      'Use a clean transparent or chroma-key background so the pose can be extracted.',
      'Pose must have visible support/contact points and cannot look like a floating bust.',
    ],
    'home-object': [
      'Layered prop that can be split into back/front foreground pieces.',
      'Object scale and perspective must match the home room stage.',
      'Avoid duplicate character art inside the prop asset.',
    ],
    room: [
      'Single coherent room stage with enough negative space for Yoyo and props.',
      'No baked UI text, no duplicate care-action props unless intentionally part of the room.',
      'Perspective must give clear floor contact zones.',
    ],
    'action-row': [
      'High-frame action strip following the motion spec with consistent identity and cell-safe padding.',
      'Every frame must explain the action without runtime props doing the main work.',
      'No cropped body parts, duplicate props, floating symbols, or unrelated scenery.',
    ],
    effect: [
      'Small attached visual effect that supports a state or action.',
      'Effect must stay hard-edged and readable at desktop-pet size.',
      'Avoid detached sparkles, text, glows, shadows, or soft transparent haze.',
    ],
    qa: [
      'Runtime verification job that proves accepted assets work together at actual app scale.',
      'Must include screenshots/contact sheets for all target scenes or rows.',
      'Blocks completion if any asset looks pasted on, cropped, floating, or stylistically mismatched.',
    ],
  };
  return contracts[kind];
}

function defaultMotion(kind) {
  const defaults = {
    style: { frames: 1, fps: 1, cellWidth: 384, cellHeight: 384, loop: false },
    character: { frames: 1, fps: 1, cellWidth: 768, cellHeight: 768, loop: false },
    pose: { frames: 1, fps: 1, cellWidth: 384, cellHeight: 384, loop: false },
    'home-object': { frames: 1, fps: 1, cellWidth: 512, cellHeight: 512, loop: false },
    room: { frames: 1, fps: 1, cellWidth: 1536, cellHeight: 1024, loop: false },
    'action-row': { frames: 24, fps: 12, cellWidth: 384, cellHeight: 416, loop: true },
    effect: { frames: 12, fps: 12, cellWidth: 256, cellHeight: 256, loop: true },
    qa: { frames: 0, fps: 0, cellWidth: 0, cellHeight: 0, loop: false },
  };
  return defaults[kind] || defaults.pose;
}

function motionSpec(args) {
  const base = defaultMotion(args.kind);
  return {
    frames: Number.isFinite(args.frames) ? args.frames : base.frames,
    fps: Number.isFinite(args.fps) ? args.fps : base.fps,
    cellWidth: Number.isFinite(args.cellWidth) ? args.cellWidth : base.cellWidth,
    cellHeight: Number.isFinite(args.cellHeight) ? args.cellHeight : base.cellHeight,
    loop: typeof args.loop === 'boolean' ? args.loop : base.loop,
  };
}

function styleContract(profile = 'clean-2d') {
  const profiles = {
    'clean-2d': [
      'clean 2D chibi Yoyo with refined line art',
      'clear silhouette and readable face at desktop-pet size',
      'smooth but not blurry edges, restrained cel shading',
      'black straight bangs with small top bun',
      'soft friendly face language',
      'human-like girl companion, not a pet, dog, animal mascot, or pet-care character',
      'avoid pixelated stair-steps, painterly rendering, glossy 3D, or anime key art',
    ],
    pixel: [
      'small pixel-adjacent chibi Yoyo',
      'thick dark readable outline',
      'flat cel shading with limited palette',
      'black straight bangs with small top bun',
      'soft friendly face language',
      'human-like girl companion, not a pet, dog, animal mascot, or pet-care character',
      'no painterly, glossy 3D, anime key art, or marketing illustration finish',
    ],
    'soft-illustration': [
      'soft 2D storybook chibi Yoyo',
      'clean readable contour with gentle shading',
      'slightly richer fabric and hair detail than clean-2d',
      'black straight bangs with small top bun',
      'warm friendly expression',
      'human-like girl companion, not a pet, dog, animal mascot, or pet-care character',
      'avoid realistic proportions, glossy 3D, noisy painterly texture, or tiny unreadable detail',
    ],
  };
  return profiles[profile] || profiles['clean-2d'];
}

function makeRequest(args) {
  return {
    workflow: 'yoyo-asset-hatch',
    version: 1,
    name: args.name,
    kind: args.kind,
    phase: args.phase || null,
    styleProfile: args.styleProfile || 'clean-2d',
    brief: args.brief.trim(),
    target: args.target || null,
    references: args.references,
    notes: args.notes || '',
    motion: motionSpec(args),
    styleContract: styleContract(args.styleProfile),
    assetContract: kindContract(args.kind),
    acceptance: args.acceptance || [
      'full body visible unless an explicit foreground object justifies occlusion',
      'grounded contact with the target prop or floor',
      'same Yoyo identity, palette, hair, and face language',
      'transparent or clean chroma-key background for extraction',
      'passes browser screenshot review at home UI size',
    ],
    toolchain: toolchainForKind(args.kind),
  };
}

function toolchainForKind(kind) {
  const common = [
    {
      tool: 'Codex asset run',
      role: 'Owns manifests, prompt packs, import scripts, runtime wiring, screenshots, and tests.',
      output: 'workflow-manifest.json, processed runtime assets, qa screenshots, and passing checks.',
    },
    {
      tool: 'Aseprite',
      role: 'Final cleanup for edge quality, palette drift, frame timing, layer separation, and sprite export.',
      output: 'Editable .aseprite source plus inspected PNG/WebP exports.',
    },
  ];

  const chains = {
    style: [
      {
        tool: 'Figma',
        role: 'Create the style board, component scale references, palette tokens, and negative examples.',
        output: 'A shared board with approved examples and rejection examples before production assets begin.',
      },
      {
        tool: 'AI image generator',
        role: 'Generate style-board candidates only after the visual contract is written.',
        output: 'Large candidate boards saved in candidates/ and accepted source in sources/.',
      },
      ...common,
    ],
    character: [
      {
        tool: 'Scenario or other character-consistency image tool',
        role: 'Generate a locked full-body Yoyo identity sheet from the approved master reference.',
        output: 'Front, side, back, expression, and pose-safe character references.',
      },
      ...common,
    ],
    pose: [
      {
        tool: 'Scenario or other character-consistency image tool',
        role: 'Generate full-body pose candidates while preserving Yoyo identity.',
        output: 'Transparent or chroma-key pose candidates with visible support/contact points.',
      },
      {
        tool: 'Figma',
        role: 'Check prop contact, scale, and composition against the room/object board.',
        output: 'A placement proof or annotated frame before runtime integration.',
      },
      ...common,
    ],
    'home-object': [
      {
        tool: 'Figma',
        role: 'Design object scale, perspective, layer split, and room placement first.',
        output: 'Back/front layer plan and object bounding boxes.',
      },
      {
        tool: 'AI image generator',
        role: 'Generate or redraw props from the approved composition and style lock.',
        output: 'High-resolution object candidates with no baked Yoyo unless explicitly requested.',
      },
      ...common,
    ],
    room: [
      {
        tool: 'Figma',
        role: 'Own the room floor plan, camera, contact zones, prop slots, and empty-space budget.',
        output: 'A whiteboard-style room map and tokenized layout spec.',
      },
      {
        tool: 'AI image generator',
        role: 'Generate coherent room-shell candidates from the approved map, not from ad hoc prompting.',
        output: 'Large room source art with floor contact zones and no baked UI.',
      },
      ...common,
    ],
    'action-row': [
      {
        tool: 'Runway/Krea/Kling/Luma video tool',
        role: 'Generate short motion references for complex body mechanics and timing.',
        output: 'Video reference clips or extracted keyframes, not direct runtime sprites.',
      },
      {
        tool: 'Scenario or other character-consistency image tool',
        role: 'Generate high-frame action strips using Yoyo identity and motion references.',
        output: '24-32 frame strips with stable identity and no cropped body parts.',
      },
      ...common,
    ],
    effect: [
      {
        tool: 'Runway/Krea/Kling/Luma video tool',
        role: 'Explore motion rhythm for dramatic effects such as dharma, clone, or dig transitions.',
        output: 'Reference-only clips or keyframes.',
      },
      {
        tool: 'AI image generator',
        role: 'Generate attached hard-edged effect strips or stills after the timing is locked.',
        output: 'Small readable effect assets that do not overpower Yoyo.',
      },
      ...common,
    ],
    qa: [
      {
        tool: 'Browser/Electron capture',
        role: 'Verify the real runtime composition at actual app size.',
        output: 'Default/action screenshots and contact sheets.',
      },
      ...common,
    ],
  };

  return chains[kind] || common;
}

function makePrompt(request) {
  const referenceLines = request.references.length
    ? request.references.map((ref) => `- Reference: ${ref}`).join('\n')
    : '- No external visual reference; use the existing Yoyo sprite/home assets as identity reference.';
  const extractionSection = ['style', 'room', 'qa'].includes(request.kind)
    ? `Output requirements:
- Make this a production style board or scene source, not a transparent cutout.
- Keep the image clean enough to inspect visual rules and reject mismatches.
- Avoid UI chrome, labels that look like app UI, watermarks, and decorative filler.`
    : `Extraction:
- Use a flat chroma-key background or transparent background.
- Keep generous safe padding around the silhouette.
- Make all important pixels opaque and hard-edged.`;
  const primaryRequest = request.kind === 'style'
    ? `Create a production style board for: ${request.brief}`
    : `Create ${request.brief}`;

  return `# Visual Prompt: ${request.name}

${primaryRequest}

Yoyo identity:
- ${request.styleContract[0]}.
- Black straight bangs, small top bun, round soft face, cute compact proportions.
- ${request.styleContract[1]}.
- ${request.styleContract[2]}.
- Preserve Yoyo's existing friendly personality and avoid redesigning her into another character.
- Style profile: ${request.styleProfile}.

Workflow phase:
- ${request.phase || 'single-asset'}

Motion and resolution:
- ${request.motion.frames} frames
- ${request.motion.fps} fps
- ${request.motion.cellWidth}x${request.motion.cellHeight} source cell
- ${request.motion.loop ? 'seamless loop required' : 'single still or non-looping output'}

Asset type:
- ${request.kind}
${request.assetContract.map((item) => `- ${item}`).join('\n')}

Hard negatives:
- Do not crop the body.
- Do not make only a bust, portrait, or half-body pose.
- Do not draw a bed, room, UI, text, frame labels, grid, watermark, or extra character unless the brief explicitly asks for it.
- Do not make Yoyo look like a dog, animal mascot, or pet-care subject.
- Do not use pet bowls, kibble, dog beds, paw motifs, or animal-house props; feeding means human food on a table or in normal human dishes.
- Do not use painterly rendering, glossy 3D, soft gradients, heavy antialiasing, or high-detail anime key art.
- Do not add floating symbols, detached sparkles, drop shadows, floor shadows, or motion streaks.

${extractionSection}

References:
${referenceLines}

Extra notes:
${request.notes || '- none'}
`;
}

function makeToolchainBrief(request) {
  return `# Toolchain Brief: ${request.name}

Use this before generating or importing art. The goal is to stop treating AI output as finished art and instead make each tool responsible for the thing it is good at.

${request.toolchain.map((step, index) => `## ${index + 1}. ${step.tool}
Role: ${step.role}

Expected output: ${step.output}`).join('\n\n')}

## Rejection Rules
- Reject anything that changes Yoyo into a different person.
- Reject half-body or floating-body output unless the brief explicitly asks for a foreground crop.
- Reject room and furniture candidates that do not show clear floor contact zones.
- Reject high-detail images that become noisy, blurry, or unreadable at runtime size.
- Reject animation rows where frame count hides bad body mechanics instead of improving motion.
`;
}

function makeFigmaBrief(request) {
  return `# Figma Brief: ${request.name}

Figma is the layout and standard-setting board, not the final sprite generator.

Create:
- One artboard for approved references.
- One artboard for rejected examples and written rejection reasons.
- One scale board showing Yoyo, floor/contact zones, and target prop or room bounds.
- For room/object jobs, draw bounding boxes for back layer, character layer, and front layer.
- For action/pose jobs, place the pose against the target prop or room slot and check contact.

Export or screenshot the accepted board into this run's references/ or qa/ folder before integration.
`;
}

function makeConsistencyBrief(request) {
  return `# Character Consistency Brief: ${request.name}

Use this with Scenario, Ideogram-style character consistency, or another image tool that supports reference images.

Identity lock:
- Yoyo is a small human-like girl, not a dog or animal mascot.
- Black straight bangs, small top bun, round soft face, navy outfit, white shirt, red bow/ribbon accent.
- Keep full-body chibi proportions and visible lower-body support.
- Preserve the same face language and silhouette across candidates.

Prompt:
${makePrompt(request)}

Selection notes:
- Prefer clean readable body mechanics over decorative detail.
- Keep candidates large enough to downsample cleanly.
- Save rejected candidates with a one-line reason so the next run learns what failed.
`;
}

function makeMotionBrief(request) {
  return `# Motion Reference Brief: ${request.name}

Use this with Runway, Krea, Kling, Luma, or another video tool only when the asset needs body mechanics or timing.

Motion target:
- ${request.brief}
- ${request.motion.frames} production frames at ${request.motion.fps} fps.
- Runtime source cell target: ${request.motion.cellWidth}x${request.motion.cellHeight}.

Rules:
- The video is a reference, not the runtime asset.
- Keep camera locked and motion readable from a small desktop-pet view.
- Avoid cuts, zooms, motion blur, shadows, text, UI, and extra characters.
- Extract keyframes only after the character identity still matches Yoyo.
`;
}

function makeAsepriteBrief(request) {
  return `# Aseprite Cleanup Brief: ${request.name}

Use Aseprite after a candidate is selected.

Cleanup tasks:
- Remove chroma-key or transparent edge noise.
- Separate back/object, Yoyo, foreground, and effect layers when the asset needs composition.
- Fix hands, feet, contact points, face readability, and outline breaks.
- Normalize frame timing to ${request.motion.fps} fps when animated.
- Export inspected source PNG/WebP files only after the visual gate passes.

Do not use Aseprite to hide a broken composition. If contact, scale, or identity is wrong, regenerate or redraw the source first.
`;
}

function makeChecklist(request) {
  return `# Review Checklist: ${request.name}

## Spec Gate
- [ ] Phase is clear: ${request.phase || 'single-asset'}
- [ ] Brief matches the requested asset: ${request.brief}
- [ ] Kind-specific contract is satisfied: ${request.kind}
- [ ] Motion spec is followed: ${request.motion.frames} frames at ${request.motion.fps} fps, ${request.motion.cellWidth}x${request.motion.cellHeight}.
- [ ] Target path is known or intentionally unset.
- [ ] Source references are recorded.

## Visual Gate
- [ ] Full body is visible unless a foreground object justifies partial cover.
- [ ] Yoyo is grounded on the prop, floor, bed, water, or seat.
- [ ] Identity matches existing Yoyo: hair, face, palette, outline, proportions.
- [ ] The asset does not look pasted on, floating, or unrelated to the home style.
- [ ] No text, UI, watermark, detached effects, or duplicate scenery.

## Source Quality Gate
- [ ] Source art is at least the planned motion/source size or intentionally enhanced.
- [ ] If the source is blurry, mosaic-like, or too small, route it through enhanced/ before processing.
- [ ] Enhancement does not invent a different Yoyo identity or soften the pixel-adjacent outline.
- [ ] Rejected low-quality sources are kept only as references, not runtime assets.

## Enhancement Gate
- [ ] Use high-resolution regeneration when the source is conceptually wrong.
- [ ] Use Aseprite cleanup when the source is basically right but needs pixel-level edits.
- [ ] Use super-resolution/enhancement only as an intermediate, then inspect and clean it.
- [ ] Save enhanced candidates and notes before accepting a source.

## Processing Gate
- [ ] Source resolution is high enough to downsample into runtime assets.
- [ ] For animation rows, every frame keeps volume, identity, and contact points stable.
- [ ] Background is transparent or cleanly removable chroma-key.
- [ ] Crop has safe padding and no clipped pixels.
- [ ] Exported source is saved under assets-src when accepted.
- [ ] Runtime webp/png output is saved under assets when accepted.

## Runtime Gate
- [ ] Manifest or CSS references the accepted runtime asset.
- [ ] Browser screenshot proves the asset at actual home UI size.
- [ ] Contact sheet or before/after preview is saved under output.
- [ ] npm test passes.
- [ ] npm run check passes, or the exact blocker is written down.
`;
}

function makeReadme(request) {
  return `# ${request.name}

This is a hatch-style Yoyo asset run. Use it as the working folder for prompt, source image selection, extraction, runtime wiring, and visual QA.

Recommended flow:
1. Read asset-request.json and prompts/visual-prompt.md.
2. Generate or import source art from Aseprite/Figma/image generation.
3. Save raw candidates in candidates/.
4. Move the accepted editable/source file to sources/.
5. Export processed runtime assets to processed/.
6. Wire the accepted file into the app.
7. Save screenshots/contact sheets into qa/.

The run is not accepted until qa/review-checklist.md is complete.
`;
}

function fullRedesignAssets(args) {
  const rootRefs = [
    path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp'),
    path.join(repoRoot, 'assets', 'yoyo', 'home', 'room-stage-v2.webp'),
  ];

  return [
    {
      name: '00-style-system',
      kind: 'style',
      phase: 'style-lock',
      brief: 'Define the canonical Yoyo visual system for the full asset redesign.',
      target: 'docs/Yoyo-Art-Bible.md',
      references: rootRefs,
    },
    {
      name: '01-character-master',
      kind: 'character',
      phase: 'character-lock',
      brief: 'Create the canonical full-body Yoyo identity sheet before any pose or action work.',
      target: 'assets-src/yoyo/identity/yoyo-character-master.png',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp')],
    },
    {
      name: '02-home-room-default',
      kind: 'room',
      phase: 'home-kit',
      brief: 'Redesign the default Yoyo home room with clean floor contact zones and prop slots.',
      target: 'assets/yoyo/home/room-stage-v2.webp',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'home', 'room-stage-v2.webp')],
    },
    {
      name: '03-home-care-objects',
      kind: 'home-object',
      phase: 'home-kit',
      brief: 'Redesign feed, bath, bed, toy, and affection objects as layered puzzle-piece home assets.',
      target: 'assets/yoyo/home/prop-*.webp',
      references: [
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-food.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-bath.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-bed.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-toy.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-heart.webp'),
      ],
    },
    {
      name: '04-home-sleep-pose',
      kind: 'pose',
      phase: 'pose-kit',
      brief: 'Full-body side sleeping Yoyo pose that rests naturally on the home bed.',
      target: 'assets/yoyo/home/home-sleep-yoyo.webp',
      references: [
        path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-bed-front.webp'),
        path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-bed-back.webp'),
      ],
    },
    {
      name: '05-home-feed-pose',
      kind: 'pose',
      phase: 'pose-kit',
      brief: 'Full-body Yoyo feeding pose with grounded contact beside the food bowl.',
      target: 'assets-src/yoyo/home/poses/feed.png',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-food.webp')],
    },
    {
      name: '06-home-bath-pose',
      kind: 'pose',
      phase: 'pose-kit',
      brief: 'Full-body Yoyo bath pose that sits inside or against the tub without becoming a floating bust.',
      target: 'assets-src/yoyo/home/poses/bath.png',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-bath.webp')],
    },
    {
      name: '07-home-play-pose',
      kind: 'pose',
      phase: 'pose-kit',
      brief: 'Full-body Yoyo play pose that interacts with the toy box and stays readable at home UI size.',
      target: 'assets-src/yoyo/home/poses/play.png',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'home', 'prop-toy.webp')],
    },
    {
      name: '08-home-pet-pose',
      kind: 'pose',
      phase: 'pose-kit',
      brief: 'Full-body Yoyo affection pose for petting, with a cute readable expression and stable stance.',
      target: 'assets-src/yoyo/home/poses/pet.png',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp')],
    },
    {
      name: '09-core-action-rows',
      kind: 'action-row',
      phase: 'action-kit',
      brief: 'Redesign core idle, waiting, eating, sleeping, petting, dancing, and failed rows with one locked Yoyo identity.',
      target: 'assets/yoyo/spritesheet.webp',
      references: [path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp')],
      frames: 24,
      fps: 12,
      cellWidth: 384,
      cellHeight: 416,
    },
    {
      name: '10-special-action-rows',
      kind: 'action-row',
      phase: 'action-kit',
      brief: 'Redesign complex action rows such as sofa lying, fan cooling, swing, swimming, and air conditioning as complete readable scene frames.',
      target: 'assets/yoyo/spritesheet.webp',
      references: [
        path.join(repoRoot, 'assets-src', 'yoyo', 'qa', 'animation-previews', 'sofaLying-contact.png'),
        path.join(repoRoot, 'assets-src', 'yoyo', 'qa', 'animation-previews', 'fanCooling-contact.png'),
        path.join(repoRoot, 'assets-src', 'yoyo', 'qa', 'animation-previews', 'swing-contact.png'),
      ],
      frames: 32,
      fps: 12,
      cellWidth: 384,
      cellHeight: 416,
    },
    {
      name: '11-runtime-qa',
      kind: 'qa',
      phase: 'runtime-qa',
      brief: 'Capture home scenes, contact sheets, and animation previews for the full redesigned asset set.',
      target: 'output/yoyo-redesign-qa',
      references: [],
    },
  ].map((asset) => ({
    ...asset,
    styleProfile: args.styleProfile || 'clean-2d',
    notes: args.notes || '',
    acceptance: [
      'uses the locked style system and character master',
      'has explicit source, processed, runtime, and qa files',
      'stays readable at actual desktop-pet/home UI size',
      'does not rely on runtime layering to hide a weak pose',
      'passes screenshot or contact-sheet review before integration',
    ],
  }));
}

function makeBatchManifest(args, assets) {
  return {
    workflow: 'yoyo-asset-redesign-batch',
    version: 1,
    name: args.name,
    styleProfile: args.styleProfile || 'clean-2d',
    brief: args.brief.trim(),
    phases: [
      { id: 'style-lock', title: 'Style Lock', gate: 'No production asset starts until style prompt and rejection examples exist.' },
      { id: 'character-lock', title: 'Character Lock', gate: 'No pose/action starts until Yoyo identity sheet is accepted.' },
      { id: 'home-kit', title: 'Home Kit', gate: 'Room and puzzle-piece objects share perspective, scale, and contact zones.' },
      { id: 'pose-kit', title: 'Pose Kit', gate: 'Care poses are full-body, grounded, and composable with home objects.' },
      { id: 'action-kit', title: 'Action Kit', gate: 'Rows preserve identity and explain motion without pasted runtime props.' },
    { id: 'runtime-qa', title: 'Final Runtime QA', gate: 'Screenshots/contact sheets prove the asset set in the app.' },
    ],
    assets: assets.map((asset) => ({
      name: asset.name,
      kind: asset.kind,
      phase: asset.phase,
      target: asset.target,
      status: 'prepared',
      motion: motionSpec(asset),
    })),
  };
}

function makeProductionBoard(batch) {
  const phaseBlocks = batch.phases.map((phase) => {
    const rows = batch.assets
      .filter((asset) => asset.phase === phase.id)
      .map((asset) => `- [ ] ${asset.name} (${asset.kind}) -> ${asset.target}`)
      .join('\n');
    return `## ${phase.title}\n${phase.gate}\n\n${rows}`;
  }).join('\n\n');

  return `# ${batch.name} Production Board

${batch.brief}

${phaseBlocks}

## Final Runtime QA Checklist
- [ ] Capture default, feed, bath, sleep, play, and pet home screenshots.
- [ ] Generate high-frame action previews and contact sheets for all redesigned action rows.
- [ ] Run npm test.
- [ ] Run npm run check.
- [ ] Record rejected candidates and why they failed.
`;
}

function createAssetRun(runDir, args) {
  const request = makeRequest(args);
  const manifest = {
    workflow: request.workflow,
    name: request.name,
    kind: request.kind,
    phase: request.phase,
    status: 'prepared',
    files: {
      request: 'asset-request.json',
      prompt: 'prompts/visual-prompt.md',
      checklist: 'qa/review-checklist.md',
      brief: 'brief/',
      references: 'references/',
      candidates: 'candidates/',
      enhanced: 'enhanced/',
      sources: 'sources/',
      processed: 'processed/',
      integration: 'integration/',
      qa: 'qa/',
      toolchain: 'toolchain/',
    },
    gates: ['spec', 'source-quality', 'visual', 'enhancement', 'processing', 'integration', 'runtime'],
  };

  for (const dir of ['brief', 'references', 'candidates', 'enhanced', 'sources', 'processed', 'integration', 'qa', 'prompts', 'toolchain']) {
    fs.mkdirSync(path.join(runDir, dir), { recursive: true });
  }

  writeFile(path.join(runDir, 'asset-request.json'), JSON.stringify(request, null, 2));
  writeFile(path.join(runDir, 'workflow-manifest.json'), JSON.stringify(manifest, null, 2));
  writeFile(path.join(runDir, 'prompts', 'visual-prompt.md'), makePrompt(request));
  writeFile(path.join(runDir, 'toolchain', 'toolchain-brief.md'), makeToolchainBrief(request));
  writeFile(path.join(runDir, 'toolchain', 'figma-brief.md'), makeFigmaBrief(request));
  writeFile(path.join(runDir, 'toolchain', 'character-consistency-brief.md'), makeConsistencyBrief(request));
  writeFile(path.join(runDir, 'toolchain', 'motion-reference-brief.md'), makeMotionBrief(request));
  writeFile(path.join(runDir, 'toolchain', 'aseprite-cleanup-brief.md'), makeAsepriteBrief(request));
  writeFile(path.join(runDir, 'qa', 'review-checklist.md'), makeChecklist(request));
  writeFile(path.join(runDir, 'README.md'), makeReadme(request));
  writeFile(path.join(runDir, 'brief', 'acceptance.md'), `# Acceptance\n\n${request.acceptance.map((item) => `- ${item}`).join('\n')}`);
  writeFile(path.join(runDir, 'integration', 'target.txt'), request.target || 'No runtime target set yet.');
}

function createBatch(args) {
  if (args.batch !== 'full-redesign') {
    throw new Error('--batch currently supports only full-redesign');
  }
  const batchDir = path.join(args.outputDir, args.name);
  if (fs.existsSync(batchDir)) {
    if (!args.force) {
      console.error(`${path.relative(repoRoot, batchDir)} already exists; pass --force to replace it`);
      process.exit(1);
    }
    fs.rmSync(batchDir, { recursive: true, force: true });
  }

  const assets = fullRedesignAssets(args);
  const batch = makeBatchManifest(args, assets);
  fs.mkdirSync(path.join(batchDir, 'assets'), { recursive: true });

  writeFile(path.join(batchDir, 'batch-manifest.json'), JSON.stringify(batch, null, 2));
  writeFile(path.join(batchDir, 'production-board.md'), makeProductionBoard(batch));
  writeFile(path.join(batchDir, 'README.md'), `# ${args.name}\n\nFull Yoyo asset redesign batch. Work through production-board.md in phase order.`);

  for (const asset of assets) {
    createAssetRun(path.join(batchDir, 'assets', asset.name), asset);
  }

  console.log(`Prepared ${path.relative(repoRoot, batchDir)}`);
  console.log(`Board: ${path.relative(repoRoot, path.join(batchDir, 'production-board.md'))}`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    validateRequest(args);
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }

  if (args.batch) {
    createBatch(args);
    return;
  }

  const runDir = path.join(args.outputDir, args.name);
  if (fs.existsSync(runDir)) {
    if (!args.force) {
      console.error(`${path.relative(repoRoot, runDir)} already exists; pass --force to replace it`);
      process.exit(1);
    }
    fs.rmSync(runDir, { recursive: true, force: true });
  }

  createAssetRun(runDir, args);

  console.log(`Prepared ${path.relative(repoRoot, runDir)}`);
  console.log(`Prompt: ${path.relative(repoRoot, path.join(runDir, 'prompts', 'visual-prompt.md'))}`);
  console.log(`Checklist: ${path.relative(repoRoot, path.join(runDir, 'qa', 'review-checklist.md'))}`);
}

main();
