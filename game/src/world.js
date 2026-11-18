// Neon Bay — the city itself: roads, blocks, buildings, parks and the bay.
// The city is generated from a seed, so the same seed always builds the
// same streets. Everything else in the game asks this module where things
// are and what is solid, so the city stays the single source of truth.
import { CFG, PALETTE } from './config.js';
import { makeRng } from './random.js';

const ROAD_CENTERS = [192, 448, 704, 960, 1216, 1472, 1728, 1984, 2240, 2496, 2752];
export const WATER_X = 2944; // The bay starts here; east of it is open water.
export const PIER = { x: 2752, y: 1536, w: 400, h: 128 };
// The lighthouse beach: the dry strip east of the last road, under the
// lighthouse that stands in the bay. The King fight is staged here.
export const LIGHTHOUSE_BEACH = { x: 2900, y: 340 };
// The sand cove the renderer draws around the beach, wider than the thin
// sand strip along the rest of the bay.
export const BEACH_COVE = { x: 2860, y: 180, w: 84, h: 320 };

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];

  // Named places the missions and the minimap point at.
  const spots = {
    hideout: { x: 448, y: 448, label: 'Mara’s Garage' },
    marina: { x: 2624, y: 2496, label: 'Marina Parking' },
    diner: { x: 1216, y: 704, label: 'Harbor Diner' },
    bank: { x: 1984, y: 1216, label: 'Bay Trust Bank' },
    pier: { x: 3050, y: 1600, label: 'Neon Pier' },
    lighthouse: { x: 3040, y: 320, label: 'Lighthouse Point' },
    market: { x: 960, y: 2240, label: 'Night Market' },
    plaza: { x: 1472, y: 1472, label: 'Bay Plaza' },
  };

  for (let bx = 0; bx < ROAD_CENTERS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_CENTERS.length - 1; by += 1) {
      const left = ROAD_CENTERS[bx] + CFG.roadWidth / 2 + 12;
      const top = ROAD_CENTERS[by] + CFG.roadWidth / 2 + 12;
      const right = ROAD_CENTERS[bx + 1] - CFG.roadWidth / 2 - 12;
      const bottom = ROAD_CENTERS[by + 1] - CFG.roadWidth / 2 - 12;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      // Keep the marina block and the plaza clear for missions.
      const isSpecial =
        (Math.abs(cx - spots.marina.x) < 200 && Math.abs(cy - spots.marina.y) < 200) ||
        (Math.abs(cx - spots.plaza.x) < 200 && Math.abs(cy - spots.plaza.y) < 200);
      if (isSpecial) {
        parks.push({ x: left, y: top, w: right - left, h: bottom - top, kind: 'plaza' });
        continue;
      }
      if (rng.chance(0.22)) {
        parks.push({ x: left, y: top, w: right - left, h: bottom - top, kind: 'park' });
        const count = rng.int(4, 8);
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: rng.range(left + 16, right - 16),
            y: rng.range(top + 16, bottom - 16),
            r: rng.range(9, 14),
          });
        }
        continue;
      }
      // Buildings sit further inside their block than the block edge: a
      // roof that reaches the block's edge pinches the road beside it to
      // a corridor barely wider than a car, and a car brushing the corner
      // wedges itself in. The inset keeps every road comfortably passable.
      const inset = 14;
      const bLeft = left + inset;
      const bTop = top + inset;
      const bRight = right - inset;
      const bBottom = bottom - inset;
      // One or two buildings per block, with a gap between them.
      const splitVertical = rng.chance(0.5);
      const color = rng.pick(PALETTE.buildingRoof);
      if (splitVertical) {
        const mid = (bLeft + bRight) / 2;
        buildings.push(makeBuilding(rng, bLeft, bTop, mid - 8, bBottom, color));
        buildings.push(makeBuilding(rng, mid + 8, bTop, bRight, bBottom, rng.pick(PALETTE.buildingRoof)));
      } else {
        buildings.push(makeBuilding(rng, bLeft, bTop, bRight, bBottom, color));
      }
    }
  }

  // Street trees along a few sidewalks, for colour from above.
  for (let i = 0; i < 70; i += 1) {
    const road = rng.pick(ROAD_CENTERS);
    const along = rng.range(140, CFG.worldSize - 140);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = rng.chance(0.5) ? road + side * 52 : along;
    const y = rng.chance(0.5) ? along : road + side * 52;
    if (x < WATER_X - 40) trees.push({ x, y, r: rng.range(8, 12) });
  }

  // Street props on the sidewalks — benches, hydrants and lamps — so the
  // streets read as lived-in from above, not just road and roof.
  const props = [];
  for (let i = 0; i < 64; i += 1) {
    const road = rng.pick(ROAD_CENTERS);
    const along = rng.range(140, CFG.worldSize - 140);
    const side = rng.chance(0.5) ? -1 : 1;
    const kind = rng.pick(['bench', 'hydrant', 'lamp']);
    if (rng.chance(0.5)) {
      if (road + side * 52 < WATER_X - 40) props.push({ x: road + side * 52, y: along, kind });
    } else if (along < WATER_X - 40) {
      props.push({ x: along, y: road + side * 52, kind });
    }
  }

  return { buildings, parks, trees, props, spots, seed };
}

