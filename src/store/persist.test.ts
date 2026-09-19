import { DEFAULT_SETTINGS, SETTINGS_KEY } from './schema';
import {
  decodeMeta,
  decodeSessions,
  decodeSettings,
  decodeSummaries,
  noticeMessage,
  readSettingsFromLocalStorage,
} from './persist';
import { usePersistNoticeStore } from './notice';

describe('persist decode', () => {
  it('null は既定値で通知なし', () => {
    const result = decodeSettings(null);
    expect(result.value).toEqual(DEFAULT_SETTINGS);
    expect(result.notice).toBeNull();
    expect(result.error).toBeNull();
  });

  it('壊れた JSON は初期化して corrupt を返す（例外を保持）', () => {
    const result = decodeSettings('{not json');
    expect(result.value).toEqual(DEFAULT_SETTINGS);
    expect(result.notice).toBe('corrupt');
    expect(result.error).toBeInstanceOf(SyntaxError);
  });

  it('schemaVersion 不一致は schema 通知', () => {
    const result = decodeSettings(
      JSON.stringify({ ...DEFAULT_SETTINGS, schemaVersion: 99 }),
    );
    expect(result.notice).toBe('schema');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.value).toEqual(DEFAULT_SETTINGS);
  });

  it('正常な Settings はそのまま返す', () => {
    const raw = JSON.stringify({ ...DEFAULT_SETTINGS, bb: 5, sb: 2, ratePreset: '2/5' });
    const result = decodeSettings(raw);
    expect(result.notice).toBeNull();
    expect(result.value.bb).toBe(5);
    expect(result.value.sb).toBe(2);
  });

  it('古い回答形式・カスタム額面・飛びレベルを現行形式へ寄せる', () => {
    const raw = JSON.stringify({
      ...DEFAULT_SETTINGS,
      answerType: 'addChips',
      chipPreset: 'custom',
      chipDenoms: [7, 11],
      levels: [1, 3, 5],
    });
    const result = decodeSettings(raw);
    expect(result.notice).toBeNull();
    expect(result.value.answerType).toBe('raiseTo');
    expect(result.value.chipPreset).toBe('jp');
    expect(result.value.chipDenoms).toEqual([100, 500, 1000, 5000, 10000]);
    expect(result.value.levels).toEqual([1, 2, 3, 4, 5]);
  });

  it('下限付きレベル範囲はそのまま連番に直す', () => {
    const raw = JSON.stringify({
      ...DEFAULT_SETTINGS,
      levels: [4, 6],
    });
    const result = decodeSettings(raw);
    expect(result.notice).toBeNull();
    expect(result.value.levels).toEqual([4, 5, 6]);
  });

  it('sessions の配列でない JSON は schema', () => {
    const result = decodeSessions('{"no":"array"}');
    expect(result.notice).toBe('schema');
    expect(result.value).toEqual([]);
  });

  it('sessions の壊れた JSON は corrupt', () => {
    const result = decodeSessions('[');
    expect(result.notice).toBe('corrupt');
    expect(result.error).toBeInstanceOf(SyntaxError);
  });

  it('古い settingsSnapshot でもセッションを残す', () => {
    const result = decodeSessions(
      JSON.stringify([
        {
          id: 'keep',
          mode: 'max-raise',
          startedAt: '2026-09-08T00:00:00.000Z',
          endedAt: '2026-09-08T00:01:00.000Z',
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
              elapsedMs: 1000,
              timedOut: false,
              mistake: null,
              at: '2026-09-08T00:00:30.000Z',
            },
          ],
          settingsSnapshot: {
            ...DEFAULT_SETTINGS,
            schemaVersion: 99,
            answerType: 'addChips',
            levels: [1, 3],
          },
        },
        { broken: true },
      ]),
    );
    expect(result.notice).toBeNull();
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe('keep');
    expect(result.value[0]?.records).toHaveLength(1);
    expect(result.value[0]?.settingsSnapshot.schemaVersion).toBe(1);
    expect(result.value[0]?.settingsSnapshot.answerType).toBe('raiseTo');
    expect(result.value[0]?.settingsSnapshot.levels).toEqual([1, 2, 3]);
  });

  it('meta の schemaVersion が古くてもストリークを残す', () => {
    const result = decodeMeta(
      JSON.stringify({ schemaVersion: 2, bestStreak: 8, currentStreak: 3 }),
    );
    expect(result.notice).toBeNull();
    expect(result.value).toEqual({
      schemaVersion: 1,
      bestStreak: 8,
      currentStreak: 3,
    });
  });

  it('壊れたサマリー1件は捨てて残りは残す', () => {
    const result = decodeSummaries(
      JSON.stringify([
        {
          id: 'keep',
          endedAt: '2026-09-08T00:01:00.000Z',
          mode: 'max-raise',
          total: 10,
          correct: 8,
          averageMs: 1500,
        },
        { id: 'bad' },
      ]),
    );
    expect(result.notice).toBeNull();
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe('keep');
    expect(result.value[0]?.correct).toBe(8);
  });

  it('localStorage の破損は初期化理由を返す', () => {
    localStorage.setItem(SETTINGS_KEY, '{bad');
    const result = readSettingsFromLocalStorage();
    expect(result.notice).toBe('corrupt');
    expect(result.value).toEqual(DEFAULT_SETTINGS);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('persist notice', () => {
  beforeEach(() => {
    usePersistNoticeStore.setState({ message: null });
  });

  it('通知は 1 回だけ出す', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = usePersistNoticeStore.getState();
    store.notify('corrupt', new Error('first'));
    store.notify('schema', new Error('second'));
    expect(usePersistNoticeStore.getState().message).toBe(noticeMessage('corrupt'));
    expect(spy).toHaveBeenCalled();
    store.dismiss();
    expect(usePersistNoticeStore.getState().message).toBeNull();
    spy.mockRestore();
  });
});
