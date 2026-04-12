import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { AlgorithmStep } from '@/types/step';
import type { GameProblem, TicTacToePlayer, TicTacToeProblem } from '@/types/problem';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import StatTile from '@/components/shared/StatTile';
import { Dice5, RotateCcw } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import TicTacToeLab from '@/components/visualization/TicTacToeLab';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import { buildGameTreeElements } from '@/visualizations/adapters/game-tree.adapter';
import type { TicTacToeTraceHighlight, TicTacToeTraceState } from '@/algorithms/game-playing/types';
import { setBoardCell } from '@/lib/tic-tac-toe';
import {
  TIC_TAC_TOE_SCENARIOS,
  createDefaultTicTacToeProblem,
  getTicTacToeScenario,
  normalizeTicTacToeProblem,
  type TicTacToeScenarioId,
} from './tic-tac-toe-lab';

export interface GameLabPresetDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface GameLabContext<TProblem extends GameProblem = GameProblem> {
  algorithmId: string;
  problem: TProblem;
  setProblem: Dispatch<SetStateAction<GameProblem>>;
  step: AlgorithmStep<unknown, unknown> | null;
  openDemoPicker: () => void;
  markProblemChanged: (reason: string) => void;
}

export interface GamePlayingLabModule<TProblem extends GameProblem = GameProblem> {
  id: string;
  name: string;
  description: string;
  category: 'game-playing';
  status: 'live' | 'coming-soon';
  defaultAlgorithmId: string;
  path: string;
  createDefaultProblem: () => TProblem;
  normalizeImportedProblem: (problem: unknown) => TProblem;
  presets: GameLabPresetDefinition[];
  loadPreset: (presetId: string) => TProblem;
  renderConfigPanel: (context: GameLabContext<TProblem>) => ReactNode;
  renderTabs: (context: GameLabContext<TProblem>) => TabDefinition[];
  renderTitleActions: (context: GameLabContext<TProblem>) => ReactNode;
}

function setTicTacToeScenario(
  setProblem: Dispatch<SetStateAction<GameProblem>>,
  scenario: TicTacToeScenarioId,
) {
  setProblem(scenario === 'empty' ? createDefaultTicTacToeProblem() : getTicTacToeScenario(scenario));
}

function renderTicTacToeConfigPanel(context: GameLabContext<TicTacToeProblem>) {
  const problem = context.problem;
  const board = problem.board ?? createDefaultTicTacToeProblem().board ?? [];

  const updatePlayer = (field: 'currentPlayer' | 'maximizingPlayer', value: TicTacToePlayer) => {
    context.setProblem((previous) => ({
      ...(previous as TicTacToeProblem),
      [field]: value,
    }));
    context.markProblemChanged('setup');
  };

  return (
    <ProblemConfigurator title="Tic-Tac-Toe Config">
      <ConfigSection title="Player Setup">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Current Player</p>
            <Select
              value={problem.currentPlayer ?? 'X'}
              onValueChange={(value) => updatePlayer('currentPlayer', value as TicTacToePlayer)}
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
              onValueChange={(value) => updatePlayer('maximizingPlayer', value as TicTacToePlayer)}
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
              onClick={() => {
                setTicTacToeScenario(context.setProblem, 'empty');
                context.markProblemChanged('scenario:empty');
              }}
              className="ui-btn h-7 rounded-md px-2 text-[10px] inline-flex whitespace-nowrap"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {TIC_TAC_TOE_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => {
                  setTicTacToeScenario(context.setProblem, scenario.id);
                  context.markProblemChanged(`scenario:${scenario.id}`);
                }}
                className="ui-btn w-full justify-start rounded-md px-2 py-1.5 text-[11px] font-mono"
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Board Summary" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="X" value={String(board.filter((cell) => cell === 'X').length)} compact className="text-center" />
          <StatTile label="O" value={String(board.filter((cell) => cell === 'O').length)} compact className="text-center" />
          <StatTile label="Empty" value={String(board.filter((cell) => cell == null).length)} compact className="text-center" />
        </div>
      </ConfigSection>
    </ProblemConfigurator>
  );
}

