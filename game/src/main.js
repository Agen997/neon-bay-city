// Neon Bay 3D — main: boot, game loop, state machine, save/load, shooting via
// mouse raycast, and the window.__game debug handle the test drivers use.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { World } from './world.js';
import { Render3D } from './render.js';
import { Player } from './player.js';
import { VehicleSys } from './vehicles.js';
import { TrafficSys } from './traffic.js';
import { PoliceSys } from './police.js';
import { CombatSys } from './combat.js';
import { MissionSys } from './missions.js';
import { Hud } from './hud.js';
import { setupShot } from './shots.js';

const SAVE_KEY = 'neon-bay-3d-save-v1';

const canvas = document.getElementById('game');
const rng = makeRng(1337);
const input = new Input(canvas);
const audio = new AudioSys();
const render = new Render3D(canvas);
const world = new World(render.scene, rng);
const player = new Player(render.scene);
const vehicles = new VehicleSys(render.scene, world, rng);
const traffic = new TrafficSys(render.scene, world, rng);
const police = new PoliceSys(render.scene, world, rng);
const combat = new CombatSys(render.scene, world, rng);
const missions = new MissionSys(render.scene, world, rng);
const hud = new Hud({
  onNew: () => startNew(),
  onContinue: () => startContinue(),
  onResume: () => { G.state = 'playing'; hud.hideMenus(); },
  onQuit: () => { save(); G.state = 'title'; hud.showTitle(!!loadSave()); },
});

const G = {
  time: 0,
  state: 'title',
  shotMode: false,
  input, audio, world, render, player, vehicles, traffic, police, combat, missions, hud,
  lastShot: null,
  camera: { x: CONFIG.garage.x, y: CONFIG.garage.y },
  cars: vehicles.cars,
  save: () => save(),
  onBusted: () => onBusted(),
  onWin: () => onWin(),
};
Object.defineProperty(G, 'saveData', {
  get: () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } },
});

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

function save() {
  if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'busted') return;
  const data = {
    mi: missions.index, step: missions.step,
    money: player.money, hp: Math.max(1, Math.ceil(player.hp)),
    x: Math.round(player.x), y: Math.round(player.y),
    // Infinity does not survive JSON (it becomes null, which reads as an
    // empty magazine) — store it as -1 and restore it below.
    ammo: combat.weapons.map((w) => (w.ammo === Infinity ? -1 : w.ammo)),
    side: missions.sideJobs.map((s) => s.state),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full/blocked */ }
}

function resetWorld() {
  police.wanted = 0;
  police.lastCrimeT = -100;
  police.arrestT = 0;
  for (const c of [...police.cops]) { render.scene.remove(c.mesh); }
  police.cops.length = 0;
  for (const c of [...police.cruisers]) {
    const i = vehicles.cars.indexOf(c);
    if (i >= 0) vehicles.cars.splice(i, 1);
    render.scene.remove(c.mesh);
  }
  police.cruisers.length = 0;
  if (police.heli) { render.scene.remove(police.heli); police.heli = null; }
  if (police.roadblock) {
    for (const c of police.roadblock.cars) {
      const i = vehicles.cars.indexOf(c);
      if (i >= 0) vehicles.cars.splice(i, 1);
      render.scene.remove(c.mesh);
    }
    police.roadblock = null;
  }
  combat.clearThugs();
  for (const p of [...combat.healthPacks]) { render.scene.remove(p.mesh); }
  combat.healthPacks.length = 0;
  combat.weapons.forEach((w, i) => { w.ammo = [Infinity, 240, 40][i]; });
  combat.wi = 0;
  for (const c of vehicles.cars) {
    if (c.kind === 'parked' || c.kind === 'traffic') { c.wrecked = false; c.hp = 100; c.owner = null; }
  }
}

function startNew() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  resetWorld();
  player.reset(CONFIG.garage.x, CONFIG.garage.y);
  player.money = 0;
  missions.start();
  for (const sj of missions.sideJobs) sj.state = 'idle';
  G.state = 'playing';
  hud.hideMenus();
  audio.ensure();
  audio.startRadio();
  hud.toast('Mara: steal a car. Any car. Then come see me.');
}

function startContinue() {
  const s = loadSave();
  resetWorld();
  player.reset(s ? s.x : CONFIG.garage.x, s ? s.y : CONFIG.garage.y);
  if (s) {
    player.money = s.money || 0;
    player.hp = s.hp || CONFIG.playerHp;
    if (Array.isArray(s.ammo)) s.ammo.forEach((a, i) => { if (combat.weapons[i]) combat.weapons[i].ammo = (a === -1 || a === null) ? Infinity : a; });
    if (Array.isArray(s.side)) s.side.forEach((st, i) => { if (missions.sideJobs[i]) missions.sideJobs[i].state = st === 'done' ? 'done' : 'idle'; });
    missions.index = Math.min(4, s.mi || 0);
    missions.step = 0;
    missions._restoreMainTarget();
  } else {
    missions.start();
  }
  G.state = 'playing';
  hud.hideMenus();
  audio.ensure();
  audio.startRadio();
  hud.toast('Back on the streets, Rex.');
}

function onBusted() {
  if (G.state !== 'playing' || G.shotMode) return;
  const lost = Math.floor(player.money * CONFIG.bustMoneyLoss);
  player.money -= lost;
  audio.busted();
  player.reset(CONFIG.garage.x, CONFIG.garage.y);
  missions.resetForBusted(G);
  police.wanted = 0;
  police.arrestT = 0;
  G.state = 'busted';
  hud.showBusted(lost);
  save();
}

