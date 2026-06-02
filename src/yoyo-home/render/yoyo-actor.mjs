export class YoyoActor {
  static supportedFallbackAnimations = [
    'idle',
    'walk_left',
    'walk_right',
    'turn_left',
    'turn_right',
    'eat_start',
    'eat_loop',
    'eat_end',
    'sleep_start',
    'sleep_loop',
    'sleep_end',
    'bath_loop',
    'bath_start',
    'bath_end',
    'play_start',
    'play_loop',
    'play_end',
    'comfort_start',
    'comfort_loop',
    'comfort_end',
    'study_start',
    'study_loop',
    'study_end',
    'watch_start',
    'watch_loop',
    'watch_end',
    'game_start',
    'game_loop',
    'game_end',
    'blocks_start',
    'blocks_loop',
    'blocks_end',
    'happy_idle',
    'sleepy_idle',
    'fresh_idle',
  ];

  constructor(scene, manifest) {
    this.scene = scene;
    this.manifest = manifest;
    this.sprite = null;
    this.shadow = null;
    this.facing = 'right';
    this.currentAnimation = 'idle';
    this.motionTween = null;
  }

  preload() {
    this.scene.load.image('yoyo.actor.fallback', this.manifest.actor.fallbackSprite);
  }

  create() {
    const start = { x: 636, y: 612 };
    this.shadow = this.scene.add.ellipse(start.x, start.y + 4, 66, 18, 0x3e2f27, 0.18)
      .setDepth(29);
    this.sprite = this.scene.add.image(start.x, start.y, 'yoyo.actor.fallback')
      .setOrigin(this.manifest.actor.anchor.x, this.manifest.actor.anchor.y)
      .setScale(this.manifest.actor.scale)
      .setDepth(30)
      .setName('yoyo-actor');
    this.play('idle');
    return this;
  }

  setFacing(facing) {
    if (!this.sprite) return;
    this.facing = facing;
    this.sprite.setFlipX(facing === 'left');
  }

  play(animation) {
    this.currentAnimation = animation;
    if (!this.sprite) return;
    this.motionTween?.stop();
    this.motionTween = null;
    this.sprite.setAngle(0);
    this.sprite.setScale(this.manifest.actor.scale);
    this.sprite.setAlpha(1);
    this.sprite.setData('animation', animation);
    if (animation.includes('eat')) {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        y: this.sprite.y - 6,
        duration: 220,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    } else if (animation === 'sleep_loop') {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        y: this.sprite.y + 3,
        alpha: 0.88,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (animation === 'bath_loop') {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: 2,
        x: this.sprite.x + 3,
        duration: 180,
        yoyo: true,
        repeat: 5,
        ease: 'Sine.easeInOut',
      });
    } else if (animation === 'comfort_loop') {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        scale: this.manifest.actor.scale * 1.035,
        duration: 420,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    } else if (animation === 'watch_loop' || animation === 'study_loop' || animation === 'game_loop') {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: this.facing === 'left' ? -1.8 : 1.8,
        duration: 380,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    } else if (animation === 'fresh_idle' || animation === 'happy_idle' || animation === 'sleepy_idle') {
      this.motionTween = this.scene.tweens.add({
        targets: this.sprite,
        y: this.sprite.y - 4,
        duration: 260,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  moveTo(target, options = {}) {
    if (!this.sprite || !this.shadow) return Promise.resolve();
    this.setFacing(target.facing || (target.x < this.sprite.x ? 'left' : 'right'));
    this.play(target.x < this.sprite.x ? 'walk_left' : 'walk_right');
    const duration = options.duration ?? Math.max(420, Math.abs(target.x - this.sprite.x) * 4);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.shadow,
        x: target.x,
        y: target.y + 4,
        duration,
        ease: 'Sine.easeInOut',
      });
      this.scene.tweens.add({
        targets: this.sprite,
        x: target.x,
        y: target.y,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.setFacing(target.facing || this.facing);
          this.play(options.afterAnimation || 'idle');
          resolve();
        },
      });
    });
  }

  getPosition() {
    return this.sprite ? { x: this.sprite.x, y: this.sprite.y } : { x: 0, y: 0 };
  }
}
