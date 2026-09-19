import { analyze, diagnose } from '../../domain/potLimit';
import { breakdown, totalOf } from '../../domain/chips';
import {
  findSimCuts,
  generateQuestion,
  pickWeightedLevel,
  replayLog,
  type GeneratorSettings,
  type LevelPerformance,
} from '../../domain/generator';
import { createRng } from '../../domain/generator/rng';
import type {
  Chips,
  ExplanationStep,
  Level,
  MistakeKind,
  Scenario,
} from '../../domain/types';
import { generateTripleValue, timesThree } from '../../domain/triple';
import type { QuizMode, Settings } from '../../store/schema';
import { JP_DENOMS } from '../../store/schema';

export interface ChipQuestion {
  kind: 'chips';
  id: string;
  seed: number;
  variant: 'breakdown' | 'total';
  denoms: Chips[];
  amount: Chips;
  parts: { denom: Chips; count: number }[];
  answer: Chips;
}

export interface MaxRaiseQuestion {
  kind: 'max-raise';
  id: string;
  seed: number;
  level: Level;
  scenario: Scenario;
  raiseTo: Chips;
  addChips: Chips;
  answer: Chips;
  steps: ExplanationStep[];
}

export interface SimQuestion {
  kind: 'sim';
  id: string;
  seed: number;
  level: Level;
  scenario: Scenario;
  interruptAt: number;
  raiseTo: Chips;
  addChips: Chips;
  answer: Chips;
  steps: ExplanationStep[];
}

export interface TripleQuestion {
  kind: 'triple';
  id: string;
  seed: number;
  value: number;
  answer: number;
}

export type DrillQuestion = ChipQuestion | MaxRaiseQuestion | SimQuestion | TripleQuestion;

function stakeFrom(settings: Settings) {
  return {
    sb: settings.sb,
    bb: settings.bb,
    ante: settings.ante,
    anteType: settings.anteType,
    unit: settings.unit > 0 ? settings.unit : 1,
  };
}

export function generatorSettingsFrom(settings: Settings): GeneratorSettings {
  return {
    stake: stakeFrom(settings),
    tableSize: 6,
    straddle: settings.straddle,
  };
}

export function eligibleLevels(settings: Settings): Level[] {
  const raw =
    settings.levels.length > 0 ? settings.levels : ([1, 2, 3] as Level[]);
  const filtered =
    settings.straddle === 'none' ? raw.filter((level) => level !== 3) : raw;
  return filtered.length > 0 ? filtered : ([1, 2] as Level[]);
}

function minDenomOf(denoms: Chips[]): Chips {
  let min = denoms[0] ?? 1;
  for (const denom of denoms) {
    if (denom > 0 && denom < min) min = denom;
  }
  return min > 0 ? min : 1;
}

function pickLevel(
  settings: Settings,
  seed: number,
  stats: readonly LevelPerformance[],
): Level {
  const rng = createRng(seed ^ 0x9e3779b9);
  return pickWeightedLevel(eligibleLevels(settings), stats, rng);
}

export function generateChipQuestion(settings: Settings, seed: number): ChipQuestion {
  const rng = createRng(seed);
  const denoms =
    settings.chipDenoms.length > 0 ? [...settings.chipDenoms] : [...JP_DENOMS];
  const variant: 'breakdown' | 'total' = rng.int(1, 2) === 1 ? 'breakdown' : 'total';
  if (variant === 'total') {
    const parts = denoms.map((denom) => ({
      denom,
      count: rng.int(0, 5),
    }));
    const first = parts[0];
    if (first && totalOf(parts) === 0) {
      first.count = rng.int(1, 4);
    }
    const visible = parts.filter((part) => part.count > 0);
    const amount = totalOf(visible);
    return {
      kind: 'chips',
      id: `chip-${seed}`,
      seed,
      variant,
      denoms,
      amount,
      parts: visible,
      answer: amount,
    };
  }
  const minDenom = minDenomOf(denoms);
  const amount = rng.int(1, 80) * minDenom;
  const broken = breakdown(amount, denoms);
  let count = 0;
  for (const part of broken) count += part.count;
  return {
    kind: 'chips',
    id: `chip-${seed}`,
    seed,
    variant,
    denoms,
    amount,
    parts: broken,
    answer: count,
  };
}

export function generateMaxRaiseQuestion(
  settings: Settings,
  seed: number,
  stats: readonly LevelPerformance[] = [],
  recentHashes: readonly string[] = [],
): MaxRaiseQuestion {
  const level = pickLevel(settings, seed, stats);
  const generated = generateQuestion(
    level,
    generatorSettingsFrom(settings),
    seed,
    recentHashes,
  );
  const result = analyze(generated.scenario);
  return {
    kind: 'max-raise',
    id: generated.id,
    seed,
    level,
    scenario: generated.scenario,
    raiseTo: result.maxRaiseTo,
    addChips: result.maxAddChips,
    answer: result.maxRaiseTo,
    steps: result.steps,
  };
}

export function generateSimQuestion(
  settings: Settings,
  seed: number,
  stats: readonly LevelPerformance[] = [],
  recentHashes: readonly string[] = [],
): SimQuestion {
  const rng = createRng(seed ^ 0x85ebca6b);
  for (let offset = 0; offset < 80; offset++) {
    const level = pickLevel(settings, seed + offset, stats);
    const generated = generateQuestion(
      level,
      generatorSettingsFrom(settings),
      seed + offset,
      recentHashes,
    );
    const cuts = findSimCuts(generated.scenario);
    if (cuts.length === 0) continue;
    const cut = rng.pick(cuts);
    const sliced = replayLog(generated.scenario, cut.interruptAt);
    const scenario: Scenario = {
      ...sliced,
      heroSeat: cut.heroSeat,
      seats: sliced.seats.map((seat) => ({
        ...seat,
        isHero: seat.id === cut.heroSeat,
      })),
    };
    const result = analyze(scenario);
    return {
      kind: 'sim',
      id: `sim-${generated.id}`,
      seed: generated.seed,
      level,
      scenario,
      interruptAt: cut.interruptAt,
      raiseTo: result.maxRaiseTo,
      addChips: result.maxAddChips,
      answer: result.maxRaiseTo,
      steps: result.steps,
    };
  }
  throw new Error(`failed to generate a sim question for seed ${seed}`);
}

export function generateTripleQuestion(seed: number): TripleQuestion {
  const value = generateTripleValue(seed);
  return {
    kind: 'triple',
    id: `triple-${seed}`,
    seed,
    value,
    answer: timesThree(value),
  };
}

export function generateDrill(
  mode: QuizMode,
  settings: Settings,
  seed: number,
  stats: readonly LevelPerformance[] = [],
  recentHashes: readonly string[] = [],
): DrillQuestion {
  if (mode === 'chips') return generateChipQuestion(settings, seed);
  if (mode === 'sim') return generateSimQuestion(settings, seed, stats, recentHashes);
  if (mode === 'triple') return generateTripleQuestion(seed);
  return generateMaxRaiseQuestion(settings, seed, stats, recentHashes);
}

export function parseQuizMode(raw: string | undefined): QuizMode | null {
  if (raw === 'chips' || raw === 'max-raise' || raw === 'sim' || raw === 'triple') {
    return raw;
  }
  return null;
}

export function mistakeOf(scenario: Scenario, raiseToInput: Chips): MistakeKind | null {
  return diagnose(scenario, raiseToInput);
}
