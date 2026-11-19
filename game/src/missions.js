// Neon Bay — Mara Voss's five jobs, in order. Each pays cash and starts the
// next; a step's timer restarts with the step, and getting busted mid-fight
// brings the crew back instead of skipping the fight. The King fight happens
// on the lighthouse beach itself, the crew leashed to the sand.
import { CFG } from './config.js';
import { spawnThug } from './combat.js';

const DEFS = [
  {
    name: 'First Wheels',
    pay: CFG.missionPay[0],
    intro: 'Mara: "New in town needs wheels. Take any car on the street — then bring it to my garage."',
    steps: [
      { label: 'Steal a car', timer: null },
      { label: 'Bring the car to Mara\'s garage', timer: null },
    ],
  },
  {
    name: 'Hot Delivery',
    pay: CFG.missionPay[1],
    intro: 'Mara: "Package at the night market. Marina drop, and the clock is already running."',
    steps: [
      { label: 'Pick up the package at the night market', timer: CFG.deliverySeconds },
      { label: 'Deliver the package to the marina', timer: CFG.deliverySeconds },
    ],
  },
  {
    name: 'Pier Cash',
    pay: CFG.missionPay[2],
    intro: 'Mara: "Tide King\'s boys skimmed my cut. It is sitting at the end of the pier. Take it back."',
    steps: [
      { label: 'Reach the end of the pier', timer: null },
      { label: 'Take back the cash — clear the pier crew', timer: null },
      { label: 'Bring the cash to Mara\'s garage', timer: null },
    ],
  },
  {
    name: 'Bay Trust',
    pay: CFG.missionPay[3],
    intro: 'Mara: "Bay Trust vault, one guard shift, forty-five seconds. Hold the floor and walk out rich."',
    steps: [
      { label: 'Get to the Bay Trust vault', timer: null },
      { label: 'Hold the vault floor', timer: null },
      { label: 'Bring the take to Mara\'s garage', timer: null },
    ],
  },
  {
    name: 'King at Lighthouse Point',
    pay: CFG.missionPay[4],
    intro: 'Mara: "King himself is waiting on the lighthouse beach. Finish him and this town is ours."',
    steps: [
      { label: 'Go to the lighthouse beach', timer: null },
      { label: 'Defeat King on the beach', timer: null },
    ],
  },
];

export function createMissions() {
  return {
    index: 0, // 0..4, 5 means all five done
    step: 0,
    timer: null, // seconds left on this step, or null
    target: null, // {x, y, label, radius}
    boss: null, // King, while he lives
    vaultT: 0, // seconds held on the vault floor
    waveT: 0,
    pierCash: null, // {x, y} once the pier crew is down
    hasPackage: false,
    done: false,
  };
}

export function currentMission(G) {
  return DEFS[G.missions.index] || null;
}

export function objectiveText(G) {
  const m = G.missions;
  if (m.done) return 'Neon Bay is yours.';
  const def = DEFS[m.index];
  if (!def) return '';
  return `${def.name}: ${def.steps[m.step].label}`;
}

function setTarget(G, x, y, label, radius) {
  G.missions.target = { x, y, label, radius: radius || 70 };
}

export function setupStep(G) {
  const m = G.missions;
  const def = DEFS[m.index];
  if (!def) return;
  const step = def.steps[m.step];
  m.timer = step.timer;
  m.vaultT = 0;
  m.waveT = 0;
  m.pierCash = null;
  m.boss = null;
  const spots = G.world.spots;
  const beach = CFG.beach;
  const beachCx = (beach.x0 + beach.x1) / 2;
  const beachCy = (beach.y0 + beach.y1) / 2;
  switch (m.index) {
    case 0:
      if (m.step === 0) setTarget(G, G.player.x + 100, G.player.y, 'Steal a car', 60);
      else setTarget(G, spots.garage.x, spots.garage.y, "Mara's garage", 90);
      break;
    case 1:
      if (m.step === 0) setTarget(G, spots.market.x, spots.market.y, 'Night market', 70);
      else setTarget(G, spots.marina.x, spots.marina.y, 'Marina', 70);
      break;
    case 2:
      if (m.step === 0) setTarget(G, G.world.pier.x1 - 30, (G.world.pier.y0 + G.world.pier.y1) / 2, 'End of the pier', 80);
      else if (m.step === 1) {
        setTarget(G, G.world.pier.x1 - 30, (G.world.pier.y0 + G.world.pier.y1) / 2, 'Pier crew', 60);
        // The pier crew ambushes Rex at the end of the pier. Spawning here
        // (not on arrival) means a bust mid-fight brings the crew back.
        const px = G.world.pier.x1 - 60;
        const py = (G.world.pier.y0 + G.world.pier.y1) / 2;
        spawnThug(G, px - 40, py - 30, {});
        spawnThug(G, px - 80, py + 20, {});
        spawnThug(G, px - 20, py + 50, {});
        G.hud.flash(G, "Tide King's crew is on the pier!");
      }
      else setTarget(G, spots.garage.x, spots.garage.y, "Mara's garage", 90);
      break;
    case 3:
      if (m.step === 0) setTarget(G, spots.vault.x, spots.vault.y, 'Bay Trust vault', 80);
      else if (m.step === 1) setTarget(G, spots.vault.x, spots.vault.y, 'Hold the vault', 110);
      else setTarget(G, spots.garage.x, spots.garage.y, "Mara's garage", 90);
      break;
    case 4:
      if (m.step === 0) {
        // The goto circle reaches the whole beach: any sand counts.
        setTarget(G, beachCx, beachCy, 'Lighthouse beach', 720);
      } else {
        setTarget(G, beachCx, beachCy, 'Defeat King', 720);
        // King and his crew, leashed to the lighthouse sand. Spawning here
        // (not on arrival) means a bust mid-fight brings the crew back.
        const leash = { x0: beach.x0, y0: beach.y0, x1: beach.x1, y1: beach.y1 };
        const king = spawnThug(G, 3300, 1300, { hp: CFG.kingHp, speed: CFG.kingSpeed, king: true, leash, name: 'King' });
        m.boss = king;
        spawnThug(G, 3220, 1500, { leash });
        spawnThug(G, 3350, 1700, { leash });
        spawnThug(G, 3200, 1900, { leash });
        spawnThug(G, 3380, 1100, { leash });
        G.hud.flash(G, 'King: "This beach is mine, Marlowe."');
        G.audio.fail();
      }
      break;
    default:
      break;
  }
  if (m.step === 0) G.hud.flash(G, def.intro);
}

