// Neon Bay — the loop and the state machine. Boots every system, runs the
// frame, owns the title / playing / paused / busted / won states, and saves
// Rex's progress so a run can continue where it left off.
import { CFG } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildWorld, blockedCircle } from './world.js';
import { createPlayer, updatePlayer, hurtPlayer } from './player.js';
import * as vehicles from './vehicles.js';
import * as traffic from './traffic.js';
import * as police from './police.js';
import * as combat from './combat.js';
import * as missions from './missions.js';
import { drawGame, updateCamera } from './render.js';
import * as hud from './hud.js';
import { setupShot } from './shots.js';

const SAVE_KEY = 'neonbay.save.v1';

function initGame(G) {
  G.rng = new RNG(CFG.seed);
  G.world = buildWorld(G.rng);
  G.player = createPlayer(G.world.spots.garage.x, G.world.spots.garage.y);
  // Safety net: never spawn Rex overlapping a building — nudge north
  // until his circle is clear.
  let guard = 0;
  while (blockedCircle(G.world, G.player.x, G.player.y, CFG.playerRadius) && guard++ < 40) {
    G.player.y -= 5;
  }
  G.cars = vehicles.createVehicles(G.world, G.rng);
  G.traffic = {
    peds: traffic.createPedestrians(G.world, G.rng),
    fleeDriver: traffic.fleeDriver,
    scarePeds: traffic.scarePeds,
    updateTraffic: traffic.updateTraffic,
  };
  G.police = Object.assign(police.createPolice(), {
    addWanted: police.addWanted,
    busted: police.busted,
  });
  G.combat = Object.assign(combat.createCombat(), {
    fireBullet: combat.fireBullet,
    spawnThug: combat.spawnThug,
    updateCombat: combat.updateCombat,
  });
  G.missions = Object.assign(missions.createMissions(), {
    onEvent: missions.onEvent,
    onBusted: missions.onBusted,
    updateMissions: missions.updateMissions,
    setupStep: missions.setupStep,
    startMissions: missions.startMissions,
  });
  G.vehicles = {
    damageCar: vehicles.damageCar,
    tryEnterCar: vehicles.tryEnterCar,
    exitCar: vehicles.exitCar,
    updateVehicles: vehicles.updateVehicles,
    nearestCar: (g, x, y) => vehicles.nearestCar(g.cars, x, y, 100000, (c) => c.kind !== 'cop' && c.owner !== 'player'),
  };
  G.hud = {
    flash: hud.flash,
    drawHUD: hud.drawHUD,
    drawTitle: hud.drawTitle,
    drawPause: hud.drawPause,
    drawBusted: hud.drawBusted,
    drawWon: hud.drawWon,
  };
  G.playerCar = null;
  G.camera = { x: 0, y: 0 };
  G.time = 0;
  G.dt = 0.016;
  G.clockMinutes = 10 * 60;
  G.state = 'title';
  G.shotMode = false;
  G.bustedReason = '';
  G.bustedLost = 0;
  G.hudState = { flashMsg: '', flashT: 0 };
  G.playerHurt = (amount) => hurtPlayer(G, amount);
  missions.startMissions(G);
  G.missions.index = 0;
  G.missions.step = 0;
  missions.setupStep(G);
}

function saveGame(G) {
  if (G.shotMode) return;
  try {
    const data = {
      money: G.player.money,
      hp: G.player.hp,
      x: G.player.x,
      y: G.player.y,
      missionIndex: G.missions.index,
      missionStep: G.missions.step,
      clockMinutes: G.clockMinutes,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.saveData = data;
  } catch (err) { /* storage unavailable: the game still plays */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function applySave(G, data) {
  G.player.money = data.money || 0;
  G.player.hp = data.hp || CFG.playerHp;
  G.player.x = data.x;
  G.player.y = data.y;
  G.clockMinutes = data.clockMinutes || 10 * 60;
  G.missions.index = data.missionIndex || 0;
  G.missions.step = data.missionStep || 0;
  G.missions.done = false;
  missions.setupStep(G);
}

function startNewGame(G) {
  initGame(G);
  G.state = 'playing';
  G.audio.ensure();
}

function continueGame(G) {
  const data = G.saveData;
  initGame(G);
  if (data) applySave(G, data);
  G.state = 'playing';
  G.audio.ensure();
}

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const G = {
    canvas,
    ctx,
    input: new Input(canvas),
    audio: new AudioSys(),
    saveData: loadSave(),
    save: null,
    clearSave: null,
  };
  G.save = () => saveGame(G);
  G.clearSave = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
    G.saveData = null;
  };
  initGame(G);
  // Shot scenes (?shot=1..4) stage the game and freeze it for the camera.
  const params = new URLSearchParams(window.location.search);
  const shot = Number(params.get('shot') || 0);
  if (shot >= 1 && shot <= 4) {
    setupShot(G, shot);
  }
  // Audio unlocks on the first gesture.
  const unlock = () => G.audio.ensure();
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('mousedown', unlock, { once: false });
  window.__game = G;
  window.__NEONBAY = { version: 3, competition: 'gta6-01' };

  let prevE = false;
  let prevP = false;
  let prevM = false;
  let prevEnter = false;
  let bassT = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    G.dt = dt;
    if (!G.shotMode) G.time += dt;
    G.clockMinutes += dt * 0.5;
    if (G.hudState.flashT > 0) G.hudState.flashT -= dt;

    const input = G.input;
    const eDown = input.down('e');
    const pDown = input.down('p');
    const mDown = input.down('m');
    const enterDown = input.down('Enter');

    if (mDown && !prevM) {
      G.audio.toggleMute();
    }
    prevM = mDown;

    if (!G.shotMode) {
      if (G.state === 'title') {
        bassT += dt;
        if (bassT > 1) {
          bassT = 0;
          G.audio.bassPulse();
        }
        if ((enterDown && !prevEnter) || input.clicked) {
          if (G.saveData) continueGame(G);
          else startNewGame(G);
        }
      } else if (G.state === 'playing') {
        if (pDown && !prevP) {
          G.state = 'paused';
          G.save();
        }
        if (eDown && !prevE) {
          G.audio.ensure();
          vehicles.tryEnterCar(G);
        }
        updatePlayer(G, dt);
        vehicles.updateVehicles(G, dt);
        traffic.updateTraffic(G, dt);
        police.updatePolice(G, dt);
        combat.updateCombat(G, dt);
        missions.updateMissions(G, dt);
      } else if (G.state === 'paused') {
        if ((pDown && !prevP) || (enterDown && !prevEnter)) {
          G.state = 'playing';
        }
      } else if (G.state === 'busted') {
        if (enterDown && !prevEnter) {
          G.state = 'playing';
        }
      } else if (G.state === 'won') {
        if (enterDown && !prevEnter) {
          initGame(G);
          G.saveData = loadSave();
          G.state = 'title';
        }
      }
    }
    prevE = eDown;
    prevP = pDown;
    prevEnter = enterDown;

    updateCamera(G);
    drawGame(G);
    if (G.state === 'playing' || G.state === 'paused' || G.state === 'busted') {
      hud.drawHUD(G);
    }
    if (G.state === 'title') hud.drawTitle(G);
    else if (G.state === 'paused') hud.drawPause(G);
    else if (G.state === 'busted') hud.drawBusted(G);
    else if (G.state === 'won') hud.drawWon(G);

    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
