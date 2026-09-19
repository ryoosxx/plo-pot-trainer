import type { SeatId } from '../domain/types';

/**
 * 画面上の席名。STR は UTG、6max の MP は HJ。
 * 9max で HJ が既にあるときは MP のまま（重複を避ける）。
 */
export function seatDisplayName(
  id: SeatId,
  present: readonly SeatId[] = [],
): string {
  if (id === 'STR') return 'UTG';
  if (id === 'MP' && !present.includes('HJ')) return 'HJ';
  return id;
}
