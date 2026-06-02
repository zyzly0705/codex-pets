const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const { CARE_ACTIONS } = require('../shared/yoyo-actions');

let tray = null;
const menuState = { dancing: false, following: false, sleeping: false };

const WATCH_ACTIONS = [
  { label: '打开小屋', action: 'open-home' },
  { label: '摸摸', action: 'care:pet' },
  { label: '喂点东西', action: 'care:feed' },
  { label: '看看状态', action: 'inspect-yoyo' },
];

const CARE_MENU_ACTIONS = ['bath', 'sleep', 'play'];

const WORK_MODE_ACTIONS = [
  { label: '专注中', action: 'work-mode:focus' },
  { label: '轻松工作', action: 'work-mode:balanced' },
  { label: '加班中', action: 'work-mode:overtime' },
  { label: '准备收工', action: 'work-mode:wrapup' },
];

const GROWTH_REWARDS = [
  { id: 'dance', label: '跳舞', action: 'swing', requiredLevel: 1, requiredIntimacy: 0 },
  { id: 'cook', label: '入锅温泉', action: 'special:cook', requiredLevel: 2, requiredIntimacy: 0 },
  { id: 'watch-tv', label: '看电视', action: 'special:watch-tv', requiredLevel: 2, requiredIntimacy: 0 },
  { id: 'play-switch', label: '打游戏', action: 'special:play-switch', requiredLevel: 3, requiredIntimacy: 0 },
  { id: 'clone', label: '分身术', action: 'special:clone', requiredLevel: 4, requiredIntimacy: 0 },
  { id: 'giant', label: '法相天地', action: 'special:giant', requiredLevel: 5, requiredIntimacy: 80 },
];

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

function sendMenuAction(getMainWindow, action) {
  const win = getMainWindow();
  if (win) win.webContents.send('menu-action', action);
}

function sendGrowthRewardAction(getMainWindow, action) {
  const win = getMainWindow();
  if (!win) return;
  if (action === 'special:clone') {
    win.webContents.send('menu-action', 'special:clone');
    return;
  }
  if (action === 'special:giant') {
    win.webContents.send('menu-action', 'special:giant');
    return;
  }
  if (action === 'special:cook') {
    win.webContents.send('menu-action', 'special:cook');
    return;
  }
  if (action === 'special:watch-tv') {
    win.webContents.send('menu-action', 'special:watch-tv');
    return;
  }
  if (action === 'special:play-switch') {
    win.webContents.send('menu-action', 'special:play-switch');
    return;
  }
  sendMenuAction(getMainWindow, action);
}

function buildWatchMenu({ getMainWindow, openHome }) {
  return {
    label: '看看 Yoyo',
    submenu: WATCH_ACTIONS.map((item) => ({
      label: item.label,
      click: () => {
        if (item.action === 'open-home') {
          openHome();
          return;
        }
        sendMenuAction(getMainWindow, item.action);
      },
    })),
  };
}

function buildCareMenuItems(getMainWindow) {
  return Object.entries(CARE_ACTIONS)
    .filter(([id]) => CARE_MENU_ACTIONS.includes(id))
    .map(([id, action]) => ({
      label: id === 'sleep' && menuState.sleeping ? '叫醒她' : id === 'sleep' ? '哄睡' : action.label,
      type: id === 'sleep' ? 'checkbox' : 'normal',
      checked: id === 'sleep' ? menuState.sleeping : undefined,
      click: () => { sendMenuAction(getMainWindow, `care:${id}`); },
    }));
}

function buildWorkMenu(getMainWindow) {
  return {
    label: '工作陪伴',
    submenu: WORK_MODE_ACTIONS.map((item) => ({
      label: item.label,
      click: () => { sendMenuAction(getMainWindow, item.action); },
    })),
  };
}

function getGrowthProgress(petData = {}) {
  return {
    level: Number(petData.growth?.level || 1),
    intimacy: Number(petData.relationship?.intimacy || 0),
  };
}

function isGrowthRewardUnlocked(reward, progress) {
  return progress.level >= reward.requiredLevel && progress.intimacy >= reward.requiredIntimacy;
}

function growthRewardLockSuffix(reward, progress) {
  const locks = [];
  if (progress.level < reward.requiredLevel) locks.push(`Lv.${reward.requiredLevel}`);
  if (progress.intimacy < reward.requiredIntimacy) locks.push(`亲密 ${reward.requiredIntimacy}`);
  return locks.length ? `（${locks.join(' / ')} 解锁）` : '';
}

function buildGrowthRewardMenu({ petData, getMainWindow }) {
  const progress = getGrowthProgress(petData);
  return {
    label: '成长奖励',
    submenu: GROWTH_REWARDS.map((reward) => {
      const unlocked = isGrowthRewardUnlocked(reward, progress);
      return {
        label: `${reward.label}${unlocked ? '' : growthRewardLockSuffix(reward, progress)}`,
        enabled: unlocked,
        click: () => { sendGrowthRewardAction(getMainWindow, reward.action); },
      };
    }),
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
      submenu: buildCareMenuItems(getMainWindow)
    };
    const growthRewardMenu = buildGrowthRewardMenu({ petData, getMainWindow });

    const template = [
      buildWatchMenu({ getMainWindow, openHome }),
      careMenu,
      buildWorkMenu(getMainWindow),
      growthRewardMenu,
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
