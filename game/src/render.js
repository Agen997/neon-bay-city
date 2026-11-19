// Neon Bay — drawing the city. Canvas 2D, top-down: ground, roads and
// crosswalks, buildings with roofs and helipads, the pier, the lighthouse
// beam, then every car, pedestrian, thug and bullet in the frame.
import { CFG, PALETTE } from './config.js';
import { isRoad } from './world.js';

export function updateCamera(G) {
  const p = G.player;
  const cam = G.camera;
  const tx = p.x - CFG.viewW / 2;
  const ty = p.y - CFG.viewH / 2;
  cam.x += (tx - cam.x) * Math.min(1, 6 * G.dt);
  cam.y += (ty - cam.y) * Math.min(1, 6 * G.dt);
  cam.x = Math.max(0, Math.min(CFG.worldW - CFG.viewW, cam.x));
  cam.y = Math.max(0, Math.min(CFG.worldH - CFG.viewH, cam.y));
}

function drawGround(G, ctx) {
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(CFG.worldW, cam.x + CFG.viewW + 40);
  const y1 = Math.min(CFG.worldH, cam.y + CFG.viewH + 40);
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Sand strip east of the city.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, CFG.beachX0), y0, Math.min(x1, CFG.waterX0) - Math.max(x0, CFG.beachX0), y1 - y0);
  // The bay.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, CFG.waterX0), y0, x1 - Math.max(x0, CFG.waterX0), y1 - y0);
  // Wet sand at the waterline.
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(Math.max(x0, CFG.waterX0 - 26), y0, 26, y1 - y0);
}

function drawBlocks(G, ctx) {
  const world = G.world;
  for (const b of world.blocks) {
    if (b.x + b.w < G.camera.x || b.x > G.camera.x + CFG.viewW) continue;
    if (b.y + b.h < G.camera.y || b.y > G.camera.y + CFG.viewH) continue;
    // Sidewalk rim, then the block's own ground.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.kind === 'park') ctx.fillStyle = PALETTE.parkGrass;
    else if (b.kind === 'plaza') ctx.fillStyle = PALETTE.plaza;
    else if (b.kind === 'market') ctx.fillStyle = '#6a5a3a';
    else ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
  }
}

function drawRoads(G, ctx) {
  const world = G.world;
  const half = CFG.roadW / 2;
  ctx.fillStyle = PALETTE.road;
  for (const c of world.centers) {
    ctx.fillRect(c - half, 0, CFG.roadW, CFG.citySize);
    ctx.fillRect(0, c - half, CFG.citySize, CFG.roadW);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const c of world.centers) {
    for (let d = 40; d < CFG.citySize; d += 80) {
      let onBlock = false;
      for (const o of world.centers) {
        if (Math.abs(d - o) < 44) { onBlock = true; break; }
      }
      if (onBlock) continue;
      ctx.fillRect(c - 2, d, 4, 34);
      ctx.fillRect(d, c - 2, 34, 4);
    }
  }
  // Crosswalks at every junction.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const cx of world.centers) {
    for (const cy of world.centers) {
      for (let s = -24; s <= 24; s += 12) {
        ctx.fillRect(cx + s - 3, cy - half - 2, 6, 12);
        ctx.fillRect(cx + s - 3, cy + half - 10, 6, 12);
        ctx.fillRect(cx - half - 2, cy + s - 3, 12, 6);
        ctx.fillRect(cx + half - 10, cy + s - 3, 12, 6);
      }
    }
  }
}

function drawBuildings(G, ctx) {
  for (const b of G.world.buildings) {
    if (b.x + b.w < G.camera.x || b.x > G.camera.x + CFG.viewW) continue;
    if (b.y + b.h < G.camera.y || b.y > G.camera.y + CFG.viewH) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = PALETTE.glass;
    for (let wx = b.x + 16; wx < b.x + b.w - 12; wx += 26) {
      for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += 26) {
        ctx.fillRect(wx, wy, 12, 10);
      }
    }
    // Tall roofs carry a helipad.
    if (b.tall) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e8e8e8';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', cx, cy);
    }
  }
}

