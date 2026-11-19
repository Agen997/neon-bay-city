// All sound is synthesized with WebAudio — no audio files. Gunshots are filtered noise
// bursts, pickups are little arpeggios, the engine is a sawtooth whose pitch follows the
// car, the siren is a two-tone sweep, and the radio is a tiny step sequencer with two
// stations (Bay FM funk, Sunset Synth pads). Everything starts on the first user gesture.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let radioTimer = null;
let radioStep = 0;
let radioStation = 0;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Engine: sawtooth through a lowpass, pitch set by updateEngine.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();

  // Siren: square wave swept by an LFO, gain set by updateSiren.
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 800;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.7;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(sirenOsc.frequency);
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start();
  lfo.start();
}

function blip(freq, dur, type = 'square', vol = 0.16, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, freq, q = 0.8) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  shoot(kind) {
    if (kind === 'shotgun') {
      noiseBurst(0.28, 0.5, 700, 0.5);
      blip(120, 0.18, 'square', 0.2, 40);
    } else if (kind === 'smg') {
      noiseBurst(0.09, 0.3, 1600, 0.7);
    } else {
      noiseBurst(0.14, 0.4, 1200, 0.7);
      blip(220, 0.08, 'square', 0.12, 60);
    }
  },
  melee() {
    noiseBurst(0.08, 0.25, 300, 1.2);
  },
  hit() {
    blip(180, 0.09, 'square', 0.14, 90);
  },
  hurt() {
    blip(140, 0.16, 'sawtooth', 0.18, 70);
  },
  pickup() {
    blip(660, 0.09, 'square', 0.14);
    blip(990, 0.12, 'square', 0.14, null, 0.07);
  },
  cash() {
    blip(880, 0.07, 'square', 0.13);
    blip(1175, 0.07, 'square', 0.13, null, 0.06);
    blip(1568, 0.14, 'square', 0.13, null, 0.12);
  },
  door() {
    blip(240, 0.08, 'square', 0.12, 140);
    noiseBurst(0.05, 0.12, 900, 1);
  },
  crash() {
    noiseBurst(0.3, 0.4, 240, 0.6);
    blip(90, 0.25, 'square', 0.2, 45);
  },
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, 'square', 0.15, null, i * 0.1));
  },
  busted() {
    [392, 330, 262, 196].forEach((f, i) => blip(f, 0.22, 'triangle', 0.2, null, i * 0.16));
  },
  wasted() {
    blip(220, 0.9, 'sawtooth', 0.18, 55);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => blip(f, 0.2, 'square', 0.15, null, i * 0.12));
  },
  click() {
    blip(800, 0.05, 'square', 0.1);
  },
};

export function updateEngine(speed01, active) {
  if (!ctx || !engineOsc) return;
  const target = active ? 0.06 + speed01 * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, ctx.currentTime, 0.08);
}

export function updateSiren(level01) {
  if (!ctx || !sirenGain) return;
  sirenGain.gain.setTargetAtTime(level01 * 0.045, ctx.currentTime, 0.2);
}

// --- Radio: a 16-step sequencer. Station 1 "Bay FM" (bass + hats), 2 "Sunset Synth" (arp). ---
const BASS_LINE = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];
const ARP_LINE = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 261.6, 196, 246.9, 293.7, 392, 293.7, 246.9, 196, 246.9];

function radioTick() {
  if (!ctx || radioStation === 0) return;
  const step = radioStep % 16;
  radioStep += 1;
  if (radioStation === 1) {
    const bass = BASS_LINE[step];
    if (bass) blip(bass, 0.16, 'triangle', 0.22);
    if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000, 2);
    if (step % 8 === 4) noiseBurst(0.09, 0.1, 1800, 1);
  } else {
    blip(ARP_LINE[step], 0.22, 'sine', 0.13);
    if (step % 4 === 0) blip(ARP_LINE[step] / 2, 0.5, 'triangle', 0.1);
  }
}

export function setRadio(station) {
  radioStation = station;
  if (radioTimer) {
    clearInterval(radioTimer);
    radioTimer = null;
  }
  if (station > 0 && ctx) {
    radioStep = 0;
    radioTimer = setInterval(radioTick, station === 1 ? 150 : 190);
  }
}

export function radioName(station) {
  return station === 1 ? 'Bay FM' : station === 2 ? 'Sunset Synth' : 'Radio off';
}
