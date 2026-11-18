// Neon Bay — tuning constants and palette for the whole game.
// Every number that shapes how the city feels lives here, so balancing
// the game means editing this file, not hunting through the systems.
export const CFG = {
  worldSize: 3200,
  blockSize: 256,
  roadWidth: 64,
  // Player on foot.
  walkSpeed: 210,
  runSpeed: 330,
  playerRadius: 13,
  playerMaxHealth: 100,
  // Driving.
  carAccel: 520,
  carBrake: 900,
  carMaxSpeed: 460,
  carReverseSpeed: 170,
  carTurn: 2.6,
  carRadius: 20,
  trafficSpeed: 130,
  policeSpeed: 430,
  // Combat.
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
  meleeDamage: 22,
  meleeRange: 46,
  meleeCooldown: 0.45,
  bulletSpeed: 900,
  // A thug shot down sometimes drops a health pack.
  thugHealthDropChance: 0.25,
  healthPickupHeal: 30,
  // NBPD foot officers: how often a shot lands and how hard it hits.
  officerHitChance: 0.35,
  officerDamage: 5,
  // A police cruiser ramming the player's car, damage per second of contact.
  // The ram also has a cooldown (see police.js): without one a faster
  // cruiser stays glued to the player's car and the damage never stops.
  policeRamDps: 26,
  // Seconds a cruiser backs off after ramming before it can ram again.
  policeRamCooldown: 1.5,
  // The player's ride takes more punishment than a traffic car: a parked
  // car should not be wrecked by two seconds of ramming while its driver
  // reads a mission briefing.
  playerCarHealth: 160,
  // Crowd and traffic density.
  pedCount: 44,
  trafficTarget: 12,
  // Engine sound: at most one blip per interval, not one per frame.
  engineSoundMs: 90,
  // Wanted system.
  wantedMax: 5,
  wantedDecaySeconds: 26,
  // Camera and screen.
  viewWidth: 1280,
  viewHeight: 720,
  cameraZoom: 1.0,
  minimapSize: 168,
  // Economy.
  startCash: 120,
  missionReward: [400, 650, 900, 1400, 2500],
};

export const PALETTE = {
  grass: '#3f9e4d',
  grassDark: '#35873f',
  park: '#57b368',
  road: '#2e3138',
  roadEdge: '#4a4f5a',
  lane: '#e8d44d',
  sidewalk: '#9aa0ab',
  buildingRoof: ['#c96f4a', '#4a7fb5', '#b5a34a', '#7a5fb5', '#4ab5a0', '#b54a6e'],
  buildingEdge: '#23252b',
  water: '#1f7fb5',
  waterDeep: '#16608c',
  sand: '#e8d9a0',
  tree: '#2e7d32',
  treeLight: '#4caf50',
  hudPanel: 'rgba(12, 16, 28, 0.78)',
  hudAccent: '#ffcf3f',
  neonPink: '#ff4da6',
  neonCyan: '#29e6ff',
  policeBlue: '#2f6bff',
  policeRed: '#ff3b30',
};

export const CAR_COLORS = [
  '#e84a4a', '#4a90e8', '#f2c14e', '#7ee081', '#c77dff', '#ff8c42',
  '#e8e8e8', '#3a3f4a', '#2ec4b6', '#ff6b9d',
];

export const PED_COLORS = [
  '#f2c14e', '#7ee081', '#ff8c42', '#c77dff', '#4a90e8', '#e84a4a', '#e8e8e8',
];

// Key bindings, shown on the title screen and the pause menu.
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Aim'],
  ['Left click', 'Shoot pistol / punch'],
  ['E', 'Enter / exit car (steal it)'],
  ['Shift', 'Run'],
  ['Space', 'Melee swing'],
  ['P', 'Pause'],
  ['M', 'Mute sound'],
];
