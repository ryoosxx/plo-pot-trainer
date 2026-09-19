import type { Scenario } from '../types';

export function scenarioHash(scenario: Scenario): string {
  const contrib = Object.entries(scenario.contributions)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([seat, amount]) => `${seat}=${amount}`)
    .join(',');
  const log = scenario.actionLog
    .map((entry) => `${entry.seat}:${entry.type}:${entry.amountTo ?? ''}`)
    .join(',');
  return [
    scenario.street,
    scenario.heroSeat,
    String(scenario.potBefore),
    String(scenario.lastRaiseSize),
    contrib,
    log,
  ].join('|');
}
