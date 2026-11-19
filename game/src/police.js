// The NBPD: a wanted-star system with line-of-sight decay, patrol cars that chase and ram,
// roadblocks at three stars, a spotlight helicopter at four, and the busted flow (boxed in
// and slow for a few seconds means cuffs, a fine, and your guns gone).
import * as THREE from 'three';
import { PLACES, WANTED } from './config.js';
import { G, playerPos, toast } from './state.js';
import { angleDelta, clamp, range } from './rng.js';
import { makeCarMesh } from './actors.js';
import { collide, nearestRoadPoint } from './city.js';
import { damagePlayer, exitCar } from './player.js';
import { sfx, updateSiren } from './audio.js';

const POOL = 8; // 6 chasers + 2 roadblock cars
let unseenTime = 0;

export function createPolice() {
  for (let i = 0; i < POOL; i += 1) {
    const { group, wheels, lightbar } = makeCarMesh(0x1c2434, { police: true });
    group.visible = false;
    group.position.set(0, -60, 0);
    G.scene.add(group);
    const car = {
      mesh: group,
      wheels,
      lightbar,
      yaw: 0,
      speed: 0,
      steer: 0,
      kind: 'police',
      driver: null,
      hp: 160,
      sports: false,
      police: true,
      active: false,
      roadblock: false,
      roadblockT: 0,
      ai: { stuckT: 0, reverseT: 0 },
      sirenPhase: i * 1.7,
    };
    G.cars.push(car);
    G.police.push(car);
  }
}

export function addStars(n, why = '') {
  const before = G.stars;
  G.stars = clamp(G.stars + n, 0, WANTED.maxStars);
  G.lastSeen = G.time;
  unseenTime = 0;
  if (G.stars > before && before === 0) toast(`The NBPD are on you${why ? ` — ${why}` : ''}!`, 2.6);
}

export function clearWanted() {
  G.stars = 0;
  G.bustMeter = 0;
  unseenTime = 0;
  for (const cop of G.police) {
    cop.active = false;
    cop.driver = null;
    cop.mesh.visible = false;
    cop.mesh.position.set(0, -60, 0);
    cop.speed = 0;
  }
  if (G.heli) {
    G.heli.active = false;
    G.heli.mesh.visible = false;
  }
  updateSiren(0);
}

function spawnCop(cop, roadblock = false) {
  const pp = playerPos();
  let x;
  let z;
  if (roadblock) {
    // Across the road ahead of the player's heading.
    const player = G.player;
    const heading = player.inCar ? player.inCar.yaw : player.yaw;
    const ahead = 55;
    const snap = nearestRoadPoint(pp.x + Math.sin(heading) * ahead, pp.z + Math.cos(heading) * ahead);
    x = snap.x;
    z = snap.z;
    cop.yaw = heading + Math.PI / 2;
    cop.roadblock = true;
    cop.roadblockT = 22;
  } else {
    const angle = G.rng() * Math.PI * 2;
    const dist = range(G.rng, 62, 85);
    const snap = nearestRoadPoint(pp.x + Math.sin(angle) * dist, pp.z + Math.cos(angle) * dist);
    x = snap.x;
    z = snap.z;
    cop.yaw = Math.atan2(pp.x - x, pp.z - z);
    cop.roadblock = false;
  }
  cop.mesh.position.set(x, 0, z);
  cop.mesh.rotation.y = cop.yaw;
  cop.mesh.visible = true;
  cop.active = true;
  cop.driver = 'police';
  cop.speed = 0;
  cop.hp = 160;
}

function desiredCops() {
  if (G.stars === 0) return 0;
  return Math.min(1 + G.stars, 6);
}

