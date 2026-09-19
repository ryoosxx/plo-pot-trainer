import type { AnteType, Chips, Level, MistakeKind } from '../domain/types';

export const SCHEMA_VERSION = 1 as const;

export const SETTINGS_KEY = 'plo-trainer:settings:v1';
export const SESSIONS_KEY = 'plo-trainer:sessions:v1';
export const META_KEY = 'plo-trainer:meta:v1';

export type AnswerType = 'raiseTo' | 'addChips' | 'both';
export type StraddleMode = 'none' | 'single' | 'double';
export type QuestionCount = 10 | 20 | 50 | 0;
export type TimeLimitSec = 0 | 10 | 15 | 20;
export type ChipPreset = 'jp' | 'us' | 'custom';
export type RatePreset =
  | '1/2'
  | '1/3'
  | '2/5'
  | '5/5'
  | '100/200'
  | '200/400'
  | '500/1000'
  | 'custom';
export type QuizMode = 'max-raise' | 'chips' | 'sim' | 'triple';


export interface Settings {
  schemaVersion: typeof SCHEMA_VERSION;
  ratePreset: RatePreset;
  sb: Chips;
  bb: Chips;
  unit: Chips;
  anteType: AnteType;
  ante: Chips;
  straddle: StraddleMode;
  levels: Level[];
  questionCount: QuestionCount;
  answerType: AnswerType;
  timeLimitSec: TimeLimitSec;
  chipPreset: ChipPreset;
  chipDenoms: Chips[];
  sound: boolean;
  vibe: boolean;
}

export interface PersistMeta {
  schemaVersion: typeof SCHEMA_VERSION;
  bestStreak: number;
  currentStreak: number;
}

export interface AnswerRecord {
  questionId: string;
  seed: number;
  level: Level;
  mode: QuizMode;
  answer: Chips;
  input: Chips;
  correct: boolean;
  elapsedMs: number;
  timedOut: boolean;
  mistake: MistakeKind | null;
  at: string;
}

export interface SessionResult {
  id: string;
  mode: QuizMode;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  records: AnswerRecord[];
  settingsSnapshot: Settings;
}

export const JP_DENOMS: Chips[] = [100, 500, 1000, 5000, 10000];
export const US_DENOMS: Chips[] = [1, 5, 25, 100, 500];

export const RATE_PRESETS: {
  id: Exclude<RatePreset, 'custom'>;
  sb: Chips;
  bb: Chips;
}[] = [
  { id: '1/2', sb: 1, bb: 2 },
  { id: '1/3', sb: 1, bb: 3 },
  { id: '2/5', sb: 2, bb: 5 },
  { id: '5/5', sb: 5, bb: 5 },
  { id: '100/200', sb: 100, bb: 200 },
  { id: '200/400', sb: 200, bb: 400 },
  { id: '500/1000', sb: 500, bb: 1000 },
];

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  ratePreset: '1/2',
  sb: 1,
  bb: 2,
  unit: 1,
  anteType: 'none',
  ante: 0,
  straddle: 'double',
  levels: [1, 2, 3],
  questionCount: 20,
  answerType: 'raiseTo',
  timeLimitSec: 0,
  chipPreset: 'jp',
  chipDenoms: [...JP_DENOMS],
  sound: true,
  vibe: true,
};

export function clampLevel(value: number): Level {
  if (value < 1) return 1;
  if (value > 6) return 6;
  return value as Level;
}

/** 出題プールは min 〜 max の連番。 */
export function levelsFromTo(min: Level, max: Level): Level[] {
  const lo = clampLevel(Math.min(min, max));
  const hi = clampLevel(Math.max(min, max));
  const levels: Level[] = [];
  for (let i = lo; i <= hi; i += 1) {
    levels.push(i as Level);
  }
  return levels;
}

export function minLevelOf(levels: readonly Level[]): Level {
  let min: Level = 6;
  if (levels.length === 0) return 1;
  for (const level of levels) {
    if (level < min) min = level;
  }
  return min;
}

export function maxLevelOf(levels: readonly Level[]): Level {
  let max: Level = 1;
  for (const level of levels) {
    if (level > max) max = level;
  }
  return max;
}

export const DEFAULT_META: PersistMeta = {
  schemaVersion: SCHEMA_VERSION,
  bestStreak: 0,
  currentStreak: 0,
};

export function gcd(a: number, b: number): number {
  let x = a < 0 ? -a : a;
  let y = b < 0 ? -b : b;
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x === 0 ? 1 : x;
}

export function unitOf(sb: Chips, bb: Chips): Chips {
  return gcd(sb, bb);
}
