// Combat: fists and three guns (hitscan from the camera with tracers, muzzle flash and
// impact puffs), pickups for cash/health/armor/weapons, crime reporting to the wanted
// system, and the Tide Kings' AI — henchmen and their boss shoot back.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { G, playerPos, toast } from './state.js';
import { clamp } from './rng.js';
import { animateWalk, makePerson, scarePeds } from './actors.js';
import { collide } from './city.js';
import { damagePlayer } from './player.js';
import { addStars } from './police.js';
import { sfx } from './audio.js';
import { pickupTexture } from './textures.js';

const MAX_PARTICLES = 420;
let points = null;
let pPos = null;
let pCol = null;
const pVel = new Float32Array(MAX_PARTICLES * 3);
const pLife = new Float32Array(MAX_PARTICLES);
let pCursor = 0;
const tracers = [];
let muzzleLight = null;
let lastShotHeard = -99;
let lastCopHit = -99;

export function initCombat() {
  pPos = new Float32Array(MAX_PARTICLES * 3);
  pCol = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i += 1) pPos[i * 3 + 1] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  points.frustumCulled = false;
  G.scene.add(points);
  for (let i = 0; i < 24; i += 1) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
    line.frustumCulled = false;
    G.scene.add(line);
    tracers.push({ line, life: 0 });
  }
  muzzleLight = new THREE.PointLight(0xffc36b, 0, 18, 1.6);
  G.scene.add(muzzleLight);
}

function puff(x, y, z, color, count, speed = 2.2, up = 1.6) {
  const c = new THREE.Color(color);
  for (let n = 0; n < count; n += 1) {
    const i = pCursor;
    pCursor = (pCursor + 1) % MAX_PARTICLES;
    pPos[i * 3] = x;
    pPos[i * 3 + 1] = y;
    pPos[i * 3 + 2] = z;
    pVel[i * 3] = (Math.random() - 0.5) * speed * 2;
    pVel[i * 3 + 1] = Math.random() * up;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * speed * 2;
    pCol[i * 3] = c.r;
    pCol[i * 3 + 1] = c.g;
    pCol[i * 3 + 2] = c.b;
    pLife[i] = 0.5 + Math.random() * 0.4;
  }
}

function tracer(from, to) {
  const t = tracers.find((tr) => tr.life <= 0) || tracers[0];
  const attr = t.line.geometry.getAttribute('position');
  attr.setXYZ(0, from.x, from.y, from.z);
  attr.setXYZ(1, to.x, to.y, to.z);
  attr.needsUpdate = true;
  t.line.material.opacity = 0.85;
  t.life = 0.07;
}

export function spawnPickup(kind, x, z, amount = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.72, 0.72),
    new THREE.MeshBasicMaterial({ map: pickupTexture(kind) }),
  );
  mesh.position.set(x, 1.05, z);
  G.scene.add(mesh);
  G.pickups.push({ kind, mesh, amount, phase: Math.random() * 6 });
}

export function spawnStaticPickups() {
  spawnPickup('pistol', -188, -8);
  spawnPickup('health', 50, -150);
  spawnPickup('health', -190, 40);
  spawnPickup('armor', -52, 112);
  spawnPickup('smg', 102, 98);
  spawnPickup('shotgun', -200, 160);
  spawnPickup('cash', 0, 0, 25);
  spawnPickup('cash', 150, -150, 40);
  spawnPickup('cash', -100, 60, 30);
}

function applyPickup(pickup) {
  const player = G.player;
  if (pickup.kind === 'cash') {
    player.cash += pickup.amount || 20;
    sfx.cash();
    toast(`+$${pickup.amount || 20}`, 1.4);
  } else if (pickup.kind === 'health') {
    player.hp = Math.min(100, player.hp + 45);
    sfx.pickup();
    toast('Health +45', 1.4);
  } else if (pickup.kind === 'armor') {
    player.armor = Math.min(100, player.armor + 60);
    sfx.pickup();
    toast('Armor +60', 1.4);
  } else {
    const ammo = { pistol: 36, smg: 90, shotgun: 18 }[pickup.kind] || 12;
    player.ammo[pickup.kind] = (player.ammo[pickup.kind] || 0) + ammo;
    player.weapon = pickup.kind;
    sfx.pickup();
    toast(`${WEAPONS[pickup.kind].name} +${ammo} ammo`, 1.8);
  }
}

export function damagePed(ped, dmg, byPlayer) {
  if (ped.state === 'dead') return;
  ped.hp -= dmg;
  const p = ped.mesh.position;
  puff(p.x, 1.2, p.z, 0xc23b3b, 5, 1.6, 1.2);
  if (ped.hp <= 0) {
    ped.state = 'dead';
    ped.deadT = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    if (byPlayer && !ped.gang && !ped.boss) {
      addStars(1, 'a pedestrian is down');
      if (ped.cash > 0 && Math.random() < 0.7) spawnPickup('cash', p.x, p.z, ped.cash);
    }
    if (ped.boss) {
      G.boss = null;
      sfx.missionDone();
    }
  } else if (!ped.gang && !ped.boss) {
    ped.state = 'flee';
    ped.fleeFrom = { x: playerPos().x, z: playerPos().z };
    ped.fleeT = 3;
  }
}

