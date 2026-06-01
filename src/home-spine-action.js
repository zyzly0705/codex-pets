(function () {
  const FEED_ACTIVE_ANIMATIONS = new Set(['feed_inspect_food', 'feed_eat_loop', 'feed_satisfied']);
  const RIG_MANIFEST_URL = '../assets/yoyo/desktop-rig/v1/manifest.json';
  const ACTIONS = new Set([
    'feed',
    'bath',
    'sleep',
    'play',
    'pet',
    'watchAnime',
    'playSwitch',
    'buildBlocks',
    'study',
  ]);
  const PART_DEPTH = [
    'hair_back',
    'side_hair_left',
    'side_hair_right',
    'leg_left',
    'leg_right',
    'shoe_left',
    'shoe_right',
    'arm_left',
    'hand_left',
    'torso_top',
    'skirt',
    'collar',
    'bow_left',
    'bow_center',
    'bow_right',
    'button_left',
    'button_right',
    'face_base',
    'eye_left_open',
    'eye_right_open',
    'brow_left',
    'brow_right',
    'blush_left',
    'blush_right',
    'mouth_smile',
    'hair_front',
    'bangs_center',
    'bun',
    'arm_right',
    'hand_right',
  ];
  const PART_PIVOTS = {
    leg_left: { x: 0.5, y: 0.12 },
    leg_right: { x: 0.5, y: 0.12 },
    shoe_left: { x: 0.5, y: 0.42 },
    shoe_right: { x: 0.5, y: 0.42 },
    arm_left: { x: 0.5, y: 0.14 },
    arm_right: { x: 0.5, y: 0.14 },
    hand_left: { x: 0.5, y: 0.18 },
    hand_right: { x: 0.5, y: 0.18 },
    hair_front: { x: 0.5, y: 0.54 },
    bun: { x: 0.5, y: 0.72 },
  };
  const host = document.getElementById('home-spine-host');
  const stage = document.querySelector('.room-stage');
  if (!host || !stage) return;

  const state = {
    app: null,
    character: null,
    loadPromise: null,
    rigApp: null,
    rig: null,
    rigLoadPromise: null,
    rigFrame: 0,
    active: false,
    currentClip: '',
    currentDriver: '',
    currentAction: '',
    objectUrls: [],
  };

  function setStatus(status) {
    stage.dataset.homeSpineStatus = status;
  }

  function canRun() {
    return Boolean(window.PIXI?.Application && window.PIXI?.Assets);
  }

  function canRunSpine() {
    return Boolean(canRun() && window.spine?.Spine);
  }

  function layerOrder(layer) {
    const index = PART_DEPTH.indexOf(layer.name);
    return index >= 0 ? index : 100;
  }

  function safeName(name) {
    return String(name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function hideCanvas(app, hidden) {
    if (app?.canvas) app.canvas.hidden = hidden;
  }

  async function loadFeedSpine() {
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = (async () => {
      if (!canRunSpine()) {
        setStatus('missing-runtime');
        return null;
      }

      const app = new PIXI.Application();
      await app.init({
        width: 242,
        height: 386,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      host.appendChild(app.canvas);

      const assetPack = window.YOYO_HOME_FEED_SPINE;
      if (!assetPack?.skeleton || !assetPack?.atlas || !assetPack?.imageDataUrl) {
        setStatus('missing-assets');
        return null;
      }
      const skeletonAlias = 'home-feed-spine-skeleton';
      const atlasAlias = 'home-feed-spine-atlas';
      const atlasText = String(assetPack.atlas);
      const atlasUrl = URL.createObjectURL(new Blob([atlasText], { type: 'text/plain' }));
      state.objectUrls.push(atlasUrl);
      const cache = PIXI.Cache || PIXI.Assets.cache;
      cache?.set?.(skeletonAlias, assetPack.skeleton);
      PIXI.Assets.add({
        alias: atlasAlias,
        src: atlasUrl,
        parser: 'spineTextureAtlasLoader',
        loadParser: 'spineTextureAtlasLoader',
        data: { images: assetPack.imageDataUrl },
      });
      await PIXI.Assets.load(atlasAlias);

      const character = window.spine.Spine.from({
        skeleton: skeletonAlias,
        atlas: atlasAlias,
        scale: 0.92,
        autoUpdate: true,
      });
      character.position.set(121, 386);
      if (character.skeleton?.setSkinByName) character.skeleton.setSkinByName('default');
      if (character.skeleton?.setAttachment) character.skeleton.setAttachment('body', 'body');
      character.visible = false;
      app.stage.addChild(character);

      state.app = app;
      state.character = character;
      setStatus('ready');
      return character;
    })().catch((error) => {
      console.warn('[home-spine-action] feed spine unavailable', error);
      setStatus('error');
      return null;
    });
    return state.loadPromise;
  }

  async function loadRigManifest() {
    const response = await fetch(new URL(RIG_MANIFEST_URL, window.location.href));
    if (!response.ok) throw new Error(`desktop rig manifest failed: ${response.status}`);
    return response.json();
  }

  function createRigPart(layer, texture) {
    const pivot = PART_PIVOTS[layer.name] || { x: 0.5, y: 0.5 };
    const container = new PIXI.Container();
    container.x = layer.left + layer.width * pivot.x;
    container.y = layer.top + layer.height * pivot.y;
    container.baseX = container.x;
    container.baseY = container.y;
    container.partName = layer.name;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(pivot.x, pivot.y);
    container.addChild(sprite);
    return container;
  }

  async function loadDesktopRig() {
    if (state.rigLoadPromise) return state.rigLoadPromise;
    state.rigLoadPromise = (async () => {
      if (!canRun()) {
        setStatus('missing-runtime');
        return null;
      }

      const manifest = await loadRigManifest();
      const app = new PIXI.Application();
      await app.init({
        width: 242,
        height: 386,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      app.canvas.classList.add('home-desktop-rig-canvas');
      host.appendChild(app.canvas);

      const root = new PIXI.Container();
      const bounds = manifest.layers.reduce((acc, layer) => ({
        minX: Math.min(acc.minX, layer.left),
        minY: Math.min(acc.minY, layer.top),
        maxX: Math.max(acc.maxX, layer.left + layer.width),
        maxY: Math.max(acc.maxY, layer.top + layer.height),
      }), { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 });
      const visualHeight = Math.max(1, bounds.maxY - bounds.minY);
      const visualWidth = Math.max(1, bounds.maxX - bounds.minX);
      const scale = Math.min(386 / visualHeight, 216 / visualWidth);
      root.x = 121;
      root.y = 382;
      root.baseX = root.x;
      root.baseY = root.y;
      root.baseScale = scale;
      root.scale.set(scale);
      root.pivot.set(bounds.minX + visualWidth / 2, bounds.maxY);
      app.stage.addChild(root);

      const baseUrl = new URL('../assets/yoyo/desktop-rig/v1/', window.location.href);
      const parts = {};
      const layers = manifest.layers.slice().sort((a, b) => layerOrder(a) - layerOrder(b));
      for (const layer of layers) {
        const texture = await PIXI.Assets.load(new URL(layer.file, baseUrl).href);
        const part = createRigPart(layer, texture);
        root.addChild(part);
        parts[safeName(layer.name)] = part;
      }

      state.rigApp = app;
      state.rig = {
        root,
        parts,
        bounds,
        startedAt: performance.now(),
        action: '',
        animation: '',
        phase: '',
      };
      setStatus('ready');
      return state.rig;
    })().catch((error) => {
      console.warn('[home-spine-action] desktop rig unavailable', error);
      setStatus('error');
      return null;
    });
    return state.rigLoadPromise;
  }

  function setRigPart(part, motion = {}) {
    if (!part) return;
    part.x = part.baseX + (motion.x || 0);
    part.y = part.baseY + (motion.y || 0);
    part.rotation = motion.r || 0;
    part.scale.set(motion.sx || 1, motion.sy || 1);
    part.alpha = motion.alpha == null ? 1 : motion.alpha;
  }

  function resetRigParts(rig) {
    for (const part of Object.values(rig.parts)) setRigPart(part);
  }

  function mergePose(target, next) {
    for (const [name, motion] of Object.entries(next)) {
      target[name] = { ...(target[name] || {}), ...motion };
    }
  }

  function actionPose(action, animation, phase, elapsed) {
    const walk = Math.sin(elapsed * 12.8);
    const counter = Math.sin(elapsed * 12.8 + Math.PI);
    const bounce = Math.abs(walk);
    const soft = Math.sin(elapsed * 3.2);
    const quick = Math.sin(elapsed * 8.4);
    const pose = {};

    if (phase === 'enter' || /walk|sit_down|kneel_down/u.test(animation)) {
      mergePose(pose, {
        leg_left: { r: 0.28 * walk, x: walk * 8, y: Math.max(0, walk) * 8 },
        shoe_left: { r: 0.22 * walk, x: walk * 14, y: Math.max(0, walk) * 7 },
        leg_right: { r: 0.28 * counter, x: counter * 8, y: Math.max(0, counter) * 8 },
        shoe_right: { r: 0.22 * counter, x: counter * 14, y: Math.max(0, counter) * 7 },
        arm_left: { r: -0.18 * walk, x: -walk * 4 },
        arm_right: { r: -0.18 * counter, x: -counter * 4 },
        hair_front: { y: -bounce * 2 },
        bun: { y: -bounce * 2.2, r: 0.02 * walk },
      });
      return { root: { y: -bounce * 8, r: 0.018 * walk }, parts: pose };
    }

    if (phase === 'complete') {
      mergePose(pose, {
        arm_left: { r: -0.28, y: -8 },
        hand_left: { r: -0.24, y: -10 },
        arm_right: { r: 0.24, y: -8 },
        hand_right: { r: 0.22, y: -10 },
        bun: { y: -4, r: 0.04 * soft },
      });
      return { root: { y: -10 - Math.max(0, soft) * 4, sy: 1.02 }, parts: pose };
    }

    if (action === 'feed' && phase === 'active') {
      mergePose(pose, {
        torso_top: { r: -0.04, x: -3, y: 3 },
        face_base: { r: -0.035, x: -4, y: 5 + quick * 2 },
        hair_front: { r: -0.035, x: -4, y: 4 + quick * 2 },
        bangs_center: { x: -4, y: 4 + quick * 2 },
        bun: { r: -0.04, x: -4, y: 2 + quick },
        arm_left: { r: -0.22, x: 4, y: 8 },
        hand_left: { r: -0.18, x: 5, y: 9 },
        arm_right: { r: 0.18, x: -3, y: 7 },
        hand_right: { r: 0.16, x: -3, y: 8 },
      });
      return { root: { y: quick * 2, r: -0.012 }, parts: pose };
    }

    if (action === 'bath' && phase === 'active') {
      mergePose(pose, {
        arm_left: { r: -0.34 + quick * 0.08, x: 8, y: 9 },
        hand_left: { r: -0.28 + quick * 0.1, x: 10, y: 10 },
        arm_right: { r: 0.30 - quick * 0.08, x: -8, y: 9 },
        hand_right: { r: 0.24 - quick * 0.1, x: -10, y: 10 },
        face_base: { y: 2 + soft },
        blush_left: { alpha: 0.88 },
        blush_right: { alpha: 0.88 },
      });
      return { root: { y: soft * 3, r: soft * 0.01 }, parts: pose };
    }

    if (action === 'sleep' && (phase === 'active' || phase === 'settle')) {
      mergePose(pose, {
        face_base: { y: 5, r: -0.05 },
        hair_front: { y: 5, r: -0.05 },
        bangs_center: { y: 4, r: -0.04 },
        bun: { y: 2, r: -0.05 },
        arm_left: { r: -0.2, x: 8, y: 10 },
        arm_right: { r: 0.2, x: -8, y: 10 },
        leg_left: { r: -0.12, x: 4 },
        leg_right: { r: 0.12, x: -4 },
      });
      return { root: { y: soft * 2, r: -0.06, sx: 1.03, sy: 0.96 }, parts: pose };
    }

    if ((action === 'play' || action === 'buildBlocks') && phase === 'active') {
      mergePose(pose, {
        arm_left: { r: -0.32 + quick * 0.12, y: -8 },
        hand_left: { r: -0.28 + quick * 0.1, y: -10 },
        arm_right: { r: 0.28 - quick * 0.12, y: -8 },
        hand_right: { r: 0.22 - quick * 0.1, y: -10 },
        leg_left: { r: 0.1 * quick },
        leg_right: { r: -0.1 * quick },
        bun: { y: -bounce * 5, r: quick * 0.04 },
      });
      return { root: { y: -bounce * 12, r: quick * 0.018 }, parts: pose };
    }

    if (action === 'pet' && phase === 'active') {
      mergePose(pose, {
        face_base: { y: -2 + soft * 2 },
        hair_front: { y: -2 + soft * 2 },
        blush_left: { alpha: 1 },
        blush_right: { alpha: 1 },
        arm_left: { r: -0.18, y: 7 },
        hand_left: { r: -0.16, y: 8 },
        arm_right: { r: 0.18, y: 7 },
        hand_right: { r: 0.16, y: 8 },
      });
      return { root: { y: -Math.max(0, soft) * 5, sx: 1.01, sy: 1.01 }, parts: pose };
    }

    if (['watchAnime', 'playSwitch', 'study'].includes(action) && phase === 'active') {
      mergePose(pose, {
        torso_top: { r: -0.025, y: 4 },
        face_base: { r: -0.025, y: 5 + soft },
        hair_front: { r: -0.025, y: 5 + soft },
        bangs_center: { y: 4 + soft },
        arm_left: { r: -0.22, x: 5, y: 7 },
        hand_left: { r: -0.18, x: 6, y: 9 },
        arm_right: { r: 0.22, x: -5, y: 7 },
        hand_right: { r: 0.18, x: -6, y: 9 },
      });
      return { root: { y: soft * 2, r: -0.01 }, parts: pose };
    }

    return {
      root: { y: soft * 2, r: soft * 0.006, sx: 1, sy: 1 - Math.max(0, soft) * 0.008 },
      parts: pose,
    };
  }

  function animateDesktopRig() {
    state.rigFrame = requestAnimationFrame(animateDesktopRig);
    const rig = state.rig;
    if (!rig || !state.active || state.currentDriver !== 'desktop-rig') return;

    const elapsed = (performance.now() - rig.startedAt) / 1000;
    const pose = actionPose(rig.action, rig.animation, rig.phase, elapsed);
    const root = rig.root;
    root.x = root.baseX;
    root.y = root.baseY + (pose.root?.y || 0);
    root.rotation = pose.root?.r || 0;
    root.scale.set(
      root.baseScale * (pose.root?.sx || 1),
      root.baseScale * (pose.root?.sy || 1),
    );
    resetRigParts(rig);
    for (const [name, motion] of Object.entries(pose.parts || {})) {
      setRigPart(rig.parts[name], motion);
    }
  }

  function setActiveDriver(driver, action, visible) {
    state.active = visible;
    stage.dataset.homeSpineActive = visible ? 'true' : 'false';
    stage.dataset.homeSpineAction = visible ? action : '';
    stage.dataset.homeSpineDriver = visible ? driver : '';
    state.currentDriver = visible ? driver : '';
    state.currentAction = visible ? action : '';
    if (state.character) state.character.visible = visible && driver === 'spine';
    hideCanvas(state.app, !(visible && driver === 'spine'));
    hideCanvas(state.rigApp, !(visible && driver === 'desktop-rig'));
  }

  function playClip(clip, loop) {
    if (!state.character || state.currentClip === `${clip}:${loop}`) return;
    state.currentClip = `${clip}:${loop}`;
    state.character.state.setAnimation(0, clip, loop);
  }

  function stopActiveDriver() {
    setActiveDriver('', '', false);
    state.currentClip = '';
  }

  async function sync() {
    const action = stage.dataset.scene || '';
    const animation = stage.dataset.actionAnimation || '';
    const phase = stage.dataset.actionPhase || stage.dataset.motionPhase || '';
    const isFeed = action === 'feed';
    const shouldShowFeedSpine = isFeed && FEED_ACTIVE_ANIMATIONS.has(animation);
    const shouldShowDesktopRig = ACTIONS.has(action) && Boolean(animation);

    if (!shouldShowFeedSpine && !shouldShowDesktopRig) {
      stopActiveDriver();
      return;
    }

    if (shouldShowFeedSpine) {
      const character = await loadFeedSpine();
      if (character) {
        setActiveDriver('spine', action, true);
        if (animation === 'feed_eat_loop') playClip('eat_table', true);
        else if (animation === 'feed_satisfied') playClip('idle_stand', true);
        else playClip('eat_table', false);
        return;
      }
    }

    const rig = await loadDesktopRig();
    if (!rig) {
      stopActiveDriver();
      return;
    }
    rig.action = action;
    rig.animation = animation;
    rig.phase = phase;
    setActiveDriver('desktop-rig', action, true);
    if (!state.rigFrame) animateDesktopRig();
  }

  const observer = new MutationObserver(sync);
  observer.observe(stage, {
    attributes: true,
    attributeFilter: ['data-scene', 'data-action-animation', 'data-action-phase', 'data-motion-phase'],
  });
  sync();
})();
