(function () {
  const FRAME_W = 192;
  const FRAME_H = 208;
  const IDLE_ROW = 0;
  const IDLE_FRAMES = 8;
  const CLONE_ROWS = [
    { row: 0, frames: 8 },
    { row: 3, frames: 4 },
    { row: 4, frames: 5 },
    { row: 21, frames: 8 },
    { row: 25, frames: 8 },
  ];
  const DHARMA_CHARGE_ROW = 33;
  const DHARMA_SPIRIT_ROW = 34;
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

  function makeFrameSpriteWithAlphaBox(image, row, col) {
    const safeRow = getSafeRow(image, row);
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      col * FRAME_W,
      safeRow * FRAME_H,
      FRAME_W,
      FRAME_H,
      0,
      0,
      FRAME_W,
      FRAME_H
    );
    const pixels = ctx.getImageData(0, 0, FRAME_W, FRAME_H).data;
    let minX = FRAME_W;
    let minY = FRAME_H;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    for (let y = 0; y < FRAME_H; y += 1) {
      for (let x = 0; x < FRAME_W; x += 1) {
        const alpha = pixels[(y * FRAME_W + x) * 4 + 3];
        if (alpha <= 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
    const box = count
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : { x: 0, y: 0, width: FRAME_W, height: FRAME_H };
    const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    sprite.anchor.set(0, 0);
    return { sprite, box };
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
      { row: 0,  frames: 8 }, { row: 3,  frames: 4 },
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

    const cloneCount = clamp(Number(timeline.cloneCount) || 9, 5, 12);

    // 分身：默认 9 个全身 Yoyo。数量少一点，阵型会更清楚，也不容易像杂乱贴纸。
    // 爱心阵型目标位置（最多 12 点围成爱心轮廓）
    const heartShape = [
      { dx: -0.55, dy: -0.45 }, { dx: -0.28, dy: -0.62 },
      { dx:  0.00, dy: -0.55 }, { dx:  0.28, dy: -0.62 },
      { dx:  0.55, dy: -0.45 }, { dx:  0.62, dy: -0.15 },
      { dx:  0.45, dy:  0.18 }, { dx:  0.22, dy:  0.45 },
      { dx:  0.00, dy:  0.62 }, { dx: -0.22, dy:  0.45 },
      { dx: -0.45, dy:  0.18 }, { dx: -0.62, dy: -0.15 },
    ];
    // 第一轮扩散目标（放射状）
    const spreadAngles = [-150, -112, -74, -36, 0, 36, 74, 112, 150, -180, -88, 88];

    const clones = [];
    for (let i = 0; i < cloneCount; i++) {
      const def  = CLONE_ROWS[i % CLONE_ROWS.length];
      const sp   = makeAnimation(image, def.row, def.frames);
      const wave = Math.floor(i / 3); // 0,1,2 for the default 9-clone layout
      const ang  = spreadAngles[i] * Math.PI / 180;
      const heartIndex = cloneCount === 9
        ? [0, 1, 3, 4, 6, 8, 9, 10, 11][i]
        : i;
      const hpt  = heartShape[heartIndex] || heartShape[i % heartShape.length];
      sp.position.set(src.x, src.y);
      sp.scale.set(petScale * 0.56);
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
        spreadY: src.y + Math.sin(ang) * SPREAD * 0.58 - 18,
        // 爱心阵型目标
        heartX: src.x + hpt.dx * SPREAD * 0.92,
        heartY: src.y + hpt.dy * SPREAD * 0.72 - 28,
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
    const WAVE_DELAYS  = [300, 500, 700, 900]; // 每波第一个分身飞出时间
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
  // 总时长 4100ms（由 timeline.durationMs 决定）
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

    const GUARDIAN_ROW = DHARMA_SPIRIT_ROW;

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

    // ── 背后大型法相：必须是 Yoyo 的人形守护层，不再使用后续扩展动作行 ──
    const nascent = makeAnimation(image, GUARDIAN_ROW, 8);
    nascent.position.set(arena.x, arena.y + 120);
    nascent.scale.set(petScale * 1.7);
    nascent.alpha = 0;
    nascent.blendMode = 'screen';
    nascent.tint = 0xfff0b0;
    nascent.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 24, outerStrength: 2.4, color: gold, quality: 0.28,
      }),
    ].filter(Boolean);
    root.addChild(nascent);

    // ── 前景主体 Yoyo ──
    const main = makeAnimation(image, IDLE_ROW, IDLE_FRAMES);
    main.position.set(src.x, src.y);
    main.scale.set(petScale);
    main.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 14, outerStrength: 1.5, color: gold, quality: 0.22,
      }),
    ].filter(Boolean);
    root.addChild(main);

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
    // 0    - 900  : 蓄力，脚下封印与地面光
    // 900  - 2100 : 背后大型法相升起
    // 2100 - 3300 : 法相稳定守护，雷光与封印环叠前景
    // 3300 - 4100 : 收束淡出
    const P1_END    = 900;
    const P2_END    = 1500;
    const P3A_END   = 2100;
    const P3B_END   = 3300;
    const P4A_END   = 3600;
    const P4B_END   = 4100;
    const END       = Number(timeline.durationMs) || 4100;

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

        // Phase3a：背后法相从主体身后升起。前景 Yoyo 保持正常比例和脚下重量。
        const riseT = easeOutCubic(segment(elapsed, P2_END, P3A_END));
        const nascentY = mix(src.y - 8, arena.y + 42, riseT)
          + Math.sin(elapsed * 0.005) * 5 * segment(elapsed, P3A_END, P3B_END);
        const nascentX = arena.x + Math.sin(elapsed * 0.004) * 8 * segment(elapsed, P3A_END, P3B_END);

        // Phase4a：法相收束到主体背后，而不是小人漂回身体里。
        const nascentFinalX = mix(nascentX, src.x, mergeT);
        const nascentFinalY = mix(nascentY, src.y - 8, mergeT);
        nascent.position.set(nascentFinalX, nascentFinalY);
        nascent.scale.set(petScale * mix(1.05, 2.15, riseT) * (1 - mergeT * 0.58));
        nascent.alpha = clamp(
          segment(elapsed, P2_END, P3A_END) * (1 - segment(elapsed, P4A_END, P4B_END)),
          0, 0.58,
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

  // ====================================================================
  // 入锅温泉 —— 跳入锅中 → 锅沿遮挡 → 蒸汽和汤面动效 → 探头收尾
  // 这是 Pixi 动态表演，不使用静态 pose 贴图。
  // ====================================================================
  function makeCookPotStage(image, options) {
    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const timeline = options.timeline || {};
    const palette = timeline.palette || {};
    const potColor = hex(palette.pot, 0xf2a46f);
    const potDark = hex(palette.potDark, 0xb96542);
    const broth = hex(palette.broth, 0xffe0a0);
    const steam = hex(palette.steam, 0xfff7e8);
    const spark = hex(palette.spark, 0xffd06d);
    const src = options.sourceCenter || { x: W / 2, y: H * 0.70 };
    const arena = options.arenaCenter || { x: src.x, y: src.y + 8 };
    const petScale = clamp(((options.petSize && options.petSize.w) || 192) / FRAME_W, 0.72, 1.08);
    const potScale = petScale * 1.02;
    const potW = 205 * potScale;
    const potH = 116 * potScale;

    const root = new PIXI.Container();
    app.stage.addChild(root);

    const dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x160b08, alpha: 0.15 });
    dim.alpha = 0;
    root.addChild(dim);

    const potBack = new PIXI.Graphics();
    potBack.ellipse(0, -potH * 0.18, potW * 0.48, potH * 0.28).fill({ color: potDark, alpha: 0.94 });
    potBack.ellipse(0, -potH * 0.2, potW * 0.42, potH * 0.2).fill({ color: broth, alpha: 0.96 });
    potBack.roundRect(-potW * 0.5, -potH * 0.18, potW, potH * 0.7, potH * 0.18).fill({ color: potColor, alpha: 1 });
    potBack.ellipse(-potW * 0.58, potH * 0.05, potW * 0.12, potH * 0.16).fill({ color: potDark, alpha: 0.95 });
    potBack.ellipse(potW * 0.58, potH * 0.05, potW * 0.12, potH * 0.16).fill({ color: potDark, alpha: 0.95 });
    potBack.position.set(arena.x, arena.y + potH * 0.08);
    potBack.alpha = 0;
    root.addChild(potBack);

    const brothGlow = makeGlowDisk(75 * potScale, spark, 0.22);
    brothGlow.position.set(arena.x, arena.y - potH * 0.1);
    brothGlow.scale.y = 0.28;
    brothGlow.blendMode = 'screen';
    brothGlow.alpha = 0;
    root.addChild(brothGlow);

    const yoyoJump = makeAnimation(image, 3, 4);
    yoyoJump.position.set(src.x, src.y);
    yoyoJump.scale.set(petScale);
    yoyoJump.alpha = 0;
    yoyoJump.filters = [
      maybeFilter(PIXI.filters && PIXI.filters.GlowFilter, {
        distance: 9, outerStrength: 0.8, color: spark, quality: 0.18,
      }),
    ].filter(Boolean);
    root.addChild(yoyoJump);

    const yoyoInPot = makeAnimation(image, 7, 6);
    yoyoInPot.position.set(arena.x, arena.y - potH * 0.24);
    yoyoInPot.scale.set(petScale * 0.62);
    yoyoInPot.alpha = 0;
    yoyoInPot.filters = yoyoJump.filters;
    root.addChild(yoyoInPot);

    const potFront = new PIXI.Graphics();
    potFront.ellipse(0, -potH * 0.06, potW * 0.51, potH * 0.23).stroke({ width: 9 * potScale, color: 0xffc38b, alpha: 0.98 });
    potFront.roundRect(-potW * 0.5, potH * 0.03, potW, potH * 0.49, potH * 0.17).fill({ color: potColor, alpha: 1 });
    potFront.ellipse(0, potH * 0.47, potW * 0.38, potH * 0.08).fill({ color: 0x6d3f2c, alpha: 0.22 });
    potFront.position.set(arena.x, arena.y + potH * 0.08);
    potFront.alpha = 0;
    root.addChild(potFront);

    const lid = new PIXI.Graphics();
    lid.roundRect(-potW * 0.32, -potH * 0.08, potW * 0.64, potH * 0.16, potH * 0.08).fill({ color: 0xffc08a, alpha: 0.96 });
    lid.circle(0, -potH * 0.1, potH * 0.08).fill({ color: potDark, alpha: 1 });
    lid.position.set(arena.x + potW * 0.36, arena.y - potH * 0.78);
    lid.rotation = -0.28;
    lid.alpha = 0;
    root.addChild(lid);

    const steamLayer = new PIXI.Container();
    steamLayer.blendMode = 'screen';
    root.addChild(steamLayer);
    const steamDot = makeDotTexture(steam, 42, true);
    const sparkDot = makeDotTexture(spark, 20, true);
    addEmitter(steamLayer, steamDot, {
      lifetimeMin: 0.7, lifetimeMax: 1.5,
      frequency: 0.035, particlesPerWave: 2,
      emitterLifetime: 4.1, maxParticles: 80,
      alphaStart: 0.42, alphaEnd: 0,
      scaleStart: 0.28, scaleEnd: 0.84,
      colorStart: 'fff7e8', colorEnd: 'ffffff',
      speedStart: 42, speedEnd: 8,
      spawnType: 'rect',
      spawnData: { x: -potW * 0.32, y: -potH * 0.28, w: potW * 0.64, h: 8 },
    }, arena.x, arena.y);
    addEmitter(steamLayer, sparkDot, {
      lifetimeMin: 0.35, lifetimeMax: 0.85,
      frequency: 0.055, particlesPerWave: 1,
      emitterLifetime: 2.8, maxParticles: 34,
      alphaStart: 0.6, alphaEnd: 0,
      scaleStart: 0.18, scaleEnd: 0.04,
      colorStart: 'ffd06d', colorEnd: 'fff7cf',
      speedStart: 65, speedEnd: 12,
      spawnData: { x: 0, y: 0, radius: 12 },
    }, arena.x, arena.y - potH * 0.22);

    const shadow = makeGlowDisk(90 * potScale, 0x4f2d24, 0.24);
    shadow.position.set(arena.x, arena.y + potH * 0.54);
    shadow.scale.y = 0.18;
    shadow.alpha = 0;
    root.addChildAt(shadow, 0);

    const END = Number(timeline.durationMs) || 5200;
    const POT_IN = 220;
    const JUMP_START = 520;
    const SPLASH = 1800;
    const SOAK = 2450;
    const POP = 4100;
    const FADE = 4850;

    return {
      duration: END,
      update(elapsed) {
        const fadeOut = 1 - segment(elapsed, FADE, END);
        root.alpha = fadeOut;
        dim.alpha = segment(elapsed, 0, 600) * 0.55 * fadeOut;
        const potInT = easeOutBack(segment(elapsed, 0, POT_IN + 520));
        potBack.alpha = potInT;
        potFront.alpha = potInT;
        shadow.alpha = potInT * 0.72;
        brothGlow.alpha = segment(elapsed, 900, SOAK) * 0.75 * fadeOut;
        brothGlow.scale.set(0.82 + Math.sin(elapsed * 0.008) * 0.08, 0.22 + Math.cos(elapsed * 0.01) * 0.03);

        const jumpT = easeInOutCubic(segment(elapsed, JUMP_START, SPLASH));
        const arc = Math.sin(jumpT * Math.PI);
        yoyoJump.alpha = segment(elapsed, JUMP_START, JUMP_START + 260) * (1 - segment(elapsed, SPLASH - 180, SPLASH + 80));
        yoyoJump.x = mix(src.x, arena.x, jumpT);
        yoyoJump.y = mix(src.y, arena.y - potH * 0.18, jumpT) - arc * 125 * petScale;
        yoyoJump.rotation = Math.sin(jumpT * Math.PI * 1.4) * 0.18;
        yoyoJump.scale.set(petScale * (1 - jumpT * 0.22));

        const soakT = segment(elapsed, SPLASH, POP);
        yoyoInPot.alpha = segment(elapsed, SPLASH - 60, SPLASH + 320) * (1 - segment(elapsed, FADE, END));
        yoyoInPot.x = arena.x + Math.sin(elapsed * 0.006) * 5 * soakT;
        yoyoInPot.y = arena.y - potH * 0.3 + Math.sin(elapsed * 0.009) * 6 * soakT - segment(elapsed, POP, FADE) * 28;
        yoyoInPot.rotation = Math.sin(elapsed * 0.005) * 0.045 * soakT;
        yoyoInPot.scale.set(petScale * mix(0.46, 0.66, segment(elapsed, POP, FADE)));

        const splashPulse = Math.sin(segment(elapsed, SPLASH - 120, SPLASH + 520) * Math.PI);
        potBack.scale.set(1 + splashPulse * 0.035, 1 - splashPulse * 0.018);
        potFront.scale.set(1 + splashPulse * 0.035, 1 - splashPulse * 0.018);
        lid.alpha = segment(elapsed, SPLASH - 180, SPLASH + 200) * (1 - segment(elapsed, POP, FADE));
        lid.x = arena.x + potW * 0.36 + Math.sin(elapsed * 0.014) * 8;
        lid.y = arena.y - potH * 0.78 - splashPulse * 18 * petScale;
        lid.rotation = -0.28 + Math.sin(elapsed * 0.016) * 0.08;

        steamLayer.alpha = segment(elapsed, SPLASH - 200, SPLASH + 500) * (1 - segment(elapsed, FADE, END));
      },
    };
  }

  async function makeSpineActionStage(options) {
    const timeline = options.timeline || {};
    const spineSpec = timeline.spine || {};
    const hasRuntime = Boolean(window.spine && window.spine.Spine && PIXI.Assets);
    const hasAssets = Boolean(spineSpec.skeletonUrl && spineSpec.atlasUrl);
    if (!hasRuntime || !hasAssets) {
      console.warn('[pixi-effect] spine_missing_required_assets', JSON.stringify({
        hasRuntime,
        hasAssets,
        hasSkeletonUrl: Boolean(spineSpec.skeletonUrl),
        hasAtlasUrl: Boolean(spineSpec.atlasUrl),
        effectId: timeline.id,
      }));
      return makeMissingSpineAssetStage(options);
    }

    try {
      const skeletonAlias = `${timeline.id || 'spine-action'}-skeleton`;
      const atlasAlias = `${timeline.id || 'spine-action'}-atlas`;
      PIXI.Assets.add({ alias: skeletonAlias, src: spineSpec.skeletonUrl });
      PIXI.Assets.add({ alias: atlasAlias, src: spineSpec.atlasUrl });
      await PIXI.Assets.load([skeletonAlias, atlasAlias]);

      const app = state.app;
      const W = app.screen.width;
      const H = app.screen.height;
      const arena = options.arenaCenter || options.sourceCenter || { x: W / 2, y: H * 0.68 };
      const sceneMode = timeline.scene?.mode || (timeline.id === 'play-switch' ? 'game' : 'cartoon');
      const root = new PIXI.Container();
      app.stage.addChild(root);

      const dim = new PIXI.Graphics();
      dim.rect(0, 0, W, H).fill({ color: 0x0d1720, alpha: sceneMode === 'bath' ? 0.06 : 0.14 });
      root.addChild(dim);

      const boundsProvider = (() => {
        if (!window.spine?.SkinsAndAnimationBoundsProvider) return undefined;
        const animation = spineSpec.boundsAnimation || spineSpec.animation || null;
        const skins = spineSpec.skin ? [spineSpec.skin] : undefined;
        return new window.spine.SkinsAndAnimationBoundsProvider(animation, skins, 0.08, false);
      })();
      const character = window.spine.Spine.from({
        skeleton: skeletonAlias,
        atlas: atlasAlias,
        scale: Number(spineSpec.scale) || 1,
        autoUpdate: true,
        boundsProvider,
      });
      character.state.setAnimation(0, spineSpec.animation || 'idle', false);
      if (spineSpec.idleAnimation) character.state.addAnimation(0, spineSpec.idleAnimation, true, 0);
      if (spineSpec.skin && character.skeleton?.setSkinByName) {
        character.skeleton.setSkinByName(spineSpec.skin);
        if (character.skeleton.setupPose) character.skeleton.setupPose();
      }
      if (typeof character.update === 'function') character.update(0);
      const clearSlots = timeline.scene?.clearSlots || spineSpec.clearSlots || [];
      clearSlots.forEach((slotName) => {
        if (typeof character.skeleton?.setAttachment === 'function') {
          character.skeleton.setAttachment(slotName, null);
        }
      });

      if (sceneMode === 'bath') {
        if (timeline.scene?.characterSource === 'spritesheet') {
          return makeSpriteBathScene({ root, dim, image: options.image, arena, W, H, timeline });
        }
        return makeSpineBathScene({ root, dim, character, arena, W, H, timeline });
      }

      const tv = new PIXI.Container();
      tv.position.set(arena.x - 210, arena.y - 72);
      root.addChild(tv);
      const tvShadow = new PIXI.Graphics();
      tvShadow.ellipse(0, 112, 104, 16).fill({ color: 0x0b1118, alpha: 0.26 });
      tv.addChild(tvShadow);
      const tvBody = new PIXI.Graphics();
      tvBody.roundRect(-118, -72, 236, 154, 28).fill({ color: 0xf08c6e, alpha: 1 });
      tvBody.roundRect(-103, -56, 206, 112, 18).fill({ color: 0x232d3e, alpha: 1 });
      tvBody.rect(-72, 82, 144, 20).fill({ color: 0x8c5260, alpha: 1 });
      tvBody.circle(-84, 70, 8).fill({ color: 0xffd37b, alpha: 1 });
      tvBody.circle(-58, 70, 8).fill({ color: 0xffd37b, alpha: 1 });
      tv.addChild(tvBody);
      const tvScreen = new PIXI.Graphics();
      tv.addChild(tvScreen);
      const tvGlow = new PIXI.Graphics();
      tvGlow.roundRect(-96, -49, 192, 98, 16).fill({ color: 0x8bdcff, alpha: 0.18 });
      tvGlow.blendMode = 'screen';
      tv.addChild(tvGlow);

      character.position.set(arena.x + 130, arena.y + 88);
      root.addChild(character);

      return {
        duration: Number(timeline.durationMs) || 5600,
        update(elapsed) {
          const phase = elapsed * 0.003;
          tvScreen.clear();
          tvScreen.roundRect(-96, -49, 192, 98, 16).fill({ color: 0x8bdcff, alpha: 1 });
          if (sceneMode === 'game') {
            const playerX = -58 + Math.sin(phase * 2.3) * 34;
            const enemyX = 50 + Math.cos(phase * 1.7) * 28;
            tvScreen.rect(-91, 7, 182, 36).fill({ color: 0x7edb73, alpha: 1 });
            tvScreen.rect(-84, 22 + Math.sin(phase) * 4, 26, 21).fill({ color: 0x5ebc66, alpha: 1 });
            tvScreen.circle(playerX, -1 + Math.sin(phase * 4) * 5, 12).fill({ color: 0xffd36b, alpha: 1 });
            tvScreen.circle(playerX + 4, -6 + Math.sin(phase * 4) * 5, 4).fill({ color: 0xfff4c2, alpha: 1 });
            tvScreen.roundRect(enemyX, -14 + Math.cos(phase * 2) * 5, 24, 18, 6).fill({ color: 0x8a7cff, alpha: 1 });
            tvScreen.rect(-86, -38, 54, 7).fill({ color: 0xfff0a6, alpha: 0.9 });
            tvScreen.rect(-86, -38, 34 + Math.sin(phase * 1.6) * 14, 7).fill({ color: 0xff7f88, alpha: 0.95 });
          } else {
            tvScreen.rect(-91, -8 + Math.sin(phase) * 4, 182, 51).fill({ color: 0x8fdb70, alpha: 1 });
            tvScreen.circle(-38 + Math.sin(phase * 1.6) * 42, -4 + Math.cos(phase) * 7, 14).fill({ color: 0xff8fb2, alpha: 1 });
            tvScreen.circle(-45 + Math.sin(phase * 1.6) * 42, -9 + Math.cos(phase) * 7, 4).fill({ color: 0xe56f96, alpha: 1 });
          }
          tvScreen.rect(-2, -49, 4, 98).fill({ color: 0xffffff, alpha: 0.42 + Math.sin(phase * 2) * 0.12 });
          tvScreen.roundRect(-88, -41, 176, 82, 12).stroke({ color: 0xffffff, alpha: 0.36, width: 3 });
          tvGlow.alpha = 0.78 + Math.sin(phase * 2.4) * 0.16;
          tv.rotation = Math.sin(phase * 0.7) * 0.01;
          const fadeOut = 1 - segment(elapsed, (Number(timeline.durationMs) || 5600) - 650, Number(timeline.durationMs) || 5600);
          root.alpha = fadeOut;
        },
      };
    } catch (error) {
      console.warn('[pixi-effect] spine_missing_required_assets', JSON.stringify({ message: error.message, effectId: timeline.id }));
      return makeMissingSpineAssetStage(options);
    }
  }

  function makeSpineBathScene({ root, dim, character, arena, W, H, timeline }) {
    const scene = timeline.scene || {};
    const END = Number(timeline.durationMs) || 5600;
    const tubW = Math.min(W * 0.46, 370);
    const tubH = tubW * 0.42;
    const tub = {
      x: clamp(arena.x, tubW * 0.62, W - tubW * 0.62),
      y: clamp(arena.y + H * 0.02, H * 0.52, H - tubH * 0.36),
      w: tubW,
      h: tubH,
    };
    const innerFloor = {
      x: tub.x,
      y: tub.y - tub.h * 0.12,
    };

    const shadow = new PIXI.Graphics();
    shadow.ellipse(tub.x, tub.y + tub.h * 0.34, tub.w * 0.46, tub.h * 0.11).fill({ color: 0x203642, alpha: 0.18 });
    root.addChild(shadow);

    const back = new PIXI.Container();
    root.addChild(back);
    const tubBack = new PIXI.Graphics();
    tubBack.roundRect(-tub.w * 0.50, -tub.h * 0.48, tub.w, tub.h * 0.72, tub.h * 0.20)
      .fill({ color: 0xbad7df, alpha: 1 });
    tubBack.roundRect(-tub.w * 0.48, -tub.h * 0.43, tub.w * 0.96, tub.h * 0.56, tub.h * 0.17)
      .fill({ color: 0xdcedf2, alpha: 1 });
    tubBack.ellipse(0, -tub.h * 0.38, tub.w * 0.47, tub.h * 0.18)
      .fill({ color: 0xf9fbf7, alpha: 1 });
    tubBack.ellipse(0, -tub.h * 0.35, tub.w * 0.39, tub.h * 0.12)
      .fill({ color: 0x8fcfe3, alpha: 0.85 });
    back.position.set(tub.x, tub.y);
    back.addChild(tubBack);

    root.addChild(character);
    const targetHeight = tub.h * 1.18;
    const rawBounds = character.getBounds();
    const fit = rawBounds.height > 0 ? targetHeight / rawBounds.height : 1;
    character.scale.set(fit);
    const fittedBounds = character.getBounds();
    character.position.x += innerFloor.x - (fittedBounds.x + fittedBounds.width * 0.50);
    character.position.y += innerFloor.y - (fittedBounds.y + fittedBounds.height * 0.78);
    character.rotation = -0.035;

    const headBubble = new PIXI.Container();
    const bubbleA = new PIXI.Graphics();
    bubbleA.circle(-18, -38, 10).fill({ color: 0xffffff, alpha: 0.88 });
    bubbleA.circle(7, -46, 7).fill({ color: 0xffffff, alpha: 0.74 });
    bubbleA.circle(23, -34, 5).fill({ color: 0xffffff, alpha: 0.68 });
    headBubble.addChild(bubbleA);
    if (typeof character.addSlotObject === 'function' && character.skeleton?.findSlot?.('head')) {
      character.addSlotObject('head', headBubble);
    } else {
      character.addChild(headBubble);
    }

    const front = new PIXI.Container();
    front.position.set(tub.x, tub.y);
    root.addChild(front);
    const waterFoam = new PIXI.Graphics();
    waterFoam.ellipse(0, -tub.h * 0.36, tub.w * 0.44, tub.h * 0.16).fill({ color: 0xffffff, alpha: 0.92 });
    for (let i = 0; i < 18; i += 1) {
      const x = -tub.w * 0.40 + (tub.w * 0.80) * (i / 17);
      const y = -tub.h * 0.42 + Math.sin(i * 1.7) * tub.h * 0.025;
      const r = 8 + (i % 4) * 2.2;
      waterFoam.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.88 });
    }
    front.addChild(waterFoam);

    const tubFront = new PIXI.Graphics();
    tubFront.roundRect(-tub.w * 0.53, -tub.h * 0.39, tub.w * 1.06, tub.h * 0.72, tub.h * 0.18)
      .fill({ color: 0x9fc8d4, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.47, -tub.h * 0.31, tub.w * 0.94, tub.h * 0.55, tub.h * 0.15)
      .fill({ color: 0xb7dbe3, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.50, -tub.h * 0.44, tub.w, tub.h * 0.13, tub.h * 0.08)
      .fill({ color: 0xf8fbf8, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.46, tub.h * 0.08, tub.w * 0.92, tub.h * 0.13, tub.h * 0.06)
      .fill({ color: 0x82aebc, alpha: 1 });
    front.addChild(tubFront);

    const duck = new PIXI.Graphics();
    duck.ellipse(-tub.w * 0.38, -tub.h * 0.04, 16, 12).fill({ color: 0xffd853, alpha: 1 });
    duck.circle(-tub.w * 0.39, -tub.h * 0.20, 10).fill({ color: 0xffd853, alpha: 1 });
    duck.poly([
      -tub.w * 0.405, -tub.h * 0.20,
      -tub.w * 0.445, -tub.h * 0.17,
      -tub.w * 0.405, -tub.h * 0.14,
    ], true).fill({ color: 0xf28c25, alpha: 1 });
    duck.circle(-tub.w * 0.385, -tub.h * 0.23, 1.6).fill({ color: 0x2b2f36, alpha: 1 });
    front.addChild(duck);

    const debug = new PIXI.Graphics();
    if (scene.debugAnchors) root.addChild(debug);

    return {
      duration: END,
      update(elapsed) {
        const phase = elapsed * 0.004;
        const fadeOut = 1 - segment(elapsed, END - 650, END);
        root.alpha = fadeOut;
        dim.alpha = 0.06 * fadeOut;
        character.y += Math.sin(phase) * 0.22;
        headBubble.rotation = Math.sin(phase * 1.4) * 0.05;
        headBubble.alpha = 0.86 + Math.sin(phase * 2.1) * 0.08;
        waterFoam.scale.set(1 + Math.sin(phase * 1.7) * 0.01, 1 + Math.cos(phase * 1.5) * 0.012);
        duck.x = Math.sin(phase * 1.2) * 6;
        duck.y = Math.cos(phase * 1.5) * 3;
        (scene.clearSlots || []).forEach((slotName) => {
          if (typeof character.skeleton?.setAttachment === 'function') {
            character.skeleton.setAttachment(slotName, null);
          }
        });
        if (scene.debugAnchors) {
          const b = character.getBounds();
          debug.clear();
          debug.rect(b.x, b.y, b.width, b.height).stroke({ color: 0xff4f79, alpha: 0.78, width: 2 });
          debug.circle(innerFloor.x, innerFloor.y, 5).fill({ color: 0x44ff88, alpha: 0.95 });
          debug.moveTo(tub.x - tub.w * 0.5, tub.y - tub.h * 0.31);
          debug.lineTo(tub.x + tub.w * 0.5, tub.y - tub.h * 0.31);
          debug.stroke({ color: 0xffffff, alpha: 0.72, width: 2 });
        }
      },
    };
  }

  function makeSpriteBathScene({ root, dim, image, arena, W, H, timeline }) {
    const scene = timeline.scene || {};
    const END = Number(timeline.durationMs) || 5600;
    const tubW = Math.min(W * 0.46, 360);
    const tubH = tubW * 0.42;
    const tub = {
      x: clamp(arena.x, tubW * 0.62, W - tubW * 0.62),
      y: clamp(arena.y + H * 0.02, H * 0.52, H - tubH * 0.36),
      w: tubW,
      h: tubH,
    };
    const waterLine = tub.y - tub.h * 0.38;
    const { sprite: yoyo, box } = makeFrameSpriteWithAlphaBox(image, scene.spriteRow || 0, scene.spriteFrame || 0);
    const visibleHeadHeight = tub.h * 0.72;
    const scale = visibleHeadHeight / Math.max(1, box.height * 0.58);
    const topLeftX = tub.x - (box.x + box.width * 0.5) * scale;
    const topLeftY = waterLine - (box.y + box.height * 0.56) * scale;
    yoyo.position.set(topLeftX, topLeftY);
    yoyo.scale.set(scale);

    const shadow = new PIXI.Graphics();
    shadow.ellipse(tub.x, tub.y + tub.h * 0.34, tub.w * 0.46, tub.h * 0.11).fill({ color: 0x203642, alpha: 0.18 });
    root.addChild(shadow);

    const back = new PIXI.Container();
    back.position.set(tub.x, tub.y);
    root.addChild(back);
    const tubBack = new PIXI.Graphics();
    tubBack.roundRect(-tub.w * 0.50, -tub.h * 0.48, tub.w, tub.h * 0.72, tub.h * 0.20)
      .fill({ color: 0xbad7df, alpha: 1 });
    tubBack.roundRect(-tub.w * 0.48, -tub.h * 0.43, tub.w * 0.96, tub.h * 0.56, tub.h * 0.17)
      .fill({ color: 0xdcedf2, alpha: 1 });
    tubBack.ellipse(0, -tub.h * 0.38, tub.w * 0.47, tub.h * 0.18)
      .fill({ color: 0xf9fbf7, alpha: 1 });
    tubBack.ellipse(0, -tub.h * 0.35, tub.w * 0.39, tub.h * 0.12)
      .fill({ color: 0x8fcfe3, alpha: 0.85 });
    back.addChild(tubBack);

    root.addChild(yoyo);

    const front = new PIXI.Container();
    front.position.set(tub.x, tub.y);
    root.addChild(front);
    const waterFoam = new PIXI.Graphics();
    waterFoam.ellipse(0, -tub.h * 0.36, tub.w * 0.44, tub.h * 0.16).fill({ color: 0xffffff, alpha: 0.94 });
    for (let i = 0; i < 22; i += 1) {
      const x = -tub.w * 0.42 + (tub.w * 0.84) * (i / 21);
      const y = -tub.h * 0.42 + Math.sin(i * 1.7) * tub.h * 0.024;
      const r = 7 + (i % 5) * 2.1;
      waterFoam.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.88 });
    }
    front.addChild(waterFoam);

    const tubFront = new PIXI.Graphics();
    tubFront.roundRect(-tub.w * 0.53, -tub.h * 0.39, tub.w * 1.06, tub.h * 0.72, tub.h * 0.18)
      .fill({ color: 0x9fc8d4, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.47, -tub.h * 0.31, tub.w * 0.94, tub.h * 0.55, tub.h * 0.15)
      .fill({ color: 0xb7dbe3, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.50, -tub.h * 0.44, tub.w, tub.h * 0.13, tub.h * 0.08)
      .fill({ color: 0xf8fbf8, alpha: 1 });
    tubFront.roundRect(-tub.w * 0.46, tub.h * 0.08, tub.w * 0.92, tub.h * 0.13, tub.h * 0.06)
      .fill({ color: 0x82aebc, alpha: 1 });
    front.addChild(tubFront);

    const duck = new PIXI.Graphics();
    duck.ellipse(-tub.w * 0.39, -tub.h * 0.03, 15, 11).fill({ color: 0xffd853, alpha: 1 });
    duck.circle(-tub.w * 0.40, -tub.h * 0.18, 9).fill({ color: 0xffd853, alpha: 1 });
    duck.poly([
      -tub.w * 0.415, -tub.h * 0.18,
      -tub.w * 0.455, -tub.h * 0.15,
      -tub.w * 0.415, -tub.h * 0.12,
    ], true).fill({ color: 0xf28c25, alpha: 1 });
    duck.circle(-tub.w * 0.392, -tub.h * 0.205, 1.5).fill({ color: 0x2b2f36, alpha: 1 });
    front.addChild(duck);

    const bubbles = new PIXI.Container();
    bubbles.position.set(tub.x, waterLine - tub.h * 0.26);
    root.addChild(bubbles);
    for (let i = 0; i < 7; i += 1) {
      const b = new PIXI.Graphics();
      b.circle(-42 + i * 14, Math.sin(i) * 7, 4 + (i % 3)).fill({ color: 0xffffff, alpha: 0.68 });
      bubbles.addChild(b);
    }

    const debug = new PIXI.Graphics();
    if (scene.debugAnchors) root.addChild(debug);
    return {
      duration: END,
      update(elapsed) {
        const phase = elapsed * 0.004;
        const fadeOut = 1 - segment(elapsed, END - 650, END);
        root.alpha = fadeOut;
        dim.alpha = 0.04 * fadeOut;
        yoyo.y = topLeftY + Math.sin(phase) * 2.2;
        waterFoam.scale.set(1 + Math.sin(phase * 1.7) * 0.01, 1 + Math.cos(phase * 1.5) * 0.012);
        duck.x = Math.sin(phase * 1.2) * 6;
        duck.y = Math.cos(phase * 1.5) * 3;
        bubbles.y = waterLine - tub.h * 0.26 + Math.sin(phase * 1.6) * 3;
        bubbles.alpha = 0.72 + Math.sin(phase * 2.2) * 0.12;
        if (scene.debugAnchors) {
          debug.clear();
          debug.rect(topLeftX + box.x * scale, yoyo.y + box.y * scale, box.width * scale, box.height * scale)
            .stroke({ color: 0xff4f79, alpha: 0.78, width: 2 });
          debug.moveTo(tub.x - tub.w * 0.5, waterLine);
          debug.lineTo(tub.x + tub.w * 0.5, waterLine);
          debug.stroke({ color: 0xffffff, alpha: 0.72, width: 2 });
        }
      },
    };
  }

  async function makeAutoRigActionStage(options) {
    const timeline = options.timeline || {};
    const rig = timeline.rigData;
    if (!rig || !Array.isArray(rig.parts) || rig.parts.length === 0) {
      console.warn('[pixi-effect] auto_rig_missing_required_assets', JSON.stringify({
        effectId: timeline.id,
        hasRigData: Boolean(rig),
      }));
      return makeMissingAutoRigAssetStage(options);
    }

    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const root = new PIXI.Container();
    app.stage.addChild(root);

    const dimAlpha = Number(timeline.scene?.dimAlpha) || 0;
    const dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x0d1720, alpha: dimAlpha });
    root.addChild(dim);

    const stage = rig.stage || { width: 512, height: 384 };
    const rigScaleBase = Math.max((options.petSize && options.petSize.w) || FRAME_W, FRAME_W) * 1.35;
    const stageScale = clamp(rigScaleBase / stage.width, 0.34, 0.62);
    const effectCenter = options.sourceCenter || options.arenaCenter || { x: W / 2, y: H * 0.7 };
    const scaledStageWidth = stage.width * stageScale;
    const scaledStageHeight = stage.height * stageScale;
    const group = new PIXI.Container();
    group.position.set(
      clamp(effectCenter.x - scaledStageWidth / 2, 12, Math.max(12, W - scaledStageWidth - 12)),
      clamp(effectCenter.y - scaledStageHeight * 0.68, 12, Math.max(12, H - scaledStageHeight - 12)),
    );
    group.scale.set(stageScale);
    root.addChild(group);

    const placementForPart = (part) => {
      if (part.id && part.id.startsWith('scene.')) return rig.placements?.scene;
      if (part.id === 'bath.bubbles') return rig.placements?.bubbles || rig.placements?.bath;
      if (part.id && part.id.startsWith('bath.')) return rig.placements?.bath;
      if (part.id === 'yoyo.body') return rig.placements?.character;
      return null;
    };
    const partById = {};
    const sortedParts = [...rig.parts].sort((a, b) => (Number(a.z) || 0) - (Number(b.z) || 0));
    for (const part of sortedParts) {
      if (!part.url) throw new Error(`Auto rig part missing URL: ${part.id}`);
      const image = await loadImage(part.url);
      const sprite = new PIXI.Sprite(PIXI.Texture.from(image));
      const placement = placementForPart(part);
      if (placement) {
        sprite.position.set(placement.x, placement.y);
        sprite.width = placement.width;
        sprite.height = placement.height;
      }
      if (part.id === 'yoyo.body' && placement?.clip?.height) {
        const mask = new PIXI.Graphics();
        mask.rect(placement.x, placement.y, placement.width, placement.clip.height).fill({ color: 0xffffff, alpha: 1 });
        group.addChild(mask);
        sprite.mask = mask;
      }
      group.addChild(sprite);
      partById[part.id] = { sprite, baseX: sprite.x, baseY: sprite.y };
    }

    const debug = new PIXI.Graphics();
    if (timeline.scene?.debugAnchors) group.addChild(debug);

    const motion = rig.motions?.[timeline.motion || 'bath'] || {};
    const keyframes = motion.keyframes || [];
    const fps = Number(motion.fps) || 8;
    const END = Number(timeline.durationMs) || 3000;

    return {
      duration: END,
      update(elapsed) {
        const frameMs = 1000 / fps;
        const frame = keyframes.length ? keyframes[Math.floor(elapsed / frameMs) % keyframes.length] : {};
        const fadeOut = 1 - segment(elapsed, END - 650, END);
        root.alpha = fadeOut;
        dim.alpha = dimAlpha * fadeOut;
        if (partById['yoyo.body']) {
          partById['yoyo.body'].sprite.y = partById['yoyo.body'].baseY + (Number(frame.bobY) || 0);
        }
        if (partById['bath.bubbles']) {
          partById['bath.bubbles'].sprite.y = partById['bath.bubbles'].baseY + (Number(frame.foamY) || 0);
          partById['bath.bubbles'].sprite.alpha = 0.9 + Math.sin(elapsed * 0.008) * 0.08;
        }
        if (partById['scene.shimmer']) {
          partById['scene.shimmer'].sprite.x = partById['scene.shimmer'].baseX + (Number(frame.shimmerX) || 0);
          partById['scene.shimmer'].sprite.alpha = Number(frame.shimmerAlpha) || 0.24;
        }
        if (partById['scene.steam']) {
          partById['scene.steam'].sprite.y = partById['scene.steam'].baseY + (Number(frame.steamY) || 0);
          partById['scene.steam'].sprite.alpha = Number(frame.steamAlpha) || 0.22;
        }
        if (partById['scene.sparkle']) {
          partById['scene.sparkle'].sprite.y = partById['scene.sparkle'].baseY + (Number(frame.sparkleY) || 0);
          partById['scene.sparkle'].sprite.alpha = Number(frame.sparkleAlpha) || 0.34;
          partById['scene.sparkle'].sprite.scale.set(Number(frame.sparkleScale) || 1);
        }
        if (debug.parent) {
          const bath = rig.placements?.bath;
          const character = rig.placements?.character;
          const baselineY = rig.qa?.occlusionBaselineY || rig.masks?.[0]?.baselineY;
          debug.clear();
          if (bath) debug.rect(bath.x, bath.y, bath.width, bath.height).stroke({ color: 0x00a8ff, alpha: 0.78, width: 2 });
          if (character) {
            const bobY = Number(frame.bobY) || 0;
            debug.rect(character.x, character.y + bobY, character.width, character.height).stroke({ color: 0xff4d4f, alpha: 0.78, width: 2 });
          }
          if (baselineY) {
            debug.moveTo(0, baselineY);
            debug.lineTo(stage.width, baselineY);
            debug.stroke({ color: 0xffcc00, alpha: 0.8, width: 2 });
          }
        }
      },
    };
  }

  function makeMissingSpineAssetStage(options) {
    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const timeline = options.timeline || {};
    const spineSpec = timeline.spine || {};

    const root = new PIXI.Container();
    app.stage.addChild(root);

    const dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x111820, alpha: 0.26 });
    root.addChild(dim);

    const panel = new PIXI.Graphics();
    panel.roundRect(-210, -58, 420, 116, 18).fill({ color: 0xfff8ed, alpha: 0.92 });
    panel.roundRect(-210, -58, 420, 116, 18).stroke({ width: 2, color: 0xf0b37d, alpha: 0.8 });
    panel.position.set(W / 2, H * 0.58);
    root.addChild(panel);

    const title = new PIXI.Text({
      text: 'Spine action asset missing',
      style: { fill: 0x25343c, fontSize: 22, fontWeight: '700', align: 'center' },
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, H * 0.58 - 18);
    root.addChild(title);

    const detail = new PIXI.Text({
      text: `${timeline.id || 'action'} -> ${spineSpec.animation || 'animation'}`,
      style: { fill: 0x6d4b42, fontSize: 15, fontWeight: '600', align: 'center' },
    });
    detail.anchor.set(0.5);
    detail.position.set(W / 2, H * 0.58 + 18);
    root.addChild(detail);

    const END = Number(timeline.durationMs) || 5600;

    return {
      duration: END,
      update(elapsed) {
        const fadeOut = 1 - segment(elapsed, END - 650, END);
        root.alpha = fadeOut;
        panel.scale.set(1 + Math.sin(elapsed * 0.004) * 0.012);
      },
    };
  }

  function makeMissingAutoRigAssetStage(options) {
    const app = state.app;
    const W = app.screen.width;
    const H = app.screen.height;
    const timeline = options.timeline || {};

    const root = new PIXI.Container();
    app.stage.addChild(root);

    const dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x111820, alpha: 0.26 });
    root.addChild(dim);

    const panel = new PIXI.Graphics();
    panel.roundRect(-220, -58, 440, 116, 18).fill({ color: 0xfff8ed, alpha: 0.92 });
    panel.roundRect(-220, -58, 440, 116, 18).stroke({ width: 2, color: 0xf0b37d, alpha: 0.8 });
    panel.position.set(W / 2, H * 0.58);
    root.addChild(panel);

    const title = new PIXI.Text({
      text: 'Auto rig asset missing',
      style: { fill: 0x25343c, fontSize: 22, fontWeight: '700', align: 'center' },
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, H * 0.58 - 18);
    root.addChild(title);

    const detail = new PIXI.Text({
      text: `${timeline.id || 'action'} -> ${timeline.rig || 'rig'}`,
      style: { fill: 0x6d4b42, fontSize: 15, fontWeight: '600', align: 'center' },
    });
    detail.anchor.set(0.5);
    detail.position.set(W / 2, H * 0.58 + 18);
    root.addChild(detail);

    const END = Number(timeline.durationMs) || 3000;
    return {
      duration: END,
      update(elapsed) {
        const fadeOut = 1 - segment(elapsed, END - 650, END);
        root.alpha = fadeOut;
        panel.scale.set(1 + Math.sin(elapsed * 0.004) * 0.012);
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
      image,
    };
    if (state.effectType === 'auto-rig-action') {
      state.scene = await makeAutoRigActionStage(sceneOptions);
    } else if (state.effectType === 'spine-action') {
      state.scene = await makeSpineActionStage(sceneOptions);
    } else if (state.effectType === 'cook-pot') {
      state.scene = makeCookPotStage(image, sceneOptions);
    } else if (state.effectType === 'dharma') {
      state.scene = makeDharmaStage(image, sceneOptions);
    } else {
      state.scene = makeCloneStage(image, sceneOptions);
    }
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
