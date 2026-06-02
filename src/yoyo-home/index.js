// New Yoyo Home runtime entrypoint. This file intentionally stays small:
// Phaser rendering, simulation, and DOM HUD live in src/yoyo-home modules.
(async function bootYoyoHome() {
  const debug = new URLSearchParams(window.location.search).has('debug')
    || window.YOYO_HOME_DEBUG === true;

  const [
    { YOYO_HOME_MANIFEST, validateHomeManifest },
    { createHomeState },
    { loadInitialLifeBridgeOptions, createElectronLifeBridge },
    { createHomeHud },
    { createDebugPanel },
  ] = await Promise.all([
    import('./data/home-manifest.mjs'),
    import('./sim/home-sim.mjs'),
    import('./bridge/electron-life-bridge.mjs'),
    import('./ui/home-hud.mjs'),
    import('./ui/debug-panel.mjs'),
  ]);

  const validation = validateHomeManifest(YOYO_HOME_MANIFEST);
  if (!validation.ok) {
    console.error('[yoyo-home] manifest validation failed', validation.errors);
    return;
  }

  const root = document.getElementById('yoyo-home-game');
  const homeHud = createHomeHud(document.body);
  const debugPanel = debug ? createDebugPanel(document.body) : null;
  const petApi = window.petApi || null;
  const fallbackState = createHomeState({ manifest: YOYO_HOME_MANIFEST, now: Date.now() });
  const bridgeOptions = await loadInitialLifeBridgeOptions(petApi, fallbackState);
  const initialState = createHomeState({
    manifest: YOYO_HOME_MANIFEST,
    now: Date.now(),
    ...bridgeOptions,
  });
  let game = null;
  let bridge = null;
  if (root && window.Phaser) {
    const { createYoyoHomeGame } = await import('./scenes/RoomScene.mjs');
    game = createYoyoHomeGame({
      parent: root,
      debugPanel,
      homeHud,
      debug,
      initialState,
      onStateChange: (state) => bridge?.onStateChange?.(state),
    });
    bridge = createElectronLifeBridge({ petApi, game, debug });
  }

  window.YOYO_HOME_REBUILD = {
    manifest: YOYO_HOME_MANIFEST,
    state: initialState,
    bridge,
    debug,
    phase: game ? (petApi ? 'phase-3-electron-bridge' : 'phase-2-room-preview') : 'phase-1-skeleton',
    game,
  };

  window.dispatchEvent(new CustomEvent('yoyo-home-ready', {
    detail: { phase: window.YOYO_HOME_REBUILD.phase, debug, bridgeConnected: Boolean(petApi) },
  }));
})();