function damageCar(car, dmg, byPlayer) {
  if (car.dead) return;
  car.hp -= dmg;
  const p = car.mesh.position;
  puff(p.x, 0.8, p.z, 0xffa53b, 4, 2, 1.4);
  if (car.police && byPlayer && G.time - lastCopHit > 4) {
    lastCopHit = G.time;
    addStars(1, 'you shot at the NBPD');
  }
  if (car.hp <= 0) {
    car.dead = true;
    car.speed = 0;
    if (car.police) {
      car.active = false;
      car.driver = null;
      if (byPlayer) addStars(1, 'a patrol car is wrecked');
    } else {
      car.driver = null;
    }
    puff(p.x, 1, p.z, 0x555555, 16, 2.4, 2.6);
    sfx.crash();
  }
}

const rayDir = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
const tmpV = new THREE.Vector3();

function raySphere(origin, dir, center, radius) {
  tmpV.copy(center).sub(origin);
  const t = tmpV.dot(dir);
  if (t < 0) return -1;
  const closest = tmpV.addScaledVector(dir, -t);
  return closest.length() <= radius ? t : -1;
}

function reportGunshot() {
  // Gunfire draws the NBPD if a patrol is anywhere near.
  if (G.time - lastShotHeard < 6) return;
  const pp = playerPos();
  for (const cop of G.police) {
    if (!cop.active) continue;
    if (cop.mesh.position.distanceTo(pp) < 75) {
      lastShotHeard = G.time;
      addStars(1, 'shots fired');
      return;
    }
  }
}

export function shoot() {
  const player = G.player;
  const weapon = WEAPONS[player.weapon];
  if (!weapon || player.fireCd > 0 || player.inCar) return;
  player.fireCd = weapon.rate;
  const pp = player.mesh.position;
  if (weapon.melee) {
    sfx.melee();
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    for (const ped of G.peds) {
      if (ped.state === 'dead') continue;
      const p = ped.mesh.position;
      const dx = p.x - pp.x;
      const dz = p.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d < weapon.range && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        damagePed(ped, weapon.dmg, true);
        p.x += fx * 0.8;
        p.z += fz * 0.8;
        sfx.hit();
        return;
      }
    }
    return;
  }
  if ((player.ammo[player.weapon] || 0) <= 0) {
    toast('Out of ammo — fists it is. (1)', 1.6);
    player.weapon = 'fists';
    return;
  }
  player.ammo[player.weapon] -= 1;
  G.shots += 1;
  sfx.shoot(player.weapon);
  reportGunshot();
  scarePeds(pp.x, pp.z, 26);
  G.camera.getWorldDirection(rayDir);
  rayOrigin.copy(G.camera.position);
  const muzzle = new THREE.Vector3(pp.x, 1.35, pp.z);
  muzzleLight.position.copy(muzzle);
  muzzleLight.intensity = 26;
  const pellets = weapon.pellets || 1;
  for (let pellet = 0; pellet < pellets; pellet += 1) {
    const dir = rayDir.clone();
    dir.x += (Math.random() - 0.5) * weapon.spread * 2;
    dir.y += (Math.random() - 0.5) * weapon.spread * 2;
    dir.z += (Math.random() - 0.5) * weapon.spread * 2;
    dir.normalize();
    let bestT = weapon.range;
    let hitPed = null;
    let hitCar = null;
    for (const ped of G.peds) {
      if (ped.state === 'dead') continue;
      const center = tmpV.set(ped.mesh.position.x, 1.05, ped.mesh.position.z).clone();
      const t = raySphere(rayOrigin, dir, center, ped.boss ? 1.25 : 0.9);
      if (t > 0 && t < bestT) {
        bestT = t;
        hitPed = ped;
        hitCar = null;
      }
    }
    for (const car of G.cars) {
      if (car === player.inCar || car.dead) continue;
      if (car.police && !car.active) continue;
      const center = new THREE.Vector3(car.mesh.position.x, 0.75, car.mesh.position.z);
      const t = raySphere(rayOrigin, dir, center, 2.3);
      if (t > 0 && t < bestT) {
        bestT = t;
        hitCar = car;
        hitPed = null;
      }
    }
    const end = rayOrigin.clone().addScaledVector(dir, bestT);
    tracer(muzzle, end);
    if (hitPed) damagePed(hitPed, weapon.dmg, true);
    else if (hitCar) damageCar(hitCar, weapon.dmg, true);
    else puff(end.x, Math.max(0.2, end.y), end.z, 0xcfc4b0, 2, 0.8, 0.6);
  }
}

