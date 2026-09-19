import { NavLink } from 'react-router-dom';
import { formatPercent } from '../../lib/format';
import { strings } from '../../lib/strings';
import { maxLevelOf, minLevelOf } from '../../store/schema';
import { useSettingsStore } from '../../store/settings';
import { useStatsStore } from '../../store/stats';
import { aggregateSessions } from '../stats/aggregate';

export function HomePage() {
  const settings = useSettingsStore();
  const sessions = useStatsStore((s) => s.sessions);
  const meta = useStatsStore((s) => s.meta);
  const summary = aggregateSessions(sessions, meta, new Date());
  const todayAccuracy =
    summary.todayTotal === 0 ? null : summary.todayCorrect / summary.todayTotal;
  const lo = minLevelOf(settings.levels);
  const hi = maxLevelOf(settings.levels);
  const levelLabel = lo === hi ? `Lv${lo}` : `Lv${lo}-${hi}`;
  const countLabel =
    settings.questionCount === 0
      ? strings.settings.infinite
      : `${settings.questionCount}${strings.home.questions}`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-white px-4 py-6 gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-medium tracking-tight">{strings.appTitle}</h1>
        <NavLink
          to="/settings"
          className="inline-flex min-h-11 items-center px-2 text-sm text-muted"
        >
          {strings.home.settings}
        </NavLink>
      </header>

      <section className="space-y-1 text-sm">
        {summary.todayTotal === 0 ? (
          <p className="text-muted">{strings.home.noStats}</p>
        ) : (
          <>
            <p className="tabular-nums text-muted">
              {strings.home.today} {summary.todayTotal}
              {strings.home.questions}
              {todayAccuracy !== null
                ? ` / ${strings.home.accuracy} ${formatPercent(todayAccuracy)}`
                : ''}
            </p>
            <p className="tabular-nums text-muted">
              {strings.home.streak} {summary.currentStreak}
            </p>
          </>
        )}
      </section>

      <NavLink
        to="/quiz/max-raise"
        data-testid="home-max-raise"
        className="rounded-md bg-ink text-background px-4 py-4 space-y-1"
      >
        <p className="text-base font-medium">{strings.home.startQuiz}</p>
        <p className="text-sm text-background/60">
          {levelLabel} / {countLabel} / {settings.sb}-{settings.bb}
        </p>
      </NavLink>

      <div className="grid grid-cols-2 gap-2">
        <NavLink
          to="/quiz/chips"
          data-testid="home-chips"
          className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm"
        >
          {strings.home.chips}
        </NavLink>
        <NavLink
          to="/quiz/sim"
          data-testid="home-sim"
          className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm"
        >
          {strings.home.sim}
        </NavLink>
        <NavLink
          to="/quiz/triple"
          data-testid="home-triple"
          className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm"
        >
          {strings.home.triple}
        </NavLink>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <NavLink
          to="/stats"
          className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm text-muted"
        >
          {strings.home.stats}
        </NavLink>
        <NavLink
          to="/learn"
          className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm text-muted"
        >
          {strings.home.learn}
        </NavLink>
      </div>
    </div>
  );
}
