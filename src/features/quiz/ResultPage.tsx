import { Link, useParams } from 'react-router-dom';
import { strings } from '../../lib/strings';
import { formatMs } from '../../lib/format';
import { useStatsStore } from '../../store/stats';

export function ResultPage({ sessionId }: { sessionId?: string }) {
  const params = useParams();
  const id = sessionId ?? params.sessionId;
  const sessions = useStatsStore((s) => s.sessions);
  const session = sessions.find((item) => item.id === id);
  if (!session) {
    return <p className="p-4">{strings.quiz.missingSession}</p>;
  }
  const total = session.records.length;
  let correct = 0;
  let time = 0;
  for (const record of session.records) {
    if (record.correct) correct += 1;
    time += record.elapsedMs;
  }
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  const avg = total === 0 ? 0 : time / total;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-white px-4 py-6 gap-6">
      <h1 className="text-xl font-medium tracking-tight">{strings.quiz.resultTitle}</h1>
      <p data-testid="result-accuracy" className="text-5xl font-medium tabular-nums">
        {accuracy}%
      </p>
      <p className="text-muted tabular-nums">
        {correct}/{total} ・ {strings.stats.averageTime} {formatMs(avg)}
      </p>
      <Link
        to={`/quiz/${session.mode}`}
        className="min-h-11 rounded-md bg-ink text-background font-medium flex items-center justify-center"
      >
        {strings.quiz.retry}
      </Link>
      <Link
        to="/"
        className="min-h-11 rounded-md border border-stroke flex items-center justify-center text-sm"
      >
        {strings.quiz.home}
      </Link>
    </div>
  );
}
