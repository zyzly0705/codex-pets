#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const styleGuidePath = path.join(repoRoot, 'assets-src/yoyo/v3/style-guide.json');
const promptPackPath = path.join(repoRoot, 'assets-src/yoyo/v3/prompt-pack.json');
const manifestPath = path.join(repoRoot, 'assets-src/yoyo/v3/manifest.json');
const reportPath = path.join(repoRoot, 'assets/yoyo/qa/v3/v3-kit-report.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

async function imageMetadata(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) return null;
  return sharp(absPath).metadata();
}

async function hasTransparentCorners(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) return false;
  const image = sharp(absPath).ensureAlpha();
  const meta = await image.metadata();
  const samples = [
    { left: 0, top: 0 },
    { left: Math.max(0, meta.width - 1), top: 0 },
    { left: 0, top: Math.max(0, meta.height - 1) },
    { left: Math.max(0, meta.width - 1), top: Math.max(0, meta.height - 1) },
  ];

  for (const sample of samples) {
    const pixel = await image
      .clone()
      .extract({ ...sample, width: 1, height: 1 })
      .raw()
      .toBuffer();
    if (pixel[3] > 8) return false;
  }

  return true;
}

function requiredPromptIds(manifest) {
  return [
    ...manifest.rooms.map((item) => item.id),
    ...manifest.props.map((item) => item.id),
    ...manifest.composites.map((item) => item.id),
    'character-rig-v3-source',
  ];
}

function readRigContract(manifest) {
  const contractPath = manifest?.characterRig?.contract;
  if (!contractPath || !exists(contractPath)) return null;
  return readJson(path.join(repoRoot, contractPath));
}

