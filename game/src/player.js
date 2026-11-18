// Neon Bay — Rex Marlowe on foot: walking, running, aiming, entering
// cars, and taking damage. Driving lives in vehicles.js; this file is
// only the person, so the two never fight over the same controls.
import { CFG } from './config.js';
import { clamp, distance } from './random.js';
import { moveWithCollision as slide, collidesSolid } from './world.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    radius: CFG.playerRadius,
    health: CFG.playerMaxHealth,
    cash: CFG.startCash,
    car: null,
    pistolCooldown: 0,
    meleeCooldown: 0,
    hurtFlash: 0,
    running: false,
    moving: false,
  };
}

export function playerAimAngle(game) {
  const p = game.player;
  // Before the mouse has ever moved, aim where Rex is going: a fresh
  // player who only uses the keyboard would otherwise always aim at the
  // top-left corner of the screen.
  if (!game.input.mouseMoved && (game.input.moveX !== 0 || game.input.moveY !== 0)) {
    return Math.atan2(game.input.moveY, game.input.moveX);
  }
  const cam = game.camera;
  const worldMouseX = cam.x + (game.input.mouseX - game.viewW / 2) / cam.zoom;
  const worldMouseY = cam.y + (game.input.mouseY - game.viewH / 2) / cam.zoom;
  return Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
}

// One hit from going down: the HUD throbs a red edge at this point.
export function isLowHealth(player) {
  return player.health > 0 && player.health < 30;
}

export function updatePlayerOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  p.pistolCooldown = Math.max(0, p.pistolCooldown - dt);
  p.meleeCooldown = Math.max(0, p.meleeCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.angle = playerAimAngle(game);
  p.running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = p.running ? CFG.runSpeed : CFG.walkSpeed;
  const dx = input.moveX * speed * dt;
  const dy = input.moveY * speed * dt;
  p.moving = dx !== 0 || dy !== 0;
  slide(game.world, p, dx, dy, p.radius);
  // Slow health regen while the heat is off.
  if (game.wanted === 0 && p.health > 0 && p.health < CFG.playerMaxHealth) {
    p.health = Math.min(CFG.playerMaxHealth, p.health + 2.5 * dt);
  }
}

export function nearestCarToPlayer(game, maxDist) {
  // Prefer a car Rex does not own: pressing E beside your own ride and
  // a car worth stealing should steal the car, not get you back into
  // the one you just parked. Only when no unowned car is in reach does
  // E take the nearest car, owned or not.
  let bestUnowned = null;
  let bestUnownedD = maxDist;
  let bestOwned = null;
  let bestOwnedD = maxDist;
  for (const car of game.cars) {
    if (car.wrecked) continue;
    const d = distance(game.player.x, game.player.y, car.x, car.y);
    if (!car.owned && d < bestUnownedD) {
      bestUnowned = car;
      bestUnownedD = d;
    } else if (car.owned && d < bestOwnedD) {
      bestOwned = car;
      bestOwnedD = d;
    }
  }
  return bestUnowned || bestOwned;
}

// E: step into the nearest car, or step out of the one being driven.
export function tryEnterOrExitCar(game) {
  const p = game.player;
  if (p.car) {
    const car = p.car;
    car.speed = 0;
    p.car = null;
    // Step out on the driver's side so the player is never inside a wall.
    // If both sides are blocked (a narrow alley), step out behind the car.
    const spots = [
      [Math.cos(car.angle + Math.PI / 2), Math.sin(car.angle + Math.PI / 2)],
      [-Math.cos(car.angle + Math.PI / 2), -Math.sin(car.angle + Math.PI / 2)],
      [-Math.cos(car.angle), -Math.sin(car.angle)],
    ];
    for (const [dx, dy] of spots) {
      p.x = car.x + dx * 34;
      p.y = car.y + dy * 34;
      if (!collidesSolid(game.world, p.x, p.y, p.radius)) break;
    }
    game.addMessage('Out of the car.');
    return;
  }
  const car = nearestCarToPlayer(game, 64);
  if (!car) return;
  p.car = car;
  car.owner = 'player';
  // The player's ride is sturdier than a random traffic car.
  car.health = Math.max(car.health, CFG.playerCarHealth);
  if (!car.owned) {
    car.owned = true;
    // A real theft: the mission that asks for a stolen car watches this.
    game.justStole = true;
    game.addWanted(1, 'Car stolen');
    game.addMessage('You stole the car! The law noticed.');
    game.sound.pickup();
  } else {
    game.addMessage('Back behind the wheel.');
  }
}

export function damagePlayer(game, amount, source) {
  const p = game.player;
  if (p.health <= 0 || game.state !== 'playing') return;
  p.health -= amount;
  p.hurtFlash = 0.35;
  game.shake = Math.min(10, game.shake + 4);
  game.sound.hit();
  if (p.health <= 0) {
    p.health = 0;
    game.state = 'dead';
    game.sound.busted();
    game.addMessage(`Taken down by ${source}.`);
  }
}

export function healPlayer(game, amount) {
  const p = game.player;
  p.health = clamp(p.health + amount, 0, CFG.playerMaxHealth);
}
