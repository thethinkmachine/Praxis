import type { ReactNode } from 'react';
import type { PlanningProblem } from '@/types/problem';
import type { PlanningStep } from '@/algorithms/planning/types';
import PlanningGraphVisualizer from './PlanningGraphVisualizer';

/* ── Shared UI primitives ──────────────────────────────────── */

const ACCENT_COLORS = {
  blue: 'rgba(88,166,255,0.12)',
  amber: 'rgba(210,153,34,0.12)',
  green: 'rgba(63,185,80,0.14)',
  red: 'rgba(248,81,73,0.10)',
  purple: 'rgba(188,140,255,0.12)',
} as const;

function Card({
  kicker,
  title,
  accent = 'blue',
  children,
}: {
  kicker: string;
  title: string;
  accent?: keyof typeof ACCENT_COLORS;
  children: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl"
        style={{ background: ACCENT_COLORS[accent] }}
      />
      <div className="relative p-3.5">
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">{kicker}</p>
        <h2 className="mt-0.5 text-sm font-semibold text-[var(--text)]">{title}</h2>
        <div className="mt-2.5 space-y-3 text-sm text-[var(--text-2)]">{children}</div>
      </div>
    </section>
  );
}

type LiteralStatus = 'satisfied' | 'unsatisfied' | 'neutral' | 'deleted' | 'selected';

const STATUS_STYLES: Record<LiteralStatus, string> = {
  satisfied: 'border-[#3fb950]/50 bg-[#3fb950]/10 text-[#3fb950]',
  unsatisfied: 'border-[#d29922]/50 bg-[#d29922]/8 text-[#d29922]',
  neutral: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]',
  deleted: 'border-[#f85149]/40 bg-[#f85149]/8 text-[#f85149] line-through',
  selected: 'border-[#79c0ff]/50 bg-[#79c0ff]/10 text-[#79c0ff]',
};

