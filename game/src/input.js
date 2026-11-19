// Keyboard + mouse input for Neon Bay. Held keys are read every step; one-shot presses
// (enter car, radio, pause, weapon slots) queue as flags the loop takes once. The mouse
// orbits the camera under pointer lock; arrow keys turn the camera too, so the game is
// playable (and testable) without pointer lock.

export const ACT = {
  ENTER: 1,
  PAUSE: 2,
  RADIO: 4,
  WEAPON1: 8,
  WEAPON2: 16,
  WEAPON3: 32,
  WEAPON4: 64,
  JUMP: 128,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let firing = false;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyF') actions |= ACT.ENTER;
    else if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACT.PAUSE;
    else if (e.code === 'KeyR') actions |= ACT.RADIO;
    else if (e.code === 'Digit1') actions |= ACT.WEAPON1;
    else if (e.code === 'Digit2') actions |= ACT.WEAPON2;
    else if (e.code === 'Digit3') actions |= ACT.WEAPON3;
    else if (e.code === 'Digit4') actions |= ACT.WEAPON4;
    else if (e.code === 'Space') actions |= ACT.JUMP;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) firing = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });

  return {
    keys,
    get firing() {
      return firing;
    },
    get locked() {
      return locked;
    },
    /** Movement axes in camera space: x strafe (-1..1), z forward (-1..1), plus sprint. */
    moveAxes() {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      return { fwd, side, turn, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), handbrake: keys.has('Space') };
    },
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    queueAction(flag) {
      actions |= flag;
    },
    setFiring(v) {
      firing = v;
    },
    requestLock() {
      if (!locked && canvas.requestPointerLock) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Headless or denied: arrow-key camera still works.
        }
      }
    },
  };
}
