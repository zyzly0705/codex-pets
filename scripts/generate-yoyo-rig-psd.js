const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { writePsdBuffer } = require('ag-psd');

const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(
  repoRoot,
  'assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v2-alpha.png',
);
const outDir = path.join(repoRoot, 'assets-src/yoyo/rig/live2d-yoyo-v4');

const docWidth = 1254;
const docHeight = 1254;

const rigTree = [
  {
    name: 'Head',
    children: [
      {
        name: 'hair_back',
        color: 'gray',
        box: { left: 420, top: 120, width: 408, height: 438 },
        maskSvg: `
          <path d="M75 168 C70 62 145 8 254 8 C360 8 411 70 399 172
          C392 257 357 318 324 358 C300 390 281 415 253 430
          C226 415 205 391 181 359 C136 303 79 261 75 168 Z" />
        `,
      },
      {
        name: 'bun',
        color: 'violet',
        box: { left: 520, top: 120, width: 205, height: 168 },
        maskSvg: `
          <path d="M29 69 C30 33 66 8 104 13 C131 -7 170 5 186 34
          C201 63 195 100 172 123 C153 142 126 151 105 149
          C87 153 56 146 39 122 C18 101 12 85 29 69 Z" />
        `,
      },
      {
        name: 'hair_front',
        color: 'blue',
        box: { left: 448, top: 182, width: 350, height: 335 },
        maskSvg: `
          <path d="M55 96 C75 21 131 0 177 0 C226 0 288 24 311 97
          L291 172 C274 158 256 132 247 109 C209 85 153 84 111 108
          C98 133 82 158 59 177 L55 96 Z" />
          <path d="M34 115 C12 152 10 221 54 282 L90 282 C62 230 55 173 75 121 Z" />
          <path d="M315 115 C338 151 341 221 296 282 L261 282 C289 230 296 173 276 121 Z" />
        `,
      },
      {
        name: 'bangs_center',
        color: 'blue',
        box: { left: 506, top: 245, width: 226, height: 122 },
        maskSvg: `
          <path d="M18 22 C42 3 76 0 113 0 C150 0 183 4 208 22
          C204 39 196 54 185 67 C174 61 164 48 156 33
          C149 48 145 69 141 98 C137 112 124 121 113 121
          C102 121 89 112 85 98 C81 69 77 48 70 33
          C62 48 52 61 41 67 C29 54 22 39 18 22 Z" />
          <path d="M98 100 C101 116 92 121 82 116 C72 109 73 96 80 89 C87 83 95 87 98 100 Z" />
          <path d="M128 100 C131 116 140 121 150 116 C160 109 159 96 152 89 C145 83 131 87 128 100 Z" />
        `,
      },
      {
        name: 'side_hair_left',
        color: 'blue',
        box: { left: 450, top: 352, width: 98, height: 214 },
        maskSvg: `
          <path d="M56 8 C37 32 26 65 28 104 C30 147 42 182 64 206
          C47 209 28 202 15 185 C2 160 0 121 3 81 C7 43 21 17 56 8 Z" />
        `,
      },
      {
        name: 'side_hair_right',
        color: 'blue',
        box: { left: 701, top: 352, width: 98, height: 214 },
        maskSvg: `
          <path d="M42 8 C61 32 72 65 70 104 C68 147 56 182 34 206
          C51 209 70 202 83 185 C96 160 98 121 95 81 C91 43 77 17 42 8 Z" />
        `,
      },
    ],
  },
  {
    name: 'Face',
    children: [
      {
        name: 'face_base',
        color: 'yellow',
        box: { left: 467, top: 242, width: 314, height: 352 },
        maskSvg: `
          <ellipse cx="157" cy="146" rx="122" ry="119" />
          <circle cx="39" cy="147" r="34" />
          <circle cx="275" cy="147" r="34" />
          <rect x="109" y="223" width="95" height="95" rx="24" />
        `,
      },
      {
        name: 'eye_left_open',
        color: 'green',
        box: { left: 476, top: 398, width: 118, height: 102 },
        maskSvg: `
          <path d="M6 48 C16 18 44 4 72 5 C99 5 113 23 112 49
          C107 76 94 94 72 97 C46 99 21 82 6 48 Z" />
        `,
      },
      {
        name: 'eye_right_open',
        color: 'green',
        box: { left: 644, top: 398, width: 118, height: 102 },
        maskSvg: `
          <path d="M6 48 C16 18 44 4 72 5 C99 5 113 23 112 49
          C107 76 94 94 72 97 C46 99 21 82 6 48 Z" />
        `,
      },
      {
        name: 'eye_left_blink',
        color: 'green',
        box: { left: 476, top: 398, width: 118, height: 102 },
        variantOf: 'eye_left_open',
        variant: 'blink',
      },
      {
        name: 'eye_right_blink',
        color: 'green',
        box: { left: 644, top: 398, width: 118, height: 102 },
        variantOf: 'eye_right_open',
        variant: 'blink',
      },
      {
        name: 'eye_left_smile',
        color: 'green',
        box: { left: 476, top: 398, width: 118, height: 102 },
        variantOf: 'eye_left_open',
        variant: 'eye_smile',
      },
      {
        name: 'eye_right_smile',
        color: 'green',
        box: { left: 644, top: 398, width: 118, height: 102 },
        variantOf: 'eye_right_open',
        variant: 'eye_smile',
      },
      {
        name: 'brow_left',
        color: 'green',
        box: { left: 519, top: 305, width: 92, height: 42 },
      },
      {
        name: 'brow_right',
        color: 'green',
        box: { left: 639, top: 305, width: 92, height: 42 },
      },
      {
        name: 'blush_left',
        color: 'red',
        box: { left: 509, top: 414, width: 74, height: 58 },
      },
      {
        name: 'blush_right',
        color: 'red',
        box: { left: 665, top: 414, width: 74, height: 58 },
      },
      {
        name: 'mouth_open',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variant: 'mouth_open',
      },
      {
        name: 'mouth_smile',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variantOf: 'mouth_open',
        variant: 'mouth_smile',
      },
      {
        name: 'mouth_closed',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variantOf: 'mouth_open',
        variant: 'mouth_closed',
      },
      {
        name: 'mouth_o',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variantOf: 'mouth_open',
        variant: 'mouth_o',
      },
      {
        name: 'mouth_small',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variantOf: 'mouth_open',
        variant: 'mouth_small',
      },
      {
        name: 'mouth_flat',
        color: 'red',
        box: { left: 584, top: 487, width: 110, height: 92 },
        variantOf: 'mouth_open',
        variant: 'mouth_flat',
      },
    ],
  },
  {
    name: 'Body',
    children: [
      {
        name: 'collar',
        color: 'yellow',
        box: { left: 530, top: 519, width: 190, height: 112 },
        maskSvg: `
          <path d="M32 8 C57 -2 130 -2 157 8 L183 60 C160 66 134 73 95 73
          C56 73 30 66 7 60 Z" />
        `,
      },
      {
        name: 'bow_left',
        color: 'orange',
        box: { left: 541, top: 552, width: 72, height: 75 },
      },
      {
        name: 'bow_center',
        color: 'orange',
        box: { left: 595, top: 552, width: 63, height: 82 },
      },
      {
        name: 'bow_right',
        color: 'orange',
        box: { left: 640, top: 552, width: 72, height: 75 },
      },
      {
        name: 'torso_top',
        color: 'blue',
        box: { left: 469, top: 523, width: 318, height: 232 },
        maskSvg: `
          <path d="M84 18 C111 5 209 5 237 18 L258 143 C227 176 91 176 60 143 Z" />
        `,
      },
      {
        name: 'skirt',
        color: 'blue',
        box: { left: 474, top: 673, width: 307, height: 215 },
        maskSvg: `
          <path d="M38 7 C92 37 214 37 269 7 L294 199 C249 215 56 215 12 199 Z" />
        `,
      },
      {
        name: 'button_left',
        color: 'yellow',
        box: { left: 543, top: 622, width: 42, height: 42 },
      },
      {
        name: 'button_right',
        color: 'yellow',
        box: { left: 672, top: 622, width: 42, height: 42 },
      },
    ],
  },
  {
    name: 'Arms',
    children: [
      {
        name: 'arm_left',
        color: 'green',
        box: { left: 419, top: 515, width: 154, height: 351 },
        maskSvg: `
          <path d="M88 30 C57 60 31 112 27 166 C22 233 47 299 95 337
          L136 337 C91 291 70 228 74 165 C76 121 90 79 120 38 Z" />
        `,
      },
      {
        name: 'hand_left',
        color: 'green',
        box: { left: 423, top: 735, width: 122, height: 120 },
        maskSvg: `
          <ellipse cx="60" cy="57" rx="46" ry="41" />
        `,
      },
      {
        name: 'arm_right',
        color: 'green',
        box: { left: 677, top: 515, width: 154, height: 351 },
        maskSvg: `
          <path d="M66 38 C95 79 108 121 110 165 C114 228 92 291 47 337
          L89 337 C137 299 160 233 154 166 C151 112 124 61 93 30 Z" />
        `,
      },
      {
        name: 'hand_right',
        color: 'green',
        box: { left: 707, top: 735, width: 122, height: 120 },
        maskSvg: `
          <ellipse cx="62" cy="57" rx="46" ry="41" />
        `,
      },
    ],
  },
  {
    name: 'Legs',
    children: [
      {
        name: 'leg_left',
        color: 'none',
        box: { left: 505, top: 838, width: 149, height: 188 },
        maskSvg: `
          <path d="M47 7 C94 4 121 33 120 89 C120 128 112 153 112 183
          L12 183 C12 148 26 125 27 91 C28 41 19 13 47 7 Z" />
        `,
      },
      {
        name: 'shoe_left',
        color: 'none',
        box: { left: 503, top: 957, width: 125, height: 72 },
      },
      {
        name: 'leg_right',
        color: 'none',
        box: { left: 606, top: 838, width: 149, height: 188 },
        maskSvg: `
          <path d="M100 7 C53 4 26 33 27 89 C27 128 35 153 35 183
          L137 183 C137 148 123 125 121 91 C120 41 129 13 100 7 Z" />
        `,
      },
      {
        name: 'shoe_right',
        color: 'none',
        box: { left: 627, top: 957, width: 125, height: 72 },
      },
    ],
  },
];

