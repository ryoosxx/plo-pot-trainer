import { analyze } from '../../domain/potLimit';
import { breakdown, totalOf } from '../../domain/chips';
import { scenarioHash, generateQuestion, nextToAct } from '../../domain/generator';
import type { Level } from '../../domain/types';
import { DEFAULT_SETTINGS } from '../../store/schema';
import {
  eligibleLevels,
  generateChipQuestion,
  generateMaxRaiseQuestion,
  generateSimQuestion,
  generateTripleQuestion,
} from './generate';
import { timesThree } from '../../domain/triple';

describe('generateDrill の答えは domain 関数と一致する', () => {
  it('チップ分解は breakdown の枚数、合計は totalOf', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const q = generateChipQuestion(DEFAULT_SETTINGS, seed);
      if (q.variant === 'breakdown') {
        const parts = breakdown(q.amount, q.denoms);
        let count = 0;
        for (const part of parts) count += part.count;
        expect(q.answer).toBe(count);
      } else {
        expect(q.answer).toBe(totalOf(q.parts));
      }
    }
  });

  it('最大レイズは analyze().maxRaiseTo', () => {
    const q = generateMaxRaiseQuestion(DEFAULT_SETTINGS, 11);
    expect(q.raiseTo).toBe(analyze(q.scenario).maxRaiseTo);
    expect(q.addChips).toBe(analyze(q.scenario).maxAddChips);
    expect(q.answer).toBe(q.raiseTo);
  });

  it('保存された addChips 設定でも答えは raise-to', () => {
    const q = generateMaxRaiseQuestion(
      { ...DEFAULT_SETTINGS, answerType: 'addChips' },
      11,
    );
    expect(q.answer).toBe(q.raiseTo);
  });

  it('実戦シミュレーションの答えは replay 後の analyze().maxRaiseTo', () => {
    const q = generateSimQuestion(DEFAULT_SETTINGS, 13);
    expect(q.answer).toBe(analyze(q.scenario).maxRaiseTo);
    expect(q.interruptAt).toBe(q.scenario.actionLog.length);
  });

  it('3倍ドリルの答えは timesThree', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = generateTripleQuestion(seed);
      expect(q.value).toBeGreaterThanOrEqual(14);
      expect(q.value).toBeLessThanOrEqual(99);
      expect(q.answer).toBe(timesThree(q.value));
    }
  });

  it('苦手レベルの重みで出題レベルが偏る', () => {
    const weak = [
      { level: 1 as const, total: 20, correct: 19, averageMs: 3000 },
      { level: 2 as const, total: 20, correct: 2, averageMs: 18000 },
      { level: 3 as const, total: 20, correct: 18, averageMs: 4000 },
    ];
    const counts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (let seed = 1; seed <= 80; seed++) {
      const q = generateMaxRaiseQuestion(DEFAULT_SETTINGS, seed, weak);
      if (q.level === 1 || q.level === 2 || q.level === 3) {
        counts[q.level] += 1;
      }
    }
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
  });
});

describe('P1-2 実戦モードの切る位置', () => {
  it(
    '3000 問でポスト後かつ次の行動者の手番',
    () => {
      for (let seed = 1; seed <= 3000; seed++) {
        const q = generateSimQuestion(DEFAULT_SETTINGS, seed);
        expect(q.interruptAt).toBe(q.scenario.actionLog.length);
        if (q.scenario.street === 'preflop') {
          const posted = new Set(
            q.scenario.actionLog
              .filter((entry) => entry.type === 'post')
              .map((entry) => entry.seat),
          );
          expect(posted.has('SB')).toBe(true);
          expect(posted.has('BB')).toBe(true);
        }
        expect(nextToAct(q.scenario)).toBe(q.scenario.heroSeat);
        const hero = q.scenario.seats.find((seat) => seat.id === q.scenario.heroSeat);
        expect(hero?.folded).toBe(false);
      }
    },
    60_000,
  );
});

describe('P1-4 出題設定', () => {
  it('straddle none では Lv3 を出題対象から外す', () => {
    const settings = { ...DEFAULT_SETTINGS, straddle: 'none' as const, levels: [1, 2, 3] as Level[] };
    expect(eligibleLevels(settings)).toEqual([1, 2]);
    for (let seed = 1; seed <= 40; seed++) {
      expect(generateMaxRaiseQuestion(settings, seed).level).not.toBe(3);
    }
  });

  it('下限以上のレベルだけを出題する', () => {
    const settings = { ...DEFAULT_SETTINGS, levels: [4, 5, 6] as Level[] };
    expect(eligibleLevels(settings)).toEqual([4, 5, 6]);
    for (let seed = 1; seed <= 40; seed++) {
      expect(generateMaxRaiseQuestion(settings, seed).level).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('P2-1 重複排除とバリエーション', () => {
  it(
    'Lv1〜3 混合 20 問セッション 300 回でハッシュ重複 0',
    () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        levels: [1, 2, 3] as Level[],
        questionCount: 20 as const,
      };
      for (let sess = 0; sess < 300; sess++) {
        const hashes: string[] = [];
        const recent: string[] = [];
        for (let i = 0; i < 20; i++) {
          const q = generateMaxRaiseQuestion(settings, sess * 1000 + i + 1, [], recent);
          const hash = scenarioHash(q.scenario);
          expect(hashes).not.toContain(hash);
          hashes.push(hash);
          recent.push(hash);
          if (recent.length > 30) recent.shift();
        }
      }
    },
    120_000,
  );

  it(
    'Lv5 の前ポットが 10 種類以上',
    () => {
      const pots = new Set<number>();
      for (let seed = 1; seed <= 400; seed++) {
        const q = generateQuestion(5, {
          stake: {
            sb: 1,
            bb: 2,
            ante: 0,
            anteType: 'none',
            unit: 1,
          },
          tableSize: 6,
          straddle: 'double',
        }, seed);
        pots.add(q.scenario.potBefore);
      }
      expect(pots.size).toBeGreaterThanOrEqual(10);
    },
    30_000,
  );
});

