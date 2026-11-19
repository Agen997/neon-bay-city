// The heads-up display: cash, clock, wanted stars, health/armor bars, weapon and ammo,
// the mission objective with distance, contextual prompts, toasts, the boss bar, and a
// live 2D minimap (roads, water, player arrow, mission marker, police dots).
import { PLACES, WEAPONS, WORLD } from './config.js';
import { G, playerPos } from './state.js';
import { nearestCar } from './player.js';
import { roadLines } from './city.js';

const el = {};
let minimapCtx = null;
const MAP_SIZE = 190;

export function initHud() {
  for (const id of [
    'hud-top', 'cash', 'clock', 'stars', 'health-fill', 'armor-fill', 'weapon',
    'minimap-wrap', 'objective', 'prompt', 'bossbar', 'boss-fill', 'toast', 'crosshair',
    'title-screen', 'bigmsg', 'bigmsg-title', 'bigmsg-text', 'bigmsg-sub',
    'btn-new', 'btn-continue',
  ]) {
    el[id] = document.getElementById(id);
  }
  minimapCtx = document.getElementById('minimap').getContext('2d');
}

export function showHud(visible) {
  for (const id of ['hud-top', 'minimap-wrap', 'objective']) {
    el[id].classList.toggle('hidden', !visible);
  }
  if (!visible) {
    el.prompt.classList.add('hidden');
    el.bossbar.classList.add('hidden');
    el.crosshair.classList.add('hidden');
  }
}

function formatClock(mins) {
  const m = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function worldToMap(x, z) {
  const s = MAP_SIZE / (WORLD.half * 2);
  return [(x + WORLD.half) * s, (z + WORLD.half) * s];
}

function drawMinimap() {
  const g = minimapCtx;
  if (!g) return;
  g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
  // land + water
  g.fillStyle = '#2e3a2e';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  const [waterX] = worldToMap(WORLD.waterX, 0);
  g.fillStyle = '#1b6f8f';
  g.fillRect(0, 0, waterX, MAP_SIZE);
  const [beachX] = worldToMap(WORLD.beachX, 0);
  g.fillStyle = '#c9a86a';
  g.fillRect(waterX, 0, beachX - waterX, MAP_SIZE);
  // roads
  g.strokeStyle = 'rgba(220,220,210,0.5)';
  g.lineWidth = 2;
  for (const r of roadLines()) {
    const [rx] = worldToMap(r, 0);
    g.beginPath();
    g.moveTo(rx, 0);
    g.lineTo(rx, MAP_SIZE);
    g.stroke();
    const [, rz] = worldToMap(0, r);
    g.beginPath();
    g.moveTo(0, rz);
    g.lineTo(MAP_SIZE, rz);
    g.stroke();
  }
  // lighthouse
  const [lx, lz] = worldToMap(PLACES.lighthouse.x, PLACES.lighthouse.z);
  g.fillStyle = '#ffffff';
  g.fillRect(lx - 2, lz - 2, 4, 4);
  // mission marker
  if (G.mission.markerPos) {
    const [mx, mz] = worldToMap(G.mission.markerPos.x, G.mission.markerPos.z);
    const pulse = 4 + Math.sin(G.time * 4) * 1.6;
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.arc(mx, mz, pulse, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.stroke();
  }
  // police
  for (const cop of G.police) {
    if (!cop.active) continue;
    const [cx, cz] = worldToMap(cop.mesh.position.x, cop.mesh.position.z);
    g.fillStyle = Math.sin(G.time * 10 + cop.sirenPhase) > 0 ? '#ff2d2d' : '#2d7bff';
    g.fillRect(cx - 2.5, cz - 2.5, 5, 5);
  }
  // boss
  if (G.boss && G.boss.ped.state !== 'dead') {
    const [bx, bz] = worldToMap(G.boss.ped.mesh.position.x, G.boss.ped.mesh.position.z);
    g.fillStyle = '#ff416c';
    g.beginPath();
    g.arc(bx, bz, 4, 0, Math.PI * 2);
    g.fill();
  }
  // player arrow
  const pp = playerPos();
  const [px, pz] = worldToMap(pp.x, pp.z);
  const yaw = G.player.inCar ? G.player.inCar.yaw : G.player.yaw;
  g.save();
  g.translate(px, pz);
  g.rotate(Math.atan2(Math.sin(yaw), -Math.cos(yaw)) + Math.PI);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4, 5);
  g.lineTo(-4, 5);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = 'bold 10px sans-serif';
  g.fillText('N', MAP_SIZE - 14, 13);
}

export function updateHud(dt) {
  const player = G.player;
  el.cash.textContent = `$${player.cash}`;
  el.clock.textContent = formatClock(G.clockMin);
  let starsHtml = '';
  for (let i = 0; i < 5; i += 1) {
    starsHtml += i < G.stars ? '★' : '<span class="off">★</span>';
  }
  if (el.stars.innerHTML !== starsHtml) el.stars.innerHTML = starsHtml;
  el['health-fill'].style.width = `${Math.max(0, player.hp)}%`;
  el['armor-fill'].style.width = `${Math.max(0, player.armor)}%`;
  const weapon = WEAPONS[player.weapon];
  el.weapon.innerHTML =
    player.weapon === 'fists'
      ? 'Fists'
      : `${weapon.name} <small>${player.ammo[player.weapon] || 0} rounds</small>`;

  // objective + distance
  const m = G.mission;
  let distText = '';
  if (m.markerPos) {
    const pp = playerPos();
    const d = Math.round(Math.hypot(pp.x - m.markerPos.x, pp.z - m.markerPos.z));
    distText = ` · ${d}m`;
  }
  el.objective.innerHTML = `${m.text}${distText}<div class="sub">${m.sub || ''}</div>`;

  // prompt: police warning wins, else the enter-car hint
  let promptText = G.prompt;
  if (!promptText && G.screen === 'play' && !player.inCar && nearestCar()) {
    promptText = 'F — Enter car';
  }
  if (promptText) {
    el.prompt.textContent = promptText;
    el.prompt.classList.remove('hidden');
  } else {
    el.prompt.classList.add('hidden');
  }

  // toast
  if (G.toastTimer > 0) {
    G.toastTimer -= dt;
    el.toast.textContent = G.toast;
    el.toast.classList.remove('hidden');
  } else {
    el.toast.classList.add('hidden');
  }

  // boss bar
  if (G.boss && G.boss.ped.state !== 'dead') {
    el.bossbar.classList.remove('hidden');
    el['boss-fill'].style.width = `${Math.max(0, (G.boss.ped.hp / G.boss.maxHp) * 100)}%`;
  } else {
    el.bossbar.classList.add('hidden');
  }

  el.crosshair.classList.toggle('hidden', !(player.weapon !== 'fists' && !player.inCar && G.screen === 'play'));
  drawMinimap();
}

export function showBigMsg(title, text, sub, color) {
  el['bigmsg-title'].textContent = title;
  el['bigmsg-title'].style.color = color;
  el['bigmsg-text'].textContent = text;
  el['bigmsg-sub'].textContent = sub;
  el.bigmsg.classList.remove('hidden');
}

export function hideBigMsg() {
  el.bigmsg.classList.add('hidden');
}

export function showTitle(visible) {
  el['title-screen'].classList.toggle('hidden', !visible);
}

export function hudElements() {
  return el;
}
