// The heist itself, with no drawing and no browser in it: the thief's movement and collisions,
// guards walking their patrols, cameras sweeping, who can see whom, the alarm that rises while
// the thief is watched and falls while he is hidden, loot, the van, and the catch. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// (screens, sound) without the world knowing about either.

import {
  COLS, ROWS, TILE, HUD_HEIGHT, PLAYER, VISION, SCORE,
} from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_CASH = 1;
export const EVENT_GEM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_COMPLETE = 8;
export const EVENT_TICK = 16;
export const EVENT_TRIP = 32; // the meter just filled: the escape window opens

const TAU = Math.PI * 2;

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: HUD_HEIGHT + ty * TILE + TILE / 2 };
}

function angleLerp(from, to, t) {
  let diff = (to - from) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return from + diff * Math.min(1, t);
}

function angleDistance(a, b) {
  let diff = Math.abs((a - b) % TAU);
  if (diff > Math.PI) diff = TAU - diff;
  return diff;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    tiles: [],
    player: { x: 0, y: 0, angle: -Math.PI / 2, moving: false, sneaking: false, onShadow: false },
    guards: [],
    cameras: [],
    loots: [],
    exit: { x: 0, y: 0 },
    hasGem: false,
    cashTaken: 0,
    cashTotal: 0,
    alarm: 0,
    exposure: 0, // seconds watched at a full meter; reaching the limit is the catch
    seen: false, // anyone's eyes on the thief this step
    elapsed: 0,
    score: 0,
    timeBonus: 0,
    message: '',
    messageTime: 0,
    complete: false,
    caught: false,
  };

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return state.tiles[ty][tx];
  }

  function isSolid(tx, ty) {
    const tile = tileAt(tx, ty);
    return tile === '#' || tile === 'D';
  }

  function loadLevel(index, keepScore) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.tiles = level.map.map((row) => [...row]);
    state.guards = level.guards.map((def, i) => {
      const start = tileCenter(def.path[0][0], def.path[0][1]);
      const next = tileCenter(def.path[1][0], def.path[1][1]);
      return {
        x: start.x, y: start.y,
        angle: Math.atan2(next.y - start.y, next.x - start.x),
        scanBase: 0, wait: 0, target: 1, see: 0,
        speed: def.speed, path: def.path, phase: i * 1.7,
      };
    });
    state.cameras = level.cameras.map((def) => {
      const pos = tileCenter(def.x, def.y);
      return {
        x: pos.x, y: pos.y, base: (def.base * Math.PI) / 180,
        sweep: (def.sweep * Math.PI) / 180, speed: def.speed, phase: def.phase,
        angle: (def.base * Math.PI) / 180, see: 0,
      };
    });
    state.loots = [];
    state.cashTotal = 0;
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const tile = state.tiles[ty][tx];
        const pos = tileCenter(tx, ty);
        if (tile === 'P') { state.player.x = pos.x; state.player.y = pos.y; }
        if (tile === 'E') state.exit = pos;
        if (tile === 'L') state.loots.push({ x: pos.x, y: pos.y, kind: 'gem', taken: false });
        if (tile === '$') {
          state.loots.push({ x: pos.x, y: pos.y, kind: 'cash', taken: false });
          state.cashTotal += 1;
        }
      }
    }
    state.hasGem = false;
    state.cashTaken = 0;
    state.alarm = 0;
    state.exposure = 0;
    state.seen = false;
    state.elapsed = 0;
    state.timeBonus = 0;
    state.message = '';
    state.messageTime = 0;
    state.complete = false;
    state.caught = false;
    if (!keepScore) state.score = 0;
  }

  /** Can a circle at (x, y) stand there, or does it overlap a wall or a desk? */
  function circleFree(x, y, radius) {
    const minTx = Math.floor((x - radius) / TILE);
    const maxTx = Math.floor((x + radius) / TILE);
    const minTy = Math.floor((y - HUD_HEIGHT - radius) / TILE);
    const maxTy = Math.floor((y - HUD_HEIGHT + radius) / TILE);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!isSolid(tx, ty)) continue;
        const nearX = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const nearY = Math.max(HUD_HEIGHT + ty * TILE, Math.min(y, HUD_HEIGHT + ty * TILE + TILE));
        if ((x - nearX) ** 2 + (y - nearY) ** 2 < radius * radius) return false;
      }
    }
    return true;
  }

  /** Slide a circle by (dx, dy), one axis at a time, so it hugs walls instead of sticking. */
  function slideMove(body, dx, dy, radius) {
    if (dx !== 0 && circleFree(body.x + dx, body.y, radius)) body.x += dx;
    if (dy !== 0 && circleFree(body.x, body.y + dy, radius)) body.y += dy;
  }

  /** A straight, unblocked view from one point to another; walls and desks block it. */
  function lineOfSight(x1, y1, x2, y2) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(distance / 8));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const tx = Math.floor((x1 + (x2 - x1) * t) / TILE);
      const ty = Math.floor((y1 + (y2 - y1) * t - HUD_HEIGHT) / TILE);
      if (isSolid(tx, ty)) return false;
    }
    return true;
  }

  /**
   * How hard one watcher (a guard or a camera) is seeing the thief right now: 0 when he is out
   * of the cone or behind cover, else the alarm rate his distance and the ground earn.
   */
  function watchRate(watcher, range, halfAngle, rateScale) {
    const player = state.player;
    const dx = player.x - watcher.x;
    const dy = player.y - watcher.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return 0;
    if (angleDistance(Math.atan2(dy, dx), watcher.angle) > halfAngle) return 0;
    if (!lineOfSight(watcher.x, watcher.y, player.x, player.y)) return 0;
    let rate = VISION.rateFar + (VISION.rateNear - VISION.rateFar) * (1 - distance / range);
    rate *= rateScale;
    if (player.onShadow) rate *= VISION.shadowScale;
    if (!player.moving) rate *= VISION.stillScale;
    if (player.sneaking) rate *= VISION.sneakScale;
    return rate;
  }

  function stepGuards(dt) {
    for (const guard of state.guards) {
      const alerted = state.alarm > 70 ? 1.35 : 1;
      if (guard.wait > 0) {
        guard.wait -= dt;
        // At a corner the guard stops and looks both ways before moving on.
        guard.angle = guard.scanBase + Math.sin(state.elapsed * 2.2 + guard.phase) * 0.55;
        continue;
      }
      const waypoint = guard.path[guard.target];
      const dest = tileCenter(waypoint[0], waypoint[1]);
      const dx = dest.x - guard.x;
      const dy = dest.y - guard.y;
      const distance = Math.hypot(dx, dy);
      const travel = guard.speed * alerted * dt;
      if (distance <= travel) {
        guard.x = dest.x;
        guard.y = dest.y;
        guard.target = (guard.target + 1) % guard.path.length;
        const ahead = guard.path[guard.target];
        const nextDest = tileCenter(ahead[0], ahead[1]);
        guard.scanBase = Math.atan2(nextDest.y - guard.y, nextDest.x - guard.x);
        guard.angle = guard.scanBase;
        guard.wait = 0.65;
      } else {
        guard.x += (dx / distance) * travel;
        guard.y += (dy / distance) * travel;
        guard.angle = angleLerp(guard.angle, Math.atan2(dy, dx), dt * 10);
      }
    }
  }

  /**
   * One fixed step. `input` is { x, y, sneak } with x and y in -1..1.
   * Returns the EVENT_* flags for what happened in the step.
   */
  function step(dt, input) {
    let events = 0;
    if (state.complete || state.caught) return events;
    state.elapsed += dt;
    const player = state.player;

    // The thief.
    player.sneaking = Boolean(input.sneak);
    player.moving = input.x !== 0 || input.y !== 0;
    if (player.moving) {
      const length = Math.hypot(input.x, input.y);
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.speed;
      slideMove(player, (input.x / length) * speed * dt, (input.y / length) * speed * dt, PLAYER.radius);
      player.angle = angleLerp(player.angle, Math.atan2(input.y, input.x), dt * 14);
    }
    const playerTileX = Math.floor(player.x / TILE);
    const playerTileY = Math.floor((player.y - HUD_HEIGHT) / TILE);
    player.onShadow = tileAt(playerTileX, playerTileY) === 's';

    stepGuards(dt);
    for (const camera of state.cameras) {
      camera.angle = camera.base + Math.sin(state.elapsed * camera.speed + camera.phase) * camera.sweep;
    }

    // Who sees the thief, and how fast the meter climbs.
    let bestRate = 0;
    for (const guard of state.guards) {
      const rate = watchRate(guard, VISION.guardRange, VISION.guardHalfAngle, 1);
      guard.see = rate > 0 ? Math.min(1, guard.see + dt * 5) : Math.max(0, guard.see - dt * 3);
      if (rate > bestRate) bestRate = rate;
    }
    for (const camera of state.cameras) {
      const rate = watchRate(camera, VISION.cameraRange, VISION.cameraHalfAngle, VISION.cameraRateScale);
      camera.see = rate > 0 ? Math.min(1, camera.see + dt * 5) : Math.max(0, camera.see - dt * 3);
      if (rate > bestRate) bestRate = rate;
    }
    state.seen = bestRate > 0;
    const wasFull = state.alarm >= 100;
    if (state.seen) {
      state.alarm = Math.min(100, state.alarm + bestRate * dt);
      if (state.alarm >= 100) {
        state.exposure += dt;
        if (!wasFull) events |= EVENT_TRIP;
        if (state.exposure >= VISION.exposureNeeded) {
          state.caught = true;
          events |= EVENT_CAUGHT;
        }
      }
      if (state.alarm > 40 && state.elapsed % 0.3 < dt) events |= EVENT_TICK;
    } else if (state.alarm >= 100) {
      // A full meter drains fast once every eye is off him; that drain is the escape.
      state.alarm = Math.max(0, state.alarm - VISION.escapeDrain * dt);
      if (state.alarm < 55) state.exposure = 0;
    } else {
      state.alarm = Math.max(0, state.alarm - VISION.decay * dt);
      state.exposure = Math.max(0, state.exposure - dt * 2);
    }

    // Loot, taken by walking over it.
    for (const loot of state.loots) {
      if (loot.taken) continue;
      if (Math.hypot(player.x - loot.x, player.y - loot.y) < PLAYER.radius + 13) {
        loot.taken = true;
        if (loot.kind === 'gem') {
          state.hasGem = true;
          state.score += SCORE.gem;
          events |= EVENT_GEM;
        } else {
          state.cashTaken += 1;
          state.score += SCORE.cash;
          events |= EVENT_CASH;
        }
      }
    }

    // The van: it leaves with the gem aboard, and only then.
    if (Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < TILE * 0.62) {
      if (state.hasGem) {
        state.timeBonus = Math.max(0, Math.round((state.level.par - state.elapsed)) * SCORE.timeBonusPerSecond);
        state.score += state.timeBonus;
        state.complete = true;
        events |= EVENT_COMPLETE;
      } else if (state.messageTime <= 0) {
        state.message = 'No gem, no ride — the vault first.';
        state.messageTime = 2.2;
      }
    }
    if (state.messageTime > 0) state.messageTime -= dt;

    return events;
  }

  loadLevel(0, false);
  return { state, loadLevel, step };
}
