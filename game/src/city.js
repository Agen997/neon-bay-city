// Builds the city of Neon Bay: sunset sky and lights, the road grid, sidewalk blocks,
// pastel towers with lit windows, neon signs, instanced palms and streetlights, the beach,
// the water, and the Lighthouse Point lighthouse with its rotating beam. Fills G.colliders
// with building AABBs and offers the road/collision helpers every mover uses.
import * as THREE from 'three';
import { COLORS, PLACES, WORLD } from './config.js';
import { G } from './state.js';
import { int, pick, range } from './rng.js';
import { asphaltTexture, facadeTextures, lighthouseTexture, neonTexture, waterTexture } from './textures.js';

const ROAD_LINES = [];
for (let v = -200; v <= 200; v += WORLD.roadStep) ROAD_LINES.push(v);

export function roadLines() {
  return ROAD_LINES;
}

export function isOnRoad(x, z) {
  for (const r of ROAD_LINES) {
    if (Math.abs(x - r) <= WORLD.roadHalf + 0.5 || Math.abs(z - r) <= WORLD.roadHalf + 0.5) return true;
  }
  return false;
}

/** Snap a point to the nearest road centreline (used to spawn police and traffic). */
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const r of ROAD_LINES) {
    const d1 = Math.abs(x - r);
    if (d1 < bestD) {
      bestD = d1;
      best = { x: r, z };
    }
    const d2 = Math.abs(z - r);
    if (d2 < bestD) {
      bestD = d2;
      best = { x, z: r };
    }
  }
  return best;
}

/** Push a circle (pos, radius) out of every building AABB and inside the world bounds. */
export function collide(pos, radius) {
  for (const b of G.colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the shallowest axis.
      const left = pos.x - b.minX;
      const right = b.maxX - pos.x;
      const top = pos.z - b.minZ;
      const bottom = b.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.minX - radius;
      else if (m === right) pos.x = b.maxX + radius;
      else if (m === top) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
  }
  pos.x = Math.max(WORLD.minX, Math.min(WORLD.half - 2, pos.x));
  pos.z = Math.max(-WORLD.half + 2, Math.min(WORLD.half - 2, pos.z));
}

const FACADE_BASES = ['#e8b4a0', '#a8d8d0', '#f2d492', '#c5b8e8', '#f4a9b8', '#b8d4f0', '#e8e0d0', '#9fd8b4'];
const SIGN_WORDS = [
  ['NEON BAY', '#ff5da2'],
  ['HARBOR ROW', '#4de8ff'],
  ['TIDE BAR', '#2ec4b6'],
  ['24H DINER', '#ffd23e'],
  ['HOTEL SOL', '#ff9f43'],
  ['PIER 9', '#7dff8a'],
  ['SURF SHOP', '#56cbf5'],
  ['CASINO AZUL', '#c77dff'],
  ['PALM COURT', '#ff8fab'],
  ['BAY FM 98.1', '#ffe27a'],
];

function buildSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      mid: { value: new THREE.Color(COLORS.skyMid) },
      low: { value: new THREE.Color(COLORS.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;' +
      'void main(){ float h = normalize(vP).y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : mix(low, mid, smoothstep(-0.06, 0.18, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 14), skyMat);
  scene.add(sky);
  // The sun itself, low over the water in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunDisc.position.set(-820, 95, 60);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a5c, fog: false, transparent: true, opacity: 0.28 }),
  );
  glow.position.copy(sunDisc.position);
  glow.lookAt(0, 40, 0);
  scene.add(glow);
}

function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x50405e, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.3);
  sun.position.set(-180, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  G.sun = sun;
  const amb = new THREE.AmbientLight(0x705a80, 0.5);
  scene.add(amb);
}

