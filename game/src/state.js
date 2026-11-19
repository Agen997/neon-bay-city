// The one shared game state every module reads and writes. main.js fills the three.js
// fields at boot; resetRun() puts the player back to a fresh start (new game).
import { PLACES, PLAYER_CFG } from './config.js';

export const G = {
  // three.js handles, set by main.js
  scene: null,
  camera: null,
  renderer: null,
  sun: null,
  rng: null,
  seed: 1,

  // flow
  screen: 'title', // title | play | paused | busted | wasted | won
  screenTimer: 0,
  time: 0, // simulated seconds since boot
  clockMin: 18 * 60 + 42, // in-game clock, starts 18:42
  won: false,

  // camera
  camYaw: Math.PI * 0.75,
  camPitch: 0.32,
  camPos: null, // THREE.Vector3, set by main

  // player
  player: null, // { mesh, parts, vel, vy, hp, armor, cash, weapon, ammo:{}, inCar, speed, walkPhase, dead }
  cars: [],
  peds: [],
  police: [],
  gang: [],
  pickups: [],
  colliders: [], // building AABBs {minX,maxX,minZ,maxZ}
  heli: null,

  // wanted
  stars: 0,
  lastSeen: -99,
  decayTimer: 0,
  bustMeter: 0,
  roadblockTimer: 0,

  // mission
  mission: { index: -1, stage: 0, timer: 0, data: {}, marker: null, markerPos: null, text: '', sub: '' },

  // transient fx / ui
  toast: '',
  toastTimer: 0,
  prompt: '',
  boss: null, // { ped, maxHp }
  shots: 0,
  radio: 0, // 0 off, 1 Bay FM, 2 Sunset Synth
  saveTimer: 0,
};

export function resetRun() {
  const p = G.player;
  p.mesh.position.set(PLACES.spawn.x, 0, PLACES.spawn.z);
  p.vel.set(0, 0, 0);
  p.vy = 0;
  p.yaw = Math.PI;
  p.hp = PLAYER_CFG.maxHp;
  p.armor = 0;
  p.cash = 50;
  p.weapon = 'fists';
  p.ammo = { pistol: 0, smg: 0, shotgun: 0 };
  p.inCar = null;
  p.speed = 0;
  p.dead = false;
  p.mesh.visible = true;
  G.stars = 0;
  G.bustMeter = 0;
  G.decayTimer = 0;
  G.won = false;
  G.mission = {
    index: -1,
    stage: 0,
    timer: 0,
    data: {},
    marker: G.mission.marker,
    markerPos: { x: PLACES.mara.x, z: PLACES.mara.z },
    text: 'See Mara Voss on Harbor Row',
    sub: 'West waterfront — the yellow marker. She has work for Rex.',
    next: 0,
  };
  G.boss = null;
  G.clockMin = 18 * 60 + 42;
  for (const car of G.cars) {
    if (car.driver === 'player') car.driver = null;
  }
  for (const cop of G.police) cop.active = false;
  if (G.heli) G.heli.active = false;
}

export function playerPos() {
  return G.player.inCar ? G.player.inCar.mesh.position : G.player.mesh.position;
}

export function toast(msg, seconds = 3.2) {
  G.toast = msg;
  G.toastTimer = seconds;
}
