// Neon Bay 3D — story: five jobs from fixer Mara Voss, plus three optional side
// jobs (street race, store robbery, taxi fare). The King fight is staged on the
// lighthouse beach itself, with the crew leashed to the sand.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const { garage, market, marina, vault, pierEnd, beachCenter, beach, pay } = CONFIG;

const RACE_POINTS = [
  { x: 640, y: 336 }, { x: 1552, y: 640 }, { x: 2464, y: 1248 },
  { x: 2768, y: 2160 }, { x: 1552, y: 2768 },
];

export class MissionSys {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.index = 0;
    this.step = 0;
    this.timer = 0;
    this.target = { x: garage.x, y: garage.y, label: 'Steal a car' };
    this.boss = null;
    this.vaultT = 0;
    this.pierCash = null;
    this._waveFlags = {};
    // Main beacon: tall light pillar at the current objective.
    const geo = new THREE.CylinderGeometry(10, 14, 320, 10, 1, true);
    this.beacon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffd24d, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.beacon.position.set(garage.x, 160, garage.y);
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(26, 34, 24);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffd24d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(garage.x, 1.2, garage.y);
    scene.add(this.ring);
    // Side-job markers (green pillars).
    this.sideJobs = [
      { id: 'race', name: 'Street Race', x: CONFIG.raceStart.x, y: CONFIG.raceStart.y, state: 'idle', cp: 0, timer: 0 },
      { id: 'robbery', name: 'Store Robbery', x: CONFIG.store.x, y: CONFIG.store.y, state: 'idle', hold: 0 },
      { id: 'taxi', name: 'Taxi Fare', x: CONFIG.taxiStand.x, y: CONFIG.taxiStand.y, state: 'idle', timer: 0, ped: null },
    ];
    for (const sj of this.sideJobs) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 10, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x2aff5a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      m.position.set(sj.x, 60, sj.y);
      scene.add(m);
      sj.beacon = m;
    }
  }

  start() {
    this.index = 0;
    this.step = 0;
    this.timer = 0;
    this.boss = null;
    this.vaultT = 0;
    this._clearPierCash();
    this.setTarget(null, 'Steal a car');
  }

  setTarget(pos, label) {
    if (pos) { this.target.x = pos.x; this.target.y = pos.y; }
    this.target.label = label;
  }

  _clearPierCash() {
    if (this.pierCash) {
      this.scene.remove(this.pierCash.mesh);
      this.pierCash = null;
    }
  }

  _spawnPierCash(G) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(18, 12, 14),
      new THREE.MeshStandardMaterial({ color: 0x2aff5a, roughness: 0.5, emissive: 0x2aff5a, emissiveIntensity: 0.5 })
    );
    m.position.set(pierEnd.x, 6, pierEnd.y);
    this.scene.add(m);
    this.pierCash = { x: pierEnd.x, y: pierEnd.y, mesh: m };
  }

  _spawnBeachCrew(G) {
    const spots = [
      [3270, 1500, true], [3200, 1300, false], [3360, 1400, false],
      [3220, 1800, false], [3380, 1900, false],
    ];
    for (const [x, y, king] of spots) {
      const t = G.combat.spawnThug(x, y, king);
      t.beachBound = true; // the crew is leashed to the sand
      if (king) this.boss = t;
    }
  }

  _complete(G, amount) {
    G.player.money += amount;
    G.audio.jingle();
    G.hud.toast(`Job done — +$${amount}`);
    this.index++;
    this.step = 0;
    this.timer = 0;
    this.vaultT = 0;
    this._waveFlags = {};
    G.save();
  }

  resetForBusted(G) {
    G.combat.clearThugs();
    this.boss = null;
    this._clearPierCash();
    this.vaultT = 0;
    this.timer = 0;
    this._waveFlags = {};
    if (this.index === 0) { this.step = 0; this.setTarget(null, 'Steal a car'); }
    if (this.index === 1) { this.step = 0; this.setTarget(market, 'Pick up the package at the night market'); }
    if (this.index === 2) { this.step = 0; this.setTarget(pierEnd, 'Take back the pier cash'); }
    if (this.index === 3) { this.step = 0; this.setTarget(vault, 'Get to the Bay Trust vault'); }
    if (this.index === 4) { this.step = 0; this.setTarget(beachCenter, 'Finish King at Lighthouse Point'); }
    // Side jobs reset to idle (their fare/ped is gone).
    for (const sj of this.sideJobs) {
      if (sj.state === 'active') {
        sj.state = 'idle';
        sj.cp = 0; sj.hold = 0;
        if (sj.ped) { this.scene.remove(sj.ped.mesh); sj.ped = null; }
      }
    }
  }

  // E pressed near a side-job spot (on foot only).
  trySideJob(G) {
    if (this.index < 1 || this.index > 4) return false;
    if (this.index === 4 && this.step === 1) return false;
    const p = G.player;
    if (p.inCar) return false;
    for (const sj of this.sideJobs) {
      if (sj.state !== 'idle') continue;
      if (Math.hypot(sj.x - p.x, sj.y - p.y) < 44) {
        sj.state = 'active';
        if (sj.id === 'race') {
          sj.cp = 0; sj.timer = 90;
          this.setTarget(RACE_POINTS[0], 'Race: checkpoint 1/5');
          G.hud.toast('Street race! Hit all 5 checkpoints in 90s');
        } else if (sj.id === 'robbery') {
          sj.hold = 0;
          G.hud.toast('Hold still in the store…');
        } else {
          sj.timer = 120;
          const ped = G.traffic.peds.find((q) => !q.down && Math.hypot(q.x - sj.x, q.y - sj.y) < 400)
            || G.traffic.peds[0];
          sj.ped = ped;
          G.hud.toast('Fare picked up — take them to Harbor Row');
        }
        G.audio.pickup();
        return true;
      }
    }
    return false;
  }

  update(dt, G) {
    const p = G.player;
    const dist = (t) => Math.hypot(t.x - p.x, t.y - p.y);
    // Beacon follows the current objective.
    this.beacon.position.set(this.target.x, 160, this.target.y);
    this.ring.position.set(this.target.x, 1.2, this.target.y);
    const pulse = 0.22 + Math.sin(G.time * 3) * 0.08;
    this.beacon.material.opacity = pulse;
    // ---- Main story ----
    if (this.index === 0) {
      if (this.step === 0) {
        // Nearest stealable car becomes the target.
        let best = null, bd = Infinity;
        for (const c of G.vehicles.cars) {
          if (c.kind !== 'parked' || c.wrecked || c.owner) continue;
          const d = Math.hypot(c.x - p.x, c.y - p.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) this.setTarget(best, 'Steal a car');
        if (p.inCar) {
          this.step = 1;
          this.setTarget(garage, "Drive to Mara's garage");
          G.hud.toast('Nice wheels. Take them to Mara.');
        }
      } else if (dist(garage) < 90) {
        this._complete(G, pay.m1);
        this.setTarget(market, 'Pick up the package at the night market');
      }
    } else if (this.index === 1) {
      if (this.step === 0) {
        if (dist(market) < 65) {
          this.step = 1;
          this.timer = CONFIG.m2TimeLimit;
          this.setTarget(marina, 'Deliver to the marina — timed!');
          G.audio.pickup();
        }
      } else {
        this.timer -= dt;
        this.setTarget(marina, `Deliver to the marina — ${Math.max(0, Math.ceil(this.timer))}s`);
        if (this.timer <= 0) {
          this.step = 0;
          this.setTarget(market, 'Too slow — pick up the package again');
          G.hud.toast('Too slow! Back to the market.');
        } else if (dist(marina) < 65) {
          this._complete(G, pay.m2);
          this.setTarget(pierEnd, 'Take back the pier cash');
        }
      }
    } else if (this.index === 2) {
      if (this.step === 0) {
        if (dist(pierEnd) < 100) {
          this.step = 1;
          for (const [x, y] of [[3690, 2350], [3710, 2450], [3670, 2400], [3700, 2380]]) {
            G.combat.spawnThug(x, y, false);
          }
          this.setTarget(pierEnd, 'Take back the pier cash — fight!');
          G.hud.toast('Tide Kings on the pier!');
        }
      } else if (this.step === 1) {
        if (G.combat.thugs.length === 0) {
          this._spawnPierCash(G);
          this.step = 2;
          this.setTarget(pierEnd, 'Grab the cash');
        }
      } else if (this.step === 2) {
        if (this.pierCash && dist(this.pierCash) < 35) {
          this._clearPierCash();
          G.audio.coin();
          this.step = 3;
          this.setTarget(garage, "Bring the cash to Mara's garage");
        }
      } else if (dist(garage) < 90) {
        this._complete(G, pay.m3);
        this.setTarget(vault, 'Get to the Bay Trust vault');
      }
    } else if (this.index === 3) {
      if (this.step === 0) {
        if (dist(vault) < 65) {
          this.step = 1;
          this.vaultT = CONFIG.vaultHoldTime;
          for (const [x, y] of [[1600, 1700], [1810, 1700], [1704, 1740]]) {
            G.combat.spawnThug(x, y, false);
          }
          G.hud.toast('Hold the vault — Kings incoming!');
        }
      } else if (this.step === 1) {
        this.vaultT -= dt;
        this.setTarget(vault, `Hold the vault — ${Math.max(0, Math.ceil(this.vaultT))}s`);
        if (this.vaultT < 30 && !this._waveFlags.w2) {
          this._waveFlags.w2 = true;
          for (const [x, y] of [[1640, 1560], [1770, 1560], [1600, 1620]]) G.combat.spawnThug(x, y, false);
        }
        if (this.vaultT < 15 && !this._waveFlags.w3) {
          this._waveFlags.w3 = true;
          for (const [x, y] of [[1810, 1620], [1640, 1760], [1780, 1760]]) G.combat.spawnThug(x, y, false);
        }
        if (this.vaultT <= 0) {
          this.step = 2;
          this.setTarget(garage, "Bring the vault cash to Mara's garage");
          G.hud.toast('Vault held! Get out of there.');
        }
      } else if (dist(garage) < 90) {
        this._complete(G, pay.m4);
        this.setTarget(beachCenter, 'Finish King at Lighthouse Point');
      }
    } else if (this.index === 4) {
      if (this.step === 0) {
        if (dist(beachCenter) < 210) {
          this.step = 1;
          this._spawnBeachCrew(G);
          this.setTarget(beachCenter, 'Finish King on the beach!');
          G.hud.toast('King is here. End it.');
        }
      } else if (this.boss && !G.combat.thugs.includes(this.boss)) {
        // King is down — the city is yours.
        this.boss = null;
        G.onWin();
      }
    }
    // ---- Side jobs ----
    for (const sj of this.sideJobs) {
      sj.beacon.visible = sj.state === 'idle' && this.index >= 1 && this.index <= 4;
      if (sj.state !== 'active') continue;
      if (sj.id === 'race') {
        sj.timer -= dt;
        const cp = RACE_POINTS[sj.cp];
        this.setTarget(cp, `Race: checkpoint ${sj.cp + 1}/5 — ${Math.max(0, Math.ceil(sj.timer))}s`);
        if (dist(cp) < 55) {
          sj.cp++;
          G.audio.coin();
          if (sj.cp >= RACE_POINTS.length) {
            sj.state = 'done';
            p.money += pay.race;
            G.audio.jingle();
            G.hud.toast(`Race won — +$${pay.race}`);
            this._restoreMainTarget();
          }
        } else if (sj.timer <= 0) {
          sj.state = 'idle';
          G.hud.toast('Race lost — try again at the start line');
          this._restoreMainTarget();
        }
      } else if (sj.id === 'robbery') {
        if (dist(sj) < 40) {
          sj.hold += dt;
          this.setTarget(sj, `Robbing the store… ${Math.ceil(5 - sj.hold)}s`);
          if (sj.hold >= 5) {
            sj.state = 'done';
            p.money += pay.robbery;
            G.police.addWanted(2, G);
            G.audio.coin();
            G.hud.toast(`+$${pay.robbery} — and the cops know!`);
            this._restoreMainTarget();
          }
        } else {
          sj.hold = 0;
        }
      } else if (sj.id === 'taxi') {
        sj.timer -= dt;
        const dest = { x: 1100, y: 2600 };
        if (sj.ped) {
          // The fare follows Rex on foot.
          if (!p.inCar) {
            const d = Math.hypot(sj.ped.x - p.x, sj.ped.y - p.y);
            if (d > 34) {
              const np = this.world.moveCircle(sj.ped.x, sj.ped.y, ((p.x - sj.ped.x) / d) * 130 * dt, ((p.y - sj.ped.y) / d) * 130 * dt, 12);
              sj.ped.x = np.x; sj.ped.y = np.y;
              sj.ped.mesh.position.set(sj.ped.x, 0, sj.ped.y);
            }
          }
        }
        this.setTarget(dest, `Taxi fare — ${Math.max(0, Math.ceil(sj.timer))}s`);
        if (dist(dest) < 50) {
          sj.state = 'done';
          p.money += pay.taxi;
          G.audio.jingle();
          G.hud.toast(`Fare delivered — +$${pay.taxi}`);
          this._restoreMainTarget();
        } else if (sj.timer <= 0) {
          sj.state = 'idle';
          sj.ped = null;
          G.hud.toast('Fare walked off…');
          this._restoreMainTarget();
        }
      }
    }
  }

  // Restore the main-story objective (position + label) after a side job ends.
  _restoreMainTarget() {
    const L = {
      m1a: 'Steal a car', m1b: "Drive to Mara's garage",
      m2a: 'Pick up the package at the night market', m2b: 'Deliver to the marina — timed!',
      m3a: 'Take back the pier cash', m3b: 'Take back the pier cash — fight!',
      m3c: 'Grab the cash', m3d: "Bring the cash to Mara's garage",
      m4a: 'Get to the Bay Trust vault', m4b: 'Hold the vault',
      m4c: "Bring the vault cash to Mara's garage",
      m5a: 'Finish King at Lighthouse Point', m5b: 'Finish King on the beach!',
    };
    let pos = garage, label = 'Steal a car';
    if (this.index === 0) { pos = this.step === 0 ? { x: 488, y: 1360 } : garage; label = this.step === 0 ? L.m1a : L.m1b; }
    else if (this.index === 1) { pos = this.step === 0 ? market : marina; label = this.step === 0 ? L.m2a : L.m2b; }
    else if (this.index === 2) { pos = this.step <= 2 ? pierEnd : garage; label = [L.m3a, L.m3b, L.m3c, L.m3d][this.step]; }
    else if (this.index === 3) { pos = this.step <= 1 ? vault : garage; label = [L.m4a, L.m4b, L.m4c][this.step]; }
    else if (this.index === 4) { pos = beachCenter; label = this.step === 0 ? L.m5a : L.m5b; }
    this.setTarget(pos, label);
  }
}
