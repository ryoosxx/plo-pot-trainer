import { PageHeader } from '../../components/ui/PageHeader';
import { StatBar } from '../../components/ui/StatBar';
import { formatMs, formatPercent, formatShortDate } from '../../lib/format';
import { strings } from '../../lib/strings';
import type { QuizMode } from '../../store/schema';
import { useStatsStore } from '../../store/stats';
import { aggregateSessions, totalsFromSummaries } from './aggregate';

function modeLabel(mode: QuizMode): string {
  if (mode === 'chips') return strings.stats.modeChips;
  if (mode === 'sim') return strings.stats.modeSim;
  if (mode === 'triple') return strings.stats.modeTriple;
  return strings.stats.modeMaxRaise;
}

export function StatsPage() {
  const sessions = useStatsStore((s) => s.sessions);
  const summaries = useStatsStore((s) => s.summaries);
  const meta = useStatsStore((s) => s.meta);
  const summary = aggregateSessions(sessions, meta, new Date());
  const lifetime = totalsFromSummaries(summaries);
  const totalQuestions =
    lifetime.totalQuestions > 0 ? lifetime.totalQuestions : summary.totalQuestions;
  const accuracy = lifetime.totalQuestions > 0 ? lifetime.accuracy : summary.accuracy;
  const averageMs = lifetime.totalQuestions > 0 ? lifetime.averageMs : summary.averageMs;
  const maxDay = summary.last14Days.reduce((m, d) => (d.total > m ? d.total : m), 0);
  const now = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader title={strings.stats.title} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain space-y-6 px-4 py-4 pb-10">
        {totalQuestions === 0 && summaries.length === 0 ? (
          <p className="text-muted">{strings.stats.empty}</p>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.total}</p>
                <p className="text-xl font-medium tabular-nums">{totalQuestions}</p>
              </div>
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.accuracy}</p>
                <p className="text-xl font-medium tabular-nums">
                  {accuracy === null ? '—' : formatPercent(accuracy)}
                </p>
              </div>
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.averageTime}</p>
                <p className="text-xl font-medium tabular-nums">
                  {averageMs === null ? '—' : formatMs(averageMs)}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm text-muted">{strings.stats.history}</h2>
              {summaries.length === 0 ? (
                <p className="text-muted text-sm">{strings.stats.empty}</p>
              ) : (
                <div className="space-y-2">
                  {summaries.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-stroke px-3 py-2 space-y-0.5"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <span className="tabular-nums text-muted">
                            {formatShortDate(item.endedAt, now)}
                          </span>{' '}
                          {modeLabel(item.mode)}
                        </span>
                        <span className="tabular-nums">
                          {item.correct}/{item.total}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs tabular-nums text-muted">
                        <span>
                          {item.total === 0
                            ? '—'
                            : formatPercent(item.correct / item.total)}
                        </span>
                        <span>{formatMs(item.averageMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm text-muted">{strings.stats.byLevel}</h2>
              <div className="space-y-2">
                {summary.byLevel.map((row) => (
                  <div
                    key={row.level}
                    className="flex items-center justify-between rounded-md border border-stroke px-3 min-h-11 text-sm tabular-nums"
                  >
                    <span>
                      {strings.stats.level}
                      {row.level}
                    </span>
                    <span className="text-muted">
                      {row.accuracy === null ? '—' : formatPercent(row.accuracy)} /{' '}
                      {row.averageMs === null ? '—' : formatMs(row.averageMs)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm text-muted">{strings.stats.last14}</h2>
              <div className="space-y-2">
                {summary.last14Days.map((day) => (
                  <StatBar
                    key={day.date}
                    label={day.date.slice(5)}
                    value={day.total}
                    max={maxDay}
                  />
                ))}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.bestStreak}</p>
                <p className="text-xl font-medium tabular-nums">{summary.bestStreak}</p>
              </div>
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.currentStreak}</p>
                <p className="text-xl font-medium tabular-nums">{summary.currentStreak}</p>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm text-muted">{strings.stats.weak}</h2>
              {summary.weakTop3.length === 0 ? (
                <p className="text-muted text-sm">{strings.stats.empty}</p>
              ) : (
                summary.weakTop3.map((item) => (
                  <div
                    key={item.level}
                    className="rounded-md border border-stroke px-3 min-h-11 flex items-center justify-between text-sm tabular-nums"
                  >
                    <span>
                      {strings.stats.level}
                      {item.level}
                    </span>
                    <span className="text-muted">
                      {formatPercent(item.accuracy)} / {formatMs(item.averageMs)}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
