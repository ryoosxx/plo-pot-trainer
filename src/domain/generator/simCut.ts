import type { ActionType, Scenario, SeatId } from '../types';
import { streetActionOrder } from './order';

const VOLUNTARY: ReadonlySet<ActionType> = new Set([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
]);

export function isVoluntary(type: ActionType): boolean {
  return VOLUNTARY.has(type);
}

function straddleCountOf(scenario: Scenario): number {
  let n = 0;
  for (const entry of scenario.actionLog) {
    if (entry.type === 'straddle') n += 1;
  }
  return n;
}

function foldedBefore(scenario: Scenario, index: number): Set<SeatId> {
  const folded = new Set<SeatId>();
  for (let i = 0; i < index; i++) {
    const entry = scenario.actionLog[i];
    if (entry?.type === 'fold') folded.add(entry.seat);
  }
  return folded;
}

function postsCompleteIndex(scenario: Scenario): number | null {
  if (scenario.street !== 'preflop') return 0;
  let sb = false;
  let bb = false;
  let lastForced = -1;
  for (let i = 0; i < scenario.actionLog.length; i++) {
    const entry = scenario.actionLog[i];
    if (!entry) continue;
    if (isVoluntary(entry.type)) break;
    lastForced = i;
    if (entry.type === 'post' && entry.seat === 'SB') sb = true;
    if (entry.type === 'post' && entry.seat === 'BB') bb = true;
  }
  if (!sb || !bb) return null;
  return lastForced + 1;
}

export interface SimCut {
  interruptAt: number;
  heroSeat: SeatId;
}

/**
 * ポスト完了後、次の任意アクション直前だけを切る。
 */
export function findSimCuts(scenario: Scenario): SimCut[] {
  const postsAt = postsCompleteIndex(scenario);
  if (postsAt === null) return [];
  const cuts: SimCut[] = [];
  if (scenario.street !== 'preflop' && scenario.actionLog.length === 0) {
    const first = scenario.seats.find((seat) => !seat.folded);
    if (first) cuts.push({ interruptAt: 0, heroSeat: first.id });
    return cuts;
  }
  for (let i = postsAt; i < scenario.actionLog.length; i++) {
    const entry = scenario.actionLog[i];
    if (!entry || !isVoluntary(entry.type)) continue;
    const folded = foldedBefore(scenario, i);
    if (folded.has(entry.seat)) continue;
    cuts.push({ interruptAt: i, heroSeat: entry.seat });
  }
  const nxt = nextToAct(scenario);
  const foldedEnd = foldedBefore(scenario, scenario.actionLog.length);
  if (nxt && !foldedEnd.has(nxt)) {
    cuts.push({ interruptAt: scenario.actionLog.length, heroSeat: nxt });
  }
  return cuts;
}

export function nextToAct(scenario: Scenario): SeatId | null {
  const ids = scenario.seats.map((seat) => seat.id);
  const order = streetActionOrder(ids, scenario.street, straddleCountOf(scenario));
  const folded = new Set(
    scenario.seats.filter((seat) => seat.folded).map((seat) => seat.id),
  );
  let lastVol: SeatId | null = null;
  for (const entry of scenario.actionLog) {
    if (isVoluntary(entry.type)) lastVol = entry.seat;
  }
  const start = lastVol === null ? 0 : order.indexOf(lastVol) + 1;
  if (lastVol !== null && order.indexOf(lastVol) < 0) return null;
  for (let k = 0; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (id === undefined) continue;
    if (folded.has(id)) continue;
    if (lastVol === null) return id;
    if (id === lastVol) return null;
    return id;
  }
  return null;
}
