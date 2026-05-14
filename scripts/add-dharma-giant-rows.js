const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PET_DIR = path.join(ROOT, 'assets', 'xiao-hong');
const SHEET = path.join(PET_DIR, 'spritesheet.webp');
const BACKUP = path.join(PET_DIR, 'spritesheet_before_dharma_rows.webp');
const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const TARGET_START_ROW = 33;

function svg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">${body}</svg>`);
}

async function cellFrom(row, col) {
  return sharp(SHEET)
    .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
}

function chargeOverlay(i) {
  const phase = (i / COLS) * Math.PI * 2;
  const pulse = 0.55 + Math.sin(phase) * 0.18;
  return svg(`
    <g opacity="${0.72 + pulse * 0.18}">
      <ellipse cx="96" cy="182" rx="${48 + pulse * 10}" ry="${10 + pulse * 2}" fill="#8ff2ff" opacity=".22"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="96" cy="94" r="${34 + pulse * 6}" stroke="#9bf6ff" stroke-width="2.2" opacity=".58"/>
        <circle cx="96" cy="94" r="${22 + pulse * 4}" stroke="#ffe38a" stroke-width="1.4" opacity=".48"/>
        <path d="M96 49 L104 83 L137 94 L104 105 L96 139 L88 105 L55 94 L88 83 Z" stroke="#fff4b4" stroke-width="1.2" opacity=".38"/>
        <path d="M66 ${65 + Math.sin(phase) * 4} C80 ${54 - Math.sin(phase) * 3} 112 ${54 + Math.sin(phase) * 3} 127 ${65 - Math.sin(phase) * 4}" stroke="#c7fbff" stroke-width="2" opacity=".52"/>
      </g>
      <g fill="#fff2a8" opacity=".82">
        <circle cx="${61 + Math.sin(phase) * 4}" cy="112" r="2.4"/>
        <circle cx="${132 - Math.sin(phase) * 4}" cy="116" r="2"/>
        <circle cx="96" cy="${42 + Math.cos(phase) * 3}" r="2.6"/>
      </g>
    </g>
  `);
}

function spiritOverlay(i) {
  const phase = (i / COLS) * Math.PI * 2;
  return svg(`
    <g opacity=".72">
      <ellipse cx="96" cy="182" rx="58" ry="12" fill="#72eaff" opacity=".20"/>
      <g opacity="${0.42 + Math.sin(phase) * 0.08}">
        <path d="M96 ${37 - Math.sin(phase) * 2} C126 50 137 78 130 109 C123 143 111 158 96 170 C80 158 68 143 62 109 C55 78 66 50 96 ${37 - Math.sin(phase) * 2} Z" fill="#aaf7ff"/>
        <path d="M96 49 C116 59 123 82 119 108 C114 133 106 147 96 156 C85 147 78 133 73 108 C69 82 76 59 96 49 Z" fill="#fff3b5" opacity=".32"/>
      </g>
      <g fill="none" stroke="#d8fbff" stroke-width="2" stroke-linecap="round" opacity=".64">
        <path d="M64 ${85 + Math.sin(phase) * 5} C78 ${74 - Math.sin(phase) * 4} 114 ${74 + Math.sin(phase) * 3} 128 ${85 - Math.sin(phase) * 5}"/>
        <path d="M73 132 C85 143 107 143 119 132"/>
      </g>
    </g>
  `);
}

function manifestOverlay(i) {
  const phase = (i / COLS) * Math.PI * 2;
  const rot = i * 45;
  return svg(`
    <g opacity=".86">
      <ellipse cx="96" cy="184" rx="68" ry="14" fill="#90f4ff" opacity=".22"/>
      <g transform="rotate(${rot} 96 101)" fill="none" stroke-linecap="round">
        <circle cx="96" cy="101" r="56" stroke="#8df4ff" stroke-width="2.5" opacity=".46"/>
        <circle cx="96" cy="101" r="42" stroke="#ffe08a" stroke-width="1.6" opacity=".38"/>
        <path d="M96 41 L106 88 L151 101 L106 114 L96 161 L86 114 L41 101 L86 88 Z" stroke="#e9fcff" stroke-width="1.4" opacity=".40"/>
      </g>
      <path d="M51 ${149 + Math.sin(phase) * 3} C70 134 119 134 141 ${149 - Math.sin(phase) * 3}" fill="none" stroke="#bdf9ff" stroke-width="4" stroke-linecap="round" opacity=".46"/>
      <g fill="#fff0a8" opacity=".82">
        <path d="M33 75 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z"/>
        <path d="M151 64 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z"/>
      </g>
    </g>
  `);
}

