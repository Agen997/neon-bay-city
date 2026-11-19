// Neon Bay — the wanted system and the NBPD. Stars climb on crime and cool
// off when Rex lays low; cruisers chase and ram, foot officers close in to
// arrest, and a cop shoots at Rex's car — never through a building.
import { CFG } from './config.js';
import { blockedCircle, moveCircle, isRoad } from './world.js';
import { spawnCopCar } from './vehicles.js';

export function createPolice() {
  return {
    wanted: 0, // 0..5, fractional while cooling
    sinceCrime: 999,
    cops: [], // foot officers {x,y,hp,arrestT,shootCd}
    cruisers: [], // {car}
    spawnT: 0,
    sirenOn: false,
  };
}

export function wantedStars(police) {
  return Math.ceil(police.wanted - 0.001);
}

export function addWanted(G, stars, reason) {
  const pol = G.police;
  pol.wanted = Math.min(5, pol.wanted + stars);
  pol.sinceCrime = 0;
  if (reason) G.hud.flash(G, reason);
  ensureResponse(G);
}

function desiredCruisers(w) {
  if (w < 1) return 0;
  if (w < 2) return 1;
  if (w < 4) return 2;
  return 3;
}

function desiredFoot(w) {
  if (w < 2) return 0;
  return Math.min(4, Math.floor(w));
}

// Spawn a cruiser on a road near the player, just out of clear sight.
function spawnCruiser(G) {
  const p = G.player;
  const world = G.world;
  for (let tries = 0; tries < 12; tries++) {
    const horizontal = G.rng.chance(0.5);
    const road = G.rng.pick(world.centers);
    const along = p.x + G.rng.range(-650, 650);
    const x = horizontal ? along : road;
    const y = horizontal ? road : p.y + G.rng.range(-650, 650);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 320 || d > 800) continue;
    if (!isRoad(world, x, y)) continue;
    const car = spawnCopCar(G, x, y);
    G.police.cruisers.push({ car });
    return;
  }
}

function spawnFootCop(G) {
  const p = G.player;
  for (let tries = 0; tries < 10; tries++) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(380, 620);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (x < 20 || y < 20 || x > CFG.citySize - 20 || y > CFG.citySize - 20) continue;
    if (blockedCircle(G.world, x, y, 12)) continue;
    G.police.cops.push({ x, y, hp: CFG.copHp, arrestT: 0, shootCd: 1 });
    return;
  }
}

function ensureResponse(G) {
  const pol = G.police;
  const w = wantedStars(pol);
  while (pol.cruisers.length < desiredCruisers(w)) spawnCruiser(G);
  while (pol.cops.length < desiredFoot(w)) spawnFootCop(G);
}

function lineBlocked(world, x0, y0, x1, y1) {
  // Sample the segment; a building between the two points blocks the shot.
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 24);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (const b of world.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
  }
  return false;
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  pol.sinceCrime += dt;
  // Heat cools off after a quiet spell; once it hits zero the police leave.
  if (pol.wanted > 0 && pol.sinceCrime > CFG.wantedDecayDelay) {
    pol.wanted = Math.max(0, pol.wanted - CFG.wantedDecayRate * dt);
  }
  const w = wantedStars(pol);
  if (w === 0) {
    // Stand down: units drive and walk away, then despawn.
    for (const c of pol.cruisers) {
      const car = c.car;
      car.angle += 0.4 * dt;
      car.x += Math.cos(car.angle) * 140 * dt;
      car.y += Math.sin(car.angle) * 140 * dt;
    }
    for (const cop of pol.cops) {
      const dx = cop.x - p.x;
      const dy = cop.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = cop.x + (dx / d) * 120 * dt;
      const ny = cop.y + (dy / d) * 120 * dt;
      if (!blockedCircle(G.world, nx, ny, 12)) { cop.x = nx; cop.y = ny; }
    }
    pol.cruisers = pol.cruisers.filter((c) => Math.hypot(c.car.x - p.x, c.car.y - p.y) < 1500 && !c.car.wrecked);
    pol.cops = pol.cops.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1200);
    if (pol.sirenOn) { G.audio.stopSiren(); pol.sirenOn = false; }
    return;
  }
  ensureResponse(G);
  if (!pol.sirenOn && pol.cruisers.length > 0) { G.audio.startSiren(); pol.sirenOn = true; }
  // Cruisers chase and ram.
  for (const c of pol.cruisers) {
    const car = c.car;
    if (car.wrecked) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    const targetSpeed = d > 120 ? 380 : 240;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!blockedCircle(G.world, nx, ny, 16)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.5;
    }
    // Ram the player's car, or the player on foot.
    if (d < 44) {
      if (p.inCar) {
        G.vehicles.damageCar(G, p.inCar, 14 * dt);
        p.inCar.speed *= 0.9;
        p.inCar.x += (dx / d) * 30 * dt;
        p.inCar.y += (dy / d) * 30 * dt;
      } else {
        const push = moveCircle(G.world, p.x, p.y, (dx / d) * 90 * dt, (dy / d) * 90 * dt, CFG.playerRadius);
        p.x = push.x;
        p.y = push.y;
        if (G.time - (c.lastHit || 0) > 0.8) {
          c.lastHit = G.time;
          G.playerHurt(12);
        }
      }
    }
  }
  pol.cruisers = pol.cruisers.filter((c) => !c.car.wrecked);
  // Foot officers close in to arrest; they shoot at the car, not the man.
  // A cop wedged on a building slides sideways until the way clears.
  const chaseStep = (cop, speed) => {
    if (cop.stuckT === undefined) { cop.stuckT = 0; cop.slideT = 0; cop.slideDir = 1; cop.lastD = Infinity; }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < cop.lastD - 2) { cop.lastD = d; cop.stuckT = 0; }
    else cop.stuckT += dt;
    if (cop.stuckT > 1.2 && cop.slideT <= 0) {
      cop.slideT = 1.0;
      cop.slideDir = G.rng.chance(0.5) ? 1 : -1;
      cop.stuckT = 0;
    }
    let mx = (dx / d) * speed * dt;
    let my = (dy / d) * speed * dt;
    if (cop.slideT > 0) {
      cop.slideT -= dt;
      mx = (-dy / d) * cop.slideDir * speed * dt;
      my = (dx / d) * cop.slideDir * speed * dt;
    }
    if (!blockedCircle(G.world, cop.x + mx, cop.y + my, 12)) { cop.x += mx; cop.y += my; }
    return d;
  };
  for (const cop of pol.cops) {
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    if (p.inCar) {
      // Hold a firing line and shoot the car — never through a building.
      cop.shootCd -= dt;
      if (d > 240) {
        chaseStep(cop, CFG.copSpeed);
      } else if (cop.shootCd <= 0 && !lineBlocked(G.world, cop.x, cop.y, p.x, p.y)) {
        cop.shootCd = 1.1;
        const a = Math.atan2(dy, dx) + G.rng.range(-0.06, 0.06);
        G.combat.fireBullet(G, cop.x, cop.y, a, 460, 9, 'cop');
        G.audio.enemyShoot();
      }
      cop.arrestT = 0;
    } else if (d < 30) {
      cop.arrestT += dt;
      if (cop.arrestT >= 2.5) {
        busted(G, 'arrested');
        return;
      }
    } else {
      cop.arrestT = Math.max(0, cop.arrestT - dt);
      chaseStep(cop, CFG.copSpeed);
    }
  }
  pol.cops = pol.cops.filter((c) => c.hp > 0);
}

export function busted(G, reason) {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  G.bustedReason = reason;
  const lost = Math.floor(G.player.money * CFG.bustedLoseCash);
  G.player.money -= lost;
  G.bustedLost = lost;
  G.police.wanted = 0;
  G.police.cops = [];
  for (const c of G.police.cruisers) {
    const i = G.cars.indexOf(c.car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.police.cruisers = [];
  G.audio.stopSiren();
  G.police.sirenOn = false;
  G.audio.fail();
  // The crew drags Rex back to Mara's garage; the mission step restarts.
  G.player.hp = CFG.playerHp;
  G.player.dead = false;
  G.player.arrestT = 0;
  if (G.player.inCar) G.player.inCar = null;
  G.player.x = G.world.spots.garage.x;
  G.player.y = G.world.spots.garage.y;
  G.missions.onBusted(G);
  G.save();
}
