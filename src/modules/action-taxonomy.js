export const ACTION_CATEGORIES = {
  CHARACTER_ONLY: 'character-only',
  MINI_SCENE: 'mini-scene',
  FULLSCREEN_PERFORMANCE: 'fullscreen-performance',
  PROP_ATTACHED: 'prop-attached',
  AMBIENT_OVERLAY: 'ambient-overlay',
};

export const PRODUCT_LAYERS = {
  NEED: 'need',
  EMOTION: 'emotion',
  CARE: 'care',
  REWARD: 'reward',
};

export const ACTION_TAXONOMY = {
  idle: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  walk: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  wave: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  lookAround: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  sweetTalk: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  bashful: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  cheer: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  neglectProtest: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  sadnessLinger: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  joySpill: { layer: PRODUCT_LAYERS.EMOTION, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },

  hungry: { layer: PRODUCT_LAYERS.NEED, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  sleep: { layer: PRODUCT_LAYERS.NEED, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: true },
  overtimeReminder: { layer: PRODUCT_LAYERS.NEED, category: ACTION_CATEGORIES.AMBIENT_OVERLAY, auto: true },

  petting: { layer: PRODUCT_LAYERS.CARE, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: false },
  readBook: { layer: PRODUCT_LAYERS.CARE, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: true },
  wpsCompanion: { layer: PRODUCT_LAYERS.CARE, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: true },

  dance: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.FULLSCREEN_PERFORMANCE, auto: false, script: 'danceLetGo' },
  swing: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.MINI_SCENE, auto: false, script: 'swingScene' },
  digSand: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: false },
  watchTV: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: false },
  fanCooling: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.MINI_SCENE, auto: false, script: 'fanCoolingScene' },
  swimming: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.MINI_SCENE, auto: false, script: 'swimmingScene' },
  airConditioning: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.MINI_SCENE, auto: false, script: 'airConditioningScene' },
  sofaLying: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.MINI_SCENE, auto: false, script: 'sofaLyingScene' },
  giftFlower: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: false },
  giftCandy: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: false },
  climb: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.CHARACTER_ONLY, auto: false },
  whip: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.PROP_ATTACHED, auto: false },
  clone: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.FULLSCREEN_PERFORMANCE, auto: false, script: 'cloneHeart' },
  giant: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.FULLSCREEN_PERFORMANCE, auto: false, script: 'dharmaManifest' },
  weatherReminder: { layer: PRODUCT_LAYERS.NEED, category: ACTION_CATEGORIES.AMBIENT_OVERLAY, auto: true },
  newsBroadcast: { layer: PRODUCT_LAYERS.REWARD, category: ACTION_CATEGORIES.AMBIENT_OVERLAY, auto: false },
};

export function getActionTaxonomy(actionName) {
  return ACTION_TAXONOMY[actionName] || {
    layer: PRODUCT_LAYERS.EMOTION,
    category: ACTION_CATEGORIES.CHARACTER_ONLY,
    auto: true,
  };
}

export function shouldAutoTriggerAction(actionName) {
  return getActionTaxonomy(actionName).auto !== false;
}

export function isPerformanceAction(actionName) {
  const category = getActionTaxonomy(actionName).category;
  return category === ACTION_CATEGORIES.MINI_SCENE || category === ACTION_CATEGORIES.FULLSCREEN_PERFORMANCE;
}

export function isRewardAction(actionName) {
  return getActionTaxonomy(actionName).layer === PRODUCT_LAYERS.REWARD;
}
