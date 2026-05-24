// tests/walk-emotion.test.mjs
// 验证情绪影响行走行为的评分和参数逻辑
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── 内联 walk 的 utilityFn（去掉 browser 依赖，保持逻辑一致）──────────────
function walkUtility(needs, ctx, emotion) {
  let score = needs.playfulness * 0.5 + needs.boredom * 0.2;
  if (ctx.weatherKind === 'clear') score += 15;
  if (ctx.hour >= 8 && ctx.hour <= 11) score += 10;
  if (ctx.weatherKind === 'rain') score -= 20;
  if (ctx.hour >= 23 || ctx.hour < 6) score -= 30;
  if (emotion.valence > 70 && emotion.arousal > 55) score += 18;
  else if (emotion.valence < 35) score -= 22;
  return Math.max(0, Math.min(100, score));
}

// 情绪决定步速和距离的参数计算
function walkParams(emotion) {
  const { valence, arousal } = emotion;
  let distanceMult = 1;
  let stepSize = 2;
  if (valence > 70 && arousal > 55) {
    distanceMult = 1.6; stepSize = 3;
  } else if (valence < 35) {
    distanceMult = 0.5; stepSize = 1;
  }
  if (arousal > 78) stepSize = Math.min(4, stepSize + 1);
  else if (arousal < 28) stepSize = Math.max(1, stepSize - 1);
  return { distanceMult, stepSize };
}

const baseNeeds = { playfulness: 50, boredom: 40, energy: 30, hunger: 20 };
const baseCtx   = { weatherKind: 'clear', hour: 10, workMode: false };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('walk utilityFn 情绪修正', () => {
  test('开心兴奋时分数更高', () => {
    const happy    = walkUtility(baseNeeds, baseCtx, { valence: 80, arousal: 70 });
    const neutral  = walkUtility(baseNeeds, baseCtx, { valence: 55, arousal: 55 });
    assert.ok(happy > neutral, `开心(${happy}) 应 > 中性(${neutral})`);
  });

  test('难过时分数更低', () => {
    const sad     = walkUtility(baseNeeds, baseCtx, { valence: 25, arousal: 55 });
    const neutral = walkUtility(baseNeeds, baseCtx, { valence: 55, arousal: 55 });
    assert.ok(sad < neutral, `难过(${sad}) 应 < 中性(${neutral})`);
  });

  test('分数始终在 [0, 100]', () => {
    const extremeHappy = walkUtility(
      { playfulness: 100, boredom: 100, energy: 0, hunger: 0 },
      { ...baseCtx, weatherKind: 'clear', hour: 10 },
      { valence: 100, arousal: 100 }
    );
    assert.ok(extremeHappy <= 100 && extremeHappy >= 0);

    const extremeSad = walkUtility(
      { playfulness: 0, boredom: 0, energy: 100, hunger: 100 },
      { ...baseCtx, weatherKind: 'rain', hour: 2 },
      { valence: 0, arousal: 55 }
    );
    assert.ok(extremeSad >= 0 && extremeSad <= 100);
  });

  test('雨天减分', () => {
    const clear = walkUtility(baseNeeds, { ...baseCtx, weatherKind: 'clear' }, { valence: 55, arousal: 55 });
    const rain  = walkUtility(baseNeeds, { ...baseCtx, weatherKind: 'rain'  }, { valence: 55, arousal: 55 });
    assert.ok(rain < clear, `雨天(${rain}) 应 < 晴天(${clear})`);
  });

  test('深夜大幅减分', () => {
    const day   = walkUtility(baseNeeds, { ...baseCtx, hour: 10 }, { valence: 55, arousal: 55 });
    const night = walkUtility(baseNeeds, { ...baseCtx, hour: 2  }, { valence: 55, arousal: 55 });
    assert.ok(night < day, `深夜(${night}) 应 < 白天(${day})`);
  });
});

describe('walk 步速和距离参数', () => {
  test('开心兴奋 → 大步快跑', () => {
    const { distanceMult, stepSize } = walkParams({ valence: 80, arousal: 70 });
    assert.equal(distanceMult, 1.6);
    assert.equal(stepSize, 3);
  });

  test('难过 → 慢慢挪动', () => {
    const { distanceMult, stepSize } = walkParams({ valence: 25, arousal: 50 });
    assert.equal(distanceMult, 0.5);
    assert.equal(stepSize, 1);
  });

  test('普通情绪 → 默认参数', () => {
    const { distanceMult, stepSize } = walkParams({ valence: 55, arousal: 55 });
    assert.equal(distanceMult, 1);
    assert.equal(stepSize, 2);
  });

  test('极高 arousal → 步速上限 4', () => {
    const { stepSize } = walkParams({ valence: 80, arousal: 90 });
    assert.equal(stepSize, 4);
  });

  test('极低 arousal 且难过 → 步速下限 1', () => {
    const { stepSize } = walkParams({ valence: 20, arousal: 20 });
    assert.equal(stepSize, 1);
  });
});
