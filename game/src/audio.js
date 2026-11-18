// Neon Bay — all sound is synthesized with WebAudio, no audio files.
// Short oscillator blips for shots, pickups and menus, a two-tone siren
// for police, and a soft bass pulse for the title music. Silent until the
// player interacts, and fully muted with M.
export function createSoundBank() {
  const bank = {
    ctx: null,
    muted: false,
    sirenTimer: 0,
    musicTimer: 0,
    engineTimer: 0,
    ensure() {
      if (bank.ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        bank.ctx = new AudioContext();
      } catch {
        bank.ctx = null;
      }
    },
    tone(freq, duration, type, volume, slideTo) {
      if (bank.muted || !bank.ctx) return;
      try {
        const t0 = bank.ctx.currentTime;
        const osc = bank.ctx.createOscillator();
        const gain = bank.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
        gain.gain.setValueAtTime(volume || 0.08, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain);
        gain.connect(bank.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
      } catch {
        // Sound is garnish: a failure here must never break the game.
      }
    },
    shoot() {
      bank.tone(880, 0.09, 'square', 0.06, 120);
    },
    punch() {
      bank.tone(160, 0.1, 'sine', 0.12, 60);
    },
    hit() {
      bank.tone(220, 0.12, 'sawtooth', 0.08, 90);
    },
    pickup() {
      bank.tone(660, 0.09, 'sine', 0.09);
      setTimeout(() => bank.tone(990, 0.12, 'sine', 0.09), 70);
    },
    cash() {
      bank.tone(1180, 0.08, 'triangle', 0.1);
      setTimeout(() => bank.tone(1560, 0.14, 'triangle', 0.1), 80);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => bank.tone(f, 0.16, 'triangle', 0.1), i * 110));
    },
    busted() {
      [330, 262, 196].forEach((f, i) => setTimeout(() => bank.tone(f, 0.22, 'sawtooth', 0.08), i * 160));
    },
    engine(running) {
      if (!running || bank.muted || !bank.ctx) return;
      // One blip per interval, not one per frame: at 60 fps the unthrottled
      // version spawns sixty oscillators a second while driving.
      const now = bank.ctx.currentTime;
      if (now - bank.engineTimer < 0.09) return;
      bank.engineTimer = now;
      bank.tone(70, 0.08, 'sawtooth', 0.02, 110);
    },
    // Called every frame while police are near: a distant two-tone wail.
    updateSiren(dt, policeNear) {
      if (!bank.ctx || bank.muted) return;
      bank.sirenTimer -= dt;
      if (policeNear && bank.sirenTimer <= 0) {
        bank.sirenTimer = 0.9;
        bank.tone(700, 0.42, 'sine', 0.035, 950);
        setTimeout(() => bank.tone(950, 0.42, 'sine', 0.03, 700), 430);
      }
    },
    // Soft bass pulse on the title screen.
    updateTitleMusic(dt, onTitle) {
      if (!bank.ctx || bank.muted) return;
      bank.musicTimer -= dt;
      if (onTitle && bank.musicTimer <= 0) {
        bank.musicTimer = 0.55;
        bank.tone(98, 0.4, 'triangle', 0.04, 98);
      }
    },
  };
  return bank;
}
