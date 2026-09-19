import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnteType, Level } from '../domain/types';
import {
  DEFAULT_SETTINGS,
  JP_DENOMS,
  RATE_PRESETS,
  SETTINGS_KEY,
  US_DENOMS,
  levelsFromTo,
  unitOf,
  type ChipPreset,
  type QuestionCount,
  type RatePreset,
  type Settings,
  type StraddleMode,
  type TimeLimitSec,
} from './schema';
import {
  decodeSettings,
  writeSettingsToLocalStorage,
  type PersistNoticeKind,
} from './persist';
import { usePersistNoticeStore } from './notice';

interface SettingsState extends Settings {
  patch: (partial: Partial<Settings>) => void;
  setRatePreset: (preset: RatePreset) => void;
  setCustomRate: (sb: number, bb: number) => void;
  setAnteType: (anteType: AnteType) => void;
  setAnte: (ante: number) => void;
  setStraddle: (straddle: StraddleMode) => void;
  setLevelRange: (min: Level, max: Level) => void;
  setQuestionCount: (questionCount: QuestionCount) => void;
  setTimeLimitSec: (timeLimitSec: TimeLimitSec) => void;
  setChipPreset: (chipPreset: Exclude<ChipPreset, 'custom'>) => void;
  setSound: (sound: boolean) => void;
  setVibe: (vibe: boolean) => void;
}

function applyDecodeNotice(notice: PersistNoticeKind | null, error: unknown): void {
  if (notice) usePersistNoticeStore.getState().notify(notice, error);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      patch: (partial) => set(partial),
      setRatePreset: (preset) => {
        if (preset === 'custom') {
          set({ ratePreset: 'custom' });
          return;
        }
        const found = RATE_PRESETS.find((item) => item.id === preset);
        if (!found) return;
        set({
          ratePreset: preset,
          sb: found.sb,
          bb: found.bb,
          unit: unitOf(found.sb, found.bb),
        });
      },
      setCustomRate: (sb, bb) => {
        if (sb <= 0 || bb <= 0) return;
        set({
          ratePreset: 'custom',
          sb,
          bb,
          unit: unitOf(sb, bb),
        });
      },
      setAnteType: (anteType) => {
        if (anteType === 'none') {
          set({ anteType, ante: 0 });
          return;
        }
        const ante = anteType === 'bb' ? get().bb : get().unit;
        set({ anteType, ante });
      },
      setAnte: (ante) => set({ ante }),
      setStraddle: (straddle) => set({ straddle }),
      setLevelRange: (min, max) => {
        const next = levelsFromTo(min, max);
        const current = get().levels;
        if (
          current.length === next.length &&
          current.every((level, index) => level === next[index])
        ) {
          return;
        }
        set({ levels: next });
      },
      setQuestionCount: (questionCount) => set({ questionCount }),
      setTimeLimitSec: (timeLimitSec) => set({ timeLimitSec }),
      setChipPreset: (chipPreset) => {
        if (chipPreset === 'us') {
          set({ chipPreset, chipDenoms: [...US_DENOMS] });
          return;
        }
        set({ chipPreset: 'jp', chipDenoms: [...JP_DENOMS] });
      },
      setSound: (sound) => set({ sound }),
      setVibe: (vibe) => set({ vibe }),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: {
        getItem: () => {
          const decoded = decodeSettings(localStorage.getItem(SETTINGS_KEY));
          applyDecodeNotice(decoded.notice, decoded.error);
          if (decoded.notice) {
            writeSettingsToLocalStorage(decoded.value);
          }
          return { state: decoded.value, version: 1 };
        },
        setItem: (_name, value) => {
          writeSettingsToLocalStorage(value.state);
        },
        removeItem: () => {
          localStorage.removeItem(SETTINGS_KEY);
        },
      },
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        ratePreset: state.ratePreset,
        sb: state.sb,
        bb: state.bb,
        unit: state.unit,
        anteType: state.anteType,
        ante: state.ante,
        straddle: state.straddle,
        levels: state.levels,
        questionCount: state.questionCount,
        answerType: 'raiseTo' as const,
        timeLimitSec: state.timeLimitSec,
        chipPreset: state.chipPreset === 'us' ? ('us' as const) : ('jp' as const),
        chipDenoms: state.chipDenoms,
        sound: state.sound,
        vibe: state.vibe,
      }),
    },
  ),
);
