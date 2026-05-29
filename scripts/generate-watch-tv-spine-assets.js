const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const effectIds = ['watch-tv', 'play-switch'];

function outputDirs(effectId) {
  return [
    path.join(repoRoot, 'assets/yoyo/effects', effectId, 'spine'),
    path.join(repoRoot, 'assets-src/yoyo/effects', effectId, 'spine'),
  ];
}

const regions = [
  {
    name: 'torso',
    x: 16,
    y: 20,
    w: 120,
    h: 136,
    svg: `
      <path d="M31 8 C45 1 76 1 90 8 L102 62 C86 74 35 74 18 62 Z" fill="#fff7ec"/>
      <path d="M35 16 C49 8 73 8 86 16 L94 76 C77 91 42 91 25 76 Z" fill="#152a43"/>
      <path d="M24 76 C40 64 80 64 96 76 L108 125 C87 136 32 136 11 125 Z" fill="#17304d"/>
      <path d="M26 78 C43 88 77 88 94 78 L99 125 C81 134 40 134 22 125 Z" fill="#213c5f" opacity="0.55"/>
      <path d="M47 22 L60 39 L73 22" fill="#fff7ec"/>
      <path d="M51 34 C57 27 63 27 69 34 C64 41 56 41 51 34 Z" fill="#a84855"/>
      <path d="M40 34 C49 28 54 30 58 38 C48 44 39 42 34 35 Z" fill="#b64b57"/>
      <path d="M80 34 C71 28 66 30 62 38 C72 44 81 42 86 35 Z" fill="#b64b57"/>
      <circle cx="39" cy="62" r="5.2" fill="#d8ad54" stroke="#7c5a2c" stroke-width="2"/>
      <circle cx="81" cy="62" r="5.2" fill="#d8ad54" stroke="#7c5a2c" stroke-width="2"/>
      <path d="M24 127 C43 113 78 113 97 127" fill="none" stroke="#101821" stroke-width="5" stroke-linecap="round" opacity="0.36"/>
    `,
  },
  {
    name: 'head',
    x: 156,
    y: 18,
    w: 150,
    h: 142,
    svg: `
      <ellipse cx="75" cy="77" rx="55" ry="53" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <circle cx="24" cy="78" r="13" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <circle cx="126" cy="78" r="13" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <path d="M19 70 C17 35 43 12 78 12 C113 12 133 36 131 73 C121 49 101 38 76 39 C48 39 29 50 19 70 Z" fill="#221f23" stroke="#171a20" stroke-width="3"/>
      <path d="M31 40 C45 22 65 17 87 22 C73 24 58 31 48 45 Z" fill="#3a3230" opacity="0.78"/>
      <path d="M28 48 C42 37 55 33 69 35 L63 72 C52 64 41 55 28 48 Z" fill="#252226"/>
      <path d="M61 36 C75 31 90 32 103 39 L94 76 C85 63 75 51 61 36 Z" fill="#252226"/>
      <path d="M93 39 C109 42 121 52 129 69 C113 58 103 50 93 39 Z" fill="#252226"/>
      <rect x="37" y="62" width="24" height="30" rx="12" fill="#fffaf4"/>
      <rect x="89" y="62" width="24" height="30" rx="12" fill="#fffaf4"/>
      <ellipse cx="49" cy="78" rx="11" ry="15" fill="#4b2a1e"/>
      <ellipse cx="101" cy="78" rx="11" ry="15" fill="#4b2a1e"/>
      <circle cx="45" cy="70" r="4" fill="#ffffff"/>
      <circle cx="97" cy="70" r="4" fill="#ffffff"/>
      <circle cx="53" cy="85" r="3" fill="#211a18" opacity="0.55"/>
      <circle cx="105" cy="85" r="3" fill="#211a18" opacity="0.55"/>
      <path d="M66 104 C73 111 82 111 89 104" fill="none" stroke="#8f4c50" stroke-width="4" stroke-linecap="round"/>
      <circle cx="38" cy="96" r="7" fill="#e7949e" opacity="0.45"/>
      <circle cx="112" cy="96" r="7" fill="#e7949e" opacity="0.45"/>
      <path d="M20 55 C15 78 20 105 33 118" fill="none" stroke="#221f23" stroke-width="8" stroke-linecap="round"/>
      <path d="M130 56 C135 78 130 105 117 118" fill="none" stroke="#221f23" stroke-width="8" stroke-linecap="round"/>
    `,
  },
  {
    name: 'hair_bun',
    x: 328,
    y: 20,
    w: 100,
    h: 86,
    svg: `
      <ellipse cx="50" cy="44" rx="36" ry="27" fill="#242126" stroke="#171a20" stroke-width="3"/>
      <circle cx="31" cy="38" r="21" fill="#2e2929" stroke="#171a20" stroke-width="3"/>
      <circle cx="57" cy="30" r="25" fill="#2d2929" stroke="#171a20" stroke-width="3"/>
      <circle cx="75" cy="47" r="22" fill="#242126" stroke="#171a20" stroke-width="3"/>
      <path d="M30 30 C43 18 58 16 72 28" fill="none" stroke="#5a4c48" stroke-width="5" stroke-linecap="round" opacity="0.68"/>
      <path d="M24 50 C43 65 66 65 82 49" fill="none" stroke="#111214" stroke-width="4" stroke-linecap="round" opacity="0.45"/>
    `,
  },
  {
    name: 'arm_left',
    x: 16,
    y: 178,
    w: 70,
    h: 112,
    svg: `
      <path d="M38 10 C23 28 18 54 22 76" fill="none" stroke="#fff7ec" stroke-width="18" stroke-linecap="round"/>
      <path d="M38 10 C25 29 23 55 28 72" fill="none" stroke="#17304d" stroke-width="9" stroke-linecap="round" opacity="0.96"/>
      <circle cx="36" cy="86" r="14" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <path d="M27 92 C33 102 46 101 51 91" fill="none" stroke="#d9a98f" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    name: 'arm_right',
    x: 104,
    y: 178,
    w: 74,
    h: 112,
    svg: `
      <path d="M32 10 C50 29 56 55 50 76" fill="none" stroke="#fff7ec" stroke-width="18" stroke-linecap="round"/>
      <path d="M32 10 C47 30 50 55 45 72" fill="none" stroke="#17304d" stroke-width="9" stroke-linecap="round" opacity="0.96"/>
      <circle cx="35" cy="86" r="14" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <path d="M24 91 C31 102 45 102 51 91" fill="none" stroke="#d9a98f" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    name: 'leg_left',
    x: 204,
    y: 180,
    w: 58,
    h: 100,
    svg: `
      <path d="M23 3 C38 3 44 17 40 37 L35 67 C32 80 16 80 13 67 L16 36 C17 18 16 6 23 3 Z" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <rect x="12" y="58" width="28" height="18" rx="8" fill="#fff7ec"/>
      <path d="M8 74 C20 66 39 67 49 77 L47 92 L7 92 Z" fill="#3a251c" stroke="#171a20" stroke-width="3"/>
    `,
  },
  {
    name: 'leg_right',
    x: 278,
    y: 180,
    w: 58,
    h: 100,
    svg: `
      <path d="M35 3 C20 3 14 17 18 37 L23 67 C26 80 42 80 45 67 L42 36 C41 18 42 6 35 3 Z" fill="#f5d0b8" stroke="#171a20" stroke-width="3"/>
      <rect x="18" y="58" width="28" height="18" rx="8" fill="#fff7ec"/>
      <path d="M9 77 C20 67 39 66 51 74 L52 92 L11 92 Z" fill="#3a251c" stroke="#171a20" stroke-width="3"/>
    `,
  },
  {
    name: 'remote',
    x: 366,
    y: 150,
    w: 64,
    h: 46,
    svg: `
      <rect x="13" y="10" width="38" height="25" rx="10" fill="#e1a6ad"/>
      <circle cx="27" cy="22" r="4" fill="#8a5064"/>
      <circle cx="39" cy="22" r="4" fill="#8a5064"/>
      <path d="M18 31 L47 31" stroke="#fff0db" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    name: 'snack',
    x: 366,
    y: 218,
    w: 86,
    h: 76,
    svg: `
      <ellipse cx="43" cy="51" rx="28" ry="12" fill="#c77a4b"/>
      <path d="M18 42 C24 66 62 66 68 42 Z" fill="#d98d58"/>
      <path d="M25 39 C35 30 49 30 61 39" fill="none" stroke="#f4d25f" stroke-width="6" stroke-linecap="round"/>
      <path d="M31 35 C39 28 51 28 58 35" fill="none" stroke="#f7e08d" stroke-width="5" stroke-linecap="round"/>
    `,
  },
  {
    name: 'floor_shadow',
    x: 360,
    y: 320,
    w: 114,
    h: 34,
    svg: `<ellipse cx="57" cy="17" rx="51" ry="10" fill="#273342" opacity="0.18"/>`,
  },
];

function regionSvg(region) {
  return `<g transform="translate(${region.x} ${region.y})">${region.svg}</g>`;
}

function regionsForEffect(effectId) {
  if (effectId !== 'play-switch') return regions;
  return regions.map((region) => {
    if (region.name === 'remote') {
      return {
        ...region,
        svg: `
          <rect x="9" y="8" width="42" height="29" rx="12" fill="#f38cab"/>
          <circle cx="24" cy="22" r="4" fill="#77384c"/>
          <circle cx="38" cy="22" r="4" fill="#77384c"/>
          <path d="M18 31 L44 31" stroke="#fff0db" stroke-width="3" stroke-linecap="round"/>
        `,
      };
    }
    if (region.name === 'snack') {
      return {
        ...region,
        svg: `
          <rect x="18" y="16" width="42" height="31" rx="13" fill="#58c7dc"/>
          <circle cx="32" cy="31" r="4" fill="#22556a"/>
          <circle cx="47" cy="31" r="4" fill="#22556a"/>
          <path d="M25 41 L54 41" stroke="#e9fbff" stroke-width="3" stroke-linecap="round"/>
        `,
      };
    }
    return region;
  });
}

function attachment(name, x, y, width, height, rotation = 0) {
  return { type: 'region', name, path: name, x, y, width, height, rotation };
}

function skeletonJson() {
  const slots = [
    ['floor_shadow', 'root'],
    ['leg_left', 'leg_left'],
    ['leg_right', 'leg_right'],
    ['torso', 'torso'],
    ['arm_left', 'arm_left'],
    ['arm_right', 'arm_right'],
    ['remote', 'arm_right'],
    ['snack', 'arm_left'],
    ['head', 'head'],
    ['hair_bun', 'head'],
  ].map(([name, bone]) => ({ name, bone, attachment: name }));

  return {
    skeleton: {
      spine: '4.3.3',
      hash: 'generated-yoyo-spine-action-v1',
      x: -80,
      y: -210,
      width: 170,
      height: 230,
      fps: 30,
      images: './',
    },
    bones: [
      { name: 'root' },
      { name: 'hip', parent: 'root', x: 0, y: 74 },
      { name: 'torso', parent: 'hip', x: 0, y: 42, length: 58 },
      { name: 'head', parent: 'torso', x: 0, y: 82, length: 42 },
      { name: 'leg_left', parent: 'hip', x: -28, y: -26, length: 48, rotation: -14 },
      { name: 'leg_right', parent: 'hip', x: 31, y: -27, length: 48, rotation: 14 },
      { name: 'arm_left', parent: 'torso', x: -48, y: 35, length: 56, rotation: 17 },
      { name: 'arm_right', parent: 'torso', x: 47, y: 35, length: 56, rotation: -18 },
    ],
    slots,
    skins: [
      {
        name: 'default',
        attachments: {
          floor_shadow: { floor_shadow: attachment('floor_shadow', 0, 38, 114, 34) },
          leg_left: { leg_left: attachment('leg_left', 0, 34, 58, 100) },
          leg_right: { leg_right: attachment('leg_right', 0, 34, 58, 100) },
          torso: { torso: attachment('torso', 0, -4, 120, 136) },
          arm_left: { arm_left: attachment('arm_left', -2, 42, 70, 112) },
          arm_right: { arm_right: attachment('arm_right', 2, 42, 74, 112) },
          remote: { remote: attachment('remote', -2, 82, 64, 46, -8) },
          snack: { snack: attachment('snack', -20, 82, 86, 76, 6) },
          head: { head: attachment('head', 0, -10, 150, 142) },
          hair_bun: { hair_bun: attachment('hair_bun', 0, 82, 100, 86) },
        },
      },
    ],
    animations: {
      idle_sit: {
        bones: {
          torso: {
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 1.0, x: 0, y: 3 },
              { time: 2.0, x: 0, y: 0 },
            ],
          },
          head: {
            rotate: [
              { time: 0, value: -1.5 },
              { time: 1.0, value: 1.5 },
              { time: 2.0, value: -1.5 },
            ],
          },
          arm_right: {
            rotate: [
              { time: 0, value: -18 },
              { time: 1.0, value: -22 },
              { time: 2.0, value: -18 },
            ],
          },
        },
      },
      watch_tv: {
        bones: {
          root: {
            translate: [
              { time: 0, x: 0, y: -18 },
              { time: 0.35, x: 0, y: 0 },
              { time: 3.8, x: 0, y: 0 },
            ],
          },
          torso: {
            rotate: [
              { time: 0, value: 3 },
              { time: 0.7, value: -2 },
              { time: 1.4, value: 2 },
              { time: 2.1, value: -1 },
              { time: 3.2, value: 0 },
            ],
          },
          head: {
            rotate: [
              { time: 0, value: -6 },
              { time: 0.55, value: 5 },
              { time: 1.4, value: 2 },
              { time: 2.2, value: -4 },
              { time: 3.2, value: 0 },
            ],
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 1.0, x: 2, y: 2 },
              { time: 2.0, x: -1, y: -1 },
              { time: 3.2, x: 0, y: 0 },
            ],
          },
          arm_right: {
            rotate: [
              { time: 0, value: -32 },
              { time: 0.5, value: -47 },
              { time: 1.1, value: -35 },
              { time: 1.65, value: -52 },
              { time: 2.2, value: -28 },
              { time: 3.2, value: -18 },
            ],
          },
          arm_left: {
            rotate: [
              { time: 0, value: 27 },
              { time: 0.8, value: 18 },
              { time: 1.5, value: 29 },
              { time: 2.4, value: 20 },
              { time: 3.2, value: 17 },
            ],
          },
        },
      },
      play_switch: {
        bones: {
          root: {
            translate: [
              { time: 0, x: 0, y: -14 },
              { time: 0.32, x: 0, y: 0 },
              { time: 3.8, x: 0, y: 0 },
            ],
          },
          torso: {
            rotate: [
              { time: 0, value: -2 },
              { time: 0.5, value: 3 },
              { time: 1.0, value: -3 },
              { time: 1.55, value: 4 },
              { time: 2.2, value: -2 },
              { time: 3.2, value: 0 },
            ],
          },
          head: {
            rotate: [
              { time: 0, value: 3 },
              { time: 0.45, value: -5 },
              { time: 0.95, value: 4 },
              { time: 1.55, value: -4 },
              { time: 2.35, value: 2 },
              { time: 3.2, value: 0 },
            ],
          },
          arm_right: {
            rotate: [
              { time: 0, value: -34 },
              { time: 0.32, value: -58 },
              { time: 0.72, value: -30 },
              { time: 1.1, value: -62 },
              { time: 1.48, value: -35 },
              { time: 2.4, value: -44 },
              { time: 3.2, value: -18 },
            ],
          },
          arm_left: {
            rotate: [
              { time: 0, value: 34 },
              { time: 0.3, value: 56 },
              { time: 0.72, value: 31 },
              { time: 1.08, value: 61 },
              { time: 1.5, value: 35 },
              { time: 2.35, value: 43 },
              { time: 3.2, value: 17 },
            ],
          },
        },
      },
    },
  };
}

function atlasText(effectRegions) {
  const lines = [
    'yoyo.png',
    'size: 512,512',
    'format: RGBA8888',
    'filter: Linear,Linear',
    'repeat: none',
  ];

  for (const region of effectRegions) {
    lines.push(
      region.name,
      '  rotate: false',
      `  xy: ${region.x}, ${region.y}`,
      `  size: ${region.w}, ${region.h}`,
      `  orig: ${region.w}, ${region.h}`,
      '  offset: 0, 0',
      '  index: -1',
    );
  }

  return `${lines.join('\n')}\n`;
}

async function generate() {
  for (const effectId of effectIds) {
    const effectRegions = regionsForEffect(effectId);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" fill="none"/>
        ${effectRegions.map(regionSvg).join('\n')}
      </svg>
    `;
    for (const dir of outputDirs(effectId)) {
      fs.mkdirSync(dir, { recursive: true });
      await sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'yoyo.png'));
      fs.writeFileSync(path.join(dir, 'yoyo.atlas'), atlasText(effectRegions));
      fs.writeFileSync(path.join(dir, 'yoyo.skel.json'), `${JSON.stringify(skeletonJson(), null, 2)}\n`);
    }
  }
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
