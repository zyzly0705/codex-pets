const { app, dialog } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let activeSpritesheetPath = null;
let activePet = null;
let activeLook = null;

function userPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
}

function bundledPetsDir() {
  return path.join(__dirname, '..', '..', 'assets');
}

function copyDirectoryContents(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(source, dest);
      continue;
    }
    if (!fs.existsSync(source)) continue;
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(source, dest);
      continue;
    }
    if (fileHash(source) !== fileHash(dest)) {
      fs.copyFileSync(source, dest);
    }
  }
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function ensureBundledPets() {
  const assetsDir = bundledPetsDir();
  fs.mkdirSync(userPetsDir(), { recursive: true });
  if (!fs.existsSync(assetsDir)) return;
  for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceDir = path.join(assetsDir, entry.name);
    if (!fs.existsSync(path.join(sourceDir, 'pet.json'))) continue;
    copyDirectoryContents(sourceDir, path.join(userPetsDir(), entry.name));
  }
}

function resolvePetFile(dir, filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.join(dir, filePath);
}

function normalizeSheets(dir, manifest, spritesheetFile) {
  const baseSheet = manifest.sheets?.base || manifest.sheets?.default || spritesheetFile;
  const sheets = {
    base: resolvePetFile(dir, typeof baseSheet === 'string' ? baseSheet : baseSheet.path || spritesheetFile),
  };
  for (const [name, value] of Object.entries(manifest.sheets || {})) {
    const file = typeof value === 'string' ? value : value?.path;
    if (!file) continue;
    sheets[name] = resolvePetFile(dir, file);
  }
  return sheets;
}

function normalizeLooks(dir, manifest, spritesheetFile) {
  const looks = {
    default: {
      id: 'default',
      name: '默认',
      spritesheetPath: resolvePetFile(dir, spritesheetFile),
    },
  };
  for (const [id, look] of Object.entries(manifest.looks || {})) {
    const file = typeof look === 'string' ? look : look?.spritesheetPath || look?.sheetPath || look?.path;
    looks[id] = {
      ...(typeof look === 'object' ? look : {}),
      id,
      name: typeof look === 'object' ? (look.name || id) : id,
      spritesheetPath: resolvePetFile(dir, file || spritesheetFile),
    };
  }
  return looks;
}

function readPet(dir) {
  const manifestPath = path.join(dir, 'pet.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const asset = manifest.asset || {};
  const spritesheetFile = manifest.spritesheetPath || asset.spritesheetPath || 'spritesheet.webp';
  const spritesheetPath = resolvePetFile(dir, spritesheetFile);
  return {
    id: manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.name || path.basename(dir),
    description: manifest.description || '',
    spritesheetPath,
    manifestPath,
    asset: {
      ...asset,
      spritesheetPath: spritesheetFile,
    },
    sheets: normalizeSheets(dir, manifest, spritesheetFile),
    looks: normalizeLooks(dir, manifest, spritesheetFile),
    defaultLook: manifest.defaultLook || 'default',
    states: manifest.states || undefined,
    render: manifest.render || undefined,
    capabilities: manifest.capabilities || undefined,
  };
}

function isRunnablePetDir(dir) {
  if (!fs.existsSync(path.join(dir, 'pet.json'))) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pet.json'), 'utf8'));
    const asset = manifest.asset || {};
    const spritesheetFile = manifest.spritesheetPath || asset.spritesheetPath || 'spritesheet.webp';
    return fs.existsSync(resolvePetFile(dir, spritesheetFile));
  } catch {
    return false;
  }
}

function listPets() {
  ensureBundledPets();
  return fs.readdirSync(userPetsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(userPetsDir(), entry.name))
    .filter(isRunnablePetDir)
    .map(readPet);
}

function defaultSpritesheetPath() {
  return path.join(userPetsDir(), 'yoyo', 'spritesheet.webp');
}

function setActiveSpritesheet(nextPath) {
  activeSpritesheetPath = nextPath;
}

function setActivePetSnapshot(pet, look) {
  activePet = pet || null;
  activeLook = look || null;
  const nextPath = look?.spritesheetPath || pet?.spritesheetPath;
  if (nextPath) activeSpritesheetPath = nextPath;
}

function getActiveSpritesheetPath() {
  return activeSpritesheetPath || defaultSpritesheetPath();
}

function toFileUrl(filePath) {
  return 'file://' + filePath.replaceAll('\\', '/');
}

function getActiveEffectLayers() {
  return [];
}

function registerPetsIpc({ ipcMain, getMainWindow }) {
  ipcMain.handle('pets:list', () => listPets());
  ipcMain.handle('pet:setActiveVisual', (_, payload = {}) => {
    setActivePetSnapshot(payload.pet, payload.look);
  });
  ipcMain.handle('pet:import', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Import Codex Pet',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false };
    }
    const sourceDir = result.filePaths[0];
    const sourceManifest = path.join(sourceDir, 'pet.json');
    if (!fs.existsSync(sourceManifest)) {
      return { ok: false, error: 'Selected folder must contain pet.json.' };
    }
    const pet = readPet(sourceDir);
    if (!fs.existsSync(pet.spritesheetPath)) {
      return { ok: false, error: 'Selected pet spritesheet was not found.' };
    }
    const targetDir = path.join(userPetsDir(), pet.id);
    copyDirectoryContents(sourceDir, targetDir);
    return { ok: true, pet: readPet(targetDir), pets: listPets() };
  });
}

module.exports = {
  ensureBundledPets,
  getActiveEffectLayers,
  getActiveSpritesheetPath,
  listPets,
  readPet,
  registerPetsIpc,
  setActivePetSnapshot,
  setActiveSpritesheet,
  toFileUrl,
  userPetsDir,
};
