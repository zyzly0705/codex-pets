import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const rigDir = join(repoRoot, 'assets-src/yoyo/rig/live2d-yoyo-v4');
const manifestPath = join(rigDir, 'manifest.json');
const bindingProfilePath = join(rigDir, 'live2d-binding-profile.json');
const cubismPlanPath = join(rigDir, 'cubism-setup-plan.json');
const cubismChecklistPath = join(rigDir, 'cubism-import-checklist.md');
const cubismParameterSheetPath = join(rigDir, 'cubism-parameter-sheet.json');
const cubismMotionSpecPath = join(rigDir, 'cubism-motion-spec.json');
const cubismExpressionVisibilityMapPath = join(rigDir, 'cubism-expression-visibility-map.json');
const cubismMotionTimelineDraftPath = join(rigDir, 'cubism-motion-timeline-draft.json');
const cubismAnimationPacketPath = join(rigDir, 'cubism-animation-packet.json');
const cubismEditorPasteSheetPath = join(rigDir, 'cubism-editor-paste-sheet.md');
const cubismPreviewRunnerPath = join(rigDir, 'cubism-preview-runner.html');
const rigV5Dir = join(repoRoot, 'assets-src/yoyo/rig/live2d-yoyo-v5');
const rigV5ManifestPath = join(rigV5Dir, 'manifest.json');

test('Yoyo rig workflow keeps identity-preserving PSD sources in repo', () => {
  assert.ok(existsSync(join(repoRoot, 'scripts/generate-yoyo-rig-psd.js')));
  assert.ok(existsSync(join(rigDir, 'yoyo-live2d-rig-v4.psd')));
  assert.ok(existsSync(join(rigDir, 'preview-rig-composite.png')));

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, 4);
  assert.equal(manifest.document.width, 1254);
  assert.equal(manifest.document.height, 1254);
  assert.deepEqual(manifest.groups, ['Head', 'Face', 'Body', 'Arms', 'Legs']);
  assert.deepEqual(
    manifest.layers.map((layer) => layer.name),
    [
      'hair_back',
      'bun',
      'hair_front',
      'bangs_center',
      'side_hair_left',
      'side_hair_right',
      'face_base',
      'eye_left_open',
      'eye_right_open',
      'eye_left_blink',
      'eye_right_blink',
      'eye_left_smile',
      'eye_right_smile',
      'brow_left',
      'brow_right',
      'blush_left',
      'blush_right',
      'mouth_open',
      'mouth_smile',
      'mouth_closed',
      'mouth_o',
      'mouth_small',
      'mouth_flat',
      'collar',
      'bow_left',
      'bow_center',
      'bow_right',
      'torso_top',
      'skirt',
      'button_left',
      'button_right',
      'arm_left',
      'hand_left',
      'arm_right',
      'hand_right',
      'leg_left',
      'shoe_left',
      'leg_right',
      'shoe_right',
    ],
  );
});

test('Yoyo V5 rig source is rebuilt from the user-approved short-limb character', () => {
  assert.ok(existsSync(join(repoRoot, 'scripts/generate-yoyo-rig-psd-v5.js')));
  assert.ok(existsSync(join(rigV5Dir, 'yoyo-live2d-rig-v5.psd')));
  assert.ok(existsSync(join(rigV5Dir, 'preview-rig-composite.png')));

  const manifest = JSON.parse(readFileSync(rigV5ManifestPath, 'utf8'));
  assert.equal(manifest.version, 5);
  assert.equal(manifest.source, 'assets-src/yoyo/reference/rig/yoyo-standing-clean2d-v3-alpha.png');
  assert.equal(manifest.document.width, 1448);
  assert.equal(manifest.document.height, 1086);
  assert.deepEqual(manifest.groups, ['Head', 'Face', 'Body', 'Arms', 'Legs']);
  assert.ok(manifest.notes.some((note) => /short childlike limbs/u.test(note)));
  assert.ok(manifest.layers.some((layer) => layer.name === 'eye_left_smile'));
  assert.ok(manifest.layers.some((layer) => layer.name === 'mouth_o'));
});

