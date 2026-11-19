// Neon Bay — cars and traffic. Parked cars wait to be stolen, traffic cars
// cruise the road grid and turn at junctions, and the player's car answers
// WASD. A car wedged on a corner can always back out: buildings sit back
// from the road edge and reverse is always available.
import { CFG, PALETTE } from './config.js';
import { isRoad, blockedCircle, moveCircle } from './world.js';

let nextCarId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    color,
    kind, // 'parked' | 'traffic' | 'cop' | 'player'
    owner: kind === 'player' ? 'player' : null,
    hp: 100,
    wrecked: false,
    // Traffic state: which road line it rides and which way.
    axis: 'x',
    dir: 1,
    road: y,
    offset: 0,
    driverFled: false,
  };
}

export function createVehicles(world, rng) {
  const cars = [];
  // Parked cars along the road edges, never on a junction.
  let placed = 0;
  let guard = 0;
  while (placed < CFG.parkedCars && guard++ < 400) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(world.centers);
    const along = rng.range(80, CFG.citySize - 80);
    let onJunction = false;
    for (const c of world.centers) {
      if (Math.abs(along - c) < 70) { onJunction = true; break; }
    }
    if (onJunction) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    const off = side * (CFG.roadW / 2 - 13);
    const x = horizontal ? along : road + off;
    const y = horizontal ? road + off : along;
    const angle = horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    cars.push(makeCar(x, y, angle, rng.pick(PALETTE.car), 'parked'));
    placed++;
  }
  // Traffic cars on the road centrelines.
  for (let i = 0; i < CFG.trafficCars; i++) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(world.centers);
    const along = rng.range(100, CFG.citySize - 100);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = makeCar(horizontal ? along : road, horizontal ? road : along,
      horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      rng.pick(PALETTE.car), 'traffic');
    car.axis = horizontal ? 'x' : 'y';
    car.dir = dir;
    car.road = road;
    car.offset = rng.chance(0.5) ? 9 : -9;
    car.speed = CFG.trafficSpeed * rng.range(0.8, 1.15);
    cars.push(car);
  }
  return cars;
}

