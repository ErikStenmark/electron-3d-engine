import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  toggleFullScreen: (): Promise<void> => ipcRenderer.invoke('toggle-full-screen'),
  isFullScreen: (): Promise<Boolean> => ipcRenderer.invoke('get-is-full-screen'),
  getObj: (fileName: string): Promise<string> => ipcRenderer.invoke('read-obj', fileName)
});