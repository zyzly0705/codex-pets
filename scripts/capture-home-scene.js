#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    action: '',
    out: path.join(repoRoot, 'output', 'home-scene-capture.png'),
    width: 1272,
    height: 720,
    wait: 1800,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };

    if (arg === '--action') args.action = next();
    else if (arg === '--out') args.out = path.resolve(next());
    else if (arg === '--width') args.width = Number(next());
    else if (arg === '--height') args.height = Number(next());
    else if (arg === '--wait') args.wait = Number(next());
    else throw new Error(`Unknown option: ${arg}`);
  }

  return args;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await app.whenReady();

  const win = new BrowserWindow({
    width: args.width,
    height: args.height,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(repoRoot, 'src', 'yoyo-home.html'), { query: { debug: '1' } });
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (window.YOYO_HOME_REBUILD?.phase) return resolve();
      window.addEventListener('yoyo-home-ready', resolve, { once: true });
      setTimeout(resolve, 3500);
    })
  `);
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const images = Array.from(document.images);
      const pending = images.filter((img) => !img.complete);
      if (!pending.length) return resolve();
      let left = pending.length;
      for (const img of pending) {
        img.addEventListener('load', () => { if (--left === 0) resolve(); }, { once: true });
        img.addEventListener('error', () => { if (--left === 0) resolve(); }, { once: true });
      }
      setTimeout(resolve, 2500);
    })
  `);

  if (args.action) {
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        if (typeof window.YOYO_HOME_REBUILD_RUNTIME?.startAction === 'function') return resolve();
        const startedAt = Date.now();
        const timer = setInterval(() => {
          if (typeof window.YOYO_HOME_REBUILD_RUNTIME?.startAction === 'function' || Date.now() - startedAt > 3500) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      })
    `);
    const started = await win.webContents.executeJavaScript(`
      window.YOYO_HOME_REBUILD_RUNTIME?.startAction?.(${JSON.stringify(args.action)}) === true
    `);
    if (!started) throw new Error(`Unknown Yoyo Home action: ${args.action}`);
    await delay(args.wait);
  } else {
    await delay(700);
  }

  const image = await win.webContents.capturePage();
  await fs.promises.mkdir(path.dirname(args.out), { recursive: true });
  await fs.promises.writeFile(args.out, image.toPNG());
  console.log(`Captured ${path.relative(repoRoot, args.out)}`);

  await win.close();
  await app.quit();
}

main().catch(async (error) => {
  console.error(error);
  await app.quit();
  process.exit(1);
});
