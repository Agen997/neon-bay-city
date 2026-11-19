// Neon Bay boot and main loop. Builds the city, Rex, traffic, peds, police and missions,
// then runs a fixed-step simulation under a requestAnimationFrame renderer. Screens:
// title (with an orbiting attract camera), play, paused, busted, wasted and won.
// ?seed=N fixes the city; ?shot=cover|drive|wanted|boss stages a screenshot scene and
// sets window.__shotReady. window.__nb exposes state and helpers for automated playtests.
import * as THREE from 'three';
import { STEP, WEAPON_ORDER, WEAPONS } from './config.js';
import { G, resetRun, toast } from './state.js';
import { createRandom } from './rng.js';
import { buildCity } from './city.js';
import { makeHeli, spawnParked, spawnPeds, spawnTraffic, updatePeds, updateTraffic } from './actors.js';
import { createPlayer, exitCar, jumpIfGrounded, nearestCar, enterCar, tryEnterExit, updateCamera, updatePlayer, damagePlayer } from './player.js';
import { applyBusted, applyWasted, createPolice, updatePolice } from './police.js';
import { initCombat, shoot, spawnStaticPickups, updateCombat } from './combat.js';
import { initMissions, startJob, updateMissions } from './missions.js';
import { hideBigMsg, hudElements, initHud, showBigMsg, showHud, showTitle, updateHud } from './hud.js';
import { applySave, hasSave, readSave, saveGame } from './save.js';
import { ACT, createInput } from './input.js';
import { initAudio, radioName, setRadio, sfx } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
G.seed = Number.isInteger(seedParam) ? seedParam : 20261120;
G.rng = createRandom(G.seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !params.has('noshadow');
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
G.renderer = renderer;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
});

buildCity();
createPlayer();
spawnTraffic(14);
spawnParked();
spawnPeds(24);
createPolice();
makeHeli();
initCombat();
spawnStaticPickups();
initMissions();
initHud();

const input = createInput(canvas);
let prevFiring = false;

function announce(msg) {
  statusEl.textContent = msg;
}

function switchWeapon(index) {
  const name = WEAPON_ORDER[index];
  if (!name) return;
  if (name !== 'fists' && (G.player.ammo[name] || 0) <= 0) {
    toast(`No ${WEAPONS[name].name} ammo.`, 1.4);
    return;
  }
  G.player.weapon = name;
  sfx.click();
}

function handleActions(actions) {
  if (actions & ACT.ENTER) tryEnterExit();
  if (actions & ACT.JUMP) jumpIfGrounded();
  if (actions & ACT.WEAPON1) switchWeapon(0);
  if (actions & ACT.WEAPON2) switchWeapon(1);
  if (actions & ACT.WEAPON3) switchWeapon(2);
  if (actions & ACT.WEAPON4) switchWeapon(3);
  if (actions & ACT.RADIO) {
    G.radio = (G.radio + 1) % 3;
    setRadio(G.radio);
    toast(radioName(G.radio), 1.6);
  }
}

/** One fixed simulation step. `inp` is the real input or a scripted stand-in. */
function stepSim(dt, inp) {
  G.time += dt;
  G.clockMin += dt * 0.5;
  G.prompt = '';
  handleActions(inp.takeActions());
  updatePlayer(dt, inp);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateCombat(dt);
  updateMissions(dt);
  const weapon = WEAPONS[G.player.weapon];
  if (inp.firing && (!prevFiring || weapon.auto)) shoot();
  prevFiring = !!inp.firing;
  if (G.waterTex) G.waterTex.offset.y -= dt * 0.015;
  if (G.lighthouseBeam) G.lighthouseBeam.rotation.y += dt * 0.45;
  G.saveTimer += dt;
  if (G.saveTimer > 25) {
    G.saveTimer = 0;
    saveGame();
  }
}

function startPlay(fromSave) {
  initAudio();
  sfx.click();
  if (fromSave) {
    const data = readSave();
    resetRun();
    if (data) applySave(data);
  } else {
    resetRun();
  }
  G.screen = 'play';
  showTitle(false);
  hideBigMsg();
  showHud(true);
  G.camPos = null;
  announce('Neon Bay. See Mara Voss on Harbor Row.');
  input.requestLock();
}

function endScreen(kind) {
  if (kind === 'busted') applyBusted();
  else if (kind === 'wasted') applyWasted();
  hideBigMsg();
  G.screen = 'play';
  G.camPos = null;
}

const el = hudElements();
el['btn-new'].addEventListener('click', () => startPlay(false));
el['btn-continue'].addEventListener('click', () => startPlay(true));
if (hasSave()) el['btn-continue'].classList.remove('hidden');
canvas.addEventListener('click', () => {
  if (G.screen === 'play') input.requestLock();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play') saveGame();
});

