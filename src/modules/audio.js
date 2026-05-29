// audio.js - 音频合成系统
import { state } from './core-state.js';
import { set } from './store-client.js';

const masterVolume = 0.25;

export function getAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

export function playSound(type) {
  if (state.isMuted) return;
  const actx = getAudioContext();
  if (actx.state === 'suspended') actx.resume();

  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);

  const now = actx.currentTime;

  switch (type) {
    case 'step':
      osc.frequency.value = 200;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'giggle':
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'cry':
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.3);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'bounce':
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'clap':
      osc.type = 'square';
      osc.frequency.value = 150;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
  }
}

export function toggleMute() {
  state.isMuted = !state.isMuted;
  set('muted', state.isMuted);
}