function drawProps(G, ctx) {
  for (const pr of G.world.props) {
    if (pr.x < G.camera.x - 20 || pr.x > G.camera.x + CFG.viewW + 20) continue;
    if (pr.y < G.camera.y - 20 || pr.y > G.camera.y + CFG.viewH + 20) continue;
    if (pr.kind === 'bench') {
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(pr.x - 12, pr.y - 5, 24, 10);
    } else if (pr.kind === 'hydrant') {
      ctx.fillStyle = '#c92a2a';
      ctx.fillRect(pr.x - 4, pr.y - 6, 8, 12);
    } else if (pr.kind === 'lamp') {
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(pr.x - 2, pr.y - 10, 4, 20);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y - 11, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === 'tree') {
      ctx.fillStyle = '#2f6b35';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4c9153';
      ctx.beginPath();
      ctx.arc(pr.x - 3, pr.y - 3, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === 'stall') {
      ctx.fillStyle = '#e87a2a';
      ctx.fillRect(pr.x - 14, pr.y - 10, 28, 20);
      ctx.fillStyle = '#f5e6c8';
      ctx.fillRect(pr.x - 14, pr.y - 10, 28, 6);
    }
  }
}

function drawPierAndLighthouse(G, ctx) {
  const world = G.world;
  const pier = world.pier;
  // Pier deck and posts.
  ctx.fillStyle = PALETTE.pierWood;
  ctx.fillRect(pier.x0, pier.y0, pier.x1 - pier.x0, pier.y1 - pier.y0);
  ctx.fillStyle = PALETTE.pierPost;
  for (let x = pier.x0 + 40; x < pier.x1; x += 80) {
    ctx.fillRect(x - 4, pier.y0 - 6, 8, 8);
    ctx.fillRect(x - 4, pier.y1 - 2, 8, 8);
  }
  // Lighthouse rock, tower and sweeping beam.
  const lh = world.lighthouse;
  ctx.fillStyle = '#7a7a72';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lighthouse;
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lighthouseTop;
  ctx.beginPath();
  ctx.arc(lh.x, lh.y, 10, 0, Math.PI * 2);
  ctx.fill();
  const beamA = G.time * 0.7;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(lh.x, lh.y);
  ctx.arc(lh.x, lh.y, 520, beamA - 0.09, beamA + 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCar(G, ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.wrecked) ctx.globalAlpha = 0.75;
  const len = 44;
  const wid = 22;
  ctx.fillStyle = '#14141a';
  ctx.fillRect(-len / 2 - 2, -wid / 2 - 3, len + 4, wid + 6);
  ctx.fillStyle = car.color;
  ctx.fillRect(-len / 2, -wid / 2, len, wid);
  ctx.fillStyle = PALETTE.glass;
  ctx.fillRect(-6, -wid / 2 + 3, 12, wid - 6);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(len / 2 - 4, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 4, wid / 2 - 7, 3, 5);
  if (car.kind === 'cop') {
    const blink = Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -wid / 2 - 1, 8, 5);
    ctx.fillStyle = blink ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, wid / 2 - 4, 8, 5);
  }
  ctx.restore();
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(40,40,40,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - 8, car.y - 6, 10 + Math.sin(G.time * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPerson(G, ctx, x, y, angle, body, head, radius) {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  ctx.stroke();
}

export function drawGame(G) {
  const ctx = G.ctx;
  ctx.save();
  ctx.clearRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.translate(-Math.round(G.camera.x), -Math.round(G.camera.y));
  drawGround(G, ctx);
  drawBlocks(G, ctx);
  drawRoads(G, ctx);
  drawBuildings(G, ctx);
  drawProps(G, ctx);
  drawPierAndLighthouse(G, ctx);
  // Mission target ring.
  const t = G.missions.target;
  if (t && G.state === 'playing') {
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cash bag on the pier.
  if (G.missions.pierCash) {
    ctx.fillStyle = '#e8d44d';
    ctx.fillRect(G.missions.pierCash.x - 10, G.missions.pierCash.y - 8, 20, 16);
    ctx.fillStyle = '#2a7a3a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', G.missions.pierCash.x, G.missions.pierCash.y + 4);
  }
  // Health packs.
  for (const pack of G.combat.packs) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pack.x - 9, pack.y - 9, 18, 18);
    ctx.fillStyle = PALETTE.health;
    ctx.fillRect(pack.x - 2, pack.y - 7, 4, 14);
    ctx.fillRect(pack.x - 7, pack.y - 2, 14, 4);
  }
  // Cars.
  for (const car of G.cars) drawCar(G, ctx, car);
  // Pedestrians.
  for (const ped of G.traffic.peds) {
    if (ped.down) {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawPerson(G, ctx, ped.x, ped.y, ped.angle, ped.shirt, '#e8b98a', 9);
  }
  // Foot cops.
  for (const cop of G.police.cops) {
    drawPerson(G, ctx, cop.x, cop.y, Math.atan2(G.player.y - cop.y, G.player.x - cop.x), '#1f3a8a', '#e8b98a', 10);
    ctx.fillStyle = '#1f3a8a';
    ctx.fillRect(cop.x - 8, cop.y - 14, 16, 4);
  }
  // Thugs, King bigger and darker.
  for (const thug of G.combat.thugs) {
    if (thug.king) {
      drawPerson(G, ctx, thug.x, thug.y, Math.atan2(G.player.y - thug.y, G.player.x - thug.x), PALETTE.king, '#e8b98a', 17);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KING', thug.x, thug.y - 24);
    } else {
      drawPerson(G, ctx, thug.x, thug.y, Math.atan2(G.player.y - thug.y, G.player.x - thug.x), PALETTE.thug, '#d8a08a', 11);
    }
  }
  // Rex, on foot or driving.
  const p = G.player;
  if (!p.inCar) {
    if (p.hurtFlash > 0 && Math.floor(G.time * 12) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }
    drawPerson(G, ctx, p.x, p.y, p.angle, PALETTE.playerJacket, '#e8b98a', 13);
    // Pistol in hand.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Melee swing arc.
    if (G.combat.swingT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 44, G.combat.swingAngle - CFG.meleeArc, G.combat.swingAngle + CFG.meleeArc);
      ctx.stroke();
    }
  }
  // Bullets.
  ctx.fillStyle = PALETTE.bullet;
  for (const b of G.combat.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Muzzle flash at the screen edge of the barrel — drawn in screen space.
  void isRoad;
}
