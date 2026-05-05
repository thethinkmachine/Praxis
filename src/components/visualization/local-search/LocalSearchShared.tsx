import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useExecutionStore } from '@/store/execution.store';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import type { LocalSearchProblem } from '@/types/problem';
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

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible rounded-xl border border-[var(--border)] bg-[var(--bg)]">
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

export function TrajectoryTab({
  step,
  problem,
  renderMiniature
}: {
  step: LocalSearchStep | null;
  problem: LocalSearchProblem;
  renderMiniature?: (state: any, problem: any) => ReactNode;
}) {
  const engine = useExecutionStore(state => state.engine);
  const currentIndex = useExecutionStore(state => state.currentIndex);
  const seekToStep = useExecutionStore(state => state.seekToStep);
  const steps = useMemo(() => {
    return (engine?.getAllSteps() ?? []).slice(0, Math.max(currentIndex + 1, 0)) as LocalSearchStep[];
  }, [engine, currentIndex]);

  const handleJump = (stepNumber: number) => {
    seekToStep(stepNumber);
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--accent)] mb-2">Algorithm Journey</p>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)]">State Trajectory</h2>
            <p className="mt-2 text-sm text-[var(--text-3)] leading-relaxed">
              This timeline captures the evolution of "accepted" states. Unlike a full search tree, local search follows a single path through the state space. Click any milestone to jump back in time.
            </p>
          </div>
          <div className="flex items-center gap-4 px-4 py-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 shrink-0">
            <div className="text-right">
              <p className="text-[9px] font-mono uppercase text-[var(--text-3)]">History Size</p>
              <p className="text-lg font-bold text-[var(--text)]">{steps.length} <span className="text-xs font-normal text-[var(--text-3)] text-opacity-60">steps</span></p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="relative">
            <div className="absolute left-[31px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-[var(--accent)]/50 via-[var(--border)] to-transparent" />
            
            <div className="space-y-8">
              {steps.slice().reverse().slice(0, 15).map((localStep, idx) => {
                const isLatest = idx === 0;
                const isInitial = localStep.stepNumber === 0;
                
                return (
                  <div 
                    key={localStep.stepNumber} 
                    onClick={() => handleJump(localStep.stepNumber)}
                    className={cn(
                      "group relative pl-16 transition-all cursor-pointer",
                      isLatest ? "opacity-100" : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className={cn(
                      "absolute left-6 top-6 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[var(--bg)] transition-transform group-hover:scale-125 z-10",
                      isLatest ? "bg-[var(--accent)] ring-4 ring-[var(--accent)]/20 shadow-[0_0_12px_rgba(var(--accent-rgb),0.5)]" : "bg-[var(--border)]"
                    )} />

                    <div className={cn(
                      "relative rounded-2xl border transition-all duration-300 p-5",
                      isLatest 
                        ? "border-[var(--accent)]/30 bg-[var(--accent-soft)]/20 shadow-[0_8px_30px_rgba(0,0,0,0.12)]" 
                        : "border-[var(--border)] bg-[var(--surface)]/80 hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]/60"
                    )}>
                      <div className="flex flex-col sm:flex-row gap-6">
                        {renderMiniature && (
                          <div className="shrink-0 flex items-center justify-center p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)] shadow-inner w-[74px] h-[74px]">
                            {renderMiniature(localStep.state.currentState, problem)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                              Step {localStep.stepNumber}
                              {isLatest && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--accent)] text-white uppercase tracking-wider">Active</span>}
                              {isInitial && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--text-3)]/20 text-[var(--text-3)] uppercase tracking-wider">Start</span>}
                            </h3>
                            <span className="text-[10px] font-mono text-[var(--text-3)] bg-[var(--surface-3)] px-2 py-0.5 rounded-full lowercase">
                              {localStep.phase}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-2)] line-clamp-2 mb-3 leading-relaxed">
                            {localStep.description}
                          </p>
                          
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#F0883E]" />
                              <span className="text-xs font-medium text-[var(--text-2)]">
                                {localStep.state.objectiveLabel}: <span className="font-mono text-[var(--text)]">{localStep.state.currentDisplayValue}</span>
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-3)] italic font-mono truncate">
                              {localStep.state.currentSummary}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {steps.length > 15 && (
                <div className="pl-16 pt-2 pb-8 text-xs text-[var(--text-3)] italic">
                  + {steps.length - 15} earlier steps...
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute right-[-20px] top-[-20px] h-32 w-32 rounded-full bg-[var(--accent)]/5 blur-3xl" />
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--accent)] mb-3">Performance Peak</p>
              <div className="flex items-start gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text)]">{step?.state.bestSummary ?? 'Waiting...'}</h2>
                  <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed">
                    {step
                      ? `The best known configuration found so far achieves a ${step.state.objectiveLabel.toLowerCase()} of ${step.state.bestDisplayValue}.`
                      : 'Launch the engine to start tracking performance.'}
                  </p>
                </div>
              </div>
              {step && renderMiniature && (
                <div className="mt-5 pt-5 border-t border-[var(--border)]">
                  <p className="text-[9px] font-mono uppercase text-[var(--text-3)] mb-3">Best Configuration Preview</p>
                  <div className="flex justify-center p-4 bg-[var(--bg)] rounded-2xl border border-[var(--border)] min-h-[100px] items-center">
                    {renderMiniature(step.state.bestState, problem)}
                  </div>
                </div>
              )}
            </div>

            {step?.state.populationPreview?.length ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-5 shadow-sm">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)] mb-4">Active Population / Beam</p>
                <div className="space-y-2">
                  {step.state.populationPreview.slice(0, 8).map(member => (
                    <div key={member.id} className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2 hover:bg-[var(--surface-2)] hover:border-[var(--accent)]/30 transition-colors">
                      <span className="text-xs font-medium text-[var(--text-2)] truncate group-hover:text-[var(--text)]">{member.summary}</span>
                      <span className="text-[11px] font-mono font-bold text-[var(--accent)]">{member.displayValue}</span>
                    </div>
                  ))}
                  {step.state.populationPreview.length > 8 && (
                    <p className="text-center text-[10px] text-[var(--text-3)] mt-2">... and {step.state.populationPreview.length - 8} more members</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 p-5">
              <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider mb-2">Algorithm Insights</h4>
              <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
                Local search algorithms (like Hill Climbing or Simulated Annealing) explore the state space by moving from one configuration to a neighbor.
                This trajectory tracks the <strong>Accepted</strong> sequence. Click any card to replay that state.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ViewOverlay({ active, onReset }: { active: boolean; onReset: () => void }) {
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 top-6 z-20 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/95 px-4 py-2 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[11px] font-medium text-[var(--text)]">Playback active: edits locked</span>
        </div>
        <div className="h-3 w-px bg-[var(--border)]" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors active:scale-95"
        >
          Reset to Setup
        </button>
      </div>
    </div>
  );
}

