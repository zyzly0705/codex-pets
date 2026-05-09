const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_WIDTH = 360;
const APP_HEIGHT = 360;

let mainWindow;
let tray;

function userPetsDir() {
  return path.join(app.getPath('userData'), 'pets');
}

function bundledPetDir() {
  return path.join(__dirname, '..', 'assets', 'xiao-hong');
}

function ensureDefaultPet() {
  const target = path.join(userPetsDir(), 'xiao-hong');
  fs.mkdirSync(target, { recursive: true });
  for (const file of ['pet.json', 'spritesheet.webp']) {
    const source = path.join(bundledPetDir(), file);
    const dest = path.join(target, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(source, dest);
    }
  }
}

function readPet(dir) {
  const manifestPath = path.join(dir, 'pet.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const spritesheetPath = path.join(dir, manifest.spritesheetPath || 'spritesheet.webp');
  return {
    id: manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.name || path.basename(dir),
    description: manifest.description || '',
    spritesheetPath,
    manifestPath
  };
}

function listPets() {
  ensureDefaultPet();
  return fs.readdirSync(userPetsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(userPetsDir(), entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'pet.json')))
    .map(readPet);
}

function createWindow() {
  const primary = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    x: primary.x + primary.width - APP_WIDTH - 24,
    y: primary.y + primary.height - APP_HEIGHT - 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Show Pet', click: () => mainWindow?.show() },
    { label: 'Import Pet...', click: () => mainWindow?.webContents.send('open-import') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Codex Desktop Pet');
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  ensureDefaultPet();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

ipcMain.handle('pets:list', () => listPets());

ipcMain.handle('window:get-bounds', () => {
  const workArea = screen.getPrimaryDisplay().workArea;
  const bounds = mainWindow.getBounds();
  return { bounds, workArea };
});

ipcMain.handle('window:move-by', (_event, delta) => {
  const bounds = mainWindow.getBounds();
  const workArea = screen.getPrimaryDisplay().workArea;
  const nextX = Math.max(workArea.x, Math.min(workArea.x + workArea.width - bounds.width, bounds.x + delta.x));
  const nextY = Math.max(workArea.y, Math.min(workArea.y + workArea.height - bounds.height, bounds.y + delta.y));
  mainWindow.setBounds({ ...bounds, x: nextX, y: nextY }, false);
  return mainWindow.getBounds();
});

ipcMain.handle('window:set-ignore-mouse', (_event, ignore) => {
  mainWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

ipcMain.handle('pet:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceManifest, path.join(targetDir, 'pet.json'));
  fs.copyFileSync(pet.spritesheetPath, path.join(targetDir, path.basename(pet.spritesheetPath)));
  return { ok: true, pet: readPet(targetDir), pets: listPets() };
});

ipcMain.handle('weather:get', async (_event, city) => {
  const query = String(city || '').trim();
  if (!query) {
    return { ok: false, error: 'No city configured.' };
  }
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=zh&format=json`;
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) {
    throw new Error(`Geocoding failed: ${geoResponse.status}`);
  }
  const geo = await geoResponse.json();
  const place = geo.results?.[0];
  if (!place) {
    return { ok: false, error: 'City not found.' };
  }
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error(`Weather failed: ${weatherResponse.status}`);
  }
  const weather = await weatherResponse.json();
  return {
    ok: true,
    place: `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}`,
    current: weather.current
  };
});
