// state-machine.js - 三层状态机

export const GLOBAL_MODES = { INTERACTIVE: 'interactive', AUTO_PLAY: 'auto_play', SLEEP: 'sleep', FROZEN: 'frozen' };
export const ACTION_STATES = { IDLE: 'idle', WALKING: 'walking', DANCING: 'dancing', CLIMBING: 'climbing', FOLLOWING: 'following', FEEDING: 'feeding', DRAGGING: 'dragging', TYPING_COMPANION: 'typing_companion', WHIP: 'whip', DROPPING: 'dropping' };
export const EFFECTS = { EMOTION_BUBBLE: 'emotion_bubble', SEASONAL_PARTICLES: 'seasonal_particles', SCALE_ANIMATION: 'scale_animation', CLONE_EFFECT: 'clone_effect' };

export class StateMachine {
  constructor() {
    this.globalMode = GLOBAL_MODES.INTERACTIVE;
    this.actionState = ACTION_STATES.IDLE;
    this.effects = new Set();
    this.lastTransition = Date.now();
    this.transitionHistory = [];

    this.exclusiveGroups = {
      movement: [ACTION_STATES.WALKING, ACTION_STATES.CLIMBING, ACTION_STATES.FOLLOWING],
      interaction: [ACTION_STATES.DRAGGING, ACTION_STATES.FEEDING],
      specialty: [ACTION_STATES.DANCING, ACTION_STATES.TYPING_COMPANION],
      punish: [ACTION_STATES.WHIP, ACTION_STATES.DROPPING]
    };

    this.locks = new Map();
  }

  canTransition(targetAction) {
    if (this.globalMode === GLOBAL_MODES.FROZEN) return false;
    if (this.globalMode === GLOBAL_MODES.SLEEP && targetAction !== ACTION_STATES.IDLE) return false;
    if (this.actionState === targetAction) return true;
    if (this.actionState !== ACTION_STATES.IDLE) {
      if (this.exclusiveGroups.punish.includes(this.actionState)) return false;
    }
    return true;
  }

  transition(targetAction, effects = []) {
    if (!this.canTransition(targetAction)) return false;

    const prev = this.actionState;
    this.actionState = targetAction;
    this.lastTransition = Date.now();
    this.effects = new Set(effects);

    this.transitionHistory.push({ from: prev, to: targetAction, time: Date.now() });
    if (this.transitionHistory.length > 10) this.transitionHistory.shift();

    return true;
  }

  setGlobalMode(mode) {
    this.globalMode = mode;
    if (mode === GLOBAL_MODES.SLEEP) this.actionState = ACTION_STATES.IDLE;
  }

  addEffect(effect) { this.effects.add(effect); }
  removeEffect(effect) { this.effects.delete(effect); }
  hasEffect(effect) { return this.effects.has(effect); }

  acquireLock(name, duration = 0) {
    this.locks.set(name, { startTime: Date.now(), duration });
  }
  releaseLock(name) {
    this.locks.delete(name);
  }
  isLocked(name) {
    const lock = this.locks.get(name);
    if (!lock) return false;
    if (lock.duration > 0 && Date.now() - lock.startTime > lock.duration) {
      this.locks.delete(name);
      return false;
    }
    return true;
  }
  isAnyLocked() {
    return this.locks.size > 0;
  }

  get isIdle()      { return this.actionState === ACTION_STATES.IDLE && this.globalMode === GLOBAL_MODES.INTERACTIVE; }
  get isDancing()   { return this.actionState === ACTION_STATES.DANCING; }
  get isFollowing() { return this.actionState === ACTION_STATES.FOLLOWING; }
  get isSleeping()  { return this.globalMode === GLOBAL_MODES.SLEEP; }
  get isWhipping()  { return this.actionState === ACTION_STATES.WHIP; }
  get isDropping()  { return this.actionState === ACTION_STATES.DROPPING; }
  get isDragging()  { return this.actionState === ACTION_STATES.DRAGGING; }
  get isClimbing()  { return this.actionState === ACTION_STATES.CLIMBING; }
  get isFeeding()   { return this.actionState === ACTION_STATES.FEEDING; }

  isInGroup(groupName) {
    const group = this.exclusiveGroups[groupName];
    return group && group.includes(this.actionState);
  }
}

export const stateMachine = new StateMachine();