function buildGround(scene) {
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.08;
  sand.receiveShadow = true;
  scene.add(sand);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(446, 0.12, 486),
    new THREE.MeshStandardMaterial({ color: 0x8f9484, roughness: 1 }),
  );
  slab.position.set(21, -0.06, 0);
  slab.receiveShadow = true;
  scene.add(slab);

  const waterTex = waterTexture();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 900),
    new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.35, metalness: 0.1, emissive: 0x0d3a4d, emissiveIntensity: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WORLD.waterX - 110, -0.45, 0);
  scene.add(water);
  G.waterTex = waterTex;

  // Roads: one long strip per line, dashes along the centre.
  const asphalt = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 });
  const roadGeo = new THREE.PlaneGeometry(WORLD.roadHalf * 2, 486);
  for (const r of ROAD_LINES) {
    const v = new THREE.Mesh(roadGeo, roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(r, 0.02, 0);
    v.receiveShadow = true;
    scene.add(v);
    const h = new THREE.Mesh(roadGeo, roadMat);
    h.rotation.x = -Math.PI / 2;
    h.rotation.z = Math.PI / 2;
    h.position.set(21, 0.03, r);
    h.receiveShadow = true;
    scene.add(h);
  }
}

function buildBlocks(scene) {
  const rng = G.rng;
  const platformMat = new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 });
  const lotMat = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4048, roughness: 1 });
  const facadeTex = FACADE_BASES.map((base) => facadeTextures(rng, base));
  const podiumMat = new THREE.MeshStandardMaterial({ color: 0x2e2a33, emissive: 0x14424e, emissiveIntensity: 0.4, roughness: 0.9 });
  function facadeMaterial(w, h) {
    const t = pick(rng, facadeTex);
    const map = t.map.clone();
    const emissiveMap = t.emissiveMap.clone();
    map.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 24)));
    emissiveMap.repeat.copy(map.repeat);
    map.needsUpdate = true;
    emissiveMap.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: 0xffca7a,
      emissiveIntensity: 0.85,
      roughness: 0.9,
    });
  }
  const signSpots = [];
  const blockCenters = [];
  for (let v = -175; v <= 175; v += WORLD.roadStep) blockCenters.push(v);

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const isLot = rng() < 0.14;
      const plat = new THREE.Mesh(new THREE.BoxGeometry(36, 0.36, 36), isLot ? lotMat : platformMat);
      plat.position.set(bx, 0.18, bz);
      plat.receiveShadow = true;
      scene.add(plat);
      if (isLot) continue;
      const layout = rng();
      const spots =
        layout < 0.35
          ? [{ dx: 0, dz: 0, w: range(rng, 17, 22), d: range(rng, 17, 22), h: range(rng, 26, 48) }]
          : [
              { dx: -8.5, dz: -8.5, w: range(rng, 10, 14), d: range(rng, 10, 14), h: range(rng, 10, 26) },
              { dx: 8.5, dz: -8.5, w: range(rng, 10, 14), d: range(rng, 10, 14), h: range(rng, 10, 30) },
              { dx: -8.5, dz: 8.5, w: range(rng, 10, 14), d: range(rng, 10, 14), h: range(rng, 8, 20) },
              { dx: 8.5, dz: 8.5, w: range(rng, 10, 14), d: range(rng, 10, 14), h: range(rng, 12, 34) },
            ].slice(0, int(rng, 2, 4));
      for (const s of spots) {
        const mat = facadeMaterial(s.w, s.h);
        const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), [mat, mat, roofMat, roofMat, mat, mat]);
        b.position.set(bx + s.dx, s.h / 2 + 0.36, bz + s.dz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        // dark storefront podium at street level
        const podium = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.4, 2.4, s.d + 0.4), podiumMat);
        podium.position.set(bx + s.dx, 1.2 + 0.36, bz + s.dz);
        scene.add(podium);
        G.colliders.push({
          minX: bx + s.dx - s.w / 2,
          maxX: bx + s.dx + s.w / 2,
          minZ: bz + s.dz - s.d / 2,
          maxZ: bz + s.dz + s.d / 2,
        });
        if (s.h > 18 && rng() < 0.3) signSpots.push({ x: bx + s.dx, y: Math.min(s.h - 3, 16), z: bz + s.dz, w: s.w, d: s.d });
      }
    }
  }

  // Neon signs on a few towers, facing the nearest road.
  let signIndex = 0;
  for (const s of signSpots.slice(0, SIGN_WORDS.length)) {
    const [word, color] = SIGN_WORDS[signIndex % SIGN_WORDS.length];
    signIndex += 1;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(16, s.w + 4), 4),
      new THREE.MeshBasicMaterial({ map: neonTexture(word, color), transparent: false }),
    );
    const faceWest = s.x < 0;
    sign.position.set(s.x + (faceWest ? -s.w / 2 - 0.15 : s.w / 2 + 0.15), s.y, s.z);
    sign.rotation.y = faceWest ? -Math.PI / 2 : Math.PI / 2;
    scene.add(sign);
  }
  // The big NEON BAY sign over Harbor Row.
  const big = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 8.5),
    new THREE.MeshBasicMaterial({ map: neonTexture('NEON BAY', '#ff5da2') }),
  );
  big.position.set(-178, 24, 0);
  big.rotation.y = -Math.PI / 2;
  scene.add(big);
}

