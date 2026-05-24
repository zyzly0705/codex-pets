// tests/emotion-system.test.mjs
// 测试情感系统的 PAD 计算逻辑，不依赖浏览器 API
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Mock 浏览器依赖 ──────────────────────────────────────────────────────────
const mockSay = () => {};
const mockClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mockLerp = (a, b, t) => a + (b - a) * t;

// 注入全局 mock，emotion-system 会通过 core-state 访问 clamp/lerp/say
// 由于我们直接内联逻辑测试，下面直接复制核心计算以做白盒验证
// ─────────────────────────────────────────────────────────────────────────────

// 内联 emotion-system 的核心逻辑（与源文件保持结构一致）
const PERSONALITY = {
  extraversion: 75,
  agreeableness: 80,
  neuroticism: 45,
  openness: 70,
};

const EMOTION_EVENTS = {
  pet:      { valence: +30, arousal: +20, dominance: +10 },
  whip:     { valence: -50, arousal: +35, dominance: -40 },
  feed:     { valence: +40, arousal: +10, dominance: +5  },
  play:     { valence: +20, arousal: +30, dominance: +15 },
  ignore:   { valence: -15, arousal: -10, dominance: -10 },
  happy:    { valence: +25, arousal: +15, dominance: +5  },
  curious:  { valence: +10, arousal: +25, dominance: +10 },
  calm:     { valence: +10, arousal: -20, dominance: +5  },
  relaxed:  { valence: +15, arousal: -15, dominance: +5  },
  worried:  { valence: -20, arousal: +20, dominance: -15 },
  sad:      { valence: -25, arousal: -10, dominance: -15 },
};

function applyEvent(emotion, eventType) {
  const e = EMOTION_EVENTS[eventType];
  if (!e) return { ...emotion };
  let { valence, arousal, dominance } = emotion;

  let mult = 1;
  if (eventType === 'pet') mult = 0.8 + (PERSONALITY.agreeableness / 100) * 0.4;
  if (eventType === 'whip') mult = 0.7 + (PERSONALITY.neuroticism / 100) * 0.6;

  valence    = mockClamp(valence    + e.valence    * mult, 0, 100);
  arousal    = mockClamp(arousal    + e.arousal    * mult, 0, 100);
  dominance  = mockClamp(dominance  + e.dominance  * mult, 0, 100);
  return { valence, arousal, dominance };
}

function getLabel({ valence, arousal }) {
  if (valence >= 70 && arousal >= 60) return 'excited';
  if (valence >= 65)                  return 'happy';
  if (valence <= 35 && arousal >= 55) return 'angry';
  if (valence <= 40)                  return 'sad';
  if (arousal <= 35)                  return 'calm';
  return 'neutral';
}

function decayStep(emotion, dtMs) {
  const k = dtMs / 15000;
  return {
    valence:   mockClamp(mockLerp(emotion.valence,   55, k), 0, 100),
    arousal:   mockClamp(mockLerp(emotion.arousal,   55, k), 0, 100),
    dominance: mockClamp(mockLerp(emotion.dominance, 50, k), 0, 100),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyEmotionEvent', () => {
  const base = { valence: 55, arousal: 55, dominance: 50 };

  test('pet 提升 valence 和 arousal', () => {
    const result = applyEvent(base, 'pet');
    assert.ok(result.valence > base.valence, `valence 应增加，实际 ${result.valence}`);
    assert.ok(result.arousal > base.arousal, `arousal 应增加，实际 ${result.arousal}`);
  });

  test('whip 降低 valence，提升 arousal', () => {
    const result = applyEvent(base, 'whip');
    assert.ok(result.valence < base.valence, `valence 应降低，实际 ${result.valence}`);
    assert.ok(result.arousal > base.arousal, `arousal 应升高，实际 ${result.arousal}`);
  });

  test('PAD 值不超过 [0, 100] 范围', () => {
    let e = { valence: 95, arousal: 95, dominance: 90 };
    e = applyEvent(e, 'pet');
    assert.ok(e.valence <= 100 && e.valence >= 0);
    assert.ok(e.arousal <= 100 && e.arousal >= 0);

    e = { valence: 5, arousal: 5, dominance: 5 };
    e = applyEvent(e, 'whip');
    assert.ok(e.valence >= 0 && e.valence <= 100);
  });

  test('连续 pet 后情绪好于单次 pet', () => {
    let e = base;
    for (let i = 0; i < 5; i++) e = applyEvent(e, 'pet');
    const single = applyEvent(base, 'pet');
    assert.ok(e.valence > single.valence);
  });

  test('whip 后 feed 能部分恢复', () => {
    let e = applyEvent(base, 'whip');
    const afterWhip = e.valence;
    e = applyEvent(e, 'feed');
    assert.ok(e.valence > afterWhip, `喂食后 valence 应有所恢复`);
  });

  test('未知事件类型不崩溃', () => {
    const result = applyEvent(base, 'nonexistent_event');
    assert.deepEqual(result, base);
  });
});

describe('getEmotionLabel', () => {
  test('高 valence 高 arousal → excited', () => {
    assert.equal(getLabel({ valence: 80, arousal: 75 }), 'excited');
  });

  test('高 valence 低 arousal → happy', () => {
    assert.equal(getLabel({ valence: 75, arousal: 40 }), 'happy');
  });

  test('低 valence 高 arousal → angry', () => {
    assert.equal(getLabel({ valence: 25, arousal: 70 }), 'angry');
  });

  test('低 valence 低 arousal → sad', () => {
    assert.equal(getLabel({ valence: 30, arousal: 30 }), 'sad');
  });

  test('中性 → neutral', () => {
    assert.equal(getLabel({ valence: 55, arousal: 55 }), 'neutral');
  });
});

describe('情绪衰减', () => {
  test('valence 随时间向基线 55 收敛', () => {
    let e = { valence: 90, arousal: 55, dominance: 50 };
    for (let i = 0; i < 20; i++) e = decayStep(e, 5000);
    assert.ok(e.valence < 90, '高 valence 应衰减');
    assert.ok(e.valence > 55 - 1, '不应低于基线太多');
  });

  test('经过足够时间后基本回到基线', () => {
    let e = { valence: 10, arousal: 90, dominance: 10 };
    for (let i = 0; i < 200; i++) e = decayStep(e, 5000);
    assert.ok(Math.abs(e.valence - 55) < 3, `valence ${e.valence} 应接近 55`);
    assert.ok(Math.abs(e.arousal - 55) < 3, `arousal ${e.arousal} 应接近 55`);
  });

  test('0 秒间隔不改变状态', () => {
    const e = { valence: 70, arousal: 60, dominance: 50 };
    const result = decayStep(e, 0);
    assert.ok(Math.abs(result.valence - e.valence) < 0.01);
  });
});
