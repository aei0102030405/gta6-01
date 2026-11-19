// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (interact, shoot, pause, mute, save, confirm) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked for aiming.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;
export const ACTION_PUNCH = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const SHOOT = new Set(['KeyF']);
const PUNCH = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);
const SAVE = new Set(['KeyL']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
        event.preventDefault();
      }
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (SHOOT.has(event.code)) actions |= ACTION_SHOOT;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (SAVE.has(event.code)) actions |= ACTION_SAVE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) ||
        CONFIRM.has(event.code) || BRAKE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function axis(neg, pos) {
    return (pos ? 1 : 0) - (neg ? 1 : 0);
  }
  /** True when any key in the set is held down. */
  function held(set) {
    for (const code of set) {
      if (keys.has(code)) return true;
    }
    return false;
  }

  return {
    mouse,
    /** Movement axes, each -1, 0 or 1. */
    moveX() {
      return axis(held(LEFT), held(RIGHT));
    },
    moveY() {
      return axis(held(UP), held(DOWN));
    },
    running() {
      return held(RUN);
    },
    braking() {
      return held(BRAKE);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
