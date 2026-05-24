#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CELL_W = 192;
const CELL_H = 208;
const DEFAULT_ACTIONS = ['swimming', 'swing', 'sofaLying'];
const args = process.argv.slice(2);
const actionsArg = args.find((arg) => arg.startsWith('--actions='));
const actions = actionsArg
  ? actionsArg.slice('--actions='.length).split(',').map((item) => item.trim()).filter(Boolean)
  : DEFAULT_ACTIONS;

const framesRoot = path.join(ROOT, 'assets-src', 'yoyo', 'frames');
const anchorsRoot = path.join(ROOT, 'assets-src', 'yoyo', 'anchors');
const outputDir = path.join(ROOT, 'assets-src', 'yoyo', 'qa', 'animation-previews');
const manifestPath = path.join(ROOT, 'assets-src', 'yoyo', 'manifest.json');
const petPath = path.join(ROOT, 'assets', 'yoyo', 'pet.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pet = JSON.parse(fs.readFileSync(petPath, 'utf8'));
const rowNames = new Map((manifest.rows || []).map((row) => [Number(row.row), row.name]));
const rowMetaByIndex = new Map((manifest.rows || []).map((row) => [Number(row.row), row]));
const rowMetaByName = new Map((manifest.rows || []).map((row) => [row.name, row]));

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hasFfmpeg() {
  const result = spawnSync('zsh', ['-lc', 'command -v ffmpeg || true'], { encoding: 'utf8' });
  return result.stdout.trim();
}

function directFrameRefs(action) {
  const dir = path.join(framesRoot, action);
  if (!fs.existsSync(dir)) throw new Error(`Missing frame directory: ${rel(dir)}`);
  return fs.readdirSync(dir)
    .filter((file) => /^\d+\.png$/.test(file))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((file) => ({
      file: path.join(dir, file),
      label: file,
      anchorAction: action,
      anchorFrame: file,
      sourceType: rowMetaByName.get(action)?.type || 'action',
    }));
}

function frameFileFor(rowName, frameIndex) {
  const frameName = `${String(frameIndex).padStart(2, '0')}.png`;
  const file = path.join(framesRoot, rowName, frameName);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing frame file: ${rel(file)}`);
  }
  return file;
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

function stateFrameRefs(action) {
  const spec = pet.states?.[action];
  if (!spec) return null;

  const fallbackRow = Number(spec.row ?? 0);
  const refs = [];
  const pushRef = (row, frame, labelIndex) => {
    const rowMeta = rowMetaByIndex.get(row);
    const rowName = rowMeta?.name || rowNames.get(row);
    if (!rowName) throw new Error(`State ${action} references unknown row ${row}`);
    refs.push({
      file: frameFileFor(rowName, frame),
      label: `${String(labelIndex).padStart(2, '0')}.png`,
      sourceRow: row,
      sourceAction: rowName,
      sourceFrame: `${String(frame).padStart(2, '0')}.png`,
      sourceType: rowMeta?.type || 'action',
      anchorAction: fs.existsSync(path.join(anchorsRoot, `${action}.json`)) ? action : rowName,
      anchorFrame: `${String(labelIndex).padStart(2, '0')}.png`,
    });
  };

  if (Array.isArray(spec.clips)) {
    let labelIndex = 0;
    for (const clip of spec.clips) {
      const row = Number(clip.row ?? fallbackRow);
      const start = Number(clip.start ?? clip.frameStart ?? 0);
      const frames = Number(clip.frames ?? spec.frames ?? 0);
      for (let i = 0; i < frames; i += 1) {
        pushRef(row, start + i, labelIndex);
        labelIndex += 1;
      }
    }
    return refs;
  }

  const sequence = Array.isArray(spec.sequence) ? spec.sequence : spec.frameSequence;
  if (Array.isArray(sequence)) {
    sequence.forEach((item, index) => {
      const ref = normalizeFrameRef(item, fallbackRow);
      pushRef(ref.row, ref.frame, index);
    });
    return refs;
  }

  const frames = Number(spec.frames ?? 0);
  for (let frame = 0; frame < frames; frame += 1) {
    pushRef(fallbackRow, frame, frame);
  }
  return refs;
}

function frameRefs(action) {
  return stateFrameRefs(action) || directFrameRefs(action);
}

function readAnchors(action) {
  const file = path.join(anchorsRoot, `${action}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function anchorWarnings(action, frameAnchor) {
  if (!frameAnchor) return ['missing anchor data'];
  const warnings = [];
  const character = frameAnchor.character?.anchors || {};
  const scene = frameAnchor.scene || {};

  if (action === 'swing') {
    if (!scene.seatTop || !scene.seatBounds || !character.hips) {
      warnings.push(`${frameAnchor.frame}: missing swing seat/hips anchors`);
    } else {
      const seatDistance = dist(character.hips, scene.seatTop);
      if (seatDistance > 24) {
        warnings.push(`${frameAnchor.frame}: hips are ${seatDistance.toFixed(1)}px from swing seat`);
      }
      if (Math.abs(character.hips.y - scene.seatTop.y) > 18) {
        warnings.push(`${frameAnchor.frame}: hips y=${character.hips.y.toFixed(1)} is not seated on seatTop y=${scene.seatTop.y.toFixed(1)}`);
      }
      if (character.feet && character.feet.y < scene.seatTop.y) {
        warnings.push(`${frameAnchor.frame}: feet are above the swing seat`);
      }
    }
  }

  if (action === 'swimming') {
    if (!scene.waterline || !character.face || !character.feet || !character.hips) {
      warnings.push(`${frameAnchor.frame}: missing swimming waterline/body anchors`);
    } else {
      if (character.face.y >= scene.waterline.y - 4) {
        warnings.push(`${frameAnchor.frame}: face y=${character.face.y.toFixed(1)} is too close to/under waterline y=${scene.waterline.y.toFixed(1)}`);
      }
      if (character.feet.y <= scene.waterline.y + 18) {
        warnings.push(`${frameAnchor.frame}: feet y=${character.feet.y.toFixed(1)} are not clearly inside water below line y=${scene.waterline.y.toFixed(1)}`);
      }
      if (character.hips.y <= scene.waterline.y - 2) {
        warnings.push(`${frameAnchor.frame}: hips y=${character.hips.y.toFixed(1)} should sit in/behind waterline y=${scene.waterline.y.toFixed(1)}`);
      }
    }
  }

  if (action === 'sofaLying') {
    if (!scene.bodyRestBounds || !scene.cushionBounds || !character.bodyCenter || !character.hips) {
      warnings.push(`${frameAnchor.frame}: missing sofa body/cushion anchors`);
    } else {
      if (!inRect(character.bodyCenter, scene.bodyRestBounds)) {
        warnings.push(`${frameAnchor.frame}: bodyCenter (${character.bodyCenter.x.toFixed(1)}, ${character.bodyCenter.y.toFixed(1)}) is outside sofa rest bounds`);
      }
      if (!inRect(character.hips, scene.bodyRestBounds)) {
        warnings.push(`${frameAnchor.frame}: hips (${character.hips.x.toFixed(1)}, ${character.hips.y.toFixed(1)}) are not on sofa`);
      }
      if (character.hips.y < scene.cushionBounds.y - 10) {
        warnings.push(`${frameAnchor.frame}: hips y=${character.hips.y.toFixed(1)} float above cushion y=${scene.cushionBounds.y.toFixed(1)}`);
      }
      if (character.feet && character.feet.y > scene.bodyRestBounds.y + scene.bodyRestBounds.height + 28) {
        warnings.push(`${frameAnchor.frame}: feet are hanging too far below sofa`);
      }
    }
  }

  return warnings;
}

async function alphaBox(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, alphaPixels: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    alphaPixels: count,
  };
}

async function makeContactSheet(action, refs) {
  const labelH = 24;
  const composites = [];
  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i];
    const label = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${labelH}" viewBox="0 0 ${CELL_W} ${labelH}">
        <rect width="${CELL_W}" height="${labelH}" fill="#f7f7fb"/>
        <text x="8" y="16" font-family="Arial, sans-serif" font-size="12" fill="#222">${action} ${ref.label.replace('.png', '')}</text>
      </svg>
    `);
    composites.push({ input: ref.file, left: i * CELL_W, top: 0 });
    composites.push({ input: label, left: i * CELL_W, top: CELL_H });
  }

  const out = path.join(outputDir, `${action}-contact.png`);
  await sharp({
    create: {
      width: CELL_W * refs.length,
      height: CELL_H + labelH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(out);
  return out;
}

function makeGif(action, refs, ffmpeg) {
  if (!ffmpeg) return null;
  const tempList = path.join(outputDir, `${action}.ffconcat`);
  const out = path.join(outputDir, `${action}.gif`);
  const delaySeconds = 0.16;
  const lines = ['ffconcat version 1.0'];
  for (const ref of refs) {
    lines.push(`file '${ref.file.replaceAll("'", "'\\''")}'`);
    lines.push(`duration ${delaySeconds}`);
  }
  lines.push(`file '${refs[refs.length - 1].file.replaceAll("'", "'\\''")}'`);
  fs.writeFileSync(tempList, `${lines.join('\n')}\n`);

  const result = spawnSync(ffmpeg, [
    '-y',
    '-safe', '0',
    '-f', 'concat',
    '-i', tempList,
    '-vf', 'scale=384:416:flags=neighbor,split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=dither=none',
    '-loop', '0',
    out,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${action}:\n${result.stderr || result.stdout}`);
  }
  return out;
}

