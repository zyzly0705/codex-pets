import { canvas, state } from './core-state.js';

const RIG_MANIFEST_URL = '../assets/yoyo/desktop-rig/v1/manifest.json';
const RUNNING_STATES = new Set(['runningRight', 'runningLeft']);
const PART_DEPTH = [
  'hair_back',
  'side_hair_left',
  'side_hair_right',
  'leg_left',
  'leg_right',
  'shoe_left',
  'shoe_right',
  'arm_left',
  'hand_left',
  'torso_top',
  'skirt',
  'collar',
  'bow_left',
  'bow_center',
  'bow_right',
  'button_left',
  'button_right',
  'face_base',
  'eye_left_open',
  'eye_right_open',
  'brow_left',
  'brow_right',
  'blush_left',
  'blush_right',
  'mouth_smile',
  'hair_front',
  'bangs_center',
  'bun',
  'arm_right',
  'hand_right',
];
const PART_PIVOTS = {
  leg_left: { x: 0.5, y: 0.12 },
  leg_right: { x: 0.5, y: 0.12 },
  shoe_left: { x: 0.5, y: 0.42 },
  shoe_right: { x: 0.5, y: 0.42 },
  arm_left: { x: 0.5, y: 0.14 },
  arm_right: { x: 0.5, y: 0.14 },
  hand_left: { x: 0.5, y: 0.18 },
  hand_right: { x: 0.5, y: 0.18 },
  hair_front: { x: 0.5, y: 0.54 },
  bun: { x: 0.5, y: 0.72 },
};

let rig = null;
let initPromise = null;
let frameHandle = 0;

function safeName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function layerOrder(layer) {
  const index = PART_DEPTH.indexOf(layer.name);
  return index >= 0 ? index : 100;
}

function canRun() {
  return Boolean(window.PIXI && document.getElementById('desktop-rig-host'));
}

function setRigVisible(visible) {
  const host = document.getElementById('desktop-rig-host');
  const app = document.getElementById('app');
  if (host) host.classList.toggle('active', visible);
  if (app) app.dataset.pixiRunning = visible ? 'true' : 'false';
  if (canvas) canvas.style.opacity = visible ? '0' : '';
}

async function loadRuntimeManifest() {
  const response = await fetch(new URL(RIG_MANIFEST_URL, window.location.href));
  if (!response.ok) throw new Error(`desktop rig manifest failed: ${response.status}`);
  return response.json();
}

function createPart(layer, texture) {
  const pivot = PART_PIVOTS[layer.name] || { x: 0.5, y: 0.5 };
  const container = new PIXI.Container();
  container.x = layer.left + layer.width * pivot.x;
  container.y = layer.top + layer.height * pivot.y;
  container.baseX = container.x;
  container.baseY = container.y;
  container.partName = layer.name;

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(pivot.x, pivot.y);
  container.addChild(sprite);
  return container;
}

function applyPartMotion(parts, direction, elapsed) {
  const stride = Math.sin(elapsed * 13.2);
  const counter = Math.sin(elapsed * 13.2 + Math.PI);
  const bounce = Math.abs(stride);
  const directionTilt = direction > 0 ? 1 : -1;

  const root = rig.root;
  root.y = rig.rootBaseY - bounce * 9;
  root.rotation = directionTilt * (0.025 + bounce * 0.014);
  root.scale.x = rig.rootBaseScale * direction;
  root.scale.y = rig.rootBaseScale * (1 - bounce * 0.018);

  const pose = {
    leg_left: { r: directionTilt * (0.34 * stride - 0.08), x: directionTilt * stride * 10, y: Math.max(0, stride) * 11 },
    shoe_left: { r: directionTilt * (0.28 * stride), x: directionTilt * stride * 18, y: Math.max(0, stride) * 10 },
    leg_right: { r: directionTilt * (0.34 * counter - 0.08), x: directionTilt * counter * 10, y: Math.max(0, counter) * 11 },
    shoe_right: { r: directionTilt * (0.28 * counter), x: directionTilt * counter * 18, y: Math.max(0, counter) * 10 },
    arm_left: { r: directionTilt * (-0.22 * stride), x: directionTilt * -stride * 5, y: bounce * 2 },
    hand_left: { r: directionTilt * (-0.14 * stride), x: directionTilt * -stride * 7, y: bounce * 2 },
    arm_right: { r: directionTilt * (-0.22 * counter), x: directionTilt * -counter * 5, y: Math.abs(counter) * 2 },
    hand_right: { r: directionTilt * (-0.14 * counter), x: directionTilt * -counter * 7, y: Math.abs(counter) * 2 },
    hair_front: { r: directionTilt * 0.01 * stride, x: directionTilt * -bounce * 2, y: -bounce },
    bun: { r: directionTilt * 0.018 * stride, x: directionTilt * -bounce * 2.5, y: -bounce },
    face_base: { r: directionTilt * 0.006 * stride, x: directionTilt, y: -bounce },
  };

  for (const [name, part] of Object.entries(parts)) {
    const motion = pose[name];
    part.x = part.baseX + (motion?.x || 0);
    part.y = part.baseY + (motion?.y || 0);
    part.rotation = motion?.r || 0;
  }
}

async function initRig() {
  if (rig || !canRun()) return rig;

  const host = document.getElementById('desktop-rig-host');
  const manifest = await loadRuntimeManifest();
  const app = new PIXI.Application();
  await app.init({
    width: 200,
    height: 260,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  host.appendChild(app.canvas);

  const root = new PIXI.Container();
  root.x = 100;
  root.y = 252;
  root.rootBaseY = root.y;
  root.rootBaseScale = 0.078;
  root.scale.set(root.rootBaseScale);
  root.pivot.set(manifest.document.width / 2, 1110);
  app.stage.addChild(root);

  const baseUrl = new URL('../assets/yoyo/desktop-rig/v1/', window.location.href);
  const layers = manifest.layers.slice().sort((a, b) => layerOrder(a) - layerOrder(b));
  const parts = {};
  for (const layer of layers) {
    const src = new URL(layer.file, baseUrl).href;
    const texture = await PIXI.Assets.load(src);
    const part = createPart(layer, texture);
    root.addChild(part);
    parts[safeName(layer.name)] = part;
  }

  rig = {
    app,
    root,
    parts,
    rootBaseY: root.y,
    rootBaseScale: root.rootBaseScale,
    startedAt: performance.now(),
    direction: 1,
  };
  return rig;
}

function frame() {
  frameHandle = requestAnimationFrame(frame);
  if (!rig) return;

  const running = RUNNING_STATES.has(state.stateName);
  setRigVisible(running);
  if (!running) return;

  rig.direction = state.stateName === 'runningLeft' ? -1 : 1;
  const elapsed = (performance.now() - rig.startedAt) / 1000;
  applyPartMotion(rig.parts, rig.direction, elapsed);
}

export function startDesktopPixiRunner() {
  if (initPromise || rig) return;
  if (!canRun()) return;
  initPromise = initRig()
    .then(() => {
      if (!frameHandle) frame();
    })
    .catch((error) => {
      console.warn('[desktop-pixi-runner] disabled', error);
      setRigVisible(false);
    });
}

export function stopDesktopPixiRunner() {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  setRigVisible(false);
}
