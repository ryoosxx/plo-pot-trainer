import { analyze } from '../potLimit';
import type { Level, SeatId } from '../types';
import {
  createRng,
  DEFAULT_GENERATOR_SETTINGS,
  generateQuestion,
  validateScenario,
} from './index';
import type { GeneratorSettings, Question } from './index';

const SAMPLE = 10_000;
const SETTINGS: GeneratorSettings = {
  ...DEFAULT_GENERATOR_SETTINGS,
  tableSize: 6,
};

const SAMPLE_TIMEOUT_MS = 60_000;

function voluntaryCount(question: Question): number {
  return question.scenario.actionLog.filter(
    (entry) =>
      entry.type === 'fold' || entry.type === 'call' || entry.type === 'raise',
  ).length;
}

function collect(level: Level): Question[] {
  const questions: Question[] = [];
  for (let seed = 1; seed <= SAMPLE; seed++) {
    questions.push(generateQuestion(level, SETTINGS, seed));
  }
  return questions;
}

describe('rng', () => {
  it('同じ seed は同じ数列を返す', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.int(0, 99), a.int(0, 99), a.pick(['x', 'y', 'z'] as const)];
    const seqB = [b.int(0, 99), b.int(0, 99), b.pick(['x', 'y', 'z'] as const)];
    expect(seqA).toEqual(seqB);
  });

  it('seed が違えば列が変わる', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect([a.nextUint32(), a.nextUint32()]).not.toEqual([
      b.nextUint32(),
      b.nextUint32(),
    ]);
  });
});

describe('validateScenario', () => {
  it('生成された合法局面は true', () => {
    const question = generateQuestion(1, SETTINGS, 7);
    expect(validateScenario(question.scenario)).toBe(true);
  });

  it('負のポットは false', () => {
    const question = generateQuestion(1, SETTINGS, 7);
    expect(
      validateScenario({ ...question.scenario, potBefore: -1 }),
    ).toBe(false);
  });
});

describe.each([1, 2, 3, 4, 5, 6] as const)('generateQuestion Lv%i', (level) => {
  it(
    `${SAMPLE} 問すべて validateScenario が true で、answer は analyze() と一致する`,
    () => {
      const questions = collect(level);
      expect(questions).toHaveLength(SAMPLE);

      for (const question of questions) {
        expect(question.level).toBe(level);
        expect(validateScenario(question.scenario)).toBe(true);
        expect(question.answer).toBe(analyze(question.scenario).maxRaiseTo);
      }
    },
    SAMPLE_TIMEOUT_MS,
  );

  it('同じ seed で同じ問題が再現される', () => {
    const seed = 12345;
    const a = generateQuestion(level, SETTINGS, seed);
    const b = generateQuestion(level, SETTINGS, seed);
    expect(a).toEqual(b);
  });
});

describe('レベル制約', () => {
  it('Lv1: ヒーロー未投入・プリフロップ・未レイズ', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(1, SETTINGS, seed);
      const result = analyze(scenario);
      expect(scenario.street).toBe('preflop');
      expect(result.heroInvested).toBe(0);
      expect(['SB', 'BB', 'STR']).not.toContain(scenario.heroSeat);
      expect(result.currentBet).toBe(SETTINGS.stake.bb);
    }
  });

  it('Lv2: ヒーローは SB または BB', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(2, SETTINGS, seed);
      const result = analyze(scenario);
      expect(scenario.heroSeat === 'SB' || scenario.heroSeat === 'BB').toBe(
        true,
      );
      expect(result.heroInvested).toBeGreaterThan(0);
    }
  });

  it('Lv3: ストラドルがある', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(3, SETTINGS, seed);
      expect(
        scenario.actionLog.some((entry) => entry.type === 'straddle'),
      ).toBe(true);
    }
  });

  it('Lv4: プリフロップで 3bet/4bet（レイズ 2 回以上・ヒーロー投入あり）', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(4, SETTINGS, seed);
      const result = analyze(scenario);
      const raises = scenario.actionLog.filter(
        (entry) => entry.type === 'raise',
      ).length;
      expect(scenario.street).toBe('preflop');
      expect(raises).toBeGreaterThanOrEqual(2);
      expect(result.heroInvested).toBeGreaterThan(0);
    }
  });

  it('Lv5: フロップ以降', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(5, SETTINGS, seed);
      expect(scenario.street).not.toBe('preflop');
    }
  });

  it('Lv6: アンティ・大きいレート・all-in のいずれか', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { scenario } = generateQuestion(6, SETTINGS, seed);
      const result = analyze(scenario);
      expect(
        result.isAllIn ||
          scenario.potBefore > 0 ||
          scenario.stake.bb >= 100,
      ).toBe(true);
    }
  });
});