function validateExpressionContract(contract, errors) {
  if (!contract) return;
  const expression = contract.expression;
  if (!expression) {
    errors.push('Character rig contract must declare expression controls');
    return;
  }

  for (const layer of ['face/base', 'face/eyes', 'face/mouth', 'face/brows', 'face/blush', 'face/effects']) {
    if (!expression.layers?.includes(layer)) {
      errors.push(`Expression controls must include layer ${layer}`);
    }
  }

  const presetIds = new Set((expression.presets || []).map((preset) => preset.id));
  for (const preset of ['neutral', 'happy', 'shy', 'sleepy', 'angry', 'sad', 'surprised', 'blink', 'talk_small', 'talk_round', 'talk_flat']) {
    if (!presetIds.has(preset)) {
      errors.push(`Expression controls missing preset ${preset}`);
    }
  }

  for (const action of ['pet', 'bath', 'sleep', 'whip']) {
    if (!expression.behaviorMap?.[action]?.primary) {
      errors.push(`Expression behaviorMap missing primary preset for ${action}`);
    }
  }

  for (const [action, mapping] of Object.entries(expression.behaviorMap || {})) {
    for (const key of ['primary', 'fallback']) {
      if (mapping?.[key] && !presetIds.has(mapping[key])) {
        errors.push(`Expression behaviorMap ${action}.${key} references unknown preset ${mapping[key]}`);
      }
    }
  }

  for (const preset of expression.talkCycle || []) {
    if (!presetIds.has(preset)) {
      errors.push(`Expression talkCycle references unknown preset ${preset}`);
    }
  }

  const controlModule = expression.runtime?.controlModule;
  if (!controlModule) {
    errors.push('Expression runtime must declare a controlModule');
  } else if (!exists(controlModule)) {
    errors.push(`Expression runtime controlModule missing: ${controlModule}`);
  }

  const sourceRig = expression.runtime?.sourceRig;
  if (!sourceRig) {
    errors.push('Expression runtime must declare a sourceRig');
  } else if (!exists(sourceRig)) {
    errors.push(`Expression runtime sourceRig missing: ${sourceRig}`);
  }

  const previewDir = expression.runtime?.previewDir;
  if (!previewDir) {
    errors.push('Expression runtime must declare a previewDir');
  } else {
    for (const preset of expression.presets || []) {
      const previewPath = path.join(previewDir, `${preset.id}.png`);
      if (!exists(previewPath)) {
        errors.push(`Expression preview missing: ${previewPath}`);
      }
    }
  }

  const qaContactSheet = expression.runtime?.qaContactSheet;
  if (!qaContactSheet) {
    errors.push('Expression runtime must declare a qaContactSheet');
  } else if (!exists(qaContactSheet)) {
    errors.push(`Expression QA contact sheet missing: ${qaContactSheet}`);
  }

  for (const [alias, preset] of Object.entries(expression.runtime?.legacyAliases || {})) {
    if (!presetIds.has(preset)) {
      errors.push(`Expression legacy alias ${alias} references unknown preset ${preset}`);
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const writeReport = args.has('--write-report');
  const errors = [];
  const warnings = [];

  for (const filePath of [styleGuidePath, promptPackPath, manifestPath]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing ${path.relative(repoRoot, filePath)}`);
    }
  }

  const styleGuide = fs.existsSync(styleGuidePath) ? readJson(styleGuidePath) : null;
  const promptPack = fs.existsSync(promptPackPath) ? readJson(promptPackPath) : null;
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const rigContract = readRigContract(manifest);

  if (styleGuide) {
    for (const forbidden of ['dog bowl', 'kibble', 'paw motif']) {
      if (!styleGuide.avoid.includes(forbidden)) {
        errors.push(`style-guide avoid list must include ${forbidden}`);
      }
    }
    if (styleGuide.rooms?.size?.width !== 1080 || styleGuide.rooms?.size?.height !== 720) {
      errors.push('style-guide rooms.size must be 1080x720');
    }
  }

  if (promptPack && manifest) {
    const promptIds = new Set(promptPack.prompts.map((prompt) => prompt.id));
    for (const id of requiredPromptIds(manifest)) {
      if (!promptIds.has(id)) errors.push(`Missing prompt for ${id}`);
    }
  }

  if (manifest) {
    if (manifest.runtimeCompatibility?.avatarDriver !== 'pixi-spritesheet') {
      errors.push('V3 must keep pixi-spritesheet as the current avatar driver');
    }
    if (manifest.runtimeCompatibility?.keepCurrentSpritesheet !== true) {
      errors.push('V3 must preserve the current spritesheet during this phase');
    }
  }

  const accepted = manifest ? [...manifest.rooms, ...manifest.props, ...manifest.composites] : [];
  for (const item of accepted) {
    if (!item.source.startsWith('assets-src/yoyo/v3/')) {
      errors.push(`${item.id} source must live under assets-src/yoyo/v3`);
    }
    if (!item.runtime.startsWith('assets/yoyo/home/')) {
      errors.push(`${item.id} runtime must live under assets/yoyo/home`);
    }
    if (!item.qaPreview.startsWith('assets/yoyo/qa/v3/')) {
      errors.push(`${item.id} QA preview must live under assets/yoyo/qa/v3`);
    }

    if (!exists(item.source)) warnings.push(`Source not generated yet: ${item.source}`);
    if (!exists(item.runtime)) warnings.push(`Runtime not generated yet: ${item.runtime}`);
    if (!exists(item.qaPreview)) warnings.push(`QA preview not generated yet: ${item.qaPreview}`);

    const runtimeMeta = await imageMetadata(item.runtime);
    if (runtimeMeta) {
      if (item.width && runtimeMeta.width !== item.width) {
        errors.push(`${item.runtime} width ${runtimeMeta.width} != ${item.width}`);
      }
      if (item.height && runtimeMeta.height !== item.height) {
        errors.push(`${item.runtime} height ${runtimeMeta.height} != ${item.height}`);
      }
      if (item.transparent && !(await hasTransparentCorners(item.runtime))) {
        errors.push(`${item.runtime} should have transparent corners`);
      }
    }
  }

  if (manifest?.characterRig) {
    if (!exists(manifest.characterRig.contract)) {
      warnings.push(`Character rig contract not written yet: ${manifest.characterRig.contract}`);
    }
    if (!exists(manifest.characterRig.source)) {
      warnings.push(`Character rig source not generated yet: ${manifest.characterRig.source}`);
    }
    validateExpressionContract(rigContract, errors);
  }

  if (writeReport) {
    const expression = rigContract?.expression;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, [
      '# Yoyo V3 Full Asset Kit QA Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Spritesheet Compatibility',
      '',
      manifest?.runtimeCompatibility?.keepCurrentSpritesheet
        ? '- Current `assets/yoyo/spritesheet.webp` remains the active avatar driver.'
        : '- V3 manifest does not preserve spritesheet compatibility.',
      '',
      '## Asset Coverage',
      '',
      `- Rooms: ${manifest?.rooms?.length || 0}`,
      `- Props: ${manifest?.props?.length || 0}`,
      `- Composites: ${manifest?.composites?.length || 0}`,
      '',
      '## Runtime Captures',
      '',
      '- `assets/yoyo/qa/v3/home-v3-day-runtime.png`',
      '- `assets/yoyo/qa/v3/home-v3-feed-runtime.png`',
      '- `assets/yoyo/qa/v3/home-v3-night-runtime.png`',
      '',
      '## Expression Controls',
      '',
      expression
        ? `- Layers: ${expression.layers.length}`
        : '- Layers: 0',
      expression
        ? `- Presets: ${expression.presets.length}`
        : '- Presets: 0',
      expression
        ? `- Default: \`${expression.defaultPreset}\``
        : '- Default: none',
      expression
        ? `- Talk cycle: ${expression.talkCycle.map((id) => `\`${id}\``).join(', ')}`
        : '- Talk cycle: none',
      expression?.runtime?.controlModule
        ? `- Control module: \`${expression.runtime.controlModule}\``
        : '- Control module: none',
      expression?.runtime?.sourceRig
        ? `- Source rig: \`${expression.runtime.sourceRig}\``
        : '- Source rig: none',
      expression?.runtime?.previewDir
        ? `- Preview dir: \`${expression.runtime.previewDir}\``
        : '- Preview dir: none',
      expression?.runtime?.qaContactSheet
        ? `- QA contact sheet: \`${expression.runtime.qaContactSheet}\``
        : '- QA contact sheet: none',
      expression?.runtime?.currentSurfaces
        ? `- Current surfaces: ${expression.runtime.currentSurfaces.map((id) => `\`${id}\``).join(', ')}`
        : '- Current surfaces: none',
      '',
      '## Warnings',
      '',
      ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None']),
      '',
      '## Errors',
      '',
      ...(errors.length ? errors.map((error) => `- ${error}`) : ['- None']),
      '',
    ].join('\n'));
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    if (check) process.exit(1);
  }

  console.log('Yoyo V3 kit audit passed');
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