function driveCop(cop, dt) {
  const pp = playerPos();
  const p = cop.mesh.position;
  const player = G.player;
  // Aim at where the player is heading, not just where they are.
  const pv = player.inCar
    ? { x: Math.sin(player.inCar.yaw) * player.inCar.speed, z: Math.cos(player.inCar.yaw) * player.inCar.speed }
    : { x: Math.sin(player.yaw) * player.speed, z: Math.cos(player.yaw) * player.speed };
  const tx = pp.x + pv.x * 0.55;
  const tz = pp.z + pv.z * 0.55;
  const dist = Math.hypot(pp.x - p.x, pp.z - p.z);

  if (cop.ai.reverseT > 0) {
    cop.ai.reverseT -= dt;
    cop.speed = -7;
  } else {
    const desired = Math.atan2(tx - p.x, tz - p.z);
    cop.yaw += clamp(angleDelta(cop.yaw, desired), -2.1 * dt, 2.1 * dt);
    const topSpeed = 16 + G.stars * 1.7;
    const target = dist < 7 ? clamp(player.speed + 2, 4, topSpeed) : topSpeed;
    cop.speed += clamp(target - cop.speed, -20 * dt, 9 * dt);
    if (Math.abs(cop.speed) < 1.2 && dist > 10) {
      cop.ai.stuckT += dt;
      if (cop.ai.stuckT > 0.9) {
        cop.ai.reverseT = 0.8;
        cop.ai.stuckT = 0;
      }
    } else {
      cop.ai.stuckT = 0;
    }
  }
  const beforeX = p.x;
  const beforeZ = p.z;
  p.x += Math.sin(cop.yaw) * cop.speed * dt;
  p.z += Math.cos(cop.yaw) * cop.speed * dt;
  collide(p, 2.0);
  const moved = Math.hypot(p.x - beforeX, p.z - beforeZ);
  if (Math.abs(cop.speed) * dt > 0.05 && moved < Math.abs(cop.speed) * dt * 0.4 && cop.ai.reverseT <= 0) {
    cop.ai.stuckT += dt * 3;
    if (cop.ai.stuckT > 0.9) {
      cop.ai.reverseT = 0.8;
      cop.ai.stuckT = 0;
    }
  }
  cop.mesh.rotation.y = cop.yaw;
  for (const w of cop.wheels) w.rotation.x += (cop.speed * dt) / 0.36;

  // Ramming: shove the player's car, or knock Rex down on foot.
  if (dist < 3.4) {
    if (player.inCar) {
      player.inCar.speed *= 0.94;
      player.inCar.hp -= 2;
      cop.speed *= 0.9;
    } else if (Math.abs(cop.speed) > 4) {
      damagePlayer(6);
      const ppMesh = player.mesh.position;
      ppMesh.x += Math.sin(cop.yaw) * 2.2;
      ppMesh.z += Math.cos(cop.yaw) * 2.2;
      collide(ppMesh, 0.55);
      cop.speed *= 0.6;
    }
  }
}

function updateHeli(dt) {
  const heli = G.heli;
  if (!heli) return;
  const want = G.stars >= 4 && G.screen === 'play';
  if (want && !heli.active) {
    heli.active = true;
    heli.mesh.visible = true;
    const pp = playerPos();
    heli.mesh.position.set(pp.x + 40, 24, pp.z + 40);
    toast('NBPD helicopter overhead!', 2.6);
  }
  if (!want && heli.active) {
    heli.active = false;
    heli.mesh.visible = false;
  }
  if (!heli.active) return;
  const pp = playerPos();
  heli.angle += dt * 0.32;
  const target = new THREE.Vector3(pp.x + Math.sin(heli.angle) * 40, 24, pp.z + Math.cos(heli.angle) * 40);
  heli.mesh.position.lerp(target, 1 - Math.exp(-1.6 * dt));
  heli.mesh.lookAt(pp.x, 0, pp.z);
  heli.rotor.rotation.y += dt * 28;
}

