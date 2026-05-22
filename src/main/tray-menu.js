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
    { label: '导入宠物...', click: () => { const win = getMainWindow(); if (win) win.webContents.send('menu-action', 'import'); } },
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

function registerMenuIpc({ ipcMain, getData, getMainWindow, listPets, openHome, openSettings, triggerCloneEffect, triggerGiantEffect }) {
  ipcMain.on('menu-state:sync', (_event, state) => {
    if (state.dancing !== undefined) menuState.dancing = state.dancing;
    if (state.following !== undefined) menuState.following = state.following;
    if (state.sleeping !== undefined) menuState.sleeping = state.sleeping;
  });

  ipcMain.handle('context-menu:show', (event) => {
    const petData = getData();
    const pets = listPets();
    const currentFormId = petData.currentFormId || petData.currentPetId || pets[0]?.id || 'yoyo';
    const petSubmenu = pets.filter((pet) => pet.id !== 'gugu-gaga').map((pet) => ({
      label: pet.displayName,
      click: () => { getMainWindow().webContents.send('menu-action', `switch-pet:${pet.id}`); }
    }));
    petSubmenu.push({ type: 'separator' });
    petSubmenu.push({ label: '导入新角色或形态...', click: () => { getMainWindow().webContents.send('menu-action', 'import'); } });

    const currentForm = pets.find((pet) => pet.id === currentFormId) || pets[0];
    const appearanceMenu = buildAppearanceMenu({ currentForm, getMainWindow });
    const workMode = petData.settings.workMode || 'balanced';
    const workModeMenu = {
      label: '工作节奏',
      submenu: [
        { label: `${workMode === 'focus' ? '✓ ' : ''}专注中`, click: () => { getMainWindow().webContents.send('menu-action', 'work-mode:focus'); } },
        { label: `${workMode === 'balanced' ? '✓ ' : ''}轻松工作`, click: () => { getMainWindow().webContents.send('menu-action', 'work-mode:balanced'); } },
        { label: `${workMode === 'overtime' ? '✓ ' : ''}加班中`, click: () => { getMainWindow().webContents.send('menu-action', 'work-mode:overtime'); } },
        { label: `${workMode === 'wrapup' ? '✓ ' : ''}准备收工`, click: () => { getMainWindow().webContents.send('menu-action', 'work-mode:wrapup'); } },
        { type: 'separator' },
        { label: '现在提醒我休息', click: () => { getMainWindow().webContents.send('menu-action', 'manual-break'); } },
        { label: '今天辛苦了', click: () => { getMainWindow().webContents.send('menu-action', 'end-of-day'); } },
      ]
    };

    const template = [
      {
        label: '陪我一下',
        submenu: [
          { label: '摸摸 Yoyo', click: () => { getMainWindow().webContents.send('action:pet'); } },
          { label: menuState.following ? '别跟着我啦' : '让她跟着我', type: 'checkbox', checked: menuState.following, click: (item) => { getMainWindow().webContents.send('action:follow', item.checked); } },
          { label: menuState.sleeping ? '叫醒 Yoyo' : '让她休息一下', type: 'checkbox', checked: menuState.sleeping, click: (item) => { getMainWindow().webContents.send('action:sleep', item.checked); } },
        ]
      },
      { type: 'separator' },
      workModeMenu,
      appearanceMenu,
      { type: 'separator' },
      {
        label: '小惊喜',
        submenu: [
          { label: '分身术', click: () => { triggerCloneEffect(); } },
          { label: '法天象地', click: () => { triggerGiantEffect(); } },
          { label: '给我打气', click: () => { getMainWindow().webContents.send('menu-action', 'cheer'); } },
          { label: menuState.dancing ? '停下跳舞' : '让她跳会舞', type: 'checkbox', checked: menuState.dancing, click: (item) => { getMainWindow().webContents.send('action:dance', item.checked); } },
          { label: '荡秋千', click: () => { getMainWindow().webContents.send('menu-action', 'swing'); } },
          { type: 'separator' },
          { label: '看会书', click: () => { getMainWindow().webContents.send('menu-action', 'read-book'); } },
          { label: '陪我打字', click: () => { getMainWindow().webContents.send('menu-action', 'typing-companion'); } },
          { label: '吹小风扇', click: () => { getMainWindow().webContents.send('menu-action', 'fan-cooling'); } },
          { label: '吹空调', click: () => { getMainWindow().webContents.send('menu-action', 'air-conditioning'); } },
          { label: '沙发躺一下', click: () => { getMainWindow().webContents.send('menu-action', 'sofa-lying'); } },
          { label: '游泳玩水', click: () => { getMainWindow().webContents.send('menu-action', 'swimming'); } },
        ]
      },
      {
        label: '管理 Yoyo',
        submenu: [
          { label: 'Yoyo 小屋', click: () => openHome() },
          { label: '设置与成长', click: () => openSettings() },
          { label: '切换形态', submenu: petSubmenu },
        ]
      },
      { type: 'separator' },
      {
        label: '其他',
        submenu: [
          { label: '鞭打 Yoyo', click: () => { getMainWindow().webContents.send('action:whip'); } },
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
