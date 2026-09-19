import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionLog,
  AnswerDisplay,
  FeedbackPanel,
  NumericKeypad,
  PokerTable,
  ProgressBar,
} from '../../components/ui';
import { replayLog, scenarioHash } from '../../domain/generator';
import { formatChips } from '../../lib/format';
import { seatDisplayName } from '../../lib/seats';

const REVEAL_MS = 1000;
const isTest = import.meta.env.MODE === 'test';
import { resultFeedback, tapFeedback } from '../../lib/feedback';
import { strings } from '../../lib/strings';
import type { ActionEntry, MistakeKind, Scenario, SeatId } from '../../domain/types';
import { useSettingsStore } from '../../store/settings';
import { useStatsStore } from '../../store/stats';
import type { AnswerRecord, Settings } from '../../store/schema';
import { aggregateSessions } from '../stats/aggregate';
import {
  generateDrill,
  mistakeOf,
  parseQuizMode,
  type ChipQuestion,
  type MaxRaiseQuestion,
  type SimQuestion,
  type TripleQuestion,
} from './generate';
import { ResultPage } from './ResultPage';

function appendDigit(input: string, digit: string): string {
  const next = `${input}${digit}`;
  return next.length > 10 ? input : next.replace(/^0+(?=\d)/, '');
}

function parseInput(input: string): number {
  if (input === '') return 0;
  return Number(input);
}

function snapshotSettings(settings: Settings): Settings {
  return {
    schemaVersion: settings.schemaVersion,
    ratePreset: settings.ratePreset,
    sb: settings.sb,
    bb: settings.bb,
    unit: settings.unit,
    anteType: settings.anteType,
    ante: settings.ante,
    straddle: settings.straddle,
    levels: settings.levels,
    questionCount: settings.questionCount,
    answerType: settings.answerType,
    timeLimitSec: settings.timeLimitSec,
    chipPreset: settings.chipPreset,
    chipDenoms: settings.chipDenoms,
    sound: settings.sound,
    vibe: settings.vibe,
  };
}

function isBlindPost(entry: ActionEntry): boolean {
  return entry.type === 'post' && (entry.seat === 'SB' || entry.seat === 'BB');
}

/** SB / BB のポストは最初から置いてある。先頭のアンティ＋ブラインドまでを飛ばす。 */
function initialRevealedCount(log: readonly ActionEntry[]): number {
  let lastBlind = -1;
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry === undefined) break;
    if (entry.type === 'ante') continue;
    if (isBlindPost(entry)) {
      lastBlind = i;
      continue;
    }
    break;
  }
  return lastBlind + 1;
}

function actionLine(
  seat: SeatId,
  type: keyof typeof strings.quiz.actions,
  amountTo: number | undefined,
  present: readonly SeatId[],
): string {
  const amt = amountTo !== undefined ? ` ${formatChips(amountTo)}` : '';
  return `${seatDisplayName(seat, present)} ${strings.quiz.actions[type]}${amt}`;
}

function scenarioItems(scenario: Scenario, revealedLog: number): string[] {
  const present = scenario.seats.map((seat) => seat.id);
  const items: string[] = [];
  if (scenario.potBefore > 0) {
    items.push(`${strings.quiz.prevPot} ${formatChips(scenario.potBefore)}`);
  }
  const n = revealedLog < 0 ? 0 : revealedLog;
  for (const entry of scenario.actionLog.slice(0, n)) {
    if (isBlindPost(entry)) continue;
    items.push(actionLine(entry.seat, entry.type, entry.amountTo, present));
  }
  return items;
}

function hintOf(kind: MistakeKind | null): string {
  if (kind === 'forgot_own_investment') return strings.quiz.hintOwn;
  if (kind === 'forgot_double_call') return strings.quiz.hintDouble;
  if (kind === 'used_pot_after_call') return strings.quiz.hintAfterCall;
  if (kind === 'missed_trail') return strings.quiz.hintTrail;
  if (kind === 'off_by_blind') return strings.quiz.hintBlind;
  return '';
}

