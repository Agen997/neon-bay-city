// Neon Bay — pedestrians. Crowds stroll the sidewalks and run when shots
// are fired; a stolen car's driver flees on foot the same way.
import { CFG } from './config.js';
import { blockedCircle } from './world.js';

const SHIRTS = ['#e8e8e8', '#d4a03a', '#3a9e80', '#c96f4a', '#7a4ac9', '#4a7ec9', '#e87a2a'];

export function createPedestrians(world, rng) {
  const peds = [];
  for (let i = 0; i < CFG.pedestrians; i++) {
    peds.push(spawnPed(world, rng));
  }
  return peds;
}

function spawnPed(world, rng) {
  const horizontal = rng.chance(0.5);
  const road = rng.pick(world.centers);
  const along = rng.range(60, CFG.citySize - 60);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = side * 42;
  return {
    x: horizontal ? along : road + off,
    y: horizontal ? road + off : along,
    angle: 0,
    speed: rng.range(38, 62),
    axis: horizontal ? 'x' : 'y',
    dir: rng.chance(0.5) ? 1 : -1,
    line: road + off,
    shirt: rng.pick(SHIRTS),
    flee: false,
    fleeT: 0,
    fleeX: 0,
    fleeY: 0,
    down: false,
    downT: 0,
  };
}

export function fleeDriver(G, x, y) {
  const ped = spawnPed(G.world, G.rng);
  ped.x = x;
  ped.y = y;
  ped.flee = true;
  ped.fleeT = 3;
  ped.fleeX = x;
  ped.fleeY = y;
  G.traffic.peds.push(ped);
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.traffic.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.flee = true;
      ped.fleeT = 2.5;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

export function updateTraffic(G, dt) {
  const world = G.world;
  for (const ped of G.traffic.peds) {
    if (ped.down) {
      ped.downT += dt;
      if (ped.downT > 6) {
        // Gets up and walks away, shaken.
        ped.down = false;
        ped.downT = 0;
        ped.flee = true;
        ped.fleeT = 2;
        ped.fleeX = G.player.x;
        ped.fleeY = G.player.y;
      }
      continue;
    }
    if (ped.flee) {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) {
        ped.flee = false;
      } else {
        const dx = ped.x - ped.fleeX;
        const dy = ped.y - ped.fleeY;
        const d = Math.hypot(dx, dy) || 1;
        const sp = ped.speed * 2.4;
        const nx = ped.x + (dx / d) * sp * dt;
        const ny = ped.y + (dy / d) * sp * dt;
        if (!blockedCircle(world, nx, ny, 10)) {
          ped.x = nx;
          ped.y = ny;
        }
        ped.angle = Math.atan2(dy, dx);
        continue;
      }
    }
    // Stroll along the sidewalk; turn at a junction sometimes.
    const step = ped.dir * ped.speed * dt;
    let nx = ped.x;
    let ny = ped.y;
    if (ped.axis === 'x') {
      nx += step;
      ny = ped.line;
    } else {
      ny += step;
      nx = ped.line;
    }
    for (const c of world.centers) {
      const crossed = ped.axis === 'x'
        ? (ped.dir > 0 ? ped.x < c && nx >= c : ped.x > c && nx <= c)
        : (ped.dir > 0 ? ped.y < c && ny >= c : ped.y > c && ny <= c);
      if (!crossed) continue;
      if (G.rng.chance(0.3)) {
        const side = G.rng.chance(0.5) ? 42 : -42;
        if (ped.axis === 'x') {
          ped.axis = 'y';
          ped.line = c + side;
          ped.dir = G.rng.chance(0.5) ? 1 : -1;
          nx = ped.line;
        } else {
          ped.axis = 'x';
          ped.line = c + side;
          ped.dir = G.rng.chance(0.5) ? 1 : -1;
          ny = ped.line;
        }
      }
      break;
    }
    if (nx < 30 || nx > CFG.citySize - 30) {
      ped.dir *= -1;
      nx = Math.max(30, Math.min(CFG.citySize - 30, nx));
    }
    if (ny < 30 || ny > CFG.citySize - 30) {
      ped.dir *= -1;
      ny = Math.max(30, Math.min(CFG.citySize - 30, ny));
    }
    ped.x = nx;
    ped.y = ny;
    ped.angle = ped.axis === 'x' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}
