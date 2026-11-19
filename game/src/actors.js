// Everything that moves and is not the player: box-built people with swinging limbs, cars
// with spinning wheels, traffic that follows the road grid, pedestrians who stroll the
// sidewalks and flee trouble, and the NBPD helicopter. Police chase logic lives in
// police.js; this file only builds bodies and runs the ambient crowd.
import * as THREE from 'three';
import { CAR_COLORS, PED_COLORS, PLACES, WORLD } from './config.js';
import { G } from './state.js';
import { angleDelta, clamp, int, pick, range } from './rng.js';
import { collide, roadLines } from './city.js';
import { policeTexture } from './textures.js';

const SKIN = [0xf2c49b, 0xc98d5e, 0x8a5a3b, 0xffdbb4];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A low-poly person: torso, head, and limbs pivoted at hip/shoulder for the walk cycle. */
export function makePerson(shirt, pants, skin = 0xf2c49b, scale = 1) {
  const group = new THREE.Group();
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.12, 0);
  group.add(torso);
  const head = box(0.34, 0.36, 0.34, skin, 0, 1.68, 0);
  group.add(head);
  const hair = box(0.37, 0.12, 0.37, 0x2b2118, 0, 1.9, 0);
  group.add(hair);
  function limb(w, h, d, color, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = box(w, h, d, color, 0, -h / 2, 0);
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  }
  const legL = limb(0.2, 0.78, 0.22, pants, -0.16, 0.78);
  const legR = limb(0.2, 0.78, 0.22, pants, 0.16, 0.78);
  const armL = limb(0.15, 0.66, 0.17, shirt, -0.4, 1.42);
  const armR = limb(0.15, 0.66, 0.17, shirt, 0.4, 1.42);
  group.scale.setScalar(scale);
  return { group, parts: { legL, legR, armL, armR, torso, head } };
}

export function animateWalk(parts, phase, amount) {
  const swing = Math.sin(phase) * 0.75 * amount;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8;
  parts.armR.rotation.x = swing * 0.8;
}

/** A car body with cabin, wheels and (for police) a flashing light bar and NBPD doors. */
export function makeCarMesh(color, { police = false, sports = false } = {}) {
  const group = new THREE.Group();
  const bodyColor = police ? 0x1c2434 : color;
  const body = box(1.9, 0.55, sports ? 4.4 : 4.2, bodyColor, 0, 0.55, 0);
  group.add(body);
  const cabin = box(1.7, 0.5, sports ? 1.9 : 2.1, police ? 0xf4f1ea : 0x22242c, 0, 1.05, sports ? 0.25 : -0.1);
  group.add(cabin);
  if (police) {
    const doorTex = policeTexture();
    const doorMat = new THREE.MeshBasicMaterial({ map: doorTex });
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.62), doorMat);
      door.position.set(side * 0.96, 0.58, 0);
      door.rotation.y = side * (Math.PI / 2);
      group.add(door);
    }
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  for (const side of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    h.position.set(side * 0.6, 0.62, (sports ? 2.2 : 2.1) + 0.02);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat);
    t.position.set(side * 0.6, 0.66, -(sports ? 2.2 : 2.1) - 0.02);
    group.add(t);
  }
  let lightbar = null;
  if (police) {
    lightbar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.34), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
    red.position.set(-0.38, 1.42, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.34), new THREE.MeshBasicMaterial({ color: 0x2d7bff }));
    blue.position.set(0.38, 1.42, -0.1);
    lightbar.add(red, blue);
    lightbar.userData = { red, blue };
    group.add(lightbar);
  }
  return { group, wheels, lightbar };
}

function newCar(color, opts = {}) {
  const { group, wheels, lightbar } = makeCarMesh(color, opts);
  const car = {
    mesh: group,
    wheels,
    lightbar,
    yaw: 0,
    speed: 0,
    steer: 0,
    kind: opts.kind || 'parked',
    driver: null,
    hp: 120,
    sports: !!opts.sports,
    police: !!opts.police,
    ai: { wp: null, stuckT: 0, reverseT: 0 },
    sirenPhase: Math.random() * Math.PI,
  };
  G.scene.add(group);
  G.cars.push(car);
  return car;
}

function randomRoadSpawn() {
  const lines = roadLines();
  const axis = G.rng() < 0.5 ? 'x' : 'z';
  const line = pick(G.rng, lines);
  const along = range(G.rng, -220, 220);
  return axis === 'x' ? { x: along, z: line } : { x: line, z: along };
}

