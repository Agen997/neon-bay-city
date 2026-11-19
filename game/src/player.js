// Neon Bay 3D — Rex Marlowe on foot: camera-relative WASD movement, run, and
// entering/exiting cars. The mesh is a small box figure; it hides while driving.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export class Player {
  constructor(scene) {
    this.x = CONFIG.garage.x;
    this.y = CONFIG.garage.y;
    this.angle = 0;
    this.hp = CONFIG.playerHp;
    this.money = 0;
    this.inCar = null;
    this.walkPhase = 0;
    const g = new THREE.Group();
    this.legL = box(6, 13, 7, 0x2a2a33, -4, 6.5, 0);
    this.legR = box(6, 13, 7, 0x2a2a33, 4, 6.5, 0);
    this.torso = box(17, 16, 10, 0x2a7a6a, 0, 21, 0);
    this.head = box(10, 10, 10, 0xd8a880, 0, 34, 0);
    this.armL = box(5, 14, 5, 0x2a7a6a, -11, 21, 0);
    this.armR = box(5, 14, 5, 0x2a7a6a, 11, 21, 0);
    g.add(this.legL, this.legR, this.torso, this.head, this.armL, this.armR);
    this.mesh = g;
    scene.add(g);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.hp = CONFIG.playerHp;
    this.inCar = null;
    this.mesh.visible = true;
  }

  takeDamage(n) {
    this.hp = Math.max(0, this.hp - n);
  }

  enterCar(car) {
    this.inCar = car;
    car.owner = 'player';
    car.hp = Math.max(car.hp, 300);
    this.mesh.visible = false;
  }

  exitCar(world) {
    const car = this.inCar;
    if (!car) return;
    this.inCar = null;
    car.owner = null;
    const bx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    const by = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    const p = world.moveCircle(car.x, car.y, bx - car.x, by - car.y, CONFIG.playerRadius);
    this.x = p.x;
    this.y = p.y;
    this.angle = car.angle;
    this.mesh.visible = true;
  }

  update(dt, G) {
    if (this.inCar) {
      this.x = this.inCar.x;
      this.y = this.inCar.y;
      this.angle = this.inCar.angle;
      return;
    }
    const input = G.input;
    const yaw = G.render.yaw;
    const fx = -Math.sin(yaw), fy = -Math.cos(yaw); // camera forward on the ground
    const rx = -fy, ry = fx; // camera right
    let mx = 0, my = 0;
    if (input.down('KeyW')) { mx += fx; my += fy; }
    if (input.down('KeyS')) { mx -= fx; my -= fy; }
    if (input.down('KeyD')) { mx += rx; my += ry; }
    if (input.down('KeyA')) { mx -= rx; my -= ry; }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const nx = (mx / len) * speed * dt;
      const ny = (my / len) * speed * dt;
      const p = G.world.moveCircle(this.x, this.y, nx, ny, CONFIG.playerRadius);
      this.x = p.x;
      this.y = p.y;
      this.angle = Math.atan2(my, mx);
      this.walkPhase += dt * speed * 0.09;
      const s = Math.sin(this.walkPhase) * 0.5;
      this.legL.rotation.x = s;
      this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.7;
      this.armR.rotation.x = s * 0.7;
    } else {
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      this.armL.rotation.x = 0;
      this.armR.rotation.x = 0;
    }
    this.mesh.position.set(this.x, 0, this.y);
    this.mesh.rotation.y = -this.angle;
  }
}
