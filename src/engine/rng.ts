// Seeded PRNG. mulberry32 — small, fast, good enough for games (not cryptographic).

export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** FNV-1a 32-bit hash: turns a mission code into a starting RNG state. */
export function seedFromString(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** Mutable cursor over the RNG state, used inside a single engine call. */
export class Rng {
  constructor(public state: number) {}

  next(): number {
    const [value, next] = nextRandom(this.state);
    this.state = next;
    return value;
  }

  /** Inclusive integer range. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a readable mission code such as "MARS-7KQ2PX". Uses Math.random: codes are not part of a simulation. */
export function generateSeed(prefix: string): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return `${prefix.toUpperCase()}-${code}`;
}

export function normalizeSeed(seed: string): string {
  return seed
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
}
