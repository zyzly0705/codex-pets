const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PET_DIR = path.join(ROOT, 'assets', 'yoyo');
const SHEET = path.join(PET_DIR, 'spritesheet.webp');
const BACKUP = path.join(PET_DIR, 'spritesheet_pre_goal_backup.webp');
const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const BASE_ROWS = 26;
const SOURCE_FRAME_COUNTS = new Map([
  [6, 6],
  [8, 6],
  [9, 6],
  [22, 8],
]);

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
}

function windLines(phase, strong = false) {
  const offset = Math.sin(phase) * 4;
  const alpha = strong ? 0.72 : 0.56;
  return `
    <g fill="none" stroke="#8fd5ff" stroke-width="${strong ? 3.2 : 2.2}" stroke-linecap="round" opacity="${alpha}">
      <path d="M158 ${72 + offset} C133 ${63 - offset} 117 ${68 + offset} 95 ${60 - offset}"/>
      <path d="M160 ${97 - offset} C137 ${90 + offset} 115 ${98 - offset} 91 ${90 + offset}"/>
      <path d="M154 ${122 + offset} C132 ${113 - offset} 112 ${121 + offset} 88 ${113 - offset}"/>
    </g>`;
}

function fanSvg(i) {
  const phase = i * Math.PI / 4;
  return svg(CELL_W, CELL_H, `
    <ellipse cx="96" cy="188" rx="66" ry="10" fill="#d8eefc" opacity=".42"/>
    <g transform="translate(150 133)">
      <rect x="-5" y="22" width="10" height="34" rx="4" fill="#8aa3b4"/>
      <ellipse cx="0" cy="60" rx="22" ry="7" fill="#8297a7"/>
      <circle cx="0" cy="0" r="32" fill="#e7f7ff" stroke="#80b8d6" stroke-width="3"/>
      <circle cx="0" cy="0" r="24" fill="none" stroke="#bfe9ff" stroke-width="2"/>
      <g transform="rotate(${i * 45})" opacity=".86">
        <ellipse cx="0" cy="-14" rx="6" ry="17" fill="#77cdf4"/>
        <ellipse cx="14" cy="4" rx="17" ry="6" fill="#77cdf4"/>
        <ellipse cx="-13" cy="6" rx="17" ry="6" fill="#77cdf4"/>
      </g>
      <circle cx="0" cy="0" r="6" fill="#5aaed3"/>
    </g>
    ${windLines(phase, true)}
    <g fill="#dff7ff" opacity=".86">
      <path d="M42 55 l5 9 10 2 -8 6 2 10 -9 -5 -9 5 2 -10 -8 -6 10 -2z"/>
      <circle cx="59" cy="114" r="3"/>
    </g>`);
}

function airConditioningSvg(i) {
  const phase = i * Math.PI / 4;
  return svg(CELL_W, CELL_H, `
    <ellipse cx="96" cy="189" rx="54" ry="8" fill="#d9efff" opacity=".46"/>
    <g fill="none" stroke="#8bd8ff" stroke-width="2.2" stroke-linecap="round" opacity=".58">
      <path d="M47 20 C38 ${47 + Math.sin(phase) * 5} 50 ${74 - Math.sin(phase) * 4} 43 104"/>
      <path d="M83 17 C75 ${48 - Math.sin(phase) * 4} 88 ${78 + Math.sin(phase) * 4} 82 116"/>
      <path d="M121 19 C113 ${50 + Math.sin(phase) * 5} 128 ${82 - Math.sin(phase) * 4} 119 112"/>
    </g>
    <g stroke="#b9ecff" stroke-width="2" stroke-linecap="round" opacity=".8">
      <path d="M32 69 l10 10 M42 69 l-10 10 M37 65 v18 M28 74 h18"/>
      <path d="M147 98 l8 8 M155 98 l-8 8 M151 95 v14 M144 102 h14"/>
    </g>
    <g fill="#eefbff" opacity=".58">
      <circle cx="54" cy="134" r="2.4"/>
      <circle cx="137" cy="128" r="2.8"/>
    </g>`);
}

function sofaBackdropSvg(i) {
  const bob = Math.sin(i * Math.PI / 4) * 1.5;
  return svg(CELL_W, CELL_H, `
    <ellipse cx="96" cy="189" rx="73" ry="12" fill="#a78c9f" opacity=".34"/>
    <rect x="26" y="${104 + bob}" width="140" height="60" rx="21" fill="#e99eba"/>
    <rect x="37" y="${95 + bob}" width="58" height="34" rx="13" fill="#f5bfd2"/>
    <rect x="91" y="${95 + bob}" width="64" height="34" rx="13" fill="#f2b4cb"/>
    <rect x="18" y="${123 + bob}" width="31" height="49" rx="14" fill="#d986aa"/>
    <rect x="142" y="${123 + bob}" width="31" height="49" rx="14" fill="#d986aa"/>
    <rect x="42" y="${135 + bob}" width="108" height="34" rx="14" fill="#f7c8d8"/>
    <ellipse cx="55" cy="${111 + bob}" rx="22" ry="12" fill="#fff0f5" opacity=".9"/>
  `);
}