function flattenLeaves(nodes, groupPath = []) {
  const leaves = [];
  for (const node of nodes) {
    if (node.children) {
      leaves.push(...flattenLeaves(node.children, [...groupPath, node.name]));
    } else {
      leaves.push({ ...node, groupPath });
    }
  }
  return leaves;
}

function maskBuffer(width, height, svgMarkup) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="black"/>
      <g fill="white">${svgMarkup}</g>
    </svg>`,
  );
}

function faceBaseCleanupSvg(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <radialGradient id="mouthCover" cx="50%" cy="48%" r="70%">
          <stop offset="0%" stop-color="#ffd8b8" stop-opacity="0.96"/>
          <stop offset="72%" stop-color="#f6c9a3" stop-opacity="0.93"/>
          <stop offset="100%" stop-color="#efbe96" stop-opacity="0.88"/>
        </radialGradient>
      </defs>
      <ellipse cx="157" cy="230" rx="76" ry="48" fill="url(#mouthCover)" />
      <ellipse cx="157" cy="217" rx="56" ry="25" fill="#fad1b0" opacity="0.9" />
    </svg>`,
  );
}

async function extractLayer(source, layer) {
  let image = source.clone().extract(layer.box);
  if (layer.maskSvg) {
    image = image.composite([{ input: maskBuffer(layer.box.width, layer.box.height, layer.maskSvg), blend: 'dest-in' }]);
  }
  if (layer.name === 'face_base') {
    image = image.composite([{ input: faceBaseCleanupSvg(layer.box.width, layer.box.height), left: 0, top: 0 }]);
  }
  const png = await image.png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    png,
    imageData: {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data),
    },
  };
}

