// Neon Bay — the generated city. Eleven roads each way, colourful blocks,
// parks, a plaza, a night market, a marina, a pier and the bay, all grown
// from one seed so the same seed builds the same town every time.
import { CFG, PALETTE } from './config.js';

export function roadCenters() {
  const out = [];
  for (let i = 0; i < CFG.roads; i++) out.push(32 + i * CFG.pitch);
  return out;
}

export function buildWorld(rng) {
  const centers = roadCenters();
  const blocks = [];
  const buildings = [];
  const props = [];
  // Special blocks by (bx, by): parks, plaza, market, garage, marina, vault.
  const special = new Map([
    ['2,2', 'park'], ['7,6', 'park'], ['4,5', 'plaza'],
    ['4,1', 'market'], ['1,4', 'garage'], ['8,8', 'marina'], ['5,5', 'vault'],
  ]);
  for (let bx = 0; bx < CFG.roads - 1; bx++) {
    for (let by = 0; by < CFG.roads - 1; by++) {
      const x = centers[bx] + CFG.roadW / 2;
      const y = centers[by] + CFG.roadW / 2;
      const kind = special.get(`${bx},${by}`) || 'buildings';
      blocks.push({ bx, by, x, y, w: CFG.block, h: CFG.block, kind });
      if (kind === 'park') {
        for (let t = 0; t < 7; t++) {
          props.push({ x: x + rng.range(24, CFG.block - 24), y: y + rng.range(24, CFG.block - 24), kind: 'tree' });
        }
        props.push({ x: x + 40, y: y + CFG.block - 40, kind: 'bench' });
        props.push({ x: x + CFG.block - 40, y: y + 40, kind: 'bench' });
        continue;
      }
      if (kind === 'plaza') {
        props.push({ x: x + 40, y: y + 40, kind: 'bench' });
        props.push({ x: x + CFG.block - 40, y: y + 40, kind: 'bench' });
        props.push({ x: x + 40, y: y + CFG.block - 40, kind: 'bench' });
        props.push({ x: x + CFG.block - 40, y: y + CFG.block - 40, kind: 'bench' });
        props.push({ x: x + CFG.block / 2, y: y + CFG.block / 2, kind: 'lamp' });
        continue;
      }
      if (kind === 'market') {
        for (let s = 0; s < 5; s++) {
          props.push({ x: x + 40 + s * 40, y: y + 70, kind: 'stall' });
        }
        props.push({ x: x + 60, y: y + 170, kind: 'bench' });
        continue;
      }
      if (kind === 'garage' || kind === 'vault' || kind === 'marina') {
        // One wide low building at the block's far side; the yard stays open.
        const bw = 170;
        const bh = 90;
        buildings.push({
          x: x + (CFG.block - bw) / 2, y: y + CFG.block - bh - 26,
          w: bw, h: bh, color: kind === 'vault' ? '#3a639e' : kind === 'garage' ? '#c96f4a' : '#3a9e80',
          roof: '#2a2a30', tall: false,
        });
        props.push({ x: x + 30, y: y + 50, kind: 'lamp' });
        continue;
      }
      // Ordinary block: one or two buildings, set back from the road edge.
      if (rng.chance(0.4)) {
        const w1 = rng.range(90, 120);
        const h1 = rng.range(90, 120);
        buildings.push(makeBuilding(x + 22, y + 22, w1, h1, rng));
        buildings.push(makeBuilding(x + CFG.block - 22 - w1, y + CFG.block - 22 - h1, w1, h1, rng));
      } else {
        const w = rng.range(130, 180);
        const h = rng.range(130, 180);
        buildings.push(makeBuilding(x + (CFG.block - w) / 2, y + (CFG.block - h) / 2, w, h, rng));
      }
      if (rng.chance(0.5)) props.push({ x: x + 14, y: y + CFG.block - 14, kind: 'hydrant' });
      if (rng.chance(0.6)) props.push({ x: x + CFG.block - 14, y: y + 14, kind: 'lamp' });
    }
  }
  // Lamps on every other intersection corner.
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if ((i + j) % 2 === 0) {
        props.push({ x: centers[i] + CFG.roadW / 2 + 6, y: centers[j] + CFG.roadW / 2 + 6, kind: 'lamp' });
      }
    }
  }
  return {
    centers,
    blocks,
    buildings,
    props,
    spots: {
      garage: { x: 488, y: 1360 },
      market: { x: 1400, y: 488 },
      marina: { x: 2616, y: 2580 },
      vault: { x: 1704, y: 1650 },
    },
    beach: CFG.beach,
    waterX0: CFG.waterX0,
    lighthouse: CFG.lighthouse,
    pier: CFG.pier,
  };
}

function makeBuilding(x, y, w, h, rng) {
  const tall = rng.chance(0.3);
  return {
    x, y, w, h,
    color: rng.pick(PALETTE.building),
    roof: rng.pick(PALETTE.roof),
    tall,
  };
}

// ---- queries shared by every system ---------------------------------------

export function isRoad(world, x, y) {
  const half = CFG.roadW / 2;
  for (const c of world.centers) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

export function onPier(world, x, y) {
  const p = world.pier;
  return x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;
}

export function isWater(world, x, y) {
  return x >= world.waterX0 && !onPier(world, x, y);
}

export function isSand(world, x, y) {
  return x >= CFG.beachX0 && x < world.waterX0 && y >= 0 && y <= CFG.citySize;
}

// A circle blocked by a building, the lighthouse rock, or the water.
export function blockedCircle(world, x, y, r) {
  if (isWater(world, x, y)) return true;
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  const dx = x - world.lighthouse.x;
  const dy = y - world.lighthouse.y;
  if (dx * dx + dy * dy < (26 + r) * (26 + r)) return true;
  return false;
}

// Move a circle against the world: try the full step, then each axis alone.
export function moveCircle(world, x, y, dx, dy, r) {
  if (!blockedCircle(world, x + dx, y + dy, r)) return { x: x + dx, y: y + dy };
  if (!blockedCircle(world, x + dx, y, r)) return { x: x + dx, y };
  if (!blockedCircle(world, x, y + dy, r)) return { x, y: y + dy };
  return { x, y };
}

// Snap a point to the nearest road centre line.
export function nearestRoadPoint(world, x, y) {
  let bestX = world.centers[0];
  let bestY = world.centers[0];
  for (const c of world.centers) {
    if (Math.abs(c - x) < Math.abs(bestX - x)) bestX = c;
    if (Math.abs(c - y) < Math.abs(bestY - y)) bestY = c;
  }
  return Math.abs(bestX - x) < Math.abs(bestY - y) ? { x: bestX, y } : { x, y: bestY };
}
