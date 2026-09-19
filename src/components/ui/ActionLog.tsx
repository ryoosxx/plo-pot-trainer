export function ActionLog({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul
      data-testid="action-log"
      className="space-y-0.5 text-center text-sm tabular-nums text-muted"
    >
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}
