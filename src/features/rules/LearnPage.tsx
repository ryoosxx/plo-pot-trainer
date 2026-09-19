import { useState } from 'react';
import { analyze } from '../../domain/potLimit';
import type { Scenario, Seat } from '../../domain/types';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatChips } from '../../lib/format';
import { strings } from '../../lib/strings';

const STAKE = { sb: 1, bb: 2, ante: 0, anteType: 'none' as const, unit: 1 };

function seat(id: Seat['id'], isHero: boolean): Seat {
  return {
    id,
    label: id,
    stack: 10000,
    folded: false,
    isHero,
    isButton: id === 'BTN',
  };
}

function exampleScenario(raiseTo: number, callers: number): Scenario {
  const contributions: Scenario['contributions'] = {
    SB: 1,
    BB: 2,
    UTG: raiseTo,
  };
  if (callers >= 1) contributions.MP = raiseTo;
  if (callers >= 2) contributions.CO = raiseTo;
  return {
    street: 'preflop',
    seats: [seat('SB', false), seat('BB', true), seat('UTG', false)],
    potBefore: 0,
    contributions,
    heroSeat: 'BB',
    lastRaiseSize: raiseTo - 2,
    actionLog: [
      { seat: 'SB', type: 'post', amountTo: 1 },
      { seat: 'BB', type: 'post', amountTo: 2 },
      { seat: 'UTG', type: 'raise', amountTo: raiseTo },
    ],
    stake: STAKE,
  };
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-stroke px-3 min-h-11">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-h-11 min-w-11"
          onClick={() => onChange(value <= min ? min : value - 1)}
        >
          −
        </button>
        <span className="tabular-nums w-10 text-center">{value}</span>
        <button
          type="button"
          className="min-h-11 min-w-11"
          onClick={() => onChange(value >= max ? max : value + 1)}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

export function LearnPage() {
  const [raiseTo, setRaiseTo] = useState(7);
  const [callers, setCallers] = useState(1);
  const result = analyze(exampleScenario(raiseTo, callers));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader title={strings.learn.title} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain space-y-6 px-4 py-4 pb-10">
        <section className="space-y-2">
          <h2 className="text-sm text-muted">{strings.learn.formula}</h2>
          <pre className="whitespace-pre-wrap border border-stroke p-3 text-sm leading-6">{`toCall      = C - h
maxRaiseTo  = h + P + 2 * toCall
maxAddChips = maxRaiseTo - h`}</pre>
          <p className="text-sm text-muted">{strings.learn.identity}</p>
          <p className="text-sm tabular-nums">maxRaiseTo = 3 × C + trail</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm text-muted">{strings.learn.stepsTitle}</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>{strings.learn.step1}</li>
            <li>{strings.learn.step2}</li>
            <li>{strings.learn.step3}</li>
          </ol>
          <p className="text-sm text-muted">{strings.learn.note}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm text-muted">{strings.learn.example}</h2>
          <Stepper
            label={strings.learn.raiseTo}
            value={raiseTo}
            min={4}
            max={20}
            onChange={setRaiseTo}
          />
          <Stepper
            label={strings.learn.callers}
            value={callers}
            min={0}
            max={2}
            onChange={setCallers}
          />
          <div className="border border-stroke p-4 space-y-2">
            {result.steps.map((step) => (
              <p key={step.key} className="text-sm tabular-nums">
                {strings.quiz.steps[step.key]}: {step.expression}
                {step.expression.includes('→') ? '' : ` = ${formatChips(step.value)}`}
              </p>
            ))}
            <p className="text-lg font-medium tabular-nums">
              {strings.learn.result}: {formatChips(result.maxRaiseTo)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
