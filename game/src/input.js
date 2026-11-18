// Neon Bay — keyboard and mouse state, read fresh every frame.
// The game never reads events directly; it reads this object, so the
// screenshot modes can drive the same input the player uses.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    // Movement vector from WASD / arrows, normalised.
    moveX: 0,
    moveY: 0,
  };

  function updateMoveVector() {
    let x = 0;
    let y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    input.moveX = len > 0 ? x / len : 0;
    input.moveY = len > 0 ? y / len : 0;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
    updateMoveVector();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    updateMoveVector();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
    updateMoveVector();
  });

  input.isDown = (code) => input.keys.has(code);
  input.wasPressed = (code) => input.pressed.has(code);
  // Called at the end of every frame: single-press keys fire once.
  input.endFrame = () => {
    input.pressed.clear();
    input.mouseClicked = false;
  };
  return input;
}
