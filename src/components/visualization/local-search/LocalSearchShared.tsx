import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { useExecutionStore } from '@/store/execution.store';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import type { LocalSearchCandidate } from '@/problems/local-search/types';

export function SummaryCards({ step }: { step: LocalSearchStep | null }) {
  const state = step?.state;
  const objective = state?.objectiveLabel ?? 'Objective';
  const cards = [
    { label: objective, value: state?.currentDisplayValue ?? '-', tone: 'text-[#F0883E]' },
    { label: `Best ${objective}`, value: state?.bestDisplayValue ?? '-', tone: 'text-[#3FB950]' },
    { label: 'Iteration', value: state?.iteration ?? 0, tone: 'text-[#58A6FF]' },
    { label: 'Restarts', value: state?.restartCount ?? 0, tone: 'text-[var(--text)]' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/88 px-4 py-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">{card.label}</p>
          <p className={cn('mt-2 text-2xl font-semibold', card.tone)}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CandidateList({
  candidates,
  acceptedMove,
  objectiveLabel,
}: {
  candidates: LocalSearchCandidate[];
  acceptedMove: LocalSearchCandidate | null;
  objectiveLabel: string;
}) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/88 px-4 py-6 text-sm text-[var(--text-2)]">
        Candidate successors will appear here once the algorithm starts evaluating moves.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {candidates.map(candidate => {
        const isAccepted = acceptedMove?.id === candidate.id;
        return (
          <div
            key={candidate.id}
            className={cn(
              'rounded-2xl border px-4 py-3',
              isAccepted
                ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]/60'
                : 'border-[var(--border)] bg-[var(--surface)]/88',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text)]">{candidate.label}</p>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">
                {isAccepted ? 'accepted' : 'candidate'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--text-2)]">{candidate.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-2)]">
              <span>{`${objectiveLabel.toLowerCase()} ${candidate.displayValue}`}</span>
              <span>{`delta ${candidate.delta >= 0 ? '+' : ''}${typeof candidate.delta === 'number' ? candidate.delta.toFixed(2).replace(/\.00$/, '') : candidate.delta}`}</span>
            </div>
            {candidate.preview && (
              <p className="mt-2 text-[11px] font-mono text-[var(--text-3)] break-all">{candidate.preview}</p>
            )}
            {candidate.details && candidate.details.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {candidate.details.map(detail => (
                  <span key={detail} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-2)]">
                    {detail}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TraceNotes({ step, fallback }: { step: LocalSearchStep | null; fallback: string }) {
  const notes = step?.state.notes ?? [fallback];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Notes</p>
      <div className="mt-3 space-y-2">
        {notes.map((note, index) => (
          <div key={`${note}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 px-3 py-2 text-sm text-[var(--text-2)]">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ObjectiveTab() {
  const engine = useExecutionStore(state => state.engine);
  const currentIndex = useExecutionStore(state => state.currentIndex);
  const points = useMemo(() => {
    const steps = engine?.getAllSteps() ?? [];
    return steps.slice(0, Math.max(currentIndex + 1, 0)).map((step, index) => {
      const state = step.state as { currentValue?: number; bestValue?: number; objectiveLabel?: string; objectiveGoal?: 'minimize' | 'maximize' };
      return {
        index,
        current: state.currentValue ?? 0,
        best: state.bestValue ?? 0,
        label: state.objectiveLabel ?? 'Objective',
        goal: state.objectiveGoal ?? 'minimize',
      };
    });
  }, [engine, currentIndex]);

  if (points.length < 2) {
    return (
      <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/88 px-4 py-6 text-sm text-[var(--text-2)]">
            Objective history appears once the trace has at least two recorded steps.
          </div>
        </div>
      </div>
    );
  }

  const label = points[0].label;
  const goal = points[0].goal;
  const width = 780;
  const height = 280;
  const pad = 28;
  const values = points.flatMap(point => [point.current, point.best]);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const span = Math.max(maxY - minY, 1);
  const stepX = (index: number) => pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const stepY = (value: number) => height - pad - ((value - minY) / span) * (height - pad * 2);
  const currentPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${stepX(index)} ${stepY(point.current)}`).join(' ');
  const bestPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${stepX(index)} ${stepY(point.best)}`).join(' ');

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Objective History</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{label} Over Time</h2>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-2)]">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F0883E]" /> current</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#53C880]" /> best</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible rounded-xl border border-[var(--border)] bg-[#0d151f]">
            {Array.from({ length: 6 }, (_, idx) => {
              const value = minY + (span / 5) * idx;
              return (
                <line
                  key={idx}
                  x1={pad}
                  x2={width - pad}
                  y1={stepY(value)}
                  y2={stepY(value)}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="4 4"
                />
              );
            })}
            <path d={currentPath} fill="none" stroke="#F0883E" strokeWidth="3" strokeLinecap="round" />
            <path d={bestPath} fill="none" stroke="#53C880" strokeWidth="3" strokeLinecap="round" />
          </svg>

          <p className="mt-3 text-sm text-[var(--text-2)]">
            The orange line shows the active state's {label.toLowerCase()} at each recorded step. The green line shows the best value seen so far. This objective is being {goal === 'minimize' ? 'minimized' : 'maximized'}.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrajectoryTab({ step }: { step: LocalSearchStep | null }) {
  const engine = useExecutionStore(state => state.engine);
  const currentIndex = useExecutionStore(state => state.currentIndex);
  const steps = useMemo(() => {
    return (engine?.getAllSteps() ?? []).slice(0, Math.max(currentIndex + 1, 0)) as LocalSearchStep[];
  }, [engine, currentIndex]);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">State Trajectory</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Sampled Run History</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            This view focuses on the accepted trajectory instead of pretending to render the full combinatorial state space. Use it to see how the algorithm's decisions accumulate over time.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Milestones</p>
              <span className="text-[10px] font-mono text-[var(--text-3)]">{steps.length} recorded steps</span>
            </div>
            <div className="space-y-2">
              {steps.slice(Math.max(steps.length - 12, 0)).map(localStep => (
                <div key={localStep.stepNumber} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[var(--text)]">{`Step ${localStep.stepNumber}`}</span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">{localStep.phase}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-2)]">{localStep.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-2)]">
                    <span>{`state ${localStep.state.currentSummary}`}</span>
                    <span>{`${localStep.state.objectiveLabel.toLowerCase()} ${localStep.state.currentDisplayValue}`}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            {step?.state.populationPreview?.length ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Population / Beam</p>
                <div className="mt-3 space-y-2">
                  {step.state.populationPreview.map(member => (
                    <div key={member.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[var(--text)]">{member.summary}</span>
                        <span className="text-[11px] font-mono text-[var(--text-2)]">{member.displayValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Best So Far</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{step?.state.bestSummary ?? 'Run has not started yet.'}</h2>
              <p className="mt-3 text-sm text-[var(--text-2)]">
                {step
                  ? `Best ${step.state.objectiveLabel.toLowerCase()}: ${step.state.bestDisplayValue}.`
                  : 'Start the algorithm to build a trace.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
