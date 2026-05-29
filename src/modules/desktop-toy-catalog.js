export const DESKTOP_TOY_ATLAS = {
  petId: 'yoyo',
  spritesheetPath: '../assets/yoyo/spritesheet.webp',
  sourceConfig: 'assets/yoyo/pet.json',
  cell: { width: 192, height: 208 },
  grid: { columns: 8, rows: 42 },
  scale: 0.75,
  anchor: { x: 0.5, y: 1 },
};

export const DESKTOP_TOY_STATES = {
  walk: {
    right: { stateName: 'runningRight', row: 1, frames: 8, fps: 12 },
    left: { stateName: 'runningLeft', row: 2, frames: 8, fps: 12 },
  },
  pauses: [
    { stateName: 'idle', row: 0, frames: 6, fps: 4, loop: 'pingpong', weight: 5 },
    { stateName: 'waiting', row: 6, frames: 6, fps: 3, loop: 'pingpong', weight: 3 },
    { stateName: 'lookingAround', row: 15, frames: 8, fps: 3, loop: 'pingpong', weight: 2 },
    { stateName: 'yawning', row: 12, frames: 5, fps: 3, loop: 'pingpong', weight: 1 },
  ],
  clickReactions: [
    { stateName: 'petting', row: 11, frames: 4, fps: 4, loop: 'pingpong', durationMs: 2200 },
    { stateName: 'bashful', row: 7, frames: 6, speed: 250, loop: 'pingpong', durationMs: 1800 },
    { stateName: 'waving', row: 3, frames: 4, fps: 4, loop: 'pingpong', durationMs: 1600 },
    { stateName: 'jumping', row: 4, frames: 5, fps: 7, loop: 'pingpong', durationMs: 1400 },
  ],
  lightweightActions: [
    { stateName: 'eating', row: 13, frames: 6, fps: 5, loop: 'pingpong', durationMs: 2600 },
    { stateName: 'dancing', row: 21, frames: 8, speed: 220, durationMs: 2600 },
    { stateName: 'review', row: 8, frames: 6, fps: 4, loop: 'pingpong', durationMs: 2400 },
    { stateName: 'readBook', row: 8, frames: 6, speed: 300, loop: 'pingpong', durationMs: 3200 },
  ],
};

export const DESKTOP_TOY_PROPS = {
  cookie: {
    asset: '../assets/yoyo/home/prop-food.webp',
    dimensions: { width: 210, height: 150 },
    reusableAs: 'food-or-cookie-popup',
    artStatus: 'usable-placeholder',
  },
  toyBox: {
    asset: '../assets/yoyo/home/prop-toy.webp',
    dimensions: { width: 250, height: 225 },
    reusableAs: 'small-toy-popup',
    artStatus: 'usable',
  },
  heart: {
    asset: '../assets/yoyo/home/prop-heart.webp',
    dimensions: { width: 180, height: 116 },
    reusableAs: 'pat-affection-popup',
    artStatus: 'usable',
  },
  bath: {
    asset: '../assets/yoyo/home/prop-bath.webp',
    dimensions: { width: 260, height: 269 },
    reusableAs: 'freshen-up-popup',
    artStatus: 'usable-but-large',
  },
  switchAndToys: {
    asset: '../assets/yoyo/home/decor-tv-game-toys.webp',
    dimensions: { width: 300, height: 157 },
    reusableAs: 'game-toy-popup',
    artStatus: 'usable-but-scene-decor',
  },
  bed: {
    asset: '../assets/yoyo/home/prop-bed.webp',
    dimensions: { width: 1, height: 1 },
    reusableAs: 'sleep-popup',
    artStatus: 'missing-standalone-art',
  },
};

export const DESKTOP_TOY_EVENTS = [
  {
    id: 'bottom-walk',
    trigger: 'ambient',
    states: ['runningRight', 'runningLeft'],
    props: [],
    note: 'Use screen edge direction to select the walking state.',
  },
  {
    id: 'random-pause',
    trigger: 'ambient',
    states: ['idle', 'waiting', 'lookingAround', 'yawning'],
    props: [],
    note: 'Short idle breaks between bottom-walk segments.',
  },
  {
    id: 'click-pat',
    trigger: 'click',
    states: ['petting', 'bashful'],
    props: ['heart'],
    note: 'Primary click reaction.',
  },
  {
    id: 'click-cookie',
    trigger: 'click',
    states: ['eating'],
    props: ['cookie'],
    note: 'Can ship with the food prop as a placeholder until cookie art exists.',
  },
  {
    id: 'click-toy',
    trigger: 'click',
    states: ['dancing', 'jumping'],
    props: ['toyBox', 'switchAndToys'],
    note: 'Light play reaction using existing home toy assets.',
  },
  {
    id: 'click-wave',
    trigger: 'click',
    states: ['waving'],
    props: [],
    note: 'No prop required.',
  },
];

export default {
  atlas: DESKTOP_TOY_ATLAS,
  states: DESKTOP_TOY_STATES,
  props: DESKTOP_TOY_PROPS,
  events: DESKTOP_TOY_EVENTS,
};
