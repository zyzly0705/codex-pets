const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  listPets: () => ipcRenderer.invoke('pets:list'),
  importPet: () => ipcRenderer.invoke('pet:import'),
  getWeather: () => ipcRenderer.invoke('weather:get'),
  getDailyNews: (options) => ipcRenderer.invoke('news:get', options),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  moveBy: (delta) => ipcRenderer.invoke('window:move-by', delta),
  getMousePosition: () => ipcRenderer.invoke('mouse:getPosition'),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('window:set-ignore-mouse', ignore),
  setPosition: (pos) => ipcRenderer.invoke('pet:setPosition', pos),
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  scanWindows: () => ipcRenderer.invoke('windows:scan'),
  showContextMenu: () => ipcRenderer.invoke('context-menu:show'),
  triggerEffect: (type) => ipcRenderer.invoke('effect:fullscreen', type),
  triggerCloneEffect: () => ipcRenderer.invoke('effect:clone'),
  triggerGiantEffect: () => ipcRenderer.invoke('effect:giant'),
  setActiveSpritesheet: (p) => ipcRenderer.invoke('pet:setActiveSpritesheet', p),
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
  onManualEffect: (callback) => ipcRenderer.on('effect:manual', (_, data) => callback(data)),
  // 键盘活动监听
  onKeyboardActivity: (cb) => ipcRenderer.on('keyboard:activity', cb),
  // 前台应用变化监听（WPS工作陪伴）
  onActiveAppChanged: (callback) => ipcRenderer.on('active-app-changed', (_, data) => callback(data)),
  // 状态同步到主进程
  syncMenuState: (state) => ipcRenderer.send('menu-state:sync', state),
  // 设置相关
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_, data) => callback(data)),
  onSettingsReset: (callback) => ipcRenderer.on('settings-reset', () => callback()),
  // 换装系统
  onOutfitChange: (cb) => ipcRenderer.on('outfit:change', (e, category, itemId) => cb(category, itemId)),
  onOutfitRandom: (cb) => ipcRenderer.on('outfit:random', () => cb()),
  onOutfitReset: (cb) => ipcRenderer.on('outfit:reset', () => cb()),
  // ===== 统一 Store API =====
  storeLoad:  ()          => ipcRenderer.invoke('store:load'),
  storeSet:   (key, val)  => ipcRenderer.invoke('store:set', key, val),
  storeBatch: (updates)   => ipcRenderer.invoke('store:batch', updates),
  behaviorDebugEnabled: () => ipcRenderer.invoke('debug:behavior-enabled'),
  debugLog: (type, payload) => ipcRenderer.send('debug:log', type, payload),
  debugLogPath: () => ipcRenderer.invoke('debug:log-path'),
});
