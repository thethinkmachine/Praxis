import type { ReactNode } from 'react';
import type { PlanningProblem } from '@/types/problem';
import type { PlanningStep } from '@/algorithms/planning/types';

function Card({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">{kicker}</p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-[var(--text-2)]">{children}</div>
    </section>
  );
}

function BadgeList({
  items,
  emptyLabel,
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-3)] italic">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--text)]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Table({
  headings,
  rows,
}: {
  headings: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="min-w-full divide-y divide-[var(--border)] text-xs">
        <thead className="bg-[var(--surface-2)]/80 text-[var(--text-3)]">
          <tr>
            {headings.map((heading) => (
              <th key={heading} className="px-3 py-2 text-left font-mono uppercase tracking-[0.12em]">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row[0] ?? 'row'}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-[var(--text-2)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(88,166,255,0.12),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1.1fr)_minmax(320px,0.9fr)]">
          <Card kicker="Workspace" title={`${problem.domainName} Workbench`}>
            <p>
              Edit the STRIPS-style initial state and goals, inspect grounded operators, and replay how each planner reasons about the same symbolic world.
            </p>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Current State</p>
              <BadgeList items={currentState} emptyLabel="No literals in the current state." />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Current Goals</p>
              <BadgeList items={currentGoals} emptyLabel="No goal literals configured." />
            </div>
            {selectedAction && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3 text-xs">
                <span className="font-semibold text-[var(--text)]">Selected action:</span> {selectedAction}
              </div>
            )}
          </Card>

          <Card kicker="Schemas" title="Action Schema Summary">
            <Table
              headings={['Schema', 'Parameters', 'Preconditions', 'Add', 'Delete']}
              rows={problem.schemas.map((schema) => [
                `${schema.enabled === false ? '[off] ' : ''}${schema.name}`,
                schema.parameters.map((parameter) => `${parameter.key}:${parameter.objectSet}`).join(', ') || 'none',
                schema.preconditions.join(', ') || 'none',
                schema.addEffects.join(', ') || 'none',
                schema.deleteEffects.join(', ') || 'none',
              ])}
            />
          </Card>
        </div>

        <Card kicker="Grounded Actions" title="Operator Explorer">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groundedActions.map((action) => {
              const applicable = action.preconditions.every((literal) => currentState.includes(literal));
              return (
                <div key={action.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{action.label}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-3)]">
                        pre {action.preconditions.length} / add {action.addEffects.length} / del {action.deleteEffects.length}
                      </p>
                    </div>
                    <button
                      onClick={() => onApplyAction(action.id)}
                      disabled={currentIndex > 0 || !applicable}
                      className="ui-btn h-7 rounded-md px-2 text-[10px] disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div>
                      <span className="font-semibold text-[var(--text)]">Pre:</span> {action.preconditions.join(', ') || 'none'}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--text)]">Add:</span> {action.addEffects.join(', ') || 'none'}
                    </div>
                    {problem.showDeleteEffects !== false && (
                      <div>
                        <span className="font-semibold text-[var(--text)]">Delete:</span> {action.deleteEffects.join(', ') || 'none'}
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
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.12),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card kicker="Search Structures" title="Frontier / Stack / Flaws">
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
                <BadgeList items={goalStack} emptyLabel="Goal stack is empty." />
              </div>
            )}
            {partialPlan && (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Ordering Constraints</p>
                  <BadgeList items={partialPlan.orderings.map(([left, right]) => `${left} < ${right}`)} emptyLabel="No orderings yet." />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Open Flaws</p>
                  <Table
                    headings={['Flaw', 'Detail']}
                    rows={partialPlan.openFlaws.map((flaw) => [flaw.label, flaw.detail])}
                  />
                </div>
              </div>
            )}
            {frontier.length === 0 && goalStack.length === 0 && !partialPlan && (
              <p className="text-xs text-[var(--text-3)] italic">Run a planning algorithm to inspect its active structures.</p>
            )}
          </Card>

          <Card kicker="Local View" title="Applicable Operators / Causal Links">
            {applicableActions.length > 0 ? (
              <Table
                headings={['Action', 'Detail']}
                rows={applicableActions.map((action) => [action.label, action.detail])}
              />
            ) : partialPlan ? (
              <Table
                headings={['Link', 'Literal']}
                rows={partialPlan.causalLinks.map((link) => [`${link.from} -> ${link.to}`, link.literal])}
              />
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">This step does not expose local operators or causal links.</p>
            )}
          </Card>
        </div>

        {graphLayers.length > 0 && (
          <Card kicker="Planning Graph" title="Layered Proposition / Action Growth">
            <Table
              headings={['Level', 'Propositions', 'Actions', 'Prop Mutex', 'Action Mutex']}
              rows={graphLayers.map((layer) => [
                `P${layer.level}`,
                String(layer.propositions.length),
                String(layer.actions.length),
                String(layer.propositionMutex.length),
                String(layer.actionMutex.length),
              ])}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {graphLayers.slice(-2).map((layer) => (
                <div key={layer.level} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3">
                  <p className="text-[11px] font-semibold text-[var(--text)]">Level {layer.level}</p>
                  <p className="mt-2 text-[11px] text-[var(--text-2)]">
                    Props: {layer.propositions.slice(0, 8).join(', ') || 'none'}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-2)]">
                    Mutex: {layer.propositionMutex.slice(0, 4).join(' | ') || 'none'}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

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

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_bottom_left,rgba(83,200,128,0.14),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(320px,1.15fr)]">
          <Card kicker="Sequential Plan" title="Plan Tape">
            <Table
              headings={['Step', 'Action']}
              rows={(plan.length > 0 ? plan : problem.manualActionHistory ?? []).map((action, index) => [
                String(index + 1),
                action,
              ])}
            />
          </Card>

          <Card kicker="Parallel Plan / SAT" title="Extraction + Horizon Summary">
            {parallelPlan.length > 0 ? (
              <Table
                headings={['Layer', 'Actions']}
                rows={parallelPlan.map((actions, index) => [
                  `t=${index}`,
                  actions.join(' | ') || 'NoOp',
                ])}
              />
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">No parallel plan has been extracted for the current step.</p>
            )}
            {cnfSummary.length > 0 && (
              <Table
                headings={['Horizon', 'Props', 'Actions', 'Clauses', 'SAT']}
                rows={cnfSummary.map((entry) => [
                  String(entry.horizon),
                  String(entry.propositionVariables),
                  String(entry.actionVariables),
                  String(entry.clauseCount),
                  entry.satisfiable === undefined ? '–' : entry.satisfiable ? 'yes' : 'no',
                ])}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
