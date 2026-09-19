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

/** 端末のローカル日付 YYYY-MM-DD。統計の「今日」判定に使う。 */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${y}-${mm}-${dd}`;
}

export function todayKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return localDateKey(parsed);
}
