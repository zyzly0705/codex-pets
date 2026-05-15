#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'gugu-gaga', 'spritesheet.webp');
const CONTACT = path.join(ROOT, 'assets', 'gugu-gaga', 'contact-sheet.png');
const CELL_W = 192;
const CELL_H = 208;
const COLS = 8;
const ROWS = 37;

function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function statePose(row, frame) {
  const t = frame / COLS;
  const wave = Math.sin(t * Math.PI * 2);
  const alt = Math.cos(t * Math.PI * 2);
  const pose = {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rot: 0,
    leftWing: -2, rightWing: 2, leftWingY: 10, rightWingY: 10,
    mouth: 'smile', eyes: 'open', blush: true, foot: wave * 2,
    beakY: 0, sad: false, sleep: false, accessory: '', ahoge: false,
  };

  if ([1, 2].includes(row)) {
    pose.x = row === 1 ? wave * 5 : -wave * 5;
    pose.y = Math.abs(wave) * -3;
    pose.rot = wave * 0.06;
    pose.leftWing = -18 + wave * 8;
    pose.rightWing = 18 + wave * 8;
    pose.foot = wave * 6;
  } else if ([3, 11, 23, 25].includes(row)) {
    pose.rightWing = -42 + alt * 7;
    pose.rightWingY = -34 + wave * 5;
    pose.mouth = 'open';
    if (row === 23) pose.accessory = 'heart';
  } else if ([4, 16, 21, 24, 27].includes(row)) {
    pose.y = -Math.sin(t * Math.PI) * 26;
    pose.scaleX = 1 + Math.sin(t * Math.PI) * 0.04;
    pose.scaleY = 1 - Math.sin(t * Math.PI) * 0.04;
    pose.leftWing = -28;
    pose.rightWing = 28;
    pose.mouth = 'open';
  } else if ([5, 14, 22, 28].includes(row)) {
    pose.y = 8 + Math.abs(wave) * 2;
    pose.scaleY = 0.96;
    pose.leftWing = -5;
    pose.rightWing = 5;
    pose.eyes = row === 14 ? 'dizzy' : 'sad';
    pose.mouth = 'sad';
    pose.sad = true;
    pose.rot = -0.05 + wave * 0.02;
  } else if ([6, 12, 15, 20, 26, 29, 30].includes(row)) {
    pose.y = wave * 1.5;
    pose.eyes = row === 20 || row === 30 ? 'sleepy' : 'open';
    pose.sleep = row === 20 || row === 30;
    pose.mouth = row === 12 ? 'yawn' : 'smile';
  } else if ([8, 17, 18, 19, 32].includes(row)) {
    pose.y = wave * 1.2;
    pose.eyes = 'focus';
    pose.mouth = 'small';
    pose.accessory = row === 32 ? 'keyboard' : row === 18 ? 'book' : row === 19 ? 'controller' : 'note';
  } else if (row === 9) {
    pose.x = wave * 3;
    pose.y = -8 + alt * 4;
    pose.leftWing = -24;
    pose.rightWing = 24;
  } else if (row === 10) {
    pose.y = -4 + wave * 2;
    pose.scaleY = 0.98;
  } else if (row === 13) {
    pose.eyes = 'round';
    pose.mouth = frame % 2 ? 'open' : 'small';
    pose.accessory = 'snack';
  } else if (row === 7) {
    pose.eyes = 'shy';
    pose.mouth = 'small';
    pose.accessory = 'heart';
  } else {
    pose.y = wave * 2;
    pose.scaleX = 1 + alt * 0.01;
    pose.scaleY = 1 - alt * 0.01;
  }

  return pose;
}

