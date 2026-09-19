export function StatBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-muted tabular-nums">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-px overflow-hidden bg-stroke">
        <div className="h-full bg-ink" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
