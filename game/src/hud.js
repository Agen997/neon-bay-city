// Neon Bay — HUD, minimap and menus. Health, cash, wanted stars, the clock,
// the current objective, five job pips, the King boss bar, a low-health
// pulse, and a live minimap with the mission target and every police unit.
import { CFG, PALETTE, NAMES } from './config.js';
import { wantedStars } from './police.js';
import { objectiveText } from './missions.js';

export function flash(G, msg) {
  G.hudState.flashMsg = msg;
  G.hudState.flashT = 4.5;
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHUD(G) {
  const ctx = G.ctx;
  const p = G.player;
  const W = CFG.viewW;
  // Low-health pulse.
  if (p.hp < 30 && G.state === 'playing') {
    const a = 0.25 + 0.15 * Math.sin(G.time * 6);
    const grad = ctx.createRadialGradient(W / 2, CFG.viewH / 2, CFG.viewH * 0.35, W / 2, CFG.viewH / 2, CFG.viewH * 0.75);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, `rgba(200,0,0,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, CFG.viewH);
  }
  // Top-left: health and cash.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('HEALTH', 16, 22);
  bar(ctx, 16, 28, 200, 14, p.hp / CFG.playerHp, p.hp < 30 ? '#e03a3a' : '#39d353', 'rgba(0,0,0,0.55)');
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(`$${p.money}`, 16, 66);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(p.inCar ? 'DRIVING — E to exit' : 'ON FOOT — E to enter a car', 16, 86);
  // Top-right: wanted stars and the clock.
  const stars = wantedStars(G.police);
  ctx.textAlign = 'right';
  ctx.font = '26px sans-serif';
  let starText = '';
  for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
  ctx.fillStyle = stars > 0 ? '#ffd94a' : 'rgba(255,255,255,0.55)';
  ctx.fillText(starText, W - 16, 40);
  const mins = G.clockMinutes % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(Math.floor(mins % 60)).padStart(2, '0');
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${hh}:${mm}`, W - 16, 66);
  ctx.font = '13px sans-serif';
  ctx.fillText(G.audio.muted ? 'MUTED (M)' : 'M — mute', W - 16, 86);
  // Top-centre: objective, timer, mission pips.
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(objectiveText(G), W / 2, 24);
  if (G.missions.timer !== null && G.state === 'playing') {
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = G.missions.timer < 15 ? '#ff5a5a' : '#ffd94a';
    ctx.fillText(`${Math.ceil(G.missions.timer)}s`, W / 2, 52);
  }
  // Five job pips.
  const pipY = G.missions.timer !== null ? 72 : 46;
  for (let i = 0; i < 5; i++) {
    const x = W / 2 - 44 + i * 22;
    ctx.beginPath();
    ctx.arc(x, pipY, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < G.missions.index ? '#39d353' : i === G.missions.index ? '#ffd94a' : 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }
  // Boss health bar while King lives.
  if (G.missions.boss && G.missions.boss.hp > 0) {
    const bw = 420;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ff5a5a';
    ctx.fillText('KING — TIDE KING', W / 2, pipY + 30);
    bar(ctx, W / 2 - bw / 2, pipY + 36, bw, 14, G.missions.boss.hp / CFG.kingHp, '#c92a2a', 'rgba(0,0,0,0.6)');
  }
  // Flash message.
  if (G.hudState.flashT > 0) {
    ctx.globalAlpha = Math.min(1, G.hudState.flashT);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, G.hudState.flashMsg, 760);
    let y = 110;
    for (const line of lines) {
      ctx.fillText(line, W / 2, y);
      y += 22;
    }
    ctx.globalAlpha = 1;
  }
  drawMinimap(G);
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const mw = 220;
  const mh = 156;
  const x0 = CFG.viewW - mw - 14;
  const y0 = CFG.viewH - mh - 14;
  const sx = mw / CFG.worldW;
  const sy = mh / CFG.worldH;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0 + CFG.beachX0 * sx, y0, (CFG.waterX0 - CFG.beachX0) * sx, mh);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, CFG.citySize * sx, mh);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  for (const c of G.world.centers) {
    ctx.beginPath();
    ctx.moveTo(x0 + c * sx, y0);
    ctx.lineTo(x0 + c * sx, y0 + CFG.citySize * sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c * sy);
    ctx.lineTo(x0 + CFG.citySize * sx, y0 + c * sy);
    ctx.stroke();
  }
  // Buildings as dots.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const b of G.world.buildings) {
    ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Mission target.
  const t = G.missions.target;
  if (t && G.state === 'playing') {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police units.
  ctx.fillStyle = '#2a6aff';
  for (const c of G.police.cruisers) {
    ctx.beginPath();
    ctx.arc(x0 + c.car.x * sx, y0 + c.car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of G.police.cops) {
    ctx.beginPath();
    ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Thugs.
  ctx.fillStyle = '#ff5a5a';
  for (const thug of G.combat.thugs) {
    ctx.beginPath();
    ctx.arc(x0 + thug.x * sx, y0 + thug.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rex.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(x0 + G.camera.x * sx, y0 + G.camera.y * sy, CFG.viewW * sx, CFG.viewH * sy);
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(8,10,24,${alpha})`;
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
}

function titleText(ctx, lines, y, gap) {
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.fillText(line.text, CFG.viewW / 2, y);
    y += gap;
  }
  return y;
}

export function drawTitle(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('NEON BAY', CFG.viewW / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('An open-world crime game — built by an AI agent for make.fun', CFG.viewW / 2, 232);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  let y = 300;
  y = titleText(ctx, [
    { text: `${NAMES.player} is new in town. ${NAMES.fixer} has five jobs for him.` },
    { text: 'The NBPD has other plans.' },
  ], y, 24);
  y += 26;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff';
  const hasSave = !!G.saveData;
  ctx.fillText(hasSave ? 'ENTER — Continue your game' : 'ENTER or CLICK — Start a new game', CFG.viewW / 2, y);
  y += 34;
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  y = titleText(ctx, [
    { text: 'WASD move / drive · Mouse aim · Click shoot · Space melee' },
    { text: 'E enter or steal a car · Shift run · P pause · M mute' },
  ], y, 22);
  y += 20;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('Every name, character, street and sound is original.', CFG.viewW / 2, y);
}

export function drawPause(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('PAUSED', CFG.viewW / 2, 260);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('P or ENTER — resume', CFG.viewW / 2, 310);
  ctx.fillText('Progress auto-saves — your game is saved.', CFG.viewW / 2, 340);
  ctx.fillText('M — mute sound', CFG.viewW / 2, 370);
}

export function drawBusted(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('BUSTED', CFG.viewW / 2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(G.bustedReason === 'down' ? 'Rex went down — the crew dragged him back to Mara\'s.' : 'The NBPD took Rex in — the crew dragged him back to Mara\'s.', CFG.viewW / 2, 310);
  ctx.fillText(`Lost $${G.bustedLost || 0} in the shuffle. The job starts over from this step.`, CFG.viewW / 2, 342);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — back to the streets', CFG.viewW / 2, 400);
}

export function drawWon(G) {
  const ctx = G.ctx;
  overlay(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('NEON BAY IS YOURS', CFG.viewW / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText(`King is down. Rex walks away with $${G.player.money}.`, CFG.viewW / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('Five jobs. One town. Thanks for playing.', CFG.viewW / 2, 336);
  ctx.fillText('ENTER — back to the title', CFG.viewW / 2, 390);
}
