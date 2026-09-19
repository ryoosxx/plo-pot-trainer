import type { SeatId, Street } from '../types';

export function preflopActionOrder(
  ids: readonly SeatId[],
  straddleCount: number,
): SeatId[] {
  const start = 2 + straddleCount;
  const order: SeatId[] = [];
  for (let k = 0; k < ids.length; k++) {
    const id = ids[(start + k) % ids.length];
    if (id !== undefined) order.push(id);
  }
  return order;
}

export function streetActionOrder(
  ids: readonly SeatId[],
  street: Street,
  straddleCount: number,
): SeatId[] {
  if (street === 'preflop') return preflopActionOrder(ids, straddleCount);
  return [...ids];
}
