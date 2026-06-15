const CHARACTERS = {
  cat2: {
    name: '猫猫',
    sprite: 'cat2.png',
    frameWidth: 32,
    frameHeight: 32,
    cols: 4,
    scale: 3,
    walkSpeed: 0.08,
    states: {
      walk: {
        directionRows: { down: 0, right: 1, up: 2, left: 3 },
        frameInterval: 350,
      },
      idle: {
        row: 4,
        frameInterval: 450,
        loops: false,
      },
      lick: {
        row: 5,
        frameInterval: 400,
        loops: true,
      },
      lie_down: {
        row: 6,
        frameInterval: 400,
        loops: false,
      },
      sleep: {
        row: 7,
        frameInterval: 600,
        loops: false,
      },
    },
    transitions: {
      walk: [
        { state: 'idle', weight: 0.25 },
        { state: 'walk', weight: 0.25 },
        { state: 'lie_down', weight: 0.15 },
        { state: 'lick', weight: 0.15 },
        { state: 'sleep', weight: 0.20 },
      ],
      idle: { waitMin: 3000, waitMax: 6000, next: 'walk' },
      lick: { repeatMin: 2, repeatMax: 4, next: 'walk' },
      lie_down: { waitMin: 3000, waitMax: 6000, next: 'walk' },
      sleep: { waitMin: 5000, waitMax: 10000, next: 'walk' },
    },
    walkDurationMin: 2000,
    walkDurationMax: 5000,
    doubleClickActions: [
      { state: 'lick', weight: 0.4 },
      { state: 'lie_down', weight: 0.3 },
      { state: 'sleep', weight: 0.3 },
    ],
  },
  sebastian: {
    name: 'Sebastian',
    sprite: 'characters/Sebastian.png',
    frameWidth: 16,
    frameHeight: 32,
    cols: 4,
    scale: 3,
    walkSpeed: 0.06,
    states: {
      walk: {
        directionRows: { down: 0, right: 1, up: 2, left: 3 },
        frameInterval: 200,
      },
      idle: {
        row: 0,
        col: 0,
        frameInterval: 600,
        loops: false,
        static: true,
      },
      motorcycle: {
        row: 0,
        col: 0,
        frameInterval: 600,
        loops: false,
        prop: true,
        propWidth: 48,
        propHeight: 34,
        propSrc: 'motorcycle.png',
      },
    },
    transitions: {
      walk: [
        { state: 'idle', weight: 0.4 },
        { state: 'walk', weight: 0.3 },
        { state: 'motorcycle', weight: 0.3 },
      ],
      idle: { waitMin: 1000, waitMax: 2500, next: 'walk' },
      motorcycle: { waitMin: 4000, waitMax: 8000, next: 'walk' },
    },
    walkDurationMin: 2000,
    walkDurationMax: 4000,
    doubleClickActions: [
      { state: 'idle', weight: 1.0 },
    ],
  },
  emily: {
    name: 'Emily',
    sprite: 'characters/Emily_walk.png',
    frameWidth: 16,
    frameHeight: 32,
    cols: 4,
    scale: 3,
    walkSpeed: 0.06,
    states: {
      walk: {
        directionRows: { down: 0, right: 1, up: 2, left: 3 },
        frameInterval: 200,
      },
      idle: {
        row: 0,
        col: 0,
        frameInterval: 600,
        loops: false,
        static: true,
      },
    },
    transitions: {
      walk: [
        { state: 'idle', weight: 0.4 },
        { state: 'walk', weight: 0.6 },
      ],
      idle: { waitMin: 1000, waitMax: 2500, next: 'walk' },
    },
    walkDurationMin: 2000,
    walkDurationMax: 4000,
    doubleClickActions: [
      { state: 'idle', weight: 1.0 },
    ],
  },
};

module.exports = CHARACTERS;