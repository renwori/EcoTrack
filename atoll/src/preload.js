'use strict';
// Мост между окном острова и главным процессом.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atoll', {
  getStore: () => ipcRenderer.invoke('store:get'),
  set: (key, value) => ipcRenderer.send('store:set', key, value),

  setInteractive: (on) => ipcRenderer.send('island:mouse', !!on),
  focus: () => ipcRenderer.send('island:focus'),
  blur: () => ipcRenderer.send('island:blur'),
  onToggle: (fn) => ipcRenderer.on('island:toggle', (_e, open) => fn(open)),

  ym: {
    open: () => ipcRenderer.send('ym:open'),
    load: () => ipcRenderer.send('ym:load'),
    cmd: (cmd, arg) => ipcRenderer.send('ym:cmd', cmd, arg),
    onState: (fn) => ipcRenderer.on('ym:state', (_e, s) => fn(s)),
    onError: (fn) => ipcRenderer.on('ym:error', (_e, msg) => fn(msg)),
  },

  pickFolder: () => ipcRenderer.invoke('files:pickFolder'),
  scanFolder: (folder) => ipcRenderer.invoke('files:scan', folder),

  notify: (title, body) => ipcRenderer.send('notify', title, body),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  setAutostart: (on) => ipcRenderer.send('autostart:set', !!on),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  quit: () => ipcRenderer.send('app:quit'),
});
