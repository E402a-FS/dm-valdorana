// Ponte sicuro tra la pagina del simulatore e il sistema (file e finestre)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dmApp', {
  version: () => ipcRenderer.invoke('version'),
  autosave: json => ipcRenderer.invoke('autosave', json),
  quicksave: json => ipcRenderer.invoke('quicksave', json),
  latest: () => ipcRenderer.invoke('latest'),
  openGame: () => ipcRenderer.invoke('open-game'),
  exportGame: (json, name) => ipcRenderer.invoke('export-game', json, name),
  getLayout: () => ipcRenderer.invoke('layout-get'),
  setLayout: list => ipcRenderer.invoke('layout-set', list),
});
