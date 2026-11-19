// Rex Marlowe: third-person on-foot movement with a mouse-orbit camera, arcade driving,
// entering and stealing cars, and taking damage (armor first, then health).
import * as THREE from 'three';
import { CAR_CFG, PLAYER_CFG, PLACES } from './config.js';
import { G, toast } from './state.js';
import { clamp } from './rng.js';
import { animateWalk, makePerson } from './actors.js';
import { collide } from './city.js';
import { sfx, updateEngine } from './audio.js';
import { addStars } from './police.js';

export function createPlayer() {
  const { group, parts } = makePerson(0x24304d, 0x1e1e28, 0xf2c49b);
  // Rex's jacket stripe and cap make him readable in a crowd.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.14, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xff5da2, roughness: 0.8 }),
  );
  stripe.position.set(0, 1.3, 0);
  group.add(stripe);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.1, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x16213a, roughness: 0.8 }),
  );
  cap.position.set(0, 1.92, 0.05);
  group.add(cap);
  // Gun in the right hand, shown when a firearm is equipped.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5 }),
  );
  gun.position.set(0, -0.62, 0.16);
  gun.visible = false;
  parts.armR.add(gun);
  group.position.set(PLACES.spawn.x, 0, PLACES.spawn.z);
  G.scene.add(group);
  G.player = {
    mesh: group,
    parts,
    gun,
    vel: new THREE.Vector3(),
    vy: 0,
    yaw: Math.PI,
    hp: PLAYER_CFG.maxHp,
    armor: 0,
    cash: 50,
    weapon: 'fists',
    ammo: { pistol: 0, smg: 0, shotgun: 0 },
    inCar: null,
    speed: 0,
    walkPhase: 0,
    fireCd: 0,
    dead: false,
  };
  return G.player;
}

export function nearestCar(maxDist = 3.4) {
  const p = G.player.mesh.position;
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = car.mesh.position.distanceTo(p);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(car) {
  const player = G.player;
  if (player.inCar || !car) return false;
  if (car.police) addStars(1, 'stole a police car');
  car.driver = 'player';
  player.inCar = car;
  player.mesh.visible = false;
  player.speed = car.speed;
  sfx.door();
  return true;
}

export function exitCar() {
  const player = G.player;
  const car = player.inCar;
  if (!car) return false;
  car.driver = null;
  player.inCar = null;
  const p = car.mesh.position;
  const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
  player.mesh.position.set(p.x + side.x * 1.8, 0, p.z + side.z * 1.8);
  player.yaw = car.yaw;
  player.mesh.visible = true;
  player.speed = 0;
  sfx.door();
  return true;
}

export function damagePlayer(amount) {
  const player = G.player;
  if (player.dead || G.screen !== 'play') return;
  let dmg = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, dmg);
    player.armor -= absorbed;
    dmg -= absorbed;
  }
  player.hp -= dmg;
  sfx.hurt();
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    G.screen = 'wasted';
    G.screenTimer = 3.2;
    sfx.wasted();
  }
}

function updateOnFoot(dt, input) {
  const player = G.player;
  const axes = input.moveAxes();
  const speedTarget = axes.sprint ? PLAYER_CFG.run : PLAYER_CFG.walk;
  const sin = Math.sin(G.camYaw);
  const cos = Math.cos(G.camYaw);
  // camera forward on the ground plane is (-sin, -cos) for yaw measured from +z
  const fx = -sin;
  const fz = -cos;
  const rx = cos;
  const rz = -sin;
  let mx = fx * axes.fwd + rx * axes.side;
  let mz = fz * axes.fwd + rz * axes.side;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    player.yaw = Math.atan2(mx, mz);
    player.speed = speedTarget;
  } else {
    player.speed = 0;
  }
  const p = player.mesh.position;
  p.x += mx * player.speed * dt;
  p.z += mz * player.speed * dt;
  // jump + gravity
  player.vy -= 18 * dt;
  p.y += player.vy * dt;
  if (p.y <= 0) {
    p.y = 0;
    player.vy = 0;
  }
  collide(p, PLAYER_CFG.radius);
  player.mesh.rotation.y = player.yaw;
  player.walkPhase += player.speed * dt * 2.4;
  animateWalk(player.parts, player.walkPhase, clamp(player.speed / PLAYER_CFG.run, 0, 1));
  if (input.firing && player.weapon !== 'fists') {
    player.parts.armR.rotation.x = -1.45;
    player.yaw = G.camYaw + Math.PI;
    player.mesh.rotation.y = player.yaw;
  }
  updateEngine(0, false);
}

