// The screenshot scenes behind ?shot=start|play|alarm|end. Each one builds a real world and
// plays its rules forward — idling so the patrols are mid-round, walking the thief onto loot,
// standing him in a cone — so the frame is what the game itself looks like at that moment, and
// the same scene always lands on the same frame. Nothing here draws; it only stages.

import { STEP, TILE, HUD_HEIGHT } from './config.js';
import { createWorld } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_COMPLETE } from './render.js';

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: HUD_HEIGHT + ty * TILE + TILE / 2 };
}

function idle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, { x: 0, y: 0, sneak: false });
}

function walk(world, seconds, input) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, input);
}

/** The cover: the title over the first floor, its patrol already on the move. */
function stageStart(world) {
  idle(world, 3.5);
  return SCREEN_TITLE;
}

/** Mid-heist on floor one: the thief crosses the hall with the meter already warm. */
function stagePlay(world) {
  idle(world, 2);
  const spot = tileCenter(11, 7);
  world.state.player.x = spot.x;
  world.state.player.y = spot.y;
  world.state.player.angle = 0;
  world.state.alarm = 34;
  walk(world, 0.45, { x: 1, y: 0, sneak: false });
  return SCREEN_PLAY;
}

/** The moment it goes wrong: caught in a guard's cone, the meter nearly full. */
function stageAlarm(world) {
  idle(world, 2.6);
  const guard = world.state.guards[0];
  const post = tileCenter(10, 7);
  guard.x = post.x;
  guard.y = post.y;
  guard.wait = 30;
  guard.scanBase = 0;
  guard.angle = 0;
  world.state.player.x = post.x + 72;
  world.state.player.y = post.y;
  world.state.player.angle = Math.PI;
  world.state.alarm = 88;
  idle(world, 0.3);
  return SCREEN_PLAY;
}

/** The getaway: gem lifted, a bag grabbed on the way, and the van reached. */
function stageEnd(world) {
  idle(world, 9);
  const state = world.state;
  const gem = state.loots.find((loot) => loot.kind === 'gem');
  state.player.x = gem.x;
  state.player.y = gem.y;
  world.step(STEP, { x: 0, y: 0, sneak: false });
  const cash = state.loots.find((loot) => loot.kind === 'cash' && loot.x > 400 && loot.y > 400);
  state.player.x = cash.x;
  state.player.y = cash.y;
  world.step(STEP, { x: 0, y: 0, sneak: false });
  const doorstep = tileCenter(18, 12);
  state.player.x = doorstep.x;
  state.player.y = doorstep.y;
  walk(world, 0.6, { x: 1, y: 0, sneak: false });
  return SCREEN_COMPLETE;
}

/**
 * Set a fresh world to the named scene (start, play, alarm or end; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.loadLevel(0, false);
  if (name === 'play') return stagePlay(world);
  if (name === 'alarm') return stageAlarm(world);
  if (name === 'end' || name === 'escape') return stageEnd(world);
  return stageStart(world);
}
