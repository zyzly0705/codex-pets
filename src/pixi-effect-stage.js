(function () {
  const FRAME_W = 192;
  const FRAME_H = 208;
  const IDLE_ROW = 0;
  const IDLE_FRAMES = 6;
  const CLONE_ROWS = [
    { row: 0, frames: 6 },
    { row: 3, frames: 4 },
    { row: 4, frames: 5 },
    { row: 21, frames: 8 },
    { row: 25, frames: 8 },
  ];
  const DHARMA_CHARGE_ROW = 33;
  const DHARMA_MANIFEST_ROW = 35;
  const DHARMA_STABLE_ROW = 36;

  const state = {
    app: null,
    scene: null,
    stage: null,
    startedAt: 0,
    lastNow: 0,
    duration: 2400,
    timeline: {},
    effectType: 'clone',
    sourceCenter: null,
    arenaCenter: null,
    petSize: null,
    emitters: [],
    closing: false,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBack(t) {
    const c1 = 1.42;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function segment(elapsed, start, end) {
    return clamp((elapsed - start) / (end - start), 0, 1);
  }

  function clampPoint(point, bounds) {
    return {
      x: clamp(point.x, bounds.left, bounds.right),
      y: clamp(point.y, bounds.top, bounds.bottom),
    };
  }

  function hex(value, fallback) {
    if (typeof value !== 'string') return fallback;
    return Number.parseInt(value.replace('#', ''), 16) || fallback;
  }

  function cssColor(value, alpha) {
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function makeDotTexture(color, size, soft = true) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const radius = size / 2;
    if (soft) {
      const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      gradient.addColorStop(0, cssColor(color, 1));
      gradient.addColorStop(0.45, cssColor(color, 0.76));
      gradient.addColorStop(1, cssColor(color, 0));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = cssColor(color, 1);
    }
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(canvas);
  }

  function cropFrameTexture(image, row, col) {
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      col * FRAME_W,
      row * FRAME_H,
      FRAME_W,
      FRAME_H,
      0,
      0,
      FRAME_W,
      FRAME_H
    );
    return PIXI.Texture.from(canvas);
  }

  function getSafeRow(image, row) {
    const maxRow = Math.floor(image.naturalHeight / FRAME_H) - 1;
    return row <= maxRow ? row : IDLE_ROW;
  }

  function makeAnimation(image, row, frames) {
    const safeRow = getSafeRow(image, row);
    const textures = [];
    for (let i = 0; i < frames; i += 1) {
      textures.push(cropFrameTexture(image, safeRow, i));
    }
    const sprite = new PIXI.AnimatedSprite(textures);
    sprite.anchor.set(0.5);
    sprite.animationSpeed = 0.22;
    sprite.loop = true;
    sprite.play();
    return sprite;
  }

  function makeRing(radius, color, alpha, width = 2) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, radius).stroke({ width, color, alpha });
    g.circle(0, 0, radius * 0.68).stroke({ width: Math.max(1, width * 0.55), color, alpha: alpha * 0.72 });
    for (let i = 0; i < 16; i += 1) {
      const a = i * Math.PI * 2 / 16;
      g.moveTo(Math.cos(a) * radius * 0.78, Math.sin(a) * radius * 0.78);
      g.lineTo(Math.cos(a) * radius * 1.08, Math.sin(a) * radius * 1.08);
    }
    g.stroke({ width: Math.max(1, width * 0.55), color, alpha: alpha * 0.82 });
    return g;
  }

  function makeGlowDisk(radius, color, alpha) {
    const canvas = document.createElement('canvas');
    const size = Math.ceil(radius * 2);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    g.addColorStop(0, cssColor(color, alpha));
    g.addColorStop(0.35, cssColor(color, alpha * 0.35));
    g.addColorStop(1, cssColor(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    sprite.anchor.set(0.5);
    return sprite;
  }

  function makeLightning(color, alpha, seed) {
    const g = new PIXI.Graphics();
    for (let i = 0; i < 5; i += 1) {
      const x = Math.sin(seed + i * 1.7) * 120;
      const y = -260 + i * 54;
      const nx = Math.cos(seed + i * 2.1) * 85;
      const ny = -225 + i * 58;
      g.moveTo(x, y);
      g.lineTo((x + nx) / 2 + (i % 2 ? 32 : -24), (y + ny) / 2);
      g.lineTo(nx, ny);
    }
    g.stroke({ width: 3, color, alpha, cap: 'round', join: 'round' });
    return g;
  }

  function maybeFilter(FilterClass, options) {
    try {
      return FilterClass ? new FilterClass(options) : null;
    } catch (error) {
      return null;
    }
  }

  function addEmitter(container, texture, config, x, y) {
    if (!PIXI.particles || !PIXI.particles.Emitter) return null;
    const emitter = new PIXI.particles.Emitter(container, {
      lifetime: { min: config.lifetimeMin, max: config.lifetimeMax },
      frequency: config.frequency,
      spawnChance: 1,
      particlesPerWave: config.particlesPerWave,
      emitterLifetime: config.emitterLifetime,
      maxParticles: config.maxParticles,
      pos: { x, y },
      addAtBack: false,
      behaviors: [
        {
          type: 'alpha',
          config: {
            alpha: {
              list: [
                { value: config.alphaStart, time: 0 },
                { value: config.alphaEnd, time: 1 },
              ],
            },
          },
        },
        {
          type: 'scale',
          config: {
            scale: {
              list: [
                { value: config.scaleStart, time: 0 },
                { value: config.scaleEnd, time: 1 },
              ],
            },
          },
        },
        {
          type: 'color',
          config: {
            color: {
              list: [
                { value: config.colorStart, time: 0 },
                { value: config.colorEnd, time: 1 },
              ],
            },
          },
        },
        {
          type: 'moveSpeed',
          config: {
            speed: {
              list: [
                { value: config.speedStart, time: 0 },
                { value: config.speedEnd, time: 1 },
              ],
            },
          },
        },
        { type: 'rotationStatic', config: { min: 0, max: 360 } },
        {
          type: 'spawnShape',
          config: {
            type: config.spawnType || 'torus',
            data: config.spawnData || { x: 0, y: 0, radius: 16 },
          },
        },
        { type: 'textureSingle', config: { texture } },
      ],
    });
    emitter.emit = true;
    state.emitters.push(emitter);
    return emitter;
  }

  async function initApp() {
    const app = new PIXI.Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
      preference: 'webgl',
    });
    app.canvas.style.position = 'fixed';
    app.canvas.style.left = '0';
    app.canvas.style.top = '0';
    document.body.appendChild(app.canvas);
    return app;
  }

  function clearEmitters() {
    for (const emitter of state.emitters) {
      try {
        emitter.emit = false;
        emitter.destroy();
      } catch (error) {}
    }
    state.emitters = [];
  }

  function closeSoon() {
    if (state.closing) return;
    state.closing = true;
    clearEmitters();
    try {
      if (state.app) state.app.destroy(true, { children: true, texture: false });
    } catch (error) {}
    try { window.close(); } catch (error) {}
  }


  // ====================================================================
  // 分身术 —— 3波展开 → 弧线旋转收拢 → 爱心阵型 → 粉色爆炸
  // 总时长 ~5200ms
  // ====================================================================
  function makeCloneStage(image, options) {
    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const timeline = options.timeline || {};
    const palette  = timeline.palette || {};
    const pink     = hex(palette.secondary, 0xff7eb8);
    const gold     = hex(palette.primary,   0xffd580);
    const cream    = hex(palette.accent,    0xfff4e8);
    const rawSrc   = options.sourceCenter || { x: W / 2, y: H * 0.62 };
    const petScale = clamp(((options.petSize && options.petSize.w) || 192) / FRAME_W, 0.72, 1.1);
    const SPREAD   = clamp(Math.min(W, H) * 0.22, 130, 220);
    const src      = clampPoint(rawSrc, {
      left: SPREAD + 160, right: W - SPREAD - 160,
      top: SPREAD * 0.7 + 110, bottom: H - SPREAD * 0.7 - 110,
    });

    const HEART_ROW = 38;   // 比心手势
    const CLONE_ROWS = [
      { row: 0,  frames: 6 }, { row: 3,  frames: 4 },
      { row: 4,  frames: 5 }, { row: 21, frames: 8 },
      { row: 25, frames: 8 }, { row: 7,  frames: 6 },
    ];

    const root = new PIXI.Container();
    app.stage.addChild(root);

    // 背景光晕
    const bgGlow = makeGlowDisk(Math.min(W, H) * 0.24, pink, 0.16);
    bgGlow.position.set(src.x, src.y - 20);
    bgGlow.blendMode = 'screen';
    bgGlow.alpha = 0;
    root.addChild(bgGlow);

    // 旋转封印圈
    const ring1 = makeRing(72, pink, 0.5, 2);
    ring1.position.set(src.x, src.y - 20);
    ring1.blendMode = 'screen'; ring1.alpha = 0;
    root.addChild(ring1);
    const ring2 = makeRing(48, gold, 0.4, 1.5);
    ring2.position.set(src.x, src.y - 20);
    ring2.blendMode = 'screen'; ring2.alpha = 0;
    root.addChild(ring2);

    // 12个分身（3波，每波4个）
    // 爱心阵型目标位置（12点围成爱心轮廓）
    const heartShape = [
      { dx: -0.55, dy: -0.45 }, { dx: -0.28, dy: -0.62 },
      { dx:  0.00, dy: -0.55 }, { dx:  0.28, dy: -0.62 },
      { dx:  0.55, dy: -0.45 }, { dx:  0.62, dy: -0.15 },
      { dx:  0.45, dy:  0.18 }, { dx:  0.22, dy:  0.45 },
      { dx:  0.00, dy:  0.62 }, { dx: -0.22, dy:  0.45 },
      { dx: -0.45, dy:  0.18 }, { dx: -0.62, dy: -0.15 },
    ];
    // 第一轮扩散目标（放射状）
    const spreadAngles = [
      -150,-106,-62,-18, 18, 62, 106, 150, -88, 88, -180, 0
    ];

    const clones = [];
    for (let i = 0; i < 12; i++) {
      const def  = CLONE_ROWS[i % CLONE_ROWS.length];
      const sp   = makeAnimation(image, def.row, def.frames);
      const wave = Math.floor(i / 4); // 0,1,2
      const ang  = spreadAngles[i] * Math.PI / 180;
      const hpt  = heartShape[i];
      sp.position.set(src.x, src.y);
      sp.scale.set(petScale * 0.52);
      sp.alpha = 0;
      sp.filters = [
        maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
          distance: 10, outerStrength: 1.3,
          color: i % 2 ? pink : gold, quality: 0.22,
        }),
      ].filter(Boolean);
      root.addChild(sp);
      clones.push({
        sp, wave,
        // 扩散目标
        spreadX: src.x + Math.cos(ang) * SPREAD,
        spreadY: src.y + Math.sin(ang) * SPREAD * 0.6 - 20,
        // 爱心阵型目标
        heartX: src.x + hpt.dx * SPREAD * 0.9,
        heartY: src.y + hpt.dy * SPREAD * 0.7 - 30,
        phase: i * 0.55,
      });
    }

    // 主体（最后切比心手势）
    const main = makeAnimation(image, IDLE_ROW, IDLE_FRAMES);
    main.position.set(src.x, src.y);
    main.scale.set(petScale);
    main.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 16, outerStrength: 1.6, color: pink, quality: 0.2,
      }),
    ].filter(Boolean);
    root.addChild(main);

    // 比心手势主体（切换用，初始不可见）
    const mainHeart = makeAnimation(image, HEART_ROW, 8);
    mainHeart.position.set(src.x, src.y);
    mainHeart.scale.set(petScale);
    mainHeart.alpha = 0;
    mainHeart.filters = main.filters;
    root.addChild(mainHeart);

    // 爱心粒子爆炸用容器
    const heartParts = new PIXI.Container();
    heartParts.blendMode = 'screen';
    root.addChild(heartParts);
    const dotPink = makeDotTexture(pink, 28, true);
    const dotCream = makeDotTexture(cream, 20, true);

    // 闪光盘
    const flash = makeGlowDisk(100, cream, 0.82);
    flash.position.set(src.x, src.y - 20);
    flash.blendMode = 'screen';
    flash.alpha = 0;
    root.addChild(flash);

    // 粒子
    addEmitter(heartParts, dotPink, {
      lifetimeMin: 0.4, lifetimeMax: 0.9,
      frequency: 0.015, particlesPerWave: 3,
      emitterLifetime: 0.8, maxParticles: 160,
      alphaStart: 0.9, alphaEnd: 0,
      scaleStart: 0.32, scaleEnd: 0.04,
      colorStart: 'ffb8d8', colorEnd: 'ff4090',
      speedStart: 240, speedEnd: 30,
      spawnData: { x: 0, y: 0, radius: 18 },
    }, src.x, src.y - 20);

    // ---- 时序常量 ----
    // 0      - 300   : 蓄力，环出现
    // 300    - 1600  : 3波飞散（每波错开200ms）
    // 1600   - 2800  : 分身弧线旋转漂浮
    // 2800   - 3800  : 弧线收拢到爱心阵型
    // 3800   - 4400  : 爱心阵型稳定，主体切比心
    // 4400   - 5000  : 爱心粒子爆炸，fadeOut
    const WAVE_DELAYS  = [300, 500, 700]; // 每波第一个分身飞出时间
    const RECALL_START = 2800;
    const HEART_START  = 3800;
    const BURST_START  = 4400;
    const END          = 5200;

    return {
      duration: END,
      update(elapsed) {
        const fadeOut = 1 - segment(elapsed, BURST_START + 200, END);

        // 环形背景
        bgGlow.alpha  = clamp(segment(elapsed, 0, 400) * 0.9, 0, 0.9) * fadeOut;
        ring1.alpha   = clamp(segment(elapsed, 100, 500) * 0.8, 0, 0.8) * fadeOut;
        ring2.alpha   = clamp(segment(elapsed, 200, 600) * 0.6, 0, 0.6) * fadeOut;
        ring1.rotation = elapsed * 0.0028;
        ring2.rotation = -elapsed * 0.0036;

        // 主体切换
        const heartT = segment(elapsed, HEART_START, HEART_START + 300);
        main.alpha      = (1 - heartT) * fadeOut;
        mainHeart.alpha = heartT * fadeOut;
        main.rotation   = Math.sin(elapsed * 0.007) * 0.018;

        // 闪光
        const burstPulse = Math.sin(segment(elapsed, BURST_START, BURST_START + 600) * Math.PI);
        flash.alpha = burstPulse * 0.65;
        flash.scale.set(0.5 + burstPulse * 1.2);

        root.alpha = fadeOut;

        // 分身
        for (let i = 0; i < clones.length; i++) {
          const c = clones[i];
          const waveDelay = WAVE_DELAYS[c.wave] + (i % 4) * 55;

          // Phase1: 飞散
          const outT = easeOutBack(segment(elapsed - waveDelay, 0, 700));
          // Phase2: 漂浮
          const floatT = segment(elapsed, 1600, 2800);
          // Phase3: 爱心收拢（弧线）
          const recallT = easeInOutCubic(segment(elapsed, RECALL_START, HEART_START));
          // Phase4: 爱心阵型稳定
          const stableT = segment(elapsed, HEART_START, BURST_START);
          // Phase5: 粒子爆炸消失
          const burstFade = 1 - segment(elapsed, BURST_START, BURST_START + 400);

          // 当前漂浮位置（扩散点 + 小幅正弦）
          const fx = c.spreadX + Math.sin(elapsed * 0.0045 + c.phase) * 12 * floatT;
          const fy = c.spreadY + Math.cos(elapsed * 0.0035 + c.phase) * 7  * floatT;

          // 最终位置：爱心阵型
          const tx = mix(fx, c.heartX, recallT);
          const ty = mix(fy, c.heartY, recallT);

          // 稳定后微动
          const sx2 = tx + Math.sin(elapsed * 0.006 + c.phase) * 3 * stableT;
          const sy2 = ty + Math.cos(elapsed * 0.005 + c.phase) * 3 * stableT;

          c.sp.x = mix(src.x, sx2, outT);
          c.sp.y = mix(src.y, sy2, outT);
          c.sp.rotation = Math.sin(elapsed * 0.009 + c.phase) * 0.12 * (1 - recallT);
          c.sp.alpha = clamp(
            segment(elapsed - waveDelay, 80, 400) * burstFade * fadeOut,
            0, 0.88,
          );
          c.sp.scale.set(petScale * mix(0.52, 0.40, recallT));
        }
      },
    };
  }

  // ====================================================================
  // 法相天地 —— 韩立结婴：蓄力→破壳→元婴飘升+雷劫→合体冲击波
  // 总时长 ~7000ms
  // ====================================================================
  function makeDharmaStage(image, options) {
    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const timeline = options.timeline || {};
    const palette  = timeline.palette || {};
    const gold     = hex(palette.seal,      0xffd36f);
    const cyan     = hex(palette.spark,     0xc9f8ff);
    const lightning= hex(palette.lightning, 0xfff2bc);
    const src      = options.sourceCenter || { x: W / 2, y: H * 0.70 };
    const arena    = options.arenaCenter   || { x: W / 2, y: H * 0.44 };
    const petScale = clamp(((options.petSize && options.petSize.w) || 192) / FRAME_W, 0.76, 1.16);

    const NASCENT_ROW = 39; // 元婴

    const root = new PIXI.Container();
    app.stage.addChild(root);

    // ── 暗化背景 ──
    const dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x020610, alpha: 0.3 });
    dim.alpha = 0;
    root.addChild(dim);

    // ── Phase1 蓄力：灵气漩涡（多层旋转环） ──
    const spiralRings = [];
    for (let i = 0; i < 4; i++) {
      const r = makeRing(50 + i * 28, gold, 0.55 - i * 0.08, 1.8 - i * 0.2);
      r.position.set(src.x, src.y - 30);
      r.blendMode = 'screen'; r.alpha = 0;
      root.addChild(r);
      spiralRings.push({ g: r, speed: (i % 2 ? 1 : -1) * (0.003 + i * 0.0008) });
    }

    // 地面裂缝光效
    const crackGlow = makeGlowDisk(120, gold, 0.45);
    crackGlow.position.set(src.x, src.y + 60);
    crackGlow.blendMode = 'screen'; crackGlow.alpha = 0;
    root.addChild(crackGlow);

    // ── Phase2 破壳：金丹爆闪 ──
    const shellFlash = makeGlowDisk(160, gold, 1.0);
    shellFlash.position.set(src.x, src.y - 20);
    shellFlash.blendMode = 'screen'; shellFlash.alpha = 0;
    root.addChild(shellFlash);

    // ── 主体 Yoyo ──
    const main = makeAnimation(image, IDLE_ROW, IDLE_FRAMES);
    main.position.set(src.x, src.y);
    main.scale.set(petScale);
    main.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 14, outerStrength: 1.5, color: gold, quality: 0.22,
      }),
    ].filter(Boolean);
    root.addChild(main);

    // ── 元婴（小版，从主体飘出） ──
    const nascent = makeAnimation(image, NASCENT_ROW, 8);
    nascent.position.set(src.x, src.y - 20);
    nascent.scale.set(petScale * 0.38);
    nascent.alpha = 0;
    nascent.blendMode = 'screen';
    nascent.tint = 0xfff0b0;
    nascent.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 22, outerStrength: 2.2, color: gold, quality: 0.28,
      }),
    ].filter(Boolean);
    root.addChild(nascent);

    // ── 金色光柱（天降） ──
    const pillar = new PIXI.Graphics();
    pillar.alpha = 0;
    root.addChild(pillar);
    function drawPillar(alpha) {
      pillar.clear();
      const cx2 = arena.x;
      for (let i = 0; i < 5; i++) {
        const w = 30 - i * 4;
        const a = (alpha * (0.55 - i * 0.08));
        pillar.rect(cx2 - w / 2, 0, w, H * 0.85).fill({ color: gold, alpha: a });
      }
    }

    // ── 封印符文环（结婴标志） ──
    const sealOuter = makeRing(110, gold, 0.72, 2.5);
    sealOuter.position.set(arena.x, arena.y + 100);
    sealOuter.scale.y = 0.3;
    sealOuter.blendMode = 'screen'; sealOuter.alpha = 0;
    root.addChild(sealOuter);

    const sealInner = makeRing(68, cyan, 0.6, 2);
    sealInner.position.set(arena.x, arena.y + 108);
    sealInner.scale.y = 0.3;
    sealInner.blendMode = 'screen'; sealInner.alpha = 0;
    root.addChild(sealInner);

    // ── 雷劫闪电（4条） ──
    const bolts = [];
    for (let i = 0; i < 4; i++) {
      const bolt = makeLightning(i % 2 ? lightning : cyan, 0.7, i * 1.9 + 0.5);
      bolt.position.set(arena.x, arena.y + 60);
      bolt.alpha = 0; bolt.blendMode = 'screen';
      root.addChild(bolt);
      bolts.push(bolt);
    }

    // ── 粒子系统 ──
    const ptContainer = new PIXI.Container();
    ptContainer.blendMode = 'screen';
    root.addChild(ptContainer);
    const dotGold = makeDotTexture(gold, 30, true);
    const dotCyan = makeDotTexture(cyan, 22, true);

    // 蓄力粒子（绕主体）
    addEmitter(ptContainer, dotGold, {
      lifetimeMin: 0.5, lifetimeMax: 1.2,
      frequency: 0.022, particlesPerWave: 2,
      emitterLifetime: 1.8, maxParticles: 100,
      alphaStart: 0.75, alphaEnd: 0,
      scaleStart: 0.28, scaleEnd: 0.04,
      colorStart: 'ffd36f', colorEnd: 'fff2bc',
      speedStart: 90, speedEnd: 15,
      spawnData: { x: 0, y: 0, radius: 50 },
    }, src.x, src.y - 20);

    // 元婴粒子（绕元婴）
    addEmitter(ptContainer, dotCyan, {
      lifetimeMin: 0.4, lifetimeMax: 0.9,
      frequency: 0.018, particlesPerWave: 2,
      emitterLifetime: 3.2, maxParticles: 140,
      alphaStart: 0.82, alphaEnd: 0,
      scaleStart: 0.24, scaleEnd: 0.03,
      colorStart: 'c9f8ff', colorEnd: 'ffd36f',
      speedStart: 120, speedEnd: 20,
      spawnData: { x: 0, y: 0, radius: 60 },
    }, arena.x, arena.y - 20);

    // ── 冲击波（合体用） ──
    const shockFilter = maybeFilter(
      PIXI.filters && PIXI.filters.ShockwaveFilter,
      { center: { x: arena.x, y: arena.y + 80 }, amplitude: 22, wavelength: 140, brightness: 1.1, radius: -1, speed: 520 },
    );
    if (shockFilter) app.stage.filters = [shockFilter];

    // 合体时白光
    const mergeFlash = makeGlowDisk(200, 0xffffff, 0.9);
    mergeFlash.position.set(arena.x, arena.y - 20);
    mergeFlash.blendMode = 'screen'; mergeFlash.alpha = 0;
    root.addChild(mergeFlash);

    // ── 时序 ──
    // 0    - 800  : Phase1 蓄力，漩涡旋转，地面发光
    // 800  - 1400 : Phase2 破壳，金丹爆闪
    // 1400 - 2400 : Phase3a 元婴破壳飘出上升
    // 2400 - 5000 : Phase3b 元婴稳定飘浮，雷劫，金柱
    // 5000 - 5800 : Phase4a 元婴落回合体
    // 5800 - 6200 : Phase4b 合体冲击波 + 白光
    // 6200 - 7000 : fadeOut
    const P1_END    = 800;
    const P2_END    = 1400;
    const P3A_END   = 2400;
    const P3B_END   = 5000;
    const P4A_END   = 5800;
    const P4B_END   = 6200;
    const END       = 7000;

    return {
      duration: END,
      update(elapsed) {
        const fadeOut = 1 - segment(elapsed, P4B_END, END);
        root.alpha = fadeOut;

        // Phase1：蓄力
        const chargeT = segment(elapsed, 0, P1_END);
        dim.alpha = chargeT * 0.55 * (1 - segment(elapsed, P4B_END, END));
        crackGlow.alpha = chargeT * 0.8;
        crackGlow.scale.set(0.6 + chargeT * 0.6 + Math.sin(elapsed * 0.015) * 0.08);
        for (let i = 0; i < spiralRings.length; i++) {
          const sr = spiralRings[i];
          sr.g.alpha = chargeT * (0.55 - i * 0.08) * (1 - segment(elapsed, P4A_END, P4B_END));
          sr.g.rotation += sr.speed * (1 + chargeT * 2);
          sr.g.scale.set(0.8 + chargeT * 0.3 + Math.sin(elapsed * 0.01 + i) * 0.04);
        }

        // Phase2：破壳爆闪
        const shellT = Math.sin(segment(elapsed, P1_END, P2_END) * Math.PI);
        shellFlash.alpha = shellT * 0.85;
        shellFlash.scale.set(0.5 + shellT * 1.5);

        // 主体
        const mergeT   = easeInOutCubic(segment(elapsed, P3B_END, P4A_END));
        const mainGlow = 1 + segment(elapsed, P1_END, P3A_END) * 0.35;
        main.scale.set(petScale * mainGlow * (1 - mergeT * 0.1));
        main.alpha = (1 - segment(elapsed, P3B_END, P4A_END) * 0.5) * fadeOut;
        main.rotation = Math.sin(elapsed * 0.005) * 0.018;

        // Phase3a：元婴飘出
        const riseT = easeOutCubic(segment(elapsed, P2_END, P3A_END));
        const nascentY = mix(src.y - 20, arena.y - 40, riseT)
          + Math.sin(elapsed * 0.005) * 5 * segment(elapsed, P3A_END, P3B_END);
        const nascentX = arena.x + Math.sin(elapsed * 0.004) * 8 * segment(elapsed, P3A_END, P3B_END);

        // Phase4a：元婴落回
        const nascentFinalX = mix(nascentX, src.x, mergeT);
        const nascentFinalY = mix(nascentY, src.y - 30, mergeT);
        nascent.position.set(nascentFinalX, nascentFinalY);
        nascent.scale.set(petScale * mix(0.38, mix(0.38, 0.96, segment(elapsed, P3A_END, P3B_END)), riseT) * (1 - mergeT * 0.7));
        nascent.alpha = clamp(
          segment(elapsed, P2_END, P3A_END) * (1 - segment(elapsed, P4A_END, P4B_END)),
          0, 1,
        ) * fadeOut;
        nascent.rotation = Math.sin(elapsed * 0.003) * 0.022;

        // 光柱
        const pillarT = segment(elapsed, P3A_END, P3B_END);
        drawPillar(pillarT * (1 - mergeT));
        pillar.alpha = pillarT * fadeOut;

        // 封印环
        const sealT = segment(elapsed, P3A_END, P3B_END);
        sealOuter.alpha = sealT * 0.9 * (1 - mergeT) * fadeOut;
        sealOuter.rotation = elapsed * 0.0018;
        sealOuter.scale.x = 0.7 + sealT * 1.1;
        sealOuter.scale.y = (0.7 + sealT * 1.1) * 0.3;
        sealInner.alpha = sealT * 0.75 * (1 - mergeT) * fadeOut;
        sealInner.rotation = -elapsed * 0.0024;
        sealInner.scale.x = sealOuter.scale.x * 0.85;
        sealInner.scale.y = sealOuter.scale.y;

        // 雷劫
        const thunderT = segment(elapsed, P3A_END + 300, P3B_END);
        for (let i = 0; i < bolts.length; i++) {
          const pulse = Math.max(0, Math.sin(elapsed * 0.016 + i * 1.5));
          bolts[i].alpha = pulse * thunderT * (1 - mergeT) * fadeOut * 0.9;
          bolts[i].rotation = Math.sin(elapsed * 0.004 + i) * 0.07;
        }

        // 合体冲击波
        if (shockFilter) {
          shockFilter.time = Math.max(0, (elapsed - P4A_END) / 1000);
        }
        const mergeFlashT = Math.sin(segment(elapsed, P4A_END, P4B_END) * Math.PI);
        mergeFlash.alpha = mergeFlashT * 0.75;
        mergeFlash.scale.set(0.6 + mergeFlashT * 1.8);
      },
      destroy() {
        if (shockFilter) app.stage.filters = [];
      },
    };
  }

  function tick() {
    const now = performance.now();
    const delta = state.lastNow ? (now - state.lastNow) * 0.001 : 0;
    state.lastNow = now;
    for (const emitter of state.emitters) emitter.update(delta);
    const elapsed = now - state.startedAt;
    if (state.scene) state.scene.update(elapsed);
    if (elapsed > state.duration) {
      if (state.scene && state.scene.destroy) state.scene.destroy();
      closeSoon();
    }
  }

  async function startPixiEffect(options) {
    if (!window.PIXI) throw new Error('PIXI is not loaded');
    state.effectType = options.effectType || 'clone';
    state.timeline = options.timeline || {};
    state.sourceCenter = options.sourceCenter;
    state.arenaCenter = options.arenaCenter;
    state.petSize = options.petSize;
    state.app = await initApp();
    const image = await loadImage(options.spriteSrc);
    const sceneOptions = {
      timeline: state.timeline,
      sourceCenter: state.sourceCenter,
      arenaCenter: state.arenaCenter,
      petSize: state.petSize,
    };
    state.scene = state.effectType === 'dharma'
      ? makeDharmaStage(image, sceneOptions)
      : makeCloneStage(image, sceneOptions);
    state.duration = state.scene.duration;
    state.startedAt = performance.now();
    state.lastNow = state.startedAt;
    state.app.ticker.add(tick);
  }

  window.startPixiEffect = function (options) {
    startPixiEffect(options).catch((error) => {
      console.error('[pixi-effect] start failed', error);
      setTimeout(closeSoon, 1000);
    });
  };

  window.addEventListener('beforeunload', clearEmitters);
})();
