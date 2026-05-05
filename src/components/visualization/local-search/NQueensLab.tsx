import { cn } from '@/lib/cn';
import type { NQueensProblem } from '@/types/problem';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { CandidateList, SummaryCards, TraceNotes } from './LocalSearchShared';

interface SharedProps {
  problem: NQueensProblem;
  step: LocalSearchStep | null;
  onSetQueen: (column: number, row: number) => void;
}

export function NQueensMiniature({ state }: { state: number[] }) {
  const size = state.length;
  return (
    <div 
      className="grid gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-1 overflow-hidden"
      style={{ 
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        width: '64px',
        height: '64px'
      }}
    >
      {Array.from({ length: size * size }, (_, index) => {
        const row = Math.floor(index / size);
        const column = index % size;
        const hasQueen = state[column] === row;
        const isDark = (row + column) % 2 === 1;

        return (
          <div
            key={`${row}-${column}`}
            className={cn(
              'aspect-square flex items-center justify-center',
              isDark ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)]',
              hasQueen && 'bg-[#F2C94C]/40'
            )}
          >
            {hasQueen && (
              <span className="text-[#F2C94C] scale-[0.7]" style={{ fontSize: '8px' }}>♛</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QueenBoard({ state, step, onSetQueen }: { state: number[]; step: LocalSearchStep | null; onSetQueen: (column: number, row: number) => void }) {
  const conflictCounts = (step?.state.domainData.conflictCounts as number[] | undefined) ?? Array.from({ length: state.length }, () => 0);
  const movedColumn = Number(step?.state.acceptedMove?.meta?.column ?? step?.state.rejectedMove?.meta?.column ?? -1);
  const targetRow = Number(step?.state.acceptedMove?.meta?.toRow ?? step?.state.rejectedMove?.meta?.toRow ?? -1);

  return (
    <div
      className="grid gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-3 shadow-[0_24px_50px_rgba(0,0,0,0.22)]"
      style={{ gridTemplateColumns: `repeat(${state.length}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: state.length * state.length }, (_, index) => {
        const row = Math.floor(index / state.length);
        const column = index % state.length;
        const hasQueen = state[column] === row;
        const isDark = (row + column) % 2 === 1;
        const isMoved = movedColumn === column && targetRow === row;
        const conflictLevel = conflictCounts[column] ?? 0;

        return (
          <button
            key={`${row}-${column}`}
            onClick={() => onSetQueen(column, row)}
            className={cn(
              'relative flex items-center justify-center aspect-square rounded-lg border text-center transition-colors',
              isDark ? 'border-transparent bg-[var(--surface-2)]' : 'border-transparent bg-[var(--surface)]',
              hasQueen && 'border-[#F2C94C]/35 bg-[#F2C94C]/10',
              isMoved && 'ring-2 ring-[var(--accent)]/70',
            )}
            title={`Column ${column + 1}, row ${row + 1}`}
          >
            <span className="absolute left-1.5 top-1 text-[9px] font-mono text-[var(--text-3)]">
              {column + 1},{row + 1}
            </span>
            {hasQueen && (
              <span
                className={cn(
                  'font-black leading-none',
                  conflictLevel > 0 ? 'text-[#FF7B72]' : 'text-[#F2C94C]',
                )}
                style={{ fontSize: `clamp(12px, ${300 / state.length}px, 24px)` }}
              >
                ♛
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NQueensBoardTab({ problem, step, onSetQueen }: SharedProps) {
  const board = (step?.state.currentState as number[] | undefined) ?? problem.initialState ?? Array.from({ length: problem.size }, (_, index) => index % problem.size);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <SummaryCards step={step} />

        <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)]">
          <section>
            <QueenBoard state={board} step={step} onSetQueen={onSetQueen} />
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Trace</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">What The Algorithm Is Doing</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {step?.description ?? 'Edit the board or change the size, then run a local-search algorithm to see how neighboring states evolve.'}
              </p>
            </div>
            <TraceNotes step={step} fallback="One queen is placed in each column; the goal is to eliminate all attacking pairs." />
          </section>
        </div>
      </div>
    </div>
  );
}

export function NQueensNeighborhoodTab({ problem, step, onSetQueen }: SharedProps) {
  const board = (step?.state.currentState as number[] | undefined) ?? problem.initialState ?? Array.from({ length: problem.size }, (_, index) => index % problem.size);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.72fr)_minmax(320px,1.28fr)]">
          <section>
            <QueenBoard state={board} step={step} onSetQueen={onSetQueen} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Neighborhood</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Candidate Moves</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Each card shows the resulting board if one queen is moved within its column. The active trace highlights which move was accepted or rejected.
              </p>
            </div>
            <CandidateList
              candidates={step?.state.candidateMoves ?? []}
              acceptedMove={step?.state.acceptedMove ?? null}
              objectiveLabel={step?.state.objectiveLabel ?? 'Conflicts'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
