#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'assets-src', 'yoyo', 'effects', 'video-workflow-manifest.json');
const defaultOutputDir = path.join(repoRoot, 'output', 'yoyo-effect-video-runs');

function usage() {
  console.error(`Usage: node scripts/prepare-yoyo-effect-video-run.js [options]

Options:
  --effect <id>       Prepare one effect. Defaults to all manifest effects.
  --output-dir <dir>  Parent output directory. Default: output/yoyo-effect-video-runs
  --force             Replace existing prepared run folders.`);
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

    if (arg === '--effect') args.effect = next();
    else if (arg === '--output-dir') args.outputDir = path.resolve(next());
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

function makePrompt(manifest, effectId, effect) {
  const referenceLines = manifest.sharedReferences.map((reference) => `- ${reference}`).join('\n');
  const promptFocus = effect.videoReference.promptFocus.map((item) => `- ${item}`).join('\n');
  const layers = effect.layers.map((layer) => `- ${layer.id} (${layer.role}): ${layer.description}`).join('\n');
  const gates = effect.acceptanceGates.map((gate) => `- ${gate}`).join('\n');

  return `# ${effect.label} Video Reference Prompt

Effect id: ${effectId}
Runtime entry: ${effect.runtime.stageEntry}
Target: ${effect.videoReference.targetFrames} frames at ${effect.videoReference.fps} fps.

## Character Lock

Yoyo is a human little girl and companion. Do not crop her body. Do not turn her into a dog, puppy, animal mascot, doll, or pet. Preserve her black straight bangs, small top bun, navy-and-red outfit language, soft friendly face, and clean-2d proportions.

## References

${referenceLines}

## Generate This Short Video

${promptFocus}

Canvas: ${effect.videoReference.canvas.width}x${effect.videoReference.canvas.height}
Duration: ${effect.videoReference.durationMs}ms
Frame plan: extract ${effect.videoReference.targetFrames} usable frames at ${effect.videoReference.fps}fps.

## Layer Plan

${layers}

## Reject If

${gates}

Do not include UI, text labels, frame numbers, checkerboards, visible guide marks, digSand, or unrelated room scenery. Use either transparent background or a clean chroma-key background that can be removed.`;
}

function makeChecklist(effectId, effect) {
  const gates = effect.acceptanceGates.map((gate) => `- [ ] ${gate}`).join('\n');
  return `# ${effect.label} QA Checklist

## Source Evidence

- [ ] Original generated video/reference saved under sources/.
- [ ] Extracted keyframes saved under frames/.
- [ ] Contact sheet saved to ${effect.extraction.contactSheet}.
- [ ] Processing notes explain rejected frames and any manual cleanup.

## Visual Gates

${gates}

## Runtime Prep

- [ ] Compare extracted frames with ${effect.runtime.stageEntry}.
- [ ] Decide which pieces stay as Pixi timeline logic and which become authored small effect layers.
- [ ] Update ${effect.sourceTimeline} first, then copy accepted runtime config to ${effect.runtimeTimeline}.
- [ ] Capture overlay screenshot/video proof before acceptance.`;
}

function prepareEffectRun(manifest, effectId, effect, args) {
  const runDir = path.join(args.outputDir, effectId);
  if (fs.existsSync(runDir)) {
    if (!args.force) throw new Error(`${rel(runDir)} already exists; use --force to replace it`);
    fs.rmSync(runDir, { recursive: true, force: true });
  }

  const request = {
    workflow: manifest.workflow,
    version: manifest.version,
    status: 'prepared',
    effectId,
    label: effect.label,
    excludedEffects: manifest.excludedEffects,
    runtime: effect.runtime,
    sourceTimeline: effect.sourceTimeline,
    runtimeTimeline: effect.runtimeTimeline,
    videoReference: effect.videoReference,
    extraction: effect.extraction,
    layers: effect.layers,
    acceptanceGates: effect.acceptanceGates,
    references: manifest.sharedReferences,
    createdAt: new Date().toISOString(),
  };

  writeFile(path.join(runDir, 'effect-request.json'), JSON.stringify(request, null, 2));
  writeFile(path.join(runDir, 'prompts', 'video-reference.md'), makePrompt(manifest, effectId, effect));
  writeFile(path.join(runDir, 'qa', 'review-checklist.md'), makeChecklist(effectId, effect));
  writeFile(path.join(runDir, 'sources', '.gitkeep'), '');
  writeFile(path.join(runDir, 'frames', '.gitkeep'), '');
  writeFile(path.join(runDir, 'processed', '.gitkeep'), '');
  return runDir;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson(manifestPath);
  const effectIds = args.effect ? [args.effect] : Object.keys(manifest.effects);
  const prepared = [];

  for (const effectId of effectIds) {
    const effect = manifest.effects[effectId];
    if (!effect) throw new Error(`Unknown effect: ${effectId}`);
    if (manifest.excludedEffects.includes(effectId)) {
      throw new Error(`${effectId} is excluded from this workflow`);
    }
    prepared.push(prepareEffectRun(manifest, effectId, effect, args));
  }

  console.log(`Prepared ${prepared.length} Yoyo effect video run(s):`);
  for (const dir of prepared) console.log(`- ${rel(dir)}`);
}

try {
  main();
} catch (error) {
  console.error(`Effect video run prep failed: ${error.message}`);
  process.exit(1);
}
