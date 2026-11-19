// Neon Bay — tuning and palette. Every number the game balances on lives here,
// so a tweak never means hunting through the systems that use it.
export const CFG = {
  // View and world geometry.
  viewW: 1280,
  viewH: 720,
  roadW: 64,
  block: 240,
  pitch: 304, // roadW + block
  roads: 11,
  // City spans 0..3104 on both axes; the bay opens to the east of it.
  citySize: 3104,
  beachX0: 3104,
  beachX1: 3440,
  waterX0: 3440,
  worldW: 4400,
  worldH: 3104,
  // The lighthouse beach (the King fight's leash) and the pier.
  beach: { x0: 3120, y0: 900, x1: 3420, y1: 2200 },
  lighthouse: { x: 3580, y: 1552 },
  pier: { x0: 3104, y0: 2380, x1: 3600, y1: 2420 },
  // Key addresses, picked on the road grid.
  garage: { x: 336, y: 1552 }, // Mara's garage on Harbor Row
  market: { x: 1552, y: 640 }, // night market
  marina: { x: 2768, y: 2768 }, // marina, south-east
  vault: { x: 1552, y: 1552 }, // Bay Trust, downtown
  // Player.
  walkSpeed: 170,
  runSpeed: 260,
  playerHp: 100,
  playerRadius: 13,
  // Cars.
  carAccel: 520,
  carBrake: 700,
  carMaxSpeed: 430,
  carReverseSpeed: 150,
  carTurn: 2.6,
  carRadius: 16,
  trafficSpeed: 120,
  // Combat.
  pistolDamage: 34,
  pistolCooldown: 0.22,
  pistolRange: 520,
  meleeDamage: 45,
  meleeRange: 56,
  meleeArc: 1.1,
  meleeCooldown: 0.45,
  thugHp: 70,
  thugSpeed: 150,
  thugDamage: 12,
  kingHp: 420,
  kingSpeed: 120,
  copHp: 60,
  copSpeed: 165,
  // Wanted.
  wantedDecayDelay: 9, // seconds of no crime before heat starts cooling
  wantedDecayRate: 0.22, // stars per second once cooling
  bustedLoseCash: 0.15, // fraction of cash lost when busted
  // Missions.
  missionPay: [200, 400, 600, 900, 1500],
  vaultHoldSeconds: 45,
  deliverySeconds: 75,
  // World population.
  parkedCars: 26,
  trafficCars: 14,
  pedestrians: 42,
  seed: 20261119,
};

export const PALETTE = {
  grass: '#3f7d4a',
  parkGrass: '#4c9153',
  sand: '#e0c98f',
  sandWet: '#cbb27a',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  road: '#33363d',
  roadLine: '#e8d44d',
  sidewalk: '#8a8d94',
  crosswalk: '#d8d8d2',
  plaza: '#9a938a',
  building: ['#c96f4a', '#4a7ec9', '#c9a44a', '#7a4ac9', '#4ac9a0', '#c94a6e', '#8a6f4a', '#5a8a4a'],
  roof: ['#a8553a', '#3a639e', '#a8843a', '#5f3a9e', '#3a9e80', '#a83a58'],
  glass: '#bfe3ea',
  pierWood: '#8a6a42',
  pierPost: '#5f4630',
  lighthouse: '#e8e4da',
  lighthouseTop: '#c94a4a',
  car: ['#d43a3a', '#3a7bd4', '#e8c832', '#3ad46a', '#c9c9c9', '#7a3ad4', '#e87a2a', '#2ad4c9'],
  player: '#2a9df4',
  playerJacket: '#1f6fb8',
  thug: '#8a2a3a',
  king: '#1a1a22',
  cop: '#1f3a8a',
  copCar: '#e8e8e8',
  health: '#39d353',
  cash: '#e8d44d',
  bullet: '#ffe9a8',
  muzzle: '#ffcf3a',
};

export const NAMES = {
  player: 'Rex Marlowe',
  fixer: 'Mara Voss',
  gang: 'Tide King',
  boss: 'King',
  police: 'NBPD',
  city: 'Neon Bay',
};
