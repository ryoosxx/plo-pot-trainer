import { maxContribution, nextLastRaiseSize } from '../lastRaise';
import type { Scenario, SeatId } from '../types';
import { foldedAtStreetStart } from './validate';

/**
 * アクションログの先頭 count 件までを適用した局面を返す。
 * 最終局面の folded は使わず、ログ上の fold だけを反映する。
 * lastRaiseSize もログから再計算する。
 */
export function replayLog(base: Scenario, count: number): Scenario {
  const max = base.actionLog.length;
  const n = count < 0 ? 0 : count > max ? max : count;
  const log = base.actionLog.slice(0, n);
  const contributions: Partial<Record<SeatId, number>> = {};
  const folded = foldedAtStreetStart(base);
  let lastRaiseSize = 0;
  for (const entry of log) {
    if (entry.type === 'fold') {
      folded.add(entry.seat);
      continue;
    }
    if (entry.type === 'ante' || entry.type === 'check') continue;
    const cBefore = maxContribution(contributions);
    if (entry.amountTo !== undefined) {
      lastRaiseSize = nextLastRaiseSize(
        lastRaiseSize,
        entry.type,
        entry.amountTo,
        cBefore,
        base.stake.bb,
      );
      contributions[entry.seat] = entry.amountTo;
    }
  }
  return {
    ...base,
    contributions,
    lastRaiseSize,
    actionLog: log,
    seats: base.seats.map((seat) => ({
      ...seat,
      folded: folded.has(seat.id),
    })),
  };
}
