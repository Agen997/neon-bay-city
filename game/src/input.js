// Neon Bay 3D — keyboard + mouse input. WASD moves, mouse orbits (right-drag)
// and aims, wheel zooms. Edge-triggered presses are queued per frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedQueue = [];
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, rdown: false, wheel: 0 };
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedQueue.push(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rdown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.mouse.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  }

  down(code) { return this.keys.has(code); }

  // True once, the frame the key went down.
  pressed(code) { return this.pressedQueue.includes(code); }

  // Call at the end of each frame.
  endFrame() {
    this.pressedQueue.length = 0;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }
}
