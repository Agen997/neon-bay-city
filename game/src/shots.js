// Neon Bay — deterministic screenshot scenes.
// Each ?shot= mode stages the same city the player sees, with a fixed
// seed and fixed positions, so a screenshot is a reproducible render of
// the game's own code, never a staged mock-up.
import { createCar, spawnTrafficCar } from './vehicles.js';
import { spawnPedestrian } from './traffic.js';
import { spawnPoliceCar, spawnFootOfficer } from './police.js';
import { startMission, spawnKingCrew } from './missions.js';
import { spawnThug } from './combat.js';
import { LIGHTHOUSE_BEACH } from './world.js';
import { CFG } from './config.js';

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
  for (let i = 0; i < 34; i += 1) {
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
  // The player's ride is sturdier than a random traffic car, staged or
  // stolen: the same bump entering a car gives it in player.js.
  car.health = CFG.playerCarHealth;
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
    // Title screen over a living downtown street: the cover shot, so it
    // is the busiest scene — traffic, crowds, parked cars and the plaza.
    game.state = 'title';
    game.player.x = spots.plaza.x;
    game.player.y = spots.plaza.y;
    clearTraffic(game);
    const parked = putPlayerInCar(game, spots.plaza.x - 40, spots.plaza.y + 120, 0, '#ffcf3f');
    parked.speed = 0;
    game.player.car = null;
    // A second parked car and a cruiser rolling past the plaza.
    const parked2 = createCar(spots.plaza.x + 150, spots.plaza.y - 90, Math.PI / 2, '#4a90e8', 'civilian');
    parked2.parked = true;
    game.cars.push(parked2);
    const cruiser = spawnPoliceCar(game);
    cruiser.x = spots.plaza.x - 260;
    cruiser.y = spots.plaza.y + 30;
    cruiser.angle = 0;
    cruiser.speed = 240;
    fillStreet(game, 16);
    for (let i = 0; i < 10; i += 1) {
      const ped = spawnPedestrian(game);
      ped.x = spots.plaza.x + game.rng.range(-320, 320);
      ped.y = spots.plaza.y + game.rng.range(-260, 260);
      game.peds.push(ped);
    }
    return;
  }
  game.state = 'playing';
  if (name === 'play') {
    // Driving through traffic on Harbor Row, first job on the HUD.
    clearTraffic(game);
    game.player.x = 1216;
    game.player.y = 1472;
    putPlayerInCar(game, 1216, 1472, 0, '#ffcf3f');
    // A second car right beside the player, so the street reads as busy.
    const other = createCar(1216, 1472 - 90, 0, '#4a90e8', 'civilian');
    other.speed = 200;
    game.cars.push(other);
    // One wanted star and a cruiser on the tail already: the drive shot
    // shows the heat system too, not just the traffic.
    game.wanted = 1;
    game.lastCrimeAt = game.elapsed;
    const cop = spawnPoliceCar(game);
    cop.x = 1216 - 280;
    cop.y = 1472 + 60;
    cop.angle = 0;
    cop.speed = 320;
    fillStreet(game, 14);
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
    fillStreet(game, 10);
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
    const cop3 = spawnPoliceCar(game);
    cop3.x = car.x - 180;
    cop3.y = car.y + 110;
    cop3.angle = 0;
    cop3.speed = 400;
    // A cash drop the chase just passed, and a pedestrian running clear.
    game.pickups.push({ x: car.x + 160, y: car.y + 80, kind: 'cash', taken: false });
    for (let i = 0; i < 6; i += 1) {
      const ped = spawnPedestrian(game);
      ped.x = car.x + game.rng.range(-420, 420);
      ped.y = car.y + game.rng.range(-300, 300);
      game.peds.push(ped);
    }
    // A foot officer closing in on the sidewalk, for the minimap and the street.
    const officer = spawnFootOfficer(game);
    officer.x = car.x + 220;
    officer.y = car.y - 160;
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
    game.wanted = 2;
    game.lastCrimeAt = game.elapsed;
    game.missionIndex = 2;
    startMission(game, 2);
    game.missionStep = 1;
    game.collectedDrops = 1;
    game.pickups.push(
      { x: spots.pier.x + 60, y: spots.pier.y + 30, kind: 'cash', taken: false },
      { x: spots.pier.x + 90, y: spots.pier.y - 10, kind: 'cash', taken: false },
      { x: spots.pier.x - 90, y: spots.pier.y + 60, kind: 'health', taken: false },
    );
    // Every thug stands on the pier boards, not in the water past its end.
    spawnThug(game, spots.pier.x + 80, spots.pier.y - 40);
    spawnThug(game, spots.pier.x - 120, spots.pier.y + 50);
    spawnThug(game, spots.pier.x + 90, spots.pier.y + 40);
    spawnThug(game, spots.pier.x + 40, spots.pier.y + 50);
    // A cruiser rolling down the pier road, so the heat is visible too.
    const cop = spawnPoliceCar(game);
    cop.x = 2752;
    cop.y = 1600;
    cop.angle = 0;
    cop.speed = 380;
    for (let i = 0; i < 10; i += 1) {
      const ped = spawnPedestrian(game);
      ped.x = spots.pier.x + game.rng.range(-300, 300);
      ped.y = spots.pier.y + game.rng.range(-160, 160);
      game.peds.push(ped);
    }
  } else if (name === 'king') {
    // The boss fight, on the lighthouse beach: King and his crew leashed
    // to the sand, the lighthouse beam over the bay, two wanted stars and
    // a cruiser closing in on the beach road. The camera frames the beach
    // itself, so the fight reads as a beach fight.
    clearTraffic(game);
    game.player.x = LIGHTHOUSE_BEACH.x - 60;
    game.player.y = LIGHTHOUSE_BEACH.y + 60;
    game.player.car = null;
    game.wanted = 2;
    game.lastCrimeAt = game.elapsed;
    game.missionIndex = 4;
    startMission(game, 4);
    game.missionStep = 1;
    game.dialogue = null;
    spawnKingCrew(game);
    // The boss bar shows while King is alive; a health pack and a cash
    // drop on the sand, and a cruiser on the beach road for the heat.
    game.pickups.push(
      { x: LIGHTHOUSE_BEACH.x - 120, y: LIGHTHOUSE_BEACH.y + 120, kind: 'health', taken: false },
      { x: LIGHTHOUSE_BEACH.x + 90, y: LIGHTHOUSE_BEACH.y - 80, kind: 'cash', taken: false },
    );
    const cop = spawnPoliceCar(game);
    cop.x = 2752;
    cop.y = 340;
    cop.angle = 0;
    cop.speed = 380;
    for (let i = 0; i < 8; i += 1) {
      const ped = spawnPedestrian(game);
      ped.x = 2752 + game.rng.range(-160, 160);
      ped.y = 340 + game.rng.range(-260, 260);
      if (ped.x < 2880) game.peds.push(ped);
    }
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
  }
}