function makeBuilding(rng, left, top, right, bottom, color) {
  const w = right - left;
  const h = bottom - top;
  const bw = Math.max(56, w * rng.range(0.62, 0.86));
  const bh = Math.max(56, h * rng.range(0.62, 0.86));
  return {
    x: left + (w - bw) / 2,
    y: top + (h - bh) / 2,
    w: bw,
    h: bh,
    color,
    height: rng.int(1, 3),
  };
}

export function isOnRoad(x, y) {
  const half = CFG.roadWidth / 2;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= half && x < WATER_X) return true;
    if (Math.abs(y - c) <= half && x < WATER_X + 60) return true;
  }
  return false;
}

export function isOnPier(x, y) {
  return x >= PIER.x && x <= PIER.x + PIER.w && y >= PIER.y && y <= PIER.y + PIER.h;
}

// The lighthouse beach: dry ground between the last road and the bay,
// around the cove the renderer draws.
export function isOnBeach(x, y) {
  return x >= BEACH_COVE.x && x < WATER_X && y >= BEACH_COVE.y && y <= BEACH_COVE.y + BEACH_COVE.h;
}

export function isWater(x, y) {
  if (isOnPier(x, y)) return false;
  return x >= WATER_X;
}

export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) {
    if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  }
  return best;
}

export function roadCenters() {
  return ROAD_CENTERS;
}

// True when a circle at (x, y) with radius r hits a building or the bay.
export function collidesSolid(world, x, y, r) {
  if (isWater(x, y)) return true;
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Slide a moving circle out of buildings: try x then y separately.
export function moveWithCollision(world, entity, dx, dy, radius) {
  const nx = entity.x + dx;
  if (!collidesSolid(world, nx, entity.y, radius)) entity.x = nx;
  const ny = entity.y + dy;
  if (!collidesSolid(world, entity.x, ny, radius)) entity.y = ny;
  entity.x = Math.max(24, Math.min(CFG.worldSize - 24, entity.x));
  entity.y = Math.max(24, Math.min(CFG.worldSize - 24, entity.y));
}

export function randomStreetPoint(rng) {
  const road = rng.pick(ROAD_CENTERS);
  const along = rng.range(160, CFG.worldSize - 200);
  const point = rng.chance(0.5) ? { x: road, y: along } : { x: along, y: road };
  // Never hand back a point in the bay: the east end of a horizontal road
  // runs past the water's edge, and a pedestrian spawned there would be
  // stuck in the water for the rest of the game.
  point.x = Math.min(point.x, WATER_X - 80);
  return point;
}
