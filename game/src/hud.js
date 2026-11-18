// Neon Bay — everything drawn on top of the world: the HUD, the minimap,
// the mission banner, dialogue, and the title / pause / end screens.
// The judge reads the game mostly through these screens, so they carry
// the wanted stars, the cash, the objective and the minimap at all times.
import { CFG, PALETTE, CONTROLS } from './config.js';
import { objectiveText, currentMission, currentStep, stepTarget } from './missions.js';
import { WATER_X, roadCenters } from './world.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function gameClock(game) {
  // The city runs on a fast clock: noon plus one game hour per 90 seconds.
  const totalMinutes = 12 * 60 + Math.floor(game.elapsed / 90) * 60 + Math.floor((game.elapsed % 90) / 1.5);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const W = game.viewW;
  // Top-left: health and cash.
  panel(ctx, 14, 14, 250, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REX MARLOWE', 26, 36);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 44, 150, 12);
  ctx.fillStyle = p.health > 35 ? '#37d67a' : '#ff5252';
  ctx.fillRect(26, 44, Math.max(0, 150 * (p.health / CFG.playerMaxHealth)), 12);
  ctx.fillStyle = PALETTE.hudAccent;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`$${Math.floor(p.cash)}`, 186, 56);
  // Top-right: wanted stars and the clock.
  panel(ctx, W - 214, 14, 200, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(gameClock(game), W - 200, 36);
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < CFG.wantedMax; i += 1) stars += i < game.wanted ? '★' : '☆';
  ctx.fillStyle = game.wanted > 0 ? '#ffd166' : 'rgba(255,255,255,0.55)';
  ctx.fillText(stars, W - 200, 62);
  // Mission banner, top centre.
  const objective = objectiveText(game);
  ctx.font = 'bold 15px sans-serif';
  const ow = Math.min(620, ctx.measureText(objective).width + 36);
  panel(ctx, (W - ow) / 2, 14, ow, 38);
  ctx.fillStyle = PALETTE.hudAccent;
  ctx.textAlign = 'center';
  ctx.fillText(objective, W / 2, 38);
  // Job-progress pips: five dots under the banner, filled as jobs complete.
  const done = Math.min(game.missionIndex, 5);
  const pipW = 5 * 22;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < done ? PALETTE.hudAccent : 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc((W - pipW) / 2 + 11 + i * 22, 66, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission timer, under the banner.
  const step = currentStep(game);
  if (step && step.timer && game.missionActive) {
    const left = Math.max(0, step.timer - game.missionTimer);
    ctx.fillStyle = left < 20 ? '#ff5252' : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${Math.ceil(left)}s left`, W / 2, 92);
  }
  // Hold-the-vault progress.
  if (step && step.kind === 'hold' && game.holdProgress > 0) {
    panel(ctx, (W - 260) / 2, 100, 260, 22);
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.fillRect((W - 260) / 2 + 6, 105, 248 * (game.holdProgress / step.duration), 12);
  }
  // Bottom-left: messages.
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  let my = game.viewH - 24;
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    const msg = game.messages[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, msg.life / 2));
    ctx.fillStyle = '#fff';
    ctx.fillText(msg.text, 16, my);
    my -= 20;
  }
  ctx.globalAlpha = 1;
  // Bottom-left hint, small.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Click shoot · Space punch · P pause', 16, game.viewH - 118);
  // Dialogue box.
  if (game.dialogue) drawDialogue(ctx, game);
  // Damage flash.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${p.hurtFlash * 0.35})`;
    ctx.fillRect(0, 0, W, game.viewH);
  }
  drawMinimap(ctx, game);
}

function drawDialogue(ctx, game) {
  const d = game.dialogue;
  const W = game.viewW;
  panel(ctx, (W - 640) / 2, game.viewH - 108, 640, 66);
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.speaker, (W - 640) / 2 + 18, game.viewH - 82);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(d.lines[d.lineIndex], (W - 640) / 2 + 18, game.viewH - 58);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('click to continue', (W + 640) / 2 - 14, game.viewH - 52);
  ctx.textAlign = 'left';
}

