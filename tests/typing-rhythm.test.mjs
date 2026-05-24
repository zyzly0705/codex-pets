// tests/typing-rhythm.test.mjs
// 验证键盘节奏感知的状态机逻辑
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── 内联 interaction.js 中的键盘节奏核心逻辑 ──────────────────────────────
const TYPING_BREAK_THRESHOLD_MS = 5 * 60 * 1000;
const TYPING_REMINDER_STAGES = [
  { ms: 40 * 60 * 1000, label: '40min' },
  { ms: 70 * 60 * 1000, label: '70min' },
  { ms: 100 * 60 * 1000, label: '100min' },
];

function createState() {
  return { keyboardActiveUntil: 0, continuousTypingStart: 0, typingReminderStage: 0 };
}

function processKeyEvent(state, now) {
  const events = [];
  const gapMs = state.keyboardActiveUntil > 0 ? now - state.keyboardActiveUntil : Infinity;
  const isNewSession = gapMs >= TYPING_BREAK_THRESHOLD_MS;

  if (isNewSession) {
    if (state.keyboardActiveUntil > 0) events.push({ type: 'return', gapMs });
    state.continuousTypingStart = now;
    state.typingReminderStage = 0;
  }

  state.keyboardActiveUntil = now + 3000;

  const sessionMs = now - state.continuousTypingStart;
  const stage = state.typingReminderStage;
  if (stage < TYPING_REMINDER_STAGES.length && sessionMs >= TYPING_REMINDER_STAGES[stage].ms) {
    events.push({ type: 'reminder', stage, label: TYPING_REMINDER_STAGES[stage].label, sessionMs });
    state.typingReminderStage++;
  }

  return events;
}

function simulate(keyTimes) {
  const state = createState();
  const fired = [];
  for (const t of keyTimes) fired.push(...processKeyEvent(state, t));
  return { fired, state };
}

const MIN = 60 * 1000;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('连续打字提醒', () => {
  test('105分钟连续打字触发三次提醒', () => {
    const keys = [];
    for (let m = 0; m < 105; m += 2) keys.push(m * MIN);
    const { fired } = simulate(keys);
    const reminders = fired.filter(e => e.type === 'reminder');
    assert.equal(reminders.length, 3, `应有 3 次提醒，实际 ${reminders.length}`);
    assert.equal(reminders[0].label, '40min');
    assert.equal(reminders[1].label, '70min');
    assert.equal(reminders[2].label, '100min');
  });

  test('35分钟只触发0次提醒', () => {
    const keys = [];
    for (let m = 0; m < 35; m += 2) keys.push(m * MIN);
    const { fired } = simulate(keys);
    assert.equal(fired.length, 0);
  });

  test('40分钟只触发第一次提醒', () => {
    const keys = [];
    for (let m = 0; m <= 42; m += 2) keys.push(m * MIN);
    const { fired } = simulate(keys);
    const reminders = fired.filter(e => e.type === 'reminder');
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].label, '40min');
  });
});

describe('休息检测', () => {
  test('停顿 < 5 分钟不重置会话', () => {
    // 打 3 分钟，停 3 分钟（< 5min），再打 3 分钟 → 合计 6 分钟，无提醒，无 return
    const keys = [];
    for (let m = 0; m < 3; m++) keys.push(m * MIN);
    const resumeAt = 6 * MIN;
    keys.push(resumeAt);
    const { fired, state } = simulate(keys);
    assert.equal(fired.filter(e => e.type === 'return').length, 0, '短停顿不应触发 return');
    assert.equal(state.typingReminderStage, 0, '会话没有重置，stage 仍为 0');
  });

  test('停顿 ≥ 5 分钟触发 return 事件', () => {
    // keyboardActiveUntil = lastKey + 3000，所以 gap 要超过 BREAK_THRESHOLD + 3s
    const keys = [0, 1 * MIN];
    keys.push(1 * MIN + TYPING_BREAK_THRESHOLD_MS + 4000); // 充分超过阈值
    const { fired } = simulate(keys);
    assert.equal(fired.filter(e => e.type === 'return').length, 1, '应有 1 次 return 事件');
  });

  test('休息后重新计时，阶段重置为 0', () => {
    // 打 41 分钟（触发第一阶段） → 休息 6 分钟 → 再打 1 分钟
    const keys = [];
    for (let m = 0; m <= 41; m += 2) keys.push(m * MIN);
    keys.push(47 * MIN); // 6 分钟后回来
    const { state, fired } = simulate(keys);
    assert.equal(state.typingReminderStage, 0, '休息后 stage 重置为 0');
    assert.equal(fired.filter(e => e.type === 'return').length, 1);
    const reminders = fired.filter(e => e.type === 'reminder');
    assert.equal(reminders[0].label, '40min', '回来前已触发 40min 提醒');
  });
});

describe('边界情况', () => {
  test('第一次打字（keyboardActiveUntil=0）不触发 return', () => {
    const { fired } = simulate([0]);
    assert.equal(fired.filter(e => e.type === 'return').length, 0);
  });

  test('每个阶段只触发一次', () => {
    // 从 0 开始打，到 45 分钟，40min 阶段只触发一次
    const keys = [];
    for (let m = 0; m <= 45; m++) keys.push(m * MIN);
    const { fired } = simulate(keys);
    const stage0 = fired.filter(e => e.type === 'reminder' && e.stage === 0);
    assert.equal(stage0.length, 1, '40min 提醒只触发一次');
  });
});
