import type { Level } from '../types';
import type { Rng } from './rng';

export interface LevelPerformance {
  level: Level;
  total: number;
  correct: number;
  averageMs: number | null;
}

function div(a: number, b: number): number {
  if (b === 0) return 0;
  return (a - (a % b)) / b;
}

/**
 * 正答率が低い・平均解答時間が長いレベルほど重い。
 * 未出題は探索用に 10。金額計算は含まない。
 */
export function weightOf(
  total: number,
  correct: number,
  averageMs: number | null,
): number {
  if (total <= 0) return 10;
  const miss = total - correct;
  const missPart = div(miss * 40, total);
  let slow = 0;
  if (averageMs !== null && averageMs > 8000) {
    slow = div(averageMs - 8000, 500);
    if (slow > 30) slow = 30;
  }
  const w = 10 + missPart + slow;
  return w < 1 ? 1 : w;
}

/**
 * 設定されたレベルから、苦手ほど出やすいように選ぶ。
 */
export function pickWeightedLevel(
  levels: readonly Level[],
  stats: readonly LevelPerformance[],
  rng: Rng,
): Level {
  const pool = levels.length > 0 ? levels : ([1] as Level[]);
  const first = pool[0];
  if (first === undefined) return 1;
  const weights = pool.map((level) => {
    const row = stats.find((item) => item.level === level);
    return weightOf(row?.total ?? 0, row?.correct ?? 0, row?.averageMs ?? null);
  });
  let sum = 0;
  for (const w of weights) sum += w;
  if (sum <= 0) return first;
  let ticket = rng.int(1, sum);
  for (let i = 0; i < pool.length; i++) {
    const w = weights[i] ?? 0;
    const level = pool[i];
    if (level === undefined) continue;
    if (ticket <= w) return level;
    ticket -= w;
  }
  return pool[pool.length - 1] ?? first;
}
