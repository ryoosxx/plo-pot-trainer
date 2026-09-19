import type {
  Chips,
  ExplanationStep,
  MistakeKind,
  PotLimitResult,
  Scenario,
  Seat,
  SeatId,
} from './types';

const SEAT_IDS: readonly SeatId[] = [
  'SB',
  'BB',
  'STR',
  'UTG',
  'UTG1',
  'MP',
  'LJ',
  'HJ',
  'CO',
  'BTN',
];

function contributionOf(s: Scenario, seat: SeatId): Chips {
  return s.contributions[seat] ?? 0;
}

function findHero(s: Scenario): Seat | undefined {
  for (const seat of s.seats) {
    if (seat.id === s.heroSeat) return seat;
  }
  return undefined;
}

/**
 * 当該ストリートの最大投入額 C。
 * 例: PF-08（SB1, BB2, UTG7, MP7）→ 7
 */
export function currentBet(s: Scenario): Chips {
  return analyze(s).currentBet;
}

/**
 * 今テーブル上にある全額 P = potBefore + Σcontributions。
 * 例: PF-08 → 0+1+2+7+7 = 17
 */
export function totalPot(s: Scenario): Chips {
  return analyze(s).totalPot;
}

/**
 * コール額 toCall = C - h。
 * 例: PF-08（C=7, h=2）→ 5
 */
export function toCall(s: Scenario): Chips {
  return analyze(s).toCall;
}

/**
 * 最大レイズ額（raise-to）。
 * maxRaiseTo = h + P + 2 * (C - h)。スタック上限でクランプする。
 * 例: PF-08 → 2 + 17 + 2*5 = 29
 */
export function maxRaiseTo(s: Scenario): Chips {
  return analyze(s).maxRaiseTo;
}

/**
 * 最小レイズ額 minRaiseTo = C + lastRaiseIncrement。
 * プリフロップ未レイズは C + BB（1/2 なら 4）。
 * 例: MIN-02（UTG が 7 にレイズ、増分 5）→ 12
 */
export function minRaiseTo(s: Scenario): Chips {
  return analyze(s).minRaiseTo;
}

/**
 * 局面のポットリミットを解析する。唯一の計算入口。
 * maxRaiseTo = h + P + 2 * (C - h)
 * 例: PF-08（P=17, C=7, h=2）→ 2 + 17 + 2*5 = 29
 */
export function analyze(s: Scenario): PotLimitResult {
  let P = s.potBefore;
  let C = 0;
  for (const id of SEAT_IDS) {
    const amount = s.contributions[id];
    if (amount === undefined) continue;
    P += amount;
    if (amount > C) C = amount;
  }

  const h = contributionOf(s, s.heroSeat);
  const callAmount = C > h ? C - h : 0;
  const trail = P - C - h;
  const unclamped = h + P + 2 * callAmount;

  const hero = findHero(s);
  let raiseTo = unclamped;
  let isAllIn = false;
  if (hero !== undefined) {
    const remaining = hero.stack - h;
    const cap = remaining > 0 ? h + remaining : h;
    if (unclamped > cap) {
      raiseTo = cap;
      isAllIn = true;
    }
  }

  const addChips = raiseTo - h;
  const minTo = C + s.lastRaiseSize;
  const unclampedAdd = P + 2 * callAmount;

  const addExpression =
    isAllIn && unclampedAdd !== addChips
      ? `${P} + 2×${callAmount} = ${unclampedAdd} → ${addChips}`
      : `${P} + 2×${callAmount}`;

  const steps: ExplanationStep[] = [
    {
      key: 'totalPot',
      expression: `${P}`,
      value: P,
    },
    {
      key: 'maxAdd',
      expression: addExpression,
      value: addChips,
    },
    {
      key: 'raiseTo',
      expression: `${addChips} + ${h}`,
      value: raiseTo,
    },
  ];

  return {
    totalPot: P,
    currentBet: C,
    heroInvested: h,
    toCall: callAmount,
    trail,
    maxRaiseTo: raiseTo,
    maxAddChips: addChips,
    minRaiseTo: minTo,
    isAllIn,
    steps,
  };
}

/**
 * 誤答の典型パターンを判定する。正解なら null。
 * 例: PF-08 の正解 29 に対し 27 → forgot_own_investment
 */
export function diagnose(s: Scenario, userAnswer: Chips): MistakeKind | null {
  const result = analyze(s);
  if (userAnswer === result.maxRaiseTo) return null;

  if (
    result.heroInvested > 0 &&
    userAnswer === result.maxRaiseTo - result.heroInvested
  ) {
    return 'forgot_own_investment';
  }
  if (userAnswer === result.totalPot + result.toCall + result.heroInvested) {
    return 'forgot_double_call';
  }
  if (userAnswer === result.totalPot + result.toCall) {
    return 'used_pot_after_call';
  }
  if (userAnswer === 3 * result.currentBet) {
    return 'missed_trail';
  }

  const diff =
    userAnswer > result.maxRaiseTo
      ? userAnswer - result.maxRaiseTo
      : result.maxRaiseTo - userAnswer;
  if (diff === s.stake.sb || diff === s.stake.bb) {
    return 'off_by_blind';
  }
  return 'unknown';
}
