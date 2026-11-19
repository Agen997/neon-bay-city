// Neon Bay 3D — cars: player driving (arcade physics), parked cars to steal,
// and road traffic that follows the grid and turns at junctions.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const { roadCenters, roadHalf } = CONFIG;

function box(w, h, d, color, x, y, z, emissive = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35, emissive, emissiveIntensity: emissive ? 1 : 0 })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const body = box(64, 13, 30, kind === 'cop' ? 0x1a1a22 : color, 0, 9, 0);
  const cabin = box(30, 10, 26, 0x1a2028, -4, 20, 0);
  const lightL = box(3, 4, 6, 0xffe9a8, 32, 9, -9, 0xffe9a8);
  const lightR = box(3, 4, 6, 0xffe9a8, 32, 9, 9, 0xffe9a8);
  const tailL = box(3, 4, 6, 0xc22a2a, -32, 9, -9, 0xc22a2a);
  const tailR = box(3, 4, 6, 0xc22a2a, -32, 9, 9, 0xc22a2a);
  g.add(body, cabin, lightL, lightR, tailL, tailR);
  if (kind === 'cop') {
    const barR = box(10, 4, 8, 0xff2020, -4, 27, -7, 0xff2020);
    const barB = box(10, 4, 8, 0x2040ff, -4, 27, 7, 0x2040ff);
    g.add(barR, barB);
    g.userData.barR = barR;
    g.userData.barB = barB;
    const door = box(20, 8, 1, 0xf0f0f0, 2, 9, 15.2);
    const door2 = box(20, 8, 1, 0xf0f0f0, 2, 9, -15.2);
    g.add(door, door2);
  }
  const wheelGeo = new THREE.CylinderGeometry(9, 9, 6, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  g.userData.wheels = [];
  for (const [wx, wz] of [[20, -15], [20, 15], [-20, -15], [-20, 15]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 9, wz);
    w.castShadow = true;
    g.add(w);
    g.userData.wheels.push(w);
  }
  return g;
}

export class Car {
  constructor(scene, kind, x, y, angle, color) {
    this.kind = kind; // 'parked' | 'traffic' | 'cop' | 'player'
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.hp = kind === 'cop' ? 120 : 100;
    this.owner = null;
    this.wrecked = false;
    this.hitCooldown = 0;
    this.axis = 'x';
    this.dir = 1;
    this.mesh = makeCarMesh(kind, color);
    this.mesh.position.set(x, 0, y);
    this.mesh.rotation.y = -angle;
    scene.add(this.mesh);
  }