export function startMissions(G) {
  G.missions.index = 0;
  G.missions.step = 0;
  G.missions.done = false;
  setupStep(G);
}

function nextStep(G) {
  const m = G.missions;
  const def = DEFS[m.index];
  m.step++;
  if (m.step >= def.steps.length) {
    completeMission(G);
    return;
  }
  setupStep(G);
}

function completeMission(G) {
  const m = G.missions;
  const def = DEFS[m.index];
  G.player.money += def.pay;
  G.audio.coin();
  G.audio.jingle();
  G.hud.flash(G, `${def.name} done — $${def.pay} paid.`);
  m.index++;
  m.step = 0;
  if (m.index >= DEFS.length) {
    m.done = true;
    m.target = null;
    m.boss = null;
    G.state = 'won';
    G.clearSave();
    G.audio.jingle();
    return;
  }
  G.save();
  setupStep(G);
}

function restartStep(G, why) {
  G.hud.flash(G, why);
  G.audio.fail();
  setupStep(G);
}

export function onEvent(G, type, data) {
  const m = G.missions;
  if (m.done || G.state !== 'playing') return;
  if (type === 'steal' && m.index === 0 && m.step === 0) {
    nextStep(G);
  }
  if (type === 'thugDown') {
    if (m.index === 2 && m.step === 1 && G.combat.thugs.length === 0 && !m.pierCash) {
      m.pierCash = { x: G.world.pier.x1 - 60, y: (G.world.pier.y0 + G.world.pier.y1) / 2 };
      G.hud.flash(G, 'Crew down — grab the cash bag.');
    }
  }
  if (type === 'kingDown' && m.index === 4 && m.step === 1) {
    m.boss = null;
    nextStep(G); // completes mission 5, which wins the game
  }
}

// Busted mid-fight brings the crew back instead of skipping the fight.
export function onBusted(G) {
  const m = G.missions;
  if (m.done) return;
  G.combat.thugs = [];
  G.combat.bullets = [];
  G.combat.packs = [];
  setupStep(G);
}

function atTarget(G) {
  const t = G.missions.target;
  if (!t) return false;
  return Math.hypot(G.player.x - t.x, G.player.y - t.y) < t.radius;
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.done || G.state !== 'playing') return;
  // The step timer restarts with the step; running out restarts the step.
  if (m.timer !== null) {
    m.timer -= dt;
    if (m.timer <= 0) {
      restartStep(G, 'Out of time — the step starts over.');
      return;
    }
  }
  const spots = G.world.spots;
  switch (m.index) {
    case 0: {
      if (m.step === 0) {
        // The target follows the nearest car worth stealing.
        const car = G.vehicles.nearestCar(G, G.player.x, G.player.y);
        if (car) setTarget(G, car.x, car.y, 'Steal a car', 60);
      } else if (G.player.inCar && atTarget(G)) {
        nextStep(G);
      }
      break;
    }
    case 1: {
      if (m.step === 0 && atTarget(G)) {
        m.hasPackage = true;
        G.audio.pickup();
        nextStep(G);
      } else if (m.step === 1 && atTarget(G)) {
        m.hasPackage = false;
        nextStep(G);
      }
      break;
    }
    case 2: {
      if (m.step === 0 && atTarget(G)) {
        // Entering the ambush: setupStep spawns the pier crew.
        nextStep(G);
      } else if (m.step === 1) {
        if (m.pierCash && Math.hypot(G.player.x - m.pierCash.x, G.player.y - m.pierCash.y) < 34) {
          m.pierCash = null;
          G.audio.pickup();
          nextStep(G);
        }
      } else if (m.step === 2 && atTarget(G)) {
        nextStep(G);
      }
      break;
    }
    case 3: {
      if (m.step === 0 && atTarget(G)) {
        nextStep(G);
      } else if (m.step === 1) {
        const inVault = Math.hypot(G.player.x - spots.vault.x, G.player.y - spots.vault.y) < 110;
        if (inVault) {
          m.vaultT += dt;
          m.waveT += dt;
          if (m.waveT > 11) {
            m.waveT = 0;
            spawnThug(G, spots.vault.x + 140, spots.vault.y - 60, {});
            spawnThug(G, spots.vault.x - 140, spots.vault.y + 60, {});
          }
          if (m.vaultT >= CFG.vaultHoldSeconds) nextStep(G);
        }
      } else if (m.step === 2 && atTarget(G)) {
        nextStep(G);
      }
      break;
    }
    case 4: {
      if (m.step === 0 && atTarget(G)) {
        // Entering the fight: setupStep spawns King and his crew on the sand.
        nextStep(G);
      }
      break;
    }
    default:
      break;
  }
}