function KeypadBlock({
  input,
  setInput,
  onSubmit,
  vibe,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  vibe: boolean;
}) {
  const press = () => tapFeedback(vibe);
  return (
    <>
      <AnswerDisplay value={input} />
      <NumericKeypad
        onDigit={(d) => {
          press();
          setInput(appendDigit(input, d));
        }}
        onDoubleZero={() => {
          press();
          setInput(appendDigit(input, '00'));
        }}
        onBackspace={() => {
          press();
          setInput(input.slice(0, -1));
        }}
        onSubmit={() => {
          press();
          onSubmit();
        }}
      />
    </>
  );
}

function TableScene({
  scenario,
  revealed,
  revealMode,
}: {
  scenario: Scenario;
  revealed: number;
  revealMode: boolean;
}) {
  const logCount = revealMode ? revealed : scenario.actionLog.length;
  const items = scenarioItems(scenario, logCount);
  const visible = revealMode ? replayLog(scenario, revealed) : scenario;
  const acting = !revealMode || revealed >= scenario.actionLog.length;
  return (
    <>
      <div className="-mx-4 shrink-0">
        <PokerTable
          seats={visible.seats}
          contributions={visible.contributions}
          heroSeat={scenario.heroSeat}
          potBefore={visible.potBefore}
          highlightActing={acting}
        />
      </div>
      <div className="min-h-0 flex-1">
        <ActionLog items={items} />
      </div>
    </>
  );
}

