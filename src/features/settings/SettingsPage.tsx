import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Level } from '../../domain/types';
import { strings } from '../../lib/strings';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  RATE_PRESETS,
  clampLevel,
  maxLevelOf,
  minLevelOf,
  type QuestionCount,
  type TimeLimitSec,
} from '../../store/schema';
import { useSettingsStore } from '../../store/settings';
import { useStatsStore } from '../../store/stats';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm text-muted">{label}</h2>
      {children}
    </section>
  );
}

function Chip({
  active,
  children,
  onClick,
  disabled = false,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-md px-3 text-sm ${
        disabled
          ? 'border border-stroke opacity-40'
          : active
            ? 'bg-ink text-background'
            : 'border border-stroke'
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stroke px-3 min-h-11">
      <span className="text-muted text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-h-11 min-w-11"
          onClick={() => onChange(value <= min ? min : value - 1)}
        >
          −
        </button>
        <span className="tabular-nums w-12 text-center">{value}</span>
        <button
          type="button"
          className="min-h-11 min-w-11"
          onClick={() => onChange(value + 1)}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

function pctOf(level: Level): number {
  return ((level - 1) / 5) * 100;
}

function LevelSlider({
  min,
  max,
  straddleNone,
  onChange,
}: {
  min: Level;
  max: Level;
  straddleNone: boolean;
  onChange: (min: Level, max: Level) => void;
}) {
  const ticks: Level[] = [1, 2, 3, 4, 5, 6];
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'min' | 'max' | 'undecided' | null>(null);
  const startXRef = useRef(0);

  const levelFromX = (clientX: number): Level => {
    const track = trackRef.current;
    if (!track) return min;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return min;
    const ratio = (clientX - rect.left) / rect.width;
    return clampLevel(1 + Math.round(ratio * 5));
  };

  const moveTo = (clientX: number) => {
    const next = levelFromX(clientX);
    let handle = dragRef.current;
    if (handle === 'undecided') {
      const dx = clientX - startXRef.current;
      if (Math.abs(dx) < 4) return;
      handle = dx < 0 ? 'min' : 'max';
      dragRef.current = handle;
    }
    if (handle === 'min') {
      onChange(next <= max ? next : max, max);
      return;
    }
    if (handle === 'max') {
      onChange(min, next >= min ? next : min);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
    const next = levelFromX(event.clientX);
    if (min === max) {
      dragRef.current = next === min ? 'undecided' : next < min ? 'min' : 'max';
    } else {
      const mid = (min + max) / 2;
      dragRef.current = next <= mid ? 'min' : 'max';
    }
    if (dragRef.current !== 'undecided') moveTo(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null) return;
    moveTo(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const setMin = (next: Level) => {
    onChange(next <= max ? next : max, max);
  };
  const setMax = (next: Level) => {
    onChange(min, next >= min ? next : min);
  };

  return (
    <div className="space-y-2" role="group" aria-label={strings.settings.levels}>
      <div className="px-1.5">
        <div
          ref={trackRef}
          className="relative h-11 touch-none cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-stroke" />
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 bg-ink"
            style={{
              left: `${pctOf(min)}%`,
              width: `${pctOf(max) - pctOf(min)}%`,
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `${pctOf(min)}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `${pctOf(max)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs tabular-nums">
          {ticks.map((level) => (
            <span
              key={level}
              className={
                level === 3 && straddleNone
                  ? 'text-muted opacity-40'
                  : level >= min && level <= max
                    ? 'text-ink'
                    : 'text-muted'
              }
            >
              {level}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm tabular-nums">
        {min === max ? `Lv${min}` : `Lv${min} 〜 Lv${max}`}
      </p>
      <input
        type="range"
        min={1}
        max={6}
        step={1}
        value={min}
        aria-label={strings.settings.levelsMin}
        data-testid="level-slider-min"
        className="sr-only"
        onChange={(event) => setMin(clampLevel(Number(event.target.value)))}
      />
      <input
        type="range"
        min={1}
        max={6}
        step={1}
        value={max}
        aria-label={strings.settings.levelsMax}
        data-testid="level-slider-max"
        className="sr-only"
        onChange={(event) => setMax(clampLevel(Number(event.target.value)))}
      />
    </div>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const resetStats = useStatsStore((s) => s.resetStats);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader title={strings.settings.title} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain space-y-6 px-4 py-4 pb-10">
        <Row label={strings.settings.rate}>
          <div className="flex flex-wrap gap-2">
            {RATE_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                active={settings.ratePreset === preset.id}
                onClick={() => settings.setRatePreset(preset.id)}
              >
                {preset.id}
              </Chip>
            ))}
            <Chip
              active={settings.ratePreset === 'custom'}
              onClick={() => settings.setRatePreset('custom')}
            >
              {strings.settings.custom}
            </Chip>
          </div>
          {settings.ratePreset === 'custom' ? (
            <div className="space-y-2">
              <Stepper
                label={strings.settings.sb}
                value={settings.sb}
                onChange={(sb) => settings.setCustomRate(sb, settings.bb)}
              />
              <Stepper
                label={strings.settings.bb}
                value={settings.bb}
                onChange={(bb) => settings.setCustomRate(settings.sb, bb)}
              />
            </div>
          ) : null}
        </Row>

        <Row label={strings.settings.ante}>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={settings.anteType === 'none'}
              onClick={() => settings.setAnteType('none')}
            >
              {strings.settings.anteNone}
            </Chip>
            <Chip
              active={settings.anteType === 'bb'}
              onClick={() => settings.setAnteType('bb')}
            >
              {strings.settings.anteBb}
            </Chip>
            <Chip
              active={settings.anteType === 'all'}
              onClick={() => settings.setAnteType('all')}
            >
              {strings.settings.anteAll}
            </Chip>
          </div>
          {settings.anteType !== 'none' ? (
            <Stepper
              label={strings.settings.anteAmount}
              value={settings.ante}
              min={0}
              onChange={settings.setAnte}
            />
          ) : null}
        </Row>

        <Row label={strings.settings.straddle}>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={settings.straddle === 'none'}
              onClick={() => settings.setStraddle('none')}
            >
              {strings.settings.straddleNone}
            </Chip>
            <Chip
              active={settings.straddle === 'single'}
              onClick={() => settings.setStraddle('single')}
            >
              {strings.settings.straddleSingle}
            </Chip>
            <Chip
              active={settings.straddle === 'double'}
              onClick={() => settings.setStraddle('double')}
            >
              {strings.settings.straddleDouble}
            </Chip>
          </div>
        </Row>

        <Row label={strings.settings.levels}>
          <LevelSlider
            min={minLevelOf(settings.levels)}
            max={maxLevelOf(settings.levels)}
            straddleNone={settings.straddle === 'none'}
            onChange={settings.setLevelRange}
          />
        </Row>

        <Row label={strings.settings.questionCount}>
          <div className="flex flex-wrap gap-2">
            {([10, 20, 50, 0] as QuestionCount[]).map((count) => (
              <Chip
                key={count}
                active={settings.questionCount === count}
                onClick={() => settings.setQuestionCount(count)}
              >
                {count === 0 ? strings.settings.infinite : String(count)}
              </Chip>
            ))}
          </div>
        </Row>

        <Row label={strings.settings.timeLimit}>
          <div className="flex flex-wrap gap-2">
            {([0, 10, 15, 20] as TimeLimitSec[]).map((sec) => (
              <Chip
                key={sec}
                active={settings.timeLimitSec === sec}
                onClick={() => settings.setTimeLimitSec(sec)}
              >
                {sec === 0 ? strings.settings.timeNone : `${sec}${strings.settings.seconds}`}
              </Chip>
            ))}
          </div>
        </Row>

        <Row label={strings.settings.chipDenoms}>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={settings.chipPreset === 'jp'}
              onClick={() => settings.setChipPreset('jp')}
            >
              {strings.settings.chipJp}
            </Chip>
            <Chip
              active={settings.chipPreset === 'us'}
              onClick={() => settings.setChipPreset('us')}
            >
              {strings.settings.chipUs}
            </Chip>
          </div>
          <p className="text-sm text-muted tabular-nums">
            {settings.chipDenoms.join(' / ')}
          </p>
        </Row>

        <Row label={strings.settings.soundVibe}>
          <div className="flex flex-wrap gap-2">
            <Chip active={settings.sound} onClick={() => settings.setSound(!settings.sound)}>
              {`${strings.settings.sound} ${settings.sound ? strings.settings.on : strings.settings.off}`}
            </Chip>
            <Chip active={settings.vibe} onClick={() => settings.setVibe(!settings.vibe)}>
              {`${strings.settings.vibe} ${settings.vibe ? strings.settings.on : strings.settings.off}`}
            </Chip>
          </div>
        </Row>

        <Row label={strings.settings.resetStats}>
          {confirmReset ? (
            <div className="space-y-2">
              <p>{strings.settings.resetConfirm}</p>
              <div className="flex gap-2">
                <Chip
                  active
                  onClick={() => {
                    resetStats();
                    setConfirmReset(false);
                  }}
                >
                  {strings.settings.resetYes}
                </Chip>
                <Chip active={false} onClick={() => setConfirmReset(false)}>
                  {strings.settings.resetNo}
                </Chip>
              </div>
            </div>
          ) : (
            <Chip active={false} onClick={() => setConfirmReset(true)}>
              {strings.settings.resetStats}
            </Chip>
          )}
        </Row>
      </div>
    </div>
  );
}
