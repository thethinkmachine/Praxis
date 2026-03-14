import { cn } from '@/lib/cn';
import type { NPuzzleProblem } from '@/types/problem';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { CandidateList, SummaryCards, TraceNotes } from './LocalSearchShared';

interface NPuzzleLabProps {
  problem: NPuzzleProblem;
  step: LocalSearchStep | null;
  onMoveTile: (tileIndex: number) => void;
}

export function NPuzzleMiniature({ state, size }: { state: number[]; size: number }) {
  return (
    <div 
      className="grid gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-0.5 overflow-hidden" 
      style={{ 
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        width: '64px',
        height: '64px'
      }}
    >
      {state.map((tile, idx) => (
        <div
          key={`${tile}-${idx}`}
          className={cn(
            'aspect-square flex items-center justify-center text-[8px] font-bold border-[0.5px] border-[var(--border)]/30',
            tile === 0 ? 'bg-[#0d151f] border-dashed' : 'bg-[var(--surface)] text-[var(--text-2)]'
          )}
        >
          {tile !== 0 && tile}
        </div>
      ))}
    </div>
  );
}

function PuzzleBoard({ problem, tiles, onMoveTile, step }: { problem: NPuzzleProblem; tiles: number[]; onMoveTile: (tileIndex: number) => void; step: LocalSearchStep | null }) {
  const blank = Number(step?.state.domainData.blankIndex ?? tiles.indexOf(0));
  const size = problem.size;
  const movable = new Set<number>();
  const row = Math.floor(blank / size);
  const col = blank % size;
  if (row > 0) movable.add(blank - size);
  if (row < size - 1) movable.add(blank + size);
  if (col > 0) movable.add(blank - 1);
  if (col < size - 1) movable.add(blank + 1);

  return (
    <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
      {tiles.map((tile, index) => (
        <button
          key={`${tile}-${index}`}
          onClick={() => tile !== 0 && onMoveTile(index)}
          className={cn(
            'relative aspect-square rounded-2xl border text-center text-2xl font-black transition-colors',
            tile === 0
              ? 'border-dashed border-[var(--border)] bg-[#0d151f] text-transparent'
              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]',
            movable.has(index) && tile !== 0 && 'border-[var(--accent)]/50 bg-[var(--accent-soft)]/45',
          )}
        >
          <span className="absolute left-2 top-2 text-[10px] font-mono text-[var(--text-3)]">{index + 1}</span>
          {tile === 0 ? ' ' : tile}
        </button>
      ))}
    </div>
  );
}

export function NPuzzleBoardTab({ problem, step, onMoveTile }: NPuzzleLabProps) {
  const tiles = (step?.state.currentState as number[] | undefined) ?? problem.tiles;
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(83,200,128,0.14),transparent_28%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <SummaryCards step={step} />
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(320px,1.2fr)]">
          <section>
            <PuzzleBoard problem={problem} tiles={tiles} onMoveTile={onMoveTile} step={step} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Crossover Lab</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">N-Puzzle Under Local Search</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                This lab is intentionally framed as a crossover experiment: local search treats a board arrangement as the state itself and tries to minimize heuristic cost, rather than constructing a path in the classic search sense.
              </p>
            </div>
            <TraceNotes step={step} fallback="Local search is not the canonical way to solve N-Puzzle, which makes this lab useful for contrast: you can see where heuristic cost surfaces become deceptive." />
          </section>
        </div>
      </div>
    </div>
  );
}

export function NPuzzleNeighborhoodTab({ problem, step, onMoveTile }: NPuzzleLabProps) {
  const tiles = (step?.state.currentState as number[] | undefined) ?? problem.tiles;
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.11),transparent_24%),var(--bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.72fr)_minmax(320px,1.28fr)]">
          <section>
            <PuzzleBoard problem={problem} tiles={tiles} onMoveTile={onMoveTile} step={step} />
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Neighborhood</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Single-Slide Moves</h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Each neighbor slides one adjacent tile into the blank. Watch how greedy local search can still oscillate or stall even when the heuristic looks informative.
              </p>
            </div>
            <CandidateList
              candidates={step?.state.candidateMoves ?? []}
              acceptedMove={step?.state.acceptedMove ?? null}
              objectiveLabel={step?.state.objectiveLabel ?? 'Heuristic Cost'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
