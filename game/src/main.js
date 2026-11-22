// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between screens: title, play, paused, caught, floor complete and the win.
//
// ?shot=start|play|alarm|end (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, EVENT_CASH, EVENT_GEM, EVENT_TICK, EVENT_TRIP, EVENT_CAUGHT, EVENT_COMPLETE } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_COMPLETE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { LEVELS } from './levels.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const screen = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let floorStartScore = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFloor(index, score) {
    world.loadLevel(index, true);
    world.state.score = score;
    floorStartScore = score;
    screen = SCREEN_PLAY;
    announce(`Floor ${index + 1}: ${world.state.level.name}. Lift the gem and reach the van.`);
  }

  function handleEvents(events) {
    if (events & EVENT_CASH) audio.play('cash');
    if (events & EVENT_GEM) audio.play('gem');
    if (events & EVENT_TICK) audio.play('tick');
    if (events & EVENT_TRIP) audio.play('trip');
    if (events & EVENT_CAUGHT) {
      audio.play('caught');
      screen = SCREEN_CAUGHT;
      announce(`Busted on floor ${world.state.levelIndex + 1}.`);
    } else if (events & EVENT_COMPLETE) {
      audio.play('complete');
      screen = world.state.levelIndex + 1 >= LEVELS.length ? SCREEN_WIN : SCREEN_COMPLETE;
      announce(screen === SCREEN_WIN ? `All floors emptied. Final score ${world.state.score}.` : 'Clean getaway.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
      audio.play('click');
      startFloor(0, 0);
    } else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (screen === SCREEN_CAUGHT && (actions & ACTION_CONFIRM)) {
      // The floor's loot was impounded: retry from the score the floor started with.
      startFloor(world.state.levelIndex, floorStartScore);
    } else if (screen === SCREEN_COMPLETE && (actions & ACTION_CONFIRM)) {
      startFloor(world.state.levelIndex + 1, world.state.score);
    } else if (screen === SCREEN_WIN && (actions & ACTION_CONFIRM)) {
      startFloor(0, 0);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The floor lives behind the title: patrols walk, cameras sweep, nobody is caught.
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sneak: false });
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        handleEvents(world.step(STEP, input.move()));
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, audio.isMuted());
  }

  // Leaving the tab pauses a running heist rather than letting it be caught unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Enter to start the job.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
