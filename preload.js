const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),

  // System
  getSysInfo: () => ipcRenderer.invoke('get-sys-info'),
  checkAdmin: () => ipcRenderer.invoke('check-admin'),

  // Config
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Search
  findLauncher: () => ipcRenderer.invoke('find-launcher'),

  // Manual dialogs
  selectManualLauncher: () => ipcRenderer.invoke('select-manual-launcher'),

  // Optimization & Launch
  optimizeRAM: () => ipcRenderer.invoke('optimize-ram'),
  launchGame: (launcherPath, disableSMT, highPriority) => ipcRenderer.invoke('launch-game', launcherPath, disableSMT, highPriority),

  // External
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Events
  onLaunchProgress: (callback) => ipcRenderer.on('launch-progress', (event, data) => callback(data)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});