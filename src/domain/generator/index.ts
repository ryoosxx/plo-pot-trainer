import { analyze } from '../potLimit';
import { maxContribution, nextLastRaiseSize } from '../lastRaise';
import type {
  ActionEntry,
  Chips,
  Level,
  Scenario,
  Seat,
  SeatId,
  Stake,
  Street,
} from '../types';
import { createRng, type Rng } from './rng';
import { validateScenario } from './validate';
import { preflopActionOrder } from './order';
import { scenarioHash } from './hash';

export type { Rng } from './rng';
export { createRng } from './rng';
export { validateScenario } from './validate';
export { replayLog } from './replay';
export { pickWeightedLevel, weightOf } from './weight';
export type { LevelPerformance } from './weight';
export { scenarioHash } from './hash';
export { findSimCuts, nextToAct } from './simCut';
export type { SimCut } from './simCut';

export interface GeneratorSettings {
  stake: Stake;
  tableSize: 6 | 9;
  straddle: 'none' | 'single' | 'double';
}

export interface Question {
  id: string;
  seed: number;
  level: Level;
  scenario: Scenario;
  /** analyze().maxRaiseTo。生成器は式を持たない。 */
  answer: Chips;
}

export const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
  stake: { sb: 1, bb: 2, ante: 0, anteType: 'none', unit: 1 },
  tableSize: 6,
  straddle: 'double',
};

const STACK_BB_MULTIPLE = 1000;
const MAX_ATTEMPTS = 400;

const RATE_100_200: Stake = {
  sb: 100,
  bb: 200,
  ante: 0,
  anteType: 'none',
  unit: 100,
};
const RATE_200_400: Stake = {
  sb: 200,
  bb: 400,
  ante: 0,
  anteType: 'none',
  unit: 200,
};
const RATE_500_1000: Stake = {
  sb: 500,
  bb: 1000,
  ante: 0,
  anteType: 'none',
  unit: 500,
};

interface TableState {
  street: Street;
  seats: Seat[];
  potBefore: Chips;
  contributions: Partial<Record<SeatId, Chips>>;
  actionLog: ActionEntry[];
  stake: Stake;
  heroSeat: SeatId;
  lastRaiseSize: Chips;
}

function sixMax(level: Level): SeatId[] {
  if (level === 3) return ['SB', 'BB', 'STR', 'HJ', 'CO', 'BTN'];
  return ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
}

