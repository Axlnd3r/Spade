function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sameOrder = (a: string[], b: string[]) => a.every((l, i) => l === b[i]);

/** A seeded shuffle of `lines` whose order always differs from the input. */
export function shuffledDifferent(lines: string[], seed: number): string[] {
  if (lines.every((l) => l === lines[0])) throw new Error("All lines are the same: no other order exists.");
  const rand = mulberry32(seed);
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (sameOrder(out, lines)) {
    // Same order by chance: swap the first line with the first one that differs from it.
    const j = out.findIndex((l) => l !== out[0]);
    [out[0], out[j]] = [out[j], out[0]];
  }
  return out;
}

/** The lines in reverse order; throws when that order is the same as the input. */
export function reversed(lines: string[]): string[] {
  const out = [...lines].reverse();
  if (sameOrder(out, lines)) throw new Error("Reversing does not change the order of these lines.");
  return out;
}
