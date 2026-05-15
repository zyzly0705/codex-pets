/**
 * generate-outfit-spritesheets.js
 *
 * 直接产出可运行的“透明换装图层 spritesheet”。
 * 不在 App 内嵌设计器，也不在运行时用衣服 SVG 固定锚点硬贴；
 * 运行时只按当前动作帧裁切整张透明图层，保证每个动作行的锚点都已离线校准。
 *
 * 产物：
 * - assets/yoyo/spritesheet_clothes_hoodie.webp
 * - assets/yoyo/spritesheet_clothes_dress.webp
 * - assets/yoyo/spritesheet_clothes_cape.webp
 * - assets/yoyo/spritesheet_clothes_sweater.webp
 * - assets/yoyo/spritesheet_hair_flower.webp
 * - assets/yoyo/spritesheet_hair_starclip.webp
 * - assets/yoyo/spritesheet_hair_pearlpin.webp
 * - assets/yoyo/spritesheet_hat_ribbon.webp
 * - assets/yoyo/spritesheet_hat_crown.webp
 * - assets/yoyo/spritesheet_hat_catears.webp
 * - assets/yoyo/spritesheet_hat_santa.webp
 * - assets/yoyo/spritesheet_hat_halo.webp
 * - assets/yoyo/spritesheet_accessory_scarf.webp
 * - assets/yoyo/spritesheet_accessory_wings.webp
 * - assets/yoyo/spritesheet_accessory_butterfly_wings.webp
 * - assets/yoyo/spritesheet_accessory_devil_wings.webp
 * - assets/yoyo/spritesheet_accessory_jetpack.webp
 * - assets/yoyo/spritesheet_accessory_star_backpack.webp
 * - assets/yoyo/spritesheet_accessory_bow.webp
 * - assets/yoyo/spritesheet_party.webp
 * - assets/yoyo/spritesheet_party_behind.webp
 * - assets/yoyo/spritesheet_angel.webp
 * - assets/yoyo/spritesheet_angel_behind.webp
 *
 * 用法：node scripts/generate-outfit-spritesheets.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PET_DIR = path.join(__dirname, '..', 'assets', 'yoyo');
const ACCESSORY_DIR = path.join(__dirname, '..', 'assets', 'accessories');
const BASE_SPRITESHEET = path.join(PET_DIR, 'spritesheet.webp');

const CELL_W = 192;
const CELL_H = 208;

const HEAD_BODY_STATES = new Set([
  0, 3, 4, 6, 7, 8, 11, 12, 13, 15, 21, 23, 24, 25,
  // fanCooling, airConditioning, typingCompanion: upright companion poses.
  26, 29, 32,
]);
const RUN_STATES = new Set([1, 2]);
const LOW_BODY_STATES = new Set([
  5, 14, 20, 22,
  // swimming, whip, sofaLying: lower/leaning poses need lower anchors.
  27, 28, 30,
]);
const SITTING_STATES = new Set([10, 17, 18, 19]);
const CLIMB_STATES = new Set([9]);
const BODY_STATES = new Set([...HEAD_BODY_STATES, ...RUN_STATES, ...LOW_BODY_STATES, ...SITTING_STATES]);

const CLOTHES_PROFILES = {
  // 衣服贴身体躯干：整体下移，避免领口/裙摆压到脸部表情区域。
  default: { x: 96, y: 126, width: 54, height: 46, opacity: 0.9 },
  run:     { x: 96, y: 128, width: 50, height: 42, opacity: 0.84 },
  low:     { x: 96, y: 143, width: 62, height: 34, opacity: 0.74 },
  sitting: { x: 96, y: 136, width: 58, height: 38, opacity: 0.78 },
};

const NECK_PROFILES = {
  // 领结/围巾只落在下巴以下，尺寸收窄防止糊住脸。
  default: { x: 96, y: 101, width: 50, height: 20, opacity: 0.9 },
  run:     { x: 96, y: 103, width: 47, height: 18, opacity: 0.82 },
  low:     { x: 96, y: 123, width: 54, height: 16, opacity: 0.7 },
  sitting: { x: 96, y: 111, width: 52, height: 17, opacity: 0.76 },
};

const WING_PROFILES = {
  // 翅膀属于 behind 层：中心点锚在肩胛/后背，而不是脖子。
  // SVG 里的翅膀根部在画布中心略下方，所以这里整体下移并放大，
  // 让翼根被身体遮住、翼尖从身体两侧伸出，视觉上才像“长在背后”。
  default: { x: 96, y: 133, width: 126, height: 70, opacity: 0.82 },
  run:     { x: 96, y: 134, width: 116, height: 62, opacity: 0.68 },
  low:     { x: 96, y: 149, width: 118, height: 50, opacity: 0.58 },
  sitting: { x: 96, y: 142, width: 114, height: 54, opacity: 0.62 },
};

const BACKPACK_PROFILES = {
  // 背包/喷气背包属于 behind 层，主体藏在身体后，底部允许从身体下方露出一点。
  default: { x: 96, y: 136, width: 62, height: 76, opacity: 0.86 },
  run:     { x: 96, y: 138, width: 58, height: 70, opacity: 0.72 },
  low:     { x: 96, y: 151, width: 62, height: 56, opacity: 0.62 },
  sitting: { x: 96, y: 144, width: 60, height: 62, opacity: 0.68 },
};

const HAIR_PROFILES = {
  // 头发夹在左上侧头发区域，不能压到脸部表情区。
  default: { x: 68, y: 34, width: 28, height: 23, opacity: 0.96 },
  run:     { x: 69, y: 39, width: 25, height: 21, opacity: 0.76 },
  low:     { x: 70, y: 58, width: 24, height: 20, opacity: 0.62 },
  sitting: { x: 69, y: 48, width: 25, height: 21, opacity: 0.7 },
};

const HAT_PROFILES = {
  // 帽子/头饰锚点使用的是“贴图中心点”。之前 y 值过低，蝴蝶结尾巴会盖住脸。
  // 现在整体上移并略微缩小，让底边停在额头/头顶区域。
  default: { x: 96, y: 27, width: 50, height: 32, opacity: 0.96 },
  run:     { x: 96, y: 32, width: 45, height: 29, opacity: 0.76 },
  low:     { x: 96, y: 52, width: 43, height: 28, opacity: 0.6 },
  sitting: { x: 96, y: 42, width: 45, height: 29, opacity: 0.68 },
};

const RECIPES = [
  {
    id: 'hair_flower',
    output: 'spritesheet_hair_flower.webp',
    layers: [{ file: 'hair_flower.svg', kind: 'hair' }],
  },
  {
    id: 'hair_starclip',
    output: 'spritesheet_hair_starclip.webp',
    layers: [{ file: 'hair_starclip.svg', kind: 'hair' }],
  },
  {
    id: 'hair_pearlpin',
    output: 'spritesheet_hair_pearlpin.webp',
    layers: [{ file: 'hair_pearlpin.svg', kind: 'hair' }],
  },
  {
    id: 'hat_ribbon',
    output: 'spritesheet_hat_ribbon.webp',
    layers: [{ file: 'hat_ribbon.svg', kind: 'hat' }],
  },
  {
    id: 'hat_crown',
    output: 'spritesheet_hat_crown.webp',
    layers: [{ file: 'hat_crown.svg', kind: 'hat' }],
  },
  {
    id: 'hat_catears',
    output: 'spritesheet_hat_catears.webp',
    layers: [{ file: 'hat_catears.svg', kind: 'hat' }],
  },
  {
    id: 'hat_santa',
    output: 'spritesheet_hat_santa.webp',
    layers: [{ file: 'hat_santa.svg', kind: 'hat' }],
  },
  {
    id: 'hat_halo',
    output: 'spritesheet_hat_halo.webp',
    layers: [{ file: 'hat_halo.svg', kind: 'hat' }],
  },
  {
    id: 'clothes_hoodie',
    output: 'spritesheet_clothes_hoodie.webp',
    layers: [{ file: 'clothes_hoodie.svg', kind: 'clothes' }],
  },
  {
    id: 'clothes_dress',
    output: 'spritesheet_clothes_dress.webp',
    layers: [{ file: 'clothes_dress.svg', kind: 'clothes' }],
  },
  {
    id: 'clothes_cape',
    output: 'spritesheet_clothes_cape.webp',
    layers: [{ file: 'clothes_cape.svg', kind: 'clothes' }],
  },
  {
    id: 'clothes_sweater',
    output: 'spritesheet_clothes_sweater.webp',
    layers: [{ file: 'clothes_sweater.svg', kind: 'clothes' }],
  },
  {
    id: 'accessory_scarf',
    output: 'spritesheet_accessory_scarf.webp',
    layers: [{ file: 'accessory_scarf.svg', kind: 'neck' }],
  },
  {
    id: 'accessory_bow',
    output: 'spritesheet_accessory_bow.webp',
    layers: [{ file: 'accessory_bow.svg', kind: 'neck' }],
  },
  {
    id: 'accessory_wings',
    output: 'spritesheet_accessory_wings.webp',
    layers: [{ file: 'accessory_wings.svg', kind: 'wings', behind: true }],
  },
  {
    id: 'accessory_butterfly_wings',
    output: 'spritesheet_accessory_butterfly_wings.webp',
    layers: [{ file: 'accessory_butterfly_wings.svg', kind: 'wings', behind: true }],
  },
  {
    id: 'accessory_devil_wings',
    output: 'spritesheet_accessory_devil_wings.webp',
    layers: [{ file: 'accessory_devil_wings.svg', kind: 'wings', behind: true }],
  },
  {
    id: 'accessory_jetpack',
    output: 'spritesheet_accessory_jetpack.webp',
    layers: [{ file: 'accessory_jetpack.svg', kind: 'backpack', behind: true }],
  },
  {
    id: 'accessory_star_backpack',
    output: 'spritesheet_accessory_star_backpack.webp',
    layers: [{ file: 'accessory_star_backpack.svg', kind: 'backpack', behind: true }],
  },
  {
    id: 'party',
    output: 'spritesheet_party.webp',
    layers: [
      { file: 'accessory_wings.svg', kind: 'wings', behind: true, opacityMul: 0.62 },
      { file: 'clothes_dress.svg', kind: 'clothes' },
      { file: 'accessory_bow.svg', kind: 'neck' },
    ],
  },
  {
    id: 'angel',
    output: 'spritesheet_angel.webp',
    layers: [
      { file: 'accessory_wings.svg', kind: 'wings', behind: true },
      { file: 'clothes_sweater.svg', kind: 'clothes', opacityMul: 0.88 },
    ],
  },
];

function profileFor(kind, row) {
  const table = kind === 'wings'
    ? WING_PROFILES
    : kind === 'backpack'
      ? BACKPACK_PROFILES
      : kind === 'neck'
        ? NECK_PROFILES
        : kind === 'hair'
          ? HAIR_PROFILES
          : kind === 'hat'
            ? HAT_PROFILES
            : CLOTHES_PROFILES;
  if (RUN_STATES.has(row)) return table.run;
  if (LOW_BODY_STATES.has(row)) return table.low;
  if (SITTING_STATES.has(row)) return table.sitting;
  if (HEAD_BODY_STATES.has(row)) return table.default;
  return null;
}

function shouldDraw(kind, row) {
  if (CLIMB_STATES.has(row)) return false;
  if (kind === 'hair' || kind === 'hat') return BODY_STATES.has(row);
  if (kind === 'wings' || kind === 'backpack') return BODY_STATES.has(row);
  return BODY_STATES.has(row);
}

async function rasterLayer(layer, row) {
  const profile = profileFor(layer.kind, row);
  if (!profile) return null;
  const input = path.join(ACCESSORY_DIR, layer.file);
  if (!fs.existsSync(input)) return null;
  const opacity = Math.max(0, Math.min(1, profile.opacity * (layer.opacityMul ?? 1)));
  return {
    buffer: await sharp(input)
      .resize(Math.round(profile.width), Math.round(profile.height), { fit: 'contain' })
      .ensureAlpha()
      .modulate({ brightness: 1, saturation: 1.02 })
      .png()
      .toBuffer(),
    profile,
    opacity,
  };
}

async function writeLayerSheet(recipe, outputFile, cols, rows, layerFilter) {
  const output = path.join(PET_DIR, outputFile);
  const perRowLayers = new Map();

  for (let row = 0; row < rows; row++) {
    const rowLayers = [];
    for (const layer of recipe.layers.filter(layerFilter)) {
      if (!shouldDraw(layer.kind, row)) continue;
      const raster = await rasterLayer(layer, row);
      if (raster) rowLayers.push({ ...layer, ...raster });
    }
    perRowLayers.set(row, rowLayers);
  }

  const composites = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const frameLeft = col * CELL_W;
      const frameTop = row * CELL_H;
      for (const layer of perRowLayers.get(row)) {
        composites.push({
          input: layer.buffer,
          left: Math.round(frameLeft + layer.profile.x - layer.profile.width / 2),
          top: Math.round(frameTop + layer.profile.y - layer.profile.height / 2),
          blend: 'over',
          opacity: layer.opacity,
        });
      }
    }
  }

  await sharp({
    create: {
      width: cols * CELL_W,
      height: rows * CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 92, effort: 6 })
    .toFile(output);

  const meta = await sharp(output).metadata();
  console.log(`生成 ${path.basename(output)}: ${meta.width}×${meta.height}`);
}

async function buildRecipe(recipe, cols, rows) {
  const frontLayers = recipe.layers.filter((layer) => !layer.behind);
  const behindLayers = recipe.layers.filter((layer) => layer.behind);

  // 只有背后层的单品（如翅膀）沿用 recipe.output，便于运行时直接作为 behind 图层加载。
  if (frontLayers.length > 0) {
    await writeLayerSheet(recipe, recipe.output, cols, rows, (layer) => !layer.behind);
  } else if (behindLayers.length > 0) {
    await writeLayerSheet(recipe, recipe.output, cols, rows, (layer) => layer.behind);
  }

  // 套装可能同时包含背后层和前景层，背后层单独输出，运行时先于角色本体绘制。
  if (frontLayers.length > 0 && behindLayers.length > 0) {
    const behindOutput = recipe.output.replace(/\.webp$/i, '_behind.webp');
    await writeLayerSheet(recipe, behindOutput, cols, rows, (layer) => layer.behind);
  }
}

async function main() {
  const baseMeta = await sharp(BASE_SPRITESHEET).metadata();
  if (!baseMeta.width || !baseMeta.height) {
    throw new Error(`无法读取 spritesheet 尺寸：${BASE_SPRITESHEET}`);
  }
  if (baseMeta.width % CELL_W !== 0 || baseMeta.height % CELL_H !== 0) {
    throw new Error(`spritesheet 尺寸不是 ${CELL_W}×${CELL_H} 的整数倍：${baseMeta.width}×${baseMeta.height}`);
  }

  const cols = baseMeta.width / CELL_W;
  const rows = baseMeta.height / CELL_H;
  console.log(`基础 spritesheet: ${baseMeta.width}×${baseMeta.height}, ${cols}×${rows}`);

  for (const recipe of RECIPES) {
    await buildRecipe(recipe, cols, rows);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