function Chip({ label, status = 'neutral' }: { label: string; status?: LiteralStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors ${STATUS_STYLES[status]}`}>
      {status === 'satisfied' && <span className="mr-1 text-[9px]">✓</span>}
      {status === 'unsatisfied' && <span className="mr-1 text-[9px]">○</span>}
      {label}
    </span>
  );
}

function ChipList({
  items,
  emptyLabel,
  goalSet,
  stateSet,
}: {
  items: string[];
  emptyLabel: string;
  goalSet?: Set<string>;
  stateSet?: Set<string>;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-3)] italic">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        let status: LiteralStatus = 'neutral';
        if (goalSet && stateSet) {
          status = stateSet.has(item)
            ? (goalSet.has(item) ? 'satisfied' : 'neutral')
            : (goalSet.has(item) ? 'unsatisfied' : 'neutral');
        } else if (goalSet) {
          status = goalSet.has(item) ? 'satisfied' : 'neutral';
        }
        return <Chip key={item} label={item} status={status} />;
      })}
    </div>
  );
}

function Table({ headings, rows }: { headings: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="min-w-full divide-y divide-[var(--border)] text-xs">
        <thead className="bg-[var(--surface-2)]/60 text-[var(--text-3)]">
          <tr>
            {headings.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-mono uppercase tracking-[0.12em]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row, ri) => (
            <tr key={`${ri}-${row[0] ?? 'row'}`} className="hover:bg-[var(--surface-2)]/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={`${ri}-${ci}`} className="px-3 py-2 align-top text-[var(--text-2)]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalProgress({ satisfied, total }: { satisfied: number; total: number }) {
  const pct = total > 0 ? Math.round((satisfied / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100
              ? 'linear-gradient(90deg, #3fb950, #56d364)'
              : 'linear-gradient(90deg, #d29922, #e3b341)',
          }}
        />
      </div>
      <span className="text-[11px] font-mono text-[var(--text-3)]">
        {satisfied}/{total}
      </span>
    </div>
  );
}

function PlanTimeline({ actions, label = 'Plan' }: { actions: string[]; label?: string }) {
  if (actions.length === 0) {
    return <p className="text-xs text-[var(--text-3)] italic">No actions in {label.toLowerCase()} yet.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.map((action, i) => (
        <span key={`${i}-${action}`} className="flex items-center gap-1">
          <span className="inline-flex items-center rounded-lg border border-[#79c0ff]/30 bg-[#79c0ff]/8 px-2.5 py-1 text-[11px] font-mono text-[#79c0ff]">
            <span className="mr-1.5 text-[9px] text-[var(--text-3)]">{i + 1}</span>
            {action}
          </span>
          {i < actions.length - 1 && (
            <svg width="12" height="8" viewBox="0 0 12 8" className="text-[var(--text-3)]">
              <path d="M0,4 L8,4 M6,1 L9,4 L6,7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

/* ── Overview Tab ───────────────────────────────────────────── */

export function PlanningOverviewTab({
  problem,
  step,
  currentIndex,
  onApplyAction,
}: {
  problem: PlanningProblem;
  step: PlanningStep | null;
  currentIndex: number;
  onApplyAction: (actionId: string) => void;
}) {
  const currentState = step?.state.currentStateLiterals ?? problem.initialLiterals;
  const currentGoals = step?.state.currentGoals ?? problem.goalLiterals;
  const selectedAction = step?.state.selectedActionLabel ?? null;
  const groundedActions = problem.groundedActions;
  const goalSet = new Set(currentGoals);
  const stateSet = new Set(currentState);
  const satisfied = currentGoals.filter((g) => stateSet.has(g)).length;

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top_left,rgba(88,166,255,0.08),transparent_50%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 pt-2 px-4 pb-4">
        {/* Header row */}
        <div className="grid gap-3 lg:grid-cols-[minmax(320px,1.1fr)_minmax(320px,0.9fr)]">
          <Card kicker="Workspace" title={`${problem.domainName} Workbench`} accent="blue">
            <p>
              Inspect the STRIPS-style initial state and goals, explore grounded operators, and trace how each planner reasons about the same symbolic world.
            </p>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[var(--text)]">Goal Progress</p>
                <span className="text-[10px] text-[var(--text-3)]">{satisfied === currentGoals.length ? '✓ All satisfied' : `${currentGoals.length - satisfied} remaining`}</span>
              </div>
              <GoalProgress satisfied={satisfied} total={currentGoals.length} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Current State</p>
              <ChipList items={currentState} emptyLabel="No literals in the current state." goalSet={goalSet} stateSet={stateSet} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Current Goals</p>
              <ChipList items={currentGoals} emptyLabel="No goal literals configured." goalSet={goalSet} stateSet={stateSet} />
            </div>
            {selectedAction && (
              <div className="rounded-xl border border-[#79c0ff]/30 bg-[#79c0ff]/6 p-3 text-xs">
                <span className="font-semibold text-[#79c0ff]">▶ Selected:</span>{' '}
                <span className="font-mono text-[var(--text)]">{selectedAction}</span>
              </div>
            )}
          </Card>

          <Card kicker="Schemas" title="Action Schema Summary" accent="amber">
            <Table
              headings={['Schema', 'Params', 'Pre', 'Add', 'Del']}
              rows={problem.schemas.map((schema) => [
                `${schema.enabled === false ? '⊘ ' : ''}${schema.name}`,
                schema.parameters.map((p) => `${p.key}:${p.objectSet}`).join(', ') || '—',
                schema.preconditions.join(', ') || '—',
                schema.addEffects.join(', ') || '—',
                schema.deleteEffects.join(', ') || '—',
              ])}
            />
          </Card>
        </div>

        {/* Grounded actions */}
        <Card kicker="Grounded Actions" title="Operator Explorer" accent="purple">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groundedActions.map((action) => {
              const applicable = action.preconditions.every((l) => currentState.includes(l));
              return (
                <div
                  key={action.id}
                  className={`rounded-xl border p-3 transition-all ${
                    applicable
                      ? 'border-[#3fb950]/30 bg-[#3fb950]/4 hover:border-[#3fb950]/50'
                      : 'border-[var(--border)] bg-[var(--surface-2)]/40 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{action.label}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-3)] font-mono">
                        pre {action.preconditions.length} · add {action.addEffects.length} · del {action.deleteEffects.length}
                      </p>
                    </div>
                    <button
                      onClick={() => onApplyAction(action.id)}
                      disabled={currentIndex > 0 || !applicable}
                      className={`h-7 rounded-lg px-2.5 text-[10px] font-semibold transition-all ${
                        applicable && currentIndex === 0
                          ? 'bg-[#3fb950]/15 text-[#3fb950] hover:bg-[#3fb950]/25 border border-[#3fb950]/30'
                          : 'bg-[var(--surface-2)] text-[var(--text-3)] opacity-40 border border-[var(--border)]'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-[11px]">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] font-semibold text-[var(--text-3)] w-7">Pre</span>
                      {action.preconditions.map((p) => (
                        <Chip key={p} label={p} status={currentState.includes(p) ? 'satisfied' : 'unsatisfied'} />
                      ))}
                      {action.preconditions.length === 0 && <span className="text-[var(--text-3)] italic">none</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] font-semibold text-[var(--text-3)] w-7">Add</span>
                      {action.addEffects.map((e) => <Chip key={e} label={e} status="neutral" />)}
                    </div>
                    {problem.showDeleteEffects !== false && action.deleteEffects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-semibold text-[var(--text-3)] w-7">Del</span>
                        {action.deleteEffects.map((e) => <Chip key={e} label={e} status="deleted" />)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Structure Tab ─────────────────────────────────────────── */

export function PlanningStructureTab({
  problem,
  step,
}: {
  problem: PlanningProblem;
  step: PlanningStep | null;
}) {
  const trace = step?.state;
  const graphLayers = trace?.graphLayers ?? [];
  const partialPlan = trace?.partialPlan;
  const frontier = trace?.frontier ?? [];
  const applicableActions = trace?.applicableActions ?? [];
  const goalStack = trace?.goalStack ?? [];

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(242,201,76,0.08),transparent_50%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 pt-2 px-4 pb-4">
        {/* Planning Graph visualization */}
        {graphLayers.length > 0 && (
          <Card kicker="Planning Graph" title="Layered Proposition / Action Growth" accent="blue">
            <PlanningGraphVisualizer
              layers={graphLayers}
              extractedPlan={trace?.extractedPlan ?? []}
              goalLiterals={problem.goalLiterals}
              focusLevel={step?.highlight?.focusLayer}
            />
            <Table
              headings={['Level', 'Props', 'Actions', 'Prop Mutex', 'Act Mutex']}
              rows={graphLayers.map((layer) => [
                `P${layer.level}`,
                String(layer.propositions.length),
                String(layer.actions.length),
                String(layer.propositionMutex.length),
                String(layer.actionMutex.length),
              ])}
            />
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card kicker="Search Structures" title="Frontier / Stack / Flaws" accent="amber">
            {frontier.length > 0 && (
              <Table
                headings={['State', 'Depth', 'h', 'Plan']}
                rows={frontier.map((entry) => [
                  entry.label,
                  String(entry.depth),
                  String(entry.heuristic),
                  String(entry.planLength),
                ])}
              />
            )}
            {goalStack.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Goal Stack</p>
                <div className="space-y-1">
                  {goalStack.map((entry, idx) => (
                    <div
                      key={`${idx}-${entry}`}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-mono transition-all ${
                        idx === 0
                          ? 'border-[#79c0ff]/40 bg-[#79c0ff]/8 text-[#79c0ff]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]/40 text-[var(--text-2)]'
                      }`}
                    >
                      <span className="text-[9px] text-[var(--text-3)]">{idx === 0 ? '▸' : ' '}</span>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {partialPlan && (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Ordering Constraints</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partialPlan.orderings.map(([l, r], i) => (
                      <span key={`${i}-${l}-${r}`} className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-2)]">
                        {l} <span className="mx-1 text-[var(--text-3)]">≺</span> {r}
                      </span>
                    ))}
                    {partialPlan.orderings.length === 0 && <p className="text-xs text-[var(--text-3)] italic">No orderings yet.</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Open Flaws</p>
                  {partialPlan.openFlaws.length > 0 ? (
                    <div className="space-y-1.5">
                      {partialPlan.openFlaws.map((flaw) => (
                        <div
                          key={flaw.id}
                          className={`rounded-lg border px-3 py-2 text-[11px] ${
                            flaw.type === 'threat'
                              ? 'border-[#f85149]/30 bg-[#f85149]/6'
                              : 'border-[#d29922]/30 bg-[#d29922]/6'
                          }`}
                        >
                          <span className="font-semibold text-[var(--text)]">{flaw.label}</span>
                          <span className="ml-2 text-[var(--text-3)]">{flaw.detail}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#3fb950] italic">All flaws resolved ✓</p>
                  )}
                </div>
              </div>
            )}
            {frontier.length === 0 && goalStack.length === 0 && !partialPlan && (
              <p className="text-xs text-[var(--text-3)] italic">Run a planning algorithm to inspect its active structures.</p>
            )}
          </Card>

          <Card kicker="Local View" title="Applicable Operators / Causal Links" accent="green">
            {applicableActions.length > 0 ? (
              <Table
                headings={['Action', 'Detail']}
                rows={applicableActions.map((a) => [a.label, a.detail])}
              />
            ) : partialPlan ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[var(--text)]">Causal Links</p>
                {partialPlan.causalLinks.length > 0 ? (
                  <div className="space-y-1.5">
                    {partialPlan.causalLinks.map((link) => (
                      <div key={link.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-1.5 text-[11px] font-mono">
                        <span className="text-[#58a6ff]">{link.from}</span>
                        <svg width="16" height="8" viewBox="0 0 16 8" className="text-[var(--text-3)]">
                          <path d="M0,4 L12,4 M10,1 L13,4 L10,7" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                        <span className="text-[#58a6ff]">{link.to}</span>
                        <span className="ml-auto rounded border border-[#3fb950]/30 bg-[#3fb950]/8 px-1.5 py-0.5 text-[10px] text-[#3fb950]">{link.literal}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-3)] italic">No causal links established yet.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">This step does not expose local operators or causal links.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Plan Tab ──────────────────────────────────────────────── */

export function PlanningPlanTab({
  problem,
  step,
}: {
  problem: PlanningProblem;
  step: PlanningStep | null;
}) {
  const plan = step?.state.planSoFar ?? [];
  const parallelPlan = step?.state.extractedPlan ?? [];
  const cnfSummary = step?.state.cnfSummary ?? [];
  const displayPlan = plan.length > 0 ? plan : problem.manualActionHistory ?? [];

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_bottom_left,rgba(83,200,128,0.08),transparent_50%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 pt-2 px-4 pb-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(320px,0.85fr)_minmax(320px,1.15fr)]">
          <Card kicker="Sequential Plan" title="Plan Tape" accent="green">
            <PlanTimeline actions={displayPlan} />
            {displayPlan.length > 0 && (
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2 text-[11px] text-[var(--text-3)] font-mono">
                Total steps: {displayPlan.length}
              </div>
            )}
          </Card>

          <Card kicker="Parallel Plan / SAT" title="Extraction + Horizon Summary" accent="purple">
            {parallelPlan.length > 0 ? (
              <div className="space-y-1.5">
                {parallelPlan.map((actions, i) => (
                  <div key={`par-${i}`} className="flex items-start gap-2">
                    <span className="mt-1 flex h-5 w-8 flex-shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[9px] font-mono text-[var(--text-3)]">
                      t={i}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {actions.length > 0 ? actions.map((a) => (
                        <Chip key={a} label={a} status="selected" />
                      )) : (
                        <span className="text-[11px] italic text-[var(--text-3)]">NoOp</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">No parallel plan has been extracted for the current step.</p>
            )}
            {cnfSummary.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">SAT Encoding Summary</p>
                <Table
                  headings={['H', 'Prop Vars', 'Act Vars', 'Clauses', 'SAT?']}
                  rows={cnfSummary.map((entry) => [
                    String(entry.horizon),
                    String(entry.propositionVariables),
                    String(entry.actionVariables),
                    String(entry.clauseCount),
                    entry.satisfiable === undefined ? '–' : entry.satisfiable ? '✓ yes' : '✗ no',
                  ])}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