export function updatePolice(dt) {
  const pp = playerPos();
  if (G.stars === 0 && G.police.some((c) => c.active)) clearWanted();
  const want = desiredCops();
  let activeCount = 0;
  for (const cop of G.police) if (cop.active && !cop.roadblock) activeCount += 1;
  for (const cop of G.police) {
    if (activeCount >= want) break;
    if (!cop.active) {
      spawnCop(cop);
      activeCount += 1;
    }
  }
  // Roadblocks from three stars up.
  if (G.stars >= 3 && G.screen === 'play') {
    G.roadblockTimer -= dt;
    if (G.roadblockTimer <= 0) {
      G.roadblockTimer = 20;
      let placed = 0;
      for (const cop of G.police) {
        if (placed >= 2) break;
        if (!cop.active) {
          spawnCop(cop, true);
          // nudge the pair apart across the road
          cop.mesh.position.x += placed === 0 ? -2.4 : 2.4;
          placed += 1;
        }
      }
      if (placed) toast('Roadblock ahead!', 2.2);
    }
  }

  let nearest = Infinity;
  let seen = false;
  for (const cop of G.police) {
    if (!cop.active) continue;
    const p = cop.mesh.position;
    const dist = Math.hypot(pp.x - p.x, pp.z - p.z);
    nearest = Math.min(nearest, dist);
    if (dist < WANTED.seenRange) seen = true;
    // flash the light bar
    if (cop.lightbar) {
      const phase = Math.sin(G.time * 11 + cop.sirenPhase) > 0;
      cop.lightbar.userData.red.visible = phase;
      cop.lightbar.userData.blue.visible = !phase;
    }
    if (cop.roadblock) {
      cop.roadblockT -= dt;
      cop.speed = 0;
      if (cop.roadblockT <= 0 || dist < 6) cop.roadblock = false;
      continue;
    }
    driveCop(cop, dt);
  }
  updateHeli(dt);
  if (G.heli && G.heli.active) {
    const hp = G.heli.mesh.position;
    if (Math.hypot(pp.x - hp.x, pp.z - hp.z) < WANTED.heliRange) seen = true;
  }

  // Wanted decay: break line of sight and stay unseen to shed stars.
  if (G.stars > 0) {
    if (seen) {
      unseenTime = 0;
      G.lastSeen = G.time;
    } else {
      unseenTime += dt;
      if (unseenTime > WANTED.decayDelay) {
        G.stars -= 1;
        unseenTime = WANTED.decayDelay - 4;
        if (G.stars === 0) {
          toast('You lost the NBPD.', 2.6);
          clearWanted();
        } else {
          toast(`Wanted level down to ${G.stars}★ — stay out of sight.`, 2.2);
        }
      }
    }
  }

  // Busted: a cop close by while you are slow.
  const playerSpeed = G.player.inCar ? Math.abs(G.player.inCar.speed) : G.player.speed;
  if (G.stars > 0 && nearest < WANTED.bustRange && playerSpeed < 4 && G.screen === 'play') {
    G.bustMeter += dt;
    if (G.bustMeter > 0.6) G.prompt = 'They are boxing you in — MOVE!';
    if (G.bustMeter >= WANTED.bustTime) {
      G.screen = 'busted';
      G.screenTimer = 3.4;
      sfx.busted();
    }
  } else {
    G.bustMeter = Math.max(0, G.bustMeter - dt * 1.4);
  }

  updateSiren(G.stars > 0 && nearest < 70 ? clamp(1 - nearest / 70, 0.15, 1) : 0);
}

export function respawnAt(x, z) {
  const player = G.player;
  if (player.inCar) exitCar();
  player.mesh.position.set(x, 0, z);
  player.mesh.visible = true;
  player.vy = 0;
  player.speed = 0;
  player.dead = false;
  player.hp = 100;
  G.camPos = null;
}

/** Apply the busted penalties and put Rex back on Harbor Row. Called when the screen ends. */
export function applyBusted() {
  const player = G.player;
  const fine = Math.min(player.cash, Math.max(50, Math.floor(player.cash * 0.1)));
  player.cash -= fine;
  player.weapon = 'fists';
  player.ammo = { pistol: 0, smg: 0, shotgun: 0 };
  clearWanted();
  respawnAt(PLACES.spawn.x, PLACES.spawn.z);
  toast(`Released. Fine $${fine}. Guns confiscated.`, 4);
  return fine;
}

/** Apply the wasted penalties and wake Rex at the clinic. */
export function applyWasted() {
  const player = G.player;
  const bill = Math.min(player.cash, Math.max(30, Math.floor(player.cash * 0.1)));
  player.cash -= bill;
  clearWanted();
  respawnAt(PLACES.clinic.x, PLACES.clinic.z);
  toast(`Patched up at the clinic. Bill $${bill}.`, 4);
  return bill;
}
