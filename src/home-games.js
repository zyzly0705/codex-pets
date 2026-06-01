// home-games.js - 小屋小游戏系统
// 依赖 home.js 暴露的全局：startHomeAnimation / typewriteBubble / randomFrom / window.petApi

(function () {
  const launcher = document.getElementById('game-launcher');
  const menu = document.getElementById('game-menu');
  const overlay = document.getElementById('game-overlay');
  const closeBtn = document.getElementById('game-close');
  const container = document.getElementById('game-container');

  if (!launcher || !menu || !overlay || !container) return;

  // ===== 菜单开关 =====
  launcher.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    menu.setAttribute('aria-hidden', String(!menu.classList.contains('open')));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#game-menu') && !e.target.closest('#game-launcher')) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
    }
  });

  menu.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      menu.classList.remove('open');
      startGame(btn.dataset.game);
    });
  });

  closeBtn.addEventListener('click', closeGame);
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeGame(); });

  let activeGame = null;

  function startGame(id) {
    if (activeGame) activeGame.destroy?.();
    container.innerHTML = '';
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus?.();
    const games = { whackMole, catchFood, guessMood, spotDiff, rhythmPat };
    activeGame = games[id]?.(container, onGameEnd);
  }

  function closeGame() {
    activeGame?.destroy?.();
    activeGame = null;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    container.innerHTML = '';
  }

  function onGameEnd(id, score, maxScore) {
    const ratio = maxScore > 0 ? score / maxScore : 0;
    setTimeout(() => {
      closeGame();
      if (typeof startHomeAnimation === 'function') {
        if (ratio >= 0.8) {
          startHomeAnimation('clapping', '', 3000);
          typewriteBubble(randomFrom(['太棒了！妈妈好厉害！', '耶！妈妈赢了！', '哇！满分！']));
          window.petApi?.careForYoyo?.('play').catch(() => {});
        } else if (ratio >= 0.5) {
          startHomeAnimation('waving', '', 2000);
          typewriteBubble(randomFrom(['下次会更好的！', '妈妈加油加油！', '继续努力哦～']));
        } else {
          startHomeAnimation('crying', '', 2500);
          typewriteBubble(randomFrom(['呜…妈妈再来一次嘛…', '这个好难嘛…', '没关系，Yoyo陪你再玩！']));
        }
      }
    }, 1200);
  }

  // ===== 公共 UI 工具 =====
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function countdown(secs, onTick, onEnd) {
    let remaining = secs;
    onTick(remaining);
    const id = setInterval(() => {
      remaining--;
      onTick(remaining);
      if (remaining <= 0) { clearInterval(id); onEnd(); }
    }, 1000);
    return () => clearInterval(id);
  }

  function gameShell(title, scoreLabel = '分') {
    container.innerHTML = '';
    const header = el('div', 'g-header');
    const titleEl = el('h2', 'g-title', title);
    const scoreEl = el('span', 'g-score', `0 ${scoreLabel}`);
    const timerEl = el('span', 'g-timer', '');
    header.append(titleEl, scoreEl, timerEl);
    const body = el('div', 'g-body');
    container.append(header, body);
    return {
      body,
      setScore(v) { scoreEl.textContent = `${v} ${scoreLabel}`; },
      setTimer(v) { timerEl.textContent = `${v}s`; timerEl.classList.toggle('g-timer-warn', v <= 10); },
    };
  }

  // ====================================================================
  // 游戏 1：打地鼠
  // ====================================================================
  function whackMole(root, onEnd) {
    const ui = gameShell('🔨 打地鼠', '分');
    const HOLES = 6;
    const DURATION = 30;
    const MOLE_EMOJIS = ['🐹', '🐰', '🐸', '🐱', '🦊', '🐶'];
    let score = 0;
    let interval = 1200;
    let destroyed = false;

    // 建洞
    const grid = el('div', 'mole-grid');
    const holes = Array.from({ length: HOLES }, (_, i) => {
      const hole = el('div', 'mole-hole');
      const mole = el('div', 'mole', MOLE_EMOJIS[i]);
      hole.appendChild(mole);
      mole.addEventListener('click', () => {
        if (!mole.classList.contains('up')) return;
        mole.classList.remove('up');
        mole.classList.add('hit');
        score++;
        ui.setScore(score);
        setTimeout(() => mole.classList.remove('hit'), 300);
      });
      grid.appendChild(hole);
      return mole;
    });
    ui.body.appendChild(grid);

    function popMole() {
      if (destroyed) return;
      const idle = holes.filter(m => !m.classList.contains('up'));
      if (!idle.length) return;
      const mole = idle[Math.floor(Math.random() * idle.length)];
      mole.classList.add('up');
      setTimeout(() => mole.classList.remove('up'), interval * 0.85);
    }

    let spawnId = setInterval(popMole, interval);
    // 加速
    const accelId = setInterval(() => {
      interval = Math.max(600, interval - 120);
      clearInterval(spawnId);
      spawnId = setInterval(popMole, interval);
    }, 10000);

    const stopTimer = countdown(DURATION, (t) => ui.setTimer(t), () => {
      destroyed = true;
      clearInterval(spawnId); clearInterval(accelId);
      onEnd('whackMole', score, 30);
    });

    return { destroy() { destroyed = true; clearInterval(spawnId); clearInterval(accelId); stopTimer(); } };
  }

  // ====================================================================
  // 游戏 2：接食物
  // ====================================================================
  function catchFood(root, onEnd) {
    const ui = gameShell('🍎 接食物', '分');
    const COLS = 3;
    const DURATION = 60;
    const FOODS = ['🍎', '🍰', '🍭', '🍩', '🧁', '🍓'];
    let score = 0, col = 1, destroyed = false;

    const stage = el('div', 'catch-stage');
    const yoyoRow = el('div', 'catch-yoyo-row');
    const yoyoEls = Array.from({ length: COLS }, (_, i) => {
      const cell = el('div', 'catch-cell' + (i === 1 ? ' active' : ''), i === 1 ? '😊' : '');
      yoyoRow.appendChild(cell);
      return cell;
    });
    stage.appendChild(yoyoRow);
    ui.body.appendChild(stage);

    function moveYoyo(newCol) {
      yoyoEls[col].textContent = '';
      yoyoEls[col].classList.remove('active');
      col = newCol;
      yoyoEls[col].textContent = '😊';
      yoyoEls[col].classList.add('active');
    }

    // 左右点击区域
    const leftZone = el('div', 'catch-zone catch-left', '◀');
    const rightZone = el('div', 'catch-zone catch-right', '▶');
    leftZone.addEventListener('click', () => col > 0 && moveYoyo(col - 1));
    rightZone.addEventListener('click', () => col < COLS - 1 && moveYoyo(col + 1));
    ui.body.append(leftZone, rightZone);

    document.addEventListener('keydown', onKey);
    function onKey(e) {
      if (e.key === 'ArrowLeft' && col > 0) moveYoyo(col - 1);
      if (e.key === 'ArrowRight' && col < COLS - 1) moveYoyo(col + 1);
    }

    // 食物下落
    const fallIds = [];
    function dropFood() {
      if (destroyed) return;
      const fc = Math.floor(Math.random() * COLS);
      const food = el('div', 'falling-food', FOODS[Math.floor(Math.random() * FOODS.length)]);
      food.style.left = `${(fc / COLS) * 100 + 100 / COLS / 2}%`;
      stage.appendChild(food);
      requestAnimationFrame(() => food.classList.add('falling'));

      setTimeout(() => {
        if (!stage.contains(food)) return;
        const caught = fc === col;
        food.classList.add(caught ? 'caught' : 'missed');
        if (caught) { score++; ui.setScore(score); }
        setTimeout(() => food.remove(), 300);
      }, 1800);
    }

    const dropId = setInterval(dropFood, 1200);
    const stopTimer = countdown(DURATION, (t) => ui.setTimer(t), () => {
      destroyed = true;
      clearInterval(dropId);
      document.removeEventListener('keydown', onKey);
      onEnd('catchFood', score, 30);
    });

    return {
      destroy() {
        destroyed = true;
        clearInterval(dropId);
        document.removeEventListener('keydown', onKey);
        stopTimer();
      },
    };
  }

  // ====================================================================
  // 游戏 3：猜心情
  // ====================================================================
  function guessMood(root, onEnd) {
    const ui = gameShell('💭 猜心情', '/ 10');
    const QUESTIONS = [
      { state: 'dancing', row: 21, label: '跳舞', options: ['跳舞', '睡觉', '哭泣', '害羞'] },
      { state: 'crying',  row: 22, label: '哭泣', options: ['开心', '哭泣', '跳舞', '吃饭'] },
      { state: 'eating',  row: 13, label: '吃饭', options: ['洗澡', '睡觉', '吃饭', '跳舞'] },
      { state: 'bashful', row: 7,  label: '害羞', options: ['害羞', '生气', '开心', '困了'] },
      { state: 'jumping', row: 4,  label: '开心', options: ['开心', '伤心', '害羞', '哭泣'] },
      { state: 'yawning', row: 12, label: '困了', options: ['跳舞', '困了', '开心', '生气'] },
      { state: 'petting', row: 11, label: '被摸摸', options: ['哭泣', '跳舞', '被摸摸', '睡觉'] },
      { state: 'sleeping',row: 20, label: '睡觉', options: ['睡觉', '跳舞', '吃饭', '害羞'] },
    ];

    let qIdx = 0, score = 0, answered = false;
    const sheet = new Image();
    sheet.src = new URL('../assets/yoyo/home/yoyo-home-sheet.webp', window.location.href).href;

    const canvas = el('canvas', 'mood-canvas');
    canvas.width = 96; canvas.height = 104;
    const optionsDiv = el('div', 'mood-options');
    const feedback = el('div', 'mood-feedback', '');
    const progress = el('div', 'mood-progress', '');
    ui.body.append(canvas, feedback, optionsDiv, progress);

    function shuffled(arr) { return [...arr].sort(() => Math.random() - 0.5); }

    function showQuestion() {
      if (qIdx >= 10) { onEnd('guessMood', score, 10); return; }
      answered = false;
      feedback.textContent = '';
      const q = QUESTIONS[qIdx % QUESTIONS.length];
      progress.textContent = `第 ${qIdx + 1} / 10 题`;
      ui.setScore(`${score} / 10`);

      const ctx2 = canvas.getContext('2d');
      ctx2.clearRect(0, 0, 96, 104);
      function draw() {
        ctx2.drawImage(sheet, 0, q.row * 208, 192, 208, 0, 0, 96, 104);
      }
      sheet.complete ? draw() : (sheet.onload = draw);

      optionsDiv.innerHTML = '';
      shuffled(q.options).forEach(opt => {
        const btn = el('button', 'mood-opt', opt);
        btn.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          const correct = opt === q.label;
          btn.classList.add(correct ? 'correct' : 'wrong');
          if (correct) { score++; feedback.textContent = '✓ 答对了！'; feedback.className = 'mood-feedback ok'; }
          else { feedback.textContent = `✗ 是「${q.label}」哦`; feedback.className = 'mood-feedback bad'; }
          optionsDiv.querySelectorAll('.mood-opt').forEach(b => {
            if (b.textContent === q.label) b.classList.add('correct');
          });
          qIdx++;
          setTimeout(showQuestion, 1100);
        });
        optionsDiv.appendChild(btn);
      });
    }

    showQuestion();
    return { destroy() {} };
  }

  // ====================================================================
  // 游戏 4：找不同
  // ====================================================================
  function spotDiff(root, onEnd) {
    const ui = gameShell('🔍 找不同', '/ 5');
    const DURATION = 120;
    const TARGET = 5;
    let found = 0, destroyed = false;

    const wrap = el('div', 'diff-wrap');
    const leftCanvas = el('canvas', 'diff-canvas');
    const rightCanvas = el('canvas', 'diff-canvas diff-right');
    leftCanvas.width = rightCanvas.width = 280;
    leftCanvas.height = rightCanvas.height = 200;
    wrap.append(leftCanvas, rightCanvas);
    ui.body.appendChild(wrap);

    const hint = el('div', 'diff-hint', '点击右图找出不同处');
    ui.body.appendChild(hint);

    const img = new Image();
    img.src = new URL('../assets/yoyo/home/room-v3-day-safe.webp', window.location.href).href;

    // 随机生成5处不同（色块）
    const diffs = Array.from({ length: TARGET }, () => ({
      x: 30 + Math.random() * 200,
      y: 20 + Math.random() * 150,
      w: 18 + Math.random() * 22,
      h: 18 + Math.random() * 22,
      color: `hsl(${Math.random() * 360},70%,65%)`,
      found: false,
    }));

    function drawBoth() {
      [leftCanvas, rightCanvas].forEach((c, isRight) => {
        const ctx2 = c.getContext('2d');
        ctx2.clearRect(0, 0, c.width, c.height);
        ctx2.drawImage(img, 0, 0, c.width, c.height);
        if (isRight) {
          diffs.forEach(d => {
            if (d.found) {
              ctx2.strokeStyle = '#4d9b70';
              ctx2.lineWidth = 3;
              ctx2.beginPath();
              ctx2.arc(d.x + d.w / 2, d.y + d.h / 2, Math.max(d.w, d.h) / 2 + 4, 0, Math.PI * 2);
              ctx2.stroke();
            } else {
              ctx2.fillStyle = d.color;
              ctx2.fillRect(d.x, d.y, d.w, d.h);
            }
          });
        }
      });
    }

    img.complete ? drawBoth() : (img.onload = drawBoth);

    rightCanvas.addEventListener('click', (e) => {
      if (destroyed) return;
      const rect = rightCanvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (rightCanvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (rightCanvas.height / rect.height);
      for (const d of diffs) {
        if (!d.found && sx >= d.x - 8 && sx <= d.x + d.w + 8 && sy >= d.y - 8 && sy <= d.y + d.h + 8) {
          d.found = true;
          found++;
          ui.setScore(`${found} / 5`);
          drawBoth();
          if (found >= TARGET) { destroyed = true; stopTimer(); onEnd('spotDiff', found, TARGET); }
          break;
        }
      }
    });

    const stopTimer = countdown(DURATION, (t) => ui.setTimer(t), () => {
      destroyed = true;
      onEnd('spotDiff', found, TARGET);
    });

    return { destroy() { destroyed = true; stopTimer(); } };
  }

  // ====================================================================
  // 游戏 5：节奏拍
  // ====================================================================
  function rhythmPat(root, onEnd) {
    const ui = gameShell('🎵 节奏拍', '分');
    const BPM = 90;
    const BEAT_MS = (60 / BPM) * 1000;
    const TOTAL_BEATS = 20;
    const PERFECT_MS = 80, GOOD_MS = 200;
    let beat = 0, score = 0, waiting = false, beatTime = 0, destroyed = false;

    const arena = el('div', 'rhythm-arena');
    const ring = el('div', 'rhythm-ring');
    const inner = el('div', 'rhythm-inner', '👏');
    const judgeEl = el('div', 'rhythm-judge', '');
    const progressEl = el('div', 'rhythm-progress', `0 / ${TOTAL_BEATS}`);
    ring.appendChild(inner);
    arena.append(ring, judgeEl, progressEl);
    ui.body.appendChild(arena);

    const hint = el('p', 'rhythm-hint', '圆圈缩小时点击！（空格/点击）');
    ui.body.appendChild(hint);

    function nextBeat() {
      if (destroyed || beat >= TOTAL_BEATS) return;
      beat++;
      progressEl.textContent = `${beat} / ${TOTAL_BEATS}`;
      waiting = true;
      beatTime = performance.now() + BEAT_MS;
      ring.style.setProperty('--beat-ms', `${BEAT_MS}ms`);
      ring.classList.remove('shrink');
      void ring.offsetWidth;
      ring.classList.add('shrink');

      setTimeout(() => {
        if (waiting) {
          waiting = false;
          judgeEl.textContent = 'Miss 😢';
          judgeEl.className = 'rhythm-judge miss';
          setTimeout(nextBeat, 400);
        }
      }, BEAT_MS);
    }

    function hit() {
      if (!waiting) return;
      waiting = false;
      const diff = Math.abs(performance.now() - beatTime);
      let label, pts;
      if (diff <= PERFECT_MS) { label = 'Perfect! ✨'; pts = 3; judgeEl.className = 'rhythm-judge perfect'; }
      else if (diff <= GOOD_MS) { label = 'Good! 👍'; pts = 1; judgeEl.className = 'rhythm-judge good'; }
      else { label = 'Miss 😢'; pts = 0; judgeEl.className = 'rhythm-judge miss'; }
      judgeEl.textContent = label;
      score += pts;
      ui.setScore(score);
      if (beat >= TOTAL_BEATS) { destroyed = true; setTimeout(() => onEnd('rhythmPat', score, TOTAL_BEATS * 3), 600); }
      else setTimeout(nextBeat, 400);
    }

    arena.addEventListener('click', hit);
    function onKey(e) { if (e.code === 'Space') { e.preventDefault(); hit(); } }
    document.addEventListener('keydown', onKey);

    setTimeout(nextBeat, 800);

    return {
      destroy() {
        destroyed = true;
        document.removeEventListener('keydown', onKey);
      },
    };
  }
})();
