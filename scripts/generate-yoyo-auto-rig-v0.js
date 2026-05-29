const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join, relative } = require('node:path');
const sharp = require('sharp');

const repoRoot = join(__dirname, '..');

function parseArgs(argv) {
  const args = {
    outputDir: join(repoRoot, 'output/yoyo-auto-rig-v0'),
    writeAssets: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') {
      args.outputDir = argv[index + 1];
      index += 1;
    } else if (arg === '--no-write-assets') {
      args.writeAssets = false;
    } else if (arg === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function rasterizeSvg(input, output, width, height) {
  await sharp(input, { density: 144 })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toFile(output);
}

async function makeBathBack(output) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="none"/>
    <ellipse cx="160" cy="202" rx="126" ry="18" fill="#4b6471" opacity=".22"/>
    <g shape-rendering="geometricPrecision">
      <path d="M42 82 Q42 62 62 62 H258 Q278 62 278 82 V172 Q278 194 256 194 H64 Q42 194 42 172 Z" fill="#78c5d3"/>
      <path d="M56 80 Q56 72 66 72 H254 Q264 72 264 80 V165 Q264 181 248 181 H72 Q56 181 56 165 Z" fill="#a8e1e8"/>
      <path d="M72 93 Q92 80 124 79 H196 Q228 80 248 93 Q227 105 196 106 H124 Q93 105 72 93 Z" fill="#f9f5e8"/>
      <path d="M84 95 Q102 87 128 86 H192 Q218 87 236 95 Q216 101 192 102 H128 Q104 101 84 95 Z" fill="#88d3de"/>
      <rect x="48" y="165" width="224" height="23" rx="8" fill="#5aaec1"/>
      <rect x="64" y="141" width="192" height="28" rx="8" fill="#93d6df" opacity=".58"/>
      <rect x="62" y="184" width="196" height="11" rx="5" fill="#3f8295" opacity=".72"/>
      <rect x="34" y="118" width="22" height="58" rx="6" fill="#5baec2"/>
      <rect x="264" y="118" width="22" height="58" rx="6" fill="#5baec2"/>
      <rect x="40" y="78" width="240" height="15" rx="7" fill="#e9fbf8"/>
      <rect x="58" y="82" width="204" height="7" rx="3" fill="#ffffff" opacity=".72"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function makeBathWater(output) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="none"/>
    <g shape-rendering="geometricPrecision">
      <path d="M82 96 Q103 88 130 87 H190 Q217 88 238 96 Q218 106 190 107 H130 Q102 106 82 96 Z" fill="#7bd2df" opacity=".86"/>
      <path d="M96 98 H224 Q211 103 190 104 H130 Q109 103 96 98 Z" fill="#bff5f5" opacity=".7"/>
      <rect x="106" y="103" width="48" height="6" rx="3" fill="#e8ffff" opacity=".72"/>
      <rect x="180" y="103" width="34" height="6" rx="3" fill="#e8ffff" opacity=".62"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function makeBathFoam(output) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="none"/>
    <g fill="#fff7e8">
      <ellipse cx="105" cy="39" rx="43" ry="12" opacity=".94"/>
      <ellipse cx="161" cy="42" rx="54" ry="13" opacity=".96"/>
      <ellipse cx="219" cy="39" rx="43" ry="12" opacity=".92"/>
      <circle cx="76" cy="38" r="13" opacity=".92"/>
      <circle cx="122" cy="29" r="12" opacity=".9"/>
      <circle cx="202" cy="29" r="12" opacity=".9"/>
      <circle cx="253" cy="40" r="14" opacity=".9"/>
      <rect x="86" y="47" width="149" height="13" rx="7" opacity=".84"/>
      <rect x="117" y="60" width="90" height="8" rx="4" opacity=".54"/>
    </g>
    <g fill="#e8fbff" opacity=".72">
      <rect x="71" y="53" width="37" height="6" rx="3"/>
      <rect x="214" y="52" width="44" height="6" rx="3"/>
      <circle cx="146" cy="31" r="4"/>
      <circle cx="185" cy="32" r="4"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function makeBathFront(output) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="none"/>
    <g shape-rendering="geometricPrecision">
      <path d="M45 94 Q62 104 88 105 H232 Q258 104 275 94 L267 177 Q265 197 246 197 H74 Q55 197 53 177 Z" fill="#68bed0"/>
      <path d="M58 113 H262 V170 Q262 184 248 184 H72 Q58 184 58 170 Z" fill="#89d2de" opacity=".78"/>
      <rect x="65" y="137" width="190" height="31" rx="8" fill="#55a9bd" opacity=".45"/>
      <rect x="76" y="157" width="168" height="9" rx="4" fill="#4a99ad" opacity=".46"/>
      <path d="M42 91 Q61 80 92 79 H228 Q259 80 278 91 Q258 104 228 105 H92 Q62 104 42 91 Z" fill="#fff8eb"/>
      <path d="M60 94 Q76 88 100 87 H220 Q244 88 260 94 Q240 101 220 102 H100 Q80 101 60 94 Z" fill="#dff9fb" opacity=".82"/>
      <rect x="48" y="188" width="224" height="15" rx="7" fill="#3f7182"/>
      <rect x="34" y="105" width="19" height="72" rx="6" fill="#70c4d4"/>
      <rect x="267" y="105" width="19" height="72" rx="6" fill="#70c4d4"/>
      <rect x="36" y="103" width="17" height="22" rx="4" fill="#d8f8f6" opacity=".8"/>
      <rect x="267" y="103" width="17" height="22" rx="4" fill="#d8f8f6" opacity=".8"/>
      <g transform="translate(54 70)">
        <ellipse cx="0" cy="7" rx="14" ry="10" fill="#ffd84f"/>
        <circle cx="-9" cy="-5" r="8" fill="#ffdf62"/>
        <path d="M-17 -5 L-29 0 L-17 5 Z" fill="#f28a27"/>
        <circle cx="-6" cy="-8" r="1.5" fill="#2a3038"/>
      </g>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function extractYoyoFrame(petJson, output) {
  const asset = petJson.asset;
  const idle = petJson.states.idle;
  await sharp(join(repoRoot, 'assets/yoyo', asset.spritesheetPath))
    .extract({
      left: 0,
      top: idle.row * asset.cellHeight,
      width: asset.cellWidth,
      height: asset.cellHeight,
    })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toFile(output);
}

async function alphaBuffer(input, width, height, left, top, stageWidth, stageHeight) {
  const image = Buffer.isBuffer(input)
    ? input
    : await sharp(input).resize(width, height).png().toBuffer();
  const layer = await sharp({
    create: {
      width: stageWidth,
      height: stageHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: image, left, top }])
    .raw()
    .toBuffer();

  const alpha = new Uint8Array(stageWidth * stageHeight);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = layer[i * 4 + 3];
  }
  return alpha;
}

async function makeCharacterBuffer(path, character) {
  const visibleHeight = character.clip?.height ?? character.height;
  const base = await sharp(path)
    .resize(character.width, character.height)
    .extract({ left: 0, top: 0, width: character.width, height: visibleHeight })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: character.width,
      height: character.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: base, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

function analyzeOcclusion({ characterAlpha, frontAlpha, stageWidth, stageHeight, baselineY }) {
  let lowerCharacterPixels = 0;
  let uncoveredLowerPixels = 0;
  let coveredLowerPixels = 0;

  for (let y = baselineY; y < stageHeight; y += 1) {
    for (let x = 0; x < stageWidth; x += 1) {
      const index = y * stageWidth + x;
      if (characterAlpha[index] > 20) {
        lowerCharacterPixels += 1;
        if (frontAlpha[index] > 20) coveredLowerPixels += 1;
        else uncoveredLowerPixels += 1;
      }
    }
  }

  const uncoveredRatio = lowerCharacterPixels === 0 ? 0 : uncoveredLowerPixels / lowerCharacterPixels;
  return {
    baselineY,
    lowerCharacterPixels,
    coveredLowerPixels,
    uncoveredLowerPixels,
    uncoveredRatio: Number(uncoveredRatio.toFixed(4)),
    pass: uncoveredRatio <= 0.08,
  };
}

async function renderFrame({ paths, frame, rig, output, debugOverlay = rig.qa.debugOverlay }) {
  const { stage, placements } = rig;
  const bobY = rig.motions.bath.keyframes[frame].bobY;
  const character = placements.character;
  const characterInput = await makeCharacterBuffer(paths.yoyo, character);

  const overlays = [];
  if (debugOverlay) {
    overlays.push({
      input: Buffer.from(
        `<svg width="${stage.width}" height="${stage.height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${placements.bath.x}" y="${placements.bath.y}" width="${placements.bath.width}" height="${placements.bath.height}" fill="none" stroke="#00a8ff" stroke-width="2"/>
          <rect x="${character.x}" y="${character.y + bobY}" width="${character.width}" height="${character.height}" fill="none" stroke="#ff4d4f" stroke-width="2"/>
          <line x1="0" y1="${rig.qa.occlusionBaselineY}" x2="${stage.width}" y2="${rig.qa.occlusionBaselineY}" stroke="#ffcc00" stroke-width="2" stroke-dasharray="8 6"/>
        </svg>`,
      ),
      left: 0,
      top: 0,
    });
  }

  await sharp({
    create: {
      width: stage.width,
      height: stage.height,
      channels: 4,
      background: rig.stage.background,
    },
  })
    .composite([
      { input: paths.bathBack, left: placements.bath.x, top: placements.bath.y },
      { input: characterInput, left: character.x, top: character.y + bobY },
      { input: paths.bathWater, left: placements.bath.x, top: placements.bath.y },
      {
        input: paths.bathBubbles,
        left: placements.bubbles.x,
        top: placements.bubbles.y + rig.motions.bath.keyframes[frame].foamY,
      },
      { input: paths.bathFront, left: placements.bath.x, top: placements.bath.y },
      ...overlays,
    ])
    .png()
    .toFile(output);
}

async function makeContactSheet(framePaths, output) {
  const frameMeta = await sharp(framePaths[0]).metadata();
  const labelHeight = 28;
  const columns = framePaths.length;
  const composites = [];

  for (let i = 0; i < framePaths.length; i += 1) {
    composites.push({ input: framePaths[i], left: i * frameMeta.width, top: labelHeight });
    composites.push({
      input: Buffer.from(
        `<svg width="${frameMeta.width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#182029"/>
          <text x="12" y="19" font-family="Arial" font-size="13" fill="#f4f7fb">frame ${i}</text>
        </svg>`,
      ),
      left: i * frameMeta.width,
      top: 0,
    });
  }

  await sharp({
    create: {
      width: frameMeta.width * columns,
      height: frameMeta.height + labelHeight,
      channels: 4,
      background: '#182029',
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

function makeRig(partsDir) {
  return {
    id: 'yoyo-auto-rig-v0',
    version: 0,
    format: 'codex-pet-auto-rig',
    intent: 'Deterministic Yoyo scene rig generated from existing spritesheet and layered bath props.',
    stage: {
      width: 512,
      height: 384,
      background: '#f6efe7',
    },
    sources: {
      character: 'assets/yoyo/spritesheet.webp#idle[0]',
      bathBack: 'assets-src/yoyo/home/prop-bath-back.svg#polished',
      bathWater: 'assets-src/yoyo/home/prop-bath-water.svg#polished',
      bathBubbles: 'assets-src/yoyo/home/prop-bath-bubbles.svg#normalized',
      bathFront: 'assets-src/yoyo/home/prop-bath-front.svg#polished',
    },
    parts: [
      { id: 'bath.back', file: relative(repoRoot, join(partsDir, 'bath-back.png')), z: 10 },
      { id: 'yoyo.body', file: relative(repoRoot, join(partsDir, 'yoyo-idle-0.png')), z: 20 },
      { id: 'bath.water', file: relative(repoRoot, join(partsDir, 'bath-water.png')), z: 30 },
      { id: 'bath.bubbles', file: relative(repoRoot, join(partsDir, 'bath-bubbles.png')), z: 35 },
      { id: 'bath.frontMask', file: relative(repoRoot, join(partsDir, 'bath-front.png')), z: 40 },
    ],
    placements: {
      bath: { x: 96, y: 118, width: 320, height: 240 },
      bubbles: { x: 96, y: 183, width: 320, height: 240 },
      character: {
        x: 160,
        y: 76,
        width: 192,
        height: 208,
        clip: {
          id: 'bath-inner-opening',
          height: 156,
          reason: 'Hide the lower body behind the bath rim before front-mask compositing.',
        },
        anchor: { x: 0.5, y: 1 },
        targetAnchor: 'bath.innerFloor',
      },
    },
    anchors: {
      'bath.innerFloor': { x: 256, y: 286 },
      'bath.lip': { x: 256, y: 230 },
      'bath.frontMaskTop': { x: 256, y: 212 },
      'yoyo.bodyBottom': { x: 256, y: 284 },
    },
    masks: [
      {
        id: 'bath-front-occlusion',
        frontPart: 'bath.frontMask',
        hidesPart: 'yoyo.body',
        clip: 'bath-inner-opening',
        baselineY: 230,
        maxUncoveredLowerRatio: 0.08,
      },
    ],
    motions: {
      bath: {
        fps: 8,
        loop: true,
        keyframes: [
          { t: 0, bobY: 0, foamY: 0 },
          { t: 125, bobY: -2, foamY: -1 },
          { t: 250, bobY: -3, foamY: -2 },
          { t: 375, bobY: -2, foamY: -1 },
          { t: 500, bobY: 0, foamY: 0 },
          { t: 625, bobY: 1, foamY: 1 },
        ],
      },
    },
    qa: {
      debugOverlay: true,
      occlusionBaselineY: 230,
    },
  };
}

function makeTimeline() {
  return {
    id: 'bath-auto',
    version: 0,
    engine: 'codex-pet-auto-rig',
    effectType: 'auto-rig-action',
    runtimeMode: 'pixi-auto-rig',
    strictAssets: true,
    durationMs: 3000,
    rig: 'rig/yoyo.rig.json',
    motion: 'bath',
    scene: {
      mode: 'bath',
      characterSource: 'spritesheet',
      spriteState: 'idle',
      spriteFrame: 0,
    },
    qa: {
      requireOcclusionPass: true,
      maxUncoveredLowerRatio: 0.08,
    },
  };
}

function copyGeneratedParts(targetPartsDir, paths) {
  ensureDir(targetPartsDir);
  for (const [name, source] of Object.entries(paths)) {
    const fileName = name === 'yoyo' ? 'yoyo-idle-0.png' : `${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}.png`;
    copyFileSync(source, join(targetPartsDir, fileName));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/generate-yoyo-auto-rig-v0.js [--output-dir <dir>] [--no-write-assets]');
    return;
  }

  const petJsonPath = join(repoRoot, 'assets/yoyo/pet.json');
  const required = [
    petJsonPath,
    join(repoRoot, 'assets/yoyo/spritesheet.webp'),
    join(repoRoot, 'assets-src/yoyo/home/prop-bath-back.svg'),
    join(repoRoot, 'assets-src/yoyo/home/prop-bath-water.svg'),
    join(repoRoot, 'assets-src/yoyo/home/prop-bath-bubbles.svg'),
    join(repoRoot, 'assets-src/yoyo/home/prop-bath-front.svg'),
  ];

  for (const path of required) {
    if (!existsSync(path)) throw new Error(`Missing required source: ${relative(repoRoot, path)}`);
  }

  const outDir = args.outputDir;
  const partsDir = join(outDir, 'parts');
  const framesDir = join(outDir, 'frames');
  const qaDir = join(outDir, 'qa');
  ensureDir(partsDir);
  ensureDir(framesDir);
  ensureDir(qaDir);

  const petJson = JSON.parse(readFileSync(petJsonPath, 'utf8'));
  const paths = {
    yoyo: join(partsDir, 'yoyo-idle-0.png'),
    bathBack: join(partsDir, 'bath-back.png'),
    bathWater: join(partsDir, 'bath-water.png'),
    bathBubbles: join(partsDir, 'bath-bubbles.png'),
    bathFront: join(partsDir, 'bath-front.png'),
  };

  await extractYoyoFrame(petJson, paths.yoyo);
  await makeBathBack(paths.bathBack);
  await makeBathWater(paths.bathWater);
  await makeBathFoam(paths.bathBubbles);
  await makeBathFront(paths.bathFront);

  const rig = makeRig(partsDir);
  const timeline = makeTimeline();
  const rigPath = join(outDir, 'yoyo.rig.json');
  const timelinePath = join(outDir, 'timeline.json');
  writeJson(rigPath, rig);
  writeJson(timelinePath, timeline);

  const characterInput = await makeCharacterBuffer(paths.yoyo, rig.placements.character);
  const characterAlpha = await alphaBuffer(
    characterInput,
    rig.placements.character.width,
    rig.placements.character.height,
    rig.placements.character.x,
    rig.placements.character.y,
    rig.stage.width,
    rig.stage.height,
  );
  const frontAlpha = await alphaBuffer(
    paths.bathFront,
    rig.placements.bath.width,
    rig.placements.bath.height,
    rig.placements.bath.x,
    rig.placements.bath.y,
    rig.stage.width,
    rig.stage.height,
  );
  const occlusion = analyzeOcclusion({
    characterAlpha,
    frontAlpha,
    stageWidth: rig.stage.width,
    stageHeight: rig.stage.height,
    baselineY: rig.qa.occlusionBaselineY,
  });

  const framePaths = [];
  for (let frame = 0; frame < rig.motions.bath.keyframes.length; frame += 1) {
    const framePath = join(framesDir, `bath-${String(frame).padStart(2, '0')}.png`);
    await renderFrame({ paths, frame, rig, output: framePath });
    framePaths.push(framePath);
  }

  const contactSheetPath = join(qaDir, 'bath-contact-sheet.png');
  await makeContactSheet(framePaths, contactSheetPath);
  const previewPath = join(qaDir, 'bath-preview.png');
  await renderFrame({ paths, frame: 0, rig, output: previewPath, debugOverlay: false });

  const report = {
    id: 'yoyo-auto-rig-v0',
    generatedAt: new Date().toISOString(),
    rig: relative(repoRoot, rigPath),
    timeline: relative(repoRoot, timelinePath),
    preview: relative(repoRoot, previewPath),
    contactSheet: relative(repoRoot, contactSheetPath),
    frames: framePaths.map((path) => relative(repoRoot, path)),
    checks: {
      occlusion,
      sourceFilesPresent: true,
    },
    pass: occlusion.pass,
  };

  const reportPath = join(qaDir, 'report.json');
  writeJson(reportPath, report);
  writeFileSync(
    join(qaDir, 'report.md'),
    [
      '# Yoyo Auto Rig v0 QA',
      '',
      `- Rig: ${report.rig}`,
      `- Timeline: ${report.timeline}`,
      `- Contact sheet: ${report.contactSheet}`,
      `- Occlusion uncovered lower ratio: ${occlusion.uncoveredRatio}`,
      `- Result: ${report.pass ? 'pass' : 'fail'}`,
      '',
    ].join('\n'),
  );

  if (args.writeAssets) {
    const sourceRigDir = join(repoRoot, 'assets-src/yoyo/rig/auto-rig-v0');
    const runtimeRigDir = join(repoRoot, 'assets/yoyo/effects/bath-auto/rig');
    const runtimeTimelinePath = join(repoRoot, 'assets/yoyo/effects/bath-auto/timeline.json');
    ensureDir(sourceRigDir);
    ensureDir(runtimeRigDir);

    copyGeneratedParts(join(sourceRigDir, 'parts'), paths);
    copyGeneratedParts(join(runtimeRigDir, 'parts'), paths);

    writeJson(join(sourceRigDir, 'yoyo.rig.json'), makeRig(join(sourceRigDir, 'parts')));
    writeJson(join(sourceRigDir, 'timeline.json'), timeline);
    writeJson(join(runtimeRigDir, 'yoyo.rig.json'), makeRig(join(runtimeRigDir, 'parts')));
    writeJson(runtimeTimelinePath, timeline);
  }

  console.log(`Wrote ${relative(repoRoot, rigPath)}`);
  console.log(`Wrote ${relative(repoRoot, timelinePath)}`);
  console.log(`Wrote ${relative(repoRoot, contactSheetPath)}`);
  console.log(`Occlusion ${occlusion.pass ? 'passed' : 'failed'} (${occlusion.uncoveredRatio})`);

  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
