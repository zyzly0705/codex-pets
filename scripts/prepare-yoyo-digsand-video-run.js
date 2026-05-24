#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'assets-src', 'yoyo', 'actions', 'digSand-video-workflow-manifest.json');
const defaultOutputDir = path.join(repoRoot, 'output', 'yoyo-digsand-video-runs');

function usage() {
  console.error(`Usage: node scripts/prepare-yoyo-digsand-video-run.js [options]

Options:
  --output-dir <dir>  Parent output directory. Default: output/yoyo-digsand-video-runs
  --force             Replace existing prepared run folder.`);
}

function parseArgs(argv) {
  const args = {
    outputDir: defaultOutputDir,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };

    if (arg === '--output-dir') args.outputDir = path.resolve(next());
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trimEnd()}\n`);
}

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function makePrompt(manifest) {
  const referenceLines = manifest.sharedReferences.map((reference) => `- ${reference}`).join('\n');
  const promptFocus = manifest.videoReference.promptFocus.map((item) => `- ${item}`).join('\n');
  const phases = manifest.videoReference.phasePlan
    .map((item) => `- Runtime frame ${item.frame}: ${item.phase}`)
    .join('\n');
  const layers = manifest.layers.map((layer) => `- ${layer.id} (${layer.role}): ${layer.description}`).join('\n');
  const gates = manifest.acceptanceGates.map((gate) => `- ${gate}`).join('\n');

  return `# Yoyo digSand Video Reference Prompt

Action id: ${manifest.actionId}
Runtime entry: ${manifest.runtime.stateEntry}
Target reference: ${manifest.videoReference.targetFrames} frames at ${manifest.videoReference.fps} fps.
Runtime output: ${manifest.videoReference.runtimeKeyframes} selected frames for row ${manifest.runtime.row}.

## Character Lock

Yoyo is a human little girl and companion. Do not crop her body. Do not turn her into a dog, puppy, animal mascot, doll, or pet. Preserve her black straight bangs, small top bun, navy-and-red outfit language, soft friendly face, and clean-2d proportions.

## References

${referenceLines}

## Generate This Short Video

${promptFocus}

Canvas: ${manifest.videoReference.canvas.width}x${manifest.videoReference.canvas.height}
Duration: ${manifest.videoReference.durationMs}ms
Frame plan: extract ${manifest.videoReference.targetFrames} reference frames, then select ${manifest.videoReference.runtimeKeyframes} runtime keyframes.

## Runtime Phase Plan

${phases}

## Layer Plan

${layers}

## Reject If

${gates}

Do not include UI, text labels, frame numbers, checkerboards, visible guide marks, clone-heart, dharma-manifest, 法相, 分身, or unrelated room scenery. Use either transparent background or a clean chroma-key background that can be removed.`;
}

function makeChecklist(manifest) {
  const gates = manifest.acceptanceGates.map((gate) => `- [ ] ${gate}`).join('\n');
  const phases = manifest.videoReference.phasePlan.map((item) => `- [ ] ${item.frame}: ${item.phase}`).join('\n');

  return `# Yoyo digSand QA Checklist

## Source Evidence

- [ ] Original generated video/reference saved under sources/.
- [ ] 24 extracted reference frames saved under frames/reference-24/.
- [ ] 8 selected runtime frames saved to ${manifest.extraction.runtimeFramesDir}.
- [ ] Contact sheet saved to ${manifest.extraction.contactSheet}.
- [ ] Processing notes explain rejected frames and any manual cleanup.

## Runtime Phases

${phases}

## Visual Gates

${gates}

## Runtime Prep

- [ ] Rebuild ${manifest.runtime.runtimeSpritesheet} with npm run build:pet-assets.
- [ ] Generate animation QA with npm run qa:animations.
- [ ] Review ${manifest.extraction.runtimeContactSheet} before acceptance.
- [ ] Do not modify clone-heart, dharma-manifest, or fullscreen Pixi timelines.`;
}

function prepareRun(manifest, args) {
  const runDir = path.join(args.outputDir, manifest.actionId);
  if (fs.existsSync(runDir)) {
    if (!args.force) throw new Error(`${rel(runDir)} already exists; use --force to replace it`);
    fs.rmSync(runDir, { recursive: true, force: true });
  }

  const request = {
    workflow: manifest.workflow,
    version: manifest.version,
    status: 'prepared',
    actionId: manifest.actionId,
    runtime: manifest.runtime,
    videoReference: manifest.videoReference,
    extraction: manifest.extraction,
    layers: manifest.layers,
    acceptanceGates: manifest.acceptanceGates,
    references: manifest.sharedReferences,
    nonGoals: manifest.nonGoals,
    createdAt: new Date().toISOString(),
  };

  writeFile(path.join(runDir, 'action-request.json'), JSON.stringify(request, null, 2));
  writeFile(path.join(runDir, 'prompts', 'video-reference.md'), makePrompt(manifest));
  writeFile(path.join(runDir, 'qa', 'review-checklist.md'), makeChecklist(manifest));
  writeFile(path.join(runDir, 'sources', '.gitkeep'), '');
  writeFile(path.join(runDir, 'frames', 'reference-24', '.gitkeep'), '');
  writeFile(path.join(runDir, 'processed', '.gitkeep'), '');
  return runDir;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson(manifestPath);
  const runDir = prepareRun(manifest, args);
  console.log(`Prepared Yoyo digSand video run: ${rel(runDir)}`);
}

try {
  main();
} catch (error) {
  console.error(`Yoyo digSand video run prep failed: ${error.message}`);
  process.exit(1);
}
