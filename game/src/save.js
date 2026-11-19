// Save / Continue via localStorage: cash, health, armor, weapons, mission progress,
// position and the win flag. Saved on every job completion and periodically in play.
import { SAVE_KEY } from './config.js';
import { G } from './state.js';

export function saveGame() {
  try {
    const p = G.player;
    const pos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
    const data = {
      v: 1,
      cash: p.cash,
      hp: Math.max(1, Math.round(p.hp)),
      armor: Math.round(p.armor),
      weapon: p.weapon,
      ammo: { ...p.ammo },
      next: G.mission.next ?? 0,
      won: G.won,
      x: Math.round(pos.x),
      z: Math.round(pos.z),
      clockMin: Math.round(G.clockMin),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function applySave(data) {
  const p = G.player;
  p.cash = data.cash ?? 50;
  p.hp = data.hp ?? 100;
  p.armor = data.armor ?? 0;
  p.weapon = data.weapon ?? 'fists';
  p.ammo = { pistol: 0, smg: 0, shotgun: 0, ...(data.ammo || {}) };
  G.mission.next = data.next ?? 0;
  G.mission.index = -1;
  G.won = !!data.won;
  G.clockMin = data.clockMin ?? 18 * 60 + 42;
  if (typeof data.x === 'number' && typeof data.z === 'number') {
    p.mesh.position.set(data.x, 0, data.z);
  }
  G.camPos = null;
}
