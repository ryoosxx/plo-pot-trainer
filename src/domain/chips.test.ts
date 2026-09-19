import { breakdown, totalOf } from './chips';

/** docs/pot-limit-rules.md §7 を写経。数値は変更しない。 */
const CH_VECTORS = [
  {
    id: 'CH-01',
    denoms: [100, 500, 1000, 5000],
    amount: 3700,
    parts: [
      { denom: 1000, count: 3 },
      { denom: 500, count: 1 },
      { denom: 100, count: 2 },
    ],
    count: 6,
  },
  {
    id: 'CH-02',
    denoms: [100, 500, 1000, 5000],
    amount: 12300,
    parts: [
      { denom: 5000, count: 2 },
      { denom: 1000, count: 2 },
      { denom: 100, count: 3 },
    ],
    count: 7,
  },
  {
    id: 'CH-03',
    denoms: [1, 5, 25, 100],
    amount: 68,
    parts: [
      { denom: 25, count: 2 },
      { denom: 5, count: 3 },
      { denom: 1, count: 3 },
    ],
    count: 8,
  },
  {
    id: 'CH-04',
    denoms: [100, 500, 1000, 5000],
    amount: 0,
    parts: [],
    count: 0,
  },
] as const;

describe('chips CH-01〜CH-04', () => {
  it.each(CH_VECTORS)('$id', (row) => {
    const parts = breakdown(row.amount, [...row.denoms]);
    expect(parts).toEqual([...row.parts]);
    const totalCount = parts.reduce((sum, p) => sum + p.count, 0);
    expect(totalCount).toBe(row.count);
    expect(totalOf(parts)).toBe(row.amount);
  });
});