test('Yoyo V5 rig includes additive facial expression layers', () => {
  const manifest = JSON.parse(readFileSync(rigV5ManifestPath, 'utf8'));
  assert.ok(manifest.notes.some((note) => /keeps the natural face_base/u.test(note)));

  const faceBase = readFileSync(join(rigV5Dir, 'face-face_base.png'));
  const leftEye = readFileSync(join(rigV5Dir, 'face-eye_left_open.png'));
  const mouth = readFileSync(join(rigV5Dir, 'face-mouth_o.png'));

  assert.notDeepEqual(faceBase, leftEye, 'face base must not be a copied eye layer');
  assert.notDeepEqual(faceBase, mouth, 'face base must not be a copied mouth layer');
});

test('Yoyo V5 rig layer masks keep face assets non-rectangular', async () => {
  const sharp = (await import('sharp')).default;
  const faceBase = sharp(join(rigV5Dir, 'face-face_base.png')).ensureAlpha();
  const leftEye = sharp(join(rigV5Dir, 'face-eye_left_open.png')).ensureAlpha();

  const faceStats = await faceBase.stats();
  const eyeStats = await leftEye.stats();

  assert.equal(faceStats.channels[3].min, 0, 'face base should keep transparent mask pixels');
  assert.equal(eyeStats.channels[3].min, 0, 'eye layer should keep transparent mask pixels');
  assert.ok(faceStats.channels[3].max > 240);
  assert.ok(eyeStats.channels[3].max > 240);
});

test('Yoyo rig PSD can be read back for structure-only validation', async () => {
  const { readPsd } = await import('ag-psd');
  const psdPath = join(rigDir, 'yoyo-live2d-rig-v4.psd');
  const psd = readPsd(readFileSync(psdPath), {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });

  assert.deepEqual(
    (psd.children ?? []).map((group) => group.name),
    ['Head', 'Face', 'Body', 'Arms', 'Legs'],
  );
  assert.deepEqual(
    (psd.children?.find((group) => group.name === 'Face')?.children ?? []).map((layer) => layer.name),
    [
      'face_base',
      'eye_left_open',
      'eye_right_open',
      'eye_left_blink',
      'eye_right_blink',
      'eye_left_smile',
      'eye_right_smile',
      'brow_left',
      'brow_right',
      'blush_left',
      'blush_right',
      'mouth_open',
      'mouth_smile',
      'mouth_closed',
      'mouth_o',
      'mouth_small',
      'mouth_flat',
    ],
  );
});

test('Yoyo rig pack includes a Live2D binding profile with facial params and expressions', () => {
  assert.ok(existsSync(bindingProfilePath));
  const profile = JSON.parse(readFileSync(bindingProfilePath, 'utf8'));

  assert.equal(profile.version, 1);
  assert.equal(profile.rigPackVersion, 4);
  assert.deepEqual(
    profile.parameters.map((parameter) => parameter.id),
    [
      'ParamEyeLOpen',
      'ParamEyeROpen',
      'ParamEyeLSmile',
      'ParamEyeRSmile',
      'ParamMouthOpenY',
      'ParamMouthForm',
    ],
  );
  assert.deepEqual(
    profile.expressions.map((expression) => expression.id),
    ['neutral', 'blink', 'happy', 'talk_small', 'talk_round', 'talk_flat'],
  );
  assert.deepEqual(profile.defaults, {
    ParamEyeLOpen: 1,
    ParamEyeROpen: 1,
    ParamEyeLSmile: 0,
    ParamEyeRSmile: 0,
    ParamMouthOpenY: 0.35,
    ParamMouthForm: 0.65,
  });
});

test('Yoyo rig pack includes a Cubism setup plan with phase order and target layers', () => {
  assert.ok(existsSync(cubismPlanPath));
  const plan = JSON.parse(readFileSync(cubismPlanPath, 'utf8'));

  assert.equal(plan.version, 1);
  assert.equal(plan.rigPackVersion, 4);
  assert.deepEqual(
    plan.phases.map((phase) => phase.id),
    ['import', 'face', 'body', 'motion'],
  );
  assert.deepEqual(plan.expressionPresetOrder, ['neutral', 'blink', 'happy', 'talk_small', 'talk_round', 'talk_flat']);
  assert.deepEqual(plan.motionStarterSet, ['idle', 'blink', 'happy_idle', 'talk_loop']);
  assert.deepEqual(
    plan.deformerStack.head,
    ['HeadAngleXY', 'HeadTurnZ', 'HairSway', 'FaceParts'],
  );
});

