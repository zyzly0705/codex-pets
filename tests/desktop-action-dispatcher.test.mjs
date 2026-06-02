import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const { CARE_ACTIONS } = require('../src/shared/yoyo-actions.js');
const { buildDesktopAction } = require('../src/shared/desktop-action-dispatcher.js');

test('desktop action dispatcher maps every care action to a desktop state and effect', () => {
  for (const [actionId, action] of Object.entries(CARE_ACTIONS)) {
    const command = buildDesktopAction(actionId);

    assert.equal(command.id, actionId);
    assert.equal(command.stateName, action.stateName);
    assert.equal(command.finalEffectId, action.finalEffectId);
    assert.equal(typeof command.durationMs, 'number');
    assert.ok(command.durationMs >= 1400);
  }
});

test('desktop action dispatcher attaches useful props for object-like care actions', () => {
  assert.equal(buildDesktopAction('feed').propId, 'cookie');
  assert.equal(buildDesktopAction('bath').propId, 'bath');
  assert.equal(buildDesktopAction('pet').propId, 'heart');
  assert.equal(buildDesktopAction('play').propId, 'toyBox');
  assert.equal(buildDesktopAction('playSwitch').propId, 'switchAndToys');
  assert.equal(buildDesktopAction('sleep').propId, null);
});

test('desktop action executor pauses roaming and restores idle after timed actions', () => {
  const source = readFileSync(join(repoRoot, 'src/modules/desktop-toys.js'), 'utf8');

  assert.match(source, /pauseDesktopRoaming/);
  assert.match(source, /scheduleDesktopActionEnd/);
  assert.match(source, /setState\('idle'\)/);
});

test('desktop menu care actions use existing action assets instead of ad-hoc CSS particles', () => {
  const html = readFileSync(join(repoRoot, 'src/index.html'), 'utf8');
  const css = readFileSync(join(repoRoot, 'src/styles.css'), 'utf8');
  const interactionSource = readFileSync(join(repoRoot, 'src/modules/interaction.js'), 'utf8');
  const lifeSource = readFileSync(join(repoRoot, 'src/main/life.js'), 'utf8');

  assert.doesNotMatch(html + css, /desktop-action-effect/);
  assert.doesNotMatch(css, /desktopActionFloat|desktopActionHeart|desktopActionPop/);
  assert.match(interactionSource, /source: 'desktop-menu'/);
  assert.doesNotMatch(interactionSource, /source: 'desktop-menu',\s*suppressFinalEffect: true/s);
  assert.match(lifeSource, /propId: source === 'desktop-menu' \? null : undefined/);
  assert.match(lifeSource, /triggerCareEffect\(action\.finalEffectId, actionId\)/);
});
