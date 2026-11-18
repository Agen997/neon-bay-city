// Neon Bay — the story: five chained jobs for Mara Voss, the fixer who
// runs the Neon Bay garage. Each mission is a list of steps; a step is
// done by reaching a place, holding it, collecting drops, or clearing
// the thugs the step spawns. Finishing a job pays cash and starts the next.
import { CFG } from './config.js';
import { distance, randomPointInCircle, clamp } from './random.js';
import { spawnThug } from './combat.js';
import { addWanted } from './police.js';
import { healPlayer } from './player.js';
import { LIGHTHOUSE_BEACH } from './world.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Job 1 — First Wheels',
    giver: 'Mara Voss',
    briefing: [
      'Mara Voss: "New in Neon Bay, Rex? Then you need wheels."',
      'Mara Voss: "Lift a car from Marina Parking, then bring it to my garage."',
    ],
    steps: [
      { kind: 'goto', text: 'Go to Marina Parking', spot: 'marina', radius: 90 },
      { kind: 'steal', text: 'Steal a car (press E beside one)' },
      { kind: 'goto', text: 'Drive to Mara’s Garage', spot: 'hideout', radius: 90 },
    ],
  },
  {
    id: 'neon-delivery',
    title: 'Job 2 — Neon Delivery',
    giver: 'Mara Voss',
    briefing: [
      'Mara Voss: "A package for the Harbor Diner. Ninety seconds. No police."',
      'Mara Voss: "Drive fast, drive smooth, and do not get seen."',
    ],
    steps: [
      { kind: 'goto', text: 'Pick up the package at the garage', spot: 'hideout', radius: 80, timer: 95 },
      { kind: 'goto', text: 'Deliver it to Harbor Diner', spot: 'diner', radius: 80, timer: 95 },
    ],
  },
  {
    id: 'pier-pressure',
    title: 'Job 3 — Pier Pressure',
    giver: 'Mara Voss',
    briefing: [
      'Mara Voss: "The Tide Kings stashed cash on Neon Pier. Take it back."',
      'Mara Voss: "Three drops. Their boys will not hand them over nicely."',
    ],
    steps: [
      { kind: 'goto', text: 'Reach Neon Pier', spot: 'pier', radius: 110 },
      { kind: 'collect', text: 'Collect 3 cash drops on the pier', count: 3 },
      { kind: 'defeat', text: 'Clear out the Tide Kings on the pier' },
    ],
  },
  {
    id: 'bay-trust-job',
    title: 'Job 4 — Bay Trust Job',
    giver: 'Mara Voss',
    briefing: [
      'Mara Voss: "Bay Trust Bank. In, hold the vault, out. The heat will come."',
      'Mara Voss: "Lose the cops at the garage and the money is ours."',
    ],
    steps: [
      { kind: 'goto', text: 'Reach Bay Trust Bank', spot: 'bank', radius: 90 },
      { kind: 'hold', text: 'Hold the vault — stay in the circle', spot: 'bank', radius: 70, duration: 5 },
      { kind: 'goto', text: 'Escape to Mara’s Garage', spot: 'hideout', radius: 90 },
    ],
  },
  {
    id: 'king-tide',
    title: 'Job 5 — King Tide',
    giver: 'Mara Voss',
    briefing: [
      'Mara Voss: "Their boss, King, waits at Lighthouse Point. End this."',
      'Mara Voss: "Take his crew down, then come home. Neon Bay is ours."',
    ],
    steps: [
      { kind: 'goto', text: 'Reach Lighthouse Point', spot: 'lighthouse', radius: CFG.lighthouseGotoRadius },
      { kind: 'defeat', text: 'Defeat King and his crew on the beach' },
      { kind: 'goto', text: 'Return to Mara’s Garage', spot: 'hideout', radius: 90 },
    ],
  },
];