test('Yoyo rig pack includes a Cubism import checklist and parameter sheet', () => {
  assert.ok(existsSync(cubismChecklistPath));
  assert.ok(existsSync(cubismParameterSheetPath));

  const checklist = readFileSync(cubismChecklistPath, 'utf8');
  assert.match(checklist, /# Yoyo Cubism Import Checklist/);
  assert.match(checklist, /1\. Import PSD and preserve draw order\./);
  assert.match(checklist, /6\. Build starter motions: idle, blink, happy_idle, talk_loop\./);

  const parameterSheet = JSON.parse(readFileSync(cubismParameterSheetPath, 'utf8'));
  assert.equal(parameterSheet.version, 1);
  assert.equal(parameterSheet.rigPackVersion, 4);
  assert.deepEqual(
    parameterSheet.parameters.map((parameter) => parameter.id),
    [
      'ParamEyeLOpen',
      'ParamEyeROpen',
      'ParamEyeLSmile',
      'ParamEyeRSmile',
      'ParamMouthOpenY',
      'ParamMouthForm',
    ],
  );
  assert.deepEqual(
    parameterSheet.parameters.find((parameter) => parameter.id === 'ParamMouthOpenY')?.recommendedLayers,
    ['mouth_closed', 'mouth_flat', 'mouth_small', 'mouth_smile', 'mouth_open', 'mouth_o'],
  );
});

test('Yoyo rig pack includes a Cubism motion spec for the starter animation set', () => {
  assert.ok(existsSync(cubismMotionSpecPath));
  const motionSpec = JSON.parse(readFileSync(cubismMotionSpecPath, 'utf8'));

  assert.equal(motionSpec.version, 1);
  assert.equal(motionSpec.rigPackVersion, 4);
  assert.deepEqual(
    motionSpec.motions.map((motion) => motion.id),
    ['idle', 'blink', 'happy_idle', 'talk_loop'],
  );
  assert.deepEqual(
    motionSpec.motions.find((motion) => motion.id === 'idle')?.parameters.map((parameter) => parameter.id),
    ['ParamBodyAngleY', 'ParamHeadAngleZ', 'ParamHairSway', 'ParamMouthOpenY'],
  );
  assert.deepEqual(
    motionSpec.motions.find((motion) => motion.id === 'talk_loop')?.parameters.map((parameter) => parameter.id),
    ['ParamMouthOpenY', 'ParamMouthForm', 'ParamHeadAngleZ'],
  );
});

test('Yoyo rig pack includes an expression visibility map for starter states', () => {
  assert.ok(existsSync(cubismExpressionVisibilityMapPath));
  const visibilityMap = JSON.parse(readFileSync(cubismExpressionVisibilityMapPath, 'utf8'));

  assert.equal(visibilityMap.version, 1);
  assert.equal(visibilityMap.rigPackVersion, 4);
  assert.deepEqual(
    visibilityMap.states.map((state) => state.id),
    ['neutral', 'blink', 'happy', 'talk_small', 'talk_round', 'talk_flat'],
  );
  assert.deepEqual(
    visibilityMap.states.find((state) => state.id === 'neutral'),
    {
      id: 'neutral',
      visibleLayers: ['eye_left_open', 'eye_right_open', 'mouth_small'],
      hiddenLayers: ['eye_left_blink', 'eye_right_blink', 'eye_left_smile', 'eye_right_smile', 'mouth_closed', 'mouth_flat', 'mouth_open', 'mouth_smile', 'mouth_o'],
    },
  );
});

test('Yoyo rig pack includes a motion timeline draft for starter animations', () => {
  assert.ok(existsSync(cubismMotionTimelineDraftPath));
  const draft = JSON.parse(readFileSync(cubismMotionTimelineDraftPath, 'utf8'));

  assert.equal(draft.version, 1);
  assert.equal(draft.rigPackVersion, 4);
  assert.deepEqual(
    draft.timelines.map((timeline) => timeline.id),
    ['idle', 'blink', 'happy_idle', 'talk_loop'],
  );
  assert.deepEqual(
    draft.timelines.find((timeline) => timeline.id === 'blink')?.segments.map((segment) => segment.label),
    ['close', 'hold', 'open'],
  );
  assert.deepEqual(
    draft.timelines.find((timeline) => timeline.id === 'talk_loop')?.segments.map((segment) => segment.expression),
    ['talk_small', 'talk_round', 'talk_flat', 'talk_round'],
  );
});

test('Yoyo rig pack includes an animation packet with keyframe tables for the full starter set', () => {
  assert.ok(existsSync(cubismAnimationPacketPath));
  const packet = JSON.parse(readFileSync(cubismAnimationPacketPath, 'utf8'));

  assert.equal(packet.version, 1);
  assert.equal(packet.rigPackVersion, 4);
  assert.deepEqual(
    packet.animations.map((animation) => animation.id),
    ['idle', 'blink', 'happy_idle', 'talk_loop'],
  );
  assert.deepEqual(
    packet.animations.find((animation) => animation.id === 'idle')?.keyframes.map((row) => row.timeMs),
    [0, 800, 1600, 2400, 3200],
  );
  assert.deepEqual(
    packet.animations.find((animation) => animation.id === 'blink')?.keyframes.map((row) => row.timeMs),
    [0, 60, 90, 180],
  );
  assert.deepEqual(
    packet.animations.find((animation) => animation.id === 'happy_idle')?.keyframes.map((row) => row.expression),
    ['happy', 'happy', 'happy', 'happy', 'happy'],
  );
  assert.deepEqual(
    packet.animations.find((animation) => animation.id === 'talk_loop')?.keyframes.map((row) => row.expression),
    ['talk_small', 'talk_round', 'talk_flat', 'talk_round', 'talk_small'],
  );
});

test('Yoyo rig pack includes an editor paste sheet for the full starter set', () => {
  assert.ok(existsSync(cubismEditorPasteSheetPath));
  const sheet = readFileSync(cubismEditorPasteSheetPath, 'utf8');

  assert.match(sheet, /# Cubism Editor Paste Sheet/);
  assert.match(sheet, /## idle/);
  assert.match(sheet, /\| timeMs \| expression \| ParamBodyAngleY \| ParamHeadAngleZ \| ParamHairSway \| ParamMouthOpenY \|/);
  assert.match(sheet, /## blink/);
  assert.match(sheet, /\| timeMs \| expression \| ParamEyeLOpen \| ParamEyeROpen \|/);
  assert.match(sheet, /## happy_idle/);
  assert.match(sheet, /\| timeMs \| expression \| ParamEyeLSmile \| ParamEyeRSmile \| ParamMouthForm \| ParamBodyAngleY \|/);
  assert.match(sheet, /## talk_loop/);
  assert.match(sheet, /\| timeMs \| expression \| ParamMouthOpenY \| ParamMouthForm \| ParamHeadAngleZ \|/);
});

test('Yoyo rig pack includes a local preview runner for the full starter set', () => {
  assert.ok(existsSync(cubismPreviewRunnerPath));
  const html = readFileSync(cubismPreviewRunnerPath, 'utf8');

  assert.match(html, /<title>Yoyo Cubism Preview Runner<\/title>/);
  assert.match(html, /data-animation=\"idle\"/);
  assert.match(html, /data-animation=\"blink\"/);
  assert.match(html, /data-animation=\"happy_idle\"/);
  assert.match(html, /data-animation=\"talk_loop\"/);
  assert.match(html, /const documentSize = \{\"width\":1254,\"height\":1254\}/);
  assert.match(html, /const layerLayout = \{/);
  assert.match(html, /"face-eye_left_open\.png":\{"left":476,"top":398,"width":118,"height":102\}/);
  assert.match(html, /"face-mouth_o\.png":\{"left":584,"top":487,"width":110,"height":92\}/);
  assert.match(html, /face-eye_left_open\.png/);
  assert.match(html, /face-eye_left_smile\.png/);
  assert.match(html, /face-mouth_o\.png/);
});
