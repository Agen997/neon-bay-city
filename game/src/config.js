// Neon Bay tuning: world layout, weapons, jobs, colours. Every magic number lives here.

export const STEP = 1 / 60;

export const WORLD = {
  half: 240, // playable square is [-half, half] on x and z
  roadStep: 50, // roads every 50 m
  roadHalf: 7, // half the asphalt width
  sidewalk: 3,
  beachX: -196, // sand starts west of here
  waterX: -234, // water plane starts west of here
  minX: -238, // hard west bound (ankle-deep water)
};

export const PLACES = {
  spawn: { x: -186, z: 14 },
  mara: { x: -191, z: 4 }, // Mara Voss, Harbor Row
  harborDrop: { x: -196, z: 26 },
  garage: { x: -196, z: -32 },
  clinic: { x: 50, z: -156 },
  lighthouse: { x: -216, z: 186 },
  bossArena: { x: -204, z: 168 },
  pickupCar: { x: 118, z: -78 },
  hotel: { x: 148, z: 146 },
  alley: { x: -52, z: 118 },
  sportsCar: { x: 178, z: -162 },
};

export const WEAPONS = {
  fists: { name: 'Fists', dmg: 14, rate: 0.38, range: 2.4, melee: true },
  pistol: { name: 'Pistol', dmg: 26, rate: 0.26, range: 130, spread: 0.012, auto: false },
  smg: { name: 'SMG', dmg: 15, rate: 0.085, range: 110, spread: 0.03, auto: true },
  shotgun: { name: 'Shotgun', dmg: 9, pellets: 7, rate: 0.85, range: 45, spread: 0.07, auto: false },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const PLAYER_CFG = {
  walk: 5.2,
  run: 8.6,
  jump: 6.2,
  radius: 0.55,
  maxHp: 100,
  maxArmor: 100,
};

export const CAR_CFG = {
  accel: 14,
  brake: 22,
  reverseMax: 9,
  topSpeed: 34,
  sportsTop: 44,
  steer: 1.9,
  drag: 0.6,
  radius: 2.1,
};

export const WANTED = {
  maxStars: 5,
  seenRange: 58,
  heliRange: 90,
  decayDelay: 7, // seconds unseen before a star drops
  bustTime: 2.2, // seconds boxed in before BUSTED
  bustRange: 8,
};

export const JOBS = [
  {
    id: 'pickup',
    title: 'Harbor Pickup',
    reward: 200,
    brief: 'Mara: "A sedan in the east lots owes me money. Bring it to Harbor Row."',
  },
  {
    id: 'delivery',
    title: 'Neon Delivery',
    reward: 300,
    brief: 'Mara: "Package for the Hotel Sol, southeast corner. Fast — the guest tips big."',
    timeLimit: 150,
  },
  {
    id: 'tide',
    title: 'Tide Trouble',
    reward: 400,
    brief: 'Mara: "Tide Kings are shaking down my alley crew. Send them swimming."',
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    reward: 500,
    brief: 'Mara: "A sports car in the southeast lots. The NBPD will notice. Lose them, then garage it."',
  },
  {
    id: 'king',
    title: "King's Fall",
    reward: 1000,
    brief: 'Mara: "The Tide King holds court at Lighthouse Point. End his reign, Rex."',
  },
];

export const COLORS = {
  skyTop: 0x2b1055,
  skyMid: 0xff5e78,
  skyLow: 0xffb347,
  sun: 0xffb36b,
  fog: 0xff9a6b,
  sand: 0xe8c48a,
  water: 0x1b6f8f,
  asphalt: 0x3a3f4a,
  sidewalk: 0xb8b0a4,
  grass: 0x7a9a52,
};

export const CAR_COLORS = [0xd64550, 0x3e7cb1, 0xf2c14e, 0x59b06a, 0xe8e8e8, 0x8e6bc8, 0xff7f50, 0x2ec4b6, 0xf15bb5, 0xfee440];
export const PED_COLORS = [0xef6f6c, 0x56cbf5, 0xffd166, 0x95d5b2, 0xc77dff, 0xffa26b, 0x8ecae6, 0xf1fa8c];

export const SAVE_KEY = 'neonbay.save.v1';