export function spawnTraffic(count) {
  for (let i = 0; i < count; i += 1) {
    const car = newCar(pick(G.rng, CAR_COLORS), { kind: 'traffic' });
    const s = randomRoadSpawn();
    car.mesh.position.set(s.x, 0, s.z);
    car.driver = 'ai';
    car.yaw = G.rng() < 0.5 ? 0 : Math.PI;
    car.ai.wp = nextWaypoint(car);
  }
}

export function spawnParked() {
  const spots = [
    { x: PLACES.pickupCar.x, z: PLACES.pickupCar.z, yaw: 0.4, mission: 'pickup' },
    { x: PLACES.sportsCar.x, z: PLACES.sportsCar.z, yaw: -0.7, mission: 'sports', sports: true },
    { x: -186, z: 34, yaw: Math.PI / 2 },
    { x: -186, z: -44, yaw: Math.PI / 2 },
    { x: 30, z: -186, yaw: 0 },
    { x: -30, z: 186, yaw: Math.PI },
    { x: 186, z: 60, yaw: Math.PI / 2 },
    { x: -120, z: -186, yaw: 0.2 },
    { x: 90, z: 120, yaw: 1.2 },
    { x: -90, z: -120, yaw: -0.4 },
    { x: 160, z: -40, yaw: 0.9 },
    { x: -160, z: 90, yaw: 2.4 },
  ];
  for (const s of spots) {
    const car = newCar(s.sports ? 0xf15bb5 : pick(G.rng, CAR_COLORS), { kind: 'parked', sports: s.sports });
    car.mesh.position.set(s.x, 0, s.z);
    car.yaw = s.yaw;
    car.mesh.rotation.y = s.yaw;
    if (s.mission) car.missionTag = s.mission;
  }
}

function nextWaypoint(car) {
  const lines = roadLines();
  const p = car.mesh.position;
  // nearest intersection centre
  let ix = lines[0];
  let iz = lines[0];
  for (const l of lines) {
    if (Math.abs(l - p.x) < Math.abs(ix - p.x)) ix = l;
    if (Math.abs(l - p.z) < Math.abs(iz - p.z)) iz = l;
  }
  const options = [
    { x: ix + WORLD.roadStep, z: iz },
    { x: ix - WORLD.roadStep, z: iz },
    { x: ix, z: iz + WORLD.roadStep },
    { x: ix, z: iz - WORLD.roadStep },
  ].filter((o) => Math.abs(o.x) <= 225 && Math.abs(o.z) <= 225);
  // prefer continuing roughly straight
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  options.sort((a, b) => {
    const da = (a.x - p.x) * fx + (a.z - p.z) * fz + G.rng() * 30;
    const db = (b.x - p.x) * fx + (b.z - p.z) * fz + G.rng() * 30;
    return db - da;
  });
  const target = options[0];
  // offset into the right-hand lane for the direction of travel
  const dx = target.x - ix;
  const dz = target.z - iz;
  if (dx !== 0) return { x: target.x, z: target.z + 3 * Math.sign(dx) };
  return { x: target.x - 3 * Math.sign(dz), z: target.z };
}

export function updateTraffic(dt) {
  for (const car of G.cars) {
    if (car.driver !== 'ai') continue;
    const p = car.mesh.position;
    if (!car.ai.wp) car.ai.wp = nextWaypoint(car);
    const wp = car.ai.wp;
    const dx = wp.x - p.x;
    const dz = wp.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) {
      car.ai.wp = nextWaypoint(car);
      continue;
    }
    const desired = Math.atan2(dx, dz);
    const turn = clamp(angleDelta(car.yaw, desired), -1.6 * dt, 1.6 * dt);
    car.yaw += turn;
    // slow for anything just ahead
    let targetSpeed = 11;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const pp = G.player.mesh.position;
    const toPlayer = (pp.x - p.x) * fx + (pp.z - p.z) * fz;
    if (toPlayer > 0 && toPlayer < 9 && Math.hypot(pp.x - p.x, pp.z - p.z) < 9) targetSpeed = 0;
    for (const other of G.cars) {
      if (other === car) continue;
      const op = other.mesh.position;
      const ahead = (op.x - p.x) * fx + (op.z - p.z) * fz;
      if (ahead > 0 && ahead < 8 && Math.hypot(op.x - p.x, op.z - p.z) < 8) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 1));
        break;
      }
    }
    car.speed += clamp(targetSpeed - car.speed, -18 * dt, 6 * dt);
    p.x += fx * car.speed * dt;
    p.z += fz * car.speed * dt;
    collide(p, 2.0);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  }
}

