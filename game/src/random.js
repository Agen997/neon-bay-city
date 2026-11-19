// Neon Bay — the seeded random source. The city, the traffic and the
// screenshot scenes all draw from this, so the same seed builds the same town.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  f() {
    return this.next();
  }
  // Float in [a, b).
  range(a, b) {
    return a + (b - a) * this.next();
  }
  // Integer in [a, b] inclusive.
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  // One element of an array.
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
  // Shuffle a copy of an array in place and return it.
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}
