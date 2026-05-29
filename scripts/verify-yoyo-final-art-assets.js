const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');

const repoRoot = join(__dirname, '..');
const indexPath = join(repoRoot, 'assets-src/yoyo/final-art/final-art-index.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadCareActions() {
  const source = readFileSync(join(repoRoot, 'src/shared/yoyo-actions.js'), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
  vm.runInNewContext(source, sandbox, { filename: 'src/shared/yoyo-actions.js' });
  return sandbox.module.exports.CARE_ACTIONS;
}

async function imageStats(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alphaPixels = 0;
  let coloredPixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 10) alphaPixels += 1;
    if (data[index + 3] > 10 && (data[index] > 20 || data[index + 1] > 20 || data[index + 2] > 20)) {
      coloredPixels += 1;
    }
  }
  return { width: info.width, height: info.height, alphaPixels, coloredPixels };
}

async function verifyAction(action) {
  const runtimeDir = join(repoRoot, 'assets/yoyo/effects', action.effectId);
  const timelinePath = join(runtimeDir, 'timeline.json');
  const rigPath = join(runtimeDir, 'rig/yoyo.rig.json');
  const requiredFiles = [
    action.sourceArt,
    action.manifest,
    action.preview,
    action.runtimeCapture,
    `assets/yoyo/effects/${action.effectId}/timeline.json`,
    `assets/yoyo/effects/${action.effectId}/rig/yoyo.rig.json`,
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(repoRoot, file))) throw new Error(`${action.effectId}: missing ${file}`);
  }

  const manifest = readJson(join(repoRoot, action.manifest));
  const timeline = readJson(timelinePath);
  const rig = readJson(rigPath);
  if (manifest.id !== action.effectId) throw new Error(`${action.effectId}: manifest id mismatch`);
  if (timeline.id !== action.effectId) throw new Error(`${action.effectId}: timeline id mismatch`);
  if (timeline.effectType !== 'auto-rig-action') throw new Error(`${action.effectId}: timeline effectType mismatch`);
  if (rig.format !== 'codex-pet-auto-rig') throw new Error(`${action.effectId}: rig format mismatch`);
  if (!Array.isArray(rig.parts) || rig.parts.length < 1) throw new Error(`${action.effectId}: rig has no parts`);

  for (const part of rig.parts) {
    if (!existsSync(join(repoRoot, part.file))) throw new Error(`${action.effectId}: missing part ${part.file}`);
  }

  const preview = await imageStats(join(repoRoot, action.preview));
  const runtimeCapture = await imageStats(join(repoRoot, action.runtimeCapture));
  if (preview.alphaPixels < 1000 || preview.coloredPixels < 1000) throw new Error(`${action.effectId}: blank preview`);
  if (runtimeCapture.alphaPixels < 1000 || runtimeCapture.coloredPixels < 1000) {
    throw new Error(`${action.effectId}: blank runtime capture`);
  }

  return {
    actionId: action.actionId,
    effectId: action.effectId,
    partCount: rig.parts.length,
    preview,
    runtimeCapture,
  };
}

async function main() {
  if (!existsSync(indexPath)) throw new Error('missing final-art index');
  const index = readJson(indexPath);
  const careActions = loadCareActions();
  const careActionIds = Object.keys(careActions).sort();
  const indexedActionIds = index.actions.map((action) => action.actionId).sort();
  if (JSON.stringify(careActionIds) !== JSON.stringify(indexedActionIds)) {
    throw new Error(`care action coverage mismatch: expected ${careActionIds.join(',')} got ${indexedActionIds.join(',')}`);
  }

  if (!existsSync(join(repoRoot, index.contactSheet))) throw new Error(`missing contact sheet ${index.contactSheet}`);
  const actions = [];
  for (const action of index.actions) actions.push(await verifyAction(action));
  const report = {
    generatedAt: new Date().toISOString(),
    workflow: index.workflow,
    actionCount: actions.length,
    contactSheet: index.contactSheet,
    actions,
    pass: true,
  };
  const reportPath = join(repoRoot, 'assets/yoyo/qa/final-art/final-art-asset-report.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
