import {
  analyze,
  currentBet,
  diagnose,
  maxRaiseTo,
  minRaiseTo,
  toCall,
  totalPot,
} from './potLimit';
import type { Chips, Scenario, Seat, SeatId, Stake, Street } from './types';

const STAKE_1_2: Stake = { sb: 1, bb: 2, ante: 0, anteType: 'none', unit: 1 };

const LARGE_STACK = 1_000_000;

function seat(id: SeatId, stack: Chips, isHero: boolean): Seat {
  return {
    id,
    label: id,
    stack,
    folded: false,
    isHero,
    isButton: id === 'BTN',
  };
}

function scenario(opts: {
  street?: Street;
  potBefore?: Chips;
  contributions: Partial<Record<SeatId, Chips>>;
  heroSeat: SeatId;
  heroStack?: Chips;
  stake?: Stake;
  lastRaiseSize?: Chips;
}): Scenario {
  const heroSeat = opts.heroSeat;
  const heroStack = opts.heroStack ?? LARGE_STACK;
  const stake = opts.stake ?? STAKE_1_2;
  const street = opts.street ?? 'preflop';
  return {
    street,
    seats: [seat(heroSeat, heroStack, true)],
    potBefore: opts.potBefore ?? 0,
    contributions: opts.contributions,
    heroSeat,
    lastRaiseSize:
      opts.lastRaiseSize ?? (street === 'preflop' ? stake.bb : 0),
    actionLog: [],
    stake,
  };
}

/** docs/pot-limit-rules.md §3 を写経。数値は変更しない。 */
const PF_VECTORS = [
  {
    id: 'PF-01',
    potBefore: 0,
    contributions: { SB: 1, BB: 2 },
    heroSeat: 'UTG' as const,
    C: 2,
    h: 0,
    P: 3,
    toCall: 2,
    maxRaiseTo: 7,
    maxAddChips: 7,
  },
  {
    id: 'PF-02',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 2, MP: 2 },
    heroSeat: 'BTN' as const,
    C: 2,
    h: 0,
    P: 7,
    toCall: 2,
    maxRaiseTo: 11,
    maxAddChips: 11,
  },
  {
    id: 'PF-03',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 2, UTG1: 2, MP: 2, LJ: 2 },
    heroSeat: 'SB' as const,
    C: 2,
    h: 1,
    P: 11,
    toCall: 1,
    maxRaiseTo: 14,
    maxAddChips: 13,
  },
  {
    id: 'PF-04',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, STR: 4 },
    heroSeat: 'UTG1' as const,
    C: 4,
    h: 0,
    P: 7,
    toCall: 4,
    maxRaiseTo: 15,
    maxAddChips: 15,
  },
  {
    id: 'PF-05',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, STR: 4, UTG1: 4, MP: 4 },
    heroSeat: 'BTN' as const,
    C: 4,
    h: 0,
    P: 15,
    toCall: 4,
    maxRaiseTo: 23,
    maxAddChips: 23,
  },
  {
    id: 'PF-06',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, STR: 4, UTG: 8 },
    heroSeat: 'UTG1' as const,
    C: 8,
    h: 0,
    P: 15,
    toCall: 8,
    maxRaiseTo: 31,
    maxAddChips: 31,
  },
  {
    id: 'PF-07',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 7 },
    heroSeat: 'BB' as const,
    C: 7,
    h: 2,
    P: 10,
    toCall: 5,
    maxRaiseTo: 22,
    maxAddChips: 20,
  },
  {
    id: 'PF-08',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 7, MP: 7 },
    heroSeat: 'BB' as const,
    C: 7,
    h: 2,
    P: 17,
    toCall: 5,
    maxRaiseTo: 29,
    maxAddChips: 27,
  },
  {
    id: 'PF-09',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 7 },
    heroSeat: 'SB' as const,
    C: 7,
    h: 1,
    P: 10,
    toCall: 6,
    maxRaiseTo: 23,
    maxAddChips: 22,
  },
  {
    id: 'PF-10',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 7, BTN: 24 },
    heroSeat: 'UTG' as const,
    C: 24,
    h: 7,
    P: 34,
    toCall: 17,
    maxRaiseTo: 75,
    maxAddChips: 68,
  },
  {
    id: 'PF-11',
    potBefore: 2,
    contributions: { SB: 1, BB: 2 },
    heroSeat: 'UTG' as const,
    C: 2,
    h: 0,
    P: 5,
    toCall: 2,
    maxRaiseTo: 9,
    maxAddChips: 9,
  },
  {
    id: 'PF-12',
    potBefore: 9,
    contributions: { SB: 1, BB: 2 },
    heroSeat: 'UTG' as const,
    C: 2,
    h: 0,
    P: 12,
    toCall: 2,
    maxRaiseTo: 16,
    maxAddChips: 16,
  },
  {
    id: 'PF-13',
    potBefore: 0,
    contributions: { SB: 1, BB: 2, STR: 4, MP: 14 },
    heroSeat: 'STR' as const,
    C: 14,
    h: 4,
    P: 21,
    toCall: 10,
    maxRaiseTo: 45,
    maxAddChips: 41,
  },
] as const;

