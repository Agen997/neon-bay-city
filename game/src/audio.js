// Neon Bay — every sound is synthesized live with WebAudio. No audio files,
// no network: oscillators and filtered noise, built at the moment they play.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._sirenNodes = null;
    this._bassTimer = 0;
  }
  // Created on the first user gesture; safe to call before any sound plays.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (err) {
      this.ctx = null;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopSiren();
    return this.muted;
  }
  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }
  shoot() {
    this._noise(0.12, 0.5, 2400);
    this._tone(190, 0.09, 'square', 0.16, 60);
  }
  enemyShoot() {
    this._noise(0.1, 0.3, 1600);
    this._tone(140, 0.08, 'square', 0.1, 55);
  }
  melee() {
    this._noise(0.14, 0.35, 900);
  }
  hit() {
    this._tone(120, 0.1, 'sawtooth', 0.2, 70);
  }
  pickup() {
    this._tone(660, 0.09, 'sine', 0.25);
    setTimeout(() => this._tone(990, 0.12, 'sine', 0.25), 70);
  }
  coin() {
    this._tone(880, 0.08, 'triangle', 0.25);
    setTimeout(() => this._tone(1320, 0.14, 'triangle', 0.25), 60);
  }
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.28), i * 95));
  }
  fail() {
    this._tone(220, 0.25, 'sawtooth', 0.2, 110);
    setTimeout(() => this._tone(165, 0.35, 'sawtooth', 0.2, 82), 180);
  }
  carStart() {
    this._tone(90, 0.3, 'sawtooth', 0.18, 220);
  }
  crash() {
    this._noise(0.25, 0.5, 700);
    this._tone(70, 0.2, 'sine', 0.3, 40);
  }
  // A two-tone siren that loops while at least one cruiser is near.
  startSiren() {
    if (!this.ctx || this.muted || this._sirenNodes) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 750;
    lfo.type = 'sine';
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 220;
    gain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    lfo.start();
    this._sirenNodes = { osc, lfo, gain };
  }
  stopSiren() {
    if (!this._sirenNodes) return;
    try {
      this._sirenNodes.osc.stop();
      this._sirenNodes.lfo.stop();
    } catch (err) { /* already stopped */ }
    this._sirenNodes = null;
  }
  // The title screen's slow bass pulse; call once a second from the loop.
  bassPulse() {
    this._tone(55, 0.5, 'sine', 0.22, 48);
    setTimeout(() => this._tone(82, 0.3, 'sine', 0.12), 250);
  }
}
