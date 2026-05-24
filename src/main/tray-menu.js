const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');

let tray = null;
const menuState = { dancing: false, following: false, sleeping: false };

function createTrayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * size + x) * 4;
      if (dist <= r) {
        if (process.platform === 'darwin') {
          canvas[idx] = 0;
          canvas[idx + 1] = 0;
          canvas[idx + 2] = 0;
          canvas[idx + 3] = dist <= r - 1 ? 200 : 120;
        } else {
          canvas[idx] = 255;
          canvas[idx + 1] = 105;
          canvas[idx + 2] = 180;
          canvas[idx + 3] = dist <= r - 1 ? 255 : 180;
        }
      } else {
        canvas[idx + 3] = 0;
      }
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

function createTray(getMainWindow, openHome) {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Yoyo 桌面宠物');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 Yoyo', click: () => { const win = getMainWindow(); if (win) win.show(); } },
    { label: '隐藏 Yoyo', click: () => { const win = getMainWindow(); if (win) win.hide(); } },
    { label: '打开 Yoyo 小屋', click: () => { if (openHome) openHome(); } },
    { type: 'separator' },
    { label: '导入新形态...', click: () => { const win = getMainWindow(); if (win) win.webContents.send('menu-action', 'import'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });
}

function buildAppearanceMenu({ currentForm, getMainWindow }) {
  const currentCapabilities = currentForm?.capabilities || {};
  const lookMap = currentForm?.looks || {};
  const lookEntries = Object.values(lookMap).filter((look) => look.id !== 'default');
  const outfitSupported = currentCapabilities.outfit !== false && currentForm?.id !== 'gugu-gaga';

  if (!outfitSupported) {
    return {
      label: 'Yoyo 形态',
      submenu: [
        { label: '这个形态暂时没有专属外观', enabled: false },
      ]
    };
  }

  const presetItems = lookEntries.length
    ? lookEntries.map((look) => ({
        label: look.name || look.id,
        click: () => { getMainWindow().webContents.send('outfit:preset', look.id); },
      }))
    : [
        { label: '暂无额外完整套装', enabled: false },
      ];

  return {
    label: 'Yoyo 形态',
    submenu: [
      { label: '随机形态', enabled: lookEntries.length > 0, click: () => { getMainWindow().webContents.send('outfit:random'); } },
      ...presetItems,
      { type: 'separator' },
      { label: '恢复默认', click: () => { getMainWindow().webContents.send('outfit:reset'); } },
    ]
  };
}

function registerMenuIpc({ ipcMain, getData, getMainWindow, listPets, openHome, openSettings }) {
  ipcMain.on('menu-state:sync', (_event, state) => {
    if (state.dancing !== undefined) menuState.dancing = state.dancing;
    if (state.following !== undefined) menuState.following = state.following;
    if (state.sleeping !== undefined) menuState.sleeping = state.sleeping;
  });

  ipcMain.handle('context-menu:show', (event) => {
    const petData = getData();
    const pets = listPets();
    const currentFormId = petData.currentFormId || petData.currentPetId || pets[0]?.id || 'yoyo';
    const currentForm = pets.find((pet) => pet.id === currentFormId) || pets[0];
    const appearanceMenu = buildAppearanceMenu({ currentForm, getMainWindow });
    const careMenu = {
      label: '照顾一下',
      submenu: [
        { label: '喂饭', click: () => { getMainWindow().webContents.send('menu-action', 'care:feed'); } },
        { label: '洗澡', click: () => { getMainWindow().webContents.send('menu-action', 'care:bath'); } },
        { label: menuState.sleeping ? '叫醒她' : '让她休息', type: 'checkbox', checked: menuState.sleeping, click: () => { getMainWindow().webContents.send('menu-action', 'care:sleep'); } },
        { label: '陪她玩一下', click: () => { getMainWindow().webContents.send('menu-action', 'care:play'); } },
        { label: '摸摸', click: () => { getMainWindow().webContents.send('menu-action', 'care:pet'); } },
      ]
    };
    const specialMenu = {
      label: '特殊演出',
      submenu: [
        { label: '分身术', click: () => { getMainWindow().webContents.send('menu-action', 'special:clone'); } },
        { label: '法相天地', click: () => { getMainWindow().webContents.send('menu-action', 'special:giant'); } },
      ]
    };

    const template = [
      { label: '看看 Yoyo', click: () => { getMainWindow().webContents.send('menu-action', 'inspect-yoyo'); } },
      careMenu,
      specialMenu,
      { label: '打开小屋', click: () => openHome() },
      { type: 'separator' },
      {
        label: '设置',
        submenu: [
          { label: '设置与成长', click: () => openSettings() },
          appearanceMenu,
          { label: '导入新形态...', click: () => { getMainWindow().webContents.send('menu-action', 'import'); } },
          { type: 'separator' },
          { label: '退出 Yoyo', click: () => { app.quit(); } },
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
  });
}

module.exports = {
  createTray,
  registerMenuIpc,
};
