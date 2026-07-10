import type { GameProblem } from '@/types/problem';

// Strategy-object abstraction that lets a single set of game-playing algorithm
// runners operate over any game-playing problem kind, mirroring
// LocalSearchDomain (src/problems/local-search/types.ts) for the
// local-search family.

export type GameNodeKind = 'max' | 'min' | 'chance' | 'terminal';

export interface GameMove {
  id: string;
  label: string;
  /** Populated only when the move originates at a chance node. */
  probability?: number;
}

export interface GameDomain<TProblem extends GameProblem = GameProblem, TState = unknown> {
  kind: string;
  validate(problem: TProblem): { valid: boolean; errors: string[]; warnings?: string[] };
  initialState(problem: TProblem): TState;
  /** Stable identity for a state (board string, tree node id, ...) used for maps/memoization. */
  stateId(problem: TProblem, state: TState): string;
  nodeKind(problem: TProblem, state: TState): GameNodeKind;
  isTerminal(problem: TProblem, state: TState): boolean;
  legalMoves(problem: TProblem, state: TState): GameMove[];
  applyMove(problem: TProblem, state: TState, moveId: string): TState;
  /** Fixed utility from the maximizing player's perspective. Only meaningful at a terminal state. */
  terminalValue(problem: TProblem, state: TState, depth: number): number;
  describeState(problem: TProblem, state: TState): string;
  describeTerminal?(problem: TProblem, state: TState, depth: number): string;
  /** MCTS-only heuristic rollout hook. Falls back to uniform-random legal-move choice when absent. */
  chooseRolloutMove?(problem: TProblem, state: TState, random: () => number): GameMove;
  /** MCTS-only iteration-budget hint. Lets small hand-built trees run a legible number of simulations. */
  mctsBudget?(problem: TProblem): number;
  /** Domain-specific payload surfaced to the visualization adapter. */
  getStateExtra?(problem: TProblem, state: TState): Record<string, unknown>;
}
