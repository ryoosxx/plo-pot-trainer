import { DEFAULT_META, DEFAULT_SETTINGS, SESSIONS_KEY, SETTINGS_KEY } from './schema';
import { useSettingsStore } from './settings';
import { useStatsStore } from './stats';
import { usePersistNoticeStore } from './notice';
import type { SessionResult } from './schema';

describe('settings store persist', () => {
  beforeEach(() => {
    localStorage.clear();
    usePersistNoticeStore.setState({ message: null });
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  });

  it('レート変更が plo-trainer:settings:v1 に保存される', () => {
    useSettingsStore.getState().setRatePreset('100/200');
    const raw = localStorage.getItem(SETTINGS_KEY);
    expect(raw).toBeTruthy();
    const parsed: unknown = JSON.parse(raw ?? '');
    expect(parsed).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        ratePreset: '100/200',
        sb: 100,
        bb: 200,
      }),
    );
  });
});

describe('stats store persist', () => {
  beforeEach(() => {
    localStorage.clear();
    usePersistNoticeStore.setState({ message: null });
    useStatsStore.setState({ sessions: [], meta: DEFAULT_META });
  });

  it('直近 100 件まで保存し、完了セッションだけストリークを更新する', () => {
    const base = (id: string, completed: boolean, correct: boolean): SessionResult => ({
      id,
      mode: 'max-raise',
      startedAt: '2026-09-08T00:00:00.000Z',
      endedAt: '2026-09-08T00:01:00.000Z',
      completed,
      settingsSnapshot: DEFAULT_SETTINGS,
      records: [
        {
          questionId: id,
          seed: 1,
          level: 1,
          mode: 'max-raise',
          answer: 7,
          input: correct ? 7 : 1,
          correct,
          elapsedMs: 1000,
          timedOut: false,
          mistake: null,
          at: '2026-09-08T00:00:30.000Z',
        },
      ],
    });

    useStatsStore.getState().addSession(base('skip', false, true));
    expect(useStatsStore.getState().meta.currentStreak).toBe(0);

    useStatsStore.getState().addSession(base('ok', true, true));
    expect(useStatsStore.getState().meta.currentStreak).toBe(1);

    for (let i = 0; i < 101; i++) {
      useStatsStore.getState().addSession(base(`s${i}`, true, true));
    }
    expect(useStatsStore.getState().sessions).toHaveLength(100);
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed: unknown = JSON.parse(raw ?? '[]');
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as unknown[]).length).toBe(100);
  });

  it('resetStats で空になる', () => {
    useStatsStore.getState().addSession({
      id: 'x',
      mode: 'max-raise',
      startedAt: '2026-09-08T00:00:00.000Z',
      endedAt: '2026-09-08T00:01:00.000Z',
      completed: true,
      settingsSnapshot: DEFAULT_SETTINGS,
      records: [],
    });
    useStatsStore.getState().resetStats();
    expect(useStatsStore.getState().sessions).toEqual([]);
    expect(useStatsStore.getState().meta).toEqual(DEFAULT_META);
  });
});
