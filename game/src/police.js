// Neon Bay — the wanted system and the Neon Bay Police Department.
// Crimes raise the star level; the level decides how many police cars
// and foot officers hunt the player, how fast they are, and how long the
// heat lasts once the player breaks line of sight.
import { CFG } from './config.js';
import { clamp, angleDelta, distance } from './random.js';
import { createCar, damageCar } from './vehicles.js';
import { damagePlayer } from './player.js';
import { nearestRoadCenter, collidesSolid } from './world.js';

export function addWanted(game, stars, reason) {
  if (game.state !== 'playing') return;
  const before = game.wanted;
  game.wanted = clamp(game.wanted + stars, 0, CFG.wantedMax);
  game.wantedTimer = 0;
  game.lastCrimeAt = game.elapsed;
  if (game.wanted > before) {
    game.addMessage(reason ? `${reason} — wanted level ${game.wanted}.` : `Wanted level ${game.wanted}.`);
    game.sound.tone(520, 0.18, 'square', 0.07, 780);
  }
}

export function wantedPoliceCount(level) {
  return level <= 0 ? 0 : Math.min(2 + level, 8);
}

function playerPosition(game) {
  const p = game.player;
  return p.car ? { x: p.car.x, y: p.car.y, inCar: true } : { x: p.x, y: p.y, inCar: false };
}

export function spawnPoliceCar(game) {
  const pos = playerPosition(game);
  const rng = game.rng;
  // Spawn on a road a little way off, so the chase arrives visibly.
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(520, 720);
  let x = pos.x + Math.cos(angle) * dist;
  let y = pos.y + Math.sin(angle) * dist;
  x = clamp(x, 140, 2880);
  y = clamp(y, 140, 3080);
  x = nearestRoadCenter(x);
  const car = createCar(x, y, 0, '#2f6bff', 'police');
  car.owner = 'police';
  car.speed = CFG.policeSpeed * 0.9;
  game.cars.push(car);
  game.police.push({ kind: 'car', car, arrestTimer: 0, ramCooldown: 0 });
  return car;
}

export function spawnFootOfficer(game) {
  const pos = playerPosition(game);
  const rng = game.rng;
  const angle = rng.range(0, Math.PI * 2);
  // Spawn on a road near the player, not at a random point: a random
  // point can land inside a building, and an officer who starts inside
  // one can never walk out of it to make the arrest.
  let x = pos.x + Math.cos(angle) * rng.range(280, 420);
  let y = pos.y + Math.sin(angle) * rng.range(280, 420);
  if (Math.abs(x - nearestRoadCenter(x)) < Math.abs(y - nearestRoadCenter(y))) {
    x = nearestRoadCenter(x);
  } else {
    y = nearestRoadCenter(y);
  }
  const officer = {
    kind: 'foot',
    x: clamp(x, 120, 2880),
    y: clamp(y, 120, 3080),
    angle: 0,
    speed: 195,
    health: 60,
    shootCooldown: rng.range(0.5, 1.4),
    arrestTimer: 0,
  };
  game.police.push(officer);
  return officer;
}

