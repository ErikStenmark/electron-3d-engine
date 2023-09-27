import { ipcRenderer, contextBridge } from 'electron';

const api = () => ({
  toggleFullScreen: (): Promise<void> => ipcRenderer.invoke('toggle-full-screen'),
  isFullScreen: (): Promise<Boolean> => ipcRenderer.invoke('get-is-full-screen'),
  readFile: (fileName: string): Promise<string> => ipcRenderer.invoke('read-file', fileName),
  readFileBase64: (fileName: string): Promise<string> => ipcRenderer.invoke('read-base64', fileName),
  close: (): Promise<void> => ipcRenderer.invoke('close')
})

contextBridge.exposeInMainWorld('electron', api());

export type Electron = ReturnType<typeof api>;