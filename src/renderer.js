const SPRITE_SIZE = 32;
const SCALE = 3;
const ANIM_COLS = 4;
const ANIM_ROWS = 8;
const CANVAS_SIZE = SPRITE_SIZE * SCALE;

const ROW = {
  WALK_DOWN: 0,
  WALK_RIGHT: 1,
  WALK_UP: 2,
  WALK_LEFT: 3,
  IDLE: 4,
  IDLE_LICK: 5,
  LIE_DOWN: 6,
  SLEEP: 7,
};

const DIR = { DOWN: 0, RIGHT: 1, UP: 2, LEFT: 3 };

const STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  LICK: 'lick',
  LIE_DOWN: 'lie_down',
  SLEEP: 'sleep',
};

const FRAME_INTERVALS = {};
FRAME_INTERVALS[STATE.IDLE] = 450;
FRAME_INTERVALS[STATE.WALK] = 350;
FRAME_INTERVALS[STATE.LICK] = 400;
FRAME_INTERVALS[STATE.LIE_DOWN] = 400;
FRAME_INTERVALS[STATE.SLEEP] = 600;

const IDLE_DURATION_MIN = 3000;
const IDLE_DURATION_MAX = 8000;
const WALK_DURATION_MIN = 2000;
const WALK_DURATION_MAX = 5000;
const WALK_SPEED = 0.08;
const LICK_REPEAT_MIN = 2;
const LICK_REPEAT_MAX = 4;

let spriteImage = null;
let spriteLoaded = false;

function loadSprite(src) {
  return new Promise((resolve, reject) => {
    spriteImage = new Image();
    spriteImage.onload = () => {
      spriteLoaded = true;
      resolve();
    };
    spriteImage.onerror = (err) => { reject(err); };
    const filePath = src.replace(/\\/g, '/');
    spriteImage.src = filePath.startsWith('file://') ? filePath : 'file:///' + filePath;
  });
}

function drawFrame(ctx, row, col) {
  if (!spriteLoaded) return;
  const sx = col * SPRITE_SIZE;
  const sy = row * SPRITE_SIZE;
  const dw = SPRITE_SIZE * SCALE;
  const dh = SPRITE_SIZE * SCALE;
  ctx.drawImage(spriteImage, sx, sy, SPRITE_SIZE, SPRITE_SIZE, 0, 0, dw, dh);
}

let state = STATE.IDLE;
let direction = DIR.DOWN;
let stateTimer = 0;
let stateDuration = randomIdleDuration();
let idleStartTime = Date.now();
let colIndex = 0;
let colTimer = 0;
let moveX = 0;
let moveY = 0;
let lickRepeats = 0;
let lickCurrentRepeat = 0;

function randomIdleDuration() {
  return IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
}

function randomWalkDuration() {
  return WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN);
}