function stableOverlay(i) {
  const phase = (i / COLS) * Math.PI * 2;
  return svg(`
    <g opacity=".92">
      <ellipse cx="96" cy="185" rx="${70 + Math.sin(phase) * 2}" ry="15" fill="#7deaff" opacity=".20"/>
      <g fill="none" stroke-linecap="round" opacity=".62">
        <path d="M36 ${88 + Math.sin(phase) * 5} C53 ${60 - Math.sin(phase) * 4} 80 50 96 36 C112 50 139 ${60 + Math.sin(phase) * 4} 156 ${88 - Math.sin(phase) * 5}" stroke="#b4f7ff" stroke-width="2.6"/>
        <path d="M47 128 C66 144 126 144 145 128" stroke="#ffe79b" stroke-width="2"/>
      </g>
      <g transform="translate(96 94) rotate(${i * -22.5})" fill="none" stroke="#d7fcff" stroke-width="1.4" opacity=".40">
        <circle cx="0" cy="0" r="62"/>
        <circle cx="0" cy="0" r="48"/>
        ${Array.from({ length: 12 }, (_, idx) => {
          const a = idx * Math.PI / 6;
          return `<path d="M${Math.cos(a) * 44} ${Math.sin(a) * 44} L${Math.cos(a) * 66} ${Math.sin(a) * 66}"/>`;
        }).join('')}
      </g>
    </g>
  `);
}

async function composeRow(kind, sourceRow) {
  const overlayFns = {
    charge: chargeOverlay,
    spirit: spiritOverlay,
    manifest: manifestOverlay,
    stable: stableOverlay,
  };
  const cells = [];
  for (let col = 0; col < COLS; col++) {
    const pet = await cellFrom(sourceRow, col % COLS);
    const overlay = overlayFns[kind](col);
    const composites = kind === 'spirit'
      ? [{ input: overlay, left: 0, top: 0 }, { input: pet, left: 0, top: 0 }]
      : [{ input: pet, left: 0, top: 0 }, { input: overlay, left: 0, top: 0 }];
    const cell = await sharp({
      create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(composites).png().toBuffer();
    cells.push({ input: cell, left: col * CELL_W, top: 0 });
  }

  return sharp({
    create: { width: CELL_W * COLS, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(cells).png().toBuffer();
}

async function main() {
  const meta = await sharp(SHEET).metadata();
  const rows = Math.floor(meta.height / CELL_H);
  if (meta.width !== CELL_W * COLS || meta.height % CELL_H !== 0) {
    throw new Error(`Unexpected spritesheet size: ${meta.width}x${meta.height}`);
  }
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(SHEET, BACKUP);

  const baseRows = Math.min(rows, TARGET_START_ROW);
  const base = await sharp(SHEET)
    .extract({ left: 0, top: 0, width: CELL_W * COLS, height: CELL_H * baseRows })
    .png()
    .toBuffer();
  const rowsToAppend = [
    await composeRow('charge', 25),
    await composeRow('spirit', 31),
    await composeRow('manifest', 31),
    await composeRow('stable', 31),
  ];
  const composites = [{ input: base, left: 0, top: 0 }];
  rowsToAppend.forEach((row, index) => {
    composites.push({ input: row, left: 0, top: CELL_H * (TARGET_START_ROW + index) });
  });

  await sharp({
    create: {
      width: CELL_W * COLS,
      height: CELL_H * (TARGET_START_ROW + rowsToAppend.length),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites).webp({ quality: 95 }).toFile(SHEET);

  console.log(`Generated dharma rows ${TARGET_START_ROW}-${TARGET_START_ROW + rowsToAppend.length - 1}; total rows: ${TARGET_START_ROW + rowsToAppend.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