async function main() {
  ensureDir(outputDir);
  const ffmpeg = hasFfmpeg();
  const review = {
    generatedAt: new Date().toISOString(),
    actions: [],
  };

  for (const action of actions) {
    const refs = frameRefs(action);
    const anchorCache = new Map();
    for (const ref of refs) {
      if (!anchorCache.has(ref.anchorAction)) {
        const anchorData = readAnchors(ref.anchorAction);
        anchorCache.set(
          ref.anchorAction,
          new Map((anchorData?.frames || []).map((frame) => [frame.frame, frame]))
        );
      }
    }
    const boxes = [];
    for (const ref of refs) {
      boxes.push({
        frame: ref.label,
        source: rel(ref.file),
        ...(await alphaBox(ref.file)),
      });
    }

    const warnings = [];
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      const ref = refs[i];
      if (box.width < 70 || box.height < 90) warnings.push(`${box.frame}: silhouette is very small`);
      const fullScene = /^full-scene/.test(ref.sourceType || '');
      if (!fullScene && (box.minX <= 2 || box.maxX >= CELL_W - 3 || box.minY <= 2 || box.maxY >= CELL_H - 3)) {
        warnings.push(`${box.frame}: silhouette touches cell edge`);
      }
      warnings.push(...anchorWarnings(action, anchorCache.get(ref.anchorAction)?.get(ref.anchorFrame)));
    }

    const contactSheet = await makeContactSheet(action, refs);
    const gif = makeGif(action, refs, ffmpeg);
    review.actions.push({
      action,
      frameCount: refs.length,
      contactSheet: rel(contactSheet),
      gif: gif ? rel(gif) : null,
      boxes,
      anchors: [...new Set(refs.map((ref) => ref.anchorAction))]
        .filter((anchorAction) => fs.existsSync(path.join(anchorsRoot, `${anchorAction}.json`)))
        .map((anchorAction) => rel(path.join(anchorsRoot, `${anchorAction}.json`))),
      warnings,
    });
    console.log(`QA preview ${action}: ${rel(contactSheet)}${gif ? `, ${rel(gif)}` : ''}`);
  }

  const reviewPath = path.join(outputDir, 'review.json');
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  console.log(`QA review: ${rel(reviewPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
