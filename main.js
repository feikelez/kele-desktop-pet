const { app, BrowserWindow, Tray, Menu, MenuItem, screen, ipcMain } = require('electron');
const path = require('path');
const CHARACTERS = require('./src/characters');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentCharKey = 'cat2';

function getCharacterMenuItems() {
  return Object.keys(CHARACTERS).map(key => ({
    label: CHARACTERS[key].name,
    type: 'radio',
    checked: key === currentCharKey,
    click: () => { switchCharacter(key); },
  }));
}

function getCanvasSize(charKey) {
  const conf = CHARACTERS[charKey];
  return {
    width: conf.frameWidth * conf.scale,
    height: conf.frameHeight * conf.scale,
  };
}

function switchCharacter(charKey) {
  if (charKey === currentCharKey) return;
  currentCharKey = charKey;

  if (mainWindow && !mainWindow.isDestroyed()) {
    const { width, height } = getCanvasSize(charKey);
    mainWindow.setSize(width, height);
    mainWindow.webContents.send('switch-character', charKey);
  }

  updateTrayMenu();
}

function buildContextMenu() {
  const charConf = CHARACTERS[currentCharKey];
  const stateLabels = {};
  const stateNames = Object.keys(charConf.states).filter(s => s !== 'walk');

  const stateMenuItems = stateNames.map(stateName => ({
    label: getStateLabel(stateName, charConf.name),
    click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', stateName); },
  }));

  const toggleLabel = (mainWindow && mainWindow.isVisible()) ? '隐藏' : '显示';
  const toggleClick = mainWindow && mainWindow.isVisible()
    ? () => { if (mainWindow) mainWindow.hide(); }
    : () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } };

  return Menu.buildFromTemplate([
    { label: toggleLabel, click: toggleClick },
    { type: 'separator' },
    { label: '切换动作', submenu: stateMenuItems },
    { label: '走路', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'walk'); } },
    { type: 'separator' },
    { label: '切换角色', submenu: getCharacterMenuItems() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function getStateLabel(stateName, charName) {
  const labels = {
    idle: '发呆',
    lick: '舔爪子',
    lie_down: '趴下',
    sleep: '睡觉',
    read: '看书',
    sit: '坐下',
    coffee: '喝咖啡',
    typing: '打字',
    smoking: '抽烟',
    look_down: '往下看',
    look_right: '往右看',
    look_up: '往上看',
    look_left: '往左看',
    motorcycle: '骑摩托',
    game: '玩游戏',
  };
  return labels[stateName] || stateName;
}

function updateTrayMenu() {
  if (tray) {
    const charConf = CHARACTERS[currentCharKey];
    tray.setToolTip(charConf.name);
    tray.setContextMenu(buildContextMenu());
  }
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const { width: canvasW, height: canvasH } = getCanvasSize(currentCharKey);

  mainWindow = new BrowserWindow({
    width: canvasW,
    height: canvasH,
    x: Math.floor(screenWidth / 2 - canvasW / 2),
    y: Math.floor(screenHeight / 2 - canvasH / 2),
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
    const charConf = CHARACTERS[currentCharKey];
    const spritePath = path.join(__dirname, 'assets', charConf.sprite).replace(/\\/g, '/');
    mainWindow.webContents.send('sprite-path', spritePath);
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.webContents.send('screen-size', { width, height });
    const [x, y] = mainWindow.getPosition();
    mainWindow.webContents.send('pet-move-to', { x, y });
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('show', () => { updateTrayMenu(); });
  mainWindow.on('hide', () => { updateTrayMenu(); });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  updateTrayMenu();

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

ipcMain.on('resize-window', (event, { width, height }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(width, height);
  }
});

ipcMain.on('show-context-menu', (event, { x, y }) => {
  const popupMenu = Menu.buildFromTemplate([
    { label: '走路', click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', 'walk'); } },
  ]);

  const charConf = CHARACTERS[currentCharKey];
  const stateNames = Object.keys(charConf.states).filter(s => s !== 'walk');
  for (const stateName of stateNames) {
    popupMenu.append(new MenuItem({
      label: getStateLabel(stateName),
      click: () => { if (mainWindow) mainWindow.webContents.send('pet-action', stateName); },
    }));
  }

  popupMenu.append(new MenuItem({ type: 'separator' }));
  popupMenu.append(new MenuItem({
    label: '退出',
    click: () => { isQuitting = true; app.quit(); },
  }));

  popupMenu.popup({ x, y });
});