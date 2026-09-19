import { create } from 'zustand';
import { noticeMessage, type PersistNoticeKind } from './persist';

interface PersistNoticeState {
  message: string | null;
  notify: (kind: PersistNoticeKind, error: unknown) => void;
  dismiss: () => void;
}

export const usePersistNoticeStore = create<PersistNoticeState>((set, get) => ({
  message: null,
  notify: (kind, error) => {
    console.error(error);
    if (get().message !== null) return;
    set({ message: noticeMessage(kind) });
  },
  dismiss: () => set({ message: null }),
}));
