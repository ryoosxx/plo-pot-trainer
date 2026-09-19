/**
 * シード付き RNG。Math.random は使わない。
 * mulberry32: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
export interface Rng {
  /** [0, 2^32) の整数。 */
  nextUint32(): number;
  /** min 以上 max 以下の整数（両端を含む）。 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed | 0;

  function nextUint32(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  function int(min: number, max: number): number {
    const span = max - min + 1;
    if (span <= 0) {
      throw new Error(`invalid int range: ${min}..${max}`);
    }
    return min + (nextUint32() % span);
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('pick() from empty list');
    }
    const item = items[int(0, items.length - 1)];
    if (item === undefined) {
      throw new Error('pick() index out of range');
    }
    return item;
  }

  return { nextUint32, int, pick };
}
