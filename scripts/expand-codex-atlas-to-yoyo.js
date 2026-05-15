#!/usr/bin/env node
const path = require('path');
const sharp = require('sharp');

const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const TARGET_ROWS = 37;

const ROW_MAP = {
  0: 0,   // idle
  1: 1,   // runningRight
  2: 2,   // runningLeft
  3: 3,   // waving
  4: 4,   // jumping
  5: 5,   // failed
  6: 6,   // waiting
  7: 7,   // bashful -> running/working fallback
  8: 8,   // review
  9: 4,   // climbing -> jumping fallback
  10: 0,  // perching
  11: 3,  // petting -> waving fallback
  12: 6,  // yawning -> waiting fallback
  13: 0,  // eating
  14: 5,  // dizzy -> failed fallback
  15: 6,  // lookingAround -> waiting fallback
  16: 4,  // swing -> jumping fallback
  17: 8,  // digSand -> review fallback
  18: 8,  // readBook -> review fallback
  19: 8,  // watchTV -> review fallback
  20: 6,  // sleeping -> waiting fallback
  21: 4,  // dancing -> jumping fallback
  22: 5,  // crying -> failed fallback
  23: 3,  // gifting -> waving fallback
  24: 4,  // stretching -> jumping fallback
  25: 3,  // clapping -> waving fallback
  26: 6,  // fanCooling -> waiting fallback
  27: 4,  // swimming -> jumping fallback
  28: 5,  // whip -> failed fallback
  29: 6,  // airConditioning -> waiting fallback
  30: 6,  // sofaLying -> waiting fallback
  31: 0,  // reserved
  32: 8,  // typingCompanion -> review fallback
  33: 0,
  34: 0,
  35: 0,
  36: 0,
};

async function main() {
  const source = process.argv[2];
  const output = process.argv[3];
  if (!source || !output) {
    console.error('Usage: node scripts/expand-codex-atlas-to-yoyo.js <source-9-row-atlas> <output-37-row-webp>');
    process.exit(1);
  }

  const sourceMeta = await sharp(source).metadata();
  if (sourceMeta.width !== COLS * CELL_W || sourceMeta.height !== 9 * CELL_H) {
    throw new Error(`source atlas must be ${COLS * CELL_W}x${9 * CELL_H}; got ${sourceMeta.width}x${sourceMeta.height}`);
  }

  const composites = [];
  for (let targetRow = 0; targetRow < TARGET_ROWS; targetRow++) {
    const sourceRow = ROW_MAP[targetRow] ?? 0;
    for (let col = 0; col < COLS; col++) {
      composites.push({
        input: await sharp(source)
          .extract({ left: col * CELL_W, top: sourceRow * CELL_H, width: CELL_W, height: CELL_H })
          .png()
          .toBuffer(),
        left: col * CELL_W,
        top: targetRow * CELL_H,
      });
    }
  }

  await sharp({
    create: {
      width: COLS * CELL_W,
      height: TARGET_ROWS * CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 92, effort: 6 })
    .toFile(output);

  const outputMeta = await sharp(output).metadata();
  console.log(`Expanded ${path.basename(source)} -> ${path.basename(output)} ${outputMeta.width}x${outputMeta.height}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

