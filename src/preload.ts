import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  toggleFullScreen: () => ipcRenderer.invoke('toggle-full-screen')
});