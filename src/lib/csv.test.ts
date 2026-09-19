import { DEFAULT_SETTINGS, type SessionResult } from '../store/schema';
import { sessionsToCsv } from './csv';

describe('sessionsToCsv', () => {
  it('ヘッダとレコードを出す', () => {
    const sessions: SessionResult[] = [
      {
        id: 'sess-1',
        mode: 'max-raise',
        startedAt: '2026-09-08T00:00:00.000Z',
        endedAt: '2026-09-08T00:01:00.000Z',
        completed: true,
        settingsSnapshot: DEFAULT_SETTINGS,
        records: [
          {
            questionId: 'q1',
            seed: 1,
            level: 2,
            mode: 'max-raise',
            answer: 29,
            input: 27,
            correct: false,
            elapsedMs: 4000,
            timedOut: false,
            mistake: 'forgot_own_investment',
            at: '2026-09-08T00:00:30.000Z',
          },
        ],
      },
    ];
    const csv = sessionsToCsv(sessions);
    expect(csv.startsWith('sessionId,completed,mode,')).toBe(true);
    expect(csv).toContain('sess-1,1,max-raise,q1,1,2,29,27,0,4000,0,forgot_own_investment,');
  });
});