async function variantFromBase(basePng, layer) {
  const { width, height } = layer.box;
  const blank = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  if (layer.variant === 'mouth_open') {
    const openSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <path d="M8 26 C19 7 40 1 55 1 C69 1 90 7 102 26
        C99 55 81 84 55 89 C28 84 11 56 8 26 Z" fill="#5b191f"/>
        <path d="M18 35 C28 22 43 17 55 17 C67 17 82 22 93 35
        C87 62 73 78 55 81 C35 78 22 63 18 35 Z" fill="#f28878"/>
      </svg>`,
    );
    const png = await blank
      .composite([{ input: openSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'blink') {
    const squashed = await sharp(basePng).resize({ width, height: 22, fit: 'fill' }).png().toBuffer();
    const y = Math.round(height * 0.48);
    const png = await blank
      .composite([{ input: squashed, left: 0, top: y }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'eye_smile') {
    const smileSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <path d="M16 50 C26 35 44 30 63 33 C74 35 82 40 86 48" fill="none" stroke="#2d201f" stroke-width="8" stroke-linecap="round"/>
        <path d="M20 54 C33 67 69 69 82 54" fill="none" stroke="#2d201f" stroke-width="5" stroke-linecap="round" opacity="0.45"/>
      </svg>`,
    );
    const png = await blank
      .composite([{ input: smileSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'mouth_smile') {
    const squashed = await sharp(basePng).resize({ width: 78, height: 32, fit: 'fill' }).png().toBuffer();
    const png = await blank
      .composite([{ input: squashed, left: 10, top: 28 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'mouth_closed') {
    const lineSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <path d="M24 46 C35 56 62 56 74 46" fill="none" stroke="#8f4c50" stroke-width="6" stroke-linecap="round"/>
      </svg>`,
    );
    const png = await blank
      .composite([{ input: lineSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'mouth_o') {
    const oSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <ellipse cx="49" cy="48" rx="19" ry="23" fill="#b46868"/>
        <ellipse cx="49" cy="48" rx="12" ry="15" fill="#80424a"/>
      </svg>`,
    );
    const png = await blank
      .composite([{ input: oSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'mouth_small') {
    const squashed = await sharp(basePng).resize({ width: 54, height: 28, fit: 'fill' }).png().toBuffer();
    const png = await blank
      .composite([{ input: squashed, left: 22, top: 34 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  if (layer.variant === 'mouth_flat') {
    const flatSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <path d="M27 49 C39 52 60 52 72 49" fill="none" stroke="#8f4c50" stroke-width="6" stroke-linecap="round"/>
      </svg>`,
    );
    const png = await blank
      .composite([{ input: flatSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      png,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
    };
  }

  throw new Error(`Unknown variant: ${layer.variant}`);
}

async function compositePreview(parts) {
  return sharp({
    create: {
      width: docWidth,
      height: docHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(parts.map((part) => ({ input: part.png, left: part.left, top: part.top })))
    .png()
    .toBuffer();
}

function isPreviewBaseLayer(part) {
  return !part.variantOf;
}

function makeLive2DBindingProfile() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    defaults: {
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamMouthOpenY: 0.35,
      ParamMouthForm: 0.65,
    },
    parameters: [
      {
        id: 'ParamEyeLOpen',
        label: 'Left Eye Open',
        min: 0,
        max: 1,
        default: 1,
        targets: [
          { value: 0, layer: 'eye_left_blink', opacity: 1 },
          { value: 1, layer: 'eye_left_open', opacity: 1 },
        ],
      },
      {
        id: 'ParamEyeROpen',
        label: 'Right Eye Open',
        min: 0,
        max: 1,
        default: 1,
        targets: [
          { value: 0, layer: 'eye_right_blink', opacity: 1 },
          { value: 1, layer: 'eye_right_open', opacity: 1 },
        ],
      },
      {
        id: 'ParamEyeLSmile',
        label: 'Left Eye Smile',
        min: 0,
        max: 1,
        default: 0,
        targets: [{ value: 1, layer: 'eye_left_smile', opacity: 1 }],
      },
      {
        id: 'ParamEyeRSmile',
        label: 'Right Eye Smile',
        min: 0,
        max: 1,
        default: 0,
        targets: [{ value: 1, layer: 'eye_right_smile', opacity: 1 }],
      },
      {
        id: 'ParamMouthOpenY',
        label: 'Mouth Open Y',
        min: 0,
        max: 1,
        default: 0.35,
        targets: [
          { value: 0, layer: 'mouth_closed', opacity: 1 },
          { value: 0.2, layer: 'mouth_flat', opacity: 1 },
          { value: 0.35, layer: 'mouth_small', opacity: 1 },
          { value: 0.65, layer: 'mouth_smile', opacity: 1 },
          { value: 0.8, layer: 'mouth_open', opacity: 1 },
          { value: 1, layer: 'mouth_o', opacity: 1 },
        ],
      },
      {
        id: 'ParamMouthForm',
        label: 'Mouth Form',
        min: -1,
        max: 1,
        default: 0.65,
        targets: [
          { value: -1, layer: 'mouth_flat', opacity: 1 },
          { value: -0.2, layer: 'mouth_small', opacity: 1 },
          { value: 0.3, layer: 'mouth_open', opacity: 1 },
          { value: 0.65, layer: 'mouth_smile', opacity: 1 },
          { value: 1, layer: 'mouth_o', opacity: 1 },
        ],
      },
    ],
    expressions: [
      {
        id: 'neutral',
        label: 'Neutral',
        values: {
          ParamEyeLOpen: 1,
          ParamEyeROpen: 1,
          ParamEyeLSmile: 0,
          ParamEyeRSmile: 0,
          ParamMouthOpenY: 0.35,
          ParamMouthForm: 0.65,
        },
      },
      {
        id: 'blink',
        label: 'Blink',
        values: {
          ParamEyeLOpen: 0,
          ParamEyeROpen: 0,
          ParamEyeLSmile: 0,
          ParamEyeRSmile: 0,
          ParamMouthOpenY: 0.2,
          ParamMouthForm: -0.2,
        },
      },
      {
        id: 'happy',
        label: 'Happy',
        values: {
          ParamEyeLOpen: 0.2,
          ParamEyeROpen: 0.2,
          ParamEyeLSmile: 1,
          ParamEyeRSmile: 1,
          ParamMouthOpenY: 0.65,
          ParamMouthForm: 0.8,
        },
      },
      {
        id: 'talk_small',
        label: 'Talk Small',
        values: {
          ParamEyeLOpen: 1,
          ParamEyeROpen: 1,
          ParamEyeLSmile: 0,
          ParamEyeRSmile: 0,
          ParamMouthOpenY: 0.35,
          ParamMouthForm: -0.1,
        },
      },
      {
        id: 'talk_round',
        label: 'Talk Round',
        values: {
          ParamEyeLOpen: 1,
          ParamEyeROpen: 1,
          ParamEyeLSmile: 0,
          ParamEyeRSmile: 0,
          ParamMouthOpenY: 1,
          ParamMouthForm: 1,
        },
      },
      {
        id: 'talk_flat',
        label: 'Talk Flat',
        values: {
          ParamEyeLOpen: 1,
          ParamEyeROpen: 1,
          ParamEyeLSmile: 0,
          ParamEyeRSmile: 0,
          ParamMouthOpenY: 0.1,
          ParamMouthForm: -1,
        },
      },
    ],
  };
}

function makeCubismSetupPlan() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    phases: [
      {
        id: 'import',
        label: 'Import PSD',
        tasks: [
          'Import yoyo-live2d-rig-v4.psd into Cubism.',
          'Preserve original draw order from the PSD groups Head, Face, Body, Arms, Legs.',
          'Keep variant layers hidden at import and enable them through parameters later.',
        ],
      },
      {
        id: 'face',
        label: 'Face Setup',
        tasks: [
          'Create facial ArtMeshes from face_base, brows, blush, eyes, and mouth variants.',
          'Bind eyes to ParamEyeLOpen, ParamEyeROpen, ParamEyeLSmile, and ParamEyeRSmile.',
          'Bind mouth variants to ParamMouthOpenY and ParamMouthForm using opacity swaps first.',
        ],
      },
      {
        id: 'body',
        label: 'Body Deformers',
        tasks: [
          'Build deformer roots for torso, head, arms, and skirt before any large rotation experiments.',
          'Keep bun and side hair under head-related deformers, but separate skirt motion from torso rotation.',
          'Use conservative rotations until hidden paint areas are hand-cleaned.',
        ],
      },
      {
        id: 'motion',
        label: 'Starter Motions',
        tasks: [
          'Author idle first with tiny breathing and hair sway.',
          'Add blink, then happy idle, then a simple talk loop.',
          'Delay big gestures until face and sleeve cleanup are polished.',
        ],
      },
    ],
    expressionPresetOrder: ['neutral', 'blink', 'happy', 'talk_small', 'talk_round', 'talk_flat'],
    motionStarterSet: ['idle', 'blink', 'happy_idle', 'talk_loop'],
    deformerStack: {
      head: ['HeadAngleXY', 'HeadTurnZ', 'HairSway', 'FaceParts'],
      torso: ['BodyAngleXY', 'Breath', 'DressFollow'],
      arms: ['ShoulderRoot', 'ArmL', 'ArmR', 'HandFollow'],
      skirt: ['SkirtRoot', 'SkirtSwing'],
    },
    drawOrderHints: [
      'hair_back before face_base',
      'face_base before brows and eyes',
      'torso_top before bow pieces',
      'skirt after torso_top',
      'hands above sleeves only if overlap cleanup is verified',
    ],
  };
}

function makeCubismParameterSheet() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    parameters: [
      {
        id: 'ParamEyeLOpen',
        label: 'Left Eye Open',
        default: 1,
        recommendedLayers: ['eye_left_blink', 'eye_left_open'],
        notes: 'Use opacity swapping first, then replace with deformer-based eyelid motion if needed.',
      },
      {
        id: 'ParamEyeROpen',
        label: 'Right Eye Open',
        default: 1,
        recommendedLayers: ['eye_right_blink', 'eye_right_open'],
        notes: 'Mirror the left eye setup to keep timing and range consistent.',
      },
      {
        id: 'ParamEyeLSmile',
        label: 'Left Eye Smile',
        default: 0,
        recommendedLayers: ['eye_left_smile'],
        notes: 'Blend in only after eye-open state is stable.',
      },
      {
        id: 'ParamEyeRSmile',
        label: 'Right Eye Smile',
        default: 0,
        recommendedLayers: ['eye_right_smile'],
        notes: 'Keep synchronized with ParamEyeLSmile unless asymmetry is intentional.',
      },
      {
        id: 'ParamMouthOpenY',
        label: 'Mouth Open Y',
        default: 0.35,
        recommendedLayers: ['mouth_closed', 'mouth_flat', 'mouth_small', 'mouth_smile', 'mouth_open', 'mouth_o'],
        notes: 'Treat this as the primary talk amplitude control.',
      },
      {
        id: 'ParamMouthForm',
        label: 'Mouth Form',
        default: 0.65,
        recommendedLayers: ['mouth_flat', 'mouth_small', 'mouth_open', 'mouth_smile', 'mouth_o'],
        notes: 'Use this for smile-vs-round shape bias while ParamMouthOpenY handles vertical openness.',
      },
    ],
  };
}

function makeCubismImportChecklist() {
  return [
    '# Yoyo Cubism Import Checklist',
    '',
    '1. Import PSD and preserve draw order.',
    '2. Hide all expression variant layers and keep only default-state art visible.',
    '3. Create the initial face parameter set from live2d-binding-profile.json.',
    '4. Build head, torso, arm, and skirt deformers in the order described by cubism-setup-plan.json.',
    '5. Verify mouth and eye opacity swaps before attempting mesh-heavy deformations.',
    '6. Build starter motions: idle, blink, happy_idle, talk_loop.',
    '',
    'Use cubism-setup-plan.json for phase sequencing and live2d-binding-profile.json for the parameter/value mapping.',
  ].join('\n');
}

function makeCubismMotionSpec() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    motions: [
      {
        id: 'idle',
        durationMs: 3200,
        loop: true,
        description: 'Small breathing loop with gentle head settle and almost-closed resting mouth.',
        parameters: [
          { id: 'ParamBodyAngleY', range: [-4, 4], cadence: 'sine-slow' },
          { id: 'ParamHeadAngleZ', range: [-2, 2], cadence: 'sine-offset' },
          { id: 'ParamHairSway', range: [-6, 6], cadence: 'lagged-follow' },
          { id: 'ParamMouthOpenY', range: [0.18, 0.32], cadence: 'resting-breath' },
        ],
      },
      {
        id: 'blink',
        durationMs: 180,
        loop: false,
        description: 'Quick neutral blink with no smile bias.',
        parameters: [
          { id: 'ParamEyeLOpen', range: [1, 0, 1], cadence: 'ease-in-out' },
          { id: 'ParamEyeROpen', range: [1, 0, 1], cadence: 'ease-in-out' },
        ],
      },
      {
        id: 'happy_idle',
        durationMs: 2800,
        loop: true,
        description: 'Smile-eye idle with warm talk-ready mouth and soft torso float.',
        parameters: [
          { id: 'ParamEyeLSmile', range: [0.7, 1], cadence: 'hold-soft' },
          { id: 'ParamEyeRSmile', range: [0.7, 1], cadence: 'hold-soft' },
          { id: 'ParamMouthForm', range: [0.65, 0.85], cadence: 'gentle-pulse' },
          { id: 'ParamBodyAngleY', range: [-3, 3], cadence: 'sine-slow' },
        ],
      },
      {
        id: 'talk_loop',
        durationMs: 1400,
        loop: true,
        description: 'Simple speech loop alternating compact and round mouth shapes.',
        parameters: [
          { id: 'ParamMouthOpenY', range: [0.2, 1], cadence: 'speech-cycle' },
          { id: 'ParamMouthForm', range: [-0.1, 1], cadence: 'shape-shift' },
          { id: 'ParamHeadAngleZ', range: [-1.5, 1.5], cadence: 'micro-bob' },
        ],
      },
    ],
  };
}

function makeCubismExpressionVisibilityMap() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    states: [
      {
        id: 'neutral',
        visibleLayers: ['eye_left_open', 'eye_right_open', 'mouth_small'],
        hiddenLayers: ['eye_left_blink', 'eye_right_blink', 'eye_left_smile', 'eye_right_smile', 'mouth_closed', 'mouth_flat', 'mouth_open', 'mouth_smile', 'mouth_o'],
      },
      {
        id: 'blink',
        visibleLayers: ['eye_left_blink', 'eye_right_blink', 'mouth_closed'],
        hiddenLayers: ['eye_left_open', 'eye_right_open', 'eye_left_smile', 'eye_right_smile', 'mouth_flat', 'mouth_small', 'mouth_open', 'mouth_smile', 'mouth_o'],
      },
      {
        id: 'happy',
        visibleLayers: ['eye_left_smile', 'eye_right_smile', 'mouth_smile'],
        hiddenLayers: ['eye_left_open', 'eye_right_open', 'eye_left_blink', 'eye_right_blink', 'mouth_closed', 'mouth_flat', 'mouth_small', 'mouth_open', 'mouth_o'],
      },
      {
        id: 'talk_small',
        visibleLayers: ['eye_left_open', 'eye_right_open', 'mouth_small'],
        hiddenLayers: ['eye_left_blink', 'eye_right_blink', 'eye_left_smile', 'eye_right_smile', 'mouth_closed', 'mouth_flat', 'mouth_open', 'mouth_smile', 'mouth_o'],
      },
      {
        id: 'talk_round',
        visibleLayers: ['eye_left_open', 'eye_right_open', 'mouth_o'],
        hiddenLayers: ['eye_left_blink', 'eye_right_blink', 'eye_left_smile', 'eye_right_smile', 'mouth_closed', 'mouth_flat', 'mouth_small', 'mouth_open', 'mouth_smile'],
      },
      {
        id: 'talk_flat',
        visibleLayers: ['eye_left_open', 'eye_right_open', 'mouth_flat'],
        hiddenLayers: ['eye_left_blink', 'eye_right_blink', 'eye_left_smile', 'eye_right_smile', 'mouth_closed', 'mouth_small', 'mouth_open', 'mouth_smile', 'mouth_o'],
      },
    ],
  };
}

function makeCubismMotionTimelineDraft() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    timelines: [
      {
        id: 'idle',
        durationMs: 3200,
        loop: true,
        segments: [
          { startMs: 0, endMs: 800, label: 'inhale', expression: 'neutral', parameters: ['ParamBodyAngleY', 'ParamMouthOpenY'] },
          { startMs: 800, endMs: 1600, label: 'settle_left', expression: 'neutral', parameters: ['ParamHeadAngleZ', 'ParamHairSway'] },
          { startMs: 1600, endMs: 2400, label: 'exhale', expression: 'neutral', parameters: ['ParamBodyAngleY', 'ParamMouthOpenY'] },
          { startMs: 2400, endMs: 3200, label: 'settle_right', expression: 'neutral', parameters: ['ParamHeadAngleZ', 'ParamHairSway'] },
        ],
      },
      {
        id: 'blink',
        durationMs: 180,
        loop: false,
        segments: [
          { startMs: 0, endMs: 60, label: 'close', expression: 'blink', parameters: ['ParamEyeLOpen', 'ParamEyeROpen'] },
          { startMs: 60, endMs: 90, label: 'hold', expression: 'blink', parameters: ['ParamEyeLOpen', 'ParamEyeROpen'] },
          { startMs: 90, endMs: 180, label: 'open', expression: 'neutral', parameters: ['ParamEyeLOpen', 'ParamEyeROpen'] },
        ],
      },
      {
        id: 'happy_idle',
        durationMs: 2800,
        loop: true,
        segments: [
          { startMs: 0, endMs: 700, label: 'smile_settle', expression: 'happy', parameters: ['ParamEyeLSmile', 'ParamEyeRSmile', 'ParamMouthForm'] },
          { startMs: 700, endMs: 1400, label: 'body_float_left', expression: 'happy', parameters: ['ParamBodyAngleY'] },
          { startMs: 1400, endMs: 2100, label: 'smile_breath', expression: 'happy', parameters: ['ParamMouthForm', 'ParamMouthOpenY'] },
          { startMs: 2100, endMs: 2800, label: 'body_float_right', expression: 'happy', parameters: ['ParamBodyAngleY'] },
        ],
      },
      {
        id: 'talk_loop',
        durationMs: 1400,
        loop: true,
        segments: [
          { startMs: 0, endMs: 300, label: 'syllable_a', expression: 'talk_small', parameters: ['ParamMouthOpenY', 'ParamMouthForm'] },
          { startMs: 300, endMs: 650, label: 'syllable_o', expression: 'talk_round', parameters: ['ParamMouthOpenY', 'ParamMouthForm'] },
          { startMs: 650, endMs: 950, label: 'syllable_e', expression: 'talk_flat', parameters: ['ParamMouthOpenY', 'ParamMouthForm'] },
          { startMs: 950, endMs: 1400, label: 'return_round', expression: 'talk_round', parameters: ['ParamMouthOpenY', 'ParamMouthForm', 'ParamHeadAngleZ'] },
        ],
      },
    ],
  };
}

function makeCubismAnimationPacket() {
  return {
    version: 1,
    rigPackVersion: 4,
    modelName: 'YoyoRigV4',
    animations: [
      {
        id: 'idle',
        durationMs: 3200,
        loop: true,
        keyframes: [
          { timeMs: 0, expression: 'neutral', ParamBodyAngleY: -2, ParamHeadAngleZ: 0, ParamHairSway: -3, ParamMouthOpenY: 0.2 },
          { timeMs: 800, expression: 'neutral', ParamBodyAngleY: 4, ParamHeadAngleZ: -1.4, ParamHairSway: -6, ParamMouthOpenY: 0.32 },
          { timeMs: 1600, expression: 'neutral', ParamBodyAngleY: -1, ParamHeadAngleZ: 1.2, ParamHairSway: 2, ParamMouthOpenY: 0.18 },
          { timeMs: 2400, expression: 'neutral', ParamBodyAngleY: 3, ParamHeadAngleZ: 1.8, ParamHairSway: 6, ParamMouthOpenY: 0.28 },
          { timeMs: 3200, expression: 'neutral', ParamBodyAngleY: -2, ParamHeadAngleZ: 0, ParamHairSway: -3, ParamMouthOpenY: 0.2 },
        ],
      },
      {
        id: 'blink',
        durationMs: 180,
        loop: false,
        keyframes: [
          { timeMs: 0, expression: 'neutral', ParamEyeLOpen: 1, ParamEyeROpen: 1 },
          { timeMs: 60, expression: 'blink', ParamEyeLOpen: 0, ParamEyeROpen: 0 },
          { timeMs: 90, expression: 'blink', ParamEyeLOpen: 0, ParamEyeROpen: 0 },
          { timeMs: 180, expression: 'neutral', ParamEyeLOpen: 1, ParamEyeROpen: 1 },
        ],
      },
      {
        id: 'happy_idle',
        durationMs: 2800,
        loop: true,
        keyframes: [
          { timeMs: 0, expression: 'happy', ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7, ParamMouthForm: 0.68, ParamBodyAngleY: -1 },
          { timeMs: 700, expression: 'happy', ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamMouthForm: 0.82, ParamBodyAngleY: 3 },
          { timeMs: 1400, expression: 'happy', ParamEyeLSmile: 0.85, ParamEyeRSmile: 0.85, ParamMouthForm: 0.72, ParamBodyAngleY: 0 },
          { timeMs: 2100, expression: 'happy', ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamMouthForm: 0.8, ParamBodyAngleY: -3 },
          { timeMs: 2800, expression: 'happy', ParamEyeLSmile: 0.7, ParamEyeRSmile: 0.7, ParamMouthForm: 0.68, ParamBodyAngleY: -1 },
        ],
      },
      {
        id: 'talk_loop',
        durationMs: 1400,
        loop: true,
        keyframes: [
          { timeMs: 0, expression: 'talk_small', ParamMouthOpenY: 0.35, ParamMouthForm: -0.1, ParamHeadAngleZ: 0 },
          { timeMs: 300, expression: 'talk_round', ParamMouthOpenY: 1, ParamMouthForm: 1, ParamHeadAngleZ: 0.8 },
          { timeMs: 650, expression: 'talk_flat', ParamMouthOpenY: 0.2, ParamMouthForm: -1, ParamHeadAngleZ: -0.6 },
          { timeMs: 950, expression: 'talk_round', ParamMouthOpenY: 0.85, ParamMouthForm: 0.9, ParamHeadAngleZ: 1.2 },
          { timeMs: 1400, expression: 'talk_small', ParamMouthOpenY: 0.35, ParamMouthForm: -0.1, ParamHeadAngleZ: 0 },
        ],
      },
    ],
  };
}

function makeCubismEditorPasteSheet() {
  const packet = makeCubismAnimationPacket();
  const lines = ['# Cubism Editor Paste Sheet', ''];

  for (const animation of packet.animations) {
    const columns = Object.keys(animation.keyframes[0]);
    lines.push(`## ${animation.id}`);
    lines.push('');
    lines.push(`Duration: ${animation.durationMs}ms | Loop: ${animation.loop ? 'yes' : 'no'}`);
    lines.push('');
    lines.push(`| ${columns.join(' | ')} |`);
    lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
    for (const row of animation.keyframes) {
      lines.push(`| ${columns.map((column) => row[column]).join(' | ')} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function makeCubismPreviewRunnerHtml(manifest) {
  const animationPacket = makeCubismAnimationPacket();
  const visibilityMap = makeCubismExpressionVisibilityMap();
  const documentSize = manifest.document;
  const layerLayout = Object.fromEntries(
    manifest.layers.map((layer) => [
      layer.file,
      {
        left: layer.left,
        top: layer.top,
        width: layer.width,
        height: layer.height,
      },
    ]),
  );
  const buttonMarkup = animationPacket.animations
    .map((animation) => `        <button data-animation="${animation.id}">Play ${animation.id}</button>`)
    .join('\n');
  const previewLayers = {
    static: [
      'head-hair_back.png',
      'head-bun.png',
      'face-face_base.png',
      'head-hair_front.png',
      'head-bangs_center.png',
      'head-side_hair_left.png',
      'head-side_hair_right.png',
      'body-collar.png',
      'body-torso_top.png',
      'body-bow_left.png',
      'body-bow_center.png',
      'body-bow_right.png',
      'body-button_left.png',
      'body-button_right.png',
      'arms-arm_left.png',
      'arms-arm_right.png',
      'arms-hand_left.png',
      'arms-hand_right.png',
      'body-skirt.png',
      'legs-leg_left.png',
      'legs-leg_right.png',
      'legs-shoe_left.png',
      'legs-shoe_right.png',
      'face-brow_left.png',
      'face-brow_right.png',
      'face-blush_left.png',
      'face-blush_right.png',
    ],
    dynamic: [
      'face-eye_left_open.png',
      'face-eye_right_open.png',
      'face-eye_left_blink.png',
      'face-eye_right_blink.png',
      'face-eye_left_smile.png',
      'face-eye_right_smile.png',
      'face-mouth_closed.png',
      'face-mouth_flat.png',
      'face-mouth_small.png',
      'face-mouth_open.png',
      'face-mouth_smile.png',
      'face-mouth_o.png',
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yoyo Cubism Preview Runner</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      background: #17181d;
      color: #f4efe8;
      display: grid;
      place-items: center;
      min-height: 100vh;
    }
    .shell {
      width: min(960px, calc(100vw - 32px));
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 20px;
      align-items: start;
    }
    .stage {
      background: linear-gradient(180deg, #2b2f3b 0%, #21242d 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      display: grid;
      place-items: center;
      min-height: 720px;
    }
    .character {
      position: relative;
      width: min(78vw, 720px);
      aspect-ratio: 1;
      transform: scale(0.92);
      transform-origin: center;
    }
    .character img {
      position: absolute;
      image-rendering: auto;
      pointer-events: none;
      transform-origin: center center;
    }
    .panel {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    button {
      background: #2f7ee6;
      color: white;
      border: 0;
      border-radius: 10px;
      padding: 10px 12px;
      font: inherit;
      cursor: pointer;
    }
    button[data-animation="reset"] { background: #485064; }
    .state {
      font-size: 14px;
      color: #c6d0e1;
      line-height: 1.5;
      white-space: pre-line;
    }
    .hint {
      font-size: 12px;
      color: #92a0b9;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="stage">
      <div class="character" id="character"></div>
    </div>
    <div class="panel">
      <strong>Preview Runner</strong>
      <div class="buttons">
${buttonMarkup}
        <button data-animation="reset">Reset</button>
      </div>
      <div class="state" id="state">Loading…</div>
      <div class="hint">This runner previews layer visibility and simple motion rhythm from the generated animation packet. It is a staging aid, not a full Cubism runtime.</div>
    </div>
  </div>
  <script>
    const animationPacket = ${JSON.stringify(animationPacket)};
    const visibilityMap = ${JSON.stringify(visibilityMap)};
    const previewLayers = ${JSON.stringify(previewLayers)};
    const documentSize = ${JSON.stringify(documentSize)};
    const layerLayout = ${JSON.stringify(layerLayout)};

    const character = document.getElementById('character');
    const stateNode = document.getElementById('state');
    const imageMap = new Map();

    const createLayer = (fileName) => {
      const layout = layerLayout[fileName];
      if (!layout) return;
      const img = document.createElement('img');
      img.src = fileName;
      img.alt = fileName;
      img.dataset.file = fileName;
      img.style.left = ((layout.left / documentSize.width) * 100) + '%';
      img.style.top = ((layout.top / documentSize.height) * 100) + '%';
      img.style.width = ((layout.width / documentSize.width) * 100) + '%';
      img.style.height = ((layout.height / documentSize.height) * 100) + '%';
      character.appendChild(img);
      imageMap.set(fileName, img);
    };

    [...previewLayers.static, ...previewLayers.dynamic].forEach(createLayer);

    const dynamicLayerFile = (layerName) => \`face-\${layerName}.png\`;
    const stateById = new Map(visibilityMap.states.map((state) => [state.id, state]));

    function applyExpression(expressionId) {
      const state = stateById.get(expressionId) || stateById.get('neutral');
      for (const fileName of previewLayers.dynamic) {
        const img = imageMap.get(fileName);
        img.style.opacity = '0';
      }
      for (const layerName of state.visibleLayers) {
        const img = imageMap.get(dynamicLayerFile(layerName));
        if (img) img.style.opacity = '1';
      }
      stateNode.textContent = \`Expression: \${expressionId}\`;
    }

    function applyPose(keyframe) {
      const bodyShift = (keyframe.ParamBodyAngleY || 0) * 1.8;
      const headRotate = (keyframe.ParamHeadAngleZ || 0) * 1.2;
      const swayShift = (keyframe.ParamHairSway || 0) * 0.5;
      character.style.transform = \`translateY(\${bodyShift}px) translateX(\${swayShift}px) scale(0.92) rotate(\${headRotate}deg)\`;
    }

    let timerIds = [];
    function clearTimers() {
      for (const id of timerIds) clearTimeout(id);
      timerIds = [];
    }

    function playAnimation(animationId) {
      clearTimers();
      const animation = animationPacket.animations.find((item) => item.id === animationId);
      if (!animation) return;
      stateNode.textContent = \`Animation: \${animation.id}\\nDuration: \${animation.durationMs}ms\`;
      for (const keyframe of animation.keyframes) {
        const timeoutId = setTimeout(() => {
          applyExpression(keyframe.expression);
          applyPose(keyframe);
          stateNode.textContent = \`Animation: \${animation.id}\\nExpression: \${keyframe.expression}\\nTime: \${keyframe.timeMs}ms\`;
        }, keyframe.timeMs);
        timerIds.push(timeoutId);
      }
      if (animation.loop) {
        const loopId = setTimeout(() => playAnimation(animationId), animation.durationMs + 40);
        timerIds.push(loopId);
      }
    }

    document.querySelectorAll('button[data-animation]').forEach((button) => {
      button.addEventListener('click', () => {
        const animationId = button.dataset.animation;
        if (animationId === 'reset') {
          clearTimers();
          character.style.transform = 'scale(0.92)';
          applyExpression('neutral');
          return;
        }
        playAnimation(animationId);
      });
    });

    applyExpression('neutral');
  </script>
</body>
</html>`;
}

function nestPsdChildren(nodes, partMap, idCounter) {
  return nodes.map((node) => {
    if (node.children) {
      return {
        id: idCounter.next++,
        name: node.name,
        children: nestPsdChildren(node.children, partMap, idCounter),
      };
    }
    const part = partMap.get(node.name);
    return {
      id: idCounter.next++,
      name: node.name,
      left: part.left,
      top: part.top,
      imageData: part.imageData,
      layerColor: node.color,
    };
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const source = sharp(sourcePath);
  const parts = [];
  const leaves = flattenLeaves(rigTree);
  const partMap = new Map();

  for (const layer of leaves) {
    const extracted = layer.variantOf
      ? await variantFromBase(partMap.get(layer.variantOf).png, layer)
      : layer.variant
        ? await variantFromBase(null, layer)
        : await extractLayer(source, layer);
    const fileName = `${layer.groupPath.join('-').toLowerCase()}-${layer.name}.png`;
    fs.writeFileSync(path.join(outDir, fileName), extracted.png);
    const part = {
      ...layer.box,
      name: layer.name,
      groupPath: layer.groupPath,
      color: layer.color,
      variantOf: layer.variantOf,
      variant: layer.variant,
      fileName,
      png: extracted.png,
      imageData: extracted.imageData,
    };
    parts.push(part);
    partMap.set(layer.name, part);
  }

  const previewBuffer = await compositePreview(parts.filter(isPreviewBaseLayer));
  fs.writeFileSync(path.join(outDir, 'preview-rig-composite.png'), previewBuffer);

  const psd = {
    width: docWidth,
    height: docHeight,
    children: nestPsdChildren(rigTree, partMap, { next: 1 }),
  };

  fs.writeFileSync(path.join(outDir, 'yoyo-live2d-rig-v4.psd'), writePsdBuffer(psd));

  const manifest = {
    version: 4,
    source: path.relative(repoRoot, sourcePath),
    document: { width: docWidth, height: docHeight },
    output: path.relative(repoRoot, outDir),
    groups: rigTree.map((group) => group.name),
    layers: parts.map(({ name, groupPath, fileName, left, top, width, height }) => ({
      name,
      group: groupPath[groupPath.length - 1],
      groupPath,
      file: fileName,
      left,
      top,
      width,
      height,
    })),
    notes: [
      'This v4 pack is identity-preserving and expands the facial set with blink, smile-eye, and broader mouth variants for Live2D-style facial setup.',
      'Layers still overlap on purpose so Live2D/Spine cleanup can paint hidden areas instead of reconstructing identity from scratch.',
      'Recommended next manual pass: paint cleaner eyelid shapes, polish eye-smile curves, and replace procedural mouth variants with hand-cleaned animation shapes.',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, 'live2d-binding-profile.json'),
    `${JSON.stringify(makeLive2DBindingProfile(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-setup-plan.json'),
    `${JSON.stringify(makeCubismSetupPlan(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-parameter-sheet.json'),
    `${JSON.stringify(makeCubismParameterSheet(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-import-checklist.md'),
    `${makeCubismImportChecklist()}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-motion-spec.json'),
    `${JSON.stringify(makeCubismMotionSpec(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-expression-visibility-map.json'),
    `${JSON.stringify(makeCubismExpressionVisibilityMap(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-motion-timeline-draft.json'),
    `${JSON.stringify(makeCubismMotionTimelineDraft(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-animation-packet.json'),
    `${JSON.stringify(makeCubismAnimationPacket(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-editor-paste-sheet.md'),
    `${makeCubismEditorPasteSheet()}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, 'cubism-preview-runner.html'),
    `${makeCubismPreviewRunnerHtml(manifest)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
