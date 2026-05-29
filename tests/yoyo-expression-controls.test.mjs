import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const controls = require('../src/shared/yoyo-expression-controls.js');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('expression control module mirrors the V3 rig contract', () => {
  const contract = readJson(join(repoRoot, 'assets-src/yoyo/v3/character-rig/rig-contract.json'));
  const expression = contract.expression;

  assert.deepEqual(controls.EXPRESSION_LAYERS, expression.layers);
  assert.deepEqual(Object.keys(controls.EXPRESSION_PRESETS), expression.presets.map((preset) => preset.id));
  assert.deepEqual(controls.TALK_CYCLE, expression.talkCycle);
  assert.equal(expression.runtime.controlModule, 'src/shared/yoyo-expression-controls.js');
});

test('maps care behavior to controllable expression presets', () => {
  assert.equal(controls.expressionForBehavior('pet'), 'happy');
  assert.equal(controls.expressionForBehavior('pet', { preferFallback: true }), 'shy');
  assert.equal(controls.expressionForBehavior('bath'), 'happy');
  assert.equal(controls.expressionForBehavior('sleep'), 'sleepy');
  assert.equal(controls.expressionForBehavior('whip'), 'sad');
  assert.equal(controls.expressionForBehavior('whip', { preferFallback: true }), 'angry');
});

test('cycles talk mouth presets deterministically', () => {
  assert.equal(controls.expressionForBehavior('talk', { talkFrame: 0 }), 'talk_small');
  assert.equal(controls.expressionForBehavior('talk', { talkFrame: 1 }), 'talk_round');
  assert.equal(controls.expressionForBehavior('talk', { talkFrame: 2 }), 'talk_flat');
  assert.equal(controls.expressionForBehavior('talk', { talkFrame: 3 }), 'talk_small');
});

test('keeps legacy runtime expressions compatible with V3 presets', () => {
  assert.equal(controls.normalizeExpressionPreset('sparkle'), 'surprised');
  assert.equal(controls.normalizeExpressionPreset('heart'), 'happy');
  assert.equal(controls.normalizeExpressionPreset('crying'), 'sad');
  assert.equal(controls.runtimeExpressionForPreset('sparkle'), 'sparkle');
  assert.equal(controls.runtimeExpressionForPreset('heart'), 'heart');
  assert.equal(controls.runtimeExpressionForPreset('talk_round'), 'talk_round');
});

test('bubble avatar CSS supports every non-neutral runtime expression', () => {
  const styles = readFileSync(join(repoRoot, 'src/styles.css'), 'utf8');
  const styledExpressions = new Set(
    [...styles.matchAll(/bubble-avatar\[data-expr="([^"]+)"\]/g)].map((match) => match[1])
  );

  for (const preset of ['happy', 'shy', 'sleepy', 'angry', 'sad', 'surprised', 'blink', 'talk_small', 'talk_round', 'talk_flat']) {
    const runtimeExpr = controls.runtimeExpressionForPreset(preset);
    assert.ok(styledExpressions.has(runtimeExpr), `missing CSS for ${runtimeExpr}`);
  }

  for (const legacy of ['sparkle', 'heart', 'dizzy']) {
    assert.ok(styledExpressions.has(controls.runtimeExpressionForPreset(legacy)), `missing CSS for ${legacy}`);
  }
});
