"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var mainWindow;
var width = 900;
var height = 600;
var createWindow = function () {
    mainWindow = new electron_1.BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            preload: __dirname + "/preload.js"
        },
        show: false,
    });
    mainWindow.setMenu(null);
    mainWindow.setFullScreenable(true);
    mainWindow.loadFile("./public/index.html");
    mainWindow.on("ready-to-show", function () { return mainWindow.show(); });
};
electron_1.ipcMain.handle('toggle-full-screen', function () {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
});
electron_1.app.on("ready", createWindow);
