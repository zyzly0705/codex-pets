(function initDesktopActionDispatcher(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./yoyo-actions.js'));
    return;
  }
  root.YOYO_DESKTOP_ACTIONS = factory(root.YOYO_ACTIONS);
}(typeof globalThis !== 'undefined' ? globalThis : this, function createDesktopActionDispatcher(yoyoActions = {}) {
  const { CARE_ACTIONS = {} } = yoyoActions;

  const ACTION_PROPS = {
    feed: 'cookie',
    bath: 'bath',
    pet: 'heart',
    play: 'toyBox',
    playSwitch: 'switchAndToys',
    watchAnime: 'switchAndToys',
    buildBlocks: 'toyBox',
    study: null,
    sleep: null,
  };

  const ACTION_DURATIONS = {
    feed: 2600,
    bath: 2600,
    sleep: 3200,
    play: 2600,
    pet: 2200,
    watchAnime: 3200,
    playSwitch: 2800,
    buildBlocks: 3000,
    study: 3200,
  };

  function buildDesktopAction(actionId, overrides = {}) {
    const action = CARE_ACTIONS[actionId];
    if (!action) return null;
    return {
      id: actionId,
      label: action.label,
      stateName: overrides.stateName || action.stateName || 'idle',
      line: overrides.line || action.desktopLine || '',
      propId: Object.prototype.hasOwnProperty.call(overrides, 'propId')
        ? overrides.propId
        : ACTION_PROPS[actionId] ?? null,
      durationMs: Number(overrides.durationMs || ACTION_DURATIONS[actionId] || 2200),
      finalEffectId: action.finalEffectId || null,
      source: overrides.source || 'care',
    };
  }

  function listDesktopActions() {
    return Object.keys(CARE_ACTIONS).map((actionId) => buildDesktopAction(actionId));
  }

  return {
    ACTION_DURATIONS,
    ACTION_PROPS,
    buildDesktopAction,
    listDesktopActions,
  };
}));
