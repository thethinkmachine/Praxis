import type { ReactNode } from 'react';
import type { CspProblem, CspValue } from '@/types/problem';
import type { CspStep } from '@/algorithms/csp/types';

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

function SudokuBoard({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  const assignment = step?.state.assignment ?? {};
  const domains = step?.state.domains ?? Object.fromEntries(problem.variables.map((variable) => [variable.id, variable.domain]));

  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-2">
      {problem.variables
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((variable) => {
          const assigned = assignment[variable.id];
          const domain = domains[variable.id] ?? [];
          return (
            <div
              key={variable.id}
              className="flex min-h-[72px] flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2"
            >
              <span className="text-[9px] font-mono text-[var(--text-3)]">{variable.label}</span>
              <span className="mt-1 text-xl font-semibold text-[var(--text)]">
                {assigned ?? '·'}
              </span>
              <span className="mt-1 text-[10px] text-[var(--text-3)]">
                {assigned === undefined ? domain.join(',') : 'fixed'}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function CryptarithmView({
  step,
}: {
  step: CspStep | null;
}) {
  const assignment = step?.state.assignment ?? {};
  const pairs = ['S', 'E', 'N', 'D', 'M', 'O', 'R', 'Y', 'C1', 'C2', 'C3', 'C4'];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-4 font-mono text-lg text-[var(--text)]">
        <div className="text-right">SEND</div>
        <div className="text-right">+ MORE</div>
        <div className="border-t border-[var(--border)] pt-2 text-right">MONEY</div>
      </div>
      <Table
        headings={['Symbol', 'Value']}
        rows={pairs.map((symbol) => [symbol, assignment[symbol] === undefined ? '–' : String(assignment[symbol])])}
      />
    </div>
  );
}

function SchedulingView({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  const assignment = step?.state.assignment ?? {};
  const slots = ['0', '1', '2'];
  const rooms = ['R1', 'R2'];

  return (
    <Table
      headings={['Slot', ...rooms]}
      rows={slots.map((slot) => [
        slot,
        ...rooms.map((room) => (
          problem.variables
            .filter((variable) => String(assignment[variable.id] ?? '').startsWith(`${slot}|${room}`))
            .map((variable) => variable.label ?? variable.id)
            .join(', ') || '–'
        )),
      ])}
    />
  );
}

function ConstraintNetworkView({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  const assignment = step?.state.assignment ?? {};
  const domains = step?.state.domains ?? Object.fromEntries(problem.variables.map((variable) => [variable.id, variable.domain]));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {problem.variables.map((variable) => (
        <div key={variable.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{variable.label ?? variable.id}</p>
              <p className="mt-1 text-[11px] text-[var(--text-3)]">{variable.id}</p>
            </div>
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-mono text-[var(--text)]">
              {assignment[variable.id] === undefined ? 'unassigned' : String(assignment[variable.id])}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-2)]">
            Domain: {(domains[variable.id] ?? []).join(', ')}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CspNetworkTab({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(88,166,255,0.12),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)]">
          <Card kicker="Network" title={problem.title}>
            {problem.lab === 'sudoku' ? (
              <SudokuBoard problem={problem} step={step} />
            ) : problem.lab === 'cryptarithm' ? (
              <CryptarithmView step={step} />
            ) : problem.lab === 'scheduling' ? (
              <SchedulingView problem={problem} step={step} />
            ) : (
              <ConstraintNetworkView problem={problem} step={step} />
            )}
          </Card>

          <Card kicker="Summary" title="Constraint View">
            <p>
              Variables: {problem.variables.length} | Constraints: {problem.constraints.length}
            </p>
            <Table
              headings={['Constraint', 'Scope', 'Type']}
              rows={problem.constraints.slice(0, 12).map((constraint) => [
                constraint.id,
                constraint.variables.join(', '),
                constraint.type,
              ])}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function CspDomainsTab({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  const state = step?.state;
  const domains = state?.domains ?? Object.fromEntries(problem.variables.map((variable) => [variable.id, variable.domain]));
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.12),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card kicker="Domains" title="Current Domain Store">
            <Table
              headings={['Variable', 'Domain']}
              rows={Object.entries(domains).map(([variable, values]) => [variable, values.map(String).join(', ') || '∅'])}
            />
          </Card>

          <Card kicker="Pruning" title="Ordered Values + Removed Values">
            {state?.orderedValues && state.orderedValues.length > 0 ? (
              <Table
                headings={['Value', 'Score']}
                rows={state.orderedValues.map((entry) => [String(entry.value), entry.score === undefined ? '–' : String(entry.score)])}
              />
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">No value-order trace for the current step.</p>
            )}

            {state?.prunedValues && state.prunedValues.length > 0 && (
              <Table
                headings={['Variable', 'Value', 'Reason']}
                rows={state.prunedValues.map((entry) => [entry.variable, String(entry.value), entry.reason])}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function CspSearchTab({
  problem,
  step,
}: {
  problem: CspProblem;
  step: CspStep | null;
}) {
  const state = step?.state;
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_bottom_left,rgba(83,200,128,0.14),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(320px,1.1fr)]">
          <Card kicker="Search" title="Stack / Queue / Violations">
            <Table
              headings={['Type', 'Entries']}
              rows={[
                ['Recursion Stack', state?.recursionStack.join(' -> ') || '–'],
                ['Arc Queue', state?.arcQueue.join(' | ') || '–'],
                ['Violations', state?.violatedConstraints.join(' | ') || '–'],
              ]}
            />
          </Card>

          <Card kicker="Notes" title="Trace Notes">
            {state?.notes && state.notes.length > 0 ? (
              <Table
                headings={['Note']}
                rows={state.notes.map((note) => [note])}
              />
            ) : (
              <p className="text-xs text-[var(--text-3)] italic">Run a CSP algorithm to inspect its trace notes.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