function eyeSvg(kind, x, y) {
  if (kind === 'sleepy') return `<path d="M${x - 8} ${y} Q${x} ${y + 5} ${x + 8} ${y}" stroke="#2b1d24" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (kind === 'sad') return `<path d="M${x - 8} ${y + 4} Q${x} ${y - 3} ${x + 8} ${y + 4}" stroke="#2b1d24" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (kind === 'focus') return `<path d="M${x - 10} ${y - 9} Q${x} ${y - 14} ${x + 10} ${y - 8}" stroke="#6d2530" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="${x}" cy="${y}" rx="7" ry="9" fill="#28435a"/><circle cx="${x + 2}" cy="${y - 3}" r="2" fill="#fff"/>`;
  if (kind === 'round') return `<ellipse cx="${x}" cy="${y}" rx="9" ry="10" fill="#64869d"/><circle cx="${x + 2}" cy="${y - 4}" r="3" fill="#fff"/><circle cx="${x}" cy="${y + 1}" r="2" fill="#1f2c35" opacity="0.6"/>`;
  if (kind === 'shy') return `<path d="M${x - 9} ${y} Q${x} ${y + 7} ${x + 9} ${y}" stroke="#2b1d24" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (kind === 'dizzy') return `<text x="${x - 6}" y="${y + 7}" font-size="20" font-family="Arial" fill="#2b1d24">×</text>`;
  return `<path d="M${x - 11} ${y - 10} Q${x} ${y - 15} ${x + 11} ${y - 9}" stroke="#6d2530" stroke-width="3.2" fill="none" stroke-linecap="round"/><ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="#4f728d"/><circle cx="${x + 2.4}" cy="${y - 4}" r="2.8" fill="#fff"/><path d="M${x - 5} ${y + 5} Q${x} ${y + 9} ${x + 5} ${y + 5}" fill="#e9bf8d" opacity="0.75"/>`;
}

function mouthSvg(kind) {
  if (kind === 'open') return '<ellipse cx="96" cy="84" rx="9" ry="7" fill="#bb4d54"/><path d="M88 81 Q96 91 104 81" stroke="#6e2730" stroke-width="1.5" fill="none"/>';
  if (kind === 'sad') return '<path d="M87 91 Q96 82 105 91" stroke="#7a3340" stroke-width="3" fill="none" stroke-linecap="round"/>';
  if (kind === 'yawn') return '<ellipse cx="96" cy="87" rx="6" ry="9" fill="#7a3340"/>';
  if (kind === 'small') return '<path d="M91 87 Q96 90 101 87" stroke="#7a3340" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  return '<path d="M86 84 Q96 94 106 84" stroke="#7a3340" stroke-width="3" fill="none" stroke-linecap="round"/>';
}

function propSvg(kind) {
  if (kind === 'keyboard') return '<rect x="62" y="154" width="68" height="18" rx="4" fill="#dfe8ef" stroke="#55616b" stroke-width="2"/><path d="M70 160 H122 M72 166 H118" stroke="#75828c" stroke-width="1.4"/>';
  if (kind === 'book') return '<path d="M58 145 Q78 136 96 146 Q114 136 134 145 V170 Q114 160 96 172 Q78 160 58 170 Z" fill="#fff0b8" stroke="#8d6b46" stroke-width="2"/>';
  if (kind === 'controller') return '<path d="M55 145 Q73 135 92 145 H100 Q119 135 137 145 Q143 158 133 168 Q122 164 112 158 H80 Q70 164 59 168 Q49 158 55 145Z" fill="#273140" stroke="#121722" stroke-width="3"/><circle cx="74" cy="154" r="4" fill="#78bddd"/><circle cx="120" cy="153" r="3" fill="#f06a6a"/><circle cx="130" cy="158" r="3" fill="#f2ca5b"/>';
  if (kind === 'screen') return '<rect x="58" y="142" width="76" height="42" rx="6" fill="#bfd7e6" stroke="#516170" stroke-width="3"/><rect x="72" y="184" width="48" height="5" rx="2" fill="#516170"/>';
  if (kind === 'note') return '<rect x="65" y="143" width="62" height="42" rx="4" fill="#fff8d7" stroke="#a58d5c" stroke-width="2"/><path d="M76 154 H116 M76 164 H110" stroke="#b6a06e" stroke-width="2"/>';
  if (kind === 'snack') return '<ellipse cx="122" cy="143" rx="12" ry="9" fill="#d89745" stroke="#7a4b26" stroke-width="2"/><circle cx="118" cy="140" r="2" fill="#4b2a1d"/><circle cx="126" cy="145" r="2" fill="#4b2a1d"/><circle cx="121" cy="147" r="1.5" fill="#fff3df"/>';
  if (kind === 'heart') return '<path d="M96 151 C84 139 64 148 72 166 C78 178 96 185 96 185 C96 185 114 178 120 166 C128 148 108 139 96 151Z" fill="#ff84b5" stroke="#c84d83" stroke-width="3" opacity="0.95"/>';
  return '';
}

function cellSvg(row, frame) {
  const p = statePose(row, frame);
  const label = row === 0 && frame === 0 ? 'gugu-gaga' : '';
  const transform = `translate(${96 + p.x} ${106 + p.y}) rotate(${p.rot * 57.3}) scale(${p.scaleX} ${p.scaleY}) translate(-96 -106)`;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}">
  <g transform="${esc(transform)}">
    <ellipse cx="${78 - p.foot}" cy="188" rx="16" ry="8" fill="#d69a21" stroke="#2d2119" stroke-width="3"/>
    <ellipse cx="${113 + p.foot}" cy="188" rx="16" ry="8" fill="#d69a21" stroke="#2d2119" stroke-width="3"/>
    <path d="M123 122 Q182 146 163 180 Q139 176 118 154Z" fill="#242836" stroke="#141722" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="96" cy="136" rx="46" ry="53" fill="#222632" stroke="#141722" stroke-width="5"/>
    <ellipse cx="96" cy="146" rx="31" ry="35" fill="#fffdf2" stroke="#d4cfd0" stroke-width="2"/>
    <ellipse cx="${53 + p.leftWing * 0.15}" cy="${127 + p.leftWingY}" rx="17" ry="36" fill="#2c3140" stroke="#141722" stroke-width="5" transform="rotate(${-28 + p.leftWing} ${53 + p.leftWing * 0.15} ${127 + p.leftWingY})"/>
    <ellipse cx="${139 + p.rightWing * 0.15}" cy="${127 + p.rightWingY}" rx="17" ry="36" fill="#2c3140" stroke="#141722" stroke-width="5" transform="rotate(${28 + p.rightWing} ${139 + p.rightWing * 0.15} ${127 + p.rightWingY})"/>
    <path d="M38 73 Q40 15 94 12 Q150 15 154 73 Q138 45 96 44 Q54 45 38 73Z" fill="#2b303e" stroke="#141722" stroke-width="5" stroke-linejoin="round"/>
    <path d="M47 72 Q56 40 96 38 Q136 40 145 72 Q138 109 96 113 Q54 109 47 72Z" fill="#f5c9ad" stroke="#141722" stroke-width="4"/>
    <path d="M62 58 Q72 45 82 57 Q92 43 102 57 Q113 45 126 58" fill="none" stroke="#1a191f" stroke-width="8" stroke-linecap="round"/>
    <path d="M62 44 Q80 27 96 27 Q112 27 130 44 Q110 38 96 39 Q82 38 62 44Z" fill="#1b1b21"/>
    <path d="M79 26 L113 26 L96 45Z" fill="#ffd51f" stroke="#141722" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M130 28 L142 18 L137 31" fill="#f5f7ff" opacity="0.7" stroke="#dfe6f3" stroke-width="1"/>
    <circle cx="72" cy="30" r="7.5" fill="#f4f6fb" stroke="#141722" stroke-width="3"/><circle cx="72" cy="30" r="2.8" fill="#141722"/>
    <circle cx="120" cy="30" r="7.5" fill="#f4f6fb" stroke="#141722" stroke-width="3"/><circle cx="120" cy="30" r="2.8" fill="#141722"/>
    <path d="M50 58 Q37 84 53 116" stroke="#1b1b21" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M142 58 Q155 84 139 116" stroke="#1b1b21" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-31 59 55) scale(1.15)"><rect x="52" y="50" width="22" height="6" rx="2" fill="#7dcad8" stroke="#203742" stroke-width="1.7"/><rect x="60" y="42" width="6" height="24" rx="2" fill="#91d9e5" stroke="#203742" stroke-width="1.7"/><rect x="57" y="55" width="19" height="4" rx="1.5" fill="#cceff5" stroke="#203742" stroke-width="1"/></g>
    ${eyeSvg(p.eyes, 76, 74)}
    ${eyeSvg(p.eyes, 116, 74)}
    ${p.blush ? '<ellipse cx="63" cy="89" rx="8" ry="3.5" fill="#ef8791" opacity="0.58"/><ellipse cx="129" cy="89" rx="8" ry="3.5" fill="#ef8791" opacity="0.58"/>' : ''}
    ${mouthSvg(p.mouth)}
    <path d="M77 101 H115" stroke="#2d303a" stroke-width="6" stroke-linecap="round"/>
    <rect x="93" y="98" width="8" height="8" rx="1" fill="#e94343" stroke="#2d303a" stroke-width="1.5"/>
    <path d="M85 99 L78 124 M107 99 L114 124" stroke="#dfe5ea" stroke-width="6.5" stroke-linecap="round"/>
    <ellipse cx="96" cy="115" rx="11" ry="18" fill="none" stroke="#ccd3d8" stroke-width="5.5"/>
    ${p.sad ? '<ellipse cx="72" cy="91" rx="3" ry="7" fill="#74c7ff"/>' : ''}
    ${p.sleep ? '<text x="127" y="57" font-size="18" font-family="Arial" fill="#6e86b8">Z</text>' : ''}
    ${propSvg(p.accessory)}
    ${label ? `<text x="96" y="202" font-size="8" text-anchor="middle" fill="#000" opacity="0">${label}</text>` : ''}
  </g>
</svg>`);
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const composites = [];
  const contact = [];
  for (let row = 0; row < ROWS; row++) {
    for (let frame = 0; frame < COLS; frame++) {
      const input = cellSvg(row, frame);
      composites.push({ input, left: frame * CELL_W, top: row * CELL_H });
      if (row <= 32) contact.push({ input, left: frame * 96, top: row * 104 });
    }
  }
  await sharp({
    create: { width: COLS * CELL_W, height: ROWS * CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).webp({ quality: 94, effort: 6 }).toFile(OUT);

  await sharp({
    create: { width: COLS * 96, height: 33 * 104, channels: 4, background: '#f2f4f6' },
  }).composite(contact.map((item) => ({
    ...item,
    input: Buffer.from(String(item.input).replace(`width="${CELL_W}" height="${CELL_H}"`, 'width="96" height="104"').replace(`viewBox="0 0 ${CELL_W} ${CELL_H}"`, `viewBox="0 0 ${CELL_W} ${CELL_H}"`)),
  }))).png().toFile(CONTACT);

  const meta = await sharp(OUT).metadata();
  console.log(`Generated ${path.relative(ROOT, OUT)} ${meta.width}x${meta.height}`);
  console.log(`Generated ${path.relative(ROOT, CONTACT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