function updatePoliceCar(game, unit, dt) {
  const car = unit.car;
  if (car.wrecked) {
    unit.dead = true;
    return;
  }
  const pos = playerPosition(game);
  // Heat off: the cruiser breaks off the chase and leaves town. Once it is
  // far enough away it is gone, instead of hunting the player forever.
  // After a ram the cruiser also backs off: it turns away and coasts while
  // its ram cooldown runs, so it cannot stay glued to the player's car
  // dealing damage every frame.
  const leaving = game.wanted === 0;
  unit.ramCooldown = Math.max(0, (unit.ramCooldown || 0) - dt);
  const backingOff = unit.ramCooldown > 0;
  const targetAngle = leaving || backingOff
    ? Math.atan2(car.y - pos.y, car.x - pos.x)
    : Math.atan2(pos.y - car.y, pos.x - car.x);
  car.angle += angleDelta(car.angle, targetAngle) * Math.min(1, dt * 2.2);
  car.speed = backingOff
    ? Math.min(car.speed, 200)
    : Math.min(CFG.policeSpeed, car.speed + 320 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Police drive through the city, not through buildings: slide along walls.
  if (!collidesSolid(game.world, nx, car.y, 20)) car.x = nx;
  else car.speed *= 0.5;
  if (!collidesSolid(game.world, car.x, ny, 20)) car.y = ny;
  else car.speed *= 0.5;
  car.x = clamp(car.x, 24, 2880);
  car.y = clamp(car.y, 24, 3080);
  car.sirenPhase += dt;
  const d = distance(car.x, car.y, pos.x, pos.y);
  if (leaving) {
    if (d > 900) unit.dead = true;
    return;
  }
  // Ram the player's car, or the player on foot. One ram per cooldown:
  // the cruiser bounces off and has to come back for another one.
  if (d < 46 && unit.ramCooldown <= 0) {
    if (pos.inCar && game.player.car) {
      damageCar(game, game.player.car, CFG.policeRamDps * dt);
      game.shake = Math.min(10, game.shake + 3);
    } else if (!pos.inCar) {
      damagePlayer(game, 12 * dt * 4, 'a police cruiser');
    }
    car.speed *= 0.55;
    unit.ramCooldown = CFG.policeRamCooldown;
  }
}

function updateFootOfficer(game, unit, dt) {
  const pos = playerPosition(game);
  const d = distance(unit.x, unit.y, pos.x, pos.y);
  // Step in a direction, sliding around a building instead of walking
  // through it: try the direction, then deflections around the circle.
  // A single pair of deflections strands an officer in a building's
  // inside corner, so the search covers the full half-circle.
  const step = (angle) => {
    const s = unit.speed * dt;
    const deflections = [0, Math.PI / 3, -Math.PI / 3, (2 * Math.PI) / 3, (-2 * Math.PI) / 3, Math.PI];
    for (const deflect of deflections) {
      const a = angle + deflect;
      const nx = unit.x + Math.cos(a) * s;
      const ny = unit.y + Math.sin(a) * s;
      if (!collidesSolid(game.world, nx, ny, 12)) {
        unit.x = nx;
        unit.y = ny;
        return true;
      }
    }
    return false;
  };
  // Heat off: the officer stands down and walks away, and is gone once
  // far enough from the player.
  if (game.wanted === 0) {
    unit.arrestTimer = 0;
    const away = Math.atan2(unit.y - pos.y, unit.x - pos.x);
    unit.angle = away;
    step(away);
    if (d > 800) unit.dead = true;
    return;
  }
  unit.angle = Math.atan2(pos.y - unit.y, pos.x - unit.x);
  if (d > 34) step(unit.angle);
  // Close enough on foot: the arrest begins.
  if (!pos.inCar && d < 40) {
    unit.arrestTimer += dt;
    if (unit.arrestTimer > 1.6) {
      game.state = 'busted';
      game.sound.busted();
      game.addMessage('Busted! The NBPD hauled you in.');
    }
  } else {
    unit.arrestTimer = 0;
  }
  // Officers fire at a fleeing player who is already wanted. A driver is
  // behind steel: the bullets hit the car, not the person inside it.
  unit.shootCooldown -= dt;
  if (unit.shootCooldown <= 0 && d < 380 && d > 60) {
    unit.shootCooldown = game.rng.range(1.1, 1.9);
    if (game.rng.chance(CFG.officerHitChance)) {
      if (pos.inCar && game.player.car) {
        damageCar(game, game.player.car, CFG.officerDamage);
        game.addParticles(game.player.car.x, game.player.car.y, '#ffd166', 4);
      } else {
        damagePlayer(game, CFG.officerDamage, 'an NBPD officer');
        game.addParticles(pos.x, pos.y, '#ffd166', 4);
      }
    }
    game.sound.shoot();
  }
}

export function updatePolice(game, dt) {
  const level = game.wanted;
  // Wanted decays only while the player stays out of trouble: once 26
  // quiet seconds have passed, a star drops every 6 seconds. The clock
  // is the last crime, not the last star lost — resetting it on every
  // decay would re-impose the 26-second wait per star, and the heat
  // would take over a minute and a half to cool off from three stars.
  if (level > 0 && game.elapsed - game.lastCrimeAt > CFG.wantedDecaySeconds) {
    game.wantedTimer += dt;
    if (game.wantedTimer > 6) {
      game.wanted -= 1;
      game.wantedTimer = 0;
      game.addMessage(`Heat cooling off — wanted level ${game.wanted}.`);
    }
  }
  const wantCars = level <= 0 ? 0 : Math.min(1 + Math.floor(level / 2), 4);
  const wantFoot = level <= 0 ? 0 : Math.min(level, 4);
  const carsNow = game.police.filter((u) => u.kind === 'car' && !u.dead).length;
  const footNow = game.police.filter((u) => u.kind === 'foot' && !u.dead).length;
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = 2.2;
    if (carsNow < wantCars) spawnPoliceCar(game);
    else if (footNow < wantFoot) spawnFootOfficer(game);
  }
  for (const unit of game.police) {
    if (unit.dead) continue;
    if (unit.kind === 'car') updatePoliceCar(game, unit, dt);
    else updateFootOfficer(game, unit, dt);
  }
  // Wrecked police cars stop counting as a unit.
  for (const unit of game.police) {
    if (unit.kind === 'car' && unit.car.wrecked) unit.dead = true;
  }
  game.police = game.police.filter((u) => !u.dead);
  const anyNear = game.police.some((u) => {
    const p = playerPosition(game);
    const q = u.kind === 'car' ? u.car : u;
    return distance(q.x, q.y, p.x, p.y) < 700;
  });
  game.sound.updateSiren(dt, anyNear);
}