export function spawnGang(x, z, count, withBoss = false) {
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const { group, parts } = makePerson(0x2ec4b6, 0x24304d, 0xc98d5e);
    group.position.set(x + (i - count / 2) * 3, 0, z + (i % 2) * 3);
    G.scene.add(group);
    const ped = {
      mesh: group,
      parts,
      hp: 60,
      yaw: Math.PI,
      phase: Math.random() * 6,
      state: 'gang',
      target: null,
      fleeT: 0,
      fleeFrom: null,
      cash: 0,
      gang: true,
      boss: false,
      shootCd: 0.6 + Math.random(),
      deadT: 0,
    };
    G.peds.push(ped);
    G.gang.push(ped);
    made.push(ped);
  }
  if (withBoss) {
    const { group, parts } = makePerson(0x0e7c86, 0x14161a, 0x8a5a3b, 1.28);
    group.position.set(x, 0, z - 6);
    G.scene.add(group);
    const boss = {
      mesh: group,
      parts,
      hp: 340,
      yaw: Math.PI,
      phase: 0,
      state: 'gang',
      target: null,
      fleeT: 0,
      fleeFrom: null,
      cash: 0,
      gang: true,
      boss: true,
      shootCd: 1,
      deadT: 0,
    };
    G.peds.push(boss);
    G.gang.push(boss);
    G.boss = { ped: boss, maxHp: 340 };
    made.push(boss);
  }
  return made;
}

function updateGang(dt) {
  const pp = playerPos();
  for (const ped of G.gang) {
    if (ped.state === 'dead') continue;
    const p = ped.mesh.position;
    const dist = Math.hypot(pp.x - p.x, pp.z - p.z);
    const aggro = dist < 46 && G.screen === 'play';
    if (!aggro) {
      animateWalk(ped.parts, ped.phase, 0);
      continue;
    }
    ped.yaw = Math.atan2(pp.x - p.x, pp.z - p.z);
    ped.mesh.rotation.y = ped.yaw;
    // Keep a fighting distance: close in when far, hold ground when near.
    let speed = 0;
    if (dist > 16) speed = ped.boss ? 3.4 : 3.8;
    else if (dist < 7) speed = -1.6;
    p.x += Math.sin(ped.yaw) * speed * dt;
    p.z += Math.cos(ped.yaw) * speed * dt;
    collide(p, 0.55);
    ped.phase += Math.abs(speed) * dt * 2.4;
    animateWalk(ped.parts, ped.phase, clamp(Math.abs(speed) / 4, 0.15, 1));
    ped.parts.armR.rotation.x = -1.4;
    ped.shootCd -= dt;
    if (ped.shootCd <= 0 && dist < 42) {
      ped.shootCd = ped.boss ? 0.95 : 0.75 + Math.random() * 0.6;
      sfx.shoot('pistol');
      const from = new THREE.Vector3(p.x, 1.35, p.z);
      const hitChance = clamp(0.52 - dist * 0.008, 0.14, 0.5);
      const target = new THREE.Vector3(pp.x, 1.1, pp.z);
      if (Math.random() < hitChance) {
        damagePlayer(ped.boss ? 11 : 6);
      } else {
        target.x += (Math.random() - 0.5) * 3;
        target.z += (Math.random() - 0.5) * 3;
      }
      tracer(from, target);
      scarePeds(p.x, p.z, 20);
    }
  }
}

function updateParticles(dt) {
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) {
      pPos[i * 3 + 1] = -100;
      continue;
    }
    pVel[i * 3 + 1] -= 3.2 * dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  points.geometry.getAttribute('position').needsUpdate = true;
  points.geometry.getAttribute('color').needsUpdate = true;
  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
    }
  }
  if (muzzleLight && muzzleLight.intensity > 0) {
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 320);
  }
}

function updatePickups(dt) {
  const pp = playerPos();
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = G.pickups[i];
    pickup.phase += dt * 2.4;
    pickup.mesh.rotation.y += dt * 2.2;
    pickup.mesh.position.y = 1.05 + Math.sin(pickup.phase) * 0.16;
    const p = pickup.mesh.position;
    if (Math.hypot(pp.x - p.x, pp.z - p.z) < 1.7) {
      applyPickup(pickup);
      G.scene.remove(pickup.mesh);
      G.pickups.splice(i, 1);
    }
  }
}

export function updateCombat(dt) {
  updateParticles(dt);
  updatePickups(dt);
  updateGang(dt);
  // Wrecked cars smoulder.
  for (const car of G.cars) {
    if (car.dead && Math.random() < dt * 2) {
      const p = car.mesh.position;
      puff(p.x, 1.2, p.z, 0x444444, 1, 0.4, 1.8);
    }
  }
}
