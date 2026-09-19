import type { Level } from '../../domain/types';
import { localDateKey, todayKey } from '../../lib/format';
import type { PersistMeta, SessionResult, SessionSummary } from '../../store/schema';

export interface LevelStat {
  level: Level;
  total: number;
  correct: number;
  accuracy: number | null;
  averageMs: number | null;
}

export interface DayStat {
  date: string;
  total: number;
  correct: number;
}

export interface WeakCategory {
  level: Level;
  accuracy: number;
  averageMs: number;
  total: number;
}

export interface StatsSummary {
  totalQuestions: number;
  correctCount: number;
  accuracy: number | null;
  averageMs: number | null;
  byLevel: LevelStat[];
  last14Days: DayStat[];
  bestStreak: number;
  currentStreak: number;
  weakTop3: WeakCategory[];
  todayTotal: number;
  todayCorrect: number;
}

const LEVELS: Level[] = [1, 2, 3, 4, 5, 6];

function dateKey(d: Date): string {
  return localDateKey(d);
}

function addDays(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
}

/**
 * 完了セッションだけを集計する。中断セッションは除外。
 */
export function aggregateSessions(
  sessions: SessionResult[],
  meta: PersistMeta,
  now: Date,
): StatsSummary {
  const completed = sessions.filter((session) => session.completed);
  let totalQuestions = 0;
  let correctCount = 0;
  let timeSum = 0;
  const levelTotals = new Map<Level, { total: number; correct: number; time: number }>();
  for (const level of LEVELS) {
    levelTotals.set(level, { total: 0, correct: 0, time: 0 });
  }

  const dayMap = new Map<string, { total: number; correct: number }>();
  const today = dateKey(now);
  let todayTotal = 0;
  let todayCorrect = 0;

  for (const session of completed) {
    for (const record of session.records) {
      totalQuestions += 1;
      timeSum += record.elapsedMs;
      if (record.correct) correctCount += 1;
      const bucket = levelTotals.get(record.level);
      if (bucket) {
        bucket.total += 1;
        bucket.time += record.elapsedMs;
        if (record.correct) bucket.correct += 1;
      }
      const day = todayKey(record.at);
      const dayBucket = dayMap.get(day) ?? { total: 0, correct: 0 };
      dayBucket.total += 1;
      if (record.correct) dayBucket.correct += 1;
      dayMap.set(day, dayBucket);
      if (day === today) {
        todayTotal += 1;
        if (record.correct) todayCorrect += 1;
      }
    }
  }

  const byLevel: LevelStat[] = LEVELS.map((level) => {
    const bucket = levelTotals.get(level) ?? { total: 0, correct: 0, time: 0 };
    return {
      level,
      total: bucket.total,
      correct: bucket.correct,
      accuracy: bucket.total === 0 ? null : bucket.correct / bucket.total,
      averageMs: bucket.total === 0 ? null : bucket.time / bucket.total,
    };
  });

  const last14Days: DayStat[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dateKey(addDays(now, -i));
    const bucket = dayMap.get(key) ?? { total: 0, correct: 0 };
    last14Days.push({ date: key, total: bucket.total, correct: bucket.correct });
  }

  const weakTop3 = byLevel
    .filter((row) => row.total > 0 && row.accuracy !== null && row.averageMs !== null)
    .map((row) => ({
      level: row.level,
      accuracy: row.accuracy ?? 0,
      averageMs: row.averageMs ?? 0,
      total: row.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.averageMs - a.averageMs)
    .slice(0, 3);

  return {
    totalQuestions,
    correctCount,
    accuracy: totalQuestions === 0 ? null : correctCount / totalQuestions,
    averageMs: totalQuestions === 0 ? null : timeSum / totalQuestions,
    byLevel,
    last14Days,
    bestStreak: meta.bestStreak,
    currentStreak: meta.currentStreak,
    weakTop3,
    todayTotal,
    todayCorrect,
  };
}

export function applyStreak(
  meta: PersistMeta,
  records: { correct: boolean }[],
): PersistMeta {
  let current = meta.currentStreak;
  let best = meta.bestStreak;
  for (const record of records) {
    if (record.correct) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return { ...meta, currentStreak: current, bestStreak: best };
}

export function summarizeSession(session: SessionResult): SessionSummary {
  let correct = 0;
  let time = 0;
  for (const record of session.records) {
    if (record.correct) correct += 1;
    time += record.elapsedMs;
  }
  const total = session.records.length;
  return {
    id: session.id,
    endedAt: session.endedAt,
    mode: session.mode,
    total,
    correct,
    averageMs: total === 0 ? 0 : time / total,
  };
}

export function summariesFromSessions(
  sessions: readonly SessionResult[],
): SessionSummary[] {
  const out: SessionSummary[] = [];
  const seen = new Set<string>();
  for (const session of sessions) {
    if (!session.completed || session.records.length === 0) continue;
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    out.push(summarizeSession(session));
  }
  return out;
}

export function upsertSummary(
  list: readonly SessionSummary[],
  next: SessionSummary,
  max: number,
): SessionSummary[] {
  const without = list.filter((item) => item.id !== next.id);
  return [next, ...without].slice(0, max);
}

export function totalsFromSummaries(summaries: readonly SessionSummary[]): {
  totalQuestions: number;
  correctCount: number;
  accuracy: number | null;
  averageMs: number | null;
} {
  let totalQuestions = 0;
  let correctCount = 0;
  let timeSum = 0;
  for (const item of summaries) {
    totalQuestions += item.total;
    correctCount += item.correct;
    timeSum += item.averageMs * item.total;
  }
  return {
    totalQuestions,
    correctCount,
    accuracy: totalQuestions === 0 ? null : correctCount / totalQuestions,
    averageMs: totalQuestions === 0 ? null : timeSum / totalQuestions,
  };
}
