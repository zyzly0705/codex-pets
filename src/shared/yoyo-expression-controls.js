(function initYoyoExpressionControls(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.YOYO_EXPRESSION_CONTROLS = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function createYoyoExpressionControls() {
  const EXPRESSION_LAYERS = [
    'face/base',
    'face/eyes',
    'face/mouth',
    'face/brows',
    'face/blush',
    'face/effects',
  ];

  const EXPRESSION_PRESETS = {
    neutral: {
      id: 'neutral',
      label: 'Neutral',
      parts: { eyes: 'open', mouth: 'small_smile', brows: 'soft', blush: 'light' },
    },
    happy: {
      id: 'happy',
      label: 'Happy',
      parts: { eyes: 'happy_arc', mouth: 'open_smile', brows: 'soft_up', blush: 'light' },
    },
    shy: {
      id: 'shy',
      label: 'Shy',
      parts: { eyes: 'soft_smile', mouth: 'small_smile', brows: 'soft_down', blush: 'warm' },
    },
    sleepy: {
      id: 'sleepy',
      label: 'Sleepy',
      parts: { eyes: 'half_closed', mouth: 'tiny_relaxed', brows: 'relaxed', blush: 'none' },
    },
    angry: {
      id: 'angry',
      label: 'Angry',
      parts: { eyes: 'open', mouth: 'pout', brows: 'furrowed', blush: 'light' },
    },
    sad: {
      id: 'sad',
      label: 'Sad',
      parts: { eyes: 'teary', mouth: 'downturned', brows: 'worried', blush: 'none' },
    },
    surprised: {
      id: 'surprised',
      label: 'Surprised',
      parts: { eyes: 'wide', mouth: 'round_o', brows: 'raised', blush: 'light' },
    },
    blink: {
      id: 'blink',
      label: 'Blink',
      parts: { eyes: 'closed', mouth: 'small_smile', brows: 'soft', blush: 'light' },
    },
    talk_small: {
      id: 'talk_small',
      label: 'Talk Small',
      parts: { eyes: 'open', mouth: 'talk_small', brows: 'soft', blush: 'light' },
    },
    talk_round: {
      id: 'talk_round',
      label: 'Talk Round',
      parts: { eyes: 'open', mouth: 'round_o', brows: 'soft', blush: 'light' },
    },
    talk_flat: {
      id: 'talk_flat',
      label: 'Talk Flat',
      parts: { eyes: 'open', mouth: 'flat', brows: 'soft', blush: 'light' },
    },
  };

  const TALK_CYCLE = ['talk_small', 'talk_round', 'talk_flat'];

  const BEHAVIOR_EXPRESSION_MAP = {
    idle: { primary: 'neutral', fallback: 'blink' },
    pet: { primary: 'happy', fallback: 'shy' },
    feed: { primary: 'happy', fallback: 'neutral' },
    bath: { primary: 'happy', fallback: 'shy' },
    sleep: { primary: 'sleepy', fallback: 'blink' },
    play: { primary: 'happy', fallback: 'surprised' },
    whip: { primary: 'sad', fallback: 'angry' },
    talk: { primary: 'talk_small', fallback: 'neutral' },
  };

  const LEGACY_EXPRESSION_ALIASES = {
    sparkle: 'surprised',
    heart: 'happy',
    crying: 'sad',
    dizzy: 'surprised',
  };

  const RUNTIME_EXPRESSION_ALIASES = {
    neutral: 'neutral',
    happy: 'happy',
    shy: 'shy',
    sleepy: 'sleepy',
    angry: 'angry',
    sad: 'sad',
    surprised: 'surprised',
    blink: 'blink',
    talk_small: 'talk_small',
    talk_round: 'talk_round',
    talk_flat: 'talk_flat',
    sparkle: 'sparkle',
    heart: 'heart',
    crying: 'sad',
    dizzy: 'dizzy',
  };

  function normalizeExpressionPreset(id, fallback = 'neutral') {
    const key = String(id || '').trim();
    if (EXPRESSION_PRESETS[key]) return key;
    const alias = LEGACY_EXPRESSION_ALIASES[key];
    if (alias && EXPRESSION_PRESETS[alias]) return alias;
    return EXPRESSION_PRESETS[fallback] ? fallback : 'neutral';
  }

  function runtimeExpressionForPreset(id, fallback = 'neutral') {
    const key = String(id || '').trim();
    if (RUNTIME_EXPRESSION_ALIASES[key]) return RUNTIME_EXPRESSION_ALIASES[key];
    const preset = normalizeExpressionPreset(key, fallback);
    return RUNTIME_EXPRESSION_ALIASES[preset] || preset;
  }

  function expressionFromTalkCycle(frameIndex = 0) {
    const index = Math.abs(Number(frameIndex) || 0) % TALK_CYCLE.length;
    return TALK_CYCLE[index];
  }

  function expressionForBehavior(behavior, options = {}) {
    if (behavior === 'talk' && Object.prototype.hasOwnProperty.call(options, 'talkFrame')) {
      return expressionFromTalkCycle(options.talkFrame);
    }
    const entry = BEHAVIOR_EXPRESSION_MAP[behavior] || BEHAVIOR_EXPRESSION_MAP.idle;
    const candidate = options.preferFallback ? entry.fallback : entry.primary;
    return normalizeExpressionPreset(candidate || entry.primary || entry.fallback);
  }

  return {
    BEHAVIOR_EXPRESSION_MAP,
    EXPRESSION_LAYERS,
    EXPRESSION_PRESETS,
    LEGACY_EXPRESSION_ALIASES,
    RUNTIME_EXPRESSION_ALIASES,
    TALK_CYCLE,
    expressionForBehavior,
    expressionFromTalkCycle,
    normalizeExpressionPreset,
    runtimeExpressionForPreset,
  };
}));
