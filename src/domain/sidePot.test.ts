import { buildPots } from './sidePot';
import type { SeatId } from './types';
import { createRng } from './generator/rng';

/** docs/pot-limit-rules.md §6 を写経。数値は変更禁止。A=UTG, B=MP, C=CO, D=BTN */
const SP_VECTORS = [
  {
    id: 'SP-01',
    entries: [
      { seat: 'UTG' as const, amount: 100, folded: false },
      { seat: 'MP' as const, amount: 60, folded: false },
      { seat: 'CO' as const, amount: 100, folded: false },
    ],
    pots: [
      { amount: 180, participants: ['UTG', 'MP', 'CO'] as SeatId[] },
      { amount: 80, participants: ['UTG', 'CO'] as SeatId[] },
    ],
    refunds: [] as { seat: SeatId; amount: number }[],
  },
  {
    id: 'SP-02',
    entries: [
      { seat: 'UTG' as const, amount: 100, folded: false },
      { seat: 'MP' as const, amount: 60, folded: false },
      { seat: 'CO' as const, amount: 100, folded: false },
      { seat: 'BTN' as const, amount: 40, folded: true },
    ],
    pots: [
      { amount: 220, participants: ['UTG', 'MP', 'CO'] as SeatId[] },
      { amount: 80, participants: ['UTG', 'CO'] as SeatId[] },
    ],
    refunds: [] as { seat: SeatId; amount: number }[],
  },
  {
    id: 'SP-03',
    entries: [
      { seat: 'UTG' as const, amount: 200, folded: false },
      { seat: 'MP' as const, amount: 120, folded: false },
    ],
    pots: [{ amount: 240, participants: ['UTG', 'MP'] as SeatId[] }],
    refunds: [{ seat: 'UTG' as const, amount: 80 }],
  },
  {
    id: 'SP-04',
    entries: [
      { seat: 'UTG' as const, amount: 50, folded: false },
      { seat: 'MP' as const, amount: 50, folded: false },
      { seat: 'CO' as const, amount: 50, folded: false },
    ],
    pots: [{ amount: 150, participants: ['UTG', 'MP', 'CO'] as SeatId[] }],
    refunds: [] as { seat: SeatId; amount: number }[],
  },
] as const;

function sorted(ids: readonly SeatId[]): SeatId[] {
  return [...ids].sort();
}

describe('sidePot SP-01〜SP-04', () => {
  it.each(SP_VECTORS)('$id', (row) => {
    const result = buildPots([...row.entries]);
    expect(result.pots.map((pot) => pot.amount)).toEqual(
      row.pots.map((pot) => pot.amount),
    );
    expect(result.pots.map((pot) => sorted(pot.participants))).toEqual(
      row.pots.map((pot) => sorted(pot.participants)),
    );
    expect(result.refunds).toEqual([...row.refunds]);
  });
});

describe('sidePot 不変条件: ポット総額 + 返却 = 全投入額', () => {
  it('1000 ケースで成立する', () => {
    const rng = createRng(20260908);
    const seats: SeatId[] = ['UTG', 'MP', 'CO', 'BTN', 'SB'];
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(2, 5);
      const entries = seats.slice(0, n).map((seat) => ({
        seat,
        amount: rng.int(1, 20) * 10,
        folded: rng.int(1, 10) <= 2,
      }));
      if (entries.every((e) => e.folded)) {
        const first = entries[0];
        if (first) first.folded = false;
      }
      const result = buildPots(entries);
      let invested = 0;
      for (const entry of entries) invested += entry.amount;
      let potSum = 0;
      for (const pot of result.pots) potSum += pot.amount;
      let refundSum = 0;
      for (const refund of result.refunds) refundSum += refund.amount;
      expect(potSum + refundSum).toBe(invested);
    }
  });
});
