const CHARACTERS = require('./characters');
const { ipcRenderer } = require('electron');
const path = require('path');

let currentCharKey = 'cat2';
let charConfig = CHARACTERS[currentCharKey];

const sounds = {
  walk: new Audio(),
  meow1: new Audio(),
  meow2: new Audio(),
  lick: new Audio(),
  dance: new Audio(),
};

function loadSounds() {
  const base = path.join(__dirname, '..', 'assets', 'sounds').replace(/\\/g, '/');
  sounds.walk.src = `file:///${base}/cat_walk.wav`;
  sounds.walk.loop = true;
  sounds.meow1.src = `file:///${base}/cat1.wav`;
  sounds.meow2.src = `file:///${base}/cat2.wav`;
  sounds.lick.src = `file:///${base}/cat_lick.wav`;
  sounds.dance.src = `file:///${base}/emily_dance.wav`;
}

let walkSoundPlaying = false;
let lickSoundPlaying = false;

function playWalkSound() {
  if (!walkSoundPlaying && currentCharKey === 'cat2') {
    sounds.walk.currentTime = 0;
    sounds.walk.play().catch(() => {});
    walkSoundPlaying = true;
  }
}

function stopWalkSound() {
  if (walkSoundPlaying) {
    sounds.walk.pause();
    sounds.walk.currentTime = 0;
    walkSoundPlaying = false;
  }
}

function playLickSound() {
  if (!lickSoundPlaying && currentCharKey === 'cat2') {
    sounds.lick.currentTime = 0;
    sounds.lick.play().catch(() => {});
    lickSoundPlaying = true;
  }
}

function stopLickSound() {
  if (lickSoundPlaying) {
    sounds.lick.pause();
    sounds.lick.currentTime = 0;
    lickSoundPlaying = false;
  }
}

function playMeow() {
  if (currentCharKey !== 'cat2') return;
  const meow = Math.random() < 0.5 ? sounds.meow1 : sounds.meow2;
  meow.currentTime = 0;
  meow.play().catch(() => {});
}

let lastColIndex = -1;
let walkStepCount = 0;
let lastInteractionTime = Date.now();
let isSleeping = false;
let isProp = false;
let spriteImage = null;
let spriteLoaded = false;
let propImage = null;
let propLoaded = false;

let canvasWidth = 0;
let canvasHeight = 0;

const DIR = { DOWN: 0, RIGHT: 1, UP: 2, LEFT: 3 };

const STATE = {
  WALK: 'walk',
  IDLE: 'idle',
  MOTORCYCLE: 'motorcycle',
};

let state = STATE.WALK;
let direction = DIR.LEFT;
let stateTimer = 0;
let stateDuration = randomWalkDuration();
let colIndex = 0;
let colTimer = 0;
let moveX = 0;
let moveY = 0;
let loopRepeats = 0;
let loopCurrentRepeat = 0;
let isLoopAnim = false;
let isStaticAnim = false;
let waiting = false;
let waitTimer = 0;
let waitDuration = 0;

let petX = 0;
let petY = 0;
let screenW = 1920;
let screenH = 1080;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastTime = 0;
let initialized = false;

const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');

function randomWalkDuration() {
  return charConfig.walkDurationMin + Math.random() * (charConfig.walkDurationMax - charConfig.walkDurationMin);
}

