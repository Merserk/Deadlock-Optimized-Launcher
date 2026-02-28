const { app, BrowserWindow } = require('electron');
const path = require('path');

const { registerIpcHandlers } = require('./src/ipc');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 790,
        icon: path.join(__dirname, 'icon.png'),
        frame: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#0d0e15',
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
    app.setAppUserModelId('com.optimizer.deadlock');
    createWindow();

    registerIpcHandlers({
        app,
        getMainWindow: () => mainWindow
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});