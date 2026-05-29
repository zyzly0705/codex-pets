const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, join, relative } = require('node:path');
const sharp = require('sharp');

const repoRoot = join(__dirname, '..');

function parseArgs(argv) {
  const args = {
    manifest: 'assets-src/yoyo/final-art/bath-final-effect.manifest.json',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') {
      args.manifest = argv[index + 1];
      index += 1;
    } else if (arg === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function repoPath(path) {
  if (isAbsolute(path)) return path;
  return join(repoRoot, path);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFullScene(manifest, output) {
  await sharp(repoPath(manifest.sourceArt))
    .resize(manifest.stage.width, manifest.stage.height, {
      fit: 'contain',
      background: manifest.stage.background,
    })
    .png()
    .toFile(output);
}

function overlaySvg(generator, stage) {
  if (generator === 'water-shimmer-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M164 181 C188 174 214 174 238 181" stroke="#e8ffff" stroke-width="4" opacity=".42"/>
        <path d="M270 181 C300 174 331 176 360 183" stroke="#e8ffff" stroke-width="4" opacity=".34"/>
        <path d="M191 198 C224 205 263 205 298 198" stroke="#c5f6ff" stroke-width="3" opacity=".34"/>
        <path d="M321 198 C344 202 369 200 390 194" stroke="#e8ffff" stroke-width="3" opacity=".28"/>
        <circle cx="229" cy="190" r="3" fill="#f4ffff" opacity=".52"/>
        <circle cx="309" cy="190" r="3" fill="#f4ffff" opacity=".42"/>
        <circle cx="347" cy="185" r="2" fill="#f4ffff" opacity=".38"/>
      </g>
    </svg>`;
  }

  if (generator === 'steam-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="none" stroke="#fff7e8" stroke-width="4" stroke-linecap="round" opacity=".36">
        <path d="M155 151 C143 139 162 128 151 116"/>
        <path d="M359 149 C376 136 354 127 369 113"/>
        <path d="M400 172 C416 161 396 151 410 139"/>
      </g>
      <g fill="#ffffff" opacity=".22">
        <circle cx="147" cy="115" r="6"/>
        <circle cx="367" cy="112" r="6"/>
        <circle cx="410" cy="138" r="5"/>
      </g>
    </svg>`;
  }

  if (generator === 'food-steam-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="none" stroke="#fff4e4" stroke-width="5" stroke-linecap="round" opacity=".42">
        <path d="M199 237 C184 222 208 211 195 196"/>
        <path d="M256 231 C241 216 266 205 253 190"/>
        <path d="M312 237 C329 222 304 210 319 195"/>
      </g>
      <g fill="#ffffff" opacity=".2">
        <circle cx="196" cy="195" r="7"/>
        <circle cx="253" cy="190" r="6"/>
        <circle cx="319" cy="195" r="7"/>
      </g>
    </svg>`;
  }

  if (generator === 'satisfaction-sparkle-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="#ffc84a" stroke="#b9781b" stroke-width="2" stroke-linejoin="round">
        <path d="M150 129 L158 148 L177 156 L158 164 L150 183 L142 164 L123 156 L142 148 Z" opacity=".9"/>
        <path d="M369 137 L375 151 L389 157 L375 163 L369 177 L363 163 L349 157 L363 151 Z" opacity=".82"/>
      </g>
      <g fill="#ff7f8d" stroke="#c64a58" stroke-width="2" opacity=".86">
        <path d="M132 206 C117 194 120 176 136 179 C145 164 166 174 159 191 C154 202 141 207 132 206 Z"/>
        <path d="M382 207 C367 195 370 178 385 181 C394 166 415 176 408 192 C404 202 391 208 382 207 Z"/>
      </g>
    </svg>`;
  }

  if (generator === 'sleep-stars-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="#ffd86b" stroke="#b9781b" stroke-width="2" stroke-linejoin="round" opacity=".86">
        <path d="M154 111 L160 126 L175 132 L160 138 L154 153 L148 138 L133 132 L148 126 Z"/>
        <path d="M358 101 L364 116 L379 122 L364 128 L358 143 L352 128 L337 122 L352 116 Z"/>
      </g>
      <g fill="#9fc6ff" opacity=".76">
        <path d="M393 149 C378 150 366 139 366 124 C377 132 393 129 402 117 C405 132 405 144 393 149 Z"/>
      </g>
      <g fill="#7898c7" font-family="Arial, sans-serif" font-size="24" font-weight="700" opacity=".55">
        <text x="113" y="181">Z</text>
        <text x="384" y="183">Z</text>
      </g>
    </svg>`;
  }

  if (generator === 'play-sparkle-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <g fill="#ffd15d" stroke="#b9781b" stroke-width="2" stroke-linejoin="round" opacity=".82">
        <path d="M146 140 L154 158 L172 166 L154 174 L146 192 L138 174 L120 166 L138 158 Z"/>
        <path d="M376 145 L382 159 L396 165 L382 171 L376 185 L370 171 L356 165 L370 159 Z"/>
      </g>
      <g fill="#8bdcff" opacity=".46">
        <circle cx="182" cy="222" r="7"/>
        <circle cx="330" cy="220" r="6"/>
      </g>
    </svg>`;
  }

  if (generator === 'screen-glow-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <ellipse cx="256" cy="219" rx="155" ry="82" fill="#8bdcff" opacity=".18"/>
      <ellipse cx="256" cy="219" rx="112" ry="56" fill="#ffffff" opacity=".12"/>
      <g fill="#fff2a3" stroke="#ca8a21" stroke-width="2" stroke-linejoin="round" opacity=".8">
        <path d="M145 142 L151 156 L165 162 L151 168 L145 182 L139 168 L125 162 L139 156 Z"/>
        <path d="M366 141 L372 155 L386 161 L372 167 L366 181 L360 167 L346 161 L360 155 Z"/>
      </g>
    </svg>`;
  }

  if (generator === 'study-glow-v1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="none"/>
      <ellipse cx="256" cy="205" rx="135" ry="88" fill="#ffe8a8" opacity=".16"/>
      <g fill="#ffd15d" stroke="#b9781b" stroke-width="2" stroke-linejoin="round" opacity=".78">
        <path d="M156 133 L162 147 L176 153 L162 159 L156 173 L150 159 L136 153 L150 147 Z"/>
        <path d="M360 135 L366 149 L380 155 L366 161 L360 175 L354 161 L340 155 L354 149 Z"/>
      </g>
    </svg>`;
  }

  throw new Error(`Unknown overlay generator: ${generator}`);
}

async function writeOverlay(manifest, overlay, output) {
  const svg = overlaySvg(overlay.generator, manifest.stage);
  await sharp(Buffer.from(svg)).png().toFile(output);
}

function makeRig(manifest, partsDir) {
  const parts = [
    { id: 'scene.full', file: relative(repoRoot, join(partsDir, 'scene-full.png')), z: 10 },
    ...manifest.overlays.map((overlay) => ({
      id: overlay.id,
      file: relative(repoRoot, join(partsDir, overlay.file)),
      z: overlay.z,
    })),
  ];

  return {
    id: manifest.rigId,
    version: manifest.version,
    format: 'codex-pet-auto-rig',
    intent: manifest.intent,
    stage: manifest.stage,
    sources: {
      finalArt: manifest.sourceArt,
      manifest: relative(repoRoot, repoPath(manifest.__manifestPath)),
      note: 'The visual master is used as the composed scene layer; manifest overlays provide deterministic animation layers.',
    },
    parts,
    placements: {
      scene: { x: 0, y: 0, width: manifest.stage.width, height: manifest.stage.height },
    },
    motions: {
      [manifest.motion.id]: {
        fps: manifest.motion.fps,
        loop: manifest.motion.loop,
        keyframes: manifest.motion.keyframes,
      },
    },
    qa: {
      finalArtPreview: true,
    },
  };
}

function makeTimeline(manifest) {
  return {
    id: manifest.id,
    version: manifest.version,
    engine: 'codex-pet-auto-rig',
    effectType: 'auto-rig-action',
    runtimeMode: 'pixi-auto-rig',
    strictAssets: true,
    durationMs: manifest.motion.durationMs,
    rig: 'rig/yoyo.rig.json',
    motion: manifest.motion.id,
    scene: {
      ...manifest.scene,
      artSource: manifest.sourceArt,
    },
    qa: {
      requireNonBlankPreview: true,
    },
  };
}

function copyParts(partFiles, targetDir) {
  ensureDir(targetDir);
  for (const partFile of partFiles) {
    copyFileSync(partFile.source, join(targetDir, partFile.name));
  }
}

function readManifest(manifestPath) {
  const absolutePath = repoPath(manifestPath);
  if (!existsSync(absolutePath)) throw new Error(`Missing manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(absolutePath, 'utf8'));
  manifest.__manifestPath = manifestPath;

  const required = ['id', 'rigId', 'sourceArt', 'outputDir', 'sourceRigDir', 'runtimeDir'];
  for (const key of required) {
    if (!manifest[key]) throw new Error(`Manifest missing required key: ${key}`);
  }
  if (!existsSync(repoPath(manifest.sourceArt))) {
    throw new Error(`Missing final art source: ${manifest.sourceArt}`);
  }
  if (!manifest.motion?.id || !Array.isArray(manifest.motion.keyframes)) {
    throw new Error('Manifest motion must include id and keyframes');
  }
  if (!Array.isArray(manifest.overlays)) {
    throw new Error('Manifest overlays must be an array');
  }

  return manifest;
}

async function build(manifest) {
  const outputDir = repoPath(manifest.outputDir);
  const partsDir = join(outputDir, 'parts');
  ensureDir(partsDir);

  const partFiles = [{ name: 'scene-full.png', source: join(partsDir, 'scene-full.png') }];
  await writeFullScene(manifest, partFiles[0].source);

  for (const overlay of manifest.overlays) {
    const overlayPath = join(partsDir, overlay.file);
    await writeOverlay(manifest, overlay, overlayPath);
    partFiles.push({ name: overlay.file, source: overlayPath });
  }

  const rig = makeRig(manifest, partsDir);
  const timeline = makeTimeline(manifest);
  writeJson(join(outputDir, 'yoyo.rig.json'), rig);
  writeJson(join(outputDir, 'timeline.json'), timeline);

  const sourceRigDir = repoPath(manifest.sourceRigDir);
  const runtimeDir = repoPath(manifest.runtimeDir);
  copyParts(partFiles, join(sourceRigDir, 'parts'));
  copyParts(partFiles, join(runtimeDir, 'rig/parts'));
  writeJson(join(sourceRigDir, 'yoyo.rig.json'), makeRig(manifest, join(sourceRigDir, 'parts')));
  writeJson(join(sourceRigDir, 'timeline.json'), timeline);
  writeJson(join(runtimeDir, 'rig/yoyo.rig.json'), makeRig(manifest, join(runtimeDir, 'rig/parts')));
  writeJson(join(runtimeDir, 'timeline.json'), timeline);

  const previewName = manifest.previewName || `${manifest.id}-preview.png`;
  copyFileSync(join(partsDir, 'scene-full.png'), join(outputDir, previewName));
  console.log(`Wrote ${relative(repoRoot, join(outputDir, previewName))}`);
  console.log(`Wrote ${relative(repoRoot, join(runtimeDir, 'timeline.json'))}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/build-yoyo-final-art-effect.js --manifest <manifest.json>');
    return;
  }

  await build(readManifest(args.manifest));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
