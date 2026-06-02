import {
  getHomeActionPresentation,
  getHomeObjectById,
  getHomeObjectForAction,
  YOYO_HOME_MANIFEST,
} from '../data/home-manifest.mjs';
import {
  advanceCurrentTask,
  createHomeState,
  reduceHomeEvent,
  selectNeedDrivenBehavior,
} from '../sim/home-sim.mjs';
import { FeedCatchMiniGame } from '../minigames/feed-catch.mjs';
import { RoomTapSequenceMiniGame } from '../minigames/room-tap-sequence.mjs';
import { HomeActivityStage } from '../render/home-activity-stage.mjs';
import { YoyoActor } from '../render/yoyo-actor.mjs';

const PHASE_DELAY_MS = 360;

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('YoyoHomeRoom');
    this.manifest = YOYO_HOME_MANIFEST;
    this.state = createHomeState({ manifest: this.manifest, now: Date.now() });
    this.actor = null;
    this.debugPanel = null;
    this.homeHud = null;
    this.phaseTimer = null;
    this.isRunningTask = false;
  }

  init(data = {}) {
    this.debugPanel = data.debugPanel || null;
    this.homeHud = data.homeHud || null;
    this.debug = data.debug === true;
    this.onStateChange = typeof data.onStateChange === 'function' ? data.onStateChange : null;
    if (data.initialState) {
      this.state = data.initialState;
    }
  }

  preload() {
    this.load.image('room.day', this.manifest.room.backgrounds.day);
    this.actor = new YoyoActor(this, this.manifest);
    this.actor.preload();
  }

  create() {
    this.add.image(0, 0, 'room.day')
      .setOrigin(0, 0)
      .setDisplaySize(this.manifest.room.size.width, this.manifest.room.size.height)
      .setName('room-background');
    this.actor.create();
    this.createObjectZones();
    this.createSpeechBubble();
    this.updateDebug();
    this.events.emit('yoyo-home-state', this.state);
  }

  update(_time, delta) {
    if (this.isRunningTask) return;
    this.state = reduceHomeEvent(this.state, { type: 'tick', now: this.state.now + delta }, this.manifest);
    const behavior = selectNeedDrivenBehavior(this.state, this.manifest);
    if (behavior?.actionId === 'feed') {
      this.startTask(behavior.objectId, behavior.actionId, 'auto');
    }
    this.updateDebug();
  }

  createObjectZones() {
    for (const object of this.manifest.objects) {
      const { x, y, width, height } = object.hitArea;
      const zone = this.add.zone(x, y, width, height)
        .setOrigin(0, 0)
        .setInteractive({ cursor: 'pointer' })
        .setName(`zone-${object.id}`)
        .setData('objectId', object.id);
      zone.on('pointerdown', () => {
        const actionId = object.id === 'mealTable' ? 'feed' : object.capabilities[0];
        this.startTask(object.id, actionId, 'click');
      });

      if (this.debug) {
        this.add.rectangle(x, y, width, height, 0xffffff, 0.001)
          .setOrigin(0, 0)
          .setStrokeStyle(2, object.id === 'mealTable' ? 0xff8f9f : 0x78c8b6, 0.7)
          .setDepth(40)
          .setName(`debug-hit-${object.id}`);
      }
    }
  }

  createSpeechBubble() {
    const bubble = this.add.container(636, 328).setDepth(45).setName('speech-bubble');
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.94);
    bg.lineStyle(2, 0xf4b7c6, 0.95);
    bg.fillRoundedRect(-70, -32, 140, 52, 18);
    bg.strokeRoundedRect(-70, -32, 140, 52, 18);
    bg.fillTriangle(-10, 20, 14, 20, 0, 38);
    const text = this.add.text(0, -7, '妈妈～', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#4a3340',
    }).setOrigin(0.5);
    bubble.add([bg, text]);
    this.bubbleText = text;
  }

  startTask(objectId, actionId, source) {
    if (this.isRunningTask || this.state.currentTask) return;
    this.state = reduceHomeEvent(this.state, { type: 'objectClick', objectId, actionId, source }, this.manifest);
    if (!this.state.currentTask) return;
    this.isRunningTask = true;
    this.updateDebug();
    this.runCurrentTask();
  }

  async runCurrentTask() {
    while (this.state.currentTask) {
      const task = this.state.currentTask;
      const object = getHomeObjectById(this.manifest, task.objectId);
      const presentation = getHomeActionPresentation(task.actionId);
      if (task.lifecycle === 'approach') {
        this.bubbleText.setText('我来啦～');
        await this.actor.moveTo(object.actorSpot);
      } else if (task.lifecycle === 'invite') {
        this.actor.play(presentation.startAnimation);
        this.bubbleText.setText(presentation.inviteLine);
        this.updateDebug();
        await this.delay(PHASE_DELAY_MS);
      } else if (task.lifecycle === 'active') {
        this.actor.play(presentation.loopAnimation);
        this.bubbleText.setText(presentation.activeLine);
        this.updateDebug();
        const result = task.miniGame
          ? await this.runMiniGame(task, object)
          : await this.runInteraction(task, object);
        this.state = reduceHomeEvent(this.state, {
          type: 'taskResult',
          gameId: result.gameId,
          score: result.score,
          target: result.target,
          mode: task.activeMode,
          detail: result.detail,
        }, this.manifest);
      } else if (task.lifecycle === 'result') {
        this.bubbleText.setText(presentation.resultLine);
        await this.delay(PHASE_DELAY_MS);
      } else if (task.lifecycle === 'careDelta') {
        this.actor.play(presentation.endAnimation);
        this.updateDebug();
        await this.delay(PHASE_DELAY_MS);
      } else if (task.lifecycle === 'aftermath') {
        this.actor.play(presentation.completeAnimation);
        this.bubbleText.setText(presentation.aftermathLine);
        this.updateDebug();
        await this.delay(PHASE_DELAY_MS);
      }

      this.state = advanceCurrentTask(this.state);
      this.updateDebug();
      this.events.emit('yoyo-home-state', this.state);
    }

    await this.actor.moveTo({ x: 636, y: 612, facing: 'right' }, { duration: 920, afterAnimation: 'idle' });
    this.bubbleText.setText('妈妈～');
    this.isRunningTask = false;
    this.updateDebug();
  }

  delay(ms) {
    return new Promise((resolve) => {
      this.phaseTimer = this.time.delayedCall(ms, resolve);
    });
  }

  runMiniGame(task, object) {
    if (task.miniGame === 'catchFood') {
      return new FeedCatchMiniGame(this, { object }).start();
    }
    return new RoomTapSequenceMiniGame(this, {
      object,
      gameId: task.miniGame,
    }).start();
  }

  async runInteraction(task, object) {
    return new HomeActivityStage(this, { task, object }).start();
  }

  updateDebug() {
    this.debugPanel?.update(this.state);
    this.homeHud?.update(this.state);
    window.YOYO_HOME_REBUILD_STATE = this.state;
    window.YOYO_HOME_REBUILD_RUNTIME = {
      isRunningTask: this.isRunningTask,
      actorAnimation: this.actor?.currentAnimation || 'none',
      startAction: (actionId) => {
        const object = getHomeObjectForAction(this.manifest, actionId);
        if (!object) return false;
        this.startTask(object.id, actionId, 'debug-api');
        return true;
      },
    };
    this.onStateChange?.(this.state);
  }

  applyExternalNeeds(needs, detail = {}) {
    const profile = detail.snapshot?.profile || {};
    this.state = {
      ...this.state,
      needs: {
        ...this.state.needs,
        ...needs,
      },
      relationship: {
        ...this.state.relationship,
        intimacy: profile.intimacy ?? this.state.relationship.intimacy,
        xp: profile.xp ?? this.state.relationship.xp,
        stage: profile.stage || this.state.relationship.stage,
        companionDays: profile.companionDays ?? this.state.relationship.companionDays,
      },
      lifeSnapshot: detail.snapshot || this.state.lifeSnapshot,
      eventLog: [
        ...this.state.eventLog,
        {
          type: 'externalNeeds',
          detail,
          index: this.state.eventLog.length,
        },
      ].slice(-200),
    };
    this.updateDebug();
  }
}

export function createYoyoHomeGame({ parent, debugPanel, homeHud, debug = false, initialState = null, onStateChange = null } = {}) {
  const config = {
    type: Phaser.AUTO,
    parent,
    width: YOYO_HOME_MANIFEST.room.size.width,
    height: YOYO_HOME_MANIFEST.room.size.height,
    backgroundColor: '#d9ece7',
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
  const game = new Phaser.Game(config);
  game.scene.add('YoyoHomeRoom', RoomScene, true, { debugPanel, homeHud, debug, initialState, onStateChange });
  return game;
}