function buildPalmsAndLamps(scene) {
  const rng = G.rng;
  const palmSpots = [];
  for (let z = -225; z <= 225; z += 17) palmSpots.push({ x: -209 + range(rng, -2, 2), z: z + range(rng, -3, 3) });
  for (let z = -220; z <= 220; z += 26) palmSpots.push({ x: -190.5, z });
  for (let i = 0; i < 26; i += 1) palmSpots.push({ x: range(rng, -170, 220), z: range(rng, -220, 220) });

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6);
  trunkGeo.translate(0, 2.7, 0);
  const crownGeo = new THREE.ConeGeometry(2.6, 1.5, 7);
  crownGeo.translate(0, 5.6, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }), palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x3e9a4f, roughness: 1 }), palmSpots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  palmSpots.forEach((s, i) => {
    e.set(range(rng, -0.06, 0.06), rng() * Math.PI * 2, range(rng, -0.06, 0.06));
    q.setFromEuler(e);
    const sc = range(rng, 0.85, 1.25);
    m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);

  // Streetlights along Harbor Row and the two main avenues.
  const lampSpots = [];
  for (let z = -225; z <= 225; z += 25) lampSpots.push({ x: -192.5, z });
  for (let z = -225; z <= 225; z += 25) lampSpots.push({ x: 7.5, z });
  for (let x = -190; x <= 225; x += 25) lampSpots.push({ x, z: 7.5 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
  poleGeo.translate(0, 2.8, 0);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  headGeo.translate(0, 5.7, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x333a44, roughness: 0.8 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampSpots.length);
  lampSpots.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, 0, s.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  });
  scene.add(poles, heads);
}

function buildLighthouse(scene) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.6, 26, 14),
    new THREE.MeshStandardMaterial({ map: lighthouseTexture(), roughness: 0.8 }),
  );
  tower.position.y = 13;
  tower.castShadow = true;
  group.add(tower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.6 }),
  );
  lampRoom.position.y = 27.5;
  group.add(lampRoom);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  bulb.position.y = 27.5;
  group.add(bulb);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0xd64550, roughness: 0.8 }));
  cap.position.y = 30.2;
  group.add(cap);

  const beamGroup = new THREE.Group();
  beamGroup.position.y = 27.5;
  const beamGeo = new THREE.ConeGeometry(7, 70, 12, 1, true);
  beamGeo.translate(0, -35, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beamGroup.add(beam);
  group.add(beamGroup);
  group.position.set(PLACES.lighthouse.x, 0, PLACES.lighthouse.z);
  scene.add(group);
  G.lighthouseBeam = beamGroup;
  G.colliders.push({
    minX: PLACES.lighthouse.x - 4.6,
    maxX: PLACES.lighthouse.x + 4.6,
    minZ: PLACES.lighthouse.z - 4.6,
    maxZ: PLACES.lighthouse.z + 4.6,
  });
}

export function buildCity() {
  const scene = G.scene;
  scene.fog = new THREE.Fog(COLORS.fog, 160, 720);
  buildSky(scene);
  buildLights(scene);
  buildGround(scene);
  buildBlocks(scene);
  buildPalmsAndLamps(scene);
  buildLighthouse(scene);
}