function sofaForegroundSvg(i) {
  const bob = Math.sin(i * Math.PI / 4) * 1.5;
  return svg(CELL_W, CELL_H, `
    <path d="M57 ${134 + bob} C78 ${126 + bob} 114 ${128 + bob} 139 ${139 + bob} L132 ${163 + bob} C108 ${171 + bob} 77 ${170 + bob} 53 ${161 + bob} Z" fill="#97d8ff" opacity=".94"/>
    <path d="M63 ${137 + bob} C86 ${131 + bob} 109 ${132 + bob} 132 ${141 + bob}" fill="none" stroke="#d9f3ff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    <rect x="42" y="${156 + bob}" width="108" height="19" rx="9" fill="#efb7cd"/>
    <rect x="20" y="${132 + bob}" width="25" height="39" rx="12" fill="#dc8caf" opacity=".95"/>
    <rect x="147" y="${132 + bob}" width="25" height="39" rx="12" fill="#dc8caf" opacity=".95"/>
  `);
}

function swimmingSvg(i) {
  const phase = i * Math.PI / 4;
  return svg(CELL_W, CELL_H, `
    <rect x="0" y="128" width="192" height="80" fill="#86d8ff" opacity=".72"/>
    <path d="M0 ${142 + Math.sin(phase) * 4} C24 ${131 - Math.sin(phase) * 4} 46 ${154 + Math.sin(phase) * 3} 72 ${142 - Math.sin(phase) * 3} S121 ${132 + Math.sin(phase) * 5} 148 ${142 - Math.sin(phase) * 4} S178 ${154 + Math.sin(phase) * 4} 192 ${143}" fill="none" stroke="#e3fbff" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="98" cy="${145 + Math.sin(phase) * 3}" rx="57" ry="18" fill="none" stroke="#ffb4c6" stroke-width="13" opacity=".9"/>
    <ellipse cx="98" cy="${145 + Math.sin(phase) * 3}" rx="36" ry="10" fill="none" stroke="#fff1f5" stroke-width="5" opacity=".8"/>
    <g fill="#f5feff" opacity=".95">
      <circle cx="${31 + Math.sin(phase) * 5}" cy="118" r="4"/>
      <circle cx="${166 - Math.sin(phase) * 5}" cy="125" r="5"/>
      <circle cx="44" cy="139" r="2.6"/>
    </g>`);
}

function whipSvg(i) {
  const side = i % 2 === 0 ? 1 : -1;
  const x0 = side > 0 ? 155 : 37;
  const x1 = side > 0 ? 125 : 67;
  const x2 = side > 0 ? 93 : 99;
  return svg(CELL_W, CELL_H, `
    <ellipse cx="96" cy="188" rx="48" ry="8" fill="#f4c1ca" opacity=".3"/>
    <path d="M${x0} 66 C${x1} ${43 + (i % 3) * 6} ${x2} ${86 - (i % 4) * 4} 91 118" fill="none" stroke="#5d321d" stroke-width="4" stroke-linecap="round"/>
    <path d="M${x0 - side * 2} 64 C${x1 - side * 2} ${42 + (i % 3) * 6} ${x2 - side * 2} ${84 - (i % 4) * 4} 89 116" fill="none" stroke="#c08c57" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="${side > 0 ? 153 : 24}" y="59" width="21" height="8" rx="4" fill="#3b2417" stroke="#8f5f37" stroke-width="1"/>
    <g stroke="#ff6f7f" stroke-width="2.2" stroke-linecap="round" opacity=".9">
      <path d="M82 120 l18 16"/>
      <path d="M99 119 l-15 18"/>
    </g>
    <g fill="#70cfff" opacity=".9">
      <ellipse cx="69" cy="80" rx="3" ry="7"/>
      <ellipse cx="124" cy="82" rx="3" ry="7"/>
    </g>`);
}

async function cellFrom(row, col) {
  return sharp(SHEET)
    .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
}

async function composeRow(kind, petRow) {
  const cells = [];
  for (let col = 0; col < COLS; col++) {
    const frameCol = col % (SOURCE_FRAME_COUNTS.get(petRow) || COLS);
    const pet = await cellFrom(petRow, frameCol);
    const overlay = {
      fanCooling: fanSvg(col),
      airConditioning: airConditioningSvg(col),
      sofaLying: sofaBackdropSvg(col),
      swimming: swimmingSvg(col),
      whip: whipSvg(col),
    }[kind];
    let composites;
    if (kind === 'sofaLying') {
      composites = [
        { input: overlay, left: 0, top: 0 },
        { input: pet, left: 0, top: 6 },
        { input: sofaForegroundSvg(col), left: 0, top: 0 },
      ];
    } else if (kind === 'swimming') {
      composites = [{ input: overlay, left: 0, top: 0 }, { input: pet, left: 0, top: 0 }];
    } else {
      composites = [{ input: pet, left: 0, top: 0 }, { input: overlay, left: 0, top: 0 }];
    }
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
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(SHEET, BACKUP);
  const base = await sharp(SHEET)
    .extract({ left: 0, top: 0, width: CELL_W * COLS, height: CELL_H * BASE_ROWS })
    .png()
    .toBuffer();
  const rows = [
    await composeRow('fanCooling', 6),
    await composeRow('swimming', 9),
    await composeRow('whip', 22),
    await composeRow('airConditioning', 8),
    await composeRow('sofaLying', 9),
  ];
  const composites = [{ input: base, left: 0, top: 0 }];
  rows.forEach((row, index) => composites.push({ input: row, left: 0, top: (BASE_ROWS + index) * CELL_H }));
  await sharp({
    create: {
      width: CELL_W * COLS,
      height: CELL_H * (BASE_ROWS + rows.length),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites).webp({ quality: 95 }).toFile(SHEET);
  console.log(`Generated ${SHEET} with ${BASE_ROWS + rows.length} rows`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
