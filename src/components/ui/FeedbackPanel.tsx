import { strings } from '../../lib/strings';

export function FeedbackPanel({
  correct,
  body,
  onNext,
}: {
  correct: boolean;
  body: string;
  onNext: () => void;
}) {
  return (
    <div
      data-testid="feedback"
      className={`space-y-3 border-t pt-4 ${
        correct ? 'border-correct' : 'border-incorrect'
      }`}
    >
      <p className="font-medium flex items-center gap-2">
        <span aria-hidden>{correct ? '✓' : '✗'}</span>
        <span className={correct ? 'text-correct' : 'text-incorrect'}>
          {correct ? strings.quiz.correct : strings.quiz.incorrect}
        </span>
      </p>
      <p className="max-h-28 overflow-y-auto overscroll-y-contain text-sm whitespace-pre-wrap tabular-nums text-muted">
        {body}
      </p>
      <button
        type="button"
        data-testid="next-question"
        className="min-h-11 w-full rounded-md bg-ink text-background font-medium"
        onClick={onNext}
      >
        {strings.quiz.next}
      </button>
    </div>
  );
}
