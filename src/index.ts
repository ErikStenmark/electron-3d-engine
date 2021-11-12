import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import electronReload from 'electron-reload';

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

app.on("ready", createWindow);