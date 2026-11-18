// Neon Bay — the game loop and the state machine.
// Title, playing, paused, busted, dead and won all run through here.
// The world, the player, the traffic, the police, the missions and the
// HUD are separate modules; this file only wires them together.
import { CFG } from './config.js';
import { makeRng, clamp } from './random.js';
import { buildCity } from './world.js';
import { createInput } from './input.js';
import { createSoundBank } from './audio.js';
import { createPlayer, updatePlayerOnFoot, tryEnterOrExitCar, playerAimAngle } from './player.js';
import { spawnParkedCars, spawnTrafficCar, updateTrafficCar, drivePlayerCar, carHitsPedestrian } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './traffic.js';
import { addWanted, updatePolice } from './police.js';
import { firePistol, meleeSwing, updateBullets, updateThugs } from './combat.js';
import { startMission, updateMissions, updatePickups, currentMission, respawnMissionCrew } from './missions.js';
import { drawWorld, drawEntities } from './render.js';
import { drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'neon-bay-save-v1';

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot'),
    seed: Number(params.get('seed') || 1337),
  };
}

function createGame(canvas) {
  const query = readQuery();
  const rng = makeRng(query.seed);
  const world = buildCity(query.seed);
  const game = {
    canvas,
    ctx: canvas.getContext('2d'),
    rng,
    world,
    seed: query.seed,
    shotMode: query.shot,
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    state: 'title',
    elapsed: 0,
    shake: 0,
    wanted: 0,
    wantedTimer: 0,
    lastCrimeAt: -999,
    spawnTimer: 1,
    recentShotTimer: 0,
    meleeArc: 0,
    missionIndex: 0,
    missionStep: 0,
    missionActive: false,
    missionTimer: 0,
    startMissionTimer: 0,
    holdProgress: 0,
    collectedDrops: 0,
    won: false,
    hasSave: false,
    messages: [],
    dialogue: null,
    dialogueTimer: 0,
    cars: [],
    peds: [],
    police: [],
    thugs: [],
    bullets: [],
    particles: [],
    pickups: [],
    camera: { x: world.spots.hideout.x, y: world.spots.hideout.y, zoom: CFG.cameraZoom },
    input: null,
    sound: createSoundBank(),
    saveTimer: 0,
  };
  game.player = createPlayer(world.spots.hideout.x, world.spots.hideout.y - 60);
  game.input = createInput(canvas);

  game.addMessage = (text) => {
    game.messages.push({ text, life: 6 });
    if (game.messages.length > 5) game.messages.shift();
  };
  game.addCash = (amount, reason) => {
    game.player.cash += amount;
    game.addMessage(`+$${amount} — ${reason}.`);
  };
  game.addWanted = (stars, reason) => addWanted(game, stars, reason);
  game.addParticles = (x, y, color, count) => {
    for (let i = 0; i < count; i += 1) {
      const a = game.rng.range(0, Math.PI * 2);
      const speed = game.rng.range(40, 190);
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: game.rng.range(0.3, 0.7),
        maxLife: 0.7,
        size: game.rng.range(2, 5),
        color,
      });
    }
  };
  game.setDialogue = (speaker, lines) => {
    game.dialogue = { speaker, lines, lineIndex: 0 };
    game.dialogueTimer = 0;
  };
  game.saveGame = () => {
    try {
      const p = game.player;
      const save = {
        x: p.x,
        y: p.y,
        health: p.health,
        cash: p.cash,
        missionIndex: game.missionIndex,
        wanted: game.wanted,
        elapsed: game.elapsed,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Saving is a courtesy; a blocked store must never stop the game.
    }
  };
  game.loadSave = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  game.hasSave = !!game.loadSave();
  spawnParkedCars(game);
  spawnPedestrians(game, CFG.pedCount);
  for (let i = 0; i < CFG.trafficTarget; i += 1) spawnTrafficCar(game);
  return game;
}

