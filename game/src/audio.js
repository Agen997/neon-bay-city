// Neon Bay 3D — all sound synthesized live with WebAudio: effects, sirens and
// three radio stations of sequenced synth music (R switches station, M mutes).
const STATIONS = [
  {
    name: 'NEON FM',
    bpm: 112, wave: 'sawtooth', bassWave: 'square',
    bass: [0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 7, null, 5, null],
    lead: [12, null, 15, 12, null, 19, null, 15, 12, null, 10, null, 12, null, 7, null],
  },
  {
    name: 'PALM 88',
    bpm: 92, wave: 'triangle', bassWave: 'sine',
    bass: [0, null, null, 0, null, null, 5, null, 3, null, null, 3, null, null, 7, null],
    lead: [12, 15, null, 19, null, 15, 12, null, 10, 12, null, 15, null, 12, null, null],
  },
  {
    name: 'TURBO ROCK',
    bpm: 140, wave: 'square', bassWave: 'sawtooth',
    bass: [0, 0, 3, 0, 0, 5, 0, 3, 0, 0, 3, 0, 7, 5, 3, 0],
    lead: [12, 12, 15, 12, 19, 15, 12, 10, 12, 12, 15, 19, 22, 19, 15, 12],
  },
];
const BASE = 110; // A2

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0;
    this.radioOn = false;
    this._step = 0;
    this._nextTime = 0;
    this._sirenT = 0;
    this._sirenHigh = false;
    this._noiseBuf = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.45;
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot() { this._noise(0.12, 0.5, 3200); this._tone(180, 0.08, 'square', 0.25, 0, 60); }
  smgShoot() { this._noise(0.07, 0.35, 3800); }
  shotgun() { this._noise(0.28, 0.7, 1800); this._tone(120, 0.15, 'square', 0.3, 0, 40); }
  melee() { this._noise(0.12, 0.3, 900); }
  hit() { this._tone(220, 0.08, 'square', 0.2, 0, 110); }
  pickup() { this._tone(660, 0.09, 'sine', 0.3); this._tone(990, 0.12, 'sine', 0.3, 0.08); }
  coin() { this._tone(880, 0.1, 'sine', 0.3); this._tone(1320, 0.18, 'sine', 0.3, 0.09); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.3, i * 0.11)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.25, 'sawtooth', 0.25, i * 0.16)); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.3, 'triangle', 0.3, i * 0.13)); }
  titlePulse() { this._tone(55, 0.5, 'sine', 0.4, 0, 110); }

  startRadio() { this.radioOn = true; this._step = 0; if (this.ctx) this._nextTime = this.ctx.currentTime + 0.05; }
  stopRadio() { this.radioOn = false; }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this._step = 0;
    if (this.ctx) this._nextTime = this.ctx.currentTime + 0.05;
    return STATIONS[this.station].name;
  }
  stationName() { return STATIONS[this.station].name; }

  _note(semi, wave, vol, dur) {
    const f = BASE * Math.pow(2, semi / 12);
    this._tone(f, dur, wave, vol);
  }

  update(dt, wanted) {
    if (!this.ctx) return;
    // Police siren: alternating two-tone blips while wanted.
    if (wanted >= 1 && !this.muted) {
      this._sirenT -= dt;
      if (this._sirenT <= 0) {
        this._sirenT = 0.55;
        this._sirenHigh = !this._sirenHigh;
        this._tone(this._sirenHigh ? 880 : 660, 0.5, 'sine', 0.05);
      }
    }
    // Radio sequencer: schedule 8th notes slightly ahead.
    if (!this.radioOn || this.muted) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 2;
    while (this._nextTime < this.ctx.currentTime + 0.18) {
      const i = this._step % 16;
      const when = this._nextTime - this.ctx.currentTime;
      const bass = st.bass[i];
      const lead = st.lead[i];
      if (bass !== null && bass !== undefined) {
        const f = BASE * Math.pow(2, bass / 12);
        this._tone(f, stepDur * 1.8, st.bassWave, 0.16, Math.max(0, when));
      }
      if (lead !== null && lead !== undefined) {
        const f = BASE * 2 * Math.pow(2, lead / 12);
        this._tone(f, stepDur * 0.9, st.wave, 0.07, Math.max(0, when));
      }
      if (i % 2 === 0) this._noise(0.03, 0.05, 8000, Math.max(0, when));
      this._step++;
      this._nextTime += stepDur;
    }
  }
}
