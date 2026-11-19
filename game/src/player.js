// Neon Bay — Rex Marlowe on foot. Movement, facing, health, and the
// enter/exit-car handoff; driving itself lives in vehicles.js.
import { CFG } from './config.js';
import { moveCircle } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0, // facing, radians; follows the mouse while on foot
    hp: CFG.playerHp,
    money: 0,
    inCar: null,
    speed: 0,
    meleeCd: 0,
    shootCd: 0,
    arrestT: 0, // seconds a foot cop has held Rex close; 2.5 means busted
    hurtFlash: 0,
    dead: false,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.meleeCd > 0) p.meleeCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.inCar) return; // driving is vehicles.js's job
  if (G.state !== 'playing') return;
  // Aim follows the mouse; movement follows WASD.
  const cam = G.camera;
  const mx = cam.x + input.mouseX;
  const my = cam.y + input.mouseY;
  p.angle = Math.atan2(my - p.y, mx - p.x);
  const mv = input.moveVector();
  const running = input.down('Shift');
  const speed = running ? CFG.runSpeed : CFG.walkSpeed;
  const nx = p.x + mv.x * speed * dt;
  const ny = p.y + mv.y * speed * dt;
  const moved = moveCircle(G.world, p.x, p.y, nx - p.x, ny - p.y, CFG.playerRadius);
  p.x = moved.x;
  p.y = moved.y;
  p.speed = mv.x !== 0 || mv.y !== 0 ? speed : 0;
  // Keep Rex inside the world.
  p.x = Math.max(20, Math.min(CFG.worldW - 20, p.x));
  p.y = Math.max(20, Math.min(CFG.worldH - 20, p.y));
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.hp <= 0 || G.state !== 'playing') return;
  p.hp -= amount;
  p.hurtFlash = 0.25;
  G.audio.hit();
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    // Rex goes down the same way a bust does: the crew drags him back.
    G.police.busted(G, 'down');
  }
}