function resizeCanvas(game) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (game.canvas.width !== w || game.canvas.height !== h) {
    game.canvas.width = w;
    game.canvas.height = h;
    game.viewW = w;
    game.viewH = h;
  }
}

function startNewGame(game) {
  game.state = 'playing';
  game.missionIndex = 0;
  game.missionStep = 0;
  game.missionActive = false;
  game.startMissionTimer = 0.6;
  game.wanted = 0;
  game.player.health = CFG.playerMaxHealth;
  game.player.cash = CFG.startCash;
  game.sound.ensure();
  game.addMessage('Welcome to Neon Bay, Rex.');
}

function continueGame(game) {
  const save = game.loadSave();
  if (!save) {
    startNewGame(game);
    return;
  }
  game.player.x = save.x;
  game.player.y = save.y;
  game.player.health = save.health;
  game.player.cash = save.cash;
  game.player.car = null;
  game.missionIndex = Math.min(save.missionIndex, 4);
  game.missionStep = 0;
  game.missionActive = false;
  game.startMissionTimer = 0.6;
  // The save records the heat; restore it, and drop the police that were
  // chasing a player who no longer stands where the save was made.
  game.wanted = save.wanted || 0;
  game.lastCrimeAt = game.elapsed;
  game.wantedTimer = 0;
  game.police = [];
  game.thugs = [];
  game.state = 'playing';
  game.sound.ensure();
  game.addMessage('Back on the streets of Neon Bay.');
}

function respawnAfterEnd(game) {
  const p = game.player;
  const wasBusted = game.state === 'busted';
  p.health = CFG.playerMaxHealth;
  p.cash = Math.max(0, p.cash - (wasBusted ? 200 : 0));
  p.car = null;
  p.x = game.world.spots.hideout.x;
  p.y = game.world.spots.hideout.y - 60;
  game.wanted = 0;
  game.police = [];
  game.thugs = [];
  game.state = 'playing';
  game.addMessage(wasBusted ? 'Mara posted bail. $200 gone.' : 'Patched up and back out there.');
  // The job picks up where it was left — and if it was a fight, the crew
  // is back too, so a bust cannot skip the boss.
  respawnMissionCrew(game);
}

