import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { AlgorithmStep } from '@/types/step';
import type { TicTacToeCell, TicTacToeProblem } from '@/types/problem';
import type { TicTacToeTraceHighlight, TicTacToeTraceState } from '@/algorithms/game-playing/types';
import { getWinningLine } from '@/lib/tic-tac-toe';

const CELL_EDITOR_OPTIONS: Array<{ label: string; value: TicTacToeCell; description: string }> = [
  { label: 'X', value: 'X', description: 'Set selected cell to X' },
  { label: 'O', value: 'O', description: 'Set selected cell to O' },
  { label: 'Erase', value: null, description: 'Clear selected cell' },
];

interface TicTacToeLabProps {
  problem: TicTacToeProblem;
  step: AlgorithmStep<TicTacToeTraceState, TicTacToeTraceHighlight> | null;
  onSetCell: (index: number, value: TicTacToeCell) => void;
}

const CELL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function TicTacToeLab({ problem, step, onSetCell }: TicTacToeLabProps) {
  const [selectedCellValue, setSelectedCellValue] = useState<TicTacToeCell>('X');
  const traceState = step?.state as TicTacToeTraceState | undefined;
  const traceHighlight = step?.highlight as TicTacToeTraceHighlight | undefined;
  const board = traceState?.board ?? problem.board ?? Array<TicTacToeCell>(9).fill(null);
  const winningLine = traceHighlight?.winningLine ?? traceState?.winningLine ?? getWinningLine(board);
  const bestMove = traceState?.bestMove ?? null;
  const candidateCells = traceHighlight?.candidateCells ? Array.from(traceHighlight.candidateCells) : [];

  const currentPlayer = traceState?.currentPlayer ?? problem.currentPlayer ?? 'X';

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(242,201,76,0.12),transparent_30%),var(--bg)]">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Board</p>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text)] truncate">Tic-Tac-Toe Lab</h2>
              <div className="mt-1">
                <p className="text-xs text-[var(--text-2)] leading-relaxed">
                  Choose X, O, or Erase, then click a square to set that cell directly.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex flex-wrap justify-end gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
                {CELL_EDITOR_OPTIONS.map((option) => {
                  const isSelected = selectedCellValue === option.value;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setSelectedCellValue(option.value)}
                      aria-pressed={isSelected}
                      title={option.description}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-all',
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)]'
                          : 'text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-right min-w-[70px]">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Current Player</p>
                <p className="mt-0.5 text-lg font-semibold text-[var(--accent)]">{currentPlayer}</p>
              </div>
            </div>
          </div>

          <div className={cn(
            "grid grid-cols-3 gap-3 transition-opacity duration-300"
          )}>
            {board.map((cell, index) => {
              const isWinning = winningLine?.includes(index);
              const isCandidate = candidateCells.includes(index);
              const isBest = bestMove === index;
              const isCurrent = traceState?.currentMove === index;

              return (
                <button
                  key={index}
                  onClick={() => onSetCell(index, selectedCellValue)}
                  className={cn(
                    'group relative aspect-square rounded-2xl border text-4xl font-black transition-all',
                    'bg-[var(--surface-2)] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                    'hover:border-[var(--accent)]/70 hover:bg-[var(--accent-soft)]/70 hover:scale-[1.02] active:scale-[0.98]',
                    isWinning && 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]',
                    isBest && !isWinning && 'border-[#F2C94C] bg-[#F2C94C]/12 text-[#F2C94C]',
                    isCurrent && !isWinning && 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]',
                    !isCurrent && !isWinning && !isBest && isCandidate && 'border-[var(--border-strong)]',
                  )}
                >
                  <span className="absolute left-2 top-2 text-[10px] font-mono text-[var(--text-3)]">
                    {CELL_LABELS[index]}
                  </span>
                  <span className={cn(
                    "transition-transform duration-200",
                    cell && "scale-100",
                    !cell && "scale-0"
                  )}>{cell ?? ''}</span>
                  {isBest && (
                    <span className="absolute bottom-2 right-2 rounded-md border border-[#F2C94C]/40 bg-[#F2C94C]/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#F2C94C]">
                      best
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex min-h-[320px] flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/88 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Maximizing Player</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">{traceState?.maximizingPlayer ?? problem.maximizingPlayer ?? 'X'}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Current Best</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {bestMove == null ? 'Pending' : `Cell ${bestMove + 1}`}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Score</p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {traceState?.bestScore ?? traceState?.currentScore ?? '-'}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
              {step?.description ?? 'Edit the board to create a position, then scrub through the trace to see how the algorithm evaluates replies.'}
            </p>
          </div>

          <div className="grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/88 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Evaluated Moves</p>
                <span className="text-[10px] font-mono text-[var(--text-3)]">
                  {traceState?.evaluatedMoves.length ?? 0} scored
                </span>
              </div>
              {traceState?.evaluatedMoves?.length ? (
                <div className="space-y-2">
                  {traceState.evaluatedMoves.map((move, index) => (
                    <div
                      key={`${move.move}-${index}`}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-3 py-2',
                        move.move === bestMove
                          ? 'border-[#F2C94C]/45 bg-[#F2C94C]/10'
                          : 'border-[var(--border)] bg-[var(--surface-2)]/70',
                      )}
                    >
                      <span className="text-sm font-medium text-[var(--text)]">{`Cell ${move.move + 1}`}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-mono text-sm text-[var(--text-2)]">{move.score}</span>
                        {move.detail && <span className="text-[10px] text-[var(--text-3)]">{move.detail}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-4 text-sm text-[var(--text-2)]">
                  Candidate move scores will appear here as the recursion unwinds.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/88 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Recursion Stack</p>
                <span className="text-[10px] font-mono text-[var(--text-3)]">
                  {traceState?.recursionStack.length ?? 0} frames
                </span>
              </div>
              {traceState?.recursionStack?.length ? (
                <div className="space-y-2">
                  {traceState.recursionStack.map((frame, index) => (
                    <div key={`${frame.depth}-${frame.move}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--text)]">
                          {frame.role.toUpperCase()} depth {frame.depth}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-3)]">
                          {frame.move == null ? 'root' : `cell ${frame.move + 1}`}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-2)]">
                        <span>{`player ${frame.player}`}</span>
                        {frame.alpha !== undefined && <span>{`a=${frame.alpha}`}</span>}
                        {frame.beta !== undefined && <span>{`b=${frame.beta}`}</span>}
                        {frame.bestScore !== undefined && frame.bestScore !== null && <span>{`best=${frame.bestScore}`}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-4 text-sm text-[var(--text-2)]">
                  The active recursive call chain will be shown here.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
