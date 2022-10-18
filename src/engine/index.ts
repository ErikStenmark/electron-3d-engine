import { app, BrowserWindow, ipcMain } from 'electron';
import electronReload from 'electron-reload';
import fs from 'fs';
import path from 'path';

app.disableHardwareAcceleration()
electronReload(__dirname, {});

let mainWindow: BrowserWindow;

const width = 900;
const height = 600;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: __dirname + "/preload.js"
    },
    show: false,
  });

  mainWindow.setFullScreenable(true);
  mainWindow.loadFile("./public/index.html");
  mainWindow.on("ready-to-show", () => mainWindow.show());
}

ipcMain.handle('toggle-full-screen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  mainWindow.setMenuBarVisibility(!mainWindow.isFullScreen());
});

ipcMain.handle('get-is-full-screen', () => {
  return mainWindow.isFullScreen();
});

ipcMain.handle('read-file', (e, fileName: string) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '..', '..', 'files', fileName);

    fs.readFile(filePath, "utf8", (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
});

app.on("ready", createWindow);