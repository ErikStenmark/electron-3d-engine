import { ipcRenderer, contextBridge } from 'electron';

const api = () => ({
  toggleFullScreen: (): Promise<void> => ipcRenderer.invoke('toggle-full-screen'),
  isFullScreen: (): Promise<Boolean> => ipcRenderer.invoke('get-is-full-screen'),
  readFile: (fileName: string): Promise<string> => ipcRenderer.invoke('read-file', fileName)
})

contextBridge.exposeInMainWorld('electron', api());

export type Electron = ReturnType<typeof api>;