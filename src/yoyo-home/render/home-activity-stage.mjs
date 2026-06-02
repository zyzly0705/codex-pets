const ACTIVITY_STAGE_STYLE = {
  sleep: {
    title: '窝进小床',
    motif: 'sleep',
    color: 0xa7b8ff,
    accent: 0xfff2a6,
    durationMs: 1060,
    marks: ['z', 'z', 'z'],
  },
  bath: {
    title: '泡泡洗香香',
    motif: 'bubbles',
    color: 0x8fd8ff,
    accent: 0xffffff,
    durationMs: 980,
    marks: ['o', 'o', 'o'],
  },
  comfort: {
    title: '靠近贴贴',
    motif: 'comfort',
    color: 0xffaac8,
    accent: 0xffffff,
    durationMs: 920,
    marks: ['+', '+', '+'],
  },
  watchAnime: {
    title: '认真看动画',
    motif: 'screen',
    color: 0xffd36b,
    accent: 0x9edfff,
    durationMs: 1040,
    marks: ['1', '2', '3'],
  },
};

const DEFAULT_STAGE_STYLE = {
  title: '一起互动',
  motif: 'sparkle',
  color: 0xa6dfc8,
  accent: 0xffffff,
  durationMs: 700,
  marks: ['+', '+', '+'],
};

export function getActivityStageStyle(actionId) {
  return ACTIVITY_STAGE_STYLE[actionId] || DEFAULT_STAGE_STYLE;
}

export class HomeActivityStage {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.object = options.object;
    this.task = options.task;
    this.style = getActivityStageStyle(this.task?.actionId);
    this.container = null;
    this.particleCount = 0;
  }

  start() {
    this.container = this.scene.add.container(0, 0)
      .setDepth(43)
      .setName(`activity-stage-${this.task.actionId}`);
    this.drawStage();
    return new Promise((resolve) => {
      this.scene.time.delayedCall(this.style.durationMs, () => {
        this.finish(resolve);
      });
    });
  }

  drawStage() {
    const { x, y, width, height } = this.object.hitArea;
    const panel = this.scene.add.graphics();
    panel.fillStyle(0xfffbf7, 0.2);
    panel.lineStyle(2, this.style.color, 0.78);
    panel.fillRoundedRect(x, y, width, height, 18);
    panel.strokeRoundedRect(x, y, width, height, 18);

    const label = this.scene.add.text(x + 14, y + 12, this.style.title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#583541',
    });
    this.container.add([panel, label]);
    this.drawMotif(x, y, width, height);
    this.drawProgress(x, y, width, height);

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    this.style.marks.forEach((mark, index) => {
      const offset = (index - 1) * 38;
      const marker = this.scene.add.circle(centerX + offset, centerY + 12, 19, this.style.color, 0.85)
        .setStrokeStyle(2, this.style.accent, 0.92)
        .setName(`activity-stage-${this.task.actionId}-mark-${index}`);
      const text = this.scene.add.text(centerX + offset, centerY + 13, mark, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      const group = this.scene.add.container(0, 0, [marker, text]).setDepth(44);
      this.container.add(group);
      this.scene.tweens.add({
        targets: group,
        y: -10,
        alpha: 0.35,
        duration: 360 + index * 90,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  drawMotif(x, y, width, height) {
    if (this.style.motif === 'screen') {
      this.drawScreenMotif(x, y, width, height);
      return;
    }
    const countByMotif = {
      sleep: 5,
      bubbles: 9,
      comfort: 7,
      sparkle: 6,
    };
    const count = countByMotif[this.style.motif] || 5;
    for (let index = 0; index < count; index += 1) {
      const fraction = (index + 1) / (count + 1);
      const particleX = x + 24 + (width - 48) * fraction;
      const particleY = y + height * (0.42 + (index % 3) * 0.11);
      const radius = this.style.motif === 'bubbles' ? 10 + (index % 3) * 3 : 8 + (index % 2) * 3;
      const particle = this.scene.add.circle(particleX, particleY, radius, this.style.color, 0.32)
        .setStrokeStyle(2, this.style.accent, 0.82)
        .setName(`activity-${this.task.actionId}-${this.style.motif}-${index}`);
      this.container.add(particle);
      this.particleCount += 1;
      this.scene.tweens.add({
        targets: particle,
        y: particleY - 22 - (index % 2) * 10,
        x: particleX + (index % 2 === 0 ? 8 : -8),
        alpha: 0.1,
        scale: 1.18,
        duration: 520 + index * 45,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  drawScreenMotif(x, y, width, height) {
    const panelWidth = Math.min(120, width - 44);
    const panelHeight = Math.min(72, height - 70);
    const screenX = x + width / 2 - panelWidth / 2;
    const screenY = y + height / 2 - panelHeight / 2 + 10;
    const screen = this.scene.add.graphics();
    screen.fillStyle(0x3b6d8a, 0.45);
    screen.lineStyle(2, this.style.accent, 0.9);
    screen.fillRoundedRect(screenX, screenY, panelWidth, panelHeight, 14);
    screen.strokeRoundedRect(screenX, screenY, panelWidth, panelHeight, 14);
    this.container.add(screen);
    for (let index = 0; index < 4; index += 1) {
      const dot = this.scene.add.circle(
        screenX + 22 + index * 25,
        screenY + 24 + (index % 2) * 20,
        6,
        index % 2 === 0 ? this.style.color : this.style.accent,
        0.86,
      ).setName(`activity-${this.task.actionId}-screen-light-${index}`);
      this.container.add(dot);
      this.particleCount += 1;
      this.scene.tweens.add({
        targets: dot,
        alpha: 0.22,
        scale: 1.35,
        duration: 260 + index * 90,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });
    }
  }

  drawProgress(x, y, width, height) {
    const trackWidth = Math.max(56, width - 56);
    const trackX = x + 28;
    const trackY = y + height - 28;
    const track = this.scene.add.rectangle(trackX, trackY, trackWidth, 6, 0xffffff, 0.42)
      .setOrigin(0, 0.5)
      .setName(`activity-stage-${this.task.actionId}-progress-track`);
    const fill = this.scene.add.rectangle(trackX, trackY, trackWidth, 6, this.style.color, 0.9)
      .setOrigin(0, 0.5)
      .setScale(0.08, 1)
      .setName(`activity-stage-${this.task.actionId}-progress-fill`);
    this.container.add([track, fill]);
    this.scene.tweens.add({
      targets: fill,
      scaleX: 1,
      duration: this.style.durationMs - 160,
      ease: 'Sine.easeInOut',
    });
  }

  finish(resolve) {
    const result = {
      gameId: `${this.task.actionId}Activity`,
      score: 1,
      target: 1,
      detail: {
        source: 'phaser-room-activity-stage',
        stageId: this.task.actionId,
        motifId: this.style.motif,
        particleCount: this.particleCount,
        objectId: this.object.id,
      },
    };
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.container?.destroy();
        resolve(result);
      },
    });
  }
}
