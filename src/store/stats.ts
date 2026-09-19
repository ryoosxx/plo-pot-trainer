import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_META,
  MAX_SUMMARIES,
  META_KEY,
  SESSIONS_KEY,
  SUMMARIES_KEY,
  type PersistMeta,
  type SessionResult,
  type SessionSummary,
} from './schema';
import {
  applyStreak,
  summarizeSession,
  summariesFromSessions,
  upsertSummary,
} from '../features/stats/aggregate';
import {
  decodeMeta,
  decodeSessions,
  decodeSummaries,
  writeStatsToLocalStorage,
} from './persist';
import { usePersistNoticeStore } from './notice';

const MAX_SESSIONS = 100;

interface StatsState {
  sessions: SessionResult[];
  summaries: SessionSummary[];
  meta: PersistMeta;
  addSession: (session: SessionResult) => void;
  resetStats: () => void;
}

function hydrateSummaries(
  stored: SessionSummary[],
  sessions: SessionResult[],
): SessionSummary[] {
  if (stored.length > 0) return stored;
  return summariesFromSessions(sessions).slice(0, MAX_SUMMARIES);
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      summaries: [],
      meta: DEFAULT_META,
      addSession: (session) => {
        const nextSessions = [session, ...get().sessions].slice(0, MAX_SESSIONS);
        const nextMeta = session.completed
          ? applyStreak(get().meta, session.records)
          : get().meta;
        let nextSummaries = get().summaries;
        if (session.completed && session.records.length > 0) {
          nextSummaries = upsertSummary(
            nextSummaries,
            summarizeSession(session),
            MAX_SUMMARIES,
          );
        }
        set({ sessions: nextSessions, summaries: nextSummaries, meta: nextMeta });
      },
      resetStats: () => set({ sessions: [], summaries: [], meta: DEFAULT_META }),
    }),
    {
      name: SESSIONS_KEY,
      version: 1,
      storage: {
        getItem: () => {
          const sessions = decodeSessions(localStorage.getItem(SESSIONS_KEY));
          const meta = decodeMeta(localStorage.getItem(META_KEY));
          const summaries = decodeSummaries(localStorage.getItem(SUMMARIES_KEY));
          const notice = sessions.notice ?? meta.notice ?? summaries.notice;
          const error = sessions.error ?? meta.error ?? summaries.error;
          if (notice) {
            usePersistNoticeStore.getState().notify(notice, error);
          }
          const nextSummaries = hydrateSummaries(summaries.value, sessions.value);
          if (sessions.notice !== 'corrupt' && meta.notice !== 'corrupt') {
            writeStatsToLocalStorage(sessions.value, meta.value, nextSummaries);
          }
          return {
            state: {
              sessions: sessions.value,
              summaries: nextSummaries,
              meta: meta.value,
            },
            version: 1,
          };
        },
        setItem: (_name, value) => {
          writeStatsToLocalStorage(
            value.state.sessions,
            value.state.meta,
            value.state.summaries,
          );
        },
        removeItem: () => {
          localStorage.removeItem(SESSIONS_KEY);
          localStorage.removeItem(META_KEY);
          localStorage.removeItem(SUMMARIES_KEY);
        },
      },
      partialize: (state) => ({
        sessions: state.sessions,
        summaries: state.summaries,
        meta: state.meta,
      }),
    },
  ),
);