function renderTicTacToeTabs(context: GameLabContext<TicTacToeProblem>): TabDefinition[] {
  const problem = context.problem;
  const step = context.step as AlgorithmStep<TicTacToeTraceState, TicTacToeTraceHighlight> | null;

  const searchTreeElements = step?.state?.searchTree
    ? buildGameTreeElements(
        step.state.searchTree,
        step.highlight.currentNodeId || null,
        step.highlight.principalVariation || null,
        step.stepNumber,
      )
    : [];

  return [
    {
      id: 'board',
      label: 'Problem View',
      content: (
        <TicTacToeLab
          problem={problem}
          step={step}
          onSetCell={(index, value) => {
            context.setProblem((previous) => {
              const current = normalizeTicTacToeProblem(previous);
              const nextBoard = setBoardCell(
                current.board ?? createDefaultTicTacToeProblem().board ?? [],
                index,
                value,
              );
              return { ...current, board: nextBoard };
            });
            context.markProblemChanged('edit');
          }}
        />
      ),
    },
    {
      id: 'tree',
      label: 'Search Tree',
      content: (
        <div className="h-full w-full bg-[#0d1117]">
          {step?.state?.searchTree ? (
            <SVGAutoCanvas elements={searchTreeElements} />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--text-3)] text-xs italic">
              Search tree data will appear here as the algorithm executes.
            </div>
          )}
        </div>
      ),
    },
  ];
}

function renderTicTacToeTitleActions(context: GameLabContext<TicTacToeProblem>) {
  return (
    <TitleBarActionGroup>
      <TitleBarActionButton
        onClick={() => {
          setTicTacToeScenario(context.setProblem, 'empty');
          context.markProblemChanged('scenario:empty');
        }}
        icon={<RotateCcw size={12} />}
        label="Clear"
        title="Clear board"
      />
      <TitleBarActionButton
        onClick={() => {
          setTicTacToeScenario(context.setProblem, 'fork-trap');
          context.markProblemChanged('scenario:fork-trap');
        }}
        icon={<Dice5 size={12} />}
        label="Fork Trap"
        title="Load fork trap scenario"
      />
      <TitleBarActionButton
        onClick={() => {
          setTicTacToeScenario(context.setProblem, 'endgame-win');
          context.markProblemChanged('scenario:endgame-win');
        }}
        icon={<Dice5 size={12} />}
        label="Endgame"
        title="Load endgame scenario"
      />
    </TitleBarActionGroup>
  );
}

export const GAME_PLAYING_LAB_MODULES: GamePlayingLabModule[] = [
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe Lab',
    description: 'Set up board positions and inspect adversarial search with Minimax, Alpha-Beta, Negamax, SSS*, Expectimax, and MCTS.',
    category: 'game-playing',
    status: 'live',
    defaultAlgorithmId: 'alpha-beta',
    path: '/play/tic-tac-toe/alpha-beta',
    createDefaultProblem: createDefaultTicTacToeProblem,
    normalizeImportedProblem: normalizeTicTacToeProblem,
    presets: TIC_TAC_TOE_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      tags: scenario.tags,
    })),
    loadPreset(presetId: string) {
      return getTicTacToeScenario(presetId as Exclude<TicTacToeScenarioId, 'empty'>);
    },
    renderConfigPanel: renderTicTacToeConfigPanel,
    renderTabs: renderTicTacToeTabs,
    renderTitleActions: renderTicTacToeTitleActions,
  },
];

export function renderGameLabPresetPicker(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  lab: GamePlayingLabModule,
  onSelect: (presetId: string) => void,
) {
  return (
    <PresetPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Choose a ${lab.name} Demo`}
      subtitle={`Load a preset scenario for ${lab.name.toLowerCase().replace(' lab', '')}`}
      items={lab.presets}
      onSelect={onSelect}
    />
  );
}
