import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyGravityStep,
  createEdgePatrolState,
  stepEdgePatrol,
} from '../src/shared/desktop-edge-patrol.mjs';

const workArea = { x: 0, y: 0, width: 800, height: 600 };
const pet = { x: 300, y: 200, width: 200, height: 260 };
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

describe('desktop edge patrol geometry', () => {
  test('gravity pulls a detached Yoyo down until she lands on the desktop floor', () => {
    let state = createEdgePatrolState(pet, workArea, { edge: 'bottom' });
    let bounds = { ...pet };

    const first = applyGravityStep(state, bounds, workArea, { gravity: 4, maxFallSpeed: 18 });
    assert.equal(first.mode, 'gravity');
    assert.equal(first.stateName, 'jumping');
    assert.deepEqual(first.delta, { x: 0, y: 4 });
    assert.deepEqual(first.target, { x: pet.x, y: pet.y + 4 });
    assert.equal(first.state.gravityVy, 4);

    bounds = { ...bounds, y: workArea.height - pet.height - 2 };
    state = { ...first.state, gravityVy: 18 };
    const landed = applyGravityStep(state, bounds, workArea, { gravity: 4, maxFallSpeed: 18 });
    assert.equal(landed.mode, 'patrol');
    assert.equal(landed.state.edge, 'bottom');
    assert.equal(landed.state.gravityVy, 0);
    assert.deepEqual(landed.delta, { x: 0, y: 2 });
    assert.deepEqual(landed.target, { x: bounds.x, y: workArea.height - pet.height });
  });

  test('edge patrol turns clockwise around all four desktop edges', () => {
    let state = createEdgePatrolState({ ...pet, x: 598, y: 340 }, workArea, { edge: 'bottom' });
    let result = stepEdgePatrol(state, { ...pet, x: 598, y: 340 }, workArea, { speed: 8 });
    assert.equal(result.state.edge, 'right');
    assert.deepEqual(result.delta, { x: 2, y: 0 });
    assert.deepEqual(result.target, { x: 600, y: 340 });
    assert.equal(result.stateName, 'runningRight');

    state = createEdgePatrolState({ ...pet, x: 600, y: 2 }, workArea, { edge: 'right' });
    result = stepEdgePatrol(state, { ...pet, x: 600, y: 2 }, workArea, { speed: 8 });
    assert.equal(result.state.edge, 'top');
    assert.deepEqual(result.delta, { x: 0, y: -2 });
    assert.equal(result.stateName, 'runningLeft');

    state = createEdgePatrolState({ ...pet, x: 2, y: 0 }, workArea, { edge: 'top' });
    result = stepEdgePatrol(state, { ...pet, x: 2, y: 0 }, workArea, { speed: 8 });
    assert.equal(result.state.edge, 'left');
    assert.deepEqual(result.delta, { x: -2, y: 0 });
    assert.equal(result.stateName, 'runningLeft');

    state = createEdgePatrolState({ ...pet, x: 0, y: 338 }, workArea, { edge: 'left' });
    result = stepEdgePatrol(state, { ...pet, x: 0, y: 338 }, workArea, { speed: 8 });
    assert.equal(result.state.edge, 'bottom');
    assert.deepEqual(result.delta, { x: 0, y: 2 });
    assert.equal(result.stateName, 'runningRight');
  });

  test('patrol keeps an internal target so host-window clamp jitter does not reverse progress', () => {
    let state = createEdgePatrolState({ ...pet, x: 19, y: 0 }, workArea, { edge: 'top' });
    let result = stepEdgePatrol(state, { ...pet, x: 19, y: 0 }, workArea, { speed: 8 });
    assert.deepEqual(result.target, { x: 11, y: 0 });
    assert.deepEqual(result.delta, { x: -8, y: 0 });

    state = result.state;
    result = stepEdgePatrol(state, { ...pet, x: 55, y: 0 }, workArea, { speed: 8 });
    assert.deepEqual(result.target, { x: 3, y: 0 });
    assert.deepEqual(result.delta, { x: -8, y: 0 });
    assert.equal(result.state.edge, 'top');

    state = result.state;
    result = stepEdgePatrol(state, { ...pet, x: 55, y: 0 }, workArea, { speed: 8 });
    assert.deepEqual(result.target, { x: 0, y: 0 });
    assert.equal(result.state.edge, 'left');
  });
});

