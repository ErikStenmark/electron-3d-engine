import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  toggleFullScreen: (): Promise<void> => ipcRenderer.invoke('toggle-full-screen'),
  isFullScreen: (): Promise<Boolean> => ipcRenderer.invoke('get-is-full-screen')
});