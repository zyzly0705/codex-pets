#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const targetPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, 'assets');
const strict = process.argv.includes('--strict');

function fail(message) {
  console.error(`Asset audit failed: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  warnings.push(message);
}

async function metadata(filePath) {
  try {
    return await sharp(filePath).metadata();
  } catch (error) {
    fail(`${path.relative(repoRoot, filePath)} cannot be read: ${error.message}`);
    return null;
  }
}

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function normalizeFrameRef(ref, fallbackRow = 0) {
  if (Array.isArray(ref)) {
    return {
      row: Number(ref[0] ?? fallbackRow),
      frame: Number(ref[1] ?? 0),
    };
  }
  if (ref && typeof ref === 'object') {
    return {
      row: Number(ref.row ?? fallbackRow),
      frame: Number(ref.frame ?? ref.col ?? ref.column ?? 0),
    };
  }
  return {
    row: Number(fallbackRow),
    frame: Number(ref ?? 0),
  };
}

function collectFrameRefs(spec = {}) {
  const fallbackRow = Number(spec.row ?? 0);
  if (Array.isArray(spec.sequence)) {
    return spec.sequence.map((item) => normalizeFrameRef(item, fallbackRow));
  }
  if (Array.isArray(spec.frameSequence)) {
    return spec.frameSequence.map((item) => normalizeFrameRef(item, fallbackRow));
  }
  if (Array.isArray(spec.clips)) {
    return spec.clips.flatMap((clip) => {
      const row = Number(clip.row ?? fallbackRow);
      const start = Number(clip.start ?? clip.frameStart ?? 0);
      const frames = Number(clip.frames ?? spec.frames ?? 0);
      if (!Number.isInteger(frames) || frames <= 0) return [{ row, frame: NaN }];
      return Array.from({ length: frames }, (_, i) => ({ row, frame: start + i }));
    });
  }
  const frames = Number(spec.frames);
  if (!Number.isInteger(frames) || frames <= 0) return [];
  return Array.from({ length: frames }, (_, frame) => ({ row: fallbackRow, frame }));
}

const warnings = [];

async function auditPet(petDir) {
  const manifestPath = path.join(petDir, 'pet.json');
  if (!fs.existsSync(manifestPath)) {
    fail(`${rel(manifestPath)} is missing`);
    return false;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const asset = manifest.asset || {};
  const cellWidth = Number(asset.cellWidth || 192);
  const cellHeight = Number(asset.cellHeight || 208);
  const columns = Number(asset.columns || 8);
  const states = manifest.states || {};
  const spritesheetFile = manifest.spritesheetPath || asset.spritesheetPath || 'spritesheet.webp';
  const spritesheetPath = path.join(petDir, spritesheetFile);
  const stateEntries = Object.entries(states);
  const frameRefsByState = Object.fromEntries(
    stateEntries.map(([name, spec]) => [name, collectFrameRefs(spec)])
  );
  const maxStateRow = Object.values(frameRefsByState)
    .flat()
    .reduce((max, ref) => Math.max(max, Number(ref.row || 0)), 0);

  if (!cellWidth || !cellHeight || !columns) {
    fail('asset.cellWidth, asset.cellHeight, and asset.columns must be positive numbers');
    return false;
  }
  if (stateEntries.length === 0) {
    fail('pet.json must declare states for asset validation');
    return false;
  }

  if (!fs.existsSync(spritesheetPath)) {
    const message = `${rel(spritesheetPath)} is missing`;
    if (!strict && manifest.generation?.status === 'needs-spritesheet') {
      console.warn(`Asset audit pending: ${message}`);
      return true;
    }
    fail(message);
    return false;
  }

  const baseMeta = await metadata(spritesheetPath);
  if (!baseMeta) return false;
  const baseCols = Math.floor(baseMeta.width / cellWidth);
  const baseRows = Math.floor(baseMeta.height / cellHeight);

  if (baseMeta.width !== cellWidth * columns) {
    fail(`${rel(spritesheetPath)} width ${baseMeta.width} does not match ${columns} columns x ${cellWidth}`);
  }
  if (baseMeta.height % cellHeight !== 0) {
    fail(`${rel(spritesheetPath)} height ${baseMeta.height} is not divisible by cellHeight ${cellHeight}`);
  }
  if (baseRows <= maxStateRow) {
    fail(`${rel(spritesheetPath)} has ${baseRows} rows but states require row ${maxStateRow}`);
  }

  for (const [name, spec] of stateEntries) {
    const refs = frameRefsByState[name] || [];
    if (refs.length === 0) fail(`state ${name} has no drawable frames`);
    for (const ref of refs) {
      if (!Number.isInteger(ref.row) || ref.row < 0) fail(`state ${name} has invalid row ${ref.row}`);
      if (!Number.isInteger(ref.frame) || ref.frame < 0) fail(`state ${name} has invalid frame ${ref.frame}`);
      if (ref.row > maxStateRow) fail(`state ${name} references row ${ref.row} beyond max state row ${maxStateRow}`);
      if (ref.frame >= baseCols) fail(`state ${name} references frame ${ref.frame} but base has ${baseCols} columns`);
    }
  }

  const layerFiles = fs.readdirSync(petDir)
    .filter((file) => /^spritesheet_.+\.webp$/u.test(file))
    .filter((file) => !file.includes('before_'));

  const shortLayers = [];
  for (const file of layerFiles) {
    const filePath = path.join(petDir, file);
    const meta = await metadata(filePath);
    if (!meta) continue;
    if (meta.width !== cellWidth * columns) {
      fail(`${rel(filePath)} width ${meta.width} does not match ${columns} columns x ${cellWidth}`);
    }
    if (meta.height % cellHeight !== 0) {
      fail(`${rel(filePath)} height ${meta.height} is not divisible by cellHeight ${cellHeight}`);
      continue;
    }
    const rows = Math.floor(meta.height / cellHeight);
    if (rows <= maxStateRow) {
      shortLayers.push(`${file}:${rows}`);
    }
  }

  if (shortLayers.length > 0) {
    warn(`layer row coverage is partial for rows up to ${maxStateRow}: ${shortLayers.join(', ')}`);
  }

  console.log(`Pet asset audit OK: ${manifest.id || path.basename(petDir)} base ${baseMeta.width}x${baseMeta.height}, ${baseCols} columns, ${baseRows} rows, ${stateEntries.length} states, ${layerFiles.length} layer sheets`);
  for (const message of warnings) {
    console.warn(`Asset audit warning: ${message}`);
  }
  return true;
}

function findPetDirs(root) {
  if (fs.existsSync(path.join(root, 'pet.json'))) return [root];
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'pet.json')));
}

(async () => {
  const petDirs = findPetDirs(targetPath);
  if (petDirs.length === 0) {
    fail(`no pet.json found under ${rel(targetPath)}`);
    return;
  }
  for (const petDir of petDirs) {
    warnings.length = 0;
    await auditPet(petDir);
  }
})();
