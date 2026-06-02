const FEED_ITEMS = [
  { id: 'rice', label: '饭团', value: 2, color: 0xfff3d0 },
  { id: 'egg', label: '玉子烧', value: 2, color: 0xffcf6f },
  { id: 'tomato', label: '小番茄', value: 1, color: 0xf06f7f },
  { id: 'sleepy', label: '困意', value: -1, color: 0x9b8bd7 },
];

export class FeedCatchMiniGame {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.object = options.object;
    this.durationMs = options.durationMs || 2200;
    this.target = options.target || 8;
    this.score = 0;
    this.finished = false;
    this.container = null;
    this.spawnTimer = null;
    this.finishTimer = null;
    this.items = [];
    this.resolve = null;
  }

  start() {
    this.container = this.scene.add.container(0, 0).setDepth(44).setName('feed-catch-mini-game');
    this.drawBoard();
    this.spawnWave();
    this.spawnTimer = this.scene.time.addEvent({
      delay: 360,
      loop: true,
      callback: () => this.spawnWave(),
    });
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.finishTimer = this.scene.time.delayedCall(this.durationMs, () => this.finish());
    });
  }

  drawBoard() {
    const { x, y, width, height } = this.object.hitArea;
    const board = this.scene.add.graphics();
    board.fillStyle(0xfffbf7, 0.24);
    board.lineStyle(2, 0xff9fb4, 0.72);
    board.fillRoundedRect(x, y, width, height, 18);
    board.strokeRoundedRect(x, y, width, height, 18);
    const label = this.scene.add.text(x + 16, y + 12, '接食物', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#583541',
    });
    this.scoreText = this.scene.add.text(x + width - 82, y + 12, `0/${this.target}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#583541',
    });
    this.container.add([board, label, this.scoreText]);
  }

  spawnWave() {
    if (this.finished) return;
    const { x, y, width, height } = this.object.hitArea;
    const item = FEED_ITEMS[this.items.length % FEED_ITEMS.length];
    const itemX = x + 42 + ((this.items.length * 73) % Math.max(80, width - 84));
    const itemY = y + 48;
    const circle = this.scene.add.circle(itemX, itemY, 19, item.color, 0.96)
      .setStrokeStyle(2, item.value > 0 ? 0xffffff : 0x735c8d, 0.9)
      .setInteractive({ cursor: 'pointer' })
      .setName(`feed-item-${item.id}`)
      .setData('feedItemId', item.id);
    const text = this.scene.add.text(itemX, itemY + 1, item.value > 0 ? '饭' : '困', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: item.value > 0 ? '#704129' : '#ffffff',
    }).setOrigin(0.5);
    const group = this.scene.add.container(0, 0, [circle, text]).setDepth(46);
    group.setName(`feed-item-group-${item.id}`);
    circle.on('pointerdown', () => this.catchItem(group, item));
    this.container.add(group);
    this.items.push(group);
    this.scene.tweens.add({
      targets: group,
      y: height - 72,
      duration: 1100,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!group.active) return;
        group.destroy();
      },
    });
  }

  catchItem(group, item) {
    if (this.finished || !group.active) return;
    this.score = Math.max(0, this.score + item.value);
    this.scoreText.setText(`${this.score}/${this.target}`);
    this.scene.tweens.add({
      targets: group,
      scale: item.value > 0 ? 1.22 : 0.82,
      alpha: 0,
      duration: 140,
      ease: 'Sine.easeOut',
      onComplete: () => group.destroy(),
    });
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.spawnTimer?.remove(false);
    this.finishTimer?.remove(false);
    const result = {
      gameId: 'catchFood',
      score: this.score,
      target: this.target,
      detail: {
        clickedItems: this.score,
        source: 'phaser-room-mini-game',
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
