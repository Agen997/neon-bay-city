// Neon Bay — pedestrians: the crowds that make the city feel alive.
// They stroll the sidewalks, cross at junctions, and run when a shot
// is fired or a wanted chase rolls past them.
import { CFG, PED_COLORS } from './config.js';
import { distance, gauss } from './random.js';
import { isOnRoad, isWater, nearestRoadCenter, randomStreetPoint } from './world.js';

export function spawnPedestrian(game, x, y) {
  const rng = game.rng;
  const point = x === undefined ? randomStreetPoint(rng) : { x, y };
  return {
    x: point.x,
    y: point.y,
    angle: rng.range(0, Math.PI * 2),
    speed: Math.max(36, Math.min(86, gauss(rng, 60, 14))),
    color: rng.pick(PED_COLORS),
    skin: rng.pick(['#f2c89b', '#c98d5e', '#8a5a3b', '#f7d7b0']),
    walking: true,
    fleeing: false,
    down: false,
    waiting: false,
    waitTimer: 0,
    // Sidewalk target: the edge of the nearest road.
    targetX: point.x,
    targetY: point.y,
    retargetTimer: rng.range(2, 8),
  };
}

export function spawnPedestrians(game, count) {
  for (let i = 0; i < count; i += 1) {
    game.peds.push(spawnPedestrian(game));
  }
}

function pickSidewalkTarget(game, ped) {
  const rng = game.rng;
  // Walk to a point just off a road: the sidewalk band.
  const centers = [192, 448, 704, 960, 1216, 1472, 1728, 1984, 2240, 2496, 2752];
  const line = rng.pick(centers);
  const along = rng.range(160, 3000);
  const side = rng.chance(0.5) ? 48 : -48;
  if (rng.chance(0.5)) {
    ped.targetX = line + side;
    ped.targetY = along;
  } else {
    ped.targetX = along;
    ped.targetY = line + side;
  }
}

export function updatePedestrian(game, ped, dt) {
  if (ped.down) return;
  const player = game.player;
  const playerPos = player.car ? { x: player.car.x, y: player.car.y } : player;
  const danger = game.wanted > 0 || game.recentShotTimer > 0;
  const nearPlayer = distance(ped.x, ped.y, playerPos.x, playerPos.y);
  ped.fleeing = danger && nearPlayer < 420;
  ped.retargetTimer -= dt;
  if (ped.fleeing) {
    // Run away from the player.
    const away = Math.atan2(ped.y - playerPos.y, ped.x - playerPos.x);
    ped.angle = away;
    ped.speed = 190;
    ped.waiting = false;
  } else if (ped.retargetTimer <= 0 || distance(ped.x, ped.y, ped.targetX, ped.targetY) < 14) {
    // Reached the corner: sometimes stop and wait there a while, like a
    // person deciding where to go next, instead of marching on at once.
    if (game.rng.chance(0.3)) {
      ped.waiting = true;
      ped.waitTimer = game.rng.range(1.5, 4);
      ped.retargetTimer = game.rng.range(4, 10);
    } else {
      pickSidewalkTarget(game, ped);
      ped.retargetTimer = game.rng.range(4, 10);
      ped.speed = Math.max(36, Math.min(86, gauss(game.rng, 60, 14)));
    }
  }
  if (ped.waiting) {
    ped.waitTimer -= dt;
    if (ped.waitTimer <= 0) {
      ped.waiting = false;
      pickSidewalkTarget(game, ped);
      ped.retargetTimer = game.rng.range(4, 10);
      ped.speed = Math.max(36, Math.min(86, gauss(game.rng, 60, 14)));
    }
    return;
  }
  if (!ped.fleeing) {
    ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
  }
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  // Pedestrians cross roads freely; only the bay is off limits.
  if (!isWater(nx, ny)) {
    ped.x = nx;
    ped.y = ny;
  }
  // Keep pedestrians inside the city and out of buildings.
  let blocked = false;
  for (const b of game.world.buildings) {
    if (ped.x > b.x - 6 && ped.x < b.x + b.w + 6 && ped.y > b.y - 6 && ped.y < b.y + b.h + 6) {
      blocked = true;
      break;
    }
  }
  if (blocked) {
    ped.retargetTimer = 0;
  }
}

export function updatePedestrians(game, dt) {
  for (const ped of game.peds) updatePedestrian(game, ped, dt);
  // Thin the crowd back to the target size, or top it up.
  const target = game.shotMode ? 26 : CFG.pedCount;
  game.peds = game.peds.filter((ped) => !ped.down || game.rng.chance(0.995));
  while (game.peds.length < target) {
    const ped = spawnPedestrian(game);
    // Spawn newcomers near the player so the streets never feel empty.
    const p = game.player;
    ped.x = p.x + game.rng.range(-700, 700);
    ped.y = p.y + game.rng.range(-700, 700);
    if (ped.x < 120 || ped.y < 120 || ped.x > 2880 || ped.y > 3080) continue;
    game.peds.push(ped);
  }
}
