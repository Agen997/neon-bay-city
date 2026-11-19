// Neon Bay 3D — tuning, palette and world layout.
// One ground plane: x grows east, y grows south. Three.js maps (x, y) to (x, 0, y).
export const CONFIG = {
  // City grid: 11 roads each way, 304 units apart, roads 88 wide.
  roadCenters: Array.from({ length: 11 }, (_, i) => 32 + i * 304),
  roadHalf: 44,
  cityMax: 3104,
  world: { x0: 0, y0: 0, x1: 3600, y1: 3104 },
  // Beach, pier, bay (east edge).
  beach: { x0: 3120, y0: 900, x1: 3456, y1: 2200 },
  pier: { x0: 3400, y0: 2240, x1: 3720, y1: 2560 },
  pierEnd: { x: 3570, y: 2400 },
  lighthouse: { x: 3300, y: 1550 },
  beachCenter: { x: 3270, y: 1550 },
  // Key places.
  garage: { x: 488, y: 1360 },
  market: { x: 1400, y: 488 },
  marina: { x: 2616, y: 2580 },
  vault: { x: 1704, y: 1692 },
  // Side-job spots (inside blocks, off the roads).
  raceStart: { x: 2400, y: 1100 },
  store: { x: 800, y: 2300 },
  taxiStand: { x: 2000, y: 2600 },
  // Player.
  walkSpeed: 175,
  runSpeed: 265,
  playerRadius: 14,
  playerHp: 100,
  // Cars.
  carAccel: 460,
  carMaxSpeed: 380,
  carReverse: 220,
  carRadius: 20,
  playerCarHp: 180,
  trafficSpeed: [170, 260],
  // Wanted.
  wantedDecayDelay: 8,
  wantedDecayRate: 0.22,
  bustMoneyLoss: 0.15,
  // Missions (payouts in $).
  pay: { m1: 200, m2: 600, m3: 1200, m4: 1920, race: 400, robbery: 500, taxi: 300 },
  m2TimeLimit: 75,
  vaultHoldTime: 45,
  // Golden-hour palette.
  colors: {
    skyTop: 0x2b1b4d,
    skyMid: 0xff7e3c,
    skyLow: 0xffb347,
    fog: 0xd98a52,
    sun: 0xffb347,
    ground: 0x8a7a68,
    asphalt: 0x2e2a33,
    sidewalk: 0x9a8a76,
    beach: 0xe8c98a,
    water: 0x1d4e6b,
    pierWood: 0x7a5a3a,
    building: [0xb5654a, 0x4a7a8a, 0xc9a86a, 0x7a5a8a, 0x8a9a6a, 0xd98a6a, 0x5a6a8a, 0xa88a5a],
    neon: [0xff2e88, 0x00e5ff, 0xffe14d, 0xff6a00, 0x7cff4d],
    car: [0xc23b2e, 0x2e6ac2, 0xe8b13c, 0x3aa86a, 0x8a5ac2, 0xd8d8d8, 0x2a2a2e],
    cop: 0x1a1a22,
    thug: 0x8a2a2a,
    king: 0xd8a020,
  },
};