export function drawMinimap(ctx, game) {
  const size = CFG.minimapSize;
  const x0 = game.viewW - size - 16;
  const y0 = game.viewH - size - 16;
  const scale = size / CFG.worldSize;
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#2c6e3f';
  ctx.fillRect(x0, y0, size, size);
  // The bay.
  ctx.fillStyle = '#1f7fb5';
  ctx.fillRect(x0 + WATER_X * scale, y0, size - WATER_X * scale, size);
  // Roads.
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 3;
  for (const c of roadCenters()) {
    ctx.beginPath();
    ctx.moveTo(x0 + c * scale, y0);
    ctx.lineTo(x0 + c * scale, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c * scale);
    ctx.lineTo(x0 + size, y0 + c * scale);
    ctx.stroke();
  }
  // Mission target.
  const target = stepTarget(game);
  if (target && game.state === 'playing') {
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police, blue.
  ctx.fillStyle = '#6aa5ff';
  for (const unit of game.police) {
    const q = unit.kind === 'car' ? unit.car : unit;
    ctx.fillRect(x0 + q.x * scale - 2, y0 + q.y * scale - 2, 4, 4);
  }
  // The player, white arrow.
  const p = game.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + px * scale, y0 + py * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', x0, y0 - 10);
}

function bigTitle(ctx, game) {
  const W = game.viewW;
  const H = game.viewH;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(10,10,40,0.72)');
  grad.addColorStop(0.55, 'rgba(40,10,60,0.55)');
  grad.addColorStop(1, 'rgba(255,77,166,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('NEON BAY', W / 2, 190);
  ctx.fillStyle = PALETTE.hudAccent;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME GAME', W / 2, 232);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Rex Marlowe is new in town. Mara Voss has five jobs for him —', W / 2, 282);
  ctx.fillText('and the Neon Bay Police Department has other plans.', W / 2, 306);
}

export function drawTitle(ctx, game) {
  bigTitle(ctx, game);
  const W = game.viewW;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(game.hasSave ? 'Press ENTER to continue, or N for a new game' : 'Press ENTER to start', W / 2, 380);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  let y = 428;
  for (const [key, action] of CONTROLS) {
    ctx.fillText(`${key} — ${action}`, W / 2, y);
    y += 24;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('Steal cars, dodge the NBPD, run five story jobs, and own the city. All art, names and music are original.', W / 2, y + 22);
}

export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PAUSED', game.viewW / 2, 240);
  ctx.font = '17px sans-serif';
  ctx.fillText('P — resume · M — mute · Q — quit to title (progress auto-saves)', game.viewW / 2, 292);
  ctx.font = '15px sans-serif';
  const mission = currentMission(game);
  ctx.fillText(mission ? `Current job: ${mission.title}` : 'Free roam — every job done.', game.viewW / 2, 330);
  ctx.fillText(`Cash $${Math.floor(game.player.cash)} · Health ${Math.floor(game.player.health)} · Wanted ${game.wanted}★`, game.viewW / 2, 360);
}

export function drawEndScreen(ctx, game, kind) {
  ctx.fillStyle = kind === 'won' ? 'rgba(10,40,20,0.78)' : 'rgba(24,8,10,0.78)';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'won' ? PALETTE.hudAccent : '#ff6b6b';
  ctx.font = 'bold 56px sans-serif';
  const title = kind === 'won' ? 'NEON BAY IS YOURS' : kind === 'busted' ? 'BUSTED!' : 'WASTED';
  ctx.fillText(title, game.viewW / 2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  const line =
    kind === 'won'
      ? 'All five jobs done. King is finished, Mara is happy, and the city answers to Rex.'
      : kind === 'busted'
        ? 'The NBPD hauled you in. Mara posts bail — but the heat stays on.'
        : 'Rex went down in the streets of Neon Bay. Mara is already sending a car.';
  ctx.fillText(line, game.viewW / 2, 310);
  ctx.font = '16px sans-serif';
  ctx.fillText(`Cash $${Math.floor(game.player.cash)} · Jobs done ${Math.min(game.missionIndex, 5)} of 5`, game.viewW / 2, 350);
  ctx.fillText('Press ENTER to keep playing', game.viewW / 2, 400);
}