function onWin() {
  if (G.state !== 'playing') return;
  G.state = 'won';
  audio.win();
  hud.showWon(player.money);
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// --- Interaction ---
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of vehicles.cars) {
    if (c.wrecked || c.owner) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function interact() {
  if (missions.trySideJob(G)) return;
  if (player.inCar) {
    player.exitCar(world);
    return;
  }
  const car = nearestCar(78);
  if (car) {
    if (!car.stolenByPlayer) {
      car.stolenByPlayer = true;
      car.hp = CONFIG.playerCarHp;
      police.addWanted(1, G);
      hud.toast(car.kind === 'cop' ? 'You stole a cop car?!' : 'Car stolen — the NBPD noticed.');
    }
    player.enterCar(car);
    if (car.wrecked) player.exitCar(world);
  }
}

// Mouse aim: ray from the camera through the cursor onto the ground plane.
const _ray = new THREE.Raycaster();
function aimPoint() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  const ndc = new THREE.Vector2((input.mouse.x / w) * 2 - 1, -(input.mouse.y / h) * 2 + 1);
  _ray.setFromCamera(ndc, render.camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  if (d.y >= -0.001) return null;
  const t = -o.y / d.y;
  return { x: o.x + d.x * t, y: o.z + d.z * t };
}

// --- Debug handle for scripted drivers ---
window.__game = G;
G.screenPos = (x, y) => render.project(x, y, 2);

// --- Boot ---
// ?fast=1 (scripted headless playthroughs) runs a quieter city so the
// scripted driver's bang-bang steering is not fighting ambient traffic;
// the shipped game and the ?shot= scenes keep full density.
vehicles.spawnParked(render.fast ? 8 : 16);
vehicles.spawnTraffic(render.fast ? 4 : 12);
traffic.spawn(render.fast ? 12 : 26);
missions.start();
hud.showTitle(!!loadSave());

// First-gesture audio unlock.
const unlock = () => audio.ensure();
window.addEventListener('keydown', unlock, { once: true });
window.addEventListener('mousedown', unlock, { once: true });

// Deterministic screenshot mode.
const shotParam = new URLSearchParams(location.search).get('shot');
let shotFrames = 0;
if (shotParam) {
  setupShot(parseInt(shotParam, 10) || 1, G);
}

// --- Main loop ---
// Fixed-step simulation: game time tracks real time even when the renderer is
// slow (headless SwiftShader), up to 6 steps of 1/60s per frame.
let last = performance.now();
let fpsFrames = 0, fpsT = 0;
window.__fps = 0;
let mouseWasDown = false;
let simAcc = 0;
const STEP = 1 / 60;

function stepPlaying(dt) {
  G.time += dt;
  // Shooting (hold for auto weapons, click for semi).
  const w = combat.weapon();
  if (input.mouse.down && (w.auto || !mouseWasDown)) {
    const ap = aimPoint();
    if (ap) combat.shoot(G, ap.x, ap.y);
  }
  mouseWasDown = input.mouse.down;
  // Systems.
  player.update(dt, G);
  vehicles.update(dt, G);
  traffic.update(dt, G);
  police.update(dt, G);
  combat.update(dt, G);
  missions.update(dt, G);
  world.update(dt, G.time);
}

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.25, Math.max(0.001, (now - last) / 1000));
  last = now;
  fpsFrames++;
  fpsT += rawDt;
  if (fpsT >= 1) { window.__fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }

  if (G.state === 'title') {
    G.time += rawDt;
    render.yaw += rawDt * 0.045;
    render.update(rawDt, { x: 1704, y: 1552 }, null);
    world.update(rawDt, G.time);
    if (input.pressed('Enter')) {
      if (loadSave()) startContinue();
      else startNew();
    }
  } else if (G.state === 'playing') {
    // Edge-triggered inputs, once per frame.
    if (input.pressed('KeyP')) { G.state = 'paused'; save(); hud.showPause(); }
    if (G.state === 'playing') {
      if (input.pressed('KeyM')) { audio.setMuted(!audio.muted); hud.toast(audio.muted ? 'Muted' : 'Sound on'); }
      if (input.pressed('KeyR')) {
        audio.ensure();
        if (!audio.radioOn) { audio.startRadio(); hud.toast(`Radio on — ${audio.stationName()}`); }
        else hud.toast(`Radio — ${audio.nextStation()}`);
      }
      if (input.pressed('Digit1')) combat.switchWeapon(0);
      if (input.pressed('Digit2')) combat.switchWeapon(1);
      if (input.pressed('Digit3')) combat.switchWeapon(2);
      if (input.pressed('Space')) combat.melee(G);
      if (input.pressed('KeyE')) interact();
      simAcc += rawDt;
      let n = 0;
      while (simAcc >= STEP && n < 6 && G.state === 'playing') {
        stepPlaying(STEP);
        simAcc -= STEP;
        n++;
      }
      if (simAcc > 0.2) simAcc = 0.2;
      render.update(rawDt, { x: player.x, y: player.y }, input);
      hud.update(rawDt, G);
      audio.update(rawDt, police.wanted);
    }
  } else if (G.state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Enter')) { G.state = 'playing'; hud.hideMenus(); }
  } else if (G.state === 'busted') {
    if (input.pressed('Enter')) {
      G.state = 'playing';
      hud.hideMenus();
    }
  } else if (G.state === 'won') {
    if (input.pressed('Enter')) {
      G.state = 'title';
      hud.showTitle(!!loadSave());
      render.yaw = 0;
    }
  }
  G.camera.x = render.focus.x;
  G.camera.y = render.focus.y;
  input.endFrame();
  if (shotParam) {
    shotFrames++;
    if (shotFrames >= 3) window.__shotReady = true;
  }
}
requestAnimationFrame(frame);
