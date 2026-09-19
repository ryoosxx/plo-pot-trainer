import { strings } from '../../lib/strings';

export function NumericKeypad({
  onDigit,
  onDoubleZero,
  onBackspace,
  onSubmit,
}: {
  onDigit: (digit: string) => void;
  onDoubleZero: () => void;
  onBackspace: () => void;
  onSubmit: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const keyClass =
    'min-h-14 rounded-md border border-stroke text-xl font-medium tabular-nums';
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`key-${key}`}
            className={keyClass}
            onClick={() => onDigit(key)}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          data-testid="key-0"
          className={keyClass}
          onClick={() => onDigit('0')}
        >
          0
        </button>
        <button
          type="button"
          data-testid="key-00"
          className={keyClass}
          onClick={onDoubleZero}
        >
          00
        </button>
        <button
          type="button"
          data-testid="key-back"
          className="min-h-14 rounded-md border border-stroke text-xl font-medium"
          onClick={onBackspace}
        >
          ←
        </button>
      </div>
      <button
        type="button"
        data-testid="key-submit"
        className="min-h-14 w-full rounded-md bg-ink text-background text-base font-medium"
        onClick={onSubmit}
      >
        {strings.quiz.submitSeats}
      </button>
    </div>
  );
}
