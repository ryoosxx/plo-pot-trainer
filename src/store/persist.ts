import { strings } from '../lib/strings';
import type { MistakeKind } from '../domain/types';
import {
  DEFAULT_META,
  DEFAULT_SETTINGS,
  JP_DENOMS,
  META_KEY,
  SCHEMA_VERSION,
  SESSIONS_KEY,
  SETTINGS_KEY,
  isQuizMode,
  levelsFromTo,
  maxLevelOf,
  minLevelOf,
  type AnswerRecord,
  type PersistMeta,
  type QuizMode,
  type SessionResult,
  type Settings,
} from './schema';

export type PersistNoticeKind = 'corrupt' | 'schema';

export interface DecodeResult<T> {
  value: T;
  notice: PersistNoticeKind | null;
  error: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChips(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isLevel(value: unknown): value is Settings['levels'][number] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

export function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isChips(value.sb) || !isChips(value.bb) || !isChips(value.unit)) return false;
  if (value.anteType !== 'none' && value.anteType !== 'bb' && value.anteType !== 'all') {
    return false;
  }
  if (!isChips(value.ante)) return false;
  if (
    value.straddle !== 'none' &&
    value.straddle !== 'single' &&
    value.straddle !== 'double'
  ) {
    return false;
  }
  if (!Array.isArray(value.levels) || value.levels.length === 0) return false;
  for (const level of value.levels) {
    if (!isLevel(level)) return false;
  }
  if (
    value.questionCount !== 10 &&
    value.questionCount !== 20 &&
    value.questionCount !== 50 &&
    value.questionCount !== 0
  ) {
    return false;
  }
  if (
    value.answerType !== 'raiseTo' &&
    value.answerType !== 'addChips' &&
    value.answerType !== 'both'
  ) {
    return false;
  }
  if (
    value.timeLimitSec !== 0 &&
    value.timeLimitSec !== 10 &&
    value.timeLimitSec !== 15 &&
    value.timeLimitSec !== 20
  ) {
    return false;
  }
  if (
    value.chipPreset !== 'jp' &&
    value.chipPreset !== 'us' &&
    value.chipPreset !== 'custom'
  ) {
    return false;
  }
  if (!Array.isArray(value.chipDenoms)) return false;
  for (const denom of value.chipDenoms) {
    if (!isChips(denom) || denom === 0) return false;
  }
  if (typeof value.sound !== 'boolean' || typeof value.vibe !== 'boolean') {
    return false;
  }
  if (
    value.ratePreset !== '1/2' &&
    value.ratePreset !== '1/3' &&
    value.ratePreset !== '2/5' &&
    value.ratePreset !== '5/5' &&
    value.ratePreset !== '100/200' &&
    value.ratePreset !== '200/400' &&
    value.ratePreset !== '500/1000' &&
    value.ratePreset !== 'custom'
  ) {
    return false;
  }
  return true;
}

const MISTAKE_KINDS: readonly MistakeKind[] = [
  'forgot_own_investment',
  'forgot_double_call',
  'used_pot_after_call',
  'missed_trail',
  'off_by_blind',
  'unknown',
];

function isMistakeKind(value: unknown): value is MistakeKind {
  return typeof value === 'string' && MISTAKE_KINDS.some((item) => item === value);
}

/** アプリ更新後も統計を残すため、欠けた設定は既定値で埋める。 */
export function coerceSettings(value: unknown): Settings {
  const base: Settings = {
    ...DEFAULT_SETTINGS,
    levels: [...DEFAULT_SETTINGS.levels],
    chipDenoms: [...DEFAULT_SETTINGS.chipDenoms],
  };
  if (!isRecord(value)) return base;
  if (
    value.ratePreset === '1/2' ||
    value.ratePreset === '1/3' ||
    value.ratePreset === '2/5' ||
    value.ratePreset === '5/5' ||
    value.ratePreset === '100/200' ||
    value.ratePreset === '200/400' ||
    value.ratePreset === '500/1000' ||
    value.ratePreset === 'custom'
  ) {
    base.ratePreset = value.ratePreset;
  }
  if (isChips(value.sb) && value.sb > 0) base.sb = value.sb;
  if (isChips(value.bb) && value.bb > 0) base.bb = value.bb;
  if (isChips(value.unit) && value.unit > 0) base.unit = value.unit;
  if (value.anteType === 'none' || value.anteType === 'bb' || value.anteType === 'all') {
    base.anteType = value.anteType;
  }
  if (isChips(value.ante)) base.ante = value.ante;
  if (value.straddle === 'none' || value.straddle === 'single' || value.straddle === 'double') {
    base.straddle = value.straddle;
  }
  if (Array.isArray(value.levels)) {
    const levels = value.levels.filter(isLevel);
    if (levels.length > 0) {
      base.levels = levelsFromTo(minLevelOf(levels), maxLevelOf(levels));
    }
  }
  if (
    value.questionCount === 10 ||
    value.questionCount === 20 ||
    value.questionCount === 50 ||
    value.questionCount === 0
  ) {
    base.questionCount = value.questionCount;
  }
  if (value.timeLimitSec === 0 || value.timeLimitSec === 10 || value.timeLimitSec === 15 || value.timeLimitSec === 20) {
    base.timeLimitSec = value.timeLimitSec;
  }
  base.answerType = 'raiseTo';
  if (value.chipPreset === 'us') {
    base.chipPreset = 'us';
    base.chipDenoms = Array.isArray(value.chipDenoms)
      ? value.chipDenoms.filter((denom) => isChips(denom) && denom > 0)
      : [...base.chipDenoms];
    if (base.chipDenoms.length === 0) base.chipDenoms = [...DEFAULT_SETTINGS.chipDenoms];
  } else {
    base.chipPreset = 'jp';
    base.chipDenoms = [...JP_DENOMS];
  }
  if (typeof value.sound === 'boolean') base.sound = value.sound;
  if (typeof value.vibe === 'boolean') base.vibe = value.vibe;
  base.schemaVersion = SCHEMA_VERSION;
  return base;
}

export function isPersistMeta(value: unknown): value is PersistMeta {
  if (!isRecord(value)) return false;
  return isChips(value.bestStreak) && isChips(value.currentStreak);
}

function coerceRecord(value: unknown): AnswerRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.questionId !== 'string') return null;
  if (!isLevel(value.level)) return null;
  const mode: QuizMode = isQuizMode(value.mode) ? value.mode : 'max-raise';
  if (typeof value.seed !== 'number' || !Number.isInteger(value.seed)) return null;
  if (!isChips(value.answer) || !isChips(value.input)) return null;
  if (typeof value.correct !== 'boolean') return null;
  if (typeof value.elapsedMs !== 'number' || !Number.isFinite(value.elapsedMs)) return null;
  if (typeof value.timedOut !== 'boolean') return null;
  if (typeof value.at !== 'string') return null;
  const mistake = value.mistake === null || isMistakeKind(value.mistake) ? value.mistake : null;
  return {
    questionId: value.questionId,
    seed: value.seed,
    level: value.level,
    mode,
    answer: value.answer,
    input: value.input,
    correct: value.correct,
    elapsedMs: value.elapsedMs,
    timedOut: value.timedOut,
    mistake,
    at: value.at,
  };
}

export function decodeSessionItem(value: unknown): SessionResult | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string') return null;
  if (typeof value.startedAt !== 'string' || typeof value.endedAt !== 'string') {
    return null;
  }
  if (typeof value.completed !== 'boolean') return null;
  if (!Array.isArray(value.records)) return null;
  const records: AnswerRecord[] = [];
  for (const item of value.records) {
    const record = coerceRecord(item);
    if (record) records.push(record);
  }
  const mode: QuizMode = isQuizMode(value.mode) ? value.mode : 'max-raise';
  return {
    id: value.id,
    mode,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    completed: value.completed,
    records,
    settingsSnapshot: coerceSettings(value.settingsSnapshot),
  };
}

export function isSessionResult(value: unknown): value is SessionResult {
  return decodeSessionItem(value) !== null;
}

export function decodeSettings(raw: string | null): DecodeResult<Settings> {
  if (raw === null) {
    return { value: DEFAULT_SETTINGS, notice: null, error: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSettings(parsed)) {
      return {
        value: DEFAULT_SETTINGS,
        notice: 'schema',
        error: new Error('settings schema mismatch'),
      };
    }
    const chipPreset: Settings['chipPreset'] =
      parsed.chipPreset === 'us' ? 'us' : 'jp';
    return {
      value: {
        ...parsed,
        levels: levelsFromTo(minLevelOf(parsed.levels), maxLevelOf(parsed.levels)),
        answerType: 'raiseTo',
        chipPreset,
        chipDenoms:
          parsed.chipPreset === 'custom' ? [...JP_DENOMS] : parsed.chipDenoms,
      },
      notice: null,
      error: null,
    };
  } catch (error) {
    return { value: DEFAULT_SETTINGS, notice: 'corrupt', error };
  }
}

export function decodeSessions(raw: string | null): DecodeResult<SessionResult[]> {
  if (raw === null) {
    return { value: [], notice: null, error: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        value: [],
        notice: 'schema',
        error: new Error('sessions schema mismatch'),
      };
    }
    const sessions: SessionResult[] = [];
    for (const item of parsed) {
      const session = decodeSessionItem(item);
      if (session) sessions.push(session);
    }
    return { value: sessions, notice: null, error: null };
  } catch (error) {
    return { value: [], notice: 'corrupt', error };
  }
}

export function decodeMeta(raw: string | null): DecodeResult<PersistMeta> {
  if (raw === null) {
    return { value: DEFAULT_META, notice: null, error: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistMeta(parsed)) {
      return {
        value: DEFAULT_META,
        notice: 'schema',
        error: new Error('meta schema mismatch'),
      };
    }
    return {
      value: {
        schemaVersion: SCHEMA_VERSION,
        bestStreak: parsed.bestStreak,
        currentStreak: parsed.currentStreak,
      },
      notice: null,
      error: null,
    };
  } catch (error) {
    return { value: DEFAULT_META, notice: 'corrupt', error };
  }
}

export function noticeMessage(kind: PersistNoticeKind): string {
  return kind === 'corrupt' ? strings.persist.corrupt : strings.persist.schema;
}

export function readSettingsFromLocalStorage(): DecodeResult<Settings> {
  return decodeSettings(localStorage.getItem(SETTINGS_KEY));
}

export function writeSettingsToLocalStorage(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function readStatsFromLocalStorage(): DecodeResult<{
  sessions: SessionResult[];
  meta: PersistMeta;
}> {
  const sessions = decodeSessions(localStorage.getItem(SESSIONS_KEY));
  const meta = decodeMeta(localStorage.getItem(META_KEY));
  if (sessions.notice) {
    return { value: { sessions: [], meta: DEFAULT_META }, notice: sessions.notice, error: sessions.error };
  }
  if (meta.notice) {
    return { value: { sessions: [], meta: DEFAULT_META }, notice: meta.notice, error: meta.error };
  }
  return {
    value: { sessions: sessions.value, meta: meta.value },
    notice: null,
    error: null,
  };
}

export function writeStatsToLocalStorage(
  sessions: SessionResult[],
  meta: PersistMeta,
): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
