export function ProgressBar({
  current,
  total,
  elapsedMs,
}: {
  current: number;
  total: number;
  elapsedMs: number;
}) {
  const pct = total <= 0 ? 0 : Math.min(100, Math.round((current / total) * 100));
  const sec = elapsedMs < 0 ? 0 : (elapsedMs - (elapsedMs % 1000)) / 1000;
  const mm = (sec - (sec % 60)) / 60;
  const ss = sec % 60;
  const pad = ss < 10 ? `0${ss}` : `${ss}`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm tabular-nums text-muted">
        <span>
          {current}/{total <= 0 ? '∞' : total}
        </span>
        <span>
          {mm}:{pad}
        </span>
      </div>
      <div className="h-px overflow-hidden bg-stroke">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
