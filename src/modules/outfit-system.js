// outfit-system.js - 完整 look 套装切换
import { state, say, playSound, localFileUrl } from './core-state.js';
import { set } from './store-client.js';
import { logOutfitLayers } from './debug-log.js';

const OUTFIT_DEFAULTS = { look: 'default' };

function getCurrentLook() {
  const lookId = state.currentOutfit?.look || 'default';
  return state.currentPet?.looks?.[lookId] || state.currentPet?.looks?.default || null;
}

function sanitizeOutfitForCurrentPet() {
  const nextOutfit = { ...OUTFIT_DEFAULTS, ...state.currentOutfit };
  if (!state.currentPet?.looks?.[nextOutfit.look]) {
    nextOutfit.look = 'default';
  }
  state.currentOutfit = nextOutfit;
  state.currentLookId = nextOutfit.look;
}

function getVariantSpritesheetPath() {
  if (!state.currentPet) return '';
  const look = getCurrentLook();
  return look?.spritesheetPath || state.currentPet.spritesheetPath;
}

function saveOutfit() {
  set('outfit', state.currentOutfit);
}

function applyPreset(presetId) {
  if (!state.currentPet?.looks?.[presetId]) return false;
  state.currentOutfit = {
    ...OUTFIT_DEFAULTS,
    look: presetId,
  };
  sanitizeOutfitForCurrentPet();
  saveOutfit();
  return true;
}

function normalizeOutfit() {
  state.currentOutfit = { ...OUTFIT_DEFAULTS, ...state.currentOutfit };
  sanitizeOutfitForCurrentPet();
}

export function applyOutfitSpritesheet() {
  if (!state.currentPet) return;
  sanitizeOutfitForCurrentPet();
  state.outfitLayerImages = [];
  logOutfitLayers(state.currentOutfit, []);

  const nextPath = getVariantSpritesheetPath();
  if (!nextPath || state.activeSpritesheetPath === nextPath) return;

  const nextSprite = new Image();
  nextSprite.onload = () => {
    state.sprite = nextSprite;
    state.activeSpritesheetPath = nextPath;
    const look = getCurrentLook();
    window.petApi.setActiveVisual({ pet: state.currentPet, look });
  };
  nextSprite.onerror = () => {
    if (nextPath !== state.currentPet.spritesheetPath) {
      state.currentOutfit = { ...OUTFIT_DEFAULTS };
      state.outfitLayerImages = [];
      saveOutfit();
      applyOutfitSpritesheet();
    }
  };
  nextSprite.src = localFileUrl(nextPath);
}

export function initOutfitSystem() {
  normalizeOutfit();
  saveOutfit();
  applyOutfitSpritesheet();

  window.petApi.onOutfitChange((category, itemId) => {
    if (category !== 'look') return;
    if (!applyPreset(itemId)) return;
    applyOutfitSpritesheet();
    say(itemId === 'default' ? 'Yoyo回来啦~' : '咕咕嘎嘎，Gaga形态来啦~');
    playSound('giggle');
  });

  window.petApi.onOutfitRandom(() => {
    const lookIds = Object.keys(state.currentPet?.looks || {}).filter(id => id !== 'default');
    const randomPreset = lookIds.length
      ? lookIds[Math.floor(Math.random() * lookIds.length)]
      : 'default';
    if (applyPreset(randomPreset)) {
      applyOutfitSpritesheet();
      say(randomPreset === 'default' ? 'Yoyo回来啦~' : '咕咕嘎嘎，换个小形态陪你~');
    }
    playSound('giggle');
  });

  if (window.petApi.onOutfitPreset) {
    window.petApi.onOutfitPreset((presetId) => {
      if (!applyPreset(presetId)) return;
      applyOutfitSpritesheet();
      say(presetId === 'default' ? 'Yoyo回来啦~' : '换好啦，Gaga形态陪妈妈一下～');
      playSound('giggle');
    });
  }

  window.petApi.onOutfitReset(() => {
    state.currentOutfit = { ...OUTFIT_DEFAULTS };
    saveOutfit();
    applyOutfitSpritesheet();
    say('已经恢复默认造型啦~');
  });
}
