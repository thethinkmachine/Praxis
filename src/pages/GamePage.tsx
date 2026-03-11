import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AlgorithmStep } from '@/types/step';
import type { TicTacToeTraceHighlight, TicTacToeTraceState } from '@/algorithms/game-playing/types';
import type { TicTacToeCell, TicTacToeProblem, TicTacToePlayer } from '@/types/problem';
import { createEmptyBoard } from '@/lib/tic-tac-toe';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import Select from '@/components/shared/Select';
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
    <ProblemConfigurator title="Tic-Tac-Toe Config">
      <ConfigSection title="Player Setup">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Current Player</p>
            <Select
              value={problem.currentPlayer ?? 'X'}
              onValueChange={(val) => updatePlayer('currentPlayer', val as TicTacToePlayer)}
              options={[
                { value: 'X', label: 'X to move' },
                { value: 'O', label: 'O to move' },
              ]}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Maximizing Player</p>
            <Select
              value={problem.maximizingPlayer ?? 'X'}
              onValueChange={(val) => updatePlayer('maximizingPlayer', val as TicTacToePlayer)}
              options={[
                { value: 'X', label: 'X maximizes' },
                { value: 'O', label: 'O maximizes' },
              ]}
            />
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Scenarios" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Presets</p>
            <button
              onClick={() => setScenario('empty')}
              className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent)]/60 text-[10px] text-[var(--text-2)] transition-colors inline-block whitespace-nowrap"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {([
              ['fork-trap', 'Fork Trap'],
              ['forced-block', 'Forced Block'],
              ['endgame-win', 'Endgame Win'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setScenario(id)}
                className="w-full text-left px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-[11px] font-mono transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Board Summary" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">X</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">{board.filter(cell => cell === 'X').length}</p>
          </div>
          <div className="rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">O</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">{board.filter(cell => cell === 'O').length}</p>
          </div>
          <div className="rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-center">
            <p className="text-[10px] font-mono text-[var(--text-3)]">Empty</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">{board.filter(cell => cell == null).length}</p>
          </div>
        </div>
      </ConfigSection>
    </ProblemConfigurator>
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScenario('empty')}
            className="h-7 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] text-[var(--text-2)] hover:border-[var(--accent)]/60 transition-colors whitespace-nowrap"
          >
            Clear
          </button>
          <button
            onClick={() => setScenario('fork-trap')}
            className="h-7 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] text-[var(--text-2)] hover:border-[var(--accent)]/60 transition-colors whitespace-nowrap"
          >
            Fork Trap
          </button>
          <button
            onClick={() => setScenario('endgame-win')}
            className="h-7 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] text-[var(--text-2)] hover:border-[var(--accent)]/60 transition-colors whitespace-nowrap"
          >
            Endgame
          </button>
        </div>
      }
      configPanel={configPanel}
      defaultConfigOpen
    />
  );
}
