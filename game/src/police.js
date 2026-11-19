// Neon Bay 3D — wanted stars, NBPD foot cops and cruisers, the police helicopter
// and roadblocks at high wanted. Wanted decays when Rex lays low.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const { roadCenters, roadHalf } = CONFIG;

function makeCopMesh() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(16, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 })
  );
  torso.position.y = 21;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(10, 9, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a880, roughness: 0.8 })
  );
  head.position.y = 33;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(11, 4, 11),
    new THREE.MeshStandardMaterial({ color: 0x10203a, roughness: 0.7 })
  );
  cap.position.y = 39;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(13, 13, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 })
  );
  legs.position.y = 6.5;
  g.add(torso, head, cap, legs);
  return g;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(40, 14, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.4 })
  );
  body.position.y = 0;
  body.castShadow = true;
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(30, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.4 })
  );
  tail.position.set(-34, 2, 0);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(70, 1.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  rotor.position.y = 10;
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(26, 130, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  spot.geometry.rotateX(Math.PI);
  spot.position.y = -72;
  g.add(body, tail, rotor, spot);
  g.userData.rotor = rotor;
  return g;
}

export class PoliceSys {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.wanted = 0;
    this.lastCrimeT = -100;
    this.cops = [];
    this.cruisers = [];
    this.heli = null;
    this.heliAngle = 0;
    this.roadblock = null;
    this.roadblockT = 0;
    this.arrestT = 0;
    this.ramCooldown = 0;
  }

  addWanted(n, G) {
    this.wanted = Math.min(5, this.wanted + n);
    this.lastCrimeT = G.time;
  }

  stars() { return Math.ceil(this.wanted - 0.001); }

  _spawnPointNear(player, minD, maxD) {
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(minD, maxD);
      const x = player.x + Math.cos(a) * d;
      const y = player.y + Math.sin(a) * d;
      if (x < 40 || x > 3400 || y < 40 || y > 3060) continue;
      if (this.world._blocked(x, y, 20)) continue;
      return { x, y };
    }
    return { x: player.x + 300, y: player.y };
  }

  spawnCop(G) {
    const p = this._spawnPointNear(G.player, 260, 480);
    const mesh = makeCopMesh();
    mesh.position.set(p.x, 0, p.y);
    this.scene.add(mesh);
    this.cops.push({ x: p.x, y: p.y, angle: 0, hp: 40, mesh, shootT: 0 });
  }

  spawnCruiser(G) {
    const p = this._spawnPointNear(G.player, 320, 520);
    const c = G.vehicles.addCar('cop', p.x, p.y, 0, 0x1a1a22);
    c.hp = 120;
    this.cruisers.push(c);
    return c;
  }

  _makeRoadblock(G) {
    const p = G.player;
    // Block the road ahead of the player's heading.
    const ahead = p.inCar ? p.inCar.angle : p.angle;
    const bx = p.x + Math.cos(ahead) * 380;
    const by = p.y + Math.sin(ahead) * 380;
    const perp = ahead + Math.PI / 2;
    const cars = [];
    for (const off of [-46, 46]) {
      const x = bx + Math.cos(perp) * off;
      const y = by + Math.sin(perp) * off;
      const car = G.vehicles.addCar('cop', x, y, perp, 0x1a1a22);
      car.speed = 0;
      cars.push(car);
    }
    this.roadblock = { cars, x: bx, y: by };
    this.roadblockT = 14;
  }

  update(dt, G) {
    const player = G.player;
    // Wanted decay after laying low.
    if (G.time - this.lastCrimeT > CONFIG.wantedDecayDelay && this.wanted > 0) {
      this.wanted = Math.max(0, this.wanted - CONFIG.wantedDecayRate * dt);
    }
    const w = this.wanted;
    // Foot cops: 0 at wanted 0, up to 8.
    const wantCops = w < 1 ? 0 : Math.min(8, 2 + Math.floor(w));
    while (this.cops.length < wantCops) this.spawnCop(G);
    while (this.cops.length > wantCops) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
    // Cruisers: 0 at wanted 0, up to 4.
    const wantCruisers = w < 1 ? 0 : Math.min(4, Math.floor(w));
    while (this.cruisers.length < wantCruisers) this.spawnCruiser(G);
    while (this.cruisers.length > wantCruisers) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
      const i = G.vehicles.cars.indexOf(c);
      if (i >= 0) G.vehicles.cars.splice(i, 1);
    }
    // Helicopter at wanted 4+.
    if (w >= 4 && !this.heli) {
      this.heli = makeHeliMesh();
      this.scene.add(this.heli);
      this.heliAngle = 0;
    }
    if (w < 3.5 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
    if (this.heli) {
      this.heliAngle += dt * 0.55;
      const hx = player.x + Math.cos(this.heliAngle) * 130;
      const hy = player.y + Math.sin(this.heliAngle) * 130;
      this.heli.position.set(hx, 150, hy);
      this.heli.rotation.y = -Math.atan2(player.y - hy, player.x - hx);
      this.heli.userData.rotor.rotation.y += dt * 22;
    }
    // Roadblock at wanted 4+.
    if (w >= 4) {
      this.roadblockT -= dt;
      const rb = this.roadblock;
      const stale = rb && (Math.hypot(player.x - rb.x, player.y - rb.y) < 90 || rb.cars.some((c) => c.wrecked));
      if ((!rb || stale || this.roadblockT <= 0) && this.roadblockT <= 0) {
        if (rb) {
          for (const c of rb.cars) {
            const i = G.vehicles.cars.indexOf(c);
            if (i >= 0 && !c.wrecked) { G.vehicles.cars.splice(i, 1); this.scene.remove(c.mesh); }
          }
        }
        this._makeRoadblock(G);
      }
    } else if (this.roadblock) {
      for (const c of this.roadblock.cars) {
        const i = G.vehicles.cars.indexOf(c);
        if (i >= 0 && !c.wrecked) { G.vehicles.cars.splice(i, 1); this.scene.remove(c.mesh); }
      }
      this.roadblock = null;
    }
    // Foot cop AI: chase, arrest on foot, shoot the car.
    this.ramCooldown -= dt;
    let nearestCop = Infinity;
    for (const c of this.cops) {
      const dx = player.x - c.x, dy = player.y - c.y;
      const d = Math.hypot(dx, dy);
      nearestCop = Math.min(nearestCop, d);
      const speed = player.inCar ? 210 : 195;
      const step = Math.min(d, speed * dt);
      const np = this.world.moveCircle(c.x, c.y, (dx / (d || 1)) * step, (dy / (d || 1)) * step, 12);
      c.x = np.x; c.y = np.y;
      c.angle = Math.atan2(dy, dx);
      c.mesh.position.set(c.x, 0, c.y);
      c.mesh.rotation.y = -c.angle;
      if (player.inCar && d < 320) {
        c.shootT -= dt;
        if (c.shootT <= 0) {
          c.shootT = 1.1;
          player.inCar.hp = Math.max(0, player.inCar.hp - 2);
          if (player.inCar.hp <= 0) player.inCar.wrecked = true;
        }
      }
    }
    // Arrest: a cop within 26 of Rex on foot for 1.2s.
    if (!player.inCar && nearestCop < 26) {
      this.arrestT += dt;
      if (this.arrestT > 1.2) {
        this.arrestT = 0;
        G.onBusted();
        return;
      }
    } else {
      this.arrestT = 0;
    }
    // Cruiser AI: chase and ram.
    for (const c of this.cruisers) {
      if (c.wrecked) continue;
      const dx = player.x - c.x, dy = player.y - c.y;
      const d = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      let diff = desired - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      c.driveStep(dt, this.world, 1, steer);
      if (d < 52 && this.ramCooldown <= 0) {
        this.ramCooldown = 1.1;
        if (player.inCar) {
          player.inCar.hp = Math.max(0, player.inCar.hp - 4);
          if (player.inCar.hp <= 0) player.inCar.wrecked = true;
        } else {
          player.takeDamage(8);
          if (player.hp <= 0) G.onBusted();
        }
        G.audio.hit();
      }
    }
    // Player wrecked car while wanted: force him out on foot.
    if (player.inCar && player.inCar.wrecked) {
      player.exitCar(this.world);
    }
  }
}