function nineMax(level: Level): SeatId[] {
  if (level === 3) {
    return ['SB', 'BB', 'STR', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
  }
  return ['SB', 'BB', 'UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
}

function seatedIds(tableSize: 6 | 9, level: Level): SeatId[] {
  return tableSize === 9 ? nineMax(level) : sixMax(level);
}

function createSeats(ids: readonly SeatId[], hero: SeatId, stack: Chips): Seat[] {
  return ids.map((id) => ({
    id,
    label: id,
    stack,
    folded: false,
    isHero: id === hero,
    isButton: id === 'BTN',
  }));
}

function toScenario(state: TableState, heroSeat: SeatId): Scenario {
  return {
    street: state.street,
    seats: state.seats.map((seat) => ({
      ...seat,
      isHero: seat.id === heroSeat,
    })),
    potBefore: state.potBefore,
    contributions: { ...state.contributions },
    heroSeat,
    lastRaiseSize: state.lastRaiseSize,
    actionLog: state.actionLog.map((entry) => ({ ...entry })),
    stake: state.stake,
  };
}

function post(
  state: TableState,
  seat: SeatId,
  amount: Chips,
  type: 'post' | 'straddle',
): void {
  const cBefore = maxContribution(state.contributions);
  state.contributions[seat] = amount;
  state.lastRaiseSize = nextLastRaiseSize(
    state.lastRaiseSize,
    type,
    amount,
    cBefore,
    state.stake.bb,
  );
  state.actionLog.push({ seat, type, amountTo: amount });
}

function applyAntes(state: TableState, ids: readonly SeatId[]): void {
  const { anteType, ante } = state.stake;
  if (anteType === 'none' || ante <= 0) return;
  if (anteType === 'bb') {
    state.potBefore += ante;
    state.actionLog.push({ seat: 'BB', type: 'ante', amountTo: ante });
    return;
  }
  state.potBefore += ante * ids.length;
  for (const id of ids) {
    state.actionLog.push({ seat: id, type: 'ante', amountTo: ante });
  }
}

function actorsBeforeHero(
  ids: readonly SeatId[],
  actionStart: number,
  hero: SeatId,
): SeatId[] {
  const actors: SeatId[] = [];
  const n = ids.length;
  for (let step = 0; step < n; step++) {
    const index = (actionStart + step) % n;
    const id = ids[index];
    if (id === undefined) break;
    if (id === hero) break;
    actors.push(id);
  }
  return actors;
}

function alignToUnit(amount: Chips, unit: Chips, min: Chips, max: Chips): Chips {
  let aligned = amount - (amount % unit);
  if (aligned < min) aligned = min;
  if (aligned > max) aligned = max;
  return aligned;
}

/** 合法区間 [min, max] から、ポット / ミニ / キリの良い額を選ぶ。 */
function pickLegalRaiseTo(
  rng: Rng,
  min: Chips,
  max: Chips,
  unit: Chips,
  bb: Chips,
): Chips {
  if (max <= min) return min;
  const kind = rng.int(1, 10);
  if (kind <= 4) return max;
  if (kind <= 7) return min;

  const mid = alignToUnit(min + (max - min - ((max - min) % 2)) / 2, unit, min, max);
  const candidates: Chips[] = [min, max];
  if (mid > min && mid < max) candidates.push(mid);

  let step = bb;
  for (let i = 0; i < 8; i++) {
    const value = min + step;
    if (value >= max) break;
    if (value > min) candidates.push(alignToUnit(value, unit, min, max));
    step += bb;
  }

  const unique: Chips[] = [];
  for (const value of candidates) {
    if (value >= min && value <= max && value % unit === 0 && !unique.includes(value)) {
      unique.push(value);
    }
  }
  return rng.pick(unique);
}

function chooseVoluntary(
  rng: Rng,
  level: Level,
  raiseCount: number,
  canRaise: boolean,
  foldChance: number,
): 'fold' | 'call' | 'raise' {
  if (level === 1 || !canRaise || raiseCount >= 1) {
    return rng.int(1, 10) <= foldChance ? 'fold' : 'call';
  }
  const roll = rng.int(1, 10);
  if (roll <= 2) return 'fold';
  if (roll <= 7) return 'call';
  return 'raise';
}

function foldSeat(state: TableState, seatId: SeatId): void {
  for (const seat of state.seats) {
    if (seat.id === seatId) {
      seat.folded = true;
      break;
    }
  }
  state.actionLog.push({ seat: seatId, type: 'fold' });
}

function seatsAfter(order: readonly SeatId[], actor: SeatId): SeatId[] {
  const start = order.indexOf(actor);
  if (start < 0) return [];
  const rest: SeatId[] = [];
  for (let k = 1; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (id !== undefined) rest.push(id);
  }
  return rest;
}

function isFolded(state: TableState, id: SeatId): boolean {
  for (const seat of state.seats) {
    if (seat.id === id) return seat.folded;
  }
  return true;
}

function liveIds(state: TableState): SeatId[] {
  return state.seats.filter((seat) => !seat.folded).map((seat) => seat.id);
}

function doCall(state: TableState, actor: SeatId): void {
  const limit = analyze(toScenario(state, actor));
  state.contributions[actor] = limit.currentBet;
  state.actionLog.push({
    seat: actor,
    type: 'call',
    amountTo: limit.currentBet,
  });
}

function divInt(a: number, b: number): number {
  if (b === 0) return 0;
  return (a - (a % b)) / b;
}

function doRaise(state: TableState, actor: SeatId, rng: Rng): boolean {
  const unit = state.stake.unit > 0 ? state.stake.unit : 1;
  const limit = analyze(toScenario(state, actor));
  if (limit.maxRaiseTo < limit.minRaiseTo) return false;
  const raiseTo = pickLegalRaiseTo(
    rng,
    limit.minRaiseTo,
    limit.maxRaiseTo,
    unit,
    state.stake.bb,
  );
  const cBefore = maxContribution(state.contributions);
  state.contributions[actor] = raiseTo;
  state.lastRaiseSize = nextLastRaiseSize(
    state.lastRaiseSize,
    'raise',
    raiseTo,
    cBefore,
    state.stake.bb,
  );
  state.actionLog.push({ seat: actor, type: 'raise', amountTo: raiseTo });
  return true;
}

function doBet(state: TableState, actor: SeatId, rng: Rng): boolean {
  const unit = state.stake.unit > 0 ? state.stake.unit : 1;
  const limit = analyze(toScenario(state, actor));
  const minBet =
    state.stake.bb <= limit.maxRaiseTo ? state.stake.bb : limit.minRaiseTo;
  if (limit.maxRaiseTo < minBet) return false;
  const betTo = pickLegalRaiseTo(
    rng,
    minBet,
    limit.maxRaiseTo,
    unit,
    state.stake.bb,
  );
  const cBefore = maxContribution(state.contributions);
  state.contributions[actor] = betTo;
  state.lastRaiseSize = nextLastRaiseSize(
    state.lastRaiseSize,
    'bet',
    betTo,
    cBefore,
    state.stake.bb,
  );
  state.actionLog.push({ seat: actor, type: 'bet', amountTo: betTo });
  return true;
}

function emptyState(
  ids: readonly SeatId[],
  hero: SeatId,
  stack: Chips,
  stake: Stake,
  street: Street,
): TableState {
  return {
    street,
    seats: createSeats(ids, hero, stack),
    potBefore: 0,
    contributions: {},
    actionLog: [],
    stake,
    heroSeat: hero,
    lastRaiseSize: 0,
  };
}

function applyAllInClamp(scenario: Scenario, rng: Rng): Scenario {
  const result = analyze(scenario);
  if (result.isAllIn) return scenario;
  const unit = scenario.stake.unit > 0 ? scenario.stake.unit : 1;
  const unclamped = result.maxRaiseTo;
  const minTo = result.minRaiseTo;
  const h = result.heroInvested;
  const floor = minTo > h ? minTo : h + unit;
  const maxCap = unclamped - unit;
  if (maxCap < floor) return scenario;
  const steps = divInt(maxCap - floor, unit);
  const cap = floor + rng.int(0, steps) * unit;
  return {
    ...scenario,
    seats: scenario.seats.map((seat) =>
      seat.id === scenario.heroSeat ? { ...seat, stack: cap } : seat,
    ),
  };
}

function simulateHero4bet(
  ids: readonly SeatId[],
  order: readonly SeatId[],
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const openers = order.filter((id) => id !== 'SB' && id !== 'BB');
  if (openers.length === 0) return null;
  const hero = rng.pick(openers);
  const stack = STACK_BB_MULTIPLE * settings.stake.bb;
  const state = emptyState(ids, hero, stack, settings.stake, 'preflop');
  applyAntes(state, ids);
  post(state, 'SB', settings.stake.sb, 'post');
  post(state, 'BB', settings.stake.bb, 'post');

  for (const actor of order) {
    if (actor === hero) break;
    foldSeat(state, actor);
  }
  if (!doRaise(state, hero, rng)) return null;

  const rest = seatsAfter(order, hero).filter(
    (id) => id !== hero && !isFolded(state, id),
  );
  if (rest.length === 0) return null;
  const threeBetter = rng.pick(rest);
  for (const actor of rest) {
    if (actor === threeBetter) {
      if (!doRaise(state, actor, rng)) return null;
      continue;
    }
    foldSeat(state, actor);
  }
  return toScenario(state, hero);
}

function simulateFace3bet(
  ids: readonly SeatId[],
  order: readonly SeatId[],
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const hero = rng.pick(['SB', 'BB'] as const);
  const beforeHero: SeatId[] = [];
  for (const actor of order) {
    if (actor === hero) break;
    beforeHero.push(actor);
  }
  if (beforeHero.length < 2) return null;
  const openerIndex = rng.int(0, beforeHero.length - 2);
  const threeIndex = rng.int(openerIndex + 1, beforeHero.length - 1);
  const opener = beforeHero[openerIndex];
  const threeBetter = beforeHero[threeIndex];
  if (opener === undefined || threeBetter === undefined) return null;

  const stack = STACK_BB_MULTIPLE * settings.stake.bb;
  const state = emptyState(ids, hero, stack, settings.stake, 'preflop');
  applyAntes(state, ids);
  post(state, 'SB', settings.stake.sb, 'post');
  post(state, 'BB', settings.stake.bb, 'post');

  for (const actor of beforeHero) {
    if (actor === opener || actor === threeBetter) {
      if (!doRaise(state, actor, rng)) return null;
    } else {
      foldSeat(state, actor);
    }
  }
  return toScenario(state, hero);
}

function simulateLv4(
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const ids = seatedIds(settings.tableSize, 1);
  const order = preflopActionOrder(ids, 0);
  return rng.int(1, 2) === 1
    ? simulateHero4bet(ids, order, settings, rng)
    : simulateFace3bet(ids, order, settings, rng);
}

function collectStreet(state: TableState, next: Street, hero: SeatId): void {
  let pot = state.potBefore;
  for (const seat of state.seats) {
    const amount = state.contributions[seat.id] ?? 0;
    pot += amount;
    seat.stack = seat.stack - amount;
  }
  state.potBefore = pot;
  state.contributions = {};
  state.actionLog = [];
  state.lastRaiseSize = 0;
  state.street = next;
  state.heroSeat = hero;
}

function startPreflop(ids: readonly SeatId[], settings: GeneratorSettings): TableState {
  const dummy = ids[0] ?? 'UTG';
  const stack = STACK_BB_MULTIPLE * settings.stake.bb;
  const state = emptyState(ids, dummy, stack, settings.stake, 'preflop');
  applyAntes(state, ids);
  post(state, 'SB', settings.stake.sb, 'post');
  post(state, 'BB', settings.stake.bb, 'post');
  return state;
}

function playLimpedPreflop(
  ids: readonly SeatId[],
  settings: GeneratorSettings,
): TableState {
  const state = startPreflop(ids, settings);
  for (const actor of preflopActionOrder(ids, 0)) {
    doCall(state, actor);
  }
  return state;
}

function playOpenedPreflop(
  ids: readonly SeatId[],
  settings: GeneratorSettings,
  rng: Rng,
): TableState | null {
  const order = preflopActionOrder(ids, 0);
  if (order.length < 2) return null;
  const openerIdx = rng.int(0, order.length - 2);
  const opener = order[openerIdx];
  if (opener === undefined) return null;
  const state = startPreflop(ids, settings);
  let callers = 0;
  for (let i = 0; i < order.length; i++) {
    const actor = order[i];
    if (actor === undefined) return null;
    if (i < openerIdx) {
      foldSeat(state, actor);
      continue;
    }
    if (i === openerIdx) {
      if (!doRaise(state, actor, rng)) return null;
      continue;
    }
    const mustCall = i === order.length - 1 && callers === 0;
    if (!mustCall && rng.int(1, 10) <= 4) {
      foldSeat(state, actor);
    } else {
      doCall(state, actor);
      callers += 1;
    }
  }
  if (liveIds(state).length < 2) return null;
  return state;
}

function play3betPreflop(
  ids: readonly SeatId[],
  settings: GeneratorSettings,
  rng: Rng,
): TableState | null {
  const order = preflopActionOrder(ids, 0);
  if (order.length < 3) return null;
  const openerIdx = rng.int(0, order.length - 3);
  const threeIdx = rng.int(openerIdx + 1, order.length - 1);
  const opener = order[openerIdx];
  const threeBetter = order[threeIdx];
  if (opener === undefined || threeBetter === undefined) return null;
  const state = startPreflop(ids, settings);
  for (let i = 0; i < order.length; i++) {
    const actor = order[i];
    if (actor === undefined) return null;
    if (i === openerIdx || i === threeIdx) {
      if (!doRaise(state, actor, rng)) return null;
    } else {
      foldSeat(state, actor);
    }
  }
  for (const actor of seatsAfter(order, threeBetter)) {
    if (actor === threeBetter) break;
    if (isFolded(state, actor)) continue;
    const viewed = toScenario(state, actor);
    const limit = analyze(viewed);
    const invested = state.contributions[actor] ?? 0;
    if (invested >= limit.currentBet) continue;
    if (actor === opener) doCall(state, actor);
    else foldSeat(state, actor);
  }
  if (liveIds(state).length < 2) return null;
  return state;
}

function flopQuestion(
  state: TableState,
  ids: readonly SeatId[],
  rng: Rng,
): Scenario | null {
  const live = ids.filter((id) => !isFolded(state, id));
  const first = live[0];
  if (first === undefined || live.length < 2) return null;
  const pattern = rng.int(1, 4);
  if (pattern === 1) {
    state.heroSeat = first;
    return toScenario(state, first);
  }
  const later = live.slice(1);
  const hero = rng.pick(later.length > 0 ? later : live);
  state.heroSeat = hero;
  if (!doBet(state, first, rng)) return toScenario(state, first);

  if (pattern === 4) {
    const raiser = rng.pick(later);
    for (const actor of later) {
      if (actor === hero) break;
      if (actor === raiser) {
        if (!doRaise(state, actor, rng)) return null;
      } else {
        foldSeat(state, actor);
      }
    }
    return toScenario(state, hero);
  }

  for (const actor of later) {
    if (actor === hero) break;
    if (rng.int(1, 10) <= 4) foldSeat(state, actor);
    else doCall(state, actor);
  }
  return toScenario(state, hero);
}

function playFlopBetCall(
  state: TableState,
  ids: readonly SeatId[],
  rng: Rng,
): boolean {
  const live = ids.filter((id) => !isFolded(state, id));
  const first = live[0];
  if (first === undefined || live.length < 2) return false;
  if (!doBet(state, first, rng)) return false;
  for (const actor of live.slice(1)) {
    doCall(state, actor);
  }
  return true;
}

function simulateLv5(
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const ids = seatedIds(settings.tableSize, 1);
  const flavor = rng.int(1, 6);
  let pre: TableState | null;
  if (flavor <= 2) pre = playLimpedPreflop(ids, settings);
  else if (flavor <= 4) pre = playOpenedPreflop(ids, settings, rng);
  else pre = play3betPreflop(ids, settings, rng);
  if (!pre) return null;
  const live = liveIds(pre);
  if (live.length < 2) return null;
  const flopHero = rng.pick(live);
  collectStreet(pre, 'flop', flopHero);

  const streetRoll = rng.int(1, 10);
  if (streetRoll >= 8 && playFlopBetCall(pre, ids, rng)) {
    const after = liveIds(pre);
    if (after.length >= 2) {
      const nextHero = rng.pick(after);
      collectStreet(pre, streetRoll === 10 ? 'river' : 'turn', nextHero);
      return toScenario(pre, nextHero);
    }
  }
  return flopQuestion(pre, ids, rng);
}

function simulateLv6PreflopAnte(
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const ids = seatedIds(settings.tableSize, 1);
  const hero = rng.pick(ids.filter((id) => id !== 'SB' && id !== 'BB'));
  const useSettingsAnte = settings.stake.anteType !== 'none' && settings.stake.ante > 0;
  const anteAll = rng.int(1, 2) === 1;
  const stake: Stake = useSettingsAnte
    ? settings.stake
    : {
        ...settings.stake,
        anteType: anteAll ? 'all' : 'bb',
        ante: anteAll ? settings.stake.unit : settings.stake.bb,
      };
  const stack = STACK_BB_MULTIPLE * stake.bb;
  const state = emptyState(ids, hero, stack, stake, 'preflop');
  applyAntes(state, ids);
  post(state, 'SB', stake.sb, 'post');
  post(state, 'BB', stake.bb, 'post');
  const order = preflopActionOrder(ids, 0);
  for (const actor of order) {
    if (actor === hero) break;
    if (rng.int(1, 10) <= 5) foldSeat(state, actor);
    else doCall(state, actor);
  }
  return toScenario(state, hero);
}

function simulateLv6(
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const flavor = rng.int(1, 3);
  if (flavor === 1) {
    return simulateLv6PreflopAnte(settings, rng);
  }
  if (flavor === 2) {
    const stake = rng.pick([RATE_100_200, RATE_200_400, RATE_500_1000]);
    return simulateLv5({ ...settings, stake }, rng);
  }
  const base = simulateLv5(settings, rng);
  if (!base) return null;
  return applyAllInClamp(base, rng);
}

function fitsLevel(scenario: Scenario, level: Level): boolean {
  const result = analyze(scenario);
  if (level === 1) {
    return (
      scenario.street === 'preflop' &&
      result.heroInvested === 0 &&
      scenario.heroSeat !== 'SB' &&
      scenario.heroSeat !== 'BB' &&
      scenario.heroSeat !== 'STR' &&
      result.currentBet === scenario.stake.bb
    );
  }
  if (level === 2) {
    return (
      scenario.street === 'preflop' &&
      (scenario.heroSeat === 'SB' || scenario.heroSeat === 'BB') &&
      result.heroInvested > 0
    );
  }
  if (level === 3) {
    return scenario.actionLog.some((entry) => entry.type === 'straddle');
  }
  if (level === 4) {
    const raises = scenario.actionLog.filter((entry) => entry.type === 'raise')
      .length;
    return (
      scenario.street === 'preflop' &&
      raises >= 2 &&
      result.heroInvested > 0
    );
  }
  if (level === 5) {
    return scenario.street !== 'preflop';
  }
  return (
    result.isAllIn ||
    scenario.potBefore > 0 ||
    scenario.stake.bb >= 100
  );
}

function simulate(
  level: Level,
  settings: GeneratorSettings,
  rng: Rng,
): Scenario | null {
  const tableSize: 6 | 9 =
    level === 1 || level === 5 || level === 6
      ? rng.int(1, 2) === 1
        ? 6
        : 9
      : settings.tableSize;
  const local: GeneratorSettings = { ...settings, tableSize };

  if (level === 3 && local.straddle === 'none') return null;
  if (level === 4) return simulateLv4(local, rng);
  if (level === 5) return simulateLv5(local, rng);
  if (level === 6) return simulateLv6(local, rng);

  const { stake } = local;
  const ids = seatedIds(local.tableSize, level);
  const stack = STACK_BB_MULTIPLE * stake.bb;

  let straddleCount = 0;
  if (level === 3) {
    if (local.straddle === 'single') straddleCount = 1;
    else straddleCount = rng.int(1, 2);
  }

  let hero: SeatId;
  if (level === 1) {
    const late = ids.filter((id) => id !== 'SB' && id !== 'BB' && id !== 'STR');
    hero = rng.pick(late);
  } else if (level === 2) {
    hero = rng.pick(['SB', 'BB'] as const);
  } else {
    hero = rng.pick(ids);
  }

  const state = emptyState(ids, hero, stack, stake, 'preflop');
  applyAntes(state, ids);
  post(state, 'SB', stake.sb, 'post');
  post(state, 'BB', stake.bb, 'post');

  if (straddleCount >= 1) {
    post(state, 'STR', 2 * stake.bb, 'straddle');
  }
  if (straddleCount >= 2) {
    const doubleSeat = ids[3];
    if (doubleSeat !== undefined && doubleSeat !== 'STR') {
      post(state, doubleSeat, 4 * stake.bb, 'straddle');
    }
  }

  const actionStart = 2 + straddleCount;
  const actors = actorsBeforeHero(ids, actionStart, hero);
  let raiseCount = 0;
  const foldChance = level === 1 ? rng.int(1, 6) : 4;

  for (const actor of actors) {
    const viewed = toScenario(state, actor);
    const limit = analyze(viewed);
    const canRaise =
      level !== 1 && raiseCount === 0 && limit.maxRaiseTo >= limit.minRaiseTo;
    const action = chooseVoluntary(rng, level, raiseCount, canRaise, foldChance);

    if (action === 'fold') {
      foldSeat(state, actor);
      continue;
    }
    if (action === 'raise' && canRaise) {
      if (!doRaise(state, actor, rng)) return null;
      raiseCount += 1;
      continue;
    }
    doCall(state, actor);
  }

  return toScenario(state, hero);
}

function generateOnce(
  level: Level,
  settings: GeneratorSettings,
  seed: number,
): Question | null {
  const rng = createRng(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const scenario = simulate(level, settings, rng);
    if (!scenario) continue;
    if (!fitsLevel(scenario, level)) continue;
    if (!validateScenario(scenario)) continue;
    const result = analyze(scenario);
    return {
      id: `l${level}-s${seed}`,
      seed,
      level,
      scenario,
      answer: result.maxRaiseTo,
    };
  }
  return null;
}

/**
 * 合法なアクション列をシミュレートして 1 問を作る。
 * 正解は analyze().maxRaiseTo のみを使う。
 * 例: seed を固定すると同じ Question が返る。
 */
export function generateQuestion(
  level: Level,
  settings: GeneratorSettings,
  seed: number,
  recentHashes: readonly string[] = [],
): Question {
  for (let offset = 0; offset < MAX_ATTEMPTS; offset++) {
    const question = generateOnce(level, settings, seed + offset);
    if (!question) continue;
    if (recentHashes.includes(scenarioHash(question.scenario))) continue;
    return question;
  }

  throw new Error(`failed to generate a valid question for level ${level} seed ${seed}`);
}
