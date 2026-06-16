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
  sounds.dance.onended = () => {
    if (state === 'dance') {
      setState(STATE.WALK);
    }
  };
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

const FURNACE_STATE = {
  IDLE: 'furnace_idle',
  WRITING: 'furnace_writing',
  BURNING: 'furnace_burning',
  COOLDOWN: 'furnace_cooldown',
};

const RPS_STATE = { IDLE: 0, CHOOSE: 1, SHOWING: 2, RESULT: 3 };
const RPS_EMOJI = ['✊', '✋', '✌️'];

const STATE = {
  WALK: 'walk',
  IDLE: 'idle',
  DANCE: 'dance',
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

let isFurnaceMode = false;
let furnaceState = FURNACE_STATE.IDLE;
let furnaceTimer = 0;
let furnaceBreathPhase = 0;
let fireParticles = [];
let smokeParticles = [];
let furnaceUserText = '';
let furnaceBurnProgress = 0;
let furnaceBurnTextCanvas = null;
let furnaceTextLines = [];
let furnaceCanvasW = 320;
let furnaceCanvasH = 280;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastTime = 0;
let initialized = false;

let rpsState = RPS_STATE.IDLE;
let rpsPlayerChoice = 0;
let rpsCharChoice = 0;
let rpsResult = '';
let rpsTimer = 0;

const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');

const furnaceOverlay = document.getElementById('furnace-overlay');
const furnaceTextarea = document.getElementById('furnace-text');
const furnaceBurnBtn = document.getElementById('furnace-burn-btn');

const rpsOverlay = document.getElementById('rps-overlay');
const rpsCharName = document.getElementById('rps-char-name');
const rpsChoices = document.getElementById('rps-choices');
const rpsBattle = document.getElementById('rps-battle');
const rpsPlayerEmoji = document.getElementById('rps-player-emoji');
const rpsCharEmoji = document.getElementById('rps-char-emoji');
const rpsCharLabel = document.getElementById('rps-char-label');
const rpsOutcome = document.getElementById('rps-outcome');
const rpsActions = document.getElementById('rps-actions');

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

// ─── Furnace Module ────────────────────────────────────────

function enterFurnaceState(newState) {
  furnaceState = newState;
  furnaceTimer = 0;

  if (newState === FURNACE_STATE.WRITING) {
    furnaceOverlay.classList.remove('hidden');
    furnaceTextarea.value = '';
    furnaceTextarea.focus();
  } else if (newState === FURNACE_STATE.BURNING) {
    furnaceUserText = furnaceTextarea.value.trim();
    furnaceTextarea.value = '';
    hideFurnaceInput();
    furnaceBurnProgress = 0;
    fireParticles = [];
    smokeParticles = [];

    if (furnaceUserText) {
      initBurnText(furnaceUserText);
    } else {
      // Skip burning if no text, go back to idle
      enterFurnaceState(FURNACE_STATE.IDLE);
    }
  } else if (newState === FURNACE_STATE.COOLDOWN) {
    fireParticles = [];
    furnaceBurnTextCanvas = null;
  } else if (newState === FURNACE_STATE.IDLE) {
    hideFurnaceInput();
    fireParticles = [];
    smokeParticles = [];
    furnaceBurnTextCanvas = null;
  }
}

function hideFurnaceInput() {
  furnaceOverlay.classList.add('hidden');
}

function initBurnText(text) {
  furnaceTextLines = [];
  furnaceBurnTextCanvas = document.createElement('canvas');
  furnaceBurnTextCanvas.width = 280;
  furnaceBurnTextCanvas.height = 120;
  const bctx = furnaceBurnTextCanvas.getContext('2d');
  bctx.clearRect(0, 0, 280, 120);
  bctx.font = '15px "Microsoft YaHei", "PingFang SC", sans-serif';
  bctx.fillStyle = '#f0e6d2';

  const lines = [];
  let currentLine = '';
  for (const ch of text) {
    const test = currentLine + ch;
    const m = bctx.measureText(test);
    if (m.width > 260 && currentLine) {
      lines.push(currentLine);
      currentLine = ch;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  furnaceTextLines = lines;

  lines.forEach((line, i) => {
    bctx.fillText(line, 10, i * 22 + 4);
  });
}

function createFireParticle(x, y, isCooldown) {
  if (isCooldown) {
    return {
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.5,
      life: 1,
      maxLife: 2000 + Math.random() * 2000,
      size: 3 + Math.random() * 4,
      alpha: 0.6 + Math.random() * 0.4,
      r: 120, g: 120, b: 120,
      isSmoke: true,
    };
  }
  const colors = [
    { r: 255, g: 255, b: 200 },
    { r: 255, g: 220, b: 80 },
    { r: 255, g: 180, b: 20 },
    { r: 255, g: 120, b: 0 },
    { r: 240, g: 60, b: 0 },
    { r: 200, g: 30, b: 0 },
  ];
  const c = colors[Math.floor(Math.random() * colors.length)];
  return {
    x: x + (Math.random() - 0.5) * 16,
    y: y + (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 0.8,
    vy: -1.2 - Math.random() * 1.5,
    life: 1,
    maxLife: 400 + Math.random() * 600,
    size: 2 + Math.random() * 4,
    alpha: 0.8 + Math.random() * 0.2,
    r: c.r, g: c.g, b: c.b,
    isSmoke: false,
  };
}

function updateFurnaceParticles(dt) {
  for (let i = fireParticles.length - 1; i >= 0; i--) {
    const p = fireParticles[i];
    p.life -= dt / p.maxLife;
    if (p.isSmoke) {
      p.x += p.vx;
      p.y += p.vy;
      p.size += 0.02;
      p.alpha = p.life * 0.5;
    } else {
      p.vy -= 0.5 * (dt / 16);
      p.vx += (Math.random() - 0.5) * 0.3;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = p.life;
    }
    if (p.life <= 0 || p.size < 0.3) {
      fireParticles.splice(i, 1);
    }
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.life -= dt / p.maxLife;
    p.x += p.vx;
    p.y += p.vy;
    p.size += 0.03;
    p.alpha = p.life * 0.4;
    if (p.life <= 0) {
      smokeParticles.splice(i, 1);
    }
  }
}

function drawParticles(ctx) {
  for (const p of fireParticles) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    if (!p.isSmoke) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(255, 150, 50, ${p.alpha * 0.5})`;
    }
    ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.3, p.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  for (const p of smokeParticles) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = 'rgba(150, 150, 150, 1)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function updateFurnace(dt) {
  furnaceBreathPhase += dt * 0.003;
  furnaceTimer += dt;

  switch (furnaceState) {
    case FURNACE_STATE.IDLE:
    case FURNACE_STATE.WRITING:
      break;

    case FURNACE_STATE.BURNING: {
      furnaceBurnProgress += dt / 3000;
      if (!furnaceUserText || furnaceBurnProgress >= 1) {
        furnaceBurnProgress = 1;
        furnaceTimer = 0;
        furnaceState = FURNACE_STATE.COOLDOWN;
        for (let i = 0; i < 15; i++) {
          const fx = canvasWidth / 2 + (Math.random() - 0.5) * 60;
          const fy = canvasHeight - 140 + Math.random() * 30;
          fireParticles.push(createFireParticle(fx, fy, true));
        }
        break;
      }

      const textH = furnaceTextLines.length * 22;
      const burnY = 15 + textH * (1 - furnaceBurnProgress);
      for (let i = 0; i < 2; i++) {
        const px = 20 + Math.random() * 280;
        const py = burnY + Math.random() * 20;
        fireParticles.push(createFireParticle(px, py));
      }
      break;
    }

    case FURNACE_STATE.COOLDOWN: {
      if (furnaceTimer > 3000 && Math.random() < 0.05) {
        const fx = canvasWidth / 2 + (Math.random() - 0.5) * 40;
        const fy = canvasHeight - 130;
        smokeParticles.push(createFireParticle(fx, fy, true));
      }
      if (furnaceTimer >= 10000) {
        enterFurnaceState(FURNACE_STATE.IDLE);
      }
      break;
    }
  }

  updateFurnaceParticles(dt);
}

function renderFurnace() {
  const cw = canvasWidth;
  const ch = canvasHeight;

  // ── Breathing scale ──
  let breath = 1.0;
  if (furnaceState === FURNACE_STATE.BURNING) {
    breath = 1.0 + Math.sin(furnaceBreathPhase * 2.5) * 0.07;
  } else if (furnaceState === FURNACE_STATE.COOLDOWN) {
    breath = 1.0 + Math.sin(furnaceBreathPhase * 0.8) * 0.01;
  } else {
    breath = 1.0 + Math.sin(furnaceBreathPhase * 0.8) * 0.02;
  }

  // ── Glow behind furnace during burn ──
  if (furnaceState === FURNACE_STATE.BURNING) {
    const glowA = 0.25 + Math.sin(furnaceBreathPhase * 3) * 0.12;
    const grd = ctx.createRadialGradient(cw / 2, ch - 100, 10, cw / 2, ch - 60, 100);
    grd.addColorStop(0, `rgba(255, 180, 50, ${glowA})`);
    grd.addColorStop(0.4, `rgba(255, 80, 0, ${glowA * 0.5})`);
    grd.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cw / 2 - 100, ch - 180, 200, 180);
  }

  // ── Burning text ──
  if (furnaceState === FURNACE_STATE.BURNING && furnaceBurnTextCanvas && furnaceTextLines.length) {
    const textH = furnaceTextLines.length * 22;
    const visH = textH * (1 - furnaceBurnProgress); // visible portion from top

    ctx.save();
    ctx.beginPath();
    ctx.rect(20, 15, 280, visH);
    ctx.clip();
    ctx.drawImage(furnaceBurnTextCanvas, 20, 15);
    ctx.restore();
  }

  // ── Draw furnace sprite ──
  const fw = charConfig.frameWidth * charConfig.scale;
  const fh = charConfig.frameHeight * charConfig.scale;
  const fx = (cw - fw) / 2;
  const fy = ch - fh - 20;

  ctx.save();

  let frameCol = 0;
  if (furnaceState === FURNACE_STATE.BURNING && furnaceUserText) {
    frameCol = Math.floor(furnaceTimer / 250) % 2;
  }

  ctx.translate(fx + fw / 2, fy + fh / 2);
  ctx.scale(breath, breath);
  ctx.translate(-(fx + fw / 2), -(fy + fh / 2));

  const sx = frameCol * charConfig.frameWidth;
  const sy = 0;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    spriteImage,
    sx, sy, charConfig.frameWidth, charConfig.frameHeight,
    fx, fy, fw, fh
  );

  ctx.restore();

  // ── Particles ──
  drawParticles(ctx);
}

// ─── End Furnace Module ────────────────────────────────────

// ─── RPS Module ─────────────────────────────────────────────

const RPS_REACTIONS = {
  cat2:    { win: 'lie_down', lose: 'lick', draw: 'idle' },
  sebastian: { win: 'idle',   lose: 'idle', draw: 'idle' },
  emily:   { win: 'idle',     lose: 'dance', draw: 'idle' },
};

function getRPSResult(p, c) {
  if (p === c) return 'draw';
  return (p === 0 && c === 2) || (p === 1 && c === 0) || (p === 2 && c === 1) ? 'win' : 'lose';
}

function startRPS() {
  rpsState = RPS_STATE.CHOOSE;
  rpsTimer = 0;
  rpsBattle.classList.add('hidden');
  rpsOutcome.classList.add('hidden');
  rpsActions.classList.add('hidden');

  canvasWidth = 320;
  canvasHeight = 280;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });

  rpsCharName.textContent = charConfig.name;
  rpsOverlay.classList.remove('hidden');
  setState(STATE.IDLE);
}

function endRPS() {
  rpsOverlay.classList.add('hidden');
  rpsState = RPS_STATE.IDLE;
  applyCanvasSize();
  ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });
  setState(STATE.WALK);
}

function handleRPSPick(pick) {
  if (rpsState !== RPS_STATE.CHOOSE) return;

  rpsPlayerChoice = pick;
  rpsCharChoice = Math.floor(Math.random() * 3);
  rpsResult = getRPSResult(rpsPlayerChoice, rpsCharChoice);
  rpsState = RPS_STATE.SHOWING;
  rpsTimer = 0;

  rpsPlayerEmoji.textContent = RPS_EMOJI[rpsPlayerChoice];
  rpsCharEmoji.textContent = '❓';
  rpsCharLabel.textContent = charConfig.name;

  rpsChoices.classList.add('hidden');
  rpsBattle.classList.remove('hidden');
  rpsOutcome.classList.add('hidden');
}

function revealRPS() {
  rpsCharEmoji.textContent = RPS_EMOJI[rpsCharChoice];

  const outcome = rpsResult;
  const labels = { win: '你赢了！🎉', lose: '你输了...', draw: '平局！' };
  rpsOutcome.textContent = labels[outcome];
  rpsOutcome.className = outcome;
  rpsOutcome.classList.remove('hidden');

  const reaction = (RPS_REACTIONS[currentCharKey] || RPS_REACTIONS.cat2)[outcome];
  if (charConfig.states[reaction]) {
    setState(reaction);
  }

  rpsState = RPS_STATE.RESULT;
  rpsTimer = 0;
}

function updateRPS(dt) {
  if (rpsState === RPS_STATE.IDLE) return;
  rpsTimer += dt;

  if (rpsState === RPS_STATE.SHOWING && rpsTimer >= 800) {
    revealRPS();
  }

  if (rpsState === RPS_STATE.RESULT && rpsTimer >= 2000) {
    rpsActions.classList.remove('hidden');
  }
}

// ─── End RPS Module ─────────────────────────────────────────

function setState(newState) {
  const prevState = state;
  const prevStateConf = charConfig.states[prevState];

  if (prevState === 'dance') {
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

  if (newState === 'dance') {
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
      if (rpsState !== RPS_STATE.IDLE) return;
      if (isFurnaceMode) {
        if (furnaceState === FURNACE_STATE.IDLE) {
          enterFurnaceState(FURNACE_STATE.WRITING);
        } else if (furnaceState === FURNACE_STATE.WRITING) {
          enterFurnaceState(FURNACE_STATE.IDLE);
        }
        return;
      }
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
    if (rpsState !== RPS_STATE.IDLE || isFurnaceMode) return;
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
    if (rpsState !== RPS_STATE.IDLE || isFurnaceMode) return;
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

  if (rpsState !== RPS_STATE.IDLE) {
    rpsOverlay.classList.add('hidden');
    rpsState = RPS_STATE.IDLE;
  }

  currentCharKey = charKey;
  charConfig = CHARACTERS[charKey];

  isFurnaceMode = charConfig.isFurnace === true;

  if (isFurnaceMode) {
    canvasWidth = charConfig.furnaceCanvasWidth;
    canvasHeight = charConfig.furnaceCanvasHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
  } else {
    applyCanvasSize();
  }

  const spritePath = path.join(__dirname, '..', 'assets', charConfig.sprite).replace(/\\/g, '/');
  await loadSprite(spritePath);

  ipcRenderer.send('resize-window', { width: canvasWidth, height: canvasHeight });

  if (isFurnaceMode) {
    enterFurnaceState(FURNACE_STATE.IDLE);
    // Reset pet interaction timer
    isDragging = false;
  } else {
    hideFurnaceInput();
    setState(STATE.WALK);
  }

  const { width: sw, height: sh } = await new Promise(resolve => {
    ipcRenderer.once('screen-size', (event, size) => resolve(size));
    ipcRenderer.send('get-screen-size');
  });
  screenW = sw;
  screenH = sh;
}

function update(dt) {
  if (isFurnaceMode) {
    updateFurnace(dt);
    return;
  }
  updateRPS(dt);
  if (rpsState !== RPS_STATE.IDLE || isDragging || isSleeping) return;

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

  if (isFurnaceMode) {
    renderFurnace();
    return;
  }

  if (rpsState !== RPS_STATE.IDLE) {
    const fw = charConfig.frameWidth * charConfig.scale;
    const fh = charConfig.frameHeight * charConfig.scale;
    const dx = (canvasWidth - fw) / 2;
    const dy = canvasHeight - fh - 10;
    const stateConf = charConfig.states[state];
    const row = stateConf.frames
      ? stateConf.frames[colIndex % stateConf.frames.length].row
      : stateConf.row;
    const col = stateConf.frames
      ? stateConf.frames[colIndex % stateConf.frames.length].col
      : colIndex % charConfig.cols;
    ctx.drawImage(spriteImage,
      col * charConfig.frameWidth, row * charConfig.frameHeight,
      charConfig.frameWidth, charConfig.frameHeight,
      dx, dy, fw, fh);
    return;
  }

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
    if (action === 'rps') {
      startRPS();
      return;
    }
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

  furnaceBurnBtn.addEventListener('click', () => {
    if (isFurnaceMode && furnaceState === FURNACE_STATE.WRITING) {
      enterFurnaceState(FURNACE_STATE.BURNING);
    }
  });

  document.querySelectorAll('.rps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleRPSPick(parseInt(btn.dataset.choice));
    });
  });

  document.getElementById('rps-again').addEventListener('click', () => {
    rpsState = RPS_STATE.CHOOSE;
    rpsTimer = 0;
    rpsBattle.classList.add('hidden');
    rpsOutcome.classList.add('hidden');
    rpsActions.classList.add('hidden');
    rpsChoices.classList.remove('hidden');
    setState(STATE.IDLE);
  });

  document.getElementById('rps-quit').addEventListener('click', () => {
    endRPS();
  });

  setupInteraction();
  ipcRenderer.send('get-screen-size');
}

init().catch(console.error);