function randomDirection() {
  const dirs = [DIR.DOWN, DIR.RIGHT, DIR.UP, DIR.LEFT];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function randomNextState() {
  const r = Math.random();
  if (r < 0.50) return STATE.WALK;
  if (r < 0.70) return STATE.LICK;
  if (r < 0.90) return STATE.LIE_DOWN;
  return STATE.SLEEP;
}

function setState(newState) {
  state = newState;
  stateTimer = 0;
  colIndex = 0;
  colTimer = 0;
  moveX = 0;
  moveY = 0;

  switch (newState) {
    case STATE.IDLE:
      stateDuration = randomIdleDuration();
      idleStartTime = Date.now();
      direction = DIR.DOWN;
      break;
    case STATE.WALK:
      stateDuration = randomWalkDuration();
      direction = randomDirection();
      break;
    case STATE.LICK:
      lickRepeats = LICK_REPEAT_MIN + Math.floor(Math.random() * (LICK_REPEAT_MAX - LICK_REPEAT_MIN + 1));
      lickCurrentRepeat = 0;
      direction = DIR.DOWN;
      break;
    case STATE.LIE_DOWN:
      direction = DIR.DOWN;
      break;
    case STATE.SLEEP:
      direction = DIR.DOWN;
      break;
  }
}

function getWalkRow() {
  switch (direction) {
    case DIR.DOWN: return ROW.WALK_DOWN;
    case DIR.RIGHT: return ROW.WALK_RIGHT;
    case DIR.UP: return ROW.WALK_UP;
    case DIR.LEFT: return ROW.WALK_LEFT;
    default: return ROW.WALK_DOWN;
  }
}

function getCurrentRow() {
  switch (state) {
    case STATE.IDLE: return ROW.IDLE;
    case STATE.WALK: return getWalkRow();
    case STATE.LICK: return ROW.IDLE_LICK;
    case STATE.LIE_DOWN: return ROW.LIE_DOWN;
    case STATE.SLEEP: return ROW.SLEEP;
    default: return ROW.IDLE;
  }
}

function updateState(dt) {
  stateTimer += dt;
  colTimer += dt;

  const interval = FRAME_INTERVALS[state] || 400;

  switch (state) {
    case STATE.IDLE:
      if (colTimer >= interval) {
        colTimer -= interval;
        if (colIndex < ANIM_COLS - 1) {
          colIndex++;
        }
      }
      if (stateTimer >= stateDuration) {
        setState(randomNextState());
      }
      break;

    case STATE.WALK:
      if (colTimer >= interval) {
        colTimer -= interval;
        colIndex = (colIndex + 1) % ANIM_COLS;
      }
      moveX = 0;
      moveY = 0;
      switch (direction) {
        case DIR.LEFT: moveX = -WALK_SPEED; break;
        case DIR.RIGHT: moveX = WALK_SPEED; break;
        case DIR.UP: moveY = -WALK_SPEED; break;
        case DIR.DOWN: moveY = WALK_SPEED; break;
      }
      if (stateTimer >= stateDuration) {
        setState(STATE.IDLE);
      }
      break;

    case STATE.LICK:
      if (colTimer >= interval) {
        colTimer -= interval;
        colIndex++;
        if (colIndex >= ANIM_COLS) {
          colIndex = 0;
          lickCurrentRepeat++;
          if (lickCurrentRepeat >= lickRepeats) {
            setState(STATE.IDLE);
            return;
          }
        }
      }
      break;

    case STATE.LIE_DOWN:
      if (colTimer >= interval) {
        colTimer -= interval;
        if (colIndex < ANIM_COLS - 1) {
          colIndex++;
        } else {
          setState(STATE.IDLE);
          return;
        }
      }
      break;

    case STATE.SLEEP:
      if (colTimer >= interval) {
        colTimer -= interval;
        if (colIndex < ANIM_COLS - 1) {
          colIndex++;
        } else {
          setState(STATE.IDLE);
          return;
        }
      }
      break;
  }
}

const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');
const { ipcRenderer } = require('electron');

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;
canvas.style.width = CANVAS_SIZE + 'px';
canvas.style.height = CANVAS_SIZE + 'px';

let petX = 0;
let petY = 0;
let screenW = 1920;
let screenH = 1080;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastTime = 0;
let initialized = false;

async function init() {
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
    switch (action) {
      case 'idle': setState(STATE.IDLE); break;
      case 'walk': direction = randomDirection(); setState(STATE.WALK); break;
      case 'run': direction = randomDirection(); setState(STATE.WALK); break;
      case 'sleep': setState(STATE.SLEEP); break;
    }
  });

  ipcRenderer.on('pet-move-to', (event, pos) => {
    petX = pos.x;
    petY = pos.y;
  });

  setupInteraction();
  ipcRenderer.send('get-screen-size');
}

function setupInteraction() {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      dragOffsetX = e.screenX - petX;
      dragOffsetY = e.screenY - petY;
      if (state === STATE.SLEEP || state === STATE.LIE_DOWN) {
        setState(STATE.IDLE);
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      petX = e.screenX - dragOffsetX;
      petY = e.screenY - dragOffsetY;
      petX = Math.max(0, Math.min(screenW - CANVAS_SIZE, petX));
      petY = Math.max(0, Math.min(screenH - CANVAS_SIZE, petY));
      ipcRenderer.send('move-window', { x: Math.round(petX), y: Math.round(petY) });
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0 && isDragging) {
      isDragging = false;
      setState(STATE.IDLE);
    }
  });

  canvas.addEventListener('dblclick', () => {
    const r = Math.random();
    if (r < 0.5) {
      setState(STATE.LICK);
    } else {
      setState(STATE.LIE_DOWN);
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('show-context-menu', { x: e.screenX, y: e.screenY });
  });
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

function update(dt) {
  if (isDragging) return;

  updateState(dt);

  if (moveX !== 0 || moveY !== 0) {
    petX += moveX * dt;
    petY += moveY * dt;

    if (petX < 0) {
      petX = 0;
      direction = DIR.RIGHT;
    } else if (petX > screenW - CANVAS_SIZE) {
      petX = screenW - CANVAS_SIZE;
      direction = DIR.LEFT;
    }

    if (petY < 0) {
      petY = 0;
      direction = DIR.DOWN;
    } else if (petY > screenH - CANVAS_SIZE) {
      petY = screenH - CANVAS_SIZE;
      direction = DIR.UP;
    }

    ipcRenderer.send('move-window', { x: Math.round(petX), y: Math.round(petY) });
  }
}

function render() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.imageSmoothingEnabled = false;

  const row = getCurrentRow();
  const col = colIndex % ANIM_COLS;

  drawFrame(ctx, row, col);
}

init().catch(console.error);