/** docs/pot-limit-rules.md §4 を写経。数値は変更しない。 */
const FL_VECTORS = [
  {
    id: 'FL-01',
    street: 'flop' as const,
    potBefore: 23,
    contributions: {},
    heroSeat: 'BTN' as const,
    C: 0,
    h: 0,
    P: 23,
    maxRaiseTo: 23,
    maxAddChips: 23,
    isAllIn: false,
  },
  {
    id: 'FL-02',
    street: 'flop' as const,
    potBefore: 20,
    contributions: { UTG: 15 },
    heroSeat: 'BTN' as const,
    C: 15,
    h: 0,
    P: 35,
    maxRaiseTo: 65,
    maxAddChips: 65,
    isAllIn: false,
  },
  {
    id: 'FL-03',
    street: 'flop' as const,
    potBefore: 20,
    contributions: { UTG: 15, MP: 15 },
    heroSeat: 'BTN' as const,
    C: 15,
    h: 0,
    P: 50,
    maxRaiseTo: 80,
    maxAddChips: 80,
    isAllIn: false,
  },
  {
    id: 'FL-04',
    street: 'flop' as const,
    potBefore: 20,
    contributions: { BTN: 15, CO: 65 },
    heroSeat: 'BTN' as const,
    C: 65,
    h: 15,
    P: 100,
    maxRaiseTo: 215,
    maxAddChips: 200,
    isAllIn: false,
  },
  {
    id: 'FL-05',
    street: 'flop' as const,
    potBefore: 100,
    contributions: { UTG: 40, MP: 180 },
    heroSeat: 'BTN' as const,
    C: 180,
    h: 0,
    P: 320,
    maxRaiseTo: 680,
    maxAddChips: 680,
    isAllIn: false,
  },
  {
    id: 'FL-06',
    street: 'flop' as const,
    potBefore: 50,
    contributions: { UTG: 30 },
    heroSeat: 'BTN' as const,
    heroStack: 100,
    C: 30,
    h: 0,
    P: 80,
    maxRaiseTo: 100,
    maxAddChips: 100,
    isAllIn: true,
  },
] as const;

/** docs/pot-limit-rules.md §5 を写経。数値は変更しない。 */
const MIN_VECTORS = [
  {
    id: 'MIN-01',
    street: 'preflop' as const,
    potBefore: 0,
    contributions: { SB: 1, BB: 2 },
    heroSeat: 'UTG' as const,
    minRaiseTo: 4,
  },
  {
    id: 'MIN-02',
    street: 'preflop' as const,
    potBefore: 0,
    contributions: { SB: 1, BB: 2, UTG: 7 },
    heroSeat: 'BB' as const,
    lastRaiseSize: 5,
    minRaiseTo: 12,
  },
  {
    id: 'MIN-03',
    street: 'flop' as const,
    potBefore: 20,
    contributions: { UTG: 15 },
    heroSeat: 'BTN' as const,
    lastRaiseSize: 15,
    minRaiseTo: 30,
  },
  {
    id: 'MIN-04',
    street: 'flop' as const,
    potBefore: 20,
    contributions: { BTN: 15, CO: 65 },
    heroSeat: 'BTN' as const,
    lastRaiseSize: 50,
    minRaiseTo: 115,
  },
] as const;

