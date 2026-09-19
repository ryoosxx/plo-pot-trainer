import { PageHeader } from '../../components/ui/PageHeader';
import { StatBar } from '../../components/ui/StatBar';
import { downloadText, sessionsToCsv } from '../../lib/csv';
import { formatMs, formatPercent } from '../../lib/format';
import { strings } from '../../lib/strings';
import { useStatsStore } from '../../store/stats';
import { aggregateSessions } from './aggregate';

export function StatsPage() {
  const sessions = useStatsStore((s) => s.sessions);
  const meta = useStatsStore((s) => s.meta);
  const summary = aggregateSessions(sessions, meta, new Date());
  const maxDay = summary.last14Days.reduce((m, d) => (d.total > m ? d.total : m), 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader title={strings.stats.title} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain space-y-6 px-4 py-4 pb-10">
        {summary.totalQuestions === 0 ? (
          <p className="text-muted">{strings.stats.empty}</p>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.total}</p>
                <p className="text-xl font-medium tabular-nums">{summary.totalQuestions}</p>
              </div>
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.accuracy}</p>
                <p className="text-xl font-medium tabular-nums">
                  {summary.accuracy === null ? '—' : formatPercent(summary.accuracy)}
                </p>
              </div>
              <div className="rounded-md border border-stroke p-3">
                <p className="text-xs text-muted">{strings.stats.averageTime}</p>
                <p className="text-xl font-medium tabular-nums">
                  {summary.averageMs === null ? '—' : formatMs(summary.averageMs)}
                </p>
              </div>
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
        <button
          type="button"
          data-testid="export-csv"
          className="min-h-11 w-full rounded-md border border-stroke text-sm"
          onClick={() =>
            downloadText(
              'plo-trainer-stats.csv',
              sessionsToCsv(sessions),
              'text/csv;charset=utf-8',
            )
          }
        >
          {strings.stats.exportCsv}
        </button>
      </div>
    </div>
  );
}
