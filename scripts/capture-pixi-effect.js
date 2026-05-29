const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || fallback : fallback;
}

const repoRoot = path.join(__dirname, '..');
const effectType = arg('--effect-type', 'cook-pot');
const effectId = arg('--effect-id', 'cook-pot');
const out = path.resolve(repoRoot, arg('--out', `output/${effectId}-capture.png`));
const wait = Number(arg('--wait', '2600')) || 2600;
const width = Number(arg('--width', '900')) || 900;
const height = Number(arg('--height', '640')) || 640;

function readTimeline() {
  const timelinePath = path.join(repoRoot, 'assets', 'yoyo', 'effects', effectId, 'timeline.json');
  if (!fs.existsSync(timelinePath)) return null;
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
  const effectDir = path.dirname(timelinePath);
  if (timeline.spine) {
    timeline.spine = {
      ...timeline.spine,
      skeletonUrl: pathToFileURL(path.join(effectDir, timeline.spine.skeleton)).href,
      atlasUrl: pathToFileURL(path.join(effectDir, timeline.spine.atlas)).href,
    };
  }
  if (timeline.rig) {
    const rigPath = path.join(effectDir, timeline.rig);
    const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
    timeline.rigUrl = pathToFileURL(rigPath).href;
    timeline.rigData = {
      ...rig,
      parts: (rig.parts || []).map((part) => {
        const partPath = path.isAbsolute(part.file) ? part.file : path.join(repoRoot, part.file);
        return {
          ...part,
          url: pathToFileURL(partPath).href,
        };
      }),
    };
  }
  return timeline;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(repoRoot, 'src', 'pixi-effect-stage.html'));
  const spritePath = path.join(repoRoot, 'assets', 'yoyo', 'spritesheet.webp');
  const options = {
    effectType,
    spriteSrc: pathToFileURL(spritePath).href,
    timeline: readTimeline(),
    sourceCenter: { x: width * 0.5, y: height * 0.72 },
    arenaCenter: { x: width * 0.5, y: height * 0.74 },
    petSize: { w: 200, h: 260 },
  };
  await win.webContents.executeJavaScript(`startPixiEffect(${JSON.stringify(options)});`);
  await new Promise((resolve) => setTimeout(resolve, wait));
  const image = await win.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.toPNG());
  console.log(`Captured ${out}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  app.quit();
  process.exitCode = 1;
});
