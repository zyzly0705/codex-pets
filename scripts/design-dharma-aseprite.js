const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PET_SHEET = path.join(ROOT, 'assets', 'yoyo', 'spritesheet.webp');
const ASEPRITE_BIN = path.join(
  process.env.HOME,
  'deps',
  'aseprite-build',
  'build',
  'bin',
  'aseprite.app',
  'Contents',
  'MacOS',
  'aseprite'
);

const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const SRC_ROOT = path.join(ROOT, 'assets-src', 'yoyo');
const ASE_DIR = path.join(SRC_ROOT, 'aseprite');
const FRAMES_DIR = path.join(SRC_ROOT, 'frames');
const DRAFT_DIR = path.join(SRC_ROOT, 'qa', 'dharma-design');

const ACTIONS = [
  { name: 'dharmaCharge', sourceRow: 31, sourceFrames: 6, palette: 'charge', petScale: 1 },
  { name: 'dharmaSpirit', sourceRow: 31, sourceFrames: 6, palette: 'spirit', petScale: 0.72 },
  { name: 'dharmaManifest', sourceRow: 31, sourceFrames: 6, palette: 'manifest', petScale: 0.66 },
  { name: 'dharmaStable', sourceRow: 0, sourceFrames: 6, palette: 'stable', petScale: 0.70 },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function svg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">
    <defs>
      <radialGradient id="cyanAura" cx="50%" cy="46%" r="58%">
        <stop offset="0%" stop-color="#fff8c6" stop-opacity=".44"/>
        <stop offset="38%" stop-color="#70eaff" stop-opacity=".32"/>
        <stop offset="100%" stop-color="#62c7ff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff9df" stop-opacity=".92"/>
        <stop offset="52%" stop-color="#ffd05e" stop-opacity=".62"/>
        <stop offset="100%" stop-color="#ff9f3f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c9fbff" stop-opacity=".58"/>
        <stop offset="48%" stop-color="#7fd6ff" stop-opacity=".32"/>
        <stop offset="100%" stop-color="#273a8c" stop-opacity=".10"/>
      </linearGradient>
      <linearGradient id="lotus" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff2a7" stop-opacity=".80"/>
        <stop offset="100%" stop-color="#6defff" stop-opacity=".24"/>
      </linearGradient>
    </defs>
    ${body}
  </svg>`);
}

async function cellFrom(row, col) {
  return sharp(PET_SHEET)
    .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
}

function ringPaths(cx, cy, r, phase, alpha = 1) {
  const tickCount = 16;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const a = phase + i * (Math.PI * 2 / tickCount);
    const inner = r * 0.78;
    const outer = r * (i % 2 ? 1.03 : 0.94);
    return `<path d="M${cx + Math.cos(a) * inner} ${cy + Math.sin(a) * inner} L${cx + Math.cos(a) * outer} ${cy + Math.sin(a) * outer}"/>`;
  }).join('');
  return `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}">
      <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#55dfff" stroke-width="2.4" opacity=".70"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.74}" stroke="#ffcf55" stroke-width="1.6" opacity=".60"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.52}" stroke="#f7fdff" stroke-width="1" opacity=".42"/>
      <g stroke="#7befff" stroke-width="1.25" opacity=".68">${ticks}</g>
    </g>
  `;
}

function lotus(cx, cy, scale, phase) {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = phase + i * (Math.PI * 2 / 10);
    const x = cx + Math.cos(a) * 34 * scale;
    const y = cy + Math.sin(a) * 8 * scale;
    const rot = a + Math.PI / 2;
    return `<g transform="translate(${x} ${y}) rotate(${rot * 180 / Math.PI}) scale(${scale})">
      <path d="M0 -13 C7 -4 7 8 0 15 C-7 8 -7 -4 0 -13 Z" fill="url(#lotus)" stroke="#fff2a8" stroke-width=".8" opacity=".72"/>
    </g>`;
  }).join('');
  return `<g>${petals}<ellipse cx="${cx}" cy="${cy + 4 * scale}" rx="${44 * scale}" ry="${9 * scale}" fill="#83f1ff" opacity=".16"/></g>`;
}

function spiritBody(cx, cy, scale, phase, alpha) {
  const breathe = Math.sin(phase) * 2;
  return `
    <g opacity="${alpha}" transform="translate(${cx} ${cy + breathe}) scale(${scale})">
      <path d="M0 -58 C28 -48 43 -21 35 15 C29 43 16 66 0 80 C-16 66 -29 43 -35 15 C-43 -21 -28 -48 0 -58 Z"
        fill="url(#robe)" stroke="#bff9ff" stroke-width="1.4"/>
      <circle cx="0" cy="-64" r="18" fill="#d9fbff" opacity=".34" stroke="#fff3a6" stroke-width="1.1"/>
      <path d="M-21 -20 C-40 -3 -48 23 -45 47" fill="none" stroke="#bff9ff" stroke-width="2.4" stroke-linecap="round" opacity=".60"/>
      <path d="M21 -20 C40 -3 48 23 45 47" fill="none" stroke="#bff9ff" stroke-width="2.4" stroke-linecap="round" opacity=".60"/>
      <path d="M-14 -66 Q0 -72 14 -66" fill="none" stroke="#fff0a3" stroke-width="1.1" stroke-linecap="round" opacity=".58"/>
      <path d="M-8 -61 Q0 -57 8 -61" fill="none" stroke="#fbffff" stroke-width=".9" stroke-linecap="round" opacity=".46"/>
    </g>
  `;
}

function talismans(cx, cy, phase, alpha) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = phase + i * Math.PI * 2 / 6;
    const x = cx + Math.cos(a) * 66;
    const y = cy + Math.sin(a) * 36;
    const rot = a * 180 / Math.PI + 90;
    return `<g transform="translate(${x} ${y}) rotate(${rot})" opacity="${alpha * (0.65 + (i % 2) * 0.2)}">
      <rect x="-4" y="-9" width="8" height="18" rx="1" fill="#fff2a8" opacity=".52" stroke="#8ff4ff" stroke-width=".7"/>
      <path d="M-2 -3 H2 M-1 2 H1 M0 5 V8" stroke="#6edfff" stroke-width=".8" stroke-linecap="round"/>
    </g>`;
  }).join('');
}

function dharmaOverlay(kind, frame) {
  const t = frame / COLS;
  const phase = t * Math.PI * 2;
  const pulse = 0.5 + Math.sin(phase) * 0.5;
  const cx = 96;
  const cy = 96;

  if (kind === 'charge') {
    const r = 34 + pulse * 8;
    return svg(`
      <ellipse cx="96" cy="184" rx="${44 + pulse * 7}" ry="${8 + pulse}" fill="#45dfff" opacity=".24"/>
      <circle cx="96" cy="98" r="${58 + pulse * 9}" fill="url(#cyanAura)" opacity=".98"/>
      ${ringPaths(cx, cy, r, phase * 0.35, 0.86)}
      <circle cx="96" cy="${82 - pulse * 8}" r="${8 + pulse * 3}" fill="url(#goldCore)" opacity=".88"/>
      ${lotus(96, 168, 0.64 + pulse * 0.06, -phase * 0.20)}
      <g stroke="#fff6be" stroke-width="1.4" stroke-linecap="round" opacity=".65">
        <path d="M69 ${74 + pulse * 3} C80 ${60 - pulse * 5} 113 ${60 + pulse * 4} 124 ${74 - pulse * 3}"/>
        <path d="M62 ${126 - pulse * 4} C80 ${141 + pulse * 2} 113 ${141 - pulse * 2} 131 ${126 + pulse * 4}"/>
      </g>
    `);
  }

  if (kind === 'spirit') {
    return svg(`
      <circle cx="96" cy="88" r="${68 + pulse * 4}" fill="url(#cyanAura)" opacity=".94"/>
      ${spiritBody(96, 92, 1.05 + pulse * 0.03, phase, 0.72)}
      ${ringPaths(96, 89, 57, -phase * 0.22, 0.58)}
      ${lotus(96, 172, 0.72, phase * 0.16)}
      <circle cx="96" cy="${61 - pulse * 4}" r="${5 + pulse * 1.8}" fill="url(#goldCore)" opacity=".92"/>
    `);
  }

  if (kind === 'manifest') {
    const fan = Array.from({ length: 7 }, (_, i) => {
      const dx = (i - 3) * 14;
      const h = 64 + Math.sin(phase + i) * 8;
      return `<path d="M96 104 C${96 + dx * 0.7} ${96 - h * 0.42} ${96 + dx} ${96 - h} ${96 + dx * 1.35} ${64 + Math.cos(phase + i) * 4}"
        fill="none" stroke="${i % 2 ? '#fff0a3' : '#91f5ff'}" stroke-width="2.2" stroke-linecap="round" opacity=".34"/>`;
    }).join('');
    return svg(`
      <circle cx="96" cy="99" r="${75 + pulse * 5}" fill="url(#cyanAura)" opacity="1"/>
      ${fan}
      ${ringPaths(96, 96, 66, phase * 0.42, 0.76)}
      ${spiritBody(96, 94, 1.18 + pulse * 0.04, phase, 0.84)}
      ${talismans(96, 98, -phase * 0.30, 0.82)}
      ${lotus(96, 174, 0.82 + pulse * 0.04, phase * 0.2)}
      <circle cx="96" cy="80" r="${9 + pulse * 2}" fill="url(#goldCore)" opacity=".92"/>
    `);
  }

  return svg(`
    <circle cx="96" cy="99" r="${72 + Math.sin(phase) * 2}" fill="url(#cyanAura)" opacity=".92"/>
    ${ringPaths(96, 95, 61, phase * 0.15, 0.68)}
    ${spiritBody(96, 96, 1.06 + Math.sin(phase) * 0.015, phase, 0.72)}
    ${talismans(96, 98, phase * 0.12, 0.44)}
    ${lotus(96, 174, 0.78, phase * 0.08)}
    <path d="M58 ${137 + Math.sin(phase) * 2} C75 ${151 - pulse * 3} 118 ${151 + pulse * 3} 135 ${137 - Math.sin(phase) * 2}"
      fill="none" stroke="#fff0a3" stroke-width="2" stroke-linecap="round" opacity=".46"/>
  `);
}

async function composeFrame(action, col) {
  const pet = await cellFrom(action.sourceRow, col % action.sourceFrames);
  const petInput = action.petScale === 1
    ? pet
    : await sharp(pet)
      .resize({
        width: Math.round(CELL_W * action.petScale),
        height: Math.round(CELL_H * action.petScale),
        fit: 'contain',
        kernel: sharp.kernel.nearest,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  const petMeta = await sharp(petInput).metadata();
  const petLeft = Math.round((CELL_W - petMeta.width) / 2);
  const petTop = action.petScale === 1
    ? 0
    : Math.round(CELL_H - petMeta.height - 5);
  const overlay = dharmaOverlay(action.palette, col);
  const under = await sharp({
    create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: petInput, left: petLeft, top: petTop },
    ])
    .png()
    .toBuffer();

  return sharp(under)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeAction(action) {
  const frameDir = path.join(FRAMES_DIR, action.name);
  ensureDir(frameDir);
  ensureDir(ASE_DIR);
  ensureDir(DRAFT_DIR);

  const composites = [];
  for (let col = 0; col < COLS; col += 1) {
    const frame = await composeFrame(action, col);
    const framePath = path.join(frameDir, `${String(col).padStart(2, '0')}.png`);
    fs.writeFileSync(framePath, frame);
    composites.push({ input: frame, left: col * CELL_W, top: 0 });
  }

  const sheetPath = path.join(DRAFT_DIR, `${action.name}.png`);
  await sharp({
    create: { width: CELL_W * COLS, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);

  if (fs.existsSync(ASEPRITE_BIN)) {
    execFileSync(ASEPRITE_BIN, ['--batch', sheetPath, '--save-as', path.join(ASE_DIR, `${action.name}.aseprite`)], {
      stdio: 'inherit',
    });
  }
}

async function main() {
  for (const action of ACTIONS) {
    await writeAction(action);
    console.log(`Designed ${action.name}`);
  }
  console.log(`Aseprite sources: ${path.relative(ROOT, ASE_DIR)}`);
  console.log(`Editable design sheets: ${path.relative(ROOT, DRAFT_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
