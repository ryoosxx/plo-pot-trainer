import type { Chips, SeatId } from './types';

export interface Pot {
  amount: Chips;
  participants: SeatId[];
}

export interface Refund {
  seat: SeatId;
  amount: Chips;
}

export interface SidePotResult {
  pots: Pot[];
  refunds: Refund[];
}

export interface PotEntry {
  seat: SeatId;
  amount: Chips;
  folded: boolean;
}

const SEAT_ORDER: readonly SeatId[] = [
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

function seatRank(id: SeatId): number {
  const index = SEAT_ORDER.indexOf(id);
  return index < 0 ? SEAT_ORDER.length : index;
}

function sortSeats(ids: SeatId[]): SeatId[] {
  return [...ids].sort((a, b) => seatRank(a) - seatRank(b));
}

function sameSeats(a: SeatId[], b: SeatId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 投入水準を昇順に層分けしてメイン／サイドポットを組む。
 * 層の額 = (水準の差) × (その水準以上を投入した人数)。
 * 参加資格 = その水準以上を投入し、かつフォールドしていない席。
 * 参加資格が同じ連続層はマージする。投入が 1 人だけの層は未コール返却。
 * 例: SP-01（100 / 60 / 100）→ メイン 180、サイド 80
 */
export function buildPots(entries: PotEntry[]): SidePotResult {
  const levels: Chips[] = [];
  for (const entry of entries) {
    if (entry.amount > 0 && !levels.includes(entry.amount)) {
      levels.push(entry.amount);
    }
  }
  levels.sort((a, b) => a - b);

  const layers: {
    amount: Chips;
    participants: SeatId[];
    contributors: number;
    refundSeat: SeatId | null;
  }[] = [];

  let prev: Chips = 0;
  for (const level of levels) {
    const delta = level - prev;
    const inLayer = entries.filter((entry) => entry.amount >= level);
    const eligible = inLayer.filter((entry) => !entry.folded);
    const amount = delta * inLayer.length;
    const first = inLayer[0];
    layers.push({
      amount,
      participants: sortSeats(eligible.map((entry) => entry.seat)),
      contributors: inLayer.length,
      refundSeat: inLayer.length === 1 && first ? first.seat : null,
    });
    prev = level;
  }

  const pots: Pot[] = [];
  const refunds: Refund[] = [];

  for (const layer of layers) {
    if (layer.amount === 0) continue;
    if (layer.refundSeat !== null) {
      const last = refunds[refunds.length - 1];
      if (last && last.seat === layer.refundSeat) {
        last.amount += layer.amount;
      } else {
        refunds.push({ seat: layer.refundSeat, amount: layer.amount });
      }
      continue;
    }
    const lastPot = pots[pots.length - 1];
    if (lastPot && sameSeats(lastPot.participants, layer.participants)) {
      lastPot.amount += layer.amount;
    } else {
      pots.push({
        amount: layer.amount,
        participants: layer.participants,
      });
    }
  }

  return { pots, refunds };
}