function updatePlaying(game, dt) {
  const input = game.input;
  const p = game.player;
  game.recentShotTimer = Math.max(0, game.recentShotTimer - dt);
  game.meleeArc = Math.max(0, game.meleeArc - dt);
  // Dialogue advances on click or after a few seconds. A click that
  // advances the dialogue is spent there: it must not also fire the pistol.
  let clickUsedByDialogue = false;
  if (game.dialogue) {
    game.dialogueTimer += dt;
    if (input.mouseClicked || game.dialogueTimer > 6) {
      clickUsedByDialogue = input.mouseClicked;
      game.dialogue.lineIndex += 1;
      game.dialogueTimer = 0;
      if (game.dialogue.lineIndex >= game.dialogue.lines.length) game.dialogue = null;
    }
  }
  if (input.wasPressed('KeyE')) tryEnterOrExitCar(game);
  if (input.wasPressed('KeyP')) {
    game.state = 'paused';
    game.saveGame();
    return;
  }
  if (input.wasPressed('KeyM')) {
    game.sound.muted = !game.sound.muted;
    game.addMessage(game.sound.muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('Space')) meleeSwing(game);
  if (input.mouseClicked && !game.dialogue && !clickUsedByDialogue) firePistol(game);
  else if (input.mouseDown && !game.dialogue) firePistol(game);

  if (p.car) {
    // A wrecked car is done: the driver is thrown out instead of driving
    // a burning shell around the city.
    if (p.car.wrecked) {
      p.car = null;
      game.addMessage('Your car is wrecked — you bail out.');
      game.sound.hit();
    } else {
      drivePlayerCar(game, p.car, dt);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      carHitsPedestrian(game, p.car);
    }
  } else {
    updatePlayerOnFoot(game, dt);
  }
  for (const car of game.cars) {
    if (car.owner !== 'player' && car.kind !== 'police') updateTrafficCar(game, car, dt);
  }
  // Keep the streets busy.
  const traffic = game.cars.filter((c) => c.owner === 'traffic' && c.kind === 'civilian' && !c.wrecked);
  if (traffic.length < CFG.trafficTarget) spawnTrafficCar(game);
  game.cars = game.cars.filter((c) => !c.wrecked || c.owner === 'player' || c.kind === 'police');
  updatePedestrians(game, dt);
  updatePolice(game, dt);
  updateBullets(game, dt);
  updateThugs(game, dt);
  updateMissions(game, dt);
  updatePickups(game, dt);
  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  // Messages fade.
  for (const msg of game.messages) msg.life -= dt;
  game.messages = game.messages.filter((msg) => msg.life > 0);
  // Camera follows the player or their car.
  const focus = p.car || p;
  game.camera.x += (focus.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (focus.y - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = clamp(game.camera.x, game.viewW / 2 - 100, CFG.worldSize - game.viewW / 2 + 100);
  game.camera.y = clamp(game.camera.y, game.viewH / 2 - 100, CFG.worldSize - game.viewH / 2 + 100);
  // Autosave.
  game.saveTimer += dt;
  if (game.saveTimer > 15) {
    game.saveTimer = 0;
    game.saveGame();
  }
}

function render(game) {
  const ctx = game.ctx;
  const cam = game.camera;
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  const shakeX = game.shake > 0 ? (game.rng.next() - 0.5) * game.shake : 0;
  const shakeY = game.shake > 0 ? (game.rng.next() - 0.5) * game.shake : 0;
  ctx.save();
  ctx.translate(game.viewW / 2, game.viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
  drawWorld(ctx, game);
  drawEntities(ctx, game);
  ctx.restore();
  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'playing') drawHUD(ctx, game);
  else if (game.state === 'paused') {
    drawHUD(ctx, game);
    drawPause(ctx, game);
  } else if (game.state === 'dead' || game.state === 'busted' || game.state === 'won') {
    drawHUD(ctx, game);
    drawEndScreen(ctx, game, game.state);
  }
  game.shake = Math.max(0, game.shake - 30 * (1 / 60));
}

function frame(game, now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  resizeCanvas(game);
  if (game.state !== 'paused') game.elapsed += dt;
  const input = game.input;
  if (game.state === 'title') {
    game.sound.updateTitleMusic(dt, true);
    if (input.wasPressed('Enter')) {
      if (game.hasSave && !input.isDown('KeyN')) continueGame(game);
      else startNewGame(game);
    }
    if (input.wasPressed('KeyN')) startNewGame(game);
    // Drift the camera over the city behind the title.
    game.camera.x = 1472 + Math.sin(game.elapsed * 0.05) * 500;
    game.camera.y = 1472 + Math.cos(game.elapsed * 0.04) * 400;
  } else if (game.state === 'playing') {
    updatePlaying(game, dt);
  } else if (game.state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Enter')) game.state = 'playing';
    if (input.wasPressed('KeyQ')) {
      game.state = 'title';
      game.hasSave = !!game.loadSave();
    }
  } else if (game.state === 'dead' || game.state === 'busted' || game.state === 'won') {
    if (input.wasPressed('Enter')) respawnAfterEnd(game);
  }
  // Clear one-shot inputs right after the update consumed them, before
  // rendering: a click landing during the render must survive to the
  // next frame's update instead of being swallowed.
  input.endFrame();
  render(game);
  requestAnimationFrame((t) => frame(game, t));
}

function boot() {
  const canvas = document.getElementById('game');
  const game = createGame(canvas);
  window.__game = game;
  if (game.shotMode) {
    applyShot(game, game.shotMode);
  }
  resizeCanvas(game);
  requestAnimationFrame((t) => frame(game, t));
}

boot();
