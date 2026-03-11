import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AlgorithmStep } from '@/types/step';
import type { TicTacToeTraceHighlight, TicTacToeTraceState } from '@/algorithms/game-playing/types';
import type { TicTacToeCell, TicTacToeProblem, TicTacToePlayer } from '@/types/problem';
import { createEmptyBoard } from '@/lib/tic-tac-toe';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import { Dice5, RotateCcw } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import TicTacToeLab from '@/components/visualization/TicTacToeLab';
import StatTile from '@/components/shared/StatTile';

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
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
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
              className="ui-btn h-7 rounded-md px-2 text-[10px] inline-flex whitespace-nowrap"
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
                className="ui-btn w-full justify-start rounded-md px-2 py-1.5 text-[11px] font-mono"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Board Summary" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="X" value={String(board.filter(cell => cell === 'X').length)} compact className="text-center" />
          <StatTile label="O" value={String(board.filter(cell => cell === 'O').length)} compact className="text-center" />
          <StatTile label="Empty" value={String(board.filter(cell => cell == null).length)} compact className="text-center" />
        </div>
      </ConfigSection>
    </ProblemConfigurator>
  ), [board, problem.currentPlayer, problem.maximizingPlayer]);

  return (
    <>
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
            label: 'Problem View',
            content: <TicTacToeLab problem={problem} step={step} onCycleCell={handleCycleCell} />,
          },
        ]}
        titleActions={
          <TitleBarActionGroup>
            <TitleBarActionButton onClick={() => setScenario('empty')} icon={<RotateCcw size={12} />} label="Clear" title="Clear board" />
            <TitleBarActionButton onClick={() => setScenario('fork-trap')} icon={<Dice5 size={12} />} label="Fork Trap" title="Load fork trap scenario" />
            <TitleBarActionButton onClick={() => setScenario('endgame-win')} icon={<Dice5 size={12} />} label="Endgame" title="Load endgame scenario" />
          </TitleBarActionGroup>
        }
        configPanel={configPanel}
        defaultConfigOpen
        onDemoRequest={() => setDemoDialogOpen(true)}
      />
      <PresetPickerDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        title="Choose a Demo Position"
        subtitle="Load a preset tic-tac-toe scenario"
        items={[
          {
            id: 'fork-trap',
            name: 'Fork Trap',
            description: 'A tactical position where the maximizing player must spot an incoming fork.',
            tags: ['midgame', 'tactics'],
          },
          {
            id: 'forced-block',
            name: 'Forced Block',
            description: 'A defensive setup that tests whether the algorithm blocks an immediate threat.',
            tags: ['defense', 'forced move'],
          },
          {
            id: 'endgame-win',
            name: 'Endgame Win',
            description: 'A late-game position with a concrete winning continuation to evaluate.',
            tags: ['endgame', 'winning line'],
          },
        ]}
        onSelect={(scenarioId) => setScenario(scenarioId as ScenarioId)}
      />
    </>
  );
}
