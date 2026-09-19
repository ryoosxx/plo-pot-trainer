import type { Chips } from '../domain/types';
import { strings } from './strings';

/** 表示用の桁区切り。金額の計算には使わない。 */
export function formatChips(amount: Chips): string {
  return amount.toLocaleString('ja-JP');
}

export function formatMs(ms: number): string {
  const sec = ms / 1000;
  const rounded = (sec * 10 - ((sec * 10) % 1)) / 10;
  return `${rounded.toFixed(1)}${strings.common.seconds}`;
}

export function formatPercent(ratio: number): string {
  const pct = (ratio * 1000 - ((ratio * 1000) % 1)) / 10;
  return `${pct.toFixed(0)}%`;
}

export function todayKey(iso: string): string {
  return iso.slice(0, 10);
}