function ChipBody({ question }: { question: ChipQuestion }) {
  if (question.variant === 'total') {
    return (
      <div className="space-y-2">
        <p>{strings.quiz.askChipTotal}</p>
        <ul className="text-sm tabular-nums">
          {question.parts.map((part) => (
            <li key={part.denom}>
              {formatChips(part.denom)} × {part.count}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p>{strings.quiz.askChipCount}</p>
      <p className="text-3xl font-medium tabular-nums">{formatChips(question.amount)}</p>
      <p className="text-sm text-muted">{question.denoms.map(formatChips).join(' / ')}</p>
    </div>
  );
}

function TripleBody({ question }: { question: TripleQuestion }) {
  return (
    <div className="space-y-3 pt-6 text-center">
      <p className="text-sm text-muted">{strings.quiz.askTriple}</p>
      <p className="text-6xl font-medium tabular-nums">{question.value}</p>
    </div>
  );
}

export function QuizPage() {
  const params = useParams();
  const mode = parseQuizMode(params.mode);
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const addSession = useStatsStore((s) => s.addSession);
  const sessions = useStatsStore((s) => s.sessions);
  const meta = useStatsStore((s) => s.meta);
  const [stats] = useState(() => aggregateSessions(sessions, meta, new Date()).byLevel);
  const [quizSettings] = useState(() => snapshotSettings(settings));

  const total = quizSettings.questionCount;
  const [sessionId] = useState(() => `sess-${Date.now()}`);
  const [startedAt] = useState(() => new Date().toISOString());
  const [seedBase] = useState(() => Date.now() | 0);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(() => (isTest ? Number.MAX_SAFE_INTEGER : 0));
  const [revealForIndex, setRevealForIndex] = useState(0);
  const [lastMistake, setLastMistake] = useState<MistakeKind | null>(null);
  const [phase, setPhase] = useState<'ask' | 'feedback'>('ask');
  const [correct, setCorrect] = useState(false);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const completedRef = useRef(false);
  const recordsRef = useRef<AnswerRecord[]>([]);
  const settingsRef = useRef(settings);
  const recentHashesRef = useRef<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [showResult, setShowResult] = useState(false);

  recordsRef.current = records;
  settingsRef.current = settings;

  const question = useMemo(() => {
    if (!mode) return null;
    return generateDrill(mode, quizSettings, seedBase + index + 1, stats, recentHashesRef.current);
  }, [mode, quizSettings, seedBase, index, stats]);

  const postedStart =
    isTest || !question || !('scenario' in question)
      ? isTest
        ? Number.MAX_SAFE_INTEGER
        : 0
      : initialRevealedCount(question.scenario.actionLog);
  if (index !== revealForIndex) {
    setRevealForIndex(index);
    setRevealed(postedStart);
  } else if (revealed < postedStart) {
    setRevealed(postedStart);
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!question || !('scenario' in question)) return;
    const hash = scenarioHash(question.scenario);
    const next = recentHashesRef.current.filter((item) => item !== hash);
    next.push(hash);
    recentHashesRef.current = next.slice(-30);
  }, [question]);

  useEffect(() => {
    setInput('');
    setRevealed(postedStart);
    setPhase('ask');
    setQuestionStartedAt(Date.now());
  }, [index]);

  useEffect(() => {
    if (isTest) return;
    if (phase !== 'ask') return;
    if (!question) return;
    if (question.kind !== 'sim' && question.kind !== 'max-raise') {
      return;
    }
    const total = question.scenario.actionLog.length;
    if (revealed >= total) return;
    const id = window.setTimeout(() => setRevealed((n) => n + 1), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [question, phase, revealed]);

  useEffect(() => {
    return () => {
      if (completedRef.current || !mode) return;
      if (recordsRef.current.length === 0) return;
      completedRef.current = true;
      addSession({
        id: sessionId,
        mode,
        startedAt,
        endedAt: new Date().toISOString(),
        completed: false,
        records: recordsRef.current,
        settingsSnapshot: snapshotSettings(settingsRef.current),
      });
    };
  }, [addSession, mode, sessionId, startedAt]);

  if (showResult) {
    return <ResultPage sessionId={sessionId} />;
  }

  if (!mode || !question) {
    return <p className="p-4">{strings.quiz.unknownMode}</p>;
  }

  const revealLogLength =
    question.kind === 'sim' || question.kind === 'max-raise'
      ? question.scenario.actionLog.length
      : 0;
  const needsReveal = question.kind === 'sim' || question.kind === 'max-raise';
  const revealReady = !needsReveal || revealed >= revealLogLength;

  const raiseQ: MaxRaiseQuestion | SimQuestion | null =
    question.kind === 'max-raise' || question.kind === 'sim' ? question : null;

  const finishSession = (nextRecords: AnswerRecord[], done: boolean) => {
    completedRef.current = true;
    setCompleted(true);
    addSession({
      id: sessionId,
      mode,
      startedAt,
      endedAt: new Date().toISOString(),
      completed: done,
      records: nextRecords,
      settingsSnapshot: snapshotSettings(quizSettings),
    });
    if (done) {
      setShowResult(true);
      if (import.meta.env.MODE !== 'test') {
        navigate(`/result/${sessionId}`);
      }
    } else {
      navigate('/');
    }
  };

  const elapsedMs = Date.now() - questionStartedAt;
  const timedOut =
    settings.timeLimitSec > 0 && elapsedMs >= settings.timeLimitSec * 1000;

  const pushRecord = (
    isCorrect: boolean,
    answer: number,
    inputValue: number,
    mistake: MistakeKind | null,
  ) => {
    const record: AnswerRecord = {
      questionId: question.id,
      seed: question.seed,
      level: question.kind === 'chips' || question.kind === 'triple' ? 1 : question.level,
      mode,
      answer,
      input: inputValue,
      correct: isCorrect,
      elapsedMs,
      timedOut,
      mistake,
      at: new Date().toISOString(),
    };
    return [...records, record];
  };

  const goFeedback = (
    isCorrect: boolean,
    answer: number,
    inputValue: number,
    mistake: MistakeKind | null,
  ) => {
    resultFeedback(isCorrect, settings.sound, settings.vibe);
    setLastMistake(mistake);
    setCorrect(isCorrect);
    setPhase('feedback');
    setRecords(pushRecord(isCorrect, answer, inputValue, mistake));
  };

  const submitNumeric = () => {
    if (question.kind === 'chips' || question.kind === 'triple') {
      const value = parseInput(input);
      goFeedback(value === question.answer, question.answer, value, null);
      return;
    }
    if (raiseQ) {
      const value = parseInput(input);
      const ok = value === raiseQ.answer;
      const mistake = ok ? null : mistakeOf(raiseQ.scenario, value);
      goFeedback(ok, raiseQ.answer, value, mistake);
    }
  };

  const onNext = () => {
    const nextIndex = index + 1;
    if (total > 0 && nextIndex >= total) {
      finishSession(records, true);
      return;
    }
    setIndex(nextIndex);
  };

  const onBack = () => {
    if (!completed && records.length > 0) {
      finishSession(records, false);
      return;
    }
    navigate('/');
  };

  const expectedTestAnswer = (): string => {
    if (question.kind === 'chips' || question.kind === 'triple') {
      return String(question.answer);
    }
    if (raiseQ) {
      return String(raiseQ.answer);
    }
    return '';
  };

  const feedbackBody = (): string => {
    if (question.kind === 'triple') {
      const compared = !correct
        ? `${strings.quiz.yourAnswer}: ${parseInput(input)} / ${strings.quiz.correctAnswer}: ${question.answer}`
        : '';
      return [compared, `${question.value} × 3 = ${question.answer}`]
        .filter(Boolean)
        .join('\n');
    }
    if (question.kind === 'chips') {
      if (question.variant === 'breakdown') {
        return question.parts
          .map((p) => `${formatChips(p.denom)}×${p.count}`)
          .join(', ');
      }
      return `${strings.quiz.total} ${formatChips(question.answer)}`;
    }
    if (raiseQ) {
      const steps = raiseQ.steps
        .map((step, i) => {
          const label = strings.quiz.steps[step.key];
          const expr = step.expression.includes('→')
            ? `${label} ${step.expression}`
            : `${label} ${step.expression} = ${formatChips(step.value)}`;
          return `(${i + 1}) ${expr}`;
        })
        .join('\n');
      const compared = !correct
        ? `${strings.quiz.yourAnswer}: ${formatChips(parseInput(input))} / ${strings.quiz.correctAnswer}: ${formatChips(raiseQ.answer)}`
        : '';
      const hint = hintOf(lastMistake);
      return [compared, steps, hint].filter(Boolean).join('\n');
    }
    return '';
  };

  const actingSeat = raiseQ?.scenario.heroSeat;
  const actingName = actingSeat
    ? seatDisplayName(
        actingSeat,
        raiseQ?.scenario.seats.map((seat) => seat.id) ?? [],
      )
    : '';
  const askPrompt =
    raiseQ && actingSeat ? `${strings.quiz.askPotNow} ${actingName}` : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center gap-2 px-4 py-2 border-b border-stroke">
        <button
          type="button"
          data-testid="quiz-back"
          className="min-h-11 min-w-11 text-muted"
          onClick={onBack}
        >
          {strings.common.back}
        </button>
        <div className="flex-1">
          <ProgressBar
            current={index + 1}
            total={total}
            elapsedMs={now - questionStartedAt}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-1">
        {question.kind === 'sim' || question.kind === 'max-raise' ? (
          <TableScene
            scenario={question.scenario}
            revealed={revealed}
            revealMode
          />
        ) : null}
        {question.kind === 'chips' ? <ChipBody question={question} /> : null}
        {question.kind === 'triple' ? <TripleBody question={question} /> : null}
        {question.kind !== 'sim' && question.kind !== 'max-raise' ? (
          <div className="min-h-0 flex-1" />
        ) : null}
        {import.meta.env.MODE === 'test' ? (
          <span data-testid="quiz-answer" className="hidden">
            {expectedTestAnswer()}
          </span>
        ) : null}
        <span data-testid="quiz-phase" className="hidden">
          {phase === 'feedback'
            ? 'feedback'
            : needsReveal && !revealReady
              ? 'reveal'
              : 'amount'}
        </span>
      </div>

      <div className="shrink-0 space-y-2 px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {phase === 'ask' && revealReady && askPrompt ? (
          <p className="font-medium text-center">{askPrompt}</p>
        ) : null}
        {phase === 'ask' && revealReady ? (
          <KeypadBlock
            input={input}
            setInput={setInput}
            onSubmit={submitNumeric}
            vibe={settings.vibe}
          />
        ) : null}

        {phase === 'feedback' ? (
          <FeedbackPanel correct={correct} body={feedbackBody()} onNext={onNext} />
        ) : null}
      </div>
    </div>
  );
}
