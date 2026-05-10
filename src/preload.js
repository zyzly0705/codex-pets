const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  listPets: () => ipcRenderer.invoke('pets:list'),
  importPet: () => ipcRenderer.invoke('pet:import'),
  getWeather: () => ipcRenderer.invoke('weather:get'),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  moveBy: (delta) => ipcRenderer.invoke('window:move-by', delta),
  getMousePosition: () => ipcRenderer.invoke('mouse:getPosition'),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('window:set-ignore-mouse', ignore),
  setPosition: (pos) => ipcRenderer.invoke('pet:setPosition', pos),
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  scanWindows: () => ipcRenderer.invoke('windows:scan'),
  showContextMenu: () => ipcRenderer.invoke('context-menu:show'),
  triggerEffect: (type) => ipcRenderer.invoke('effect:fullscreen', type),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (_e, action) => callback(action)),
  // 新增：右键菜单动作监听
  onAction: (callback) => ipcRenderer.on('action:pet', () => callback()),
  onWhip: (callback) => ipcRenderer.on('action:whip', () => callback()),
  onDance: (callback) => ipcRenderer.on('action:dance', (_e, checked) => callback(checked)),
  onFollow: (callback) => ipcRenderer.on('action:follow', (_e, checked) => callback(checked)),
  onSleep: (callback) => ipcRenderer.on('action:sleep', (_e, checked) => callback(checked)),
  // 系统恢复/解锁监听
  onSystemResume: (callback) => ipcRenderer.on('system:resume', () => callback()),
  // 繁忙提醒监听
  onBusyReminder: (callback) => ipcRenderer.on('system:busy-reminder', () => callback()),
  // 前台应用变化监听（WPS工作陪伴）
  onActiveAppChanged: (callback) => ipcRenderer.on('active-app-changed', (_, data) => callback(data)),
  // 状态同步到主进程
  syncMenuState: (state) => ipcRenderer.send('menu-state:sync', state),
  // 设置相关
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_, data) => callback(data)),
  onSettingsReset: (callback) => ipcRenderer.on('settings-reset', () => callback())
});
