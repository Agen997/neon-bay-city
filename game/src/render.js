// Neon Bay — the renderer: a bright top-down look at the city.
// Roads, roofs, the bay, the pier, cars, crowds and police are all drawn
// from rectangles and circles, so the game needs no image files at all.
import { CFG, PALETTE } from './config.js';
import { WATER_X, PIER, roadCenters } from './world.js';
import { stepTarget } from './missions.js';

function inView(game, x, y, margin) {
  const cam = game.camera;
  const hw = game.viewW / 2 / cam.zoom + (margin || 80);
  const hh = game.viewH / 2 / cam.zoom + (margin || 80);
  return x > cam.x - hw && x < cam.x + hw && y > cam.y - hh && y < cam.y + hh;
}

export function drawWorld(ctx, game) {
  const world = game.world;
  const size = CFG.worldSize;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, size, size);
  // Mow stripes, for texture from above.
  ctx.fillStyle = PALETTE.grassDark;
  for (let y = 0; y < size; y += 256) {
    ctx.fillRect(0, y, size, 64);
  }
  // The bay and the beach.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(WATER_X, 0, size - WATER_X, size);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WATER_X + 26, 0, size - WATER_X - 26, size);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WATER_X - 34, 0, 34, size);
  // Wave lines on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  for (let y = 40; y < size; y += 130) {
    ctx.beginPath();
    for (let x = WATER_X + 50; x < size - 20; x += 46) {
      const yy = y + Math.sin((x + game.elapsed * 40) / 60) * 6;
      if (x === WATER_X + 50) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Parks and plazas.
  for (const park of world.parks) {
    ctx.fillStyle = park.kind === 'plaza' ? '#b8b0a0' : PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.kind === 'plaza') {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.strokeRect(park.x + 8, park.y + 8, park.w - 16, park.h - 16);
    }
  }
  // Sidewalks, then roads, then lane markings.
  const half = CFG.roadWidth / 2;
  ctx.fillStyle = PALETTE.sidewalk;
  for (const c of roadCenters()) {
    ctx.fillRect(c - half - 12, 0, CFG.roadWidth + 24, size);
    ctx.fillRect(0, c - half - 12, WATER_X + 40, CFG.roadWidth + 24);
  }
  ctx.fillStyle = PALETTE.road;
  for (const c of roadCenters()) {
    ctx.fillRect(c - half, 0, CFG.roadWidth, size);
    ctx.fillRect(0, c - half, WATER_X + 40, CFG.roadWidth);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const c of roadCenters()) {
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(WATER_X + 40, c);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks: zebra stripes across each road at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const cx of roadCenters()) {
    for (const cy of roadCenters()) {
      if (cx > WATER_X) continue;
      if (!inView(game, cx, cy, 120)) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(cx - 26 + i * 11, cy - 40, 6, 14);
        ctx.fillRect(cx - 26 + i * 11, cy + 26, 6, 14);
        ctx.fillRect(cx - 40, cy - 26 + i * 11, 14, 6);
        ctx.fillRect(cx + 26, cy - 26 + i * 11, 14, 6);
      }
    }
  }
  // The pier: wooden boards over the bay.
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let x = PIER.x + 24; x < PIER.x + PIER.w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, PIER.y);
    ctx.lineTo(x, PIER.y + PIER.h);
    ctx.stroke();
  }
  // Buildings: shadow, roof, and a lighter inner roof.
  for (const b of world.buildings) {
    if (!inView(game, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingEdge;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, Math.max(8, b.h * 0.22));
    // Roof details by height: a tall roof gets a helipad, a mid roof gets
    // two AC units, a low roof a single vent.
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 5);
    } else if (b.height === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 16, b.y + b.h / 2 - 8, 14, 16);
      ctx.fillRect(b.x + b.w / 2 + 4, b.y + b.h / 2 - 8, 14, 16);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 8, 20, 16);
    }
  }
  // Street props: benches, hydrants and lamps on the sidewalks.
  for (const prop of world.props || []) {
    if (!inView(game, prop.x, prop.y, 40)) continue;
    if (prop.kind === 'bench') {
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(prop.x - 9, prop.y - 4, 18, 8);
      ctx.fillStyle = '#5d4426';
      ctx.fillRect(prop.x - 9, prop.y - 7, 18, 3);
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#d23b2e';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(prop.x - 1, prop.y - 8, 2, 16);
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Trees.
  for (const t of world.trees) {
    if (!inView(game, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeLight;
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lighthouse at the point.
  const light = world.spots.lighthouse;
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(light.x, light.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e84a4a';
  ctx.beginPath();
  ctx.arc(light.x, light.y, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawCarBody(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  if (car.kind === 'police') {
    // Siren wash on the road under the cruiser, alternating red and blue.
    const phase = Math.floor(car.sirenPhase * 4) % 2 === 0;
    ctx.fillStyle = phase ? 'rgba(255,59,48,0.20)' : 'rgba(47,107,255,0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(car.angle);
  if (car.wrecked) ctx.globalAlpha = 0.75;
  // Wheels.
  ctx.fillStyle = '#14161a';
  ctx.fillRect(-16, -15, 10, 6);
  ctx.fillRect(-16, 9, 10, 6);
  ctx.fillRect(8, -15, 10, 6);
  ctx.fillRect(8, 9, 10, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -13, 44, 26, 7);
  ctx.fill();
  // Windshield and roof.
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  ctx.fillRect(4, -10, 8, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-12, -10, 10, 20);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-22, -13, 12, 26);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NBPD', -2, 3);
    // Flashing light bar.
    const phase = Math.floor(car.sirenPhase * 4) % 2 === 0;
    ctx.fillStyle = phase ? PALETTE.policeRed : PALETTE.policeBlue;
    ctx.fillRect(-4, -13, 8, 5);
    ctx.fillStyle = phase ? PALETTE.policeBlue : PALETTE.policeRed;
    ctx.fillRect(-4, 8, 8, 5);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, color, skin, isPlayer) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Body: jacket with a bright stripe so the player reads at a glance.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? PALETTE.neonCyan : 'rgba(255,255,255,0.5)';
  ctx.fillRect(6, -3, 7, 6);
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawEntities(ctx, game) {
  // Mission target marker: a pulsing ring and a beacon column.
  const target = stepTarget(game);
  if (target && game.state === 'playing') {
    const pulse = 1 + Math.sin(game.elapsed * 4) * 0.12;
    ctx.save();
    ctx.strokeStyle = PALETTE.hudAccent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,207,63,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', target.x, target.y - 40);
    ctx.restore();
  }
  // Cash drops and health packs.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y + Math.sin(game.elapsed * 3 + pk.x) * 3);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#e8f5e9';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e9e4f';
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
    } else {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcf3f';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
    }
    ctx.restore();
  }
  // Cars.
  for (const car of game.cars) {
    if (!inView(game, car.x, car.y, 60)) continue;
    drawCarBody(ctx, car);
  }
  // Pedestrians.
  for (const ped of game.peds) {
    if (ped.down || !inView(game, ped.x, ped.y, 40)) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.skin, false);
  }
  // Rival thugs: dark red jackets.
  for (const thug of game.thugs) {
    if (thug.health <= 0 || !inView(game, thug.x, thug.y, 40)) continue;
    drawPerson(ctx, thug.x, thug.y, thug.angle, '#8b1e2d', '#c98d5e', false);
    if (thug.boss) {
      ctx.fillStyle = '#ffcf3f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KING', thug.x, thug.y - 22);
    }
  }
  // Foot police: navy uniforms.
  for (const unit of game.police) {
    if (unit.kind !== 'foot' || unit.dead) continue;
    if (!inView(game, unit.x, unit.y, 40)) continue;
    drawPerson(ctx, unit.x, unit.y, unit.angle, '#1c2f6e', '#f2c89b', false);
    ctx.fillStyle = '#8fb8ff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NBPD', unit.x, unit.y - 20);
  }
  // The player, on foot or driving (the car already draws itself).
  const p = game.player;
  if (!p.car && p.health > 0) {
    drawPerson(ctx, p.x, p.y, p.angle, '#14213d', '#f2c89b', true);
    // Aim line, short and subtle.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
    ctx.lineTo(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34);
    ctx.stroke();
  }
  // Bullets.
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
