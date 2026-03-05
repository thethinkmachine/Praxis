// Graph problem types shared across search algorithms
export interface GraphNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  heuristic?: number; // h(n) for informed search
}

export type HeuristicId =
  | 'manual-node'
  | 'zero'
  | 'manhattan-distance'
  | 'euclidean-distance'
  | 'chebyshev-distance';

export interface HeuristicConfig {
  id: HeuristicId;
  /** Optional numeric/string params interpreted by the heuristic evaluator. */
  params?: Record<string, number | string>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  directed?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed?: boolean;
}

export interface GraphProblem {
  graph: GraphData;
  startNode: string;
  goalNode: string;
  useHeuristic?: boolean;
  heuristic?: HeuristicConfig;
}

export interface MazeProblem {
  kind: 'maze';
  rows: number;
  cols: number;
  seed: number;
  walls: string[];
  startNode: string;
  goalNode: string;
  /** Per-cell traversal cost multiplier. 1 = default terrain cost. */
  terrain: Record<string, number>;
  strategy?: string;
  heuristic?: HeuristicConfig;
  /** Optional per-cell heuristic overrides used by manual-node mode. */
  manualHeuristicValues?: Record<string, number>;
}

export type TicTacToeCell = 'X' | 'O' | null;
export type TicTacToePlayer = 'X' | 'O';

export interface TicTacToeProblem {
  kind?: 'tic-tac-toe';
  board?: TicTacToeCell[];
  currentPlayer?: TicTacToePlayer;
  maximizingPlayer?: TicTacToePlayer;
  allowDepthPenalty?: boolean;
}

// ---------------------------------------------------------------------------
// Problem saving
// ---------------------------------------------------------------------------

export type ProblemCategory = 'graph' | 'maze' | 'game';

export interface SavedProblem {
  id: string;
  name: string;
  category: ProblemCategory;
  problem: unknown;
  createdAt: string;
}

export const ALGORITHM_TO_PROBLEM_CATEGORY: Record<import('./algorithm').AlgorithmCategory, ProblemCategory> = {
  'uninformed-search': 'graph',
  'informed-search': 'graph',
  'game-playing': 'game',
};
