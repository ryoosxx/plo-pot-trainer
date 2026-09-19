/** 常に整数（最小チップ単位）。 */
export type Chips = number;

export type SeatId =
  | 'SB'
  | 'BB'
  | 'STR'
  | 'UTG'
  | 'UTG1'
  | 'MP'
  | 'LJ'
  | 'HJ'
  | 'CO'
  | 'BTN';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export type AnteType = 'none' | 'bb' | 'all';

export type ActionType =
  | 'ante'
  | 'post'
  | 'straddle'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise';

export type MistakeKind =
  | 'forgot_own_investment'
  | 'forgot_double_call'
  | 'used_pot_after_call'
  | 'missed_trail'
  | 'off_by_blind'
  | 'unknown';

export interface Stake {
  sb: Chips;
  bb: Chips;
  ante: Chips;
  anteType: AnteType;
  unit: Chips;
}

export interface Seat {
  id: SeatId;
  label: string;
  /** 当該ストリート開始時点の残り。 */
  stack: Chips;
  folded: boolean;
  isHero: boolean;
  isButton: boolean;
}

export interface ActionEntry {
  seat: SeatId;
  type: ActionType;
  /** raise/bet は "to" の額。 */
  amountTo?: Chips;
}

export type StepKey = 'totalPot' | 'maxAdd' | 'raiseTo';

export interface ExplanationStep {
  key: StepKey;
  expression: string;
  value: Chips;
}

export interface Scenario {
  street: Street;
  seats: Seat[];
  /** 前ストリートまでの確定ポット＋アンティ。 */
  potBefore: Chips;
  /** 当該ストリートの投入額。 */
  contributions: Partial<Record<SeatId, Chips>>;
  heroSeat: SeatId;
  /** 直前のレイズ幅。minRaiseTo = C + lastRaiseSize。 */
  lastRaiseSize: Chips;
  /** 表示用。計算には使わない。 */
  actionLog: ActionEntry[];
  stake: Stake;
}

export interface PotLimitResult {
  totalPot: Chips;
  currentBet: Chips;
  heroInvested: Chips;
  toCall: Chips;
  trail: Chips;
  maxRaiseTo: Chips;
  maxAddChips: Chips;
  minRaiseTo: Chips;
  /** スタック上限でクランプされたか。 */
  isAllIn: boolean;
  steps: ExplanationStep[];
}
