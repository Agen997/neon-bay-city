// Neon Bay — deterministic screenshot scenes.
// Each ?shot= mode stages the same city the player sees, with a fixed
// seed and fixed positions, so a screenshot is a reproducible render of
// the game's own code, never a staged mock-up.
import { createCar, spawnTrafficCar } from './vehicles.js';
import { spawnPedestrian } from './traffic.js';
import { spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';
import { spawnThug } from './combat.js';

function clearTraffic(game) {
  game.cars = [];
  game.peds = [];
  game.police = [];
  game.thugs = [];
  game.bullets = [];
  game.pickups = [];
}

function fillStreet(game, count) {
  for (let i = 0; i < count; i += 1) spawnTrafficCar(game);
  for (let i = 0; i < 26; i += 1) {
    const ped = spawnPedestrian(game);
    ped.x = game.player.x + game.rng.range(-600, 600);
    ped.y = game.player.y + game.rng.range(-420, 420);
    if (ped.x > 120 && ped.y > 120 && ped.x < 2880 && ped.y < 3080) game.peds.push(ped);
  }
}

function putPlayerInCar(game, x, y, angle, color) {
  const car = createCar(x, y, angle, color || '#ffcf3f', 'civilian');
  car.owned = true;
  car.owner = 'player';
  game.cars.push(car);
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  car.speed = 240;
  return car;
}

export function applyShot(game, name) {
  game.shotMode = name;
  const spots = game.world.spots;
  if (name === 'start') {
    // Title screen over a living downtown street.
    game.state = 'title';
    game.player.x = spots.plaza.x;
    game.player.y = spots.plaza.y;
    clearTraffic(game);
    putPlayerInCar(game, spots.plaza.x - 40, spots.plaza.y + 120, 0, '#ffcf3f');
    game.player.car = null;
    fillStreet(game, 8);
    return;
  }
  game.state = 'playing';
  if (name === 'play') {
    // Driving through traffic on Harbor Row, first job on the HUD.
    clearTraffic(game);
    game.player.x = 1216;
    game.player.y = 1472;
    putPlayerInCar(game, 1216, 1472, 0, '#ffcf3f');
    fillStreet(game, 10);
    game.missionIndex = 0;
    startMission(game, 0);
    game.missionStep = 2;
    game.dialogue = null;
  } else if (name === 'chase') {
    // Three-star chase: NBPD cruisers on the tail, minimap full of blue.
    clearTraffic(game);
    game.player.x = 1728;
    game.player.y = 960;
    const car = putPlayerInCar(game, 1728, 960, 0, '#ffcf3f');
    car.speed = 380;
    fillStreet(game, 7);
    game.wanted = 3;
    game.lastCrimeAt = game.elapsed;
    const cop1 = spawnPoliceCar(game);
    cop1.x = car.x - 260;
    cop1.y = car.y + 30;
    cop1.angle = 0;
    cop1.speed = 400;
    const cop2 = spawnPoliceCar(game);
    cop2.x = car.x - 320;
    cop2.y = car.y - 50;
    cop2.angle = 0;
    cop2.speed = 400;
    game.missionIndex = 3;
    startMission(game, 3);
    game.missionStep = 2;
    game.dialogue = null;
  } else if (name === 'mission') {
    // On foot on Neon Pier: cash drops, Tide Kings, and the objective.
    clearTraffic(game);
    game.player.x = spots.pier.x - 40;
    game.player.y = spots.pier.y + 20;
    game.player.car = null;
    game.wanted = 1;
    game.lastCrimeAt = game.elapsed;
    game.missionIndex = 2;
    startMission(game, 2);
    game.missionStep = 1;
    game.collectedDrops = 1;
    game.pickups.push(
      { x: spots.pier.x + 60, y: spots.pier.y + 30, kind: 'cash', taken: false },
      { x: spots.pier.x + 160, y: spots.pier.y - 10, kind: 'cash', taken: false },
    );
    spawnThug(game, spots.pier.x + 100, spots.pier.y - 40);
    spawnThug(game, spots.pier.x - 120, spots.pier.y + 50);
    spawnThug(game, spots.pier.x + 200, spots.pier.y + 40);
    for (let i = 0; i < 8; i += 1) {
      const ped = spawnPedestrian(game);
      ped.x = spots.pier.x + game.rng.range(-300, 300);
      ped.y = spots.pier.y + game.rng.range(-160, 160);
      game.peds.push(ped);
    }
  }
}
