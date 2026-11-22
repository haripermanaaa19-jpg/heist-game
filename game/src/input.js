// Keyboard input. Held keys give a movement vector and the tiptoe flag; one-shot presses
// (confirm, pause, mute) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEYS = {
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  confirm: new Set(['Enter', 'Space']),
  pause: new Set(['KeyP', 'Escape']),
  mute: new Set(['KeyM']),
};

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, sneak: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (KEYS.left.has(event.code)) held.left = true;
    else if (KEYS.right.has(event.code)) held.right = true;
    else if (KEYS.up.has(event.code)) held.up = true;
    else if (KEYS.down.has(event.code)) held.down = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = true;
    else if (KEYS.confirm.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (KEYS.pause.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (KEYS.mute.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (KEYS.left.has(event.code)) held.left = false;
    else if (KEYS.right.has(event.code)) held.right = false;
    else if (KEYS.up.has(event.code)) held.up = false;
    else if (KEYS.down.has(event.code)) held.down = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = held.right = held.up = held.down = held.sneak = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The movement input for world.step: axes in -1..1 plus the tiptoe flag. */
    move() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sneak: held.sneak,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