function randomDirection() {
  const dirs = [DIR.DOWN, DIR.RIGHT, DIR.UP, DIR.LEFT];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function applyCanvasSize() {
  canvasWidth = charConfig.frameWidth * charConfig.scale;
  canvasHeight = charConfig.frameHeight * charConfig.scale;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
}

function loadSprite(src) {
  return new Promise((resolve, reject) => {
    spriteImage = new Image();
    spriteImage.onload = () => { spriteLoaded = true; resolve(); };
    spriteImage.onerror = (err) => { reject(err); };
    const filePath = src.replace(/\\/g, '/');
    spriteImage.src = filePath.startsWith('file://') ? filePath : 'file:///' + filePath;
  });
}

function drawFrame(ctx, row, col) {
  if (!spriteLoaded) return;
  const fw = charConfig.frameWidth;
  const fh = charConfig.frameHeight;
  const sx = col * fw;
  const sy = row * fh;
  const dw = fw * charConfig.scale;
  const dh = fh * charConfig.scale;
  ctx.drawImage(spriteImage, sx, sy, fw, fh, 0, 0, dw, dh);
}

function getWalkRow(dir) {
  const dirRows = charConfig.states.walk.directionRows;
  switch (dir) {
    case DIR.DOWN: return dirRows.down;
    case DIR.RIGHT: return dirRows.right;
    case DIR.UP: return dirRows.up;
    case DIR.LEFT: return dirRows.left;
    default: return dirRows.down;
  }
}

function getCurrentRow() {
  const stateConf = charConfig.states[state];
  if (state === STATE.WALK) {
    return getWalkRow(direction);
  }
  if (stateConf.frames) {
    return stateConf.frames[colIndex % stateConf.frames.length].row;
  }
  return stateConf.row;
}

function applyCanvasSizeProp(w, h) {
  canvasWidth = w;
  canvasHeight = h;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
}

function setState(newState) {
  const prevState = state;
  const prevStateConf = charConfig.states[prevState];

  if (prevState === 'idle') {
    sounds.dance.pause();
    sounds.dance.currentTime = 0;
  }

  state = newState;
  stateTimer = 0;
  colIndex = 0;
  colTimer = 0;
  moveX = 0;
  moveY = 0;
  waiting = false;
  waitTimer = 0;
  lastColIndex = -1;
  walkStepCount = 0;

  if (newState === 'sleep') {
    isSleeping = true;
  } else {
    isSleeping = false;
  }

  stopLickSound();

  if (newState === 'lick') {
    playLickSound();
  }

  if (newState === 'idle' && currentCharKey === 'emily') {
    sounds.dance.currentTime = 0;
    sounds.dance.play().catch(() => {});
  }

  const stateConf = charConfig.states[newState];
  isLoopAnim = stateConf.loops === true;
  isStaticAnim = stateConf.static === true;
  isProp = stateConf.prop === true;

  if (isProp) {
    const scale = charConfig.scale;
    applyCanvasSizeProp(stateConf.propWidth * scale, stateConf.propHeight * scale);
    ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });
  } else if (prevStateConf && prevStateConf.prop === true) {
    applyCanvasSize();
    ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });
  }

  if (isStaticAnim && stateConf.col !== undefined) {
    colIndex = stateConf.col;
  }

  if (isLoopAnim && stateConf.loops === true) {
    const trans = charConfig.transitions[newState];
    if (trans && trans.repeatMin !== undefined) {
      loopRepeats = trans.repeatMin + Math.floor(Math.random() * (trans.repeatMax - trans.repeatMin + 1));
      loopCurrentRepeat = 0;
    } else {
      loopRepeats = 1;
      loopCurrentRepeat = 0;
    }
  } else {
    loopRepeats = 0;
    loopCurrentRepeat = 0;
  }

  if (isStaticAnim || isProp) {
    const trans = charConfig.transitions[newState];
    if (trans && trans.waitMin !== undefined) {
      startWaiting(trans.waitMin + Math.random() * (trans.waitMax - trans.waitMin));
    }
  }

  if (newState === STATE.WALK) {
    stateDuration = randomWalkDuration();
    direction = randomDirection();
  } else if (newState === STATE.IDLE) {
  } else {
    direction = DIR.DOWN;
  }
}

function startWaiting(duration) {
  waiting = true;
  waitTimer = 0;
  waitDuration = duration;
}

function getStateInterval() {
  const stateConf = charConfig.states[state];
  if (state === STATE.WALK) {
    return stateConf.frameInterval;
  }
  return stateConf.frameInterval;
}

function updateState(dt) {
  stateTimer += dt;
  colTimer += dt;

  if (waiting) {
    waitTimer += dt;
    if (waitTimer >= waitDuration) {
      waiting = false;
      setState(STATE.WALK);
    }
    return;
  }

  const interval = getStateInterval();

  if (state === STATE.WALK) {
    if (colTimer >= interval) {
      colTimer -= interval;
      colIndex = (colIndex + 1) % charConfig.cols;
      if (colIndex !== lastColIndex) {
        lastColIndex = colIndex;
        walkStepCount++;
        if (walkStepCount % 3 === 0 && Math.random() < 0.1) {
          playMeow();
        }
      }
    }
    moveX = 0;
    moveY = 0;
    const walkSpeed = charConfig.walkSpeed;
    switch (direction) {
      case DIR.LEFT: moveX = -walkSpeed; break;
      case DIR.RIGHT: moveX = walkSpeed; break;
      case DIR.UP: moveY = -walkSpeed; break;
      case DIR.DOWN: moveY = walkSpeed; break;
    }
    if (stateTimer >= stateDuration) {
      const transitions = charConfig.transitions.walk;
      let r = Math.random();
      let cumulativeWeight = 0;
      const timeSinceInteraction = Date.now() - lastInteractionTime;
      for (const t of transitions) {
        cumulativeWeight += t.weight;
        if (r <= cumulativeWeight) {
          if (t.state === 'sleep' && timeSinceInteraction < 60000) {
            setState(STATE.WALK);
            return;
          }
          if (t.state === STATE.WALK) {
            stateTimer = 0;
            stateDuration = randomWalkDuration();
            direction = randomDirection();
          } else {
            setState(t.state);
          }
          return;
        }
      }
    }
    return;
  }

  const stateConf = charConfig.states[state];
  const frameCount = stateConf.frames ? stateConf.frames.length : charConfig.cols;

  if (isStaticAnim) {
  } else if (colTimer >= interval) {
    colTimer -= interval;
    if (isLoopAnim) {
      colIndex = (colIndex + 1) % frameCount;
      if (colIndex === 0) {
        loopCurrentRepeat++;
        if (state === 'lick') {
          sounds.lick.currentTime = 0;
          sounds.lick.play().catch(() => {});
        }
        if (loopCurrentRepeat >= loopRepeats) {
          const trans = charConfig.transitions[state];
          if (trans && trans.next) {
            setState(trans.next);
          } else {
            setState(STATE.WALK);
          }
          return;
        }
      }
    } else {
      if (colIndex < frameCount - 1) {
        colIndex++;
      }
    }
  }

  if (!isLoopAnim && !isStaticAnim && colIndex >= frameCount - 1 && !waiting) {
    const trans = charConfig.transitions[state];
    if (trans) {
      if (trans.waitMin !== undefined) {
        startWaiting(trans.waitMin + Math.random() * (trans.waitMax - trans.waitMin));
      } else if (trans.next) {
        setState(trans.next);
      }
    } else {
      setState(STATE.WALK);
    }
  }
}