export function currentMission(game) {
  if (game.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[game.missionIndex];
}

export function currentStep(game) {
  const mission = currentMission(game);
  if (!mission) return null;
  return mission.steps[game.missionStep] || null;
}

export function objectiveText(game) {
  const mission = currentMission(game);
  if (!mission) return 'Neon Bay is yours — free roam. Press P for the menu.';
  const step = currentStep(game);
  if (!step) return mission.title;
  return `${mission.title}: ${step.text}`;
}

export function stepTarget(game) {
  const step = currentStep(game);
  if (!step || !step.spot) return null;
  return game.world.spots[step.spot];
}

export function startMission(game, index) {
  const mission = MISSIONS[index];
  game.missionIndex = index;
  game.missionStep = 0;
  game.missionTimer = 0;
  game.holdProgress = 0;
  game.justStole = false;
  game.missionActive = true;
  game.setDialogue(mission.giver, mission.briefing);
  game.addMessage(`${mission.title} started.`);
  game.sound.missionDone();
}

function advanceStep(game) {
  game.missionStep += 1;
  game.holdProgress = 0;
  // Each timed step gets its own full timer: the clock restarts here,
  // instead of carrying the previous step's elapsed time into the next one.
  game.missionTimer = 0;
  const mission = currentMission(game);
  if (mission && game.missionStep >= mission.steps.length) {
    completeMission(game);
  }
}

function completeMission(game) {
  const mission = currentMission(game);
  const reward = CFG.missionReward[game.missionIndex] || 500;
  game.addCash(reward, `${mission.title} complete`);
  game.missionActive = false;
  game.sound.missionDone();
  game.setDialogue('Mara Voss', [`"${mission.title} done. $${reward} is yours, Rex."`]);
  game.missionIndex += 1;
  if (game.missionIndex >= MISSIONS.length) {
    game.won = true;
    game.state = 'won';
    game.addMessage('All jobs done — Neon Bay is yours.');
    // A finished game has nothing to continue: clear the save so the
    // title offers a fresh start instead of a continue into a won game.
    if (game.clearSave) game.clearSave();
    game.hasSave = false;
    return;
  }
  game.startMissionTimer = 1.2;
}

function failMissionTimer(game) {
  const mission = currentMission(game);
  game.addMessage(`${mission.title}: too slow — the job fell through. Try again.`);
  game.missionStep = 0;
  game.holdProgress = 0;
  game.setDialogue('Mara Voss', ['"Too slow, Rex. Run it again, from the top."']);
}

function spawnPierCrew(game) {
  game.collectedDrops = 0;
  const pier = game.world.spots.pier;
  // The pier spans x 2752-3152: every thug and drop must stand on its
  // boards, not in the water past its east end (a drop at pier.x + 160
  // was uncollectable and soft-locked the mission).
  spawnThug(game, pier.x - 60, pier.y - 30);
  spawnThug(game, pier.x + 40, pier.y + 40);
  spawnThug(game, pier.x + 90, pier.y - 20);
  spawnThug(game, pier.x - 120, pier.y + 50);
  // Three cash drops along the pier.
  game.pickups.push(
    { x: pier.x - 100, y: pier.y - 40, kind: 'cash', taken: false },
    { x: pier.x + 10, y: pier.y + 30, kind: 'cash', taken: false },
    { x: pier.x + 90, y: pier.y - 10, kind: 'cash', taken: false },
  );
}

export function spawnKingCrew(game) {
  // The lighthouse stands in the water; its crew waits on the beach
  // (the dry strip x 2816-2944), not out in the bay where no one can
  // reach them on foot. The crew is scattered over the beach around the
  // lighthouse point, and every thug is leashed to a rectangle of sand:
  // a thug that chased too far walks back instead of following the
  // player into town, so the fight stays on the beach it started on.
  // The lighthouse goto circle reaches the whole beach now (radius 220
  // from the point in the bay), so the player triggers the fight from
  // the beach itself instead of hugging the water's edge.
  const leash = { x0: 2830, y0: 170, x1: 2935, y1: 510, cx: LIGHTHOUSE_BEACH.x, cy: LIGHTHOUSE_BEACH.y };
  for (let i = 0; i < 4; i += 1) {
    const spot = randomPointInCircle(game.rng, LIGHTHOUSE_BEACH.x, LIGHTHOUSE_BEACH.y, 110);
    const x = clamp(spot.x, 2820, 2930);
    const y = clamp(spot.y, 200, 480);
    spawnThug(game, x, y, { leash });
  }
  const king = spawnThug(game, LIGHTHOUSE_BEACH.x + 5, LIGHTHOUSE_BEACH.y + 10, { leash });
  king.health = 220;
  king.boss = true;
  king.speed = 165;
  game.sound.boss();
  game.addMessage('King is on the beach — finish him here.');
}

// After a bust or a death the fight must be fought again: respawning wipes
// the crew, so a 'defeat' step would otherwise complete itself with no one
// left to fight, and a 'collect' step would have no drops left to pick up.
export function respawnMissionCrew(game) {
  const mission = currentMission(game);
  if (!mission || !game.missionActive) return;
  const step = currentStep(game);
  if (!step) return;
  if (step.kind === 'defeat' && mission.id === 'pier-pressure') spawnPierCrew(game);
  else if (step.kind === 'defeat' && mission.id === 'king-tide') spawnKingCrew(game);
  else if (step.kind === 'collect' && mission.id === 'pier-pressure') spawnPierCrew(game);
}

export function updateMissions(game, dt) {
  if (game.state !== 'playing') return;
  if (!currentMission(game)) return;
  // Brief pause between jobs, then the next briefing.
  if (!game.missionActive) {
    game.startMissionTimer -= dt;
    if (game.startMissionTimer <= 0) startMission(game, game.missionIndex);
    return;
  }
  const mission = currentMission(game);
  const step = currentStep(game);
  if (!step) return;
  const player = game.player;
  const pos = player.car ? { x: player.car.x, y: player.car.y } : player;

  if (step.timer) {
    game.missionTimer += dt;
    if (game.missionTimer > step.timer) {
      failMissionTimer(game);
      game.missionTimer = 0;
      return;
    }
  }

  if (step.kind === 'goto') {
    const target = game.world.spots[step.spot];
    if (distance(pos.x, pos.y, target.x, target.y) < step.radius) {
      if (mission.id === 'pier-pressure' && game.missionStep === 0) spawnPierCrew(game);
      if (mission.id === 'king-tide' && game.missionStep === 0) spawnKingCrew(game);
      advanceStep(game);
    }
  } else if (step.kind === 'steal') {
    // A theft, not just a seat: the player must have lifted a car they did
    // not already own since this job started. Getting back into their own
    // starter car does not count.
    if (game.justStole) {
      game.justStole = false;
      advanceStep(game);
    }
  } else if (step.kind === 'collect') {
    if ((game.collectedDrops || 0) >= step.count) advanceStep(game);
  } else if (step.kind === 'hold') {
    const target = game.world.spots[step.spot];
    if (distance(pos.x, pos.y, target.x, target.y) < step.radius) {
      game.holdProgress += dt;
      if (game.holdProgress >= step.duration) {
        addWanted(game, 3, 'Bank alarm tripped');
        game.addCash(300, 'Vault cash grabbed');
        advanceStep(game);
      }
    } else {
      game.holdProgress = Math.max(0, game.holdProgress - dt * 2);
    }
  } else if (step.kind === 'defeat') {
    if (game.thugs.length === 0) advanceStep(game);
  }
}

// Cash drops and packages lying in the world.
export function updatePickups(game, dt) {
  const player = game.player;
  const pos = player.car ? { x: player.car.x, y: player.car.y } : player;
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    if (distance(pos.x, pos.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        game.collectedDrops = (game.collectedDrops || 0) + 1;
        game.addCash(150, 'Cash drop collected');
      } else if (pk.kind === 'health') {
        healPlayer(game, CFG.healthPickupHeal);
        game.addMessage(`+${CFG.healthPickupHeal} health — patched up.`);
      } else {
        game.addCash(100, 'Package collected');
      }
      game.sound.cash();
      game.addParticles(pk.x, pk.y, '#ffcf3f', 10);
    }
  }
  game.pickups = game.pickups.filter((pk) => !pk.taken);
}
