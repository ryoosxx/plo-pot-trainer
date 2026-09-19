import { analyze } from '../potLimit';
import { generateQuestion, DEFAULT_GENERATOR_SETTINGS } from './index';
import { replayLog } from './replay';

describe('replayLog', () => {
  it('全ログを replay すると totalPot が一致する', () => {
    const q = generateQuestion(1, DEFAULT_GENERATOR_SETTINGS, 20260908);
    const replayed = replayLog(q.scenario, q.scenario.actionLog.length);
    expect(analyze(replayed).totalPot).toBe(analyze(q.scenario).totalPot);
    expect(analyze(replayed).maxRaiseTo).toBe(analyze(q.scenario).maxRaiseTo);
  });

  it('途中で切ると投入額が減る（または同じ）', () => {
    const q = generateQuestion(2, DEFAULT_GENERATOR_SETTINGS, 99);
    const len = q.scenario.actionLog.length;
    const cut = len > 2 ? len - 1 : len;
    const partial = replayLog(q.scenario, cut);
    expect(analyze(partial).totalPot).toBeLessThanOrEqual(analyze(q.scenario).totalPot);
    expect(partial.actionLog).toHaveLength(cut);
  });
});