export function spawnPeds(count) {
  for (let i = 0; i < count; i += 1) {
    const { group, parts } = makePerson(pick(G.rng, PED_COLORS), pick(G.rng, [0x3a4a6b, 0x5a4a3a, 0x2e2e38, 0x6b3a4a]), pick(G.rng, SKIN));
    const s = randomRoadSpawn();
    group.position.set(s.x + range(G.rng, -8, 8), 0, s.z + range(G.rng, -8, 8));
    G.scene.add(group);
    G.peds.push({
      mesh: group,
      parts,
      hp: 30,
      yaw: G.rng() * Math.PI * 2,
      phase: G.rng() * 6,
      state: 'walk',
      target: null,
      fleeT: 0,
      fleeFrom: null,
      cash: int(G.rng, 5, 40),
      gang: false,
      boss: false,
      shootCd: 0,
      deadT: 0,
    });
  }
}

function pedTarget(ped) {
  const lines = roadLines();
  const p = ped.mesh.position;
  let ix = lines[0];
  let iz = lines[0];
  for (const l of lines) {
    if (Math.abs(l - p.x) < Math.abs(ix - p.x)) ix = l;
    if (Math.abs(l - p.z) < Math.abs(iz - p.z)) iz = l;
  }
  const cornerX = ix + (G.rng() < 0.5 ? -1 : 1) * (WORLD.roadHalf + 2);
  const cornerZ = iz + (G.rng() < 0.5 ? -1 : 1) * (WORLD.roadHalf + 2);
  ped.target = { x: clamp(cornerX, -230, 230), z: clamp(cornerZ, -230, 230) };
}

export function updatePeds(dt) {
  for (const ped of G.peds) {
    if (ped.state === 'dead') {
      ped.deadT += dt;
      if (ped.deadT > 18) {
        // recycle the body far from the player
        const s = randomRoadSpawn();
        ped.mesh.position.set(s.x, 0, s.z);
        ped.mesh.rotation.set(0, 0, 0);
        ped.hp = 30;
        ped.state = 'walk';
        ped.target = null;
        ped.deadT = 0;
      }
      continue;
    }
    if (ped.gang || ped.boss) continue; // combat.js drives them
    const p = ped.mesh.position;
    let speed = 1.7;
    let tx;
    let tz;
    if (ped.state === 'flee' && ped.fleeFrom) {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      tx = p.x + (p.x - ped.fleeFrom.x);
      tz = p.z + (p.z - ped.fleeFrom.z);
      speed = 4.6;
    } else {
      if (!ped.target) pedTarget(ped);
      tx = ped.target.x;
      tz = ped.target.z;
      if (Math.hypot(tx - p.x, tz - p.z) < 1.5) pedTarget(ped);
    }
    const desired = Math.atan2(tx - p.x, tz - p.z);
    ped.yaw += clamp(angleDelta(ped.yaw, desired), -3 * dt, 3 * dt);
    p.x += Math.sin(ped.yaw) * speed * dt;
    p.z += Math.cos(ped.yaw) * speed * dt;
    collide(p, 0.5);
    ped.mesh.rotation.y = ped.yaw;
    ped.phase += dt * speed * 2.6;
    animateWalk(ped.parts, ped.phase, clamp(speed / 4, 0.3, 1));
  }
}

export function scarePeds(x, z, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'dead' || ped.gang || ped.boss) continue;
    const p = ped.mesh.position;
    if (Math.hypot(p.x - x, p.z - z) < radius) {
      ped.state = 'flee';
      ped.fleeFrom = { x, z };
      ped.fleeT = 2.2;
    }
  }
}

/** The NBPD helicopter: body, spinning rotor, and a spotlight cone. police.js flies it. */
export function makeHeli() {
  const group = new THREE.Group();
  const body = box(2.2, 1.6, 4.6, 0x1c2434, 0, 0, 0);
  group.add(body);
  const tail = box(0.5, 0.5, 3.4, 0x1c2434, 0, 0.3, -3.8);
  group.add(tail);
  const glass = box(1.9, 1.1, 1.4, 0x7ee8fa, 0, 0.15, 1.9);
  group.add(glass);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.7 }),
  );
  rotor.position.y = 1.15;
  group.add(rotor);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 140, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.6, 0.6);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -40, 2);
  const coneGeo = new THREE.ConeGeometry(9, 42, 16, 1, true);
  coneGeo.translate(0, -21, 0);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  cone.position.set(0, -0.6, 0.6);
  group.add(cone);
  group.visible = false;
  G.scene.add(group);
  G.heli = { mesh: group, rotor, active: false, angle: 0 };
  return G.heli;
}
