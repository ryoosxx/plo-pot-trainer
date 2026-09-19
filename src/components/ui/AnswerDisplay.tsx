import { formatChips } from '../../lib/format';

export function AnswerDisplay({ value }: { value: string }) {
  const n = value === '' ? 0 : Number(value);
  return (
    <div
      data-testid="answer-display"
      className="min-h-11 border-b border-stroke px-1 py-1 text-right text-3xl font-medium tabular-nums"
    >
      {formatChips(n)}
    </div>
  );
}
