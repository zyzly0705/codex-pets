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
const DANCE_FRAMES = 24;
const SRC_ROOT = path.join(ROOT, 'assets-src', 'yoyo');
const EFFECT_SRC_DIR = path.join(SRC_ROOT, 'effects');
const DANCE_SRC_DIR = path.join(EFFECT_SRC_DIR, 'dance-let-go');
const DANCE_FRAME_DIR = path.join(DANCE_SRC_DIR, 'frames');
const DANCE_QA_DIR = path.join(SRC_ROOT, 'qa', 'performance-design');
const DANCE_ASP = path.join(SRC_ROOT, 'aseprite', 'dance-let-go.aseprite');
const DANCE_RUNTIME_DIR = path.join(ROOT, 'assets', 'yoyo', 'effects', 'dance-let-go');
const DANCE_RUNTIME_SHEET = path.join(DANCE_RUNTIME_DIR, 'sheet.webp');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function svg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">
    <defs>
      <radialGradient id="spot" cx="50%" cy="38%" r="60%">
        <stop offset="0%" stop-color="#fff2a8" stop-opacity=".34"/>
        <stop offset="56%" stop-color="#ff75bb" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#5bd8ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5bd8ff" stop-opacity=".18"/>
        <stop offset="45%" stop-color="#ff75bb" stop-opacity=".28"/>
        <stop offset="100%" stop-color="#ffd166" stop-opacity=".18"/>
      </linearGradient>
    </defs>
    ${body}
  </svg>`);
}

async function petCell(row, col) {
  return sharp(PET_SHEET)
    .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
}

function star(x, y, r, fill, alpha) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    points.push(`${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`);
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}" opacity="${alpha}"/>`;
}

function note(x, y, text, fill, alpha, size = 13) {
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" fill="${fill}" opacity="${alpha}" text-anchor="middle">${text}</text>`;
}

function danceBackdrop(i) {
  const t = i / DANCE_FRAMES;
  const beat = Math.sin(t * Math.PI * 8);
  const pulse = 1 + beat * 0.07;
  const notes = ['♪', '♫', '✦', '♡'];
  const colors = ['#ff5fa2', '#5bd8ff', '#ffd166', '#b06cff'];
  const lightBits = Array.from({ length: 7 }, (_, idx) => {
    const phase = t * Math.PI * 2 + idx * 0.9;
    const x = 96 + Math.sin(phase * 1.2) * (34 + idx * 3);
    const y = 58 + Math.cos(phase * 0.8) * 15 + (idx % 3) * 14;
    return idx % 2
      ? note(x, y, notes[idx % notes.length], colors[idx % colors.length], 0.28 + Math.max(0, beat) * 0.16, 10 + idx % 3)
      : star(x, y, 3 + (idx % 3), colors[idx % colors.length], 0.32 + Math.max(0, -beat) * 0.16);
  }).join('');
  return svg(`
    <ellipse cx="96" cy="102" rx="${74 * pulse}" ry="${88 * pulse}" fill="url(#spot)" opacity=".78"/>
    <ellipse cx="96" cy="188" rx="${42 * pulse}" ry="${9 * pulse}" fill="url(#floor)" stroke="#ffffff" stroke-width=".8" opacity=".78"/>
    <path d="M57 ${184 + beat * 2} C72 ${178 - beat * 2} 120 ${178 + beat * 2} 136 ${184 - beat * 2}" fill="none" stroke="#fff3a8" stroke-width="1.6" stroke-linecap="round" opacity=".42"/>
    ${lightBits}
  `);
}

const DANCE_POSES = [
  { row: 21, col: 0, x: 0, y: -1, rot: 0.00, sx: 1.00, sy: 1.00 },
  { row: 21, col: 1, x: -8, y: -7, rot: -0.16, sx: 1.06, sy: 0.96 },
  { row: 4, col: 1, x: -13, y: -13, rot: -0.24, sx: 0.96, sy: 1.08 },
  { row: 21, col: 2, x: -5, y: -7, rot: -0.07, sx: 1.08, sy: 0.95 },
  { row: 4, col: 2, x: 0, y: -18, rot: 0.02, sx: 0.94, sy: 1.10 },
  { row: 21, col: 3, x: 9, y: -7, rot: 0.13, sx: 1.07, sy: 0.96 },
  { row: 4, col: 3, x: 15, y: -14, rot: 0.24, sx: 0.96, sy: 1.08 },
  { row: 21, col: 4, x: 6, y: -6, rot: 0.08, sx: 1.08, sy: 0.95 },
  { row: 3, col: 1, x: -9, y: -12, rot: -0.12, sx: 1.04, sy: 1.00 },
  { row: 25, col: 1, x: 0, y: -8, rot: 0.00, sx: 1.06, sy: 0.98 },
  { row: 3, col: 2, x: 10, y: -12, rot: 0.12, sx: 1.04, sy: 1.00 },
  { row: 21, col: 0, x: 0, y: -3, rot: 0.00, sx: 1.00, sy: 1.00 },
];

async function transformPet(pose) {
  const src = await petCell(pose.row, pose.col);
  const scaledW = Math.round(CELL_W * pose.sx);
  const scaledH = Math.round(CELL_H * pose.sy);
  const transformed = await sharp(src)
    .resize({
      width: scaledW,
      height: scaledH,
      fit: 'fill',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 30,
      bottom: 30,
      left: 34,
      right: 34,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate(pose.rot * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(CELL_W, CELL_H, { fit: 'fill', kernel: sharp.kernel.nearest, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp(transformed)
    .resize(CELL_W, CELL_H, { fit: 'fill', kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

async function danceFrame(i) {
  const basePose = DANCE_POSES[i % DANCE_POSES.length];
  const phase = Math.sin((i / DANCE_FRAMES) * Math.PI * 8);
  const pose = { ...basePose, y: basePose.y + phase * 2 };
  const pet = await transformPet(pose);
  return sharp({
    create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: danceBackdrop(i), left: 0, top: 0 },
      { input: pet, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  ensureDir(DANCE_FRAME_DIR);
  ensureDir(DANCE_QA_DIR);
  ensureDir(path.dirname(DANCE_ASP));
  ensureDir(DANCE_RUNTIME_DIR);

  const composites = [];
  for (let i = 0; i < DANCE_FRAMES; i += 1) {
    const frame = await danceFrame(i);
    fs.writeFileSync(path.join(DANCE_FRAME_DIR, `${String(i).padStart(2, '0')}.png`), frame);
    composites.push({ input: frame, left: i * CELL_W, top: 0 });
  }

  const pngSheet = path.join(DANCE_QA_DIR, 'dance-let-go.png');
  await sharp({
    create: { width: CELL_W * DANCE_FRAMES, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(pngSheet);

  await sharp(pngSheet)
    .webp({ quality: 95 })
    .toFile(DANCE_RUNTIME_SHEET);

  if (fs.existsSync(ASEPRITE_BIN)) {
    execFileSync(ASEPRITE_BIN, ['--batch', pngSheet, '--save-as', DANCE_ASP], { stdio: 'inherit' });
  }

  console.log(`Dance frames: ${path.relative(ROOT, DANCE_FRAME_DIR)}`);
  console.log(`Dance Aseprite: ${path.relative(ROOT, DANCE_ASP)}`);
  console.log(`Dance runtime sheet: ${path.relative(ROOT, DANCE_RUNTIME_SHEET)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
