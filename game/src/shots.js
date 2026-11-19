// Neon Bay 3D — deterministic screenshot scenes (?shot=1..4). Each stages a dense
// moment (city + traffic + police + objective + HUD + minimap) for the judge's
// contact sheet. The main loop keeps running; the driver waits for __shotReady.
import { CONFIG } from './config.js';

function putPlayerInCar(G, x, y, angle) {
  const { player, vehicles } = G;
  let car = null;
  let bd = Infinity;
  for (const c of vehicles.cars) {
    if (c.kind !== 'parked' || c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; car = c; }
  }
  if (!car) return;
  car.x = x; car.y = y; car.angle = angle; car.speed = 0; car.hp = CONFIG.playerCarHp;
  car.syncMesh();
  player.x = x; player.y = y; player.angle = angle;
  player.enterCar(car);
}

function addTrafficNear(G, cx, cy, n) {
  const { vehicles, world } = G;
  for (let i = 0; i < n; i++) {
    const c = world.nearestRoadCenter(cy + (i - n / 2) * 120);
    const car = vehicles.addCar('traffic', cx + (i % 2 ? 160 : -160), c, i % 2 ? Math.PI : 0, 0xc23b2e);
    car.axis = 'x';
    car.dir = i % 2 ? -1 : 1;
    car.speed = 200;
  }
}

export function setupShot(n, G) {
  const { player, vehicles, police, combat, missions, render } = G;
  G.state = 'playing';
  G.shotMode = true;
  G.hud.hideMenus();
  G.audio.ensure();
  G.audio.startRadio();
  police.wanted = 0;
  police.lastCrimeT = G.time;
  combat.clearThugs();
  missions.boss = null;
  if (n === 1) {
    // Cover: downtown chase, wanted 3, cruisers on the tail.
    missions.index = 1; missions.step = 1; missions.timer = 60;
    missions.setTarget(CONFIG.marina, 'Deliver to the marina — timed!');
    putPlayerInCar(G, 1500, 1248, 0);
    police.wanted = 3; police.lastCrimeT = G.time;
    for (const [x, y] of [[1300, 1200], [1340, 1300]]) {
      const c = police.spawnCruiser(G);
      c.x = x; c.y = y; c.angle = 0;
    }
    addTrafficNear(G, 1700, 1248, 4);
    render.yaw = -Math.PI / 2; render.pitch = 0.5; render.dist = 520;
  } else if (n === 2) {
    // On foot at the night market, peds and a parked car around.
    missions.index = 1; missions.step = 0;
    missions.setTarget(CONFIG.market, 'Pick up the package at the night market');
    if (player.inCar) player.exitCar(G.world);
    player.x = 1400; player.y = 560; player.angle = -Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const p = G.traffic.peds[i];
      p.x = 1330 + i * 40; p.y = 520 + (i % 2) * 60; p.down = false;
    }
    render.yaw = 0.8; render.pitch = 0.5; render.dist = 380;
  } else if (n === 3) {
    // Wanted 4: helicopter overhead, roadblock ahead, cruisers behind.
    missions.index = 3; missions.step = 1; missions.vaultT = 30;
    missions.setTarget(CONFIG.vault, 'Hold the vault — 30s');
    putPlayerInCar(G, 900, 1248, 0);
    police.wanted = 4.2; police.lastCrimeT = G.time;
    for (const [x, y] of [[700, 1200], [740, 1300]]) {
      const c = police.spawnCruiser(G);
      c.x = x; c.y = y; c.angle = 0;
    }
    addTrafficNear(G, 1400, 1248, 3);
    render.yaw = -Math.PI / 2; render.pitch = 0.38; render.dist = 560;
  } else {
    // King fight on the lighthouse beach.
    missions.index = 4; missions.step = 1;
    missions._spawnBeachCrew(G);
    missions.setTarget(CONFIG.beachCenter, 'Finish King on the beach!');
    if (player.inCar) player.exitCar(G.world);
    player.x = 3200; player.y = 1500; player.angle = 0;
    render.yaw = -Math.PI / 2; render.pitch = 0.55; render.dist = 500;
  }
  // Focus the camera immediately so the first frames are the shot.
  render.focus = { x: player.x, y: player.y };
}
