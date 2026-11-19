// The story: five jobs from Mara Voss on Harbor Row, ending with the Tide King at
// Lighthouse Point. Between jobs the marker sits on Mara; walking into it starts the next
// job. Each job is a small stage machine checked by distance every step.
import * as THREE from 'three';
import { JOBS, PLACES } from './config.js';
import { G, playerPos, toast } from './state.js';
import { makePerson } from './actors.js';
import { spawnGang, spawnPickup } from './combat.js';
import { addStars } from './police.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

let markerMesh = null;
let maraMesh = null;

export function initMissions() {
  // Mara Voss herself: purple jacket, standing on Harbor Row.
  const { group } = makePerson(0x7b2eff, 0x1e1e28, 0xffdbb4);
  group.position.set(PLACES.mara.x, 0, PLACES.mara.z);
  group.rotation.y = Math.PI / 2;
  G.scene.add(group);
  maraMesh = group;

  const geo = new THREE.CylinderGeometry(2.6, 2.6, 7, 18, 1, true);
  markerMesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  markerMesh.position.y = 3.5;
  G.scene.add(markerMesh);
  G.mission.marker = markerMesh;
  setMarker(PLACES.mara.x, PLACES.mara.z);
  G.mission.text = 'See Mara Voss on Harbor Row';
  G.mission.sub = 'West waterfront — the yellow marker. She has work for Rex.';
}

function setMarker(x, z) {
  G.mission.markerPos = { x, z };
  if (markerMesh) {
    markerMesh.position.set(x, 3.5, z);
    markerMesh.visible = true;
  }
}

function clearMarker() {
  G.mission.markerPos = null;
  if (markerMesh) markerMesh.visible = false;
}

function distTo(x, z) {
  const pp = playerPos();
  return Math.hypot(pp.x - x, pp.z - z);
}

function findMissionCar(tag) {
  return G.cars.find((c) => c.missionTag === tag) || null;
}

export function startJob(index) {
  const job = JOBS[index];
  if (!job) return;
  G.mission.index = index;
  G.mission.stage = 0;
  G.mission.data = {};
  toast(`${job.title}`, 3);
  G.mission.sub = job.brief;
  if (job.id === 'pickup') {
    const car = findMissionCar('pickup');
    if (car) setMarker(car.mesh.position.x, car.mesh.position.z);
    G.mission.text = 'Get the sedan in the east lots';
  } else if (job.id === 'delivery') {
    setMarker(PLACES.mara.x, PLACES.mara.z);
    G.mission.text = 'Pick up the package from Mara';
  } else if (job.id === 'tide') {
    setMarker(PLACES.alley.x, PLACES.alley.z);
    G.mission.text = 'Clear the Tide Kings out of the alley';
    if (!G.player.ammo.pistol && G.player.weapon === 'fists') {
      spawnPickup('pistol', PLACES.mara.x + 2, PLACES.mara.z + 2);
      G.mission.sub = `${job.brief} (Mara left a pistol by her spot.)`;
    }
  } else if (job.id === 'hotwheels') {
    const car = findMissionCar('sports');
    if (car) setMarker(car.mesh.position.x, car.mesh.position.z);
    G.mission.text = 'Steal the sports car in the southeast lots';
  } else if (job.id === 'king') {
    setMarker(PLACES.bossArena.x, PLACES.bossArena.z);
    G.mission.text = 'Face the Tide King at Lighthouse Point';
  }
}

function completeJob() {
  const job = JOBS[G.mission.index];
  G.player.cash += job.reward;
  sfx.missionDone();
  toast(`${job.title} complete — +$${job.reward}`, 4);
  const wasKing = job.id === 'king';
  G.mission.index = -1;
  G.mission.next = (G.mission.next ?? 0) + 1;
  G.mission.stage = 0;
  G.mission.data = {};
  if (wasKing) {
    G.won = true;
    G.screen = 'won';
    G.screenTimer = 5;
    sfx.win();
    clearMarker();
    G.mission.text = 'Neon Bay is yours';
    G.mission.sub = 'Free roam. The Tide Kings are finished.';
  } else {
    setMarker(PLACES.mara.x, PLACES.mara.z);
    G.mission.text = 'See Mara Voss on Harbor Row';
    G.mission.sub = 'She has another job for you.';
  }
  saveGame();
}

function failDelivery() {
  toast('Too slow — the guest left. Get a fresh package from Mara.', 3.6);
  G.mission.stage = 0;
  G.mission.timer = 0;
  setMarker(PLACES.mara.x, PLACES.mara.z);
  G.mission.text = 'Pick up a fresh package from Mara';
}

