const SPRITE_SIZE = 32;
const SCALE = 6;
const COLS = 4;
const ROWS = 8;
const CANVAS_SIZE = SPRITE_SIZE * SCALE;

const DIRECTIONS = { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3 };
const ANIM_ROWS = {
  IDLE_SIT: 0,
  WALK_1: 1,
  IDLE_VARIANT: 2,
  WALK_2: 3,
  IDLE_2: 4,
  IDLE_3: 5,
  RUN: 6,
  SLEEP: 7,
};
const STATES = { IDLE: 'idle', WALK: 'walk', RUN: 'run', SLEEP: 'sleep' };

const IDLE_DURATION_MIN = 3000;
const IDLE_DURATION_MAX = 8000;
const WALK_DURATION_MIN = 2000;
const WALK_DURATION_MAX = 5000;
const SLEEP_TRIGGER_TIME = 30000;
const WALK_SPEED = 0.4;
const RUN_SPEED = 1.2;

// ==================== Sprite ====================
let spriteImage = null;
let spriteLoaded = false;

function loadSprite(src) {
  return new Promise((resolve, reject) => {
    spriteImage = new Image();
    spriteImage.onload = () => {
      spriteLoaded = true;
      console.log('Sprite loaded:', src, spriteImage.width, 'x', spriteImage.height);
      resolve();
    };
    spriteImage.onerror = (err) => {
      console.error('Failed to load sprite:', src, err);
      reject(err);
    };
    const filePath = src.replace(/\\/g, '/');
    spriteImage.src = filePath.startsWith('file://') ? filePath : 'file:///' + filePath;
  });
}

function drawFrame(ctx, animRow, direction, x, y) {
  if (!spriteLoaded) return;
  const col = direction;
  const sx = col * SPRITE_SIZE;
  const sy = animRow * SPRITE_SIZE;
  ctx.drawImage(
    spriteImage,
    sx, sy, SPRITE_SIZE, SPRITE_SIZE,
    x, y, SPRITE_SIZE * SCALE, SPRITE_SIZE * SCALE
  );
}

// ==================== Behavior ====================
let state = STATES.IDLE;
let direction = DIRECTIONS.DOWN;
let stateTimer = 0;
let stateDuration = randomIdleDuration();
let idleStartTime = Date.now();
let frameIndex = 0;
let frameTimer = 0;
let moveX = 0;
let moveY = 0;

function randomIdleDuration() {
  return IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
}

function randomWalkDuration() {
  return WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN);
}

