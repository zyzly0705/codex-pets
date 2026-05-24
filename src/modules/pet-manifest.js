// pet-manifest.js - normalize pet package metadata for rendering and asset checks
import { STATES, CELL_W, CELL_H } from './core-state.js';

const DEFAULT_ASSET = {
  spritesheetPath: 'spritesheet.webp',
  cellWidth: CELL_W,
  cellHeight: CELL_H,
  columns: 8,
  rows: 0,
  scale: 0.75,
  anchor: { x: 0.5, y: 1 },
};

function dirname(filePath = '') {
  const normalized = String(filePath || '').replaceAll('\\', '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '';
}

function joinPath(baseDir, filePath) {
  if (!filePath) return '';
  if (/^[a-z]+:\/\//i.test(filePath) || /^\/|^[A-Za-z]:[\\/]/.test(filePath)) return filePath;
  return baseDir ? `${baseDir}/${filePath}` : filePath;
}

function normalizeSheetValue(baseDir, value, fallbackPath) {
  const file = typeof value === 'string' ? value : value?.path || value?.spritesheetPath || value?.sheetPath;
  return joinPath(baseDir, file || fallbackPath);
}

export function normalizePetManifest(pet = {}) {
  const baseDir = dirname(pet.manifestPath || pet.spritesheetPath || '');
  const asset = {
    ...DEFAULT_ASSET,
    ...(pet.asset || {}),
    spritesheetPath: pet.spritesheetPath || pet.asset?.spritesheetPath || DEFAULT_ASSET.spritesheetPath,
  };
  const baseSpritesheetPath = joinPath(baseDir, asset.spritesheetPath);
  const sheets = {
    base: baseSpritesheetPath,
  };
  for (const [name, value] of Object.entries(pet.sheets || {})) {
    sheets[name] = normalizeSheetValue(baseDir, value, asset.spritesheetPath);
  }
  const looks = {
    default: {
      id: 'default',
      name: '默认',
      spritesheetPath: baseSpritesheetPath,
    },
  };
  for (const [id, value] of Object.entries(pet.looks || {})) {
    const file = typeof value === 'string' ? value : value?.spritesheetPath || value?.sheetPath || value?.path;
    looks[id] = {
      ...(typeof value === 'object' ? value : {}),
      id,
      name: typeof value === 'object' ? value.name || id : id,
      spritesheetPath: joinPath(baseDir, file || asset.spritesheetPath),
    };
  }
  const states = {};
  for (const [name, spec] of Object.entries({ ...STATES, ...(pet.states || {}) })) {
    states[name] = {
      ...spec,
      ...(spec?.sheetPath ? { sheetPath: joinPath(baseDir, spec.sheetPath) } : {}),
    };
  }
  const render = pet.render || {};
  const capabilities = pet.capabilities || {};

  return {
    ...pet,
    asset,
    states,
    sheets,
    looks,
    defaultLook: pet.defaultLook || 'default',
    render,
    capabilities,
    spritesheetPath: baseSpritesheetPath,
  };
}
