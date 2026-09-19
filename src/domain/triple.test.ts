import { TRIPLE_MAX, TRIPLE_MIN, generateTripleValue, timesThree } from './triple';

describe('timesThree', () => {
  it('14 と 99 の 3 倍', () => {
    expect(timesThree(14)).toBe(42);
    expect(timesThree(99)).toBe(297);
  });

  it('生成値は 14〜99 で、答えは timesThree と一致する', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const value = generateTripleValue(seed);
      expect(value).toBeGreaterThanOrEqual(TRIPLE_MIN);
      expect(value).toBeLessThanOrEqual(TRIPLE_MAX);
      expect(Number.isInteger(value)).toBe(true);
      expect(timesThree(value)).toBe(value * 3);
    }
  });
});
