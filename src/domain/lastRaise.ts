import type { ActionType, Chips } from './types';

/**
 * 直前のレイズ幅をアクション適用後に更新する。
 * プリフロップの BB ポスト後は BB（最小レイズ = C+BB）。
 * ストラドル後はストラドル額（最小レイズ = ストラドルの 2 倍）。
 */
export function nextLastRaiseSize(
  prev: Chips,
  type: ActionType,
  amountTo: Chips | undefined,
  currentBetBefore: Chips,
  bb: Chips,
): Chips {
  if (amountTo === undefined) return prev;
  if (type === 'post' && amountTo === bb) return bb;
  if (type === 'straddle') return amountTo;
  if (type === 'bet') return amountTo;
  if (type === 'raise') {
    const inc = amountTo - currentBetBefore;
    return inc > 0 ? inc : prev;
  }
  return prev;
}

export function maxContribution(
  contributions: Partial<Record<string, Chips>>,
): Chips {
  let c = 0;
  for (const amount of Object.values(contributions)) {
    if (amount !== undefined && amount > c) c = amount;
  }
  return c;
}
