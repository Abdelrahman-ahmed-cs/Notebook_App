'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('native', {
  openFiles: (opts) => ipcRenderer.invoke('dialog:open', opts),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveDialog: (opts) => ipcRenderer.invoke('dialog:save', opts),
  writeFile: (path, data, isNotebook = false) => ipcRenderer.invoke('file:write', { path, data, isNotebook }),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  appInfo: () => ipcRenderer.invoke('app:info'),
  confirmUnsaved: () => ipcRenderer.invoke('dialog:confirm-unsaved'),
  pendingOpen: () => ipcRenderer.invoke('app:pending-open'),
  print: () => ipcRenderer.invoke('app:print'),
  recentFiles: () => ipcRenderer.invoke('recent:list'),
  setTheme: (dark) => ipcRenderer.send('app:theme', dark),
  writeRecovery: (data, meta) => ipcRenderer.invoke('recovery:write', { data, meta }),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  toggleDevTools: () => ipcRenderer.send('app:devtools'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  closeConfirmed: () => ipcRenderer.send('app:close-confirmed'),
  setTitle: (t) => ipcRenderer.send('app:set-title', t),
  // Path of a file dropped from Explorer (File.path was removed from Chromium).
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  on: (channel, fn) => {
    const ok = ['open-path', 'app:request-close'];
    if (!ok.includes(channel)) return;
    ipcRenderer.on(channel, (_e, ...args) => fn(...args));
  },
});
