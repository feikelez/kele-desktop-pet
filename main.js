const { app, BrowserWindow, Tray, Menu, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 96,
    height: 96,
    x: Math.floor(screenWidth / 2 - 48),
    y: Math.floor(screenHeight / 2 - 48),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    const spritePath = path.join(__dirname, 'assets', 'cat2.png').replace(/\\/g, '/');
    mainWindow.webContents.send('sprite-path', spritePath);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.webContents.send('screen-size', { width, height });
    const [x, y] = mainWindow.getPosition();
    mainWindow.webContents.send('pet-move-to', { x, y });
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'cat2.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示猫猫', click: () => { if (mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: '坐下', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'idle'); } },
    { label: '走路', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'walk'); } },
    { label: '跑步', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'run'); } },
    { label: '睡觉', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'sleep'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);

  tray.setToolTip('星露谷猫猫');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('move-window', (event, { x, y }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
});

ipcMain.on('get-screen-size', (event) => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  event.reply('screen-size', { width, height });
});

ipcMain.on('show-context-menu', (event, { x, y }) => {
  const contextMenu = Menu.buildFromTemplate([
    { label: '坐下', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'idle'); } },
    { label: '走路', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'walk'); } },
    { label: '跑步', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'run'); } },
    { label: '睡觉', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'sleep'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);
  contextMenu.popup({ x, y });
});