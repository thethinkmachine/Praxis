import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AlgorithmStep } from '@/types/step';
import type { TicTacToeTraceHighlight, TicTacToeTraceState } from '@/algorithms/game-playing/types';
import type { TicTacToeCell, TicTacToeProblem, TicTacToePlayer } from '@/types/problem';
import { createEmptyBoard } from '@/lib/tic-tac-toe';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import TicTacToeLab from '@/components/visualization/TicTacToeLab';

type ScenarioId = 'empty' | 'fork-trap' | 'forced-block' | 'endgame-win';

const SCENARIOS: Record<Exclude<ScenarioId, 'empty'>, TicTacToeProblem> = {
  'fork-trap': {
    kind: 'tic-tac-toe',
    board: ['X', null, null, null, 'O', null, null, null, 'X'],
    currentPlayer: 'O',
    maximizingPlayer: 'O',
  },
  'forced-block': {
    kind: 'tic-tac-toe',
    board: ['X', 'X', null, null, 'O', null, null, null, null],
    currentPlayer: 'O',
    maximizingPlayer: 'O',
  },
  'endgame-win': {
    kind: 'tic-tac-toe',
    board: ['X', 'O', 'X', 'O', 'X', null, null, 'O', null],
    currentPlayer: 'X',
    maximizingPlayer: 'X',
  },
};

function createDefaultProblem(): TicTacToeProblem {
  return {
    kind: 'tic-tac-toe',
    board: createEmptyBoard(),
    currentPlayer: 'X',
    maximizingPlayer: 'X',
  };
}

function cycleCell(cell: TicTacToeCell): TicTacToeCell {
  if (cell == null) return 'X';
  if (cell === 'X') return 'O';
  return null;
}

export default function GamePage() {
  const { algo = 'minimax' } = useParams<{ category: string; algo: string }>();
  const [problem, setProblem] = useState<TicTacToeProblem>(createDefaultProblem);
  const step = useExecutionStore(state => state.currentStep as AlgorithmStep<TicTacToeTraceState, TicTacToeTraceHighlight> | null);
  const board = problem.board ?? createEmptyBoard();

  const setScenario = (scenario: ScenarioId) => {
    setProblem(scenario === 'empty' ? createDefaultProblem() : { ...SCENARIOS[scenario] });
  };

  const updatePlayer = (field: 'currentPlayer' | 'maximizingPlayer', value: TicTacToePlayer) => {
    setProblem(prev => ({ ...prev, [field]: value }));
  };

  const handleCycleCell = (index: number) => {
    setProblem(prev => {
      const nextBoard = [...(prev.board ?? createEmptyBoard())];
      nextBoard[index] = cycleCell(nextBoard[index] ?? null);
      return { ...prev, board: nextBoard };
    });
  };

  const configPanel = useMemo(() => (
    <div className="space-y-5 p-1">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Turn Setup</p>
        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--text-2)]">Current Player</span>
            <select
              value={problem.currentPlayer ?? 'X'}
              onChange={(e) => updatePlayer('currentPlayer', e.target.value as TicTacToePlayer)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="X">X to move</option>
              <option value="O">O to move</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--text-2)]">Maximizing Player</span>
            <select
              value={problem.maximizingPlayer ?? 'X'}
              onChange={(e) => updatePlayer('maximizingPlayer', e.target.value as TicTacToePlayer)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="X">X maximizes</option>
              <option value="O">O maximizes</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Scenarios</p>
          <button
            onClick={() => setScenario('empty')}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {([
            ['fork-trap', 'Fork Trap'],
            ['forced-block', 'Forced Block'],
            ['endgame-win', 'Endgame Win'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScenario(id)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/60"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]">Board Summary</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">X</p>
            <p className="mt-1 text-base font-semibold text-[var(--text)]">{board.filter(cell => cell === 'X').length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">O</p>
            <p className="mt-1 text-base font-semibold text-[var(--text)]">{board.filter(cell => cell === 'O').length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">Empty</p>
            <p className="mt-1 text-base font-semibold text-[var(--text)]">{board.filter(cell => cell == null).length}</p>
          </div>
        </div>
      </section>
    </div>
  ), [board, problem.currentPlayer, problem.maximizingPlayer]);

  return (
    <AlgorithmPage
      algorithmId={algo}
      problem={problem}
      problemForActions={problem}
      category="game-playing"
      problemCategory="game"
      onProblemImport={(nextProblem) => setProblem({ ...createDefaultProblem(), ...(nextProblem as TicTacToeProblem), kind: 'tic-tac-toe' })}
      tabs={[
        {
          id: 'board',
          label: 'Board',
          content: <TicTacToeLab problem={problem} step={step} onCycleCell={handleCycleCell} />,
        },
      ]}
      titleActions={
        <>
          <button
            onClick={() => setScenario('empty')}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          >
            Clear
          </button>
          <button
            onClick={() => setScenario('fork-trap')}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          >
            Fork Trap
          </button>
          <button
            onClick={() => setScenario('endgame-win')}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-mono text-[var(--text-2)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          >
            Endgame
          </button>
        </>
      }
      configPanel={configPanel}
      defaultConfigOpen
    />
  );
}
