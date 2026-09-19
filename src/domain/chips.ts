import type { Chips } from './types';

function quot(amount: Chips, denom: Chips): Chips {
  return (amount - (amount % denom)) / denom;
}

/**
 * 金額を大きい額面から最小枚数に分解する。
 * 例: CH-01（3700、額面 100/500/1000/5000）→ 1000×3, 500×1, 100×2
 */
export function breakdown(
  amount: Chips,
  denoms: Chips[],
): { denom: Chips; count: number }[] {
  const sorted = denoms.slice().sort((a, b) => b - a);
  const parts: { denom: Chips; count: number }[] = [];
  let remaining = amount;
  for (const denom of sorted) {
    if (denom <= 0) continue;
    const count = quot(remaining, denom);
    if (count > 0) {
      parts.push({ denom, count });
      remaining -= count * denom;
    }
  }
  return parts;
}

/**
 * チップの山の合計額。
 * 例: CH-01 の分解 → 3700
 */
export function totalOf(stacks: { denom: Chips; count: number }[]): Chips {
  let total = 0;
  for (const stack of stacks) {
    total += stack.denom * stack.count;
  }
  return total;
}
