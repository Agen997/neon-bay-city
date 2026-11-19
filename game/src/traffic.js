// Neon Bay 3D — pedestrians: sidewalk strollers who flee gunfire and go down
// when a car hits them.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const { roadCenters, roadHalf } = CONFIG;
const SHIRTS = [0xd8d8d8, 0x4a8ac2, 0xc24a6a, 0x6ac24a, 0xe8b13c, 0x8a5ac2, 0x3aa8a0];

function makePedMesh(color) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(14, 16, 9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  torso.position.y = 20;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(9, 9, 9),
    new THREE.MeshStandardMaterial({ color: 0xd8a880, roughness: 0.8 })
  );
  head.position.y = 32;
  head.castShadow = true;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(12, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 })
  );
  legs.position.y = 6;
  g.add(torso, head, legs);
  return g;
}

export class TrafficSys {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.peds = [];
  }

  spawn(n) {
    for (let i = 0; i < n; i++) {
      const vertical = this.rng.chance(0.5);
      const c = this.rng.pick(roadCenters);
      const along = this.rng.range(120, 2980);
      const side = this.rng.pick([-1, 1]);
      const x = vertical ? c + side * (roadHalf + 10) : along;
      const y = vertical ? along : c + side * (roadHalf + 10);
      const mesh = makePedMesh(this.rng.pick(SHIRTS));
      mesh.position.set(x, 0, y);
      this.scene.add(mesh);
      this.peds.push({
        x, y, angle: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(28, 55), down: false, downT: 0,
        axis: vertical ? 'y' : 'x', dir: this.rng.pick([-1, 1]), mesh,
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  update(dt, G) {
    const shot = G.lastShot;
    for (const p of this.peds) {
      if (p.down) {
        p.downT += dt;
        if (p.downT > 20) { // get up and walk away
          p.down = false;
          p.downT = 0;
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      let tx = 0, ty = 0;
      // Dodge fast cars bearing down on the sidewalk.
      let danger = null, dangerD = 85;
      for (const c of G.vehicles.cars) {
        if (Math.abs(c.speed) < 70) continue;
        const cd = Math.hypot(p.x - c.x, p.y - c.y);
        if (cd < dangerD) { danger = c; dangerD = cd; }
      }
      if (danger) {
        const d = Math.max(1, dangerD);
        tx = (p.x - danger.x) / d;
        ty = (p.y - danger.y) / d;
        const sp = 165;
        const np = this.world.moveCircle(p.x, p.y, tx * sp * dt, ty * sp * dt, 12);
        p.x = np.x; p.y = np.y;
        p.angle = Math.atan2(ty, tx);
      } else if (shot && Math.hypot(p.x - shot.x, p.y - shot.y) < 420) {
        // Flee the gunfire.
        const d = Math.max(1, Math.hypot(p.x - shot.x, p.y - shot.y));
        tx = (p.x - shot.x) / d;
        ty = (p.y - shot.y) / d;
        const sp = 150;
        const np = this.world.moveCircle(p.x, p.y, tx * sp * dt, ty * sp * dt, 12);
        p.x = np.x; p.y = np.y;
        p.angle = Math.atan2(ty, tx);
      } else {
        // Stroll the sidewalk; turn at junctions sometimes.
        const ncx = this.world.nearestRoadCenter(p.x);
        const ncy = this.world.nearestRoadCenter(p.y);
        const nearJunction = p.axis === 'x'
          ? Math.abs(p.x - ncx) < 20
          : Math.abs(p.y - ncy) < 20;
        if (nearJunction && this.rng.chance(dt * 0.3)) {
          if (p.axis === 'x') {
            p.x = ncx + (p.y - ncy >= 0 ? 54 : -54);
            p.axis = 'y';
          } else {
            p.y = ncy + (p.x - ncx >= 0 ? 54 : -54);
            p.axis = 'x';
          }
          p.dir = this.rng.pick([-1, 1]);
        }
        const dx = p.axis === 'x' ? p.dir * p.speed * dt : 0;
        const dy = p.axis === 'y' ? p.dir * p.speed * dt : 0;
        const np = this.world.moveCircle(p.x, p.y, dx, dy, 12);
        if (Math.abs(np.x - (p.x + dx)) > 1 || Math.abs(np.y - (p.y + dy)) > 1) p.dir *= -1;
        p.x = np.x; p.y = np.y;
        p.angle = Math.atan2(dy, dx);
      }
      p.mesh.position.set(p.x, 0, p.y);
      p.mesh.rotation.y = -p.angle;
      p.mesh.position.y = Math.abs(Math.sin(G.time * 6 + p.phase)) * 1.2;
    }
  }
}