// Test/automation hooks (also handy in the dev console).
window.__nb = {
  G,
  step(seconds, opts = {}) {
    const fake = {
      keys: new Set(),
      firing: !!opts.firing,
      locked: false,
      moveAxes: () => ({ fwd: opts.fwd || 0, side: opts.side || 0, turn: 0, sprint: !!opts.sprint, handbrake: !!opts.handbrake }),
      takeMouse: () => ({ dx: 0, dy: 0 }),
      takeActions: () => opts.actions || 0,
      queueAction: () => {},
      setFiring: () => {},
      requestLock: () => {},
    };
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i += 1) {
      if (G.screen === 'play') stepSim(STEP, fake);
      else break;
    }
    updateCamera(1);
    updateHud(0);
    renderer.render(G.scene, G.camera);
    return this.state();
  },
  teleport(x, z) {
    const p = G.player;
    if (p.inCar) p.inCar.mesh.position.set(x, 0, z);
    p.mesh.position.set(x, 0, z);
    G.camPos = null;
    updateCamera(1);
    return this.state();
  },
  enterNearestCar() {
    const car = nearestCar(6);
    return car ? enterCar(car) : false;
  },
  exitCar: () => exitCar(),
  giveWeapon(name, ammo) {
    G.player.ammo[name] = (G.player.ammo[name] || 0) + ammo;
    G.player.weapon = name;
  },
  setCash(n) {
    G.player.cash = n;
  },
  setStars(n) {
    G.stars = n;
  },
  damage(n) {
    damagePlayer(n);
  },
  heal() {
    G.player.hp = 100;
    G.player.dead = false;
  },
  aimAt(x, z) {
    const pp = G.player.mesh.position;
    G.camYaw = Math.atan2(-(x - pp.x), -(z - pp.z));
    G.camPitch = 0.12;
    updateCamera(1);
  },
  fireOnce() {
    G.player.fireCd = 0;
    shoot();
  },
  startJob(i) {
    startJob(i);
  },
  saveNow: () => saveGame(),
  state() {
    const p = G.player;
    const pos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
    return {
      screen: G.screen,
      cash: p.cash,
      hp: Math.round(p.hp),
      armor: Math.round(p.armor),
      weapon: p.weapon,
      ammo: { ...p.ammo },
      stars: G.stars,
      bustMeter: Number(G.bustMeter.toFixed(2)),
      mission: { index: G.mission.index, stage: G.mission.stage, next: G.mission.next ?? 0, text: G.mission.text },
      pos: { x: Math.round(pos.x), z: Math.round(pos.z) },
      inCar: !!p.inCar,
      carSpeed: p.inCar ? Number(p.inCar.speed.toFixed(1)) : 0,
      won: G.won,
      boss: G.boss ? Math.round(G.boss.ped.hp) : null,
      gangAlive: G.gang.filter((g) => g.state !== 'dead').length,
      policeActive: G.police.filter((c) => c.active).length,
      heli: !!(G.heli && G.heli.active),
      time: Number(G.time.toFixed(1)),
    };
  },
};

if (shotName) {
  // Screenshot mode: stage the scene, run it forward, paint, and flag readiness.
  showTitle(false);
  showHud(true);
  resetRun();
  G.screen = 'play';
  const staged = stageShot(shotName);
  for (let i = 0; i < staged.steps; i += 1) stepSim(STEP, staged.input);
  for (let i = 0; i < 4; i += 1) updateCamera(0.5);
  updateHud(0);
  renderer.render(G.scene, G.camera);
  requestAnimationFrame(() => {
    updateCamera(0.5);
    renderer.render(G.scene, G.camera);
    window.__shotReady = true;
  });
} else {
  let accumulator = 0;
  let last = performance.now();
  let titleAngle = 0;
  let bannerShownFor = null;
  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = (now - last) / 1000;
    const frameDt = Math.min(realDt, MAX_FRAME);
    last = now;

    if (G.screen === 'title') {
      titleAngle += frameDt * 0.05;
      const cx = -170 + Math.sin(titleAngle) * 55;
      const cz = Math.cos(titleAngle) * 55;
      G.camera.position.set(cx, 20, cz);
      G.camera.lookAt(-185, 4, 0);
      updateTraffic(frameDt);
      updatePeds(frameDt);
      if (G.waterTex) G.waterTex.offset.y -= frameDt * 0.015;
      if (G.lighthouseBeam) G.lighthouseBeam.rotation.y += frameDt * 0.45;
      renderer.render(G.scene, G.camera);
      return;
    }

    if (G.screen === 'paused') {
      const actions = input.takeActions();
      if (actions & (ACT.PAUSE | ACT.ENTER)) {
        hideBigMsg();
        G.screen = 'play';
      }
      renderer.render(G.scene, G.camera);
      return;
    }

    if (G.screen === 'busted' || G.screen === 'wasted' || G.screen === 'won') {
      if (bannerShownFor !== G.screen) {
        bannerShownFor = G.screen;
        if (G.screen === 'busted') showBigMsg('BUSTED', 'The NBPD got you.', 'Fine paid, guns confiscated. Back to Harbor Row.', '#7db4ff');
        else if (G.screen === 'wasted') showBigMsg('WASTED', 'You flatlined.', 'The clinic patched you up — for a fee.', '#ff6b6b');
        else showBigMsg('NEON BAY IS YOURS', 'The Tide King is finished.', 'Free roam unlocked. The bay answers to Rex Marlowe now.', '#ffe27a');
      }
      G.screenTimer -= realDt;
      updateTraffic(frameDt);
      updatePeds(frameDt);
      renderer.render(G.scene, G.camera);
      if (G.screenTimer <= 0) {
        bannerShownFor = null;
        endScreen(G.screen);
      }
      return;
    }

    // play
    const actions = input.takeActions();
    if (actions & ACT.PAUSE) {
      G.screen = 'paused';
      showBigMsg('PAUSED', 'Neon Bay waits.', 'Press P to resume.', '#ffffff');
      saveGame();
      return;
    }
    // Re-queue the non-pause actions for the sim steps.
    input.queueAction(actions & ~ACT.PAUSE);
    accumulator += frameDt;
    while (accumulator >= STEP) {
      stepSim(STEP, input);
      accumulator -= STEP;
      if (G.screen !== 'play') break;
    }
    updateCamera(frameDt);
    updateHud(frameDt);
    renderer.render(G.scene, G.camera);
  }
  announce('Neon Bay. Press New Game to play.');
  requestAnimationFrame(frame);
}
