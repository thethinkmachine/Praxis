import { createEmptyBoard } from '@/lib/tic-tac-toe';
import type { TicTacToeProblem } from '@/types/problem';

export type TicTacToeScenarioId = 'empty' | 'fork-trap' | 'forced-block' | 'endgame-win';

export interface TicTacToeScenarioDefinition {
  id: Exclude<TicTacToeScenarioId, 'empty'>;
  name: string;
  description: string;
  tags: string[];
  problem: TicTacToeProblem;
}

export function createDefaultTicTacToeProblem(): TicTacToeProblem {
  return {
    kind: 'tic-tac-toe',
    board: createEmptyBoard(),
    currentPlayer: 'X',
    maximizingPlayer: 'X',
  };
}

export function normalizeTicTacToeProblem(problem: unknown): TicTacToeProblem {
  const incoming = problem as TicTacToeProblem;
  return {
    ...createDefaultTicTacToeProblem(),
    ...incoming,
    kind: 'tic-tac-toe',
  };
}

export const TIC_TAC_TOE_SCENARIOS: TicTacToeScenarioDefinition[] = [
  {
    id: 'fork-trap',
    name: 'Fork Trap',
    description: 'A tactical position where the maximizing player must spot an incoming fork.',
    tags: ['midgame', 'tactics'],
    problem: {
      kind: 'tic-tac-toe',
      board: ['X', null, null, null, 'O', null, null, null, 'X'],
      currentPlayer: 'O',
      maximizingPlayer: 'O',
    },
  },
  {
    id: 'forced-block',
    name: 'Forced Block',
    description: 'A defensive setup that tests whether the algorithm blocks an immediate threat.',
    tags: ['defense', 'forced move'],
    problem: {
      kind: 'tic-tac-toe',
      board: ['X', 'X', null, null, 'O', null, null, null, null],
      currentPlayer: 'O',
      maximizingPlayer: 'O',
    },
  },
  {
    id: 'endgame-win',
    name: 'Endgame Win',
    description: 'A late-game position with a concrete winning continuation to evaluate.',
    tags: ['endgame', 'winning line'],
    problem: {
      kind: 'tic-tac-toe',
      board: ['X', 'O', 'X', 'O', 'X', null, null, 'O', null],
      currentPlayer: 'X',
      maximizingPlayer: 'X',
    },
  },
];

const TIC_TAC_TOE_SCENARIO_MAP = new Map(
  TIC_TAC_TOE_SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export function getTicTacToeScenario(id: Exclude<TicTacToeScenarioId, 'empty'>): TicTacToeProblem {
  const scenario = TIC_TAC_TOE_SCENARIO_MAP.get(id);
  if (!scenario) {
    throw new Error(`Unknown tic-tac-toe scenario: ${id}`);
  }
  return normalizeTicTacToeProblem(scenario.problem);
}