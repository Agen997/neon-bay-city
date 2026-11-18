// Neon Bay — combat: pistol bullets, melee swings and the damage they
// do to pedestrians, police, rival thugs and cars. A shot fired in
// public is a crime, so combat and the wanted system feed each other.
import { CFG } from './config.js';
import { distance, angleTo } from './random.js';
import { collidesSolid } from './world.js';
import { damageCar } from './vehicles.js';
import { addWanted } from './police.js';
import { damagePlayer } from './player.js';

export function firePistol(game) {
  const p = game.player;
  if (p.car || p.pistolCooldown > 0 || game.state !== 'playing') return;
  p.pistolCooldown = CFG.pistolCooldown;
  game.recentShotTimer = 2.5;
  game.sound.shoot();
  const muzzleX = p.x + Math.cos(p.angle) * 20;
  const muzzleY = p.y + Math.sin(p.angle) * 20;
  game.bullets.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(p.angle) * CFG.bulletSpeed,
    vy: Math.sin(p.angle) * CFG.bulletSpeed,
    life: CFG.pistolRange / CFG.bulletSpeed,
    fromPlayer: true,
  });
  game.addParticles(muzzleX, muzzleY, '#ffd166', 5);
  game.shake = Math.min(8, game.shake + 1.5);
}

export function meleeSwing(game) {
  const p = game.player;
  if (p.car || p.meleeCooldown > 0 || game.state !== 'playing') return;
  p.meleeCooldown = CFG.meleeCooldown;
  game.meleeArc = 0.22;
  game.sound.punch();
  const reach = CFG.meleeRange + 14;
  const hitAt = (x, y) => distance(p.x, p.y, x, y) < reach;
  let hitSomething = false;
  for (const ped of game.peds) {
    if (!ped.down && hitAt(ped.x, ped.y)) {
      ped.down = true;
      hitSomething = true;
    }
  }
  for (const thug of game.thugs) {
    if (thug.health > 0 && hitAt(thug.x, thug.y)) {
      thug.health -= CFG.meleeDamage;
      hitSomething = true;
      game.addParticles(thug.x, thug.y, '#ff5b5b', 6);
    }
  }
  for (const unit of game.police) {
    if (unit.kind !== 'foot' || unit.dead) continue;
    if (hitAt(unit.x, unit.y)) {
      unit.dead = true;
      hitSomething = true;
      addWanted(game, 2, 'Officer down');
    }
  }
  if (hitSomething) game.shake = Math.min(9, game.shake + 2);
}

function bulletHitsSolid(game, bullet) {
  return collidesSolid(game.world, bullet.x, bullet.y, 2);
}

export function updateBullets(game, dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || bulletHitsSolid(game, b)) {
      b.dead = true;
      game.addParticles(b.x, b.y, '#cfd6e4', 3);
      continue;
    }
    if (!b.fromPlayer) continue;
    // Hit a pedestrian.
    for (const ped of game.peds) {
      if (!ped.down && distance(b.x, b.y, ped.x, ped.y) < 16) {
        ped.down = true;
        b.dead = true;
        addWanted(game, 1, 'Pedestrian shot');
        game.addParticles(ped.x, ped.y, '#ff5b5b', 8);
        break;
      }
    }
    if (b.dead) continue;
    // Hit a rival thug.
    for (const thug of game.thugs) {
      if (thug.health > 0 && distance(b.x, b.y, thug.x, thug.y) < 18) {
        thug.health -= CFG.pistolDamage;
        b.dead = true;
        game.addParticles(thug.x, thug.y, '#ff5b5b', 8);
        if (thug.health <= 0) {
          game.addCash(50, 'Thug dropped cash');
          // A downed thug sometimes leaves a health pack behind: the
          // boss fight is long, and the street provides.
          if (game.rng.chance(CFG.thugHealthDropChance)) {
            game.pickups.push({ x: thug.x, y: thug.y, kind: 'health', taken: false });
          }
        }
        break;
      }
    }
    if (b.dead) continue;
    // Hit a foot officer.
    for (const unit of game.police) {
      if (unit.kind !== 'foot' || unit.dead) continue;
      if (distance(b.x, b.y, unit.x, unit.y) < 18) {
        unit.dead = true;
        b.dead = true;
        addWanted(game, 2, 'Officer shot');
        game.addParticles(unit.x, unit.y, '#2f6bff', 8);
        break;
      }
    }
    if (b.dead) continue;
    // Hit a car (police or civilian).
    for (const car of game.cars) {
      if (car.wrecked) continue;
      if (distance(b.x, b.y, car.x, car.y) < 24) {
        damageCar(game, car, CFG.pistolDamage);
        b.dead = true;
        game.addParticles(b.x, b.y, '#ffd166', 5);
        if (car.kind === 'police') addWanted(game, 1, 'Police car shot');
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
}

// Rival thugs: simple melee/ranged enemies used by missions 3 and 5.
export function spawnThug(game, x, y) {
  const thug = {
    x,
    y,
    angle: 0,
    speed: 150,
    health: 70,
    shootCooldown: game.rng.range(0.8, 1.8),
  };
  game.thugs.push(thug);
  return thug;
}

export function updateThugs(game, dt) {
  const p = game.player;
  const target = p.car ? { x: p.car.x, y: p.car.y } : p;
  for (const thug of game.thugs) {
    if (thug.health <= 0) continue;
    const d = distance(thug.x, thug.y, target.x, target.y);
    thug.angle = angleTo(thug.x, thug.y, target.x, target.y);
    if (d > 46) {
      // Close in — and charge the last stretch, so a thug does not just
      // shuffle up to the player at one flat speed.
      const charging = d < 140;
      const speed = charging ? thug.speed * 1.35 : thug.speed;
      thug.x += Math.cos(thug.angle) * speed * dt;
      thug.y += Math.sin(thug.angle) * speed * dt;
    } else {
      // Close in: swing at the player.
      thug.shootCooldown -= dt;
      if (thug.shootCooldown <= 0) {
        thug.shootCooldown = 1.0;
        if (p.car) damageCar(game, p.car, 12);
        else damagePlayer(game, 9, 'a Tide King thug');
      }
    }
  }
  game.thugs = game.thugs.filter((t) => t.health > 0);
}
