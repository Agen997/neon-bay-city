// Neon Bay 3D — HUD: health, cash, wanted stars, weapon, radio, objective,
// mission pips, boss bar, live minimap, and the title / pause / busted / won menus.
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(cb) {
    this.cb = cb;
    this.clockMin = 18 * 60 + 24; // golden hour, 18:24
    this._toastT = 0;
    $('btn-new').addEventListener('click', () => cb.onNew());
    $('btn-continue').addEventListener('click', () => cb.onContinue());
    $('btn-resume').addEventListener('click', () => cb.onResume());
    $('btn-quit').addEventListener('click', () => cb.onQuit());
  }

  toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.style.opacity = '1';
    this._toastT = 3.2;
  }

  showTitle(saveExists) {
    this.hideMenus();
    $('title').style.display = 'flex';
    $('btn-continue').style.display = saveExists ? 'inline-block' : 'none';
    $('title-note').textContent = saveExists
      ? 'Save found — continue where Rex left off.'
      : 'No save yet. New game starts at Mara’s garage.';
  }

  showPause() { this.hideMenus(); $('pause').style.display = 'flex'; }
  showBusted(lost) {
    this.hideMenus();
    $('busted').style.display = 'flex';
    $('busted-info').textContent = `The NBPD took you in. You lost $${lost} to impound and fines.`;
  }
  showWon(money) {
    this.hideMenus();
    $('won').style.display = 'flex';
    $('won-info').textContent = `King is down. Neon Bay is yours — $${money} in the pocket.`;
  }
  hideMenus() {
    for (const id of ['title', 'pause', 'busted', 'won']) $(id).style.display = 'none';
  }

  update(dt, G) {
    const p = G.player;
    this.clockMin += dt / 4;
    // Health.
    $('hp-fill').style.width = `${Math.max(0, p.hp)}%`;
    $('hp-fill').style.background = p.hp < 35 ? '#e23a3a' : '#3ae06a';
    $('hp-text').textContent = `${Math.ceil(p.hp)} HP`;
    // Low-health pulse.
    $('vignette').style.opacity = p.hp < 35 ? String(0.35 + Math.sin(G.time * 5) * 0.2) : '0';
    // Cash / wanted / weapon / radio.
    $('cash').textContent = `$${p.money}`;
    const stars = G.police.stars();
    $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    $('stars').style.color = stars >= 4 ? '#ff4040' : '#ffd24d';
    const w = G.combat.weapon();
    $('weapon').textContent = `${G.combat.wi + 1} · ${w.name} ${w.ammo === Infinity ? '∞' : '· ' + w.ammo}`;
    $('radio').textContent = G.audio.radioOn ? `♪ ${G.audio.stationName()}` : '♪ radio off (R)';
    // Objective, clock, pips.
    $('objective').textContent = G.missions.target.label;
    const hh = Math.floor(this.clockMin / 60) % 24;
    const mm = Math.floor(this.clockMin % 60);
    $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const pips = $('pips').children;
    for (let i = 0; i < 5; i++) {
      pips[i].className = 'pip' + (i < G.missions.index ? ' done' : i === G.missions.index ? ' current' : '');
    }
    // Car HP.
    if (p.inCar) {
      $('carhp').style.display = 'block';
      $('carhp-fill').style.width = `${Math.max(0, p.inCar.hp / CONFIG.playerCarHp * 100)}%`;
    } else {
      $('carhp').style.display = 'none';
    }
    // Boss bar.
    const boss = G.missions.boss;
    if (boss) {
      $('boss').style.display = 'block';
      $('boss-fill').style.width = `${Math.max(0, boss.hp / 320 * 100)}%`;
    } else {
      $('boss').style.display = 'none';
    }
    // Toast fade.
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) $('toast').style.opacity = '0';
    }
    this._drawMinimap(G);
  }

  _drawMinimap(G) {
    const cv = $('minimap');
    const g = cv.getContext('2d');
    const S = 180 / 3600;
    const oy = (180 - 3104 * S) / 2;
    const X = (x) => x * S;
    const Y = (y) => y * S + oy;
    g.clearRect(0, 0, 180, 180);
    g.fillStyle = '#171222';
    g.fillRect(0, 0, 180, 180);
    // Water + beach.
    g.fillStyle = '#1d4e6b';
    g.fillRect(X(3456), 0, 180 - X(3456), 180);
    g.fillStyle = '#e8c98a';
    g.fillRect(X(3120), Y(900), (3456 - 3120) * S, (2200 - 900) * S);
    // Roads.
    g.strokeStyle = '#4a4450';
    g.lineWidth = 88 * S;
    for (const c of CONFIG.roadCenters) {
      g.beginPath(); g.moveTo(X(c), 0); g.lineTo(X(c), 180); g.stroke();
      g.beginPath(); g.moveTo(0, Y(c)); g.lineTo(180, Y(c)); g.stroke();
    }
    // Cars (gray), thugs (orange), cops (red), cruisers (red squares).
    g.fillStyle = '#9a9aa2';
    for (const c of G.vehicles.cars) g.fillRect(X(c.x) - 1.5, Y(c.y) - 1.5, 3, 3);
    g.fillStyle = '#ff8a2a';
    for (const t of G.combat.thugs) {
      g.beginPath(); g.arc(X(t.x), Y(t.y), t.king ? 4 : 2.5, 0, 7); g.fill();
    }
    g.fillStyle = '#ff4040';
    for (const c of G.police.cops) { g.beginPath(); g.arc(X(c.x), Y(c.y), 2.5, 0, 7); g.fill(); }
    for (const c of G.police.cruisers) g.fillRect(X(c.x) - 2.5, Y(c.y) - 2.5, 5, 5);
    if (G.police.heli) {
      g.strokeStyle = '#ff4040';
      g.beginPath(); g.arc(X(G.police.heli.position.x), Y(G.police.heli.position.z), 5, 0, 7); g.stroke();
    }
    // Objective target (pulsing yellow).
    const t = G.missions.target;
    const r = 4 + Math.sin(G.time * 4) * 1.5;
    g.fillStyle = '#ffd24d';
    g.beginPath(); g.arc(X(t.x), Y(t.y), r, 0, 7); g.fill();
    g.strokeStyle = '#ffd24d';
    g.beginPath(); g.arc(X(t.x), Y(t.y), r + 4, 0, 7); g.stroke();
    // Player (white triangle, facing angle).
    const p = G.player;
    g.save();
    g.translate(X(p.x), Y(p.y));
    g.rotate(Math.atan2(Math.sin(p.angle), Math.cos(p.angle)) + Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
  }
}
