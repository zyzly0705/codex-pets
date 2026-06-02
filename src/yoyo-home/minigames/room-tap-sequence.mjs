const MINI_GAME_PRESENTATION = {
  toyTrail: {
    title: '找玩具',
    motifId: 'toy-trail',
    interactionKind: 'toy-sorting',
    labels: ['星', '球', '书'],
    color: 0x89d2c7,
    accent: 0xffd6a5,
  },
  blockTower: {
    title: '叠积木',
    motifId: 'block-tower',
    interactionKind: 'block-building',
    labels: ['底', '中', '顶'],
    color: 0xffc46b,
    accent: 0x9edfff,
  },
  rhythmPat: {
    title: '按节奏',
    motifId: 'console-rhythm',
    interactionKind: 'rhythm-console',
    labels: ['1', '2', '3'],
    color: 0xb9a4ff,
    accent: 0xffe28a,
  },
  guessMood: {
    title: '猜心情',
    motifId: 'study-cards',
    interactionKind: 'study-focus',
    labels: ['看', '想', '懂'],
    color: 0xffb6c9,
    accent: 0xa6dfc8,
  },
};

export function resolveMiniGamePresentation(gameId, object = {}) {
  if (gameId === 'toyTrail' && object.id === 'blocks') return MINI_GAME_PRESENTATION.blockTower;
  return MINI_GAME_PRESENTATION[gameId] || MINI_GAME_PRESENTATION.toyTrail;
}

export class RoomTapSequenceMiniGame {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.object = options.object;
    this.gameId = options.gameId;
    this.presentation = resolveMiniGamePresentation(this.gameId, this.object);
    this.target = options.target || this.presentation.labels.length;
    this.durationMs = options.durationMs || 1800;
    this.score = 0;
    this.container = null;
    this.finishTimer = null;
    this.finished = false;
    this.resolve = null;
  }

  start() {
    this.container = this.scene.add.container(0, 0).setDepth(44).setName(`${this.gameId}-mini-game`);
    this.drawBoard();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.finishTimer = this.scene.time.delayedCall(this.durationMs, () => this.finish());
    });
  }

  drawBoard() {
    const { x, y, width, height } = this.object.hitArea;
    const board = this.scene.add.graphics();
    board.fillStyle(0xfffbf7, 0.28);
    board.lineStyle(2, this.presentation.color, 0.78);
    board.fillRoundedRect(x, y, width, height, 18);
    board.strokeRoundedRect(x, y, width, height, 18);

    const title = this.scene.add.text(x + 16, y + 12, this.presentation.title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#583541',
    });
    this.scoreText = this.scene.add.text(x + width - 64, y + 12, `0/${this.target}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#583541',
    });
    this.container.add([board, title, this.scoreText]);
    this.drawFurnitureMotif(x, y, width, height);

    const usableWidth = Math.max(1, width - 72);
    this.presentation.labels.forEach((label, index) => {
      const itemX = x + 36 + (usableWidth * (index + 0.5)) / this.presentation.labels.length;
      const itemY = y + height / 2 + 18;
      const button = this.scene.add.circle(itemX, itemY, 24, this.presentation.color, 0.94)
        .setStrokeStyle(2, this.presentation.accent || 0xffffff, 0.9)
        .setInteractive({ cursor: 'pointer' })
        .setName(`${this.gameId}-tap-${index}`);
      const text = this.scene.add.text(itemX, itemY + 1, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      const group = this.scene.add.container(0, 0, [button, text]).setDepth(46);
      button.on('pointerdown', () => this.tap(group));
      this.container.add(group);
    });
  }

  drawFurnitureMotif(x, y, width, height) {
    if (this.presentation.motifId === 'console-rhythm') {
      this.drawRhythmLane(x, y, width, height);
      return;
    }
    if (this.presentation.motifId === 'study-cards') {
      this.drawStudyCards(x, y, width, height);
      return;
    }
    if (this.presentation.motifId === 'block-tower') {
      this.drawBlockTower(x, y, width, height);
      return;
    }
    this.drawToyTrail(x, y, width, height);
  }

  drawToyTrail(x, y, width, height) {
    const trail = this.scene.add.graphics();
    trail.lineStyle(3, this.presentation.accent, 0.65);
    const startX = x + 26;
    const startY = y + height - 30;
    trail.moveTo(startX, startY);
    for (let index = 0; index < 4; index += 1) {
      trail.lineTo(x + 36 + index * Math.max(24, width / 5), y + height - 44 - (index % 2) * 18);
    }
    this.container.add(trail);
  }

  drawRhythmLane(x, y, width, height) {
    const laneY = y + height - 44;
    const lane = this.scene.add.graphics();
    lane.lineStyle(4, this.presentation.accent, 0.72);
    lane.beginPath();
    lane.moveTo(x + 24, laneY);
    lane.lineTo(x + width - 24, laneY);
    lane.strokePath();
    this.container.add(lane);
    for (let index = 0; index < 5; index += 1) {
      const bar = this.scene.add.rectangle(x + 32 + index * ((width - 64) / 4), laneY - 18, 8, 18 + index % 3 * 8, this.presentation.color, 0.54)
        .setName(`${this.gameId}-beat-bar-${index}`);
      this.container.add(bar);
      this.scene.tweens.add({
        targets: bar,
        scaleY: 1.45,
        duration: 220 + index * 40,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    }
  }

  drawStudyCards(x, y, width, height) {
    for (let index = 0; index < 3; index += 1) {
      const card = this.scene.add.rectangle(x + 38 + index * 42, y + height - 48 - index * 4, 34, 44, 0xffffff, 0.52)
        .setStrokeStyle(2, this.presentation.color, 0.62)
        .setName(`${this.gameId}-study-card-${index}`);
      const line = this.scene.add.rectangle(card.x, card.y + 6, 20, 3, this.presentation.accent, 0.7)
        .setName(`${this.gameId}-study-card-line-${index}`);
      this.container.add([card, line]);
    }
  }

  drawBlockTower(x, y, width, height) {
    const baseX = x + width / 2 - 34;
    const baseY = y + height - 34;
    for (let index = 0; index < 4; index += 1) {
      const block = this.scene.add.rectangle(
        baseX + index * 14,
        baseY - index * 18,
        58 - index * 6,
        18,
        index % 2 === 0 ? this.presentation.color : this.presentation.accent,
        0.72,
      ).setStrokeStyle(2, 0xffffff, 0.78)
        .setName(`${this.gameId}-tower-block-${index}`);
      this.container.add(block);
    }
  }

  tap(group) {
    if (this.finished || !group.active) return;
    this.score += 1;
    this.scoreText.setText(`${this.score}/${this.target}`);
    this.scene.tweens.add({
      targets: group,
      scale: 1.18,
      alpha: 0,
      duration: 160,
      ease: 'Sine.easeOut',
      onComplete: () => group.destroy(),
    });
    if (this.score >= this.target) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.finishTimer?.remove(false);
    const result = {
      gameId: this.gameId,
      score: this.score,
      target: this.target,
      detail: {
        clickedItems: this.score,
        source: 'phaser-room-mini-game',
        motifId: this.presentation.motifId,
        interactionKind: this.presentation.interactionKind,
        objectId: this.object.id,
      },
    };
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.container?.destroy();
        this.resolve?.(result);
      },
    });
  }
}
