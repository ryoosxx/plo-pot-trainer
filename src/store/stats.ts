import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_META,
  META_KEY,
  SESSIONS_KEY,
  type PersistMeta,
  type SessionResult,
} from './schema';
import { applyStreak } from '../features/stats/aggregate';
import {
  decodeMeta,
  decodeSessions,
  writeStatsToLocalStorage,
} from './persist';
import { usePersistNoticeStore } from './notice';

const MAX_SESSIONS = 100;

interface StatsState {
  sessions: SessionResult[];
  meta: PersistMeta;
  addSession: (session: SessionResult) => void;
  resetStats: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      meta: DEFAULT_META,
      addSession: (session) => {
        const nextSessions = [session, ...get().sessions].slice(0, MAX_SESSIONS);
        const nextMeta = session.completed
          ? applyStreak(get().meta, session.records)
          : get().meta;
        set({ sessions: nextSessions, meta: nextMeta });
      },
      resetStats: () => set({ sessions: [], meta: DEFAULT_META }),
    }),
    {
      name: SESSIONS_KEY,
      version: 1,
      storage: {
        getItem: () => {
          const sessions = decodeSessions(localStorage.getItem(SESSIONS_KEY));
          const meta = decodeMeta(localStorage.getItem(META_KEY));
          const notice = sessions.notice ?? meta.notice;
          const error = sessions.error ?? meta.error;
          if (notice) {
            usePersistNoticeStore.getState().notify(notice, error);
            writeStatsToLocalStorage([], DEFAULT_META);
            return {
              state: { sessions: [], meta: DEFAULT_META },
              version: 1,
            };
          }
          return {
            state: { sessions: sessions.value, meta: meta.value },
            version: 1,
          };
        },
        setItem: (_name, value) => {
          writeStatsToLocalStorage(value.state.sessions, value.state.meta);
        },
        removeItem: () => {
          localStorage.removeItem(SESSIONS_KEY);
          localStorage.removeItem(META_KEY);
        },
      },
      partialize: (state) => ({
        sessions: state.sessions,
        meta: state.meta,
      }),
    },
  ),
);