test('desktop roaming uses edge patrol instead of bottom-only random walking', () => {
  const roaming = readFileSync(join(repoRoot, 'src/modules/desktop-roaming.js'), 'utf8');
  const main = readFileSync(join(repoRoot, 'src/main.js'), 'utf8');
  const renderer = readFileSync(join(repoRoot, 'src/renderer.js'), 'utf8');
  const css = readFileSync(join(repoRoot, 'src/styles.css'), 'utf8');
  const behavior = readFileSync(join(repoRoot, 'src/modules/behavior-engine.js'), 'utf8');
  const climbing = readFileSync(join(repoRoot, 'src/modules/climbing.js'), 'utf8');
  const system = readFileSync(join(repoRoot, 'src/main/system.js'), 'utf8');

  assert.match(roaming, /stepEdgePatrol/u);
  assert.match(roaming, /setPosition\(step\.target/u);
  assert.doesNotMatch(roaming, /startClimbing/u);
  assert.doesNotMatch(roaming, /preferWindow:\s*true/u);
  assert.doesNotMatch(roaming, /desktop_edge_patrol_climb_handoff/u);
  assert.match(roaming, /desktop_edge_patrol_screen_edge_only/u);
  assert.match(roaming, /debugLog/u);
  assert.match(roaming, /desktop_edge_patrol_step/u);
  assert.match(roaming, /desktop_edge_patrol_start/u);
  assert.match(roaming, /START_DELAY_MS\s*=\s*1000/u);
  assert.match(roaming, /EDGE_PATROL_SPEED\s*=\s*5/u);
  assert.match(roaming, /data-edge-patrol-edge/u);
  assert.match(climbing, /scanUnavailableReason/u);
  assert.match(system, /YOYO_REQUEST_MACOS_PERMISSIONS/u);
  assert.match(system, /macos_permission_prompt/u);
  assert.match(system, /desktopCapturer/u);
  assert.match(system, /macos_screen_capture_probe/u);
  assert.match(system, /macos_system_events_probe/u);
  assert.match(system, /systemEventsStatus/u);
  assert.match(system, /scanWindowsViaSystemEvents/u);
  assert.match(system, /windowScanSource/u);
  assert.match(system, /Privacy_ScreenCapture/u);
  assert.match(system, /screenRecordingStatus/u);
  assert.match(system, /windowScanUnavailableReason/u);
  const appWindows = readFileSync(join(repoRoot, 'src/main/app-windows.js'), 'utf8');
  assert.match(appWindows, /backgroundColor:\s*['"]#00000000['"]/u);
  assert.match(appWindows, /show:\s*false/u);
  assert.match(appWindows, /ready-to-show|did-finish-load/u);
  assert.match(appWindows, /showInactive\(\)|show\(\)/u);
  assert.match(css, /background:\s*transparent !important/u);
  assert.match(main, /DESKTOP_RUN_TEST_ENABLED/u);
  assert.match(main, /BEHAVIOR_DEBUG_ENABLED && !DESKTOP_RUN_TEST_ENABLED/u);
  assert.match(renderer, /if \(!desktopRunTestEnabled\) startBehaviorEngine\(\)/u);
  assert.match(renderer, /if \(!desktopRunTestEnabled\) refreshWeatherContext\(\)/u);
  assert.match(renderer, /if \(!desktopRunTestEnabled\) initTimers\(\)/u);
  assert.match(readFileSync(join(repoRoot, 'src/modules/behavior-debug-panel.js'), 'utf8'), /debugLogOnly/u);
  assert.match(readFileSync(join(repoRoot, 'src/modules/behavior-debug-panel.js'), 'utf8'), /desktopRunTestEnabled/u);
  assert.doesNotMatch(roaming, /Math\.random\(\)\s*>\s*0\.5\s*\?\s*1\s*:\s*-1/u);
  assert.match(css, /data-edge-patrol-edge="top"/u);
  assert.match(css, /data-edge-patrol-edge="left"/u);
  assert.doesNotMatch(css, /data-edge-patrol-edge="top"[\s\S]*?#petCanvas[\s\S]*?rotate\(180deg\)/u);
  assert.doesNotMatch(css, /data-edge-patrol-edge="left"[\s\S]*?#petCanvas[\s\S]*?rotate\(90deg\)/u);
  assert.doesNotMatch(css, /data-edge-patrol-edge="right"[\s\S]*?#petCanvas[\s\S]*?rotate\(-90deg\)/u);
  assert.doesNotMatch(css, /data-edge-patrol-edge="top"[\s\S]*?desktop-rig-host[\s\S]*?rotate\(180deg\)/u);
  assert.doesNotMatch(climbing, /canvas\.style\.transform\s*=\s*['"][^'"]*rotate\(/u);
  assert.doesNotMatch(climbing, /setState\(['"]climbing['"]\)/u);
  assert.match(css, /width: 132px/u);
  assert.match(css, /image-rendering: auto/u);
  assert.match(css, /Q pet short speech bubble/u);
  assert.match(css, /\.bubble-avatar \{[\s\S]*display: none/u);
  assert.match(css, /left: calc\(50% \+ 34px\)/u);
  assert.match(css, /width: 20px/u);
  assert.match(css, /opacity: 0\.42/u);
  assert.match(css, /care-cue::after[\s\S]*display: none/u);
  const lifeDesktop = readFileSync(join(repoRoot, 'src/modules/life-desktop.js'), 'utf8');
  assert.match(lifeDesktop, /desktopRunTestEnabled/u);
  assert.match(lifeDesktop, /careCue\.dataset\.muted = 'true'/u);
  assert.match(css, /data-edge-patrol-edge="right"[\s\S]*right: 0/u);
  assert.match(css, /data-edge-patrol-edge="left"[\s\S]*left: 0/u);
  const desktopPixiRunner = readFileSync(join(repoRoot, 'src/modules/desktop-pixi-runner.js'), 'utf8');
  assert.match(desktopPixiRunner, /ACTIVE_RIG_STATES/u);
  assert.match(desktopPixiRunner, /'idle'/u);
  assert.match(desktopPixiRunner, /'waiting'/u);
  assert.match(desktopPixiRunner, /'waving'/u);
  assert.match(desktopPixiRunner, /function applyIdleMotion/u);
  assert.match(desktopPixiRunner, /rootBaseScale = 0\.078/u);
  assert.match(desktopPixiRunner, /desktop_rig_runtime_ready/u);
  assert.match(desktopPixiRunner, /desktop_rig_runtime_error/u);
  assert.match(desktopPixiRunner, /import \{ debugLog \}/u);
  const renderEngine = readFileSync(join(repoRoot, 'src/modules/render-engine.js'), 'utf8');
  assert.match(renderEngine, /drawPersonaGroundShadow/u);
  assert.match(renderEngine, /PERSONA_DRAW_SCALE_DEFAULT\s*=\s*0\.82/u);
  assert.match(renderEngine, /PERSONA_FOOT_BASELINE_Y\s*=\s*0\.965/u);
  assert.match(renderEngine, /PERSONA_HEAD_SPLIT_Y\s*=\s*0\.54/u);
  assert.match(renderEngine, /function getPersonaIdlePose/u);
  assert.match(renderEngine, /function drawPersonaSpriteWithLayerMotion/u);
  assert.match(renderEngine, /function drawPersonaIdleAccent/u);
  assert.match(renderEngine, /const blinkWindow/u);
  assert.match(renderEngine, /personaIdlePose/u);
  assert.doesNotMatch(renderEngine, /scale\s*=\s*breathScale;/u);
  assert.match(renderEngine, /climbPivotY\s*=\s*offsetY \+ drawH \* 0\.72/u);
  assert.match(renderEngine, /Math\.abs\(side\) \* 5/u);
  assert.match(renderEngine, /const step = Math\.sin\(\(now \/ 1000\) \* 24\)/u);
  assert.match(renderEngine, /lift \* 7\.2/u);
  assert.doesNotMatch(behavior, /window\.petApi\.moveBy\(\{\s*x:\s*direction\s*\*/u);
});
