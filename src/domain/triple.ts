import { createRng } from './generator/rng';

export const TRIPLE_MIN = 14;
export const TRIPLE_MAX = 99;

/**
 * 暗算ショートカット 3×C の練習用。整数のみ。
 * 例: timesThree(14) === 42
 */
export function timesThree(n: number): number {
  return n * 3;
}

/** 14〜99 の整数をシード付きで選ぶ。 */
export function generateTripleValue(seed: number): number {
  return createRng(seed).int(TRIPLE_MIN, TRIPLE_MAX);
}
