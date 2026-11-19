// Neon Bay — pistol, melee and thugs. Rex aims with the mouse, swings with
// Space, and the Tide King crew charges the last stretch on foot. A downed
// thug sometimes leaves a health pack behind.
import { CFG, PALETTE } from './config.js';
import { moveCircle } from './world.js';
import { hurtPlayer } from './player.js';

export function createCombat() {
  return {
    bullets: [], // {x,y,vx,vy,dmg,owner,life}
    thugs: [], // {x,y,hp,speed,hitCd,king,leash}
    packs: [], // {x,y,kind}
    swingT: 0, // melee swing animation timer
    swingAngle: 0,
  };
}

export function fireBullet(G, x, y, angle, speed, dmg, owner) {
  G.combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg, owner,
    life: 1.6,
  });
}

function pointInBuilding(world, x, y) {
  for (const b of world.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function spawnThug(G, x, y, opts = {}) {
  const thug = {
    x, y,
    hp: opts.hp || CFG.thugHp,
    speed: opts.speed || CFG.thugSpeed,
    hitCd: 0,
    king: !!opts.king,
    leash: opts.leash || null, // {x0,y0,x1,y1} the thug never leaves
    name: opts.name || 'Thug',
  };
  G.combat.thugs.push(thug);
  return thug;
}

function damageThug(G, thug, dmg) {
  thug.hp -= dmg;
  G.audio.hit();
  if (thug.hp > 0) return;
  const i = G.combat.thugs.indexOf(thug);
  if (i >= 0) G.combat.thugs.splice(i, 1);
  if (G.rng.chance(0.35)) {
    G.combat.packs.push({ x: thug.x, y: thug.y, kind: 'health' });
  }
  G.missions.onEvent(G, 'thugDown', thug);
  if (thug.king) G.missions.onEvent(G, 'kingDown', thug);
}

export function updateCombat(G, dt) {
  const c = G.combat;
  const p = G.player;
  if (c.swingT > 0) c.swingT -= dt;
  // Pistol: hold the mouse button, aim with the pointer.
  if (G.state === 'playing' && !p.inCar && G.input.mouseDown && p.shootCd <= 0) {
    const cam = G.camera;
    const mx = cam.x + G.input.mouseX;
    const my = cam.y + G.input.mouseY;
    const a = Math.atan2(my - p.y, mx - p.x);
    fireBullet(G, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a, 780, CFG.pistolDamage, 'player');
    p.shootCd = CFG.pistolCooldown;
    p.angle = a;
    G.audio.shoot();
    G.traffic.scarePeds(G, p.x, p.y, 260);
  }
  // Melee: Space swings an arc in front of Rex.
  if (G.state === 'playing' && !p.inCar && G.input.down(' ') && p.meleeCd <= 0) {
    p.meleeCd = CFG.meleeCooldown;
    c.swingT = 0.22;
    c.swingAngle = p.angle;
    G.audio.melee();
    const hit = (t) => {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > CFG.meleeRange) return;
      let diff = Math.atan2(t.y - p.y, t.x - p.x) - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < CFG.meleeArc) damageThug(G, t, CFG.meleeDamage);
    };
    for (const t of [...c.thugs]) hit(t);
    for (const cop of [...G.police.cops]) {
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d > CFG.meleeRange) continue;
      let diff = Math.atan2(cop.y - p.y, cop.x - p.x) - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < CFG.meleeArc) {
        cop.hp -= CFG.meleeDamage;
        if (cop.hp <= 0) G.police.addWanted(G, 1, 'officer down');
      }
    }
    G.traffic.scarePeds(G, p.x, p.y, 200);
  }
  // Bullets fly, stop at buildings, and hit what they meet.
  for (const b of [...c.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || pointInBuilding(G.world, b.x, b.y);
    if (!dead) {
      if (b.owner === 'player') {
        for (const t of [...c.thugs]) {
          if (Math.hypot(t.x - b.x, t.y - b.y) < 16) {
            damageThug(G, t, b.dmg);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of [...G.police.cops]) {
            if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
              cop.hp -= b.dmg;
              if (cop.hp <= 0) G.police.addWanted(G, 1, 'officer down');
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const car of G.cars) {
            if (car === p.inCar || car.wrecked) continue;
            if (Math.hypot(car.x - b.x, car.y - b.y) < 20) {
              G.vehicles.damageCar(G, car, b.dmg);
              dead = true;
              break;
            }
          }
        }
      } else if (b.owner === 'cop') {
        // Cops shoot at the car, never at Rex himself.
        if (p.inCar && Math.hypot(p.inCar.x - b.x, p.inCar.y - b.y) < 22) {
          G.vehicles.damageCar(G, p.inCar, b.dmg);
          dead = true;
        }
      }
    }
    if (dead) {
      const i = c.bullets.indexOf(b);
      if (i >= 0) c.bullets.splice(i, 1);
    }
  }
  // Thugs charge the last stretch and swing when they reach Rex. Only the
  // two closest thugs swing at once, so a whole crew cannot stun-lock him.
  for (const t of [...c.thugs]) {
    if (t.hitCd > 0) t.hitCd -= dt;
    if (t.stuckT === undefined) { t.stuckT = 0; t.slideT = 0; t.slideDir = 1; t.lastD = Infinity; }
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 26) {
      let mx = (dx / d) * t.speed * dt;
      let my = (dy / d) * t.speed * dt;
      if (d < t.lastD - 2) { t.lastD = d; t.stuckT = 0; }
      else t.stuckT += dt;
      if (t.stuckT > 1.2 && t.slideT <= 0) {
        t.slideT = 1.0;
        t.slideDir = G.rng.chance(0.5) ? 1 : -1;
        t.stuckT = 0;
      }
      if (t.slideT > 0) {
        t.slideT -= dt;
        const px = -dy / d * t.slideDir;
        const py = dx / d * t.slideDir;
        mx = px * t.speed * dt;
        my = py * t.speed * dt;
      }
      let nx = t.x + mx;
      let ny = t.y + my;
      // The King crew is leashed to the lighthouse sand.
      if (t.leash) {
        nx = Math.max(t.leash.x0 + 10, Math.min(t.leash.x1 - 10, nx));
        ny = Math.max(t.leash.y0 + 10, Math.min(t.leash.y1 - 10, ny));
      }
      const moved = moveCircle(G.world, t.x, t.y, nx - t.x, ny - t.y, 13);
      t.x = moved.x;
      t.y = moved.y;
    } else if (t.hitCd <= 0 && !p.inCar) {
      const closer = c.thugs.filter((o) => o !== t && Math.hypot(o.x - p.x, o.y - p.y) < d + 4).length;
      if (closer < 2) {
        t.hitCd = 1.4;
        hurtPlayer(G, t.king ? 14 : CFG.thugDamage);
      }
    }
  }
  // Health packs.
  for (const pack of [...c.packs]) {
    if (Math.hypot(pack.x - p.x, pack.y - p.y) < 26 && !p.inCar) {
      p.hp = Math.min(CFG.playerHp, p.hp + 30);
      G.audio.pickup();
      const i = c.packs.indexOf(pack);
      if (i >= 0) c.packs.splice(i, 1);
    }
  }
}