  // Arcade step: throttle -1..1, steer -1..1 (positive = turn right).
  driveStep(dt, world, throttle, steer) {
    if (this.wrecked) return;
    const maxF = this.kind === 'cop' ? 440 : CONFIG.carMaxSpeed;
    const maxR = CONFIG.carReverse;
    if (throttle > 0) this.speed = Math.min(maxF, this.speed + CONFIG.carAccel * throttle * dt);
    else if (throttle < 0) this.speed = Math.max(-maxR, this.speed + CONFIG.carAccel * throttle * dt * 0.7);
    else this.speed *= Math.max(0, 1 - 1.6 * dt);
    // Bleed speed in hard turns so corners stay navigable at full throttle.
    if (Math.abs(steer) > 0.4 && this.speed > 260) this.speed = Math.max(260, this.speed - 300 * dt);
    if (Math.abs(this.speed) > 5) {
      this.angle += steer * 3.4 * dt * Math.min(1, Math.abs(this.speed) / 120) * Math.sign(this.speed);
    }
    const dx = Math.cos(this.angle) * this.speed * dt;
    const dy = Math.sin(this.angle) * this.speed * dt;
    const p = world.moveCircle(this.x, this.y, dx, dy, CONFIG.carRadius);
    if (Math.abs(p.x - (this.x + dx)) > 1 || Math.abs(p.y - (this.y + dy)) > 1) {
      this.speed *= 0.85; // scraped a wall, keep sliding
      // Yaw toward the steer while scraping, so the car turns away from the
      // wall instead of wedging nose-first into a corner.
      this.angle += steer * 1.5 * dt;
    }
    this.x = p.x;
    this.y = p.y;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.y);
    this.mesh.rotation.y = -this.angle;
    const spin = this.speed * 0.05;
    for (const w of this.mesh.userData.wheels) w.rotation.y = spin;
    if (this.kind === 'cop') {
      const on = Math.floor(performance.now() / 260) % 2 === 0;
      this.mesh.userData.barR.material.emissiveIntensity = on ? 2.2 : 0.15;
      this.mesh.userData.barB.material.emissiveIntensity = on ? 0.15 : 2.2;
    }
  }
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class VehicleSys {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
  }

  addCar(kind, x, y, angle, color) {
    const c = new Car(this.scene, kind, x, y, angle, color);
    this.cars.push(c);
    return c;
  }

  spawnParked(n) {
    for (let i = 0; i < n; i++) {
      const vertical = this.rng.chance(0.5);
      const c = this.rng.pick(roadCenters);
      const along = this.rng.range(150, 2950);
      const side = this.rng.pick([-1, 1]);
      // Parked on the road near the curb, clear of the buildings.
      const x = vertical ? c + side * 30 : along;
      const y = vertical ? along : c + side * 30;
      const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const car = this.addCar('parked', x, y, angle, this.rng.pick(CONFIG.colors.car));
      car.axis = vertical ? 'y' : 'x';
    }
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const vertical = this.rng.chance(0.5);
      const c = this.rng.pick(roadCenters);
      const along = this.rng.range(150, 2950);
      const dir = this.rng.pick([-1, 1]);
      const x = vertical ? c : along;
      const y = vertical ? along : c;
      const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const car = this.addCar('traffic', x, y, angle, this.rng.pick(CONFIG.colors.car));
      car.axis = vertical ? 'y' : 'x';
      car.dir = dir;
      car.speed = this.rng.range(...CONFIG.trafficSpeed);
    }
  }

  update(dt, G) {
    const player = G.player;
    // Player driving.
    if (player.inCar) {
      const input = G.input;
      const throttle = (input.down('KeyW') ? 1 : 0) + (input.down('KeyS') ? -1 : 0);
      // A = left (angle down), D = right (angle up): standard screen terms.
      const steer = (input.down('KeyD') ? 1 : 0) + (input.down('KeyA') ? -1 : 0);
      player.inCar.driveStep(dt, this.world, throttle, steer);
      player.inCar.hp = Math.max(0, player.inCar.hp);
      if (player.inCar.hp <= 0) player.inCar.wrecked = true;
    }
    // Traffic follows the grid.
    for (const car of this.cars) {
      if (car.kind !== 'traffic' || car.wrecked || car.owner) continue;
      const ncx = this.world.nearestRoadCenter(car.x);
      const ncy = this.world.nearestRoadCenter(car.y);
      const atJunction = Math.abs(car.x - ncx) < 26 && Math.abs(car.y - ncy) < 26;
      if (atJunction && this.rng.chance(dt * 0.45)) {
        // Turn onto the crossing road (snap is small: already at the junction).
        if (car.axis === 'x') { car.y = ncy; car.axis = 'y'; }
        else { car.x = ncx; car.axis = 'x'; }
        car.dir = this.rng.pick([-1, 1]);
      }
      // U-turn at the city edge instead of driving into the beach or the bay.
      if (car.axis === 'x' && ((car.dir > 0 && car.x > 3040) || (car.dir < 0 && car.x < 90))) car.dir *= -1;
      if (car.axis === 'y' && ((car.dir > 0 && car.y > 3040) || (car.dir < 0 && car.y < 90))) car.dir *= -1;
      const desired = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const steer = Math.max(-1, Math.min(1, wrapAngle(desired - car.angle) * 2.2));
      const turning = Math.abs(wrapAngle(desired - car.angle)) > 0.5;
      car.driveStep(dt, this.world, turning ? 0.25 : 0.55, steer);
      // Keep traffic near its cruising speed.
      if (car.speed > 280) car.speed = 280;
      // A traffic car wedged on a corner respawns on a quiet road far away
      // instead of blocking the street forever.
      if (Math.abs(car.speed) < 18) {
        car.stuckT = (car.stuckT || 0) + dt;
        if (car.stuckT > 3) {
          car.stuckT = 0;
          car.x = this.world.nearestRoadCenter(this.rng.range(200, 3000));
          car.y = this.rng.range(200, 3000);
          car.axis = 'y';
          car.dir = this.rng.pick([-1, 1]);
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.speed = 160;
        }
      } else {
        car.stuckT = 0;
      }
    }
    // Car-car separation (simple circles).
    for (const car of this.cars) car.hitCooldown = Math.max(0, car.hitCooldown - dt);
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i], b = this.cars[j];
        if (a.wrecked && b.wrecked) continue;
        // Ambient traffic never deadlocks nose-to-nose: two traffic cars
        // simply pass through each other instead of blocking the road.
        if (a.kind === 'traffic' && b.kind === 'traffic') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 48) {
          const push = (48 - d) / 2;
          const nx = dx / d, ny = dy / d;
          // Push through the same collision the cars drive with, so a shove
          // can never wedge a car inside a building. Parked cars get shoved
          // too — otherwise two of them across a road seal it shut.
          if (!a.wrecked) {
            const p = this.world.moveCircle(a.x, a.y, -nx * push, -ny * push, CONFIG.carRadius);
            a.x = p.x; a.y = p.y;
          }
          if (!b.wrecked) {
            const p = this.world.moveCircle(b.x, b.y, nx * push, ny * push, CONFIG.carRadius);
            b.x = p.x; b.y = p.y;
          }
          if ((a === player.inCar || b === player.inCar) && Math.abs(a.speed) + Math.abs(b.speed) > 260) {
            const pc = a === player.inCar ? a : b;
            // One solid hit at a time, not damage every substep.
            if (pc.hitCooldown <= 0) {
              pc.hitCooldown = 0.6;
              pc.hp = Math.max(0, pc.hp - 6);
              if (pc.hp <= 0) pc.wrecked = true;
            }
          }
        }
      }
    }
    // Player car running over pedestrians.
    if (player.inCar && Math.abs(player.inCar.speed) > 60) {
      for (const p of G.traffic.peds) {
        if (p.down) continue;
        if (Math.hypot(p.x - player.x, p.y - player.y) < 34) {
          p.down = true;
          p.mesh.rotation.x = -Math.PI / 2;
          p.mesh.position.y = 2;
          G.police.addWanted(0.5, G);
        }
      }
    }
    for (const car of this.cars) car.syncMesh();
  }
}