export function nearestCar(cars, x, y, maxDist, want) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (c.wrecked) continue;
    if (want && !want(c)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Pressing E beside the player's own ride and a car worth stealing takes
// the car to steal, not the player's own.
export function tryEnterCar(G) {
  const p = G.player;
  if (p.inCar) {
    exitCar(G);
    return;
  }
  const stealable = nearestCar(G.cars, p.x, p.y, 58, (c) => c.kind !== 'cop' && c.owner !== 'player');
  const target = stealable || nearestCar(G.cars, p.x, p.y, 58, (c) => c.kind !== 'cop' && c.owner === 'player');
  if (!target) return;
  if (target.kind === 'traffic' && !target.driverFled) {
    target.driverFled = true;
    G.traffic.fleeDriver(G, target.x, target.y);
  }
  const wasSteal = target.owner !== 'player';
  target.kind = 'player';
  target.owner = 'player';
  target.speed = 0;
  p.inCar = target;
  G.playerCar = target;
  G.audio.carStart();
  if (wasSteal) {
    G.police.addWanted(G, 1, 'car stolen');
    G.missions.onEvent(G, 'steal');
  }
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  // Step out to the car's left side, clear of the body.
  const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  if (!blockedCircle(G.world, sx, sy, CFG.playerRadius)) {
    p.x = sx;
    p.y = sy;
  } else {
    p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 26;
  }
  p.angle = car.angle;
  car.speed = 0;
}

function carVsBuildings(world, car, nx, ny) {
  return blockedCircle(world, nx, ny, CFG.carRadius);
}

function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.inCar;
  const input = G.input;
  const forward = (input.down('w') || input.down('ArrowUp') ? 1 : 0) - (input.down('s') || input.down('ArrowDown') ? 0.7 : 0);
  const steer = (input.down('a') || input.down('ArrowLeft') ? 1 : 0) - (input.down('d') || input.down('ArrowRight') ? 1 : 0);
  if (forward > 0) car.speed += CFG.carAccel * dt;
  else if (forward < 0) car.speed -= CFG.carBrake * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
  car.speed = Math.max(-CFG.carReverseSpeed, Math.min(CFG.carMaxSpeed, car.speed));
  if (Math.abs(car.speed) > 5) {
    car.angle += steer * CFG.carTurn * dt * Math.sign(car.speed) * (car.speed < 0 ? -1 : 1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!carVsBuildings(G.world, car, nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Nudge out along each axis; a wedged car can always reverse away.
    if (!carVsBuildings(G.world, car, nx, car.y)) car.x = nx;
    else if (!carVsBuildings(G.world, car, car.x, ny)) car.y = ny;
    else {
      if (Math.abs(car.speed) > 120) {
        G.audio.crash();
        damageCar(G, car, 8);
      }
      car.speed *= -0.25;
    }
  }
  // Running over a pedestrian is a crime, and it costs a star.
  for (const ped of G.traffic.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26 && Math.abs(car.speed) > 60) {
      ped.down = true;
      ped.flee = true;
      G.police.addWanted(G, 1, 'pedestrian hit');
      G.audio.crash();
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function updateTrafficCar(G, car, dt) {
  const world = G.world;
  const step = car.dir * car.speed * dt;
  let nx = car.x;
  let ny = car.y;
  if (car.axis === 'x') {
    nx += step;
    ny = car.road + car.offset;
  } else {
    ny += step;
    nx = car.road + car.offset;
  }
  // At a junction, sometimes turn onto the crossing road.
  const centers = world.centers;
  for (const c of centers) {
    const crossed = car.axis === 'x'
      ? (car.dir > 0 ? car.x < c && nx >= c : car.x > c && nx <= c)
      : (car.dir > 0 ? car.y < c && ny >= c : car.y > c && ny <= c);
    if (!crossed) continue;
    if (G.rng.chance(0.35)) {
      const newDir = G.rng.chance(0.5) ? 1 : -1;
      if (car.axis === 'x') {
        car.axis = 'y';
        car.road = c;
        car.dir = newDir;
        car.offset = G.rng.chance(0.5) ? 9 : -9;
        nx = c + car.offset;
        ny = car.y;
      } else {
        car.axis = 'x';
        car.road = c;
        car.dir = newDir;
        car.offset = G.rng.chance(0.5) ? 9 : -9;
        ny = c + car.offset;
        nx = car.x;
      }
    }
    break;
  }
  // Keep inside the city; turn around at the edge.
  if (nx < 40 || nx > CFG.citySize - 40 || ny < 40 || ny > CFG.citySize - 40) {
    car.dir *= -1;
    nx = Math.max(40, Math.min(CFG.citySize - 40, nx));
    ny = Math.max(40, Math.min(CFG.citySize - 40, ny));
  }
  car.x = nx;
  car.y = ny;
  car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  // Gentle separation so traffic does not stack on one spot.
  for (const other of G.cars) {
    if (other === car || other.wrecked) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 34) {
      car.x += (dx / d) * 12 * dt;
      car.y += (dy / d) * 12 * dt;
    }
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.wrecked) continue;
    if (car === G.player.inCar) {
      updatePlayerCar(G, dt);
    } else if (car.kind === 'traffic') {
      updateTrafficCar(G, car, dt);
    }
    // Cop cars are driven by police.js.
  }
  // Player's car must stay on land.
  const pc = G.player.inCar;
  if (pc && (pc.x < 10 || pc.x > CFG.worldW - 10 || pc.y < 10 || pc.y > CFG.worldH - 10)) {
    pc.x = Math.max(10, Math.min(CFG.worldW - 10, pc.x));
    pc.y = Math.max(10, Math.min(CFG.worldH - 10, pc.y));
  }
}

export function damageCar(G, car, dmg) {
  if (car.wrecked) return;
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    if (G.player.inCar === car) {
      G.player.inCar = null;
      G.player.x = car.x + 30;
      G.player.y = car.y;
    }
    G.audio.crash();
  }
}

export function spawnCopCar(G, x, y) {
  const car = makeCar(x, y, 0, PALETTE.copCar, 'cop');
  car.hp = 120;
  G.cars.push(car);
  return car;
}

export function isOnRoadFor(G, x, y) {
  return isRoad(G.world, x, y);
}
