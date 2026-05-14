const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PET_DIR = path.join(ROOT, 'assets', 'xiao-hong');
const SHEET = path.join(PET_DIR, 'spritesheet.webp');
const BACKUP = path.join(PET_DIR, 'spritesheet_before_typing_row.webp');
const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const SOURCE_ROW = 0;
const TYPING_ROW = 32;

function svg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">${body}</svg>`);
}

function typingSceneSvg(i) {
  const phase = (i / COLS) * Math.PI * 2;
  const cursor = i % 2 === 0 ? 0.95 : 0.28;
  const keyGlow = 0.42 + Math.sin(phase) * 0.18;
  const noteY = 51 + Math.sin(phase + 0.6) * 2;
  const screenLines = [
    `<rect x="41" y="57" width="${34 + (i % 3) * 5}" height="3" rx="1.5" fill="#b9f4ff" opacity=".86"/>`,
    `<rect x="41" y="65" width="${48 - (i % 4) * 3}" height="3" rx="1.5" fill="#ffcadf" opacity=".78"/>`,
    `<rect x="41" y="73" width="${26 + (i % 5) * 4}" height="3" rx="1.5" fill="#d8f8ff" opacity=".72"/>`,
    `<rect x="${72 + (i % 3) * 2}" y="73" width="2.5" height="8" rx="1.2" fill="#fff6aa" opacity="${cursor}"/>`,
  ].join('');
  return svg(`
    <ellipse cx="96" cy="190" rx="68" ry="10" fill="#d6e8f5" opacity=".42"/>
    <g transform="translate(${Math.sin(phase) * 1.2} 0)">
      <rect x="30" y="45" width="76" height="50" rx="8" fill="#6a7e9d" opacity=".95"/>
      <rect x="36" y="51" width="64" height="36" rx="5" fill="#243250"/>
      ${screenLines}
      <rect x="62" y="95" width="12" height="15" rx="3" fill="#7a8daa"/>
      <rect x="45" y="108" width="46" height="7" rx="3" fill="#8192ad"/>
    </g>
    <g fill="none" stroke-linecap="round" opacity=".78">
      <path d="M26 ${noteY} C18 ${noteY - 12} 29 ${noteY - 18} 20 ${noteY - 27}" stroke="#ff9ac4" stroke-width="2.4"/>
      <path d="M162 ${noteY + 16} C173 ${noteY + 5} 159 ${noteY - 5} 171 ${noteY - 14}" stroke="#8ce8ff" stroke-width="2.4"/>
    </g>
    <g fill="#fff5b4" opacity=".88">
      <path d="M151 69 l4 7 8 1 -6 5 2 8 -8 -4 -7 4 2 -8 -6 -5 8 -1z"/>
    </g>
  `);
}

function typingForegroundSvg(i) {
  const phase = (i / COLS) * Math.PI * 2;
  const keyGlow = 0.48 + Math.sin(phase) * 0.22;
  const keys = Array.from({ length: 18 }, (_, idx) => {
    const x = 45 + (idx % 9) * 11;
    const y = 142 + Math.floor(idx / 9) * 8;
    const active = idx === (i % 18) || idx === ((i + 5) % 18);
    return `<rect x="${x}" y="${y}" width="7" height="5" rx="1.5" fill="${active ? '#fff2a8' : '#e9fbff'}" opacity="${active ? 0.98 : 0.78}"/>`;
  }).join('');
  return svg(`
    <g opacity=".98">
      <path d="M31 135 C54 126 136 126 161 137 L149 171 C118 180 76 180 43 171 Z" fill="#b9ddf2"/>
      <path d="M43 137 C71 130 119 130 149 138" fill="none" stroke="#f8fdff" stroke-width="3" stroke-linecap="round" opacity=".76"/>
      <g opacity="${keyGlow}">
        ${keys}
      </g>
      <rect x="74" y="162" width="45" height="5" rx="2.5" fill="#dff8ff" opacity=".72"/>
    </g>
  `);
}

async function cellFrom(row, col) {
  return sharp(SHEET)
    .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
}

async function composeTypingRow() {
  const cells = [];
  for (let col = 0; col < COLS; col++) {
    const pet = await cellFrom(SOURCE_ROW, col % 6);
    const scene = typingSceneSvg(col);
    const foreground = typingForegroundSvg(col);
    const cell = await sharp({
      create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: scene, left: 0, top: 0 },
        { input: pet, left: 0, top: 0 },
        { input: foreground, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
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

  const baseRows = Math.min(rows, TYPING_ROW);
  const base = await sharp(SHEET)
    .extract({ left: 0, top: 0, width: CELL_W * COLS, height: CELL_H * baseRows })
    .png()
    .toBuffer();
  const typingRow = await composeTypingRow();

  await sharp({
    create: {
      width: CELL_W * COLS,
      height: CELL_H * (TYPING_ROW + 1),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: typingRow, left: 0, top: CELL_H * TYPING_ROW },
    ])
    .webp({ quality: 95 })
    .toFile(SHEET);

  console.log(`Generated typing companion row ${TYPING_ROW}; total rows: ${TYPING_ROW + 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