function updateDriving(dt, input) {
  const player = G.player;
  const car = player.inCar;
  const axes = input.moveAxes();
  const top = car.sports ? CAR_CFG.sportsTop : CAR_CFG.topSpeed;
  if (axes.fwd > 0) car.speed += CAR_CFG.accel * dt;
  else if (axes.fwd < 0) {
    if (car.speed > 0.5) car.speed -= CAR_CFG.brake * dt;
    else car.speed -= CAR_CFG.accel * 0.55 * dt;
  }
  car.speed -= car.speed * CAR_CFG.drag * dt;
  if (axes.handbrake) car.speed -= car.speed * 2.4 * dt;
  car.speed = clamp(car.speed, -CAR_CFG.reverseMax, top);
  const steerRate = CAR_CFG.steer * clamp(Math.abs(car.speed) / 12, 0, 1) * (axes.handbrake ? 1.5 : 1);
  car.yaw -= axes.side * steerRate * Math.sign(car.speed || 1) * dt;
  const p = car.mesh.position;
  const beforeX = p.x;
  const beforeZ = p.z;
  p.x += Math.sin(car.yaw) * car.speed * dt;
  p.z += Math.cos(car.yaw) * car.speed * dt;
  collide(p, CAR_CFG.radius);
  const moved = Math.hypot(p.x - beforeX, p.z - beforeZ);
  const expected = Math.abs(car.speed) * dt;
  if (expected > 0.05 && moved < expected * 0.45) {
    if (Math.abs(car.speed) > 9) sfx.crash();
    car.speed *= 0.45;
    car.hp -= 4;
  }
  car.mesh.rotation.y = car.yaw;
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  player.speed = Math.abs(car.speed);
  player.mesh.position.copy(p);
  updateEngine(clamp(Math.abs(car.speed) / top, 0, 1), true);
}

function updateLooseCars(dt) {
  for (const car of G.cars) {
    if (car.driver || Math.abs(car.speed) < 0.05) continue;
    car.speed -= car.speed * 1.6 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
    const p = car.mesh.position;
    p.x += Math.sin(car.yaw) * car.speed * dt;
    p.z += Math.cos(car.yaw) * car.speed * dt;
    collide(p, CAR_CFG.radius);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  }
}

const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();

export function updateCamera(dt) {
  const player = G.player;
  const focus = player.inCar ? player.inCar.mesh.position : player.mesh.position;
  const dist = player.inCar ? 10.5 : 7.5;
  const height = player.inCar ? 2.4 : 1.7;
  camTarget.set(focus.x, focus.y + height, focus.z);
  const cp = Math.cos(G.camPitch);
  camDesired.set(
    camTarget.x + Math.sin(G.camYaw) * cp * dist,
    camTarget.y + Math.sin(G.camPitch) * dist,
    camTarget.z + Math.cos(G.camYaw) * cp * dist,
  );
  if (!G.camPos) G.camPos = camDesired.clone();
  const k = 1 - Math.exp(-9 * dt);
  G.camPos.lerp(camDesired, k);
  if (G.camPos.y < 1.1) G.camPos.y = 1.1;
  collide(G.camPos, 0.6);
  G.camera.position.copy(G.camPos);
  G.camera.lookAt(camTarget.x, camTarget.y + 0.3, camTarget.z);
  // keep the shadow frustum centred on the action
  if (G.sun) {
    G.sun.position.set(focus.x - 180, 120, focus.z + 60);
    G.sun.target.position.set(focus.x, 0, focus.z);
  }
}

export function updatePlayer(dt, input) {
  const player = G.player;
  const mouse = input.takeMouse();
  G.camYaw -= mouse.dx * 0.0026;
  G.camPitch = clamp(G.camPitch + mouse.dy * 0.0022, -0.12, 1.1);
  const axes = input.moveAxes();
  if (axes.turn) G.camYaw += axes.turn * 2.2 * dt;
  if (player.inCar) updateDriving(dt, input);
  else updateOnFoot(dt, input);
  updateLooseCars(dt);
  if (player.fireCd > 0) player.fireCd -= dt;
  player.gun.visible = player.weapon !== 'fists' && !player.inCar;
}

export function jumpIfGrounded() {
  const player = G.player;
  if (!player.inCar && player.mesh.position.y <= 0.01) {
    player.vy = PLAYER_CFG.jump;
  }
}

export function tryEnterExit() {
  const player = G.player;
  if (player.inCar) {
    if (Math.abs(player.inCar.speed) > 6) {
      toast('Too fast to bail out!');
      return;
    }
    exitCar();
    return;
  }
  const car = nearestCar();
  if (car) enterCar(car);
}