export function updateMissions(dt) {
  if (markerMesh) {
    markerMesh.rotation.y += dt * 1.4;
    markerMesh.material.opacity = 0.24 + Math.sin(G.time * 3) * 0.08;
  }
  if (maraMesh) maraMesh.position.y = Math.sin(G.time * 1.6) * 0.03;
  if (G.screen !== 'play') return;

  const m = G.mission;
  const player = G.player;

  // Between jobs: walk to Mara to start the next one.
  if (m.index === -1) {
    if ((m.next ?? 0) >= JOBS.length) {
      m.text = 'Neon Bay is yours';
      m.sub = 'Free roam — cruise, cause trouble, or just watch the sunset.';
      clearMarker();
      return;
    }
    if (distTo(PLACES.mara.x, PLACES.mara.z) < 3.6) startJob(m.next ?? 0);
    return;
  }

  const job = JOBS[m.index];
  if (job.id === 'pickup') {
    const car = findMissionCar('pickup');
    if (m.stage === 0 && car && player.inCar === car) {
      m.stage = 1;
      setMarker(PLACES.harborDrop.x, PLACES.harborDrop.z);
      m.text = 'Deliver the sedan to Harbor Row';
      m.sub = 'Mara is waiting by the waterfront drop-off.';
      toast('Got it. Now bring it to Harbor Row.', 2.6);
    } else if (m.stage === 1 && car && player.inCar === car && distTo(PLACES.harborDrop.x, PLACES.harborDrop.z) < 4.5) {
      completeJob();
    } else if (m.stage === 0 && car) {
      setMarker(car.mesh.position.x, car.mesh.position.z);
    }
  } else if (job.id === 'delivery') {
    if (m.stage === 0 && distTo(PLACES.mara.x, PLACES.mara.z) < 3.6) {
      m.stage = 1;
      m.timer = job.timeLimit;
      setMarker(PLACES.hotel.x, PLACES.hotel.z);
      m.text = 'Deliver the package to the Hotel Sol';
      m.sub = 'Southeast corner. Beat the clock.';
      toast('Package secured — go, go, go!', 2.4);
    } else if (m.stage === 1) {
      m.timer -= dt;
      m.sub = `Southeast corner. ${Math.max(0, Math.ceil(m.timer))}s left.`;
      if (distTo(PLACES.hotel.x, PLACES.hotel.z) < 4.5) completeJob();
      else if (m.timer <= 0) failDelivery();
    }
  } else if (job.id === 'tide') {
    if (m.stage === 0 && distTo(PLACES.alley.x, PLACES.alley.z) < 20) {
      m.data.gang = spawnGang(PLACES.alley.x, PLACES.alley.z, 3);
      m.stage = 1;
      m.text = 'Defeat the Tide Kings (3)';
      toast('Tide Kings! They are not happy to see you.', 2.6);
    } else if (m.stage === 1) {
      const alive = (m.data.gang || []).filter((g) => g.state !== 'dead').length;
      m.text = `Defeat the Tide Kings (${alive} left)`;
      if (alive === 0) completeJob();
    }
  } else if (job.id === 'hotwheels') {
    const car = findMissionCar('sports');
    if (m.stage === 0 && car && player.inCar === car) {
      m.stage = 1;
      addStars(2, 'that car is reported stolen');
      setMarker(PLACES.garage.x, PLACES.garage.z);
      m.text = 'Garage the sports car on Harbor Row';
      m.sub = 'The NBPD are coming. Lose them or outrun them.';
    } else if (m.stage === 1 && car && player.inCar === car && distTo(PLACES.garage.x, PLACES.garage.z) < 4.5) {
      completeJob();
    } else if (m.stage === 0 && car) {
      setMarker(car.mesh.position.x, car.mesh.position.z);
    }
  } else if (job.id === 'king') {
    if (m.stage === 0 && distTo(PLACES.bossArena.x, PLACES.bossArena.z) < 22) {
      m.data.gang = spawnGang(PLACES.bossArena.x, PLACES.bossArena.z, 2, true);
      m.stage = 1;
      m.text = 'Defeat the Tide King';
      m.sub = 'Watch the shotgun. Use the lighthouse for cover.';
      clearMarker();
      toast('The Tide King holds court. End it, Rex.', 3);
    } else if (m.stage === 1) {
      const boss = (m.data.gang || []).find((g) => g.boss);
      if (boss && boss.state === 'dead') completeJob();
    }
  }
}