describe('potLimit PF-01〜PF-13', () => {
  it.each(PF_VECTORS)('$id', (row) => {
    const s = scenario({
      potBefore: row.potBefore,
      contributions: row.contributions,
      heroSeat: row.heroSeat,
    });
    const result = analyze(s);

    expect(result.currentBet).toBe(row.C);
    expect(result.heroInvested).toBe(row.h);
    expect(result.totalPot).toBe(row.P);
    expect(result.toCall).toBe(row.toCall);
    expect(result.maxRaiseTo).toBe(row.maxRaiseTo);
    expect(result.maxAddChips).toBe(row.maxAddChips);
    expect(result.isAllIn).toBe(false);

    expect(result.steps).toHaveLength(3);
    const step0 = result.steps[0];
    const step1 = result.steps[1];
    const step2 = result.steps[2];
    expect(step0?.value).toBe(row.P);
    expect(step1?.value).toBe(row.maxAddChips);
    expect(step2?.value).toBe(row.maxRaiseTo);
  });
});

describe('potLimit FL-01〜FL-06', () => {
  it.each(FL_VECTORS)('$id', (row) => {
    const s = scenario({
      street: row.street,
      potBefore: row.potBefore,
      contributions: row.contributions,
      heroSeat: row.heroSeat,
      heroStack: 'heroStack' in row ? row.heroStack : undefined,
    });
    const result = analyze(s);

    expect(result.currentBet).toBe(row.C);
    expect(result.heroInvested).toBe(row.h);
    expect(result.totalPot).toBe(row.P);
    expect(result.maxRaiseTo).toBe(row.maxRaiseTo);
    expect(result.maxAddChips).toBe(row.maxAddChips);
    expect(result.isAllIn).toBe(row.isAllIn);

    expect(result.steps).toHaveLength(3);
    const step0 = result.steps[0];
    const step1 = result.steps[1];
    const step2 = result.steps[2];
    expect(step0?.value).toBe(row.P);
    expect(step1?.value).toBe(row.maxAddChips);
    expect(step2?.value).toBe(row.maxRaiseTo);
  });
});

describe('potLimit MIN-01〜MIN-04', () => {
  it.each(MIN_VECTORS)('$id', (row) => {
    const s = scenario({
      street: row.street,
      potBefore: row.potBefore,
      contributions: row.contributions,
      heroSeat: row.heroSeat,
      lastRaiseSize: 'lastRaiseSize' in row ? row.lastRaiseSize : undefined,
    });
    expect(analyze(s).minRaiseTo).toBe(row.minRaiseTo);
    expect(minRaiseTo(s)).toBe(row.minRaiseTo);
  });
});

describe('不変条件 maxRaiseTo === 3*C + (P - C - h)', () => {
  const all = [
    ...PF_VECTORS.map((row) => ({
      id: row.id,
      street: 'preflop' as const,
      potBefore: row.potBefore,
      contributions: row.contributions,
      heroSeat: row.heroSeat,
      isAllIn: false,
    })),
    ...FL_VECTORS.map((row) => ({
      id: row.id,
      street: row.street,
      potBefore: row.potBefore,
      contributions: row.contributions,
      heroSeat: row.heroSeat,
      heroStack: 'heroStack' in row ? row.heroStack : undefined,
      isAllIn: row.isAllIn,
    })),
  ];

  it.each(all)('$id', (row) => {
    const result = analyze(
      scenario({
        street: row.street,
        potBefore: row.potBefore,
        contributions: row.contributions,
        heroSeat: row.heroSeat,
        heroStack: 'heroStack' in row ? row.heroStack : undefined,
      }),
    );
    const shortcut =
      3 * result.currentBet +
      (result.totalPot - result.currentBet - result.heroInvested);

    expect(result.trail).toBe(
      result.totalPot - result.currentBet - result.heroInvested,
    );
    expect(shortcut).toBe(
      result.heroInvested + result.totalPot + 2 * result.toCall,
    );

    if (result.isAllIn) {
      expect(result.maxRaiseTo).toBeLessThan(shortcut);
    } else {
      expect(result.maxRaiseTo).toBe(shortcut);
    }
  });
});

