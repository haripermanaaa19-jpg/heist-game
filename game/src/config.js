// Every tuning number and colour for Midnight Vault, in one place. The playfield is a fixed
// 960x640 logical area: a 40 px HUD bar over a 24x15 grid of 40 px tiles. The renderer scales
// that area to the window, so no rule below depends on the screen size.

export const VIEW = { width: 960, height: 640 };
export const HUD_HEIGHT = 40;
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 152,
  sneakSpeed: 84,
};

export const VISION = {
  guardRange: 152,
  cameraRange: 168,
  guardHalfAngle: 0.58, // about 33 degrees to each side of the facing
  cameraHalfAngle: 0.5,
  /** Alarm points per second at arm's length and at the cone's rim, before cover modifiers. */
  rateNear: 74,
  rateFar: 20,
  cameraRateScale: 0.8,
  shadowScale: 0.35, // standing on a dark rug
  stillScale: 0.6, // holding perfectly still
  sneakScale: 0.5,
  decay: 11, // alarm points per second while nobody sees the thief
  escapeDrain: 38, // how fast a full meter falls once the thief breaks every line of sight
  exposureNeeded: 1.6, // seconds of being watched at a full meter before the catch
};

export const SCORE = {
  gem: 500,
  cash: 150,
  timeBonusPerSecond: 5,
};

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#272c38',
  floorAlt: '#232833',
  vaultFloor: '#3a3320',
  rug: '#33222e',
  wall: '#46536b',
  wallTop: '#5a6b8a',
  desk: '#6e5133',
  deskTop: '#8a6844',
  exit: '#1f4d2e',
  gem: '#5ff2e0',
  cash: '#7ddb6a',
  guard: '#2e4a7d',
  guardCap: '#1d3257',
  camera: '#c8ccd4',
  thief: '#15181f',
  thiefTrim: '#e8b93c',
  coneGuard: '255, 205, 92',
  coneCamera: '255, 110, 96',
  text: '#eef1f5',
  muted: '#98a2b5',
  alarm: '#ff5147',
  gold: '#f2c94c',
  panel: '#171c28',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
