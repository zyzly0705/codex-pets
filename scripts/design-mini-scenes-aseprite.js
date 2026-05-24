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
const FRAMES_PER_ACTION = 16;
const SRC_ROOT = path.join(ROOT, 'assets-src', 'yoyo');
const ASE_DIR = path.join(SRC_ROOT, 'aseprite');
const FRAMES_DIR = path.join(SRC_ROOT, 'frames');
const ANCHORS_DIR = path.join(SRC_ROOT, 'anchors');
const QA_DIR = path.join(SRC_ROOT, 'qa', 'mini-scene-design');

const ACTIONS = [
  { name: 'swing', sourceRow: 4, sourceFrames: 5, scene: 'swing' },
  { name: 'fanCooling', sourceRow: 0, sourceFrames: 6, scene: 'fanCooling' },
  { name: 'airConditioning', sourceRow: 0, sourceFrames: 6, scene: 'airConditioning' },
];

const SOURCE_COLUMNS = {
  swing: [0, 1, 2, 3, 4, 3, 2, 1],
  fanCooling: [0, 1, 2, 3, 0, 5, 2, 0],
  swimming: [1, 2, 3, 1, 0, 3, 2, 1],
  airConditioning: [2, 0, 2, 3, 0, 5, 2, 0],
  sofaLying: [0, 1, 2, 3, 4, 5, 3, 2],
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function svg(body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">
    <defs>
      <radialGradient id="warm" cx="50%" cy="52%" r="58%">
        <stop offset="0%" stop-color="#fff0bd" stop-opacity=".24"/>
        <stop offset="62%" stop-color="#ffc4df" stop-opacity=".10"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#83dcff" stop-opacity=".88"/>
        <stop offset="100%" stop-color="#3aa2df" stop-opacity=".78"/>
      </linearGradient>
      <linearGradient id="sofa" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd2df"/>
        <stop offset="100%" stop-color="#dd7da0"/>
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

async function alphaTrim(source) {
  const image = sharp(source).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return source;
  return image
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

async function placePet(source, pose) {
  const trimmed = await alphaTrim(source);
  const trimmedMeta = await sharp(trimmed).metadata();
  const targetH = Math.round(pose.height || trimmedMeta.height * (pose.scaleY || pose.scale || 1));
  const targetW = Math.round(trimmedMeta.width * (targetH / trimmedMeta.height) * (pose.scaleX || 1));
  const scaled = await sharp(trimmed)
    .resize({
      width: targetW,
      height: targetH,
      fit: 'fill',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate((pose.rotation || 0) * 180 / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(scaled).metadata();
  const left = Math.round((pose.left ?? ((CELL_W - meta.width) / 2)) + (pose.x || 0));
  const top = Math.round((pose.top ?? ((CELL_H - meta.height) / 2)) + (pose.y || 0));
  const pad = 48;
  const image = await sharp({
    create: { width: CELL_W + pad * 2, height: CELL_H + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, left: left + pad, top: top + pad }])
    .extract({ left: pad, top: pad, width: CELL_W, height: CELL_H })
    .png()
    .toBuffer();
  const box = {
    x: Math.max(0, left),
    y: Math.max(0, top),
    width: Math.min(CELL_W, left + meta.width) - Math.max(0, left),
    height: Math.min(CELL_H, top + meta.height) - Math.max(0, top),
  };
  const anchors = {
    head: { x: left + meta.width * 0.5, y: top + meta.height * 0.14 },
    face: { x: left + meta.width * 0.5, y: top + meta.height * 0.30 },
    bodyCenter: { x: left + meta.width * 0.5, y: top + meta.height * 0.58 },
    hips: { x: left + meta.width * 0.5, y: top + meta.height * 0.69 },
    feet: { x: left + meta.width * 0.5, y: top + meta.height * 0.94 },
    leftHand: { x: left + meta.width * 0.22, y: top + meta.height * 0.54 },
    rightHand: { x: left + meta.width * 0.78, y: top + meta.height * 0.54 },
  };
  return { image, box, anchors };
}

function swingMetrics(i) {
  const t = i / FRAMES_PER_ACTION;
  const angle = Math.sin(t * Math.PI * 2) * 0.22;
  const seatY = 132 + Math.cos(t * Math.PI * 2) * 3;
  const ropeDx = Math.sin(angle) * 22;
  const seatCenter = { x: 96 + ropeDx, y: seatY + Math.cos(t * Math.PI * 2) * 2 };
  return {
    seatTop: { x: seatCenter.x, y: seatCenter.y - 3 },
    seatCenter,
    seatBounds: { x: seatCenter.x - 34, y: seatCenter.y - 3, width: 68, height: 11 },
  };
}

function swimmingMetrics(i) {
  const t = i / FRAMES_PER_ACTION;
  const wave = Math.sin(t * Math.PI * 2);
  return {
    poolBounds: { x: 21, y: 118, width: 150, height: 66 },
    waterline: { y: 139 + wave },
    faceSafeTop: { y: 78 },
  };
}

function sofaMetrics() {
  return {
    cushionBounds: { x: 34, y: 132, width: 124, height: 31 },
    bodyRestBounds: { x: 30, y: 92, width: 134, height: 72 },
    backRestBounds: { x: 35, y: 72, width: 122, height: 48 },
  };
}

function sceneAnchors(action, i) {
  if (action.scene === 'swing') return swingMetrics(i);
  if (action.scene === 'swimming') return swimmingMetrics(i);
  if (action.scene === 'sofaLying') return sofaMetrics(i);
  return {};
}

function roundPoint(point) {
  if (!point) return point;
  return Object.fromEntries(Object.entries(point).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}

function roundAnchors(anchors) {
  return Object.fromEntries(Object.entries(anchors).map(([key, value]) => [key, roundPoint(value)]));
}

function swingBackground(i) {
  const topY = 18;
  const cx = 96;
  const t = i / COLS;
  const metrics = swingMetrics(i);
  const seatY = metrics.seatCenter.y;
  const ropeDx = metrics.seatCenter.x - cx;
  return svg(`
    <circle cx="96" cy="98" r="82" fill="url(#warm)" opacity=".9"/>
    <path d="M42 28 C62 12 130 12 150 28" fill="none" stroke="#7b573c" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 28 L31 186 M142 28 L161 186" stroke="#7b573c" stroke-width="4" stroke-linecap="round" opacity=".82"/>
    <path d="M${cx - 24} ${topY + 8} L${cx - 22 + ropeDx} ${seatY} M${cx + 24} ${topY + 8} L${cx + 22 + ropeDx} ${seatY}" stroke="#f2c778" stroke-width="3" stroke-linecap="round"/>
    <g transform="translate(${ropeDx} ${Math.cos(t * Math.PI * 2) * 2})">
      <rect x="62" y="${seatY - 3}" width="68" height="11" rx="5.5" fill="#d69752" stroke="#7b573c" stroke-width="1.4"/>
      <path d="M68 ${seatY + 1} C82 ${seatY + 8} 110 ${seatY + 8} 124 ${seatY + 1}" fill="none" stroke="#9d6434" stroke-width="1.4" opacity=".55"/>
    </g>
    <ellipse cx="96" cy="190" rx="62" ry="7" fill="#f3a6c8" opacity=".24"/>
  `);
}

function swingForeground(i) {
  return svg('');
}

function fanBackground(i) {
  const t = i / FRAMES_PER_ACTION;
  const spin = i * 38;
  const breeze = 0.45 + Math.sin(t * Math.PI * 2) * 0.12;
  return svg(`
    <ellipse cx="92" cy="190" rx="58" ry="7" fill="#84d7ff" opacity=".18"/>
    <g transform="translate(145 126)">
      <rect x="-15" y="27" width="30" height="18" rx="8" fill="#ccf3ff" stroke="#67adc8" stroke-width="1.2"/>
      <path d="M0 18 L0 28" stroke="#67adc8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="0" cy="0" r="21" fill="#eefcff" stroke="#67adc8" stroke-width="1.8"/>
      <g transform="rotate(${spin})" fill="#88cee8" opacity=".9">
        <ellipse cx="0" cy="-10" rx="5" ry="11"/>
        <ellipse cx="8.7" cy="5" rx="5" ry="11" transform="rotate(120 8.7 5)"/>
        <ellipse cx="-8.7" cy="5" rx="5" ry="11" transform="rotate(240 -8.7 5)"/>
      </g>
      <circle cx="0" cy="0" r="4" fill="#5a9bb7"/>
    </g>
    <g fill="none" stroke="#9be9ff" stroke-width="2" stroke-linecap="round" opacity="${breeze}">
      <path d="M126 101 C104 94 79 96 50 103"/>
      <path d="M127 119 C104 113 78 116 45 126"/>
      <path d="M126 137 C101 132 78 137 55 148"/>
    </g>
  `);
}

function swimmingBackground(i) {
  const t = i / FRAMES_PER_ACTION;
  const wave = Math.sin(t * Math.PI * 2);
  const wavePath = Array.from({ length: 11 }, (_, idx) => {
    const x = 34 + idx * 13;
    const y = 151 + Math.sin(t * Math.PI * 2 + idx * 0.8) * 3;
    return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
  return svg(`
    <ellipse cx="96" cy="113" rx="80" ry="82" fill="#d9f6ff" opacity=".22"/>
    <rect x="21" y="${swimmingMetrics(i).poolBounds.y}" width="150" height="66" rx="22" fill="url(#water)" stroke="#2b88c5" stroke-width="2"/>
    <path d="${wavePath}" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" opacity=".72"/>
    <path d="M35 166 C55 ${159 + wave * 3} 73 ${172 - wave * 3} 94 164 C115 ${156 - wave * 2} 136 ${173 + wave * 2} 158 164" fill="none" stroke="#c9f6ff" stroke-width="2" opacity=".58"/>
    <circle cx="${62 + wave * 3}" cy="143" r="4" fill="#ffffff" opacity=".70"/>
    <circle cx="${142 - wave * 4}" cy="159" r="3" fill="#ffffff" opacity=".62"/>
  `);
}

function airBackground(i) {
  const t = i / FRAMES_PER_ACTION;
  const drift = Math.sin(t * Math.PI * 2);
  const stream = Array.from({ length: 4 }, (_, idx) => {
    const x = 52 + idx * 29;
    return `<path d="M${x} 46 C${x - 10 + drift * 5} 77 ${x + 10 - drift * 5} 103 ${x + drift * 4} 137"/>`;
  }).join('');
  return svg(`
    <rect x="20" y="12" width="152" height="130" rx="14" fill="#dff4ff" opacity=".20"/>
    <rect x="36" y="18" width="120" height="30" rx="9" fill="#ffffff" stroke="#6fb7d7" stroke-width="1.6"/>
    <rect x="51" y="39" width="90" height="6" rx="3" fill="#63bee5"/>
    <circle cx="143" cy="31" r="3" fill="#46bde9"/>
    <g fill="none" stroke="#91e2ff" stroke-width="2.2" stroke-linecap="round" opacity=".48">${stream}</g>
    <ellipse cx="96" cy="190" rx="56" ry="7" fill="#b8ecff" opacity=".20"/>
  `);
}

function sofaBackground(i) {
  const t = i / FRAMES_PER_ACTION;
  const sink = 1 + Math.sin(t * Math.PI * 2) * 0.04;
  return svg(`
    <ellipse cx="96" cy="191" rx="68" ry="8" fill="#c86b92" opacity=".18"/>
    <rect x="22" y="94" width="148" height="70" rx="20" fill="url(#sofa)" stroke="#9c476b" stroke-width="2"/>
    <rect x="35" y="72" width="122" height="48" rx="18" fill="#ffc4d5" stroke="#9c476b" stroke-width="1.7"/>
    <rect x="34" y="132" width="124" height="31" rx="15" fill="#f09abc" stroke="#9c476b" stroke-width="1.3" transform="scale(1 ${sink}) translate(0 ${132 * (1 - sink)})"/>
    <circle cx="45" cy="164" r="7" fill="#9c476b"/>
    <circle cx="147" cy="164" r="7" fill="#9c476b"/>
  `);
}

function foreground(action, i) {
  if (action.scene === 'swing') {
    return swingForeground(i);
  }
  if (action.scene === 'swimming') {
    const t = i / FRAMES_PER_ACTION;
    const wave = Math.sin(t * Math.PI * 2);
    return svg(`
      <path d="M25 138 C48 ${133 + wave * 3} 71 ${145 - wave * 2} 96 139 C121 ${133 - wave * 2} 142 ${145 + wave * 2} 167 138 L167 184 L25 184 Z"
        fill="#5dbfec" opacity=".56"/>
      <path d="M34 140 C55 ${135 + Math.sin(t * 6.28) * 3} 76 ${145 - Math.sin(t * 6.28) * 2} 96 139 C116 133 137 146 160 139"
        fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".76"/>
      <path d="M40 163 C63 ${157 + wave * 2} 82 ${169 - wave * 2} 104 162 C126 155 144 169 163 161"
        fill="none" stroke="#c9f6ff" stroke-width="2.2" stroke-linecap="round" opacity=".72"/>
      <circle cx="${56 + wave * 5}" cy="151" r="3.2" fill="#ffffff" opacity=".66"/>
      <circle cx="${139 - wave * 5}" cy="166" r="2.5" fill="#ffffff" opacity=".58"/>
    `);
  }
  if (action.scene === 'sofaLying') {
    const t = i / FRAMES_PER_ACTION;
    const breathe = Math.sin(t * Math.PI * 2) * 1.5;
    return svg(`
      <rect x="78" y="${119 + breathe}" width="75" height="28" rx="12" fill="#ffd1e0" stroke="#a84f75" stroke-width="1.3" opacity=".88"/>
      <path d="M86 ${129 + breathe} C105 ${136 + breathe} 130 ${134 + breathe} 150 ${140 + breathe}"
        fill="none" stroke="#ee8bad" stroke-width="2" stroke-linecap="round" opacity=".62"/>
      <path d="M84 ${143 + breathe} C103 ${148 + breathe} 129 ${148 + breathe} 152 ${143 + breathe}"
        fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".46"/>
    `);
  }
  return svg('');
}

function background(action, i) {
  if (action.scene === 'swing') return swingBackground(i);
  if (action.scene === 'fanCooling') return fanBackground(i);
  if (action.scene === 'swimming') return swimmingBackground(i);
  if (action.scene === 'airConditioning') return airBackground(i);
  if (action.scene === 'sofaLying') return sofaBackground(i);
  return svg('');
}

function poseFor(action, i) {
  const t = i / FRAMES_PER_ACTION;
  const wave = Math.sin(t * Math.PI * 2);
  const bob = Math.cos(t * Math.PI * 2);
  if (action.scene === 'swing') {
    return { height: 108, x: wave * 9, top: 54 + bob * 2.5, rotation: wave * 0.09 };
  }
  if (action.scene === 'fanCooling') {
    return { height: 118, x: -25 + wave * 1.8, top: 62 + bob * 1.2, rotation: wave * 0.018 };
  }
  if (action.scene === 'swimming') {
    return { height: 104, x: wave * 5, top: 63 + bob * 2.5, rotation: -0.06 + wave * 0.035 };
  }
  if (action.scene === 'airConditioning') {
    return { height: 118, x: wave * 1.5, top: 68 + bob * 1.2, rotation: wave * 0.012 };
  }
  if (action.scene === 'sofaLying') {
    return { height: 108, scaleX: 1.02, x: -15 + wave * 1.2, top: 94 + bob * 1.2, rotation: -Math.PI / 2 + wave * 0.012 };
  }
  return { scale: 1 };
}

async function composeFrame(action, col) {
  const sourceCols = SOURCE_COLUMNS[action.name] || [];
  const sourceCol = sourceCols[col % sourceCols.length] ?? (col % action.sourceFrames);
  const pet = await cellFrom(action.sourceRow, sourceCol);
  const placedPet = await placePet(pet, poseFor(action, col));
  const image = await sharp({
    create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: background(action, col), left: 0, top: 0 },
      { input: placedPet.image, left: 0, top: 0 },
      { input: foreground(action, col), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  return {
    image,
    anchors: {
      frame: `${String(col).padStart(2, '0')}.png`,
      character: {
        box: roundPoint(placedPet.box),
        anchors: roundAnchors(placedPet.anchors),
      },
      scene: sceneAnchors(action, col),
    },
  };
}

async function writeAction(action) {
  const frameDirs = [
    { name: action.name, start: 0 },
    { name: `${action.name}2`, start: COLS },
  ];
  const anchorPath = path.join(ANCHORS_DIR, `${action.name}.json`);
  for (const frameDir of frameDirs) ensureDir(path.join(FRAMES_DIR, frameDir.name));
  ensureDir(ASE_DIR);
  ensureDir(ANCHORS_DIR);
  ensureDir(QA_DIR);

  const composites = [];
  const anchors = {
    action: action.name,
    cell: { width: CELL_W, height: CELL_H },
    generatedAt: new Date().toISOString(),
    frames: [],
  };
  for (let frameIndex = 0; frameIndex < FRAMES_PER_ACTION; frameIndex += 1) {
    const frame = await composeFrame(action, frameIndex);
    anchors.frames.push(frame.anchors);
    const rowName = frameIndex < COLS ? action.name : `${action.name}2`;
    const col = frameIndex % COLS;
    fs.writeFileSync(path.join(FRAMES_DIR, rowName, `${String(col).padStart(2, '0')}.png`), frame.image);
    composites.push({ input: frame.image, left: frameIndex * CELL_W, top: 0 });
  }
  fs.writeFileSync(anchorPath, `${JSON.stringify(anchors, null, 2)}\n`);

  const sheetPath = path.join(QA_DIR, `${action.name}.png`);
  await sharp({
    create: { width: CELL_W * FRAMES_PER_ACTION, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
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
  console.log(`Mini-scene Aseprite sources: ${path.relative(ROOT, ASE_DIR)}`);
  console.log(`Mini-scene previews: ${path.relative(ROOT, QA_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