describe('公開 API は analyze と一致する', () => {
  const s = scenario({
    contributions: { SB: 1, BB: 2, UTG: 7, MP: 7 },
    heroSeat: 'BB',
  });

  it('totalPot / currentBet / toCall / maxRaiseTo', () => {
    const result = analyze(s);
    expect(totalPot(s)).toBe(result.totalPot);
    expect(currentBet(s)).toBe(result.currentBet);
    expect(toCall(s)).toBe(result.toCall);
    expect(maxRaiseTo(s)).toBe(result.maxRaiseTo);
  });
});

describe('diagnose', () => {
  /** PF-08: P=17, C=7, h=2, toCall=5, maxRaiseTo=29 */
  const pf08 = scenario({
    contributions: { SB: 1, BB: 2, UTG: 7, MP: 7 },
    heroSeat: 'BB',
  });

  it('正解は null', () => {
    expect(diagnose(pf08, 29)).toBeNull();
  });

  it('forgot_own_investment: 答えが maxRaiseTo - h と一致', () => {
    expect(diagnose(pf08, 27)).toBe('forgot_own_investment');
  });

  it('forgot_double_call: 答えが P + toCall + h と一致', () => {
    expect(diagnose(pf08, 24)).toBe('forgot_double_call');
  });

  it('used_pot_after_call: 答えが P + toCall と一致', () => {
    expect(diagnose(pf08, 22)).toBe('used_pot_after_call');
  });

  it('missed_trail: 答えが 3*C と一致', () => {
    expect(diagnose(pf08, 21)).toBe('missed_trail');
  });

  it('off_by_blind: 差が sb または bb と一致', () => {
    expect(diagnose(pf08, 30)).toBe('off_by_blind');
    expect(diagnose(pf08, 31)).toBe('off_by_blind');
  });

  it('どれにも当てはまらなければ unknown', () => {
    expect(diagnose(pf08, 99)).toBe('unknown');
  });
});

describe('P1-1 isAllIn の steps は式と値が矛盾しない', () => {
  it('FL-06: 式の評価は未クランプ、value はスタック上限', () => {
    const s = scenario({
      street: 'flop',
      potBefore: 50,
      contributions: { UTG: 30 },
      heroSeat: 'BTN',
      heroStack: 100,
    });
    const result = analyze(s);
    expect(result.isAllIn).toBe(true);
    const unclampedAdd = result.totalPot + 2 * result.toCall;
    expect(unclampedAdd).toBe(140);
    expect(result.maxAddChips).toBe(100);
    const step1 = result.steps[1];
    expect(step1?.value).toBe(100);
    expect(step1?.expression).toContain(String(unclampedAdd));
    expect(step1?.expression).toContain(String(result.maxAddChips));
    const formula = step1?.expression.match(/^(\d+) \+ 2×(\d+)/);
    expect(formula).not.toBeNull();
    if (formula) {
      expect(Number(formula[1]) + 2 * Number(formula[2])).toBe(unclampedAdd);
    }
  });

  it('非クランプでは式の評価が value と一致', () => {
    const s = scenario({
      contributions: { SB: 1, BB: 2, UTG: 7, MP: 7 },
      heroSeat: 'BB',
    });
    const result = analyze(s);
    expect(result.isAllIn).toBe(false);
    const step1 = result.steps[1];
    const formula = step1?.expression.match(/^(\d+) \+ 2×(\d+)$/);
    expect(formula).not.toBeNull();
    if (formula && step1) {
      expect(Number(formula[1]) + 2 * Number(formula[2])).toBe(step1.value);
    }
  });
});

describe('P3-1 lastRaiseSize', () => {
  it('ベット10→レイズ30→元ベッターコール後の minRaiseTo は 50', () => {
    const s = scenario({
      street: 'flop',
      potBefore: 20,
      contributions: { UTG: 30, MP: 30 },
      heroSeat: 'CO',
      lastRaiseSize: 20,
    });
    expect(analyze(s).minRaiseTo).toBe(50);
  });

  it('ストラドル時の最小レイズはストラドルの 2 倍', () => {
    const s = scenario({
      contributions: { SB: 1, BB: 2, STR: 4 },
      heroSeat: 'UTG',
      lastRaiseSize: 4,
    });
    expect(analyze(s).minRaiseTo).toBe(8);
  });
});
