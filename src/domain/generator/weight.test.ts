import type { Level } from '../types';
import { createRng } from './rng';
import { pickWeightedLevel, weightOf } from './weight';

describe('weightOf', () => {
  it('未出題は 10', () => {
    expect(weightOf(0, 0, null)).toBe(10);
  });

  it('正答率が低いほど重い', () => {
    expect(weightOf(10, 0, 3000)).toBeGreaterThan(weightOf(10, 10, 3000));
  });

  it('平均時間が 8 秒を超えると重い', () => {
    expect(weightOf(10, 10, 16000)).toBeGreaterThan(weightOf(10, 10, 3000));
  });
});

describe('pickWeightedLevel', () => {
  it('苦手レベル（低正答・高時間）が最多になる', () => {
    const levels: Level[] = [1, 2, 3];
    const stats = [
      { level: 1 as const, total: 20, correct: 19, averageMs: 3000 },
      { level: 2 as const, total: 20, correct: 2, averageMs: 18000 },
      { level: 3 as const, total: 20, correct: 18, averageMs: 4000 },
    ];
    const rng = createRng(20260908);
    const counts = new Map<Level, number>();
    for (const level of levels) counts.set(level, 0);
    for (let i = 0; i < 1000; i++) {
      const picked = pickWeightedLevel(levels, stats, rng);
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    expect(counts.get(2) ?? 0).toBeGreaterThan(counts.get(1) ?? 0);
    expect(counts.get(2) ?? 0).toBeGreaterThan(counts.get(3) ?? 0);
  });
});
