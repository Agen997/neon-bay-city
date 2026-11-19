// Procedural canvas textures: building facades with lit windows, neon signs, asphalt with
// lane markings, pickup icons and the lighthouse stripes. No image files anywhere.
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, repeat = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

/** A building facade: pastel wall, window grid, some windows lit warm. Returns {map, emissiveMap}. */
export function facadeTextures(rng, baseColor) {
  const [c, g] = makeCanvas(128, 256);
  const [ec, eg] = makeCanvas(128, 256);
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, 128, 256);
  // subtle vertical shading so walls are not flat
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const wx = 8 + x * 20;
      const wy = 10 + y * 20;
      const lit = rng() < 0.42;
      g.fillStyle = lit ? '#ffd98a' : '#2e3444';
      g.fillRect(wx, wy, 12, 12);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(wx, wy, 12, 3);
      if (lit) {
        eg.fillStyle = rng() < 0.5 ? '#ffca7a' : '#ffe9b0';
        eg.fillRect(wx, wy, 12, 12);
      }
    }
  }
  return { map: toTexture(c, true), emissiveMap: toTexture(ec, true) };
}

/** A glowing neon sign with the given word. */
export function neonTexture(text, color) {
  const [c, g] = makeCanvas(512, 128);
  g.fillStyle = '#12081c';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.strokeRect(10, 10, 492, 108);
  g.font = 'italic 900 62px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  return toTexture(c);
}

/** Asphalt strip with a dashed centre line; repeats along its length. */
export function asphaltTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#4a505c';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i += 1) {
    g.fillStyle = `rgba(${20 + Math.random() * 40},${22 + Math.random() * 40},${28 + Math.random() * 40},0.5)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#e8e4d8';
  g.fillRect(60, 6, 8, 44);
  const tex = toTexture(c, true);
  tex.repeat.set(1, 10);
  return tex;
}

/** Wavy water pattern; the offset scrolls each frame. */
export function waterTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#1b6f8f';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,190,140,0.35)';
  g.lineWidth = 2;
  for (let y = 8; y < 256; y += 18) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      const yy = y + Math.sin((x + y) * 0.06) * 3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const tex = toTexture(c, true);
  tex.repeat.set(6, 24);
  return tex;
}

/** Red/white lighthouse stripes. */
export function lighthouseTexture() {
  const [c, g] = makeCanvas(128, 256);
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle = i % 2 === 0 ? '#f4f1ea' : '#d64550';
    g.fillRect(0, i * 43, 128, 43);
  }
  return toTexture(c, true);
}

/** Pickup icon faces: cash, health, armor, and the three guns. */
export function pickupTexture(kind) {
  const [c, g] = makeCanvas(96, 96);
  const bg = { cash: '#1d7a3a', health: '#f4f1ea', armor: '#2456a6', pistol: '#22242c', smg: '#22242c', shotgun: '#22242c' }[kind] || '#333';
  g.fillStyle = bg;
  g.fillRect(0, 0, 96, 96);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 88, 88);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'cash') {
    g.font = '900 62px sans-serif';
    g.fillText('$', 48, 52);
  } else if (kind === 'health') {
    g.fillStyle = '#d64550';
    g.fillRect(38, 18, 20, 60);
    g.fillRect(18, 38, 60, 20);
  } else if (kind === 'armor') {
    g.beginPath();
    g.moveTo(48, 14);
    g.lineTo(76, 26);
    g.lineTo(76, 52);
    g.quadraticCurveTo(76, 74, 48, 84);
    g.quadraticCurveTo(20, 74, 20, 52);
    g.lineTo(20, 26);
    g.closePath();
    g.fill();
  } else {
    // simple gun silhouette
    g.fillRect(16, 34, 52, 12);
    g.fillRect(58, 30, 20, 8);
    g.fillRect(24, 46, 12, 24);
    g.fillRect(66, 38, 8, 10);
    g.font = '700 17px sans-serif';
    g.fillText(kind.toUpperCase(), 48, 84);
  }
  return toTexture(c);
}

/** NBPD door lettering for police cars. */
export function policeTexture() {
  const [c, g] = makeCanvas(256, 96);
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#16213a';
  g.font = '900 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('NBPD', 128, 50);
  return toTexture(c);
}
