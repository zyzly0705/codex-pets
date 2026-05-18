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

export function normalizePetManifest(pet = {}) {
  const asset = {
    ...DEFAULT_ASSET,
    ...(pet.asset || {}),
    spritesheetPath: pet.spritesheetPath || pet.asset?.spritesheetPath || DEFAULT_ASSET.spritesheetPath,
  };
  const states = { ...STATES, ...(pet.states || {}) };
  const layers = pet.layers || {};
  const render = pet.render || {};
  const capabilities = pet.capabilities || {};

  return {
    ...pet,
    asset,
    states,
    layers,
    render,
    capabilities,
    spritesheetPath: asset.spritesheetPath,
  };
}
