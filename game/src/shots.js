// Screenshot scenes behind ?shot=cover|drive|wanted|boss. Each stages the real game —
// player, cars, police, gang, HUD — then main.js runs the simulation forward a fixed
// number of steps with a scripted input, so the frame is a true render of play and the
// same seed always gives the same picture.
import { PLACES } from './config.js';
import { G } from './state.js';
import { enterCar } from './player.js';
import { spawnGang } from './combat.js';

function fakeInput({ fwd = 0, side = 0, firing = false } = {}) {
  return {
    keys: new Set(),
    firing,
    locked: false,
    moveAxes: () => ({ fwd, side, turn: 0, sprint: false, handbrake: false }),
    takeMouse: () => ({ dx: 0, dy: 0 }),
    takeActions: () => 0,
    queueAction: () => {},
    setFiring: () => {},
    requestLock: () => {},
  };
}

function placeTraffic(index, x, z, yaw) {
  const car = G.cars.find((c, i) => c.kind === 'traffic' && i >= index) || G.cars[index];
  if (!car) return;
  car.mesh.position.set(x, 0, z);
  car.yaw = yaw;
  car.mesh.rotation.y = yaw;
  car.speed = 9;
  car.ai.wp = null;
}

function stageCover() {
  const player = G.player;
  player.mesh.position.set(-198, 0, 2);
  player.cash = 1250;
  player.weapon = 'pistol';
  player.ammo.pistol = 36;
  player.armor = 40;
  G.camYaw = -1.35; // camera over the sand, looking east-northeast into the city
  G.camPitch = 0.3;
  player.yaw = G.camYaw + Math.PI;
  player.mesh.rotation.y = player.yaw;
  G.camPos = null;
  // A parked car beside Rex, traffic rolling down Harbor Row, peds on the sidewalk.
  const parked = G.cars.find((c) => c.kind === 'parked' && !c.missionTag);
  if (parked) {
    parked.mesh.position.set(-194, 0, 13);
    parked.yaw = Math.PI / 2 + 0.2;
    parked.mesh.rotation.y = parked.yaw;
  }
  placeTraffic(0, -203, -10, Math.PI);
  placeTraffic(1, -197, 46, 0);
  placeTraffic(2, -203, 52, Math.PI);
  placeTraffic(3, -197, -32, 0);
  G.peds.slice(0, 4).forEach((ped, i) => {
    ped.mesh.position.set(-190 + i * 2.2, 0, -2 - i * 5);
    ped.target = { x: -190, z: -40 };
  });
  G.mission.text = 'See Mara Voss on Harbor Row';
  G.mission.sub = 'West waterfront — the yellow marker. She has work for Rex.';
  return { steps: 70, input: fakeInput() };
}

function stageDrive() {
  const player = G.player;
  const car = G.cars.find((c) => c.kind === 'traffic');
  car.mesh.position.set(3, 0, -30);
  car.yaw = Math.PI; // north
  car.mesh.rotation.y = car.yaw;
  car.speed = 0;
  player.mesh.position.set(3, 0, -30);
  enterCar(car);
  G.camYaw = 0.35;
  G.camPitch = 0.34;
  G.camPos = null;
  player.cash = 860;
  placeTraffic(1, -3, -90, Math.PI);
  placeTraffic(2, 3, 40, 0);
  placeTraffic(3, 53, -60, Math.PI);
  G.mission.text = 'Deliver the sedan to Harbor Row';
  G.mission.sub = 'Mara is waiting by the waterfront drop-off.';
  G.mission.markerPos = { x: PLACES.harborDrop.x, z: PLACES.harborDrop.z };
  return { steps: 170, input: fakeInput({ fwd: 1 }) };
}

function stageWanted() {
  const player = G.player;
  const car = G.cars.find((c) => c.kind === 'traffic');
  car.mesh.position.set(47, 0, 50);
  car.yaw = Math.PI / 2; // east
  car.mesh.rotation.y = car.yaw;
  car.speed = 14;
  player.mesh.position.set(47, 0, 50);
  enterCar(car);
  G.stars = 4;
  G.camYaw = -Math.PI / 2 + 0.4;
  G.camPitch = 0.08;
  G.camPos = null;
  player.cash = 2040;
  player.weapon = 'smg';
  player.ammo.smg = 90;
  // Three patrol cars in pursuit and the helicopter overhead.
  const spots = [
    { x: 38, z: 44, yaw: Math.PI / 2 },
    { x: 34, z: 56, yaw: Math.PI / 2 },
    { x: 52, z: 58, yaw: Math.PI / 2 },
  ];
  G.police.slice(0, 3).forEach((cop, i) => {
    cop.active = true;
    cop.driver = 'police';
    cop.mesh.visible = true;
    cop.mesh.position.set(spots[i].x, 0, spots[i].z);
    cop.yaw = spots[i].yaw;
    cop.mesh.rotation.y = cop.yaw;
    cop.speed = 15;
  });
  if (G.heli) {
    G.heli.active = true;
    G.heli.mesh.visible = true;
    G.heli.mesh.position.set(87, 24, 50);
    G.heli.angle = Math.PI / 2;
  }
  G.mission.text = 'Garage the sports car on Harbor Row';
  G.mission.sub = 'The NBPD are coming. Lose them or outrun them.';
  G.mission.markerPos = { x: PLACES.garage.x, z: PLACES.garage.z };
  return { steps: 55, input: fakeInput({ fwd: 1 }) };
}

function stageBoss() {
  const player = G.player;
  player.mesh.position.set(-194, 0, 156);
  player.weapon = 'shotgun';
  player.ammo.shotgun = 18;
  player.armor = 60;
  player.cash = 3150;
  G.camYaw = 2.47;
  G.camPitch = 0.3;
  player.yaw = G.camYaw + Math.PI;
  player.mesh.rotation.y = player.yaw;
  G.camPos = null;
  spawnGang(PLACES.bossArena.x, PLACES.bossArena.z, 2, true);
  G.mission.text = 'Defeat the Tide King';
  G.mission.sub = 'Watch the shotgun. Use the lighthouse for cover.';
  G.mission.markerPos = null;
  return { steps: 70, input: fakeInput() };
}

/** Stage the named scene; returns how many fixed steps to run and with what input. */
export function stageShot(name) {
  if (name === 'drive') return stageDrive();
  if (name === 'wanted') return stageWanted();
  if (name === 'boss') return stageBoss();
  return stageCover();
}
