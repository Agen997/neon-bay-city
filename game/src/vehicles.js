// Neon Bay — cars: the player's ride, the traffic that fills the roads,
// and the arcade driving model both share. Traffic cars cruise their
// road and turn at junctions; the player's car answers W/A/S/D.
import { CFG, CAR_COLORS } from './config.js';
import { clamp, angleDelta, distance } from './random.js';
import { collidesSolid, nearestRoadCenter, roadCenters, isOnRoad } from './world.js';

let carId = 0;

export function createCar(x, y, angle, color, kind) {
  carId += 1;
  return {
    id: carId,
    x,
    y,
    angle,
    speed: 0,
    color: color || CAR_COLORS[carId % CAR_COLORS.length],
    kind: kind || 'civilian',
    owner: 'traffic',
    owned: false,
    wrecked: false,
    health: 100,
    sirenPhase: 0,
    // Traffic AI state: which road it follows and which way it drives.
    roadAxis: 'x',
    roadLine: y,
    dir: 1,
    stuckTimer: 0,
  };
}

export function spawnParkedCars(game) {
  const rng = game.rng;
  const spots = game.world.spots;
  // A few parked cars on roads near the marina, the market and the plaza.
  // Every anchor sits on a road centre, never inside a block, so no car
  // ever spawns wedged against a building.
  const anchors = [
    { x: spots.marina.x - 60, y: spots.marina.y + 40 },
    { x: spots.marina.x + 60, y: spots.marina.y - 40 },
    { x: spots.market.x, y: spots.market.y + 30 },
    { x: spots.plaza.x - 90, y: spots.plaza.y - 60 },
    { x: spots.hideout.x, y: spots.hideout.y + 190 },
    { x: spots.diner.x, y: spots.diner.y + 80 },
  ];
  for (const a of anchors) {
    const car = createCar(a.x, a.y, rng.range(0, Math.PI * 2), rng.pick(CAR_COLORS), 'civilian');
    car.speed = 0;
    game.cars.push(car);
  }
  // The player's starter car, already owned, on the road by Mara's garage.
  const starter = createCar(spots.hideout.x, spots.hideout.y + 110, -Math.PI / 2, '#ffcf3f', 'civilian');
  starter.owned = true;
  starter.owner = 'player';
  game.cars.push(starter);
  game.starterCar = starter;
}

export function spawnTrafficCar(game) {
  const rng = game.rng;
  const centers = roadCenters();
  const vertical = rng.chance(0.5);
  const line = rng.pick(centers);
  const along = rng.range(200, CFG.worldSize - 260);
  const car = createCar(
    vertical ? line : along,
    vertical ? along : line,
    vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
    rng.pick(CAR_COLORS),
    'civilian',
  );
  car.roadAxis = vertical ? 'y' : 'x';
  car.roadLine = line;
  car.dir = car.angle === 0 || car.angle === Math.PI / 2 ? 1 : -1;
  car.speed = CFG.trafficSpeed * rng.range(0.8, 1.15);
  game.cars.push(car);
  return car;
}

function trafficTargetAngle(car) {
  return car.roadAxis === 'y'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.dir > 0 ? 0 : Math.PI);
}

// Traffic follows its road, slows for the car ahead, turns at junctions.
export function updateTrafficCar(game, car, dt) {
  if (car.owner === 'player' || car.kind === 'police') return;
  const target = trafficTargetAngle(car);
  car.angle += angleDelta(car.angle, target) * Math.min(1, dt * 3);
  // Keep the car centred on its road line.
  const line = car.roadLine;
  const drift = car.roadAxis === 'y' ? car.x - line : car.y - line;
  car.angle += clamp(-drift * 0.0012, -0.02, 0.02);
  // Slow down when another car is close ahead.
  let ahead = false;
  for (const other of game.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 70 && side < 26) {
      ahead = true;
      break;
    }
  }
  const want = ahead ? 0 : CFG.trafficSpeed;
  car.speed += clamp(want - car.speed, -260 * dt, 180 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (isOnRoad(nx, ny) || car.speed < 1) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed = 0;
  }
  // At a junction, sometimes turn onto the crossing road.
  const nearCenter = Math.abs(nearestRoadCenter(car.x) - car.x) < 8 || Math.abs(nearestRoadCenter(car.y) - car.y) < 8;
  if (nearCenter && game.rng.chance(dt * 0.25)) {
    if (car.roadAxis === 'y') {
      car.roadAxis = 'x';
      car.roadLine = nearestRoadCenter(car.y);
      car.dir = game.rng.chance(0.5) ? 1 : -1;
    } else {
      car.roadAxis = 'y';
      car.roadLine = nearestRoadCenter(car.x);
      car.dir = game.rng.chance(0.5) ? 1 : -1;
    }
  }
  // Recycle cars that drifted off the map edge.
  if (car.x < 60 || car.x > CFG.worldSize - 60 || car.y < 60 || car.y > CFG.worldSize - 60) {
    car.wrecked = true;
  }
}

export function drivePlayerCar(game, car, dt) {
  const input = game.input;
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  if (forward) car.speed += CFG.carAccel * dt;
  if (back) car.speed -= (car.speed > 10 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  car.speed = clamp(car.speed, -CFG.carReverseSpeed, CFG.carMaxSpeed);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const moving = Math.abs(car.speed) > 12;
  if (moving && steer !== 0) {
    car.angle += steer * CFG.carTurn * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 160);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesSolid(game.world, nx, car.y, CFG.carRadius)) {
    car.x = nx;
  } else {
    car.speed *= 0.4;
  }
  if (!collidesSolid(game.world, car.x, ny, CFG.carRadius)) {
    car.y = ny;
  } else {
    car.speed *= 0.4;
  }
  car.x = clamp(car.x, 24, CFG.worldSize - 24);
  car.y = clamp(car.y, 24, CFG.worldSize - 24);
  if (Math.abs(car.speed) > 60) game.sound.engine(true);
}

export function carHitsPedestrian(game, car) {
  for (const ped of game.peds) {
    if (ped.down) continue;
    if (distance(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 90) {
      ped.down = true;
      ped.fleeing = false;
      game.addWanted(1, 'Pedestrian hit');
      game.addParticles(ped.x, ped.y, '#ff5b5b', 10);
      game.shake = Math.min(12, game.shake + 5);
    }
  }
}

export function damageCar(game, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    game.addParticles(car.x, car.y, '#ff9f1c', 18);
    game.addParticles(car.x, car.y, '#555', 12);
    game.shake = Math.min(12, game.shake + 6);
  }
}
