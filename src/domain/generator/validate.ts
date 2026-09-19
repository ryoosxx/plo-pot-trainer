import { analyze } from '../potLimit';
import { maxContribution, nextLastRaiseSize } from '../lastRaise';
import type { ActionEntry, Chips, Scenario, SeatId } from '../types';
import { isVoluntary } from './simCut';
import { streetActionOrder } from './order';

function isValidAmount(n: number, unit: Chips): boolean {
  return Number.isInteger(n) && n >= 0 && n % unit === 0;
}

function amountsOk(scenario: Scenario, unit: Chips): boolean {
  if (!Number.isInteger(unit) || unit <= 0) return false;
  if (!isValidAmount(scenario.potBefore, unit)) return false;
  if (!isValidAmount(scenario.stake.sb, unit)) return false;
  if (!isValidAmount(scenario.stake.bb, unit)) return false;
  if (!isValidAmount(scenario.stake.ante, unit)) return false;
  if (!isValidAmount(scenario.lastRaiseSize, unit) && scenario.lastRaiseSize !== 0) {
    return false;
  }

  for (const seat of scenario.seats) {
    if (!isValidAmount(seat.stack, unit)) return false;
  }
  for (const seat of scenario.seats) {
    const amount = scenario.contributions[seat.id];
    if (amount !== undefined && !isValidAmount(amount, unit)) return false;
  }
  for (const entry of scenario.actionLog) {
    if (entry.amountTo !== undefined && !isValidAmount(entry.amountTo, unit)) {
      return false;
    }
  }
  return true;
}

function snapshotAs(
  scenario: Scenario,
  contributions: Partial<Record<SeatId, Chips>>,
  folded: ReadonlySet<SeatId>,
  actor: SeatId,
  lastRaiseSize: Chips,
): Scenario {
  return {
    street: scenario.street,
    potBefore: scenario.potBefore,
    stake: scenario.stake,
    heroSeat: actor,
    lastRaiseSize,
    contributions: { ...contributions },
    actionLog: [],
    seats: scenario.seats.map((seat) => ({
      ...seat,
      folded: folded.has(seat.id),
      isHero: seat.id === actor,
    })),
  };
}

function applyEntry(
  scenario: Scenario,
  contributions: Partial<Record<SeatId, Chips>>,
  folded: Set<SeatId>,
  entry: ActionEntry,
  lastRaiseSize: Chips,
): { ok: boolean; lastRaiseSize: Chips } {
  const cBefore = maxContribution(contributions);
  switch (entry.type) {
    case 'post':
    case 'straddle':
    case 'bet':
    case 'raise': {
      if (entry.amountTo === undefined) return { ok: false, lastRaiseSize };
      contributions[entry.seat] = entry.amountTo;
      return {
        ok: true,
        lastRaiseSize: nextLastRaiseSize(
          lastRaiseSize,
          entry.type,
          entry.amountTo,
          cBefore,
          scenario.stake.bb,
        ),
      };
    }
    case 'call': {
      const viewed = snapshotAs(
        scenario,
        contributions,
        folded,
        entry.seat,
        lastRaiseSize,
      );
      contributions[entry.seat] = analyze(viewed).currentBet;
      return { ok: true, lastRaiseSize };
    }
    case 'fold':
      folded.add(entry.seat);
      return { ok: true, lastRaiseSize };
    case 'check':
    case 'ante':
      return { ok: true, lastRaiseSize };
  }
}

function straddleCountOf(scenario: Scenario): number {
  let n = 0;
  for (const entry of scenario.actionLog) {
    if (entry.type === 'straddle') n += 1;
  }
  return n;
}

function nextLive(
  order: readonly SeatId[],
  after: SeatId | null,
  folded: ReadonlySet<SeatId>,
): SeatId | null {
  const start = after === null ? 0 : order.indexOf(after) + 1;
  if (after !== null && order.indexOf(after) < 0) return null;
  for (let k = 0; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (id === undefined) continue;
    if (folded.has(id)) continue;
    if (after !== null && id === after) return null;
    return id;
  }
  return null;
}

export function foldedAtStreetStart(scenario: Scenario): Set<SeatId> {
  const foldedInLog = new Set<SeatId>();
  for (const entry of scenario.actionLog) {
    if (entry.type === 'fold') foldedInLog.add(entry.seat);
  }
  const folded = new Set<SeatId>();
  for (const seat of scenario.seats) {
    if (seat.folded && !foldedInLog.has(seat.id)) folded.add(seat.id);
  }
  return folded;
}

function validateActionSequence(scenario: Scenario): boolean {
  const ids = scenario.seats.map((seat) => seat.id);
  const order = streetActionOrder(ids, scenario.street, straddleCountOf(scenario));
  const folded = foldedAtStreetStart(scenario);
  let expect: SeatId | null = null;
  let started = false;
  for (const entry of scenario.actionLog) {
    if (folded.has(entry.seat) && isVoluntary(entry.type)) return false;
    if (!isVoluntary(entry.type)) {
      if (entry.type === 'fold') folded.add(entry.seat);
      continue;
    }
    if (!started) {
      expect = nextLive(order, null, folded);
      started = true;
    }
    if (expect !== entry.seat) return false;
    if (entry.type === 'fold') folded.add(entry.seat);
    expect = nextLive(order, entry.seat, folded);
  }
  return true;
}

function validateRaiseHistory(scenario: Scenario): boolean {
  const contributions: Partial<Record<SeatId, Chips>> = {};
  const folded = new Set<SeatId>();
  let lastRaiseSize = 0;

  for (const entry of scenario.actionLog) {
    if (entry.type === 'raise' || entry.type === 'bet') {
      const amountTo = entry.amountTo;
      if (amountTo === undefined) return false;
      const viewed = snapshotAs(
        scenario,
        contributions,
        folded,
        entry.seat,
        lastRaiseSize,
      );
      const { minRaiseTo, maxRaiseTo } = analyze(viewed);
      if (amountTo < minRaiseTo || amountTo > maxRaiseTo) return false;
    }
    const applied = applyEntry(
      scenario,
      contributions,
      folded,
      entry,
      lastRaiseSize,
    );
    if (!applied.ok) return false;
    lastRaiseSize = applied.lastRaiseSize;
  }

  if (lastRaiseSize !== scenario.lastRaiseSize) return false;

  for (const seat of scenario.seats) {
    const replayed = contributions[seat.id] ?? 0;
    const actual = scenario.contributions[seat.id] ?? 0;
    if (replayed !== actual) return false;
    if (seat.folded !== folded.has(seat.id)) return false;
  }
  return true;
}

/**
 * docs/pot-limit-rules.md §8 の不変条件 1〜4 を検査する。
 * 計算はすべて analyze() に委譲する。
 */
export function validateScenario(scenario: Scenario): boolean {
  const unit = scenario.stake.unit;
  if (!amountsOk(scenario, unit)) return false;
  if (!validateActionSequence(scenario)) return false;

  const result = analyze(scenario);
  if (result.maxRaiseTo < result.minRaiseTo) return false;

  const shortcut =
    3 * result.currentBet +
    (result.totalPot - result.currentBet - result.heroInvested);
  const unclamped =
    result.heroInvested + result.totalPot + 2 * result.toCall;
  if (shortcut !== unclamped) return false;

  if (result.isAllIn) {
    if (result.maxRaiseTo >= shortcut) return false;
  } else if (result.maxRaiseTo !== shortcut) {
    return false;
  }

  return validateRaiseHistory(scenario);
}