function setupInteraction() {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      lastInteractionTime = Date.now();
      if (isSleeping) {
        isSleeping = false;
        setState(STATE.WALK);
        return;
      }
      isDragging = true;
      dragOffsetX = e.screenX - petX;
      dragOffsetY = e.screenY - petY;
      waiting = false;
      setState(STATE.IDLE);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      petX = e.screenX - dragOffsetX;
      petY = e.screenY - dragOffsetY;
      petX = Math.max(0, Math.min(screenW - canvasWidth, petX));
      petY = Math.max(0, Math.min(screenH - canvasHeight, petY));
      ipcRenderer.send('move-window', { x: Math.round(petX), y: Math.round(petY) });
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0 && isDragging) {
      isDragging = false;
      setState(STATE.WALK);
    }
  });

  canvas.addEventListener('dblclick', () => {
    lastInteractionTime = Date.now();
    const actions = charConfig.doubleClickActions;
    let r = Math.random();
    let cumulative = 0;
    for (const a of actions) {
      cumulative += a.weight;
      if (r <= cumulative) {
        setState(a.state);
        return;
      }
    }
    setState(STATE.IDLE);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('show-context-menu', { x: e.screenX, y: e.screenY });
  });
}

async function switchCharacter(charKey) {
  if (charKey === currentCharKey) return;
  currentCharKey = charKey;
  charConfig = CHARACTERS[charKey];

  applyCanvasSize();

  const spritePath = path.join(__dirname, '..', 'assets', charConfig.sprite).replace(/\\/g, '/');
  await loadSprite(spritePath);

  ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });

  setState(STATE.WALK);

  const { width: sw, height: sh } = await new Promise(resolve => {
    ipcRenderer.once('screen-size', (event, size) => resolve(size));
    ipcRenderer.send('get-screen-size');
  });
  screenW = sw;
  screenH = sh;
}

function update(dt) {
  if (isDragging || isSleeping) return;

  updateState(dt);

  if (moveX !== 0 || moveY !== 0) {
    petX += moveX * dt;
    petY += moveY * dt;

    if (petX < 0) {
      petX = 0;
      direction = DIR.RIGHT;
    } else if (petX > screenW - canvasWidth) {
      petX = screenW - canvasWidth;
      direction = DIR.LEFT;
    }

    if (petY < 0) {
      petY = 0;
      direction = DIR.DOWN;
    } else if (petY > screenH - canvasHeight) {
      petY = screenH - canvasHeight;
      direction = DIR.UP;
    }

    ipcRenderer.send('move-window', { x: Math.round(petX), y: Math.round(petY) });
  }
}

function render() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.imageSmoothingEnabled = false;

  if (isProp && propLoaded) {
    const scale = charConfig.scale;
    const dw = propImage.width * scale;
    const dh = propImage.height * scale;
    const dx = (canvasWidth - dw) / 2;
    const dy = (canvasHeight - dh) / 2;
    ctx.drawImage(propImage, 0, 0, propImage.width, propImage.height, dx, dy, dw, dh);
    return;
  }

  const stateConf = charConfig.states[state];
  const row = getCurrentRow();
  const col = stateConf.frames
    ? stateConf.frames[colIndex % stateConf.frames.length].col
    : colIndex % charConfig.cols;

  drawFrame(ctx, row, col);
}

function gameLoop(timestamp) {
  if (!initialized || !spriteLoaded) {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (lastTime === 0) {
    lastTime = timestamp;
  }

  const dt = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

async function init() {
  applyCanvasSize();
  loadSounds();

  ipcRenderer.on('sprite-path', (event, spritePath) => {
    loadSprite(spritePath).then(() => {
      initialized = true;
      requestAnimationFrame(gameLoop);
    }).catch(err => { console.error('Failed to load sprite:', err); });
  });

  ipcRenderer.on('screen-size', (event, size) => {
    screenW = size.width;
    screenH = size.height;
  });

  ipcRenderer.on('pet-action', (event, action) => {
    if (charConfig.states[action]) {
      if (action === 'walk') {
        direction = randomDirection();
      }
      setState(action);
    }
  });

  ipcRenderer.on('pet-move-to', (event, pos) => {
    petX = pos.x;
    petY = pos.y;
  });

  ipcRenderer.on('switch-character', (event, charKey) => {
    switchCharacter(charKey);
  });

  setupInteraction();
  ipcRenderer.send('get-screen-size');
}

init().catch(console.error);
