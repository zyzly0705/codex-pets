// speech-queue.js - 气泡排队系统（打字机效果）
import { bubble, bubbleText } from './core-state.js';

export const SPEECH_PRIORITY = { CRITICAL: 100, IMPORTANT: 80, BEHAVIOR: 50, CASUAL: 20 };
const TYPEWRITER_BASE_SPEED = 60; // 每字基础速度（ms）
const TYPEWRITER_FAST_SPEED = 30;  // 短消息快速模式

export class SpeechQueue {
  constructor(maxSize = 5) {
    this.queue = [];
    this.maxSize = maxSize;
    this.isDisplaying = false;
    this._hideTimer = null;
    this._typeTimer = null;
  }

  enqueue(text, duration = 5200, priority = SPEECH_PRIORITY.BEHAVIOR) {
    const now = Date.now();
    if (this.queue.length > 0) {
      const last = this.queue[this.queue.length - 1];
      if (last.text === text && now - last.time < 2000) return;
    }
    if (this.queue.length >= this.maxSize) {
      let minIdx = -1, minPri = Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority < minPri) { minPri = this.queue[i].priority; minIdx = i; }
      }
      if (minIdx >= 0 && minPri < SPEECH_PRIORITY.IMPORTANT) this.queue.splice(minIdx, 1);
    }
    this.queue.push({ text, duration, priority, time: now });
    if (!this.isDisplaying) this._displayNext();
  }

  priorityEnqueue(text, duration = 5200) {
    if (this.isDisplaying) {
      this._stopTyping();
      bubble.classList.add('hiding');
      if (this._currentMsg) {
        this.queue.unshift(this._currentMsg);
        this._currentMsg = null;
      }
      setTimeout(() => {
        bubble.classList.remove('hiding', 'visible');
        bubbleText.textContent = '';
        bubbleText.classList.remove('typing');
        this._displayNext();
      }, 180);
    }
    this.enqueue(text, duration, SPEECH_PRIORITY.CRITICAL);
  }

  replaceBehavior(text, duration = 5200) {
    this.queue = this.queue.filter(msg => msg.priority > SPEECH_PRIORITY.BEHAVIOR);
    if (this.isDisplaying && this._currentMsg?.priority <= SPEECH_PRIORITY.BEHAVIOR) {
      this._stopTyping();
      bubble.classList.remove('visible', 'hiding');
      if (bubbleText) {
        bubbleText.textContent = '';
        bubbleText.classList.remove('typing');
      }
      this.isDisplaying = false;
      this._currentMsg = null;
    }
    this.enqueue(text, duration, SPEECH_PRIORITY.BEHAVIOR);
  }

  _displayNext() {
    if (this.queue.length === 0) {
      this.isDisplaying = false;
      return;
    }
    this.isDisplaying = true;
    const msg = this.queue.shift();
    this._currentMsg = null;
    fireSpeechStartHook(msg.text);
    if (!bubbleText) {
      bubble.textContent = msg.text;
      bubble.classList.add('visible');
      this._hideTimer = setTimeout(() => {
        bubble.classList.remove('visible');
        this._hideTimer = setTimeout(() => this._displayNext(), 300);
      }, msg.duration);
      return;
    }
    bubble.classList.remove('hiding');
    bubble.classList.add('visible');
    bubbleText.textContent = '';
    this._typewrite(msg);
  }

  _typewrite(msg) {
    if (!bubbleText) return;
    const text = msg.text;
    const speed = text.length <= 12 ? TYPEWRITER_FAST_SPEED : TYPEWRITER_BASE_SPEED;
    let charIndex = 0;
    bubbleText.classList.add('typing');
    this._stopTyping();
    this._currentMsg = msg;
    this._typeTimer = setInterval(() => {
      if (charIndex < text.length) {
        bubbleText.textContent = text.slice(0, charIndex + 1);
        charIndex++;
      } else {
        clearInterval(this._typeTimer);
        this._typeTimer = null;
        bubbleText.classList.remove('typing');
        bubbleText.textContent = text;
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
          bubble.classList.add('hiding');
          this._hideTimer = setTimeout(() => {
            bubble.classList.remove('visible', 'hiding');
            bubbleText.textContent = '';
            bubbleText.classList.remove('typing');
            this._currentMsg = null;
            this._displayNext();
          }, 180);
        }, msg.duration);
      }
    }, speed);
  }

  _stopTyping() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    clearTimeout(this._hideTimer);
  }

  clear() {
    this.queue = [];
    this.isDisplaying = false;
    this._stopTyping();
    clearTimeout(this._hideTimer);
    bubble.classList.remove('visible', 'hiding');
    bubbleText.textContent = '';
    bubbleText.classList.remove('typing');
    this._currentMsg = null;
  }
}

export const speechQueue = new SpeechQueue();

let _onSpeechStartHook = null;
export function registerSpeechStartHook(fn) { _onSpeechStartHook = fn; }
export function fireSpeechStartHook(text) { _onSpeechStartHook?.(text); }

export function say(text, duration = 5200) {
  speechQueue.replaceBehavior(text, duration);
}
