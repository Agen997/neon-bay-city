// Neon Bay 3D — combat: hitscan shooting with tracers, melee, three weapons
// (pistol / SMG / shotgun, keys 1-2-3), Tide King thugs and health packs.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const WEAPONS = [
  { name: 'Pistol', dmg: 34, rate: 0.28, spread: 0.012, pellets: 1, ammo: Infinity, auto: false },
  { name: 'SMG', dmg: 16, rate: 0.09, spread: 0.05, pellets: 1, ammo: 240, auto: true },
  { name: 'Shotgun', dmg: 11, rate: 0.85, spread: 0.15, pellets: 6, ammo: 40, auto: false },
];

function makeThugMesh(king) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(king ? 22 : 16, king ? 20 : 16, 11),
    new THREE.MeshStandardMaterial({ color: king ? CONFIG.colors.king : CONFIG.colors.thug, roughness: 0.8 })
  );
  torso.position.y = king ? 24 : 21;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(king ? 13 : 10, king ? 12 : 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 })
  );
  head.position.y = king ? 40 : 34;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(13, 13, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 })
  );
  legs.position.y = 6.5;
  g.add(torso, head, legs);
  return g;
}

export class CombatSys {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.thugs = [];
    this.tracers = [];
    this.healthPacks = [];
    this.weapons = WEAPONS.map((w) => ({ ...w }));
    this.wi = 0;
    this.cooldown = 0;
    this.meleeCooldown = 0;
    this._tracerGeo = new THREE.BufferGeometry();
    this._tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  }

  weapon() { return this.weapons[this.wi]; }

  switchWeapon(i) {
    if (i >= 0 && i < this.weapons.length) this.wi = i;
  }

  spawnThug(x, y, king = false) {
    const mesh = makeThugMesh(king);
    mesh.position.set(x, 0, y);
    this.scene.add(mesh);
    const t = { x, y, angle: 0, hp: king ? 280 : 50, king, mesh, attackT: 0.5, speed: king ? 120 : 72, wakeT: 2.2 };
    this.thugs.push(t);
    return t;
  }

  clearThugs() {
    for (const t of this.thugs) this.scene.remove(t.mesh);
    this.thugs.length = 0;
  }

  spawnHealthPack(x, y) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(14, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x2aff5a, emissiveIntensity: 0.5 })
    );
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 3),
      new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x2aff5a, emissiveIntensity: 0.8 })
    );
    cross.position.y = 5;
    const pack = new THREE.Group();
    pack.add(m, cross);
    pack.position.set(x, 4, y);
    this.scene.add(pack);
    this.healthPacks.push({ x, y, mesh: pack });
  }

  _tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, 2.5, from.y),
      new THREE.Vector3(to.x, 2.5, to.y),
    ]);
    const line = new THREE.Line(geo, this._tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  // Hitscan shot from the player toward ground point (tx, ty).
  shoot(G, tx, ty) {
    const player = G.player;
    if (this.cooldown > 0 || player.inCar) return;
    const w = this.weapon();
    if (w.ammo !== Infinity && w.ammo <= 0) {
      this.switchWeapon(0); // fall back to the pistol
      return;
    }
    this.cooldown = w.rate;
    if (w.ammo !== Infinity) w.ammo--;
    const baseA = Math.atan2(ty - player.y, tx - player.x);
    let hitAny = false;
    for (let p = 0; p < w.pellets; p++) {
      const a = baseA + (this.rng.next() - 0.5) * 2 * w.spread;
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = null, bestD = 520;
      const targets = [];
      for (const t of this.thugs) targets.push({ x: t.x, y: t.y, r: t.king ? 24 : 18, ref: t, kind: 'thug' });
      for (const c of G.police.cops) targets.push({ x: c.x, y: c.y, r: 16, ref: c, kind: 'cop' });
      for (const tg of targets) {
        const rx = tg.x - player.x, ry = tg.y - player.y;
        const along = rx * dx + ry * dy;
        if (along < 0 || along > bestD) continue;
        const perp = Math.abs(rx * dy - ry * dx);
        if (perp < tg.r + 16) { best = tg; bestD = along; }
      }
      const endX = player.x + dx * (best ? bestD : 480);
      const endY = player.y + dy * (best ? bestD : 480);
      this._tracer(player, { x: endX, y: endY });
      if (best) {
        hitAny = true;
        best.ref.hp -= w.dmg;
        if (best.kind === 'cop') G.police.addWanted(1, G);
        G.audio.hit();
        if (best.ref.hp <= 0) this._kill(best.ref, best.kind, G);
      }
    }
    G.lastShot = { x: player.x, y: player.y, t: G.time };
    if (w.name === 'Shotgun') G.audio.shotgun();
    else if (w.name === 'SMG') G.audio.smgShoot();
    else G.audio.shoot();
    if (hitAny) G.audio.hit();
  }

  _kill(ref, kind, G) {
    if (kind === 'thug') {
      const i = this.thugs.indexOf(ref);
      if (i >= 0) this.thugs.splice(i, 1);
      this.scene.remove(ref.mesh);
      if (!ref.king && this.rng.chance(0.35)) this.spawnHealthPack(ref.x, ref.y);
    } else {
      const i = G.police.cops.indexOf(ref);
      if (i >= 0) G.police.cops.splice(i, 1);
      this.scene.remove(ref.mesh);
    }
  }

  melee(G) {
    const player = G.player;
    if (this.meleeCooldown > 0 || player.inCar) return;
    this.meleeCooldown = 0.45;
    G.audio.melee();
    const px = player.x, py = player.y, pa = player.angle;
    for (const t of [...this.thugs]) {
      const dx = t.x - px, dy = t.y - py;
      const d = Math.hypot(dx, dy);
      if (d < 58) {
        let diff = Math.atan2(dy, dx) - pa;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 1.2) {
          t.hp -= 30;
          t.x += Math.cos(pa) * 26;
          t.y += Math.sin(pa) * 26;
          G.audio.hit();
          if (t.hp <= 0) this._kill(t, 'thug', G);
        }
      }
    }
    for (const c of [...G.police.cops]) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < 58) {
        c.hp -= 30;
        if (c.hp <= 0) this._kill(c, 'cop', G);
        else G.police.addWanted(0.5, G);
      }
    }
  }

  update(dt, G) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    // Tracers fade fast.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // Health pack pickups.
    const player = G.player;
    for (let i = this.healthPacks.length - 1; i >= 0; i--) {
      const p = this.healthPacks[i];
      p.mesh.rotation.y += dt * 2;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 30) {
        player.hp = Math.min(CONFIG.playerHp, player.hp + 30);
        G.audio.pickup();
        this.scene.remove(p.mesh);
        this.healthPacks.splice(i, 1);
      }
    }
    // Thug AI: chase Rex, hit him up close. A fresh crew takes a beat to
    // react, so Rex is never jumped the instant he steps out of the car.
    for (const t of [...this.thugs]) {
      const dx = player.x - t.x, dy = player.y - t.y;
      const d = Math.hypot(dx, dy);
      t.attackT -= dt;
      if (t.wakeT > 0) {
        t.wakeT -= dt;
      } else if (d > 34) {
        const step = Math.min(d, t.speed * dt);
        const np = this.world.moveCircle(t.x, t.y, (dx / (d || 1)) * step, (dy / (d || 1)) * step, 16);
        t.x = np.x; t.y = np.y;
        // The beach crew never leaves the sand.
        if (t.beachBound) {
          const b = CONFIG.beach;
          t.x = Math.max(b.x0 + 16, Math.min(b.x1 - 36, t.x));
          t.y = Math.max(b.y0 + 16, Math.min(b.y1 - 16, t.y));
        }
      } else if (t.attackT <= 0) {
        t.attackT = 0.85;
        if (player.inCar) {
          player.inCar.hp = Math.max(0, player.inCar.hp - (t.king ? 8 : 3));
          if (player.inCar.hp <= 0) player.inCar.wrecked = true;
        } else {
          player.takeDamage(t.king ? 11 : 2);
          if (player.hp <= 0) { G.onBusted(); return; }
        }
        G.audio.hit();
      }
      t.angle = Math.atan2(dy, dx);
      t.mesh.position.set(t.x, 0, t.y);
      t.mesh.rotation.y = -t.angle;
    }
  }
}
