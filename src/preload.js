const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  listPets: () => ipcRenderer.invoke('pets:list'),
  importPet: () => ipcRenderer.invoke('pet:import'),
  getWeather: (city) => ipcRenderer.invoke('weather:get', city),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  moveBy: (delta) => ipcRenderer.invoke('window:move-by', delta),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('window:set-ignore-mouse', ignore),
  onOpenImport: (callback) => ipcRenderer.on('open-import', callback)
});
