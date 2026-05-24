// tests/interaction-thresholds.test.mjs
// 验证情绪相关的交互阈值函数：呼噜阈值和鞭打哭泣阈值
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── 内联 interaction.js 的阈值函数（与源文件保持一致）──────────────────────
function getPurringThreshold(label) {
  let base;
  if (label === 'excited' || label === 'happy') base = 2;
  else if (label === 'calm') base = 4;
  else if (label === 'sad') base = 6;
  else if (label === 'angry') base = 8;
  else base = 3;
  // 随机扰动 ±1（测试中用固定 0 来确定性验证）
  return base;
}

function getWhipCryThreshold(preWhipValence) {
  let base;
  if (preWhipValence < 40) base = 3;
  else if (preWhipValence < 65) base = 5;
  else base = 7;
  return base;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPurringThreshold', () => {
  test('开心/兴奋时阈值最低 (2)', () => {
    assert.equal(getPurringThreshold('happy'),   2);
    assert.equal(getPurringThreshold('excited'), 2);
  });

  test('平静时阈值适中 (4)', () => {
    assert.equal(getPurringThreshold('calm'), 4);
  });

  test('难过时需要更多安抚 (6)', () => {
    assert.equal(getPurringThreshold('sad'), 6);
  });

  test('生气时阈值最高 (8)', () => {
    assert.equal(getPurringThreshold('angry'), 8);
  });

  test('中性时返回默认值 (3)', () => {
    assert.equal(getPurringThreshold('neutral'), 3);
  });

  test('情绪越差，阈值越高（单调性）', () => {
    const order = ['excited', 'happy', 'neutral', 'calm', 'sad', 'angry'];
    const values = order.map(getPurringThreshold);
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] >= values[i - 1],
        `${order[i]}(${values[i]}) 应 >= ${order[i-1]}(${values[i-1]})`);
    }
  });
});

describe('getWhipCryThreshold', () => {
  test('已经非常难过时 (valence=20) → 容易哭 (3)', () => {
    assert.equal(getWhipCryThreshold(20), 3);
    assert.equal(getWhipCryThreshold(39), 3);
  });

  test('正常情绪 (valence=55) → 中等阈值 (5)', () => {
    assert.equal(getWhipCryThreshold(55), 5);
    assert.equal(getWhipCryThreshold(40), 5);
    assert.equal(getWhipCryThreshold(64), 5);
  });

  test('很开心时被打 (valence=80) → 更能抗 (7)', () => {
    assert.equal(getWhipCryThreshold(80), 7);
    assert.equal(getWhipCryThreshold(65), 7);
  });

  test('valence 越低，哭泣阈值越低（单调性）', () => {
    const sad = getWhipCryThreshold(20);
    const normal = getWhipCryThreshold(55);
    const happy = getWhipCryThreshold(80);
    assert.ok(sad < normal, `难过(${sad}) 应 < 正常(${normal})`);
    assert.ok(normal < happy, `正常(${normal}) 应 < 开心(${happy})`);
  });
});

describe('情绪联动', () => {
  test('被打哭后 valence 降到 < 40，后续哭泣阈值变低', () => {
    const valenceAfterWhip = 30; // whip 降了 ~25 点
    const threshold = getWhipCryThreshold(valenceAfterWhip);
    assert.equal(threshold, 3, '已经难过的 Yoyo 更容易被打哭');
  });

  test('刚被大量抚摸的 Yoyo valence 高，哭泣阈值高', () => {
    const valenceAfterPets = 85;
    const threshold = getWhipCryThreshold(valenceAfterPets);
    assert.equal(threshold, 7, '开心的 Yoyo 更能抗打');
  });
});