describe('バリエーション', () => {
  it(
    'Lv1 のヒーロー席とアクション数が偏りすぎない',
    () => {
      const questions = collect(1);
      const heroCounts = new Map<SeatId, number>();
      const actionCounts = new Map<number, number>();
      const sizes = new Set<number>();
      for (const question of questions) {
        const hero = question.scenario.heroSeat;
        heroCounts.set(hero, (heroCounts.get(hero) ?? 0) + 1);
        const n = voluntaryCount(question);
        actionCounts.set(n, (actionCounts.get(n) ?? 0) + 1);
        sizes.add(question.scenario.seats.length);
      }

      expect(heroCounts.size).toBeGreaterThanOrEqual(3);
      for (const count of heroCounts.values()) {
        expect(count / SAMPLE).toBeGreaterThan(0.04);
      }
      expect(sizes.has(6)).toBe(true);
      expect(sizes.has(9)).toBe(true);
      expect(actionCounts.size).toBeGreaterThanOrEqual(3);
      const maxActionShare = Math.max(...actionCounts.values()) / SAMPLE;
      expect(maxActionShare).toBeLessThan(0.7);
    },
    SAMPLE_TIMEOUT_MS,
  );

  it(
    'Lv2 のヒーロー席とレイズ有無が偏りすぎない',
    () => {
      let sb = 0;
      let bb = 0;
      let raised = 0;
      for (const question of collect(2)) {
        if (question.scenario.heroSeat === 'SB') sb += 1;
        if (question.scenario.heroSeat === 'BB') bb += 1;
        if (analyze(question.scenario).currentBet > SETTINGS.stake.bb) {
          raised += 1;
        }
      }
      expect(sb / SAMPLE).toBeGreaterThan(0.2);
      expect(bb / SAMPLE).toBeGreaterThan(0.2);
      expect(raised / SAMPLE).toBeGreaterThan(0.1);
      expect(raised / SAMPLE).toBeLessThan(0.9);
    },
    SAMPLE_TIMEOUT_MS,
  );

  it(
    'Lv3 のヒーロー席とシングル／ダブルが偏りすぎない',
    () => {
      const heroCounts = new Map<SeatId, number>();
      let single = 0;
      let double = 0;
      const actionCounts = new Map<number, number>();
      for (const question of collect(3)) {
        const hero = question.scenario.heroSeat;
        heroCounts.set(hero, (heroCounts.get(hero) ?? 0) + 1);
        const straddles = question.scenario.actionLog.filter(
          (entry) => entry.type === 'straddle',
        ).length;
        if (straddles >= 2) double += 1;
        else single += 1;
        const n = voluntaryCount(question);
        actionCounts.set(n, (actionCounts.get(n) ?? 0) + 1);
      }

      expect(heroCounts.size).toBeGreaterThanOrEqual(4);
      for (const count of heroCounts.values()) {
        expect(count / SAMPLE).toBeGreaterThan(0.05);
      }
      expect(single / SAMPLE).toBeGreaterThan(0.2);
      expect(double / SAMPLE).toBeGreaterThan(0.2);
      expect(actionCounts.size).toBeGreaterThanOrEqual(2);
      expect(Math.max(...actionCounts.values()) / SAMPLE).toBeLessThan(0.7);
    },
    SAMPLE_TIMEOUT_MS,
  );

  it(
    'Lv4〜6 のヒーロー席が偏りすぎない',
    () => {
      for (const level of [4, 5, 6] as const) {
        const heroCounts = new Map<SeatId, number>();
        for (let seed = 1; seed <= 400; seed++) {
          const hero = generateQuestion(level, SETTINGS, seed).scenario.heroSeat;
          heroCounts.set(hero, (heroCounts.get(hero) ?? 0) + 1);
        }
        expect(heroCounts.size).toBeGreaterThanOrEqual(2);
        expect(Math.max(...heroCounts.values()) / 400).toBeLessThan(0.85);
      }
    },
    SAMPLE_TIMEOUT_MS,
  );
});

describe('P1-3 アクション列', () => {
  it('フォールド済みの席は以後アクションしない', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      for (let seed = 1; seed <= 80; seed++) {
        const { scenario } = generateQuestion(level, SETTINGS, seed);
        const folded = new Set<SeatId>();
        for (const entry of scenario.actionLog) {
          if (
            folded.has(entry.seat) &&
            (entry.type === 'fold' ||
              entry.type === 'check' ||
              entry.type === 'call' ||
              entry.type === 'bet' ||
              entry.type === 'raise')
          ) {
            throw new Error(`${level}:${seed} ${entry.seat} acted after fold`);
          }
          if (entry.type === 'fold') folded.add(entry.seat);
        }
      }
    }
  });
});

describe('P1-4 設定反映', () => {
  it('straddle none では Lv3 を生成できない', () => {
    expect(() =>
      generateQuestion(3, { ...SETTINGS, straddle: 'none' }, 1),
    ).toThrow();
  });

  it('straddle single ではダブルストラドルを出さない', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { scenario } = generateQuestion(3, { ...SETTINGS, straddle: 'single' }, seed);
      const n = scenario.actionLog.filter((entry) => entry.type === 'straddle').length;
      expect(n).toBe(1);
    }
  });

  it('アンティ設定は Lv1〜5 の potBefore と履歴に入る', () => {
    const withAnte: GeneratorSettings = {
      ...SETTINGS,
      stake: { ...SETTINGS.stake, anteType: 'all', ante: 1 },
    };
    for (const level of [1, 2, 3, 4, 5] as const) {
      const { scenario } = generateQuestion(level, withAnte, 11);
      expect(scenario.potBefore).toBeGreaterThanOrEqual(scenario.seats.length);
      if (scenario.street === 'preflop') {
        expect(scenario.actionLog.some((entry) => entry.type === 'ante')).toBe(true);
      }
    }
  });
});