function randomDirection() {
  const dirs = [DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT, DIRECTIONS.UP];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function setState(newState, newDirection) {
  const oldState = state;
  state = newState;
  if (newDirection !== undefined) {
    direction = newDirection;
  }
  stateTimer = 0;
  frameIndex = 0;
  frameTimer = 0;
  moveX = 0;
  moveY = 0;

  switch (newState) {
    case STATES.IDLE:
      stateDuration = randomIdleDuration();
      idleStartTime = Date.now();
      break;
    case STATES.WALK:
      stateDuration = randomWalkDuration();
      direction = randomDirection();
      break;
    case STATES.RUN:
      stateDuration = randomWalkDuration() * 0.6;
      direction = randomDirection();
      break;
    case STATES.SLEEP:
      stateDuration = Infinity;
      direction = DIRECTIONS.DOWN;
      break;
  }
}

function updateBehavior(dt) {
  stateTimer += dt;
  frameTimer += dt;

  let animRow = ANIM_ROWS.IDLE_SIT;
  let frameInterval = 500;

  switch (state) {
    case STATES.IDLE:
      animRow = ANIM_ROWS.IDLE_SIT;
      frameInterval = 500;
      if (frameTimer > 2000) {
        frameIndex = (frameIndex + 1) % 2;
        if (frameIndex === 1) {
          animRow = ANIM_ROWS.IDLE_VARIANT;
        }
        frameTimer = 0;
      }
      if (stateTimer >= stateDuration) {
        if (Date.now() - idleStartTime > SLEEP_TRIGGER_TIME) {
          setState(STATES.SLEEP);
        } else {
          setState(Math.random() < 0.2 ? STATES.RUN : STATES.WALK);
        }
      }
      break;

    case STATES.WALK:
      moveX = 0;
      moveY = 0;
      switch (direction) {
        case DIRECTIONS.LEFT: moveX = -WALK_SPEED; break;
        case DIRECTIONS.RIGHT: moveX = WALK_SPEED; break;
        case DIRECTIONS.UP: moveY = -WALK_SPEED; break;
        case DIRECTIONS.DOWN: moveY = WALK_SPEED; break;
      }
      animRow = frameIndex % 2 === 0 ? ANIM_ROWS.WALK_1 : ANIM_ROWS.WALK_2;
      frameInterval = 250;
      if (frameTimer >= frameInterval) {
        frameIndex = (frameIndex + 1) % 2;
        frameTimer = 0;
      }
      if (stateTimer >= stateDuration) {
        setState(STATES.IDLE);
      }
      break;

    case STATES.RUN:
      moveX = 0;
      moveY = 0;
      switch (direction) {
        case DIRECTIONS.LEFT: moveX = -RUN_SPEED; break;
        case DIRECTIONS.RIGHT: moveX = RUN_SPEED; break;
        case DIRECTIONS.UP: moveY = -RUN_SPEED; break;
        case DIRECTIONS.DOWN: moveY = RUN_SPEED; break;
      }
      animRow = ANIM_ROWS.RUN;
      frameInterval = 100;
      if (stateTimer >= stateDuration) {
        setState(STATES.IDLE);
      }
      break;

    case STATES.SLEEP:
      animRow = ANIM_ROWS.SLEEP;
      frameInterval = 1000;
      break;
  }

  return { animRow };
}

function getCurrentAnimRow() {
  switch (state) {
    case STATES.IDLE:
      if (frameIndex === 1) return ANIM_ROWS.IDLE_VARIANT;
      return ANIM_ROWS.IDLE_SIT;
    case STATES.WALK:
      return frameIndex % 2 === 0 ? ANIM_ROWS.WALK_1 : ANIM_ROWS.WALK_2;
    case STATES.RUN:
      return ANIM_ROWS.RUN;
    case STATES.SLEEP:
      return ANIM_ROWS.SLEEP;
    default:
      return ANIM_ROWS.IDLE_SIT;
  }
}

// ==================== Pet ====================
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
  console.log('Initializing pet...');

  ipcRenderer.on('sprite-path', (event, spritePath) => {
    console.log('Received sprite path:', spritePath);
    loadSprite(spritePath).then(() => {
      initialized = true;
      requestAnimationFrame(gameLoop);
    }).catch(err => {
      console.error('Failed to load sprite:', err);
    });
  });

  ipcRenderer.on('screen-size', (event, size) => {
    screenW = size.width;
    screenH = size.height;
    console.log('Screen size:', screenW, 'x', screenH);
  });

  ipcRenderer.on('pet-action', (event, action) => {
    switch (action) {
      case 'idle': setState(STATES.IDLE); break;
      case 'walk': setState(STATES.WALK); break;
      case 'run': setState(STATES.RUN); break;
      case 'sleep': setState(STATES.SLEEP); break;
    }
  });

  ipcRenderer.on('pet-move-to', (event, pos) => {
    petX = pos.x;
    petY = pos.y;
    console.log('Pet position:', petX, petY);
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
      if (state === STATES.SLEEP) {
        setState(STATES.IDLE);
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
      setState(STATES.IDLE);
    }
  });

  canvas.addEventListener('dblclick', () => {
    if (state === STATES.SLEEP) {
      setState(STATES.IDLE);
    } else {
      setState(STATES.SLEEP);
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

  updateBehavior(dt, screenW, screenH, petX, petY);

  if (moveX !== 0 || moveY !== 0) {
    petX += moveX * dt;
    petY += moveY * dt;

    if (petX < 0) {
      petX = 0;
      direction = DIRECTIONS.RIGHT;
    } else if (petX > screenW - CANVAS_SIZE) {
      petX = screenW - CANVAS_SIZE;
      direction = DIRECTIONS.LEFT;
    }

    if (petY < 0) {
      petY = 0;
      direction = DIRECTIONS.DOWN;
    } else if (petY > screenH - CANVAS_SIZE) {
      petY = screenH - CANVAS_SIZE;
      direction = DIRECTIONS.UP;
    }

    ipcRenderer.send('move-window', { x: Math.round(petX), y: Math.round(petY) });
  }
}

function render() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.imageSmoothingEnabled = false;

  const animRow = getCurrentAnimRow();
  if (spriteLoaded) {
    drawFrame(ctx, animRow, direction, 0, 0);
  } else {
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Loading...', 20, 100);
  }
}

init().catch(console.error);