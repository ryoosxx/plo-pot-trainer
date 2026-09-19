import { DEFAULT_META, DEFAULT_SETTINGS, type SessionResult } from '../../store/schema';
import { aggregateSessions, applyStreak } from './aggregate';

function session(
  partial: Partial<SessionResult> & Pick<SessionResult, 'id' | 'completed' | 'records'>,
): SessionResult {
  return {
    mode: 'max-raise',
    startedAt: '2026-09-01T00:00:00.000Z',
    endedAt: '2026-09-01T00:10:00.000Z',
    settingsSnapshot: DEFAULT_SETTINGS,
    ...partial,
  };
}

describe('aggregateSessions', () => {
  it('中断セッションは集計しない', () => {
    const summary = aggregateSessions(
      [
        session({
          id: 'a',
          completed: false,
          records: [
            {
              questionId: 'q1',
              seed: 1,
              level: 1,
              mode: 'max-raise',
              answer: 7,
              input: 7,
              correct: true,
              elapsedMs: 1000,
              timedOut: false,
              mistake: null,
              at: '2026-09-08T01:00:00.000Z',
            },
          ],
        }),
      ],
      DEFAULT_META,
      new Date('2026-09-08T12:00:00.000Z'),
    );
    expect(summary.totalQuestions).toBe(0);
  });

  it('正答率・レベル別・直近14日・苦手を集計する', () => {
    const summary = aggregateSessions(
      [
        session({
          id: 'b',
          completed: true,
          records: [
            {
              questionId: 'q1',
              seed: 1,
              level: 1,
              mode: 'max-raise',
              answer: 7,
              input: 7,
              correct: true,
              elapsedMs: 2000,
              timedOut: false,
              mistake: null,
              at: '2026-09-08T01:00:00.000Z',
            },
            {
              questionId: 'q2',
              seed: 2,
              level: 2,
              mode: 'max-raise',
              answer: 22,
              input: 20,
              correct: false,
              elapsedMs: 4000,
              timedOut: false,
              mistake: 'forgot_own_investment',
              at: '2026-09-08T01:01:00.000Z',
            },
            {
              questionId: 'q3',
              seed: 3,
              level: 2,
              mode: 'max-raise',
              answer: 14,
              input: 10,
              correct: false,
              elapsedMs: 6000,
              timedOut: false,
              mistake: 'unknown',
              at: '2026-09-07T01:00:00.000Z',
            },
          ],
        }),
      ],
      { schemaVersion: 1, bestStreak: 4, currentStreak: 0 },
      new Date('2026-09-08T12:00:00.000Z'),
    );

    expect(summary.totalQuestions).toBe(3);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracy).toBeCloseTo(1 / 3);
    expect(summary.todayTotal).toBe(2);
    expect(summary.todayCorrect).toBe(1);
    expect(summary.bestStreak).toBe(4);
    const lv2 = summary.byLevel.find((row) => row.level === 2);
    expect(lv2?.total).toBe(2);
    expect(lv2?.correct).toBe(0);
    expect(summary.weakTop3[0]?.level).toBe(2);
    expect(summary.last14Days).toHaveLength(14);
    expect(summary.last14Days[13]?.date).toBe('2026-09-08');
  });
});

describe('applyStreak', () => {
  it('連続正解を更新し、不正解でリセットする', () => {
    const after = applyStreak(
      { schemaVersion: 1, bestStreak: 1, currentStreak: 1 },
      [{ correct: true }, { correct: true }, { correct: false }, { correct: true }],
    );
    expect(after.currentStreak).toBe(1);
    expect(after.bestStreak).toBe(3);
  });
});
