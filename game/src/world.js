// Neon Bay 3D — the city: one canvas-textured ground (roads, crosswalks, beach,
// pier, plaza, parks), seeded buildings with lit windows, lamps, trees, neon
// signs, marina, and the lighthouse. Ground coords (x east, y south) map to
// Three.js (x, 0, y). Collision is 2D AABBs on that same plane.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

const { roadCenters, roadHalf, beach, pier, lighthouse } = CONFIG;

function groundCanvases(rng) {
  const W = 2048, H = 2048;
  const sx = W / 3600, sy = H / 3104;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = document.createElement('canvas');
  r.width = W; r.height = H;
  const rg = r.getContext('2d');
  // Base: sidewalks.
  g.fillStyle = '#9a8a76'; g.fillRect(0, 0, W, H);
  rg.fillStyle = '#e6e6e6'; rg.fillRect(0, 0, W, H);
  // Block tint variation + parks.
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const x0 = (roadCenters[i] + roadHalf) * sx, x1 = (roadCenters[i + 1] - roadHalf) * sx;
      const y0 = (roadCenters[j] + roadHalf) * sy, y1 = (roadCenters[j + 1] - roadHalf) * sy;
      const park = (i === 2 && j === 2) || (i === 7 && j === 3);
      if (park) { g.fillStyle = '#4a7a4a'; g.fillRect(x0, y0, x1 - x0, y1 - y0); continue; }
      const v = rng.int(-8, 8);
      g.fillStyle = `rgb(${154 + v},${138 + v},${118 + v})`;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Plaza (center block) tiles.
  const px0 = (roadCenters[5] + roadHalf) * sx, px1 = (roadCenters[6] - roadHalf) * sx;
  const py0 = (roadCenters[5] + roadHalf) * sy, py1 = (roadCenters[6] - roadHalf) * sy;
  g.fillStyle = '#b8a888'; g.fillRect(px0, py0, px1 - px0, py1 - py0);
  // Beach sand + pier wood.
  g.fillStyle = '#e8c98a';
  g.fillRect(beach.x0 * sx, beach.y0 * sy, (beach.x1 - beach.x0) * sx, (beach.y1 - beach.y0) * sy);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rng.chance(0.5) ? '#d8b87a' : '#f0d89a';
    g.fillRect((beach.x0 + rng.range(0, beach.x1 - beach.x0)) * sx, (beach.y0 + rng.range(0, beach.y1 - beach.y0)) * sy, 3, 3);
  }
  g.fillStyle = '#7a5a3a';
  g.fillRect(pier.x0 * sx, pier.y0 * sy, (pier.x1 - pier.x0) * sx, (pier.y1 - pier.y0) * sy);
  // Roads (dark, glossy) + center dashes + crosswalks.
  g.fillStyle = '#38323e';
  rg.fillStyle = '#404040'; // low roughness = wet shine
  for (const cx of roadCenters) {
    g.fillRect((cx - roadHalf) * sx, 0, roadHalf * 2 * sx, H);
    rg.fillRect((cx - roadHalf) * sx, 0, roadHalf * 2 * sx, H);
    g.fillRect(0, (cx - roadHalf) * sy, W, roadHalf * 2 * sy);
    rg.fillRect(0, (cx - roadHalf) * sy, W, roadHalf * 2 * sy);
  }
  g.fillStyle = '#d8a020';
  for (const cx of roadCenters) {
    for (let y = 0; y < 3104; y += 120) {
      if (Math.abs(y - cx) < 90) continue;
      g.fillRect(cx * sx - 2, y * sy, 4, 40 * sy);
    }
    for (let x = 0; x < 3600; x += 120) {
      if (Math.abs(x - cx) < 90) continue;
      g.fillRect(x * sx, cx * sy - 2, 40 * sx, 4);
    }
  }
  g.fillStyle = '#e8e8e8';
  for (const cx of roadCenters) {
    for (const cy of roadCenters) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect((cx - 36 + k * 12) * sx, (cy - roadHalf) * sy, 6 * sx, 16 * sy);
        g.fillRect((cx - 36 + k * 12) * sx, (cy + roadHalf - 16) * sy, 6 * sx, 16 * sy);
        g.fillRect((cx - roadHalf) * sx, (cy - 36 + k * 12) * sy, 16 * sx, 6 * sy);
        g.fillRect((cx + roadHalf - 16) * sx, (cy - 36 + k * 12) * sy, 16 * sx, 6 * sy);
      }
    }
  }
  return { color: c, rough: r };
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#332833'; g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = Math.random() < 0.55;
      g.fillStyle = lit ? (Math.random() < 0.8 ? '#ffca6a' : '#7ad8ff') : '#191420';
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.buildings = [];
    this.boats = [];
    const C = CONFIG.colors;
    // Ground: one textured plane (color + roughness for wet roads).
    const { color, rough } = groundCanvases(rng);
    const colorTex = new THREE.CanvasTexture(color);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = 4;
    const roughTex = new THREE.CanvasTexture(rough);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3600, 3104),
      new THREE.MeshStandardMaterial({ map: colorTex, roughnessMap: roughTex, roughness: 1, metalness: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1800, 0, 1552);
    ground.receiveShadow = true;
    scene.add(ground);
    // Bay water east of the beach.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 3104),
      new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.96 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(3456 + 550, 0.4, 1552);
    water.receiveShadow = true;
    scene.add(water);
    this.water = water;
    // Buildings.
    const winTex = windowTexture();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.9 });
    const mats = C.building.map((col) => new THREE.MeshStandardMaterial({
      map: winTex, color: col, roughness: 0.85, metalness: 0.05,
      emissive: 0xff9a3c, emissiveMap: winTex, emissiveIntensity: 0.35,
    }));
    const plazaCell = (i, j) => i === 5 && j === 5;
    const parkCell = (i, j) => (i === 2 && j === 2) || (i === 7 && j === 3);
    const marketCell = (i, j) => i === 4 && j === 1;
    const garageCell = (i, j) => i === 1 && j === 4;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (parkCell(i, j) || marketCell(i, j) || garageCell(i, j)) continue;
        const bx0 = roadCenters[i] + roadHalf, bx1 = roadCenters[i + 1] - roadHalf;
        const by0 = roadCenters[j] + roadHalf, by1 = roadCenters[j + 1] - roadHalf;
        if (plazaCell(i, j)) {
          // Bay Trust bank on the plaza's north side.
          this.addBuilding(bx0 + 30, by0 + 10, bx0 + 186, by0 + 80, 64, mats, boxGeo, roofMat, scene);
          continue;
        }
        const n = rng.chance(0.6) ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const w = rng.range(70, 115), d = rng.range(70, 115);
          // Buildings sit well back from the road edge: a wide drivable
          // perimeter stays around every block, so corner cuts never wedge.
          const x0 = bx0 + rng.range(42, Math.max(43, bx1 - bx0 - w - 42));
          const y0 = by0 + rng.range(42, Math.max(43, by1 - by0 - d - 42));
          // Keep mission-critical spots clear of buildings.
          const cx = x0 + w / 2, cy = y0 + d / 2;
          const clear = [[1400, 488], [2616, 2580], [2400, 1100], [800, 2300], [2000, 2600]];
          if (clear.some(([px, py]) => Math.hypot(cx - px, cy - py) < 130)) continue;
          const h = rng.range(26, 60) + (i >= 4 && i <= 6 && j >= 4 && j <= 6 ? rng.range(0, 60) : 0);
          this.addBuilding(x0, y0, x0 + w, y0 + d, h, mats, boxGeo, roofMat, scene);
        }
      }
    }
    // Market stalls.
    const stallMat = new THREE.MeshStandardMaterial({ color: 0xc23b6a, roughness: 0.8 });
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(boxGeo, stallMat);
      m.scale.set(40, 14, 26);
      m.position.set(1340 + k * 55, 7, 500);
      m.castShadow = true;
      scene.add(m);
    }
    // Garage building (low, with lot) — fully inside its block, clear of the road.
    const gar = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.8 }));
    gar.scale.set(120, 22, 45);
    gar.position.set(488, 11, 1322);
    gar.castShadow = true;
    scene.add(gar);
    this.buildings.push({ x0: 428, y0: 1300, x1: 548, y1: 1345, h: 22 });
    // Fountain in the plaza.
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 6, 20), new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.7 }));
    basin.position.set(1704, 3, 1740);
    scene.add(basin);
    const fwater = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 2, 20), new THREE.MeshStandardMaterial({ color: 0x3a7a9a, roughness: 0.15, metalness: 0.4 }));
    fwater.position.set(1704, 6, 1740);
    scene.add(fwater);
    // Lamps (instanced) along roads.
    this.buildLamps(scene, rng);
    // Trees (instanced) in parks and along sidewalks.
    this.buildTrees(scene, rng);
    // Neon signs downtown.
    this.buildNeon(scene, rng);
    // Lighthouse.
    this.buildLighthouse(scene);
    // Marina boats in the bay.
    this.buildBoats(scene, rng);
  }

  addBuilding(x0, y0, x1, y1, h, mats, boxGeo, roofMat, scene) {
    const mat = mats[Math.floor(this.rng.next() * mats.length)];
    const m = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
    m.scale.set(x1 - x0, h, y1 - y0);
    m.position.set((x0 + x1) / 2, h / 2, (y0 + y1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    this.buildings.push({ x0, y0, x1, y1, h });
    // Helipad on the tallest towers.
    if (h > 95) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set((x0 + x1) / 2, h + 0.3, (y0 + y1) / 2);
      scene.add(pad);
    }
  }

  buildLamps(scene, rng) {
    const spots = [];
    for (const cx of roadCenters) {
      for (let y = 200; y < 3104; y += 600) {
        spots.push([cx - 56, y]);
        spots.push([cx + 56, y + 300]);
      }
      for (let x = 200; x < 3104; x += 600) {
        spots.push([x, cx - 56]);
        spots.push([x + 300, cx + 56]);
      }
    }
    const poleGeo = new THREE.CylinderGeometry(1.2, 1.6, 26, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.5 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const headGeo = new THREE.SphereGeometry(3.2, 8, 6);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffc06a });
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, y], i) => {
      m4.makeTranslation(x, 13, y);
      poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, 27, y);
      heads.setMatrixAt(i, m4);
    });
    scene.add(poles);
    scene.add(heads);
  }

  buildTrees(scene, rng) {
    const spots = [];
    for (let k = 0; k < 26; k++) {
      const park = rng.chance(0.5)
        ? { x0: roadCenters[2] + roadHalf, x1: roadCenters[3] - roadHalf, y0: roadCenters[2] + roadHalf, y1: roadCenters[3] - roadHalf }
        : { x0: roadCenters[7] + roadHalf, x1: roadCenters[8] - roadHalf, y0: roadCenters[3] + roadHalf, y1: roadCenters[4] - roadHalf };
      spots.push([rng.range(park.x0 + 15, park.x1 - 15), rng.range(park.y0 + 15, park.y1 - 15)]);
    }
    for (let k = 0; k < 30; k++) {
      const cx = rng.pick(roadCenters);
      spots.push([cx + rng.pick([-58, 58]), rng.range(100, 3000)]);
    }
    const trunkGeo = new THREE.CylinderGeometry(2, 3, 12, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const topGeo = new THREE.ConeGeometry(11, 26, 8);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x3a6a3a, roughness: 0.9 });
    const tops = new THREE.InstancedMesh(topGeo, topMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, y], i) => {
      m4.makeTranslation(x, 6, y);
      trunks.setMatrixAt(i, m4);
      m4.makeTranslation(x, 24, y);
      tops.setMatrixAt(i, m4);
    });
    trunks.castShadow = true;
    tops.castShadow = true;
    scene.add(trunks);
    scene.add(tops);
  }

  buildNeon(scene, rng) {
    const C = CONFIG.colors;
    const spots = [
      [1552, 1248, 0xff2e88], [1856, 1552, 0x00e5ff], [1248, 1856, 0xffe14d],
      [2160, 1248, 0xff6a00], [1552, 2160, 0x7cff4d], [1856, 944, 0xff2e88],
      [944, 1552, 0x00e5ff], [2464, 1856, 0xffe14d],
    ];
    for (const [x, y, col] of spots) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 10),
        new THREE.MeshBasicMaterial({ color: col })
      );
      sign.position.set(x, 34, y);
      sign.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      scene.add(sign);
    }
  }

  buildLighthouse(scene) {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 70, 12), white);
    base.position.y = 35;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(17, 17.5, 12, 12), red);
    band.position.y = 42;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, emissive: 0xffc06a, emissiveIntensity: 0.9 }));
    top.position.y = 78;
    g.add(base, band, top);
    // Rotating beam: long translucent cone, horizontal.
    const beamGeo = new THREE.ConeGeometry(24, 300, 12, 1, true);
    beamGeo.rotateZ(-Math.PI / 2);
    beamGeo.translate(150, 0, 0);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.y = 78;
    g.add(beam);
    const lamp = new THREE.PointLight(0xffc06a, 900, 420, 1.8);
    lamp.position.y = 78;
    g.add(lamp);
    g.position.set(lighthouse.x, 0, lighthouse.y);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    this.beam = beam;
    this.buildings.push({ x0: lighthouse.x - 20, y0: lighthouse.y - 20, x1: lighthouse.x + 20, y1: lighthouse.y + 20, h: 80 });
  }

  buildBoats(scene, rng) {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(46, 8, 16), hullMat);
      hull.position.y = 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 12), cabMat);
      cab.position.set(-6, 10, 0);
      boat.add(hull, cab);
      boat.position.set(3520 + rng.range(0, 200), 0.5, 700 + k * 480 + rng.range(-80, 80));
      boat.rotation.y = rng.range(-0.4, 0.4);
      scene.add(boat);
      this.boats.push(boat);
    }
  }

  isWater(x, y) {
    if (x > 3456) {
      if (x <= pier.x1 && y >= pier.y0 && y <= pier.y1) return false;
      return true;
    }
    return false;
  }

  // Axis-separated circle move with building + water collision.
  moveCircle(x, y, dx, dy, r) {
    let nx = x + dx;
    if (!this._blocked(nx, y, r)) x = nx;
    let ny = y + dy;
    if (!this._blocked(x, ny, r)) y = ny;
    return { x, y };
  }

  _blocked(x, y, r) {
    if (x < 20 || x > 3740 || y < 20 || y > 3084) return true;
    if (this.isWater(x, y)) return true;
    for (const b of this.buildings) {
      if (x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r) return true;
    }
    return false;
  }

  onRoad(x, y) {
    for (const c of roadCenters) {
      if (Math.abs(x - c) <= roadHalf || Math.abs(y - c) <= roadHalf) return true;
    }
    return false;
  }

  nearestRoadCenter(v) {
    let best = roadCenters[0];
    for (const c of roadCenters) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    return best;
  }

  update(dt, time) {
    if (this.beam) this.beam.rotation.y = time * 0.55;
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      b.position.y = 0.5 + Math.sin(time * 0.7 + i * 1.7) * 0.5;
      b.rotation.z = Math.sin(time * 0.5 + i) * 0.02;
    }
  }
}
