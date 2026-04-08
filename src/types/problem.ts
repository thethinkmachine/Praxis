// Graph problem types shared across search algorithms
export interface GraphNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  heuristic?: number; // h(n) for informed search
}

export interface AntColonySettings {
  constructionDepth?: number;
  pheromoneDecay?: number;
  pheromoneInfluence?: number;
  heuristicInfluence?: number;
  eliteWeight?: number;
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

export class Graph implements GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed?: boolean;

  constructor(data: GraphData) {
    this.nodes = data.nodes || [];
    this.edges = data.edges || [];
    this.directed = data.directed;
  }

  toAdjList(): Map<string, { neighbor: string; weight: number; edgeId: string }[]> {
    const adj = new Map<string, { neighbor: string; weight: number; edgeId: string }[]>();
    const nodes = new Map(this.nodes.map(n => [n.id, n]));
    const getLabel = (id: string) => nodes.get(id)?.label ?? id;

    this.nodes.forEach(n => adj.set(n.id, []));
    this.edges.forEach(e => {
      adj.get(e.source)?.push({ neighbor: e.target, weight: e.weight, edgeId: e.id });
      if (!this.directed) {
        adj.get(e.target)?.push({ neighbor: e.source, weight: e.weight, edgeId: e.id });
      }
    });

    adj.forEach((neighbors) => {
      neighbors.sort((a, b) => getLabel(a.neighbor).localeCompare(getLabel(b.neighbor)));
    });

    return adj;
  }

  toAdjMatrix(): { matrix: number[][], indexToId: string[], idToIndex: Map<string, number> } {
    const n = this.nodes.length;
    const indexToId = this.nodes.map(node => node.id);
    const idToIndex = new Map(indexToId.map((id, idx) => [id, idx]));
    
    const matrix = Array(n).fill(0).map(() => Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) matrix[i][i] = 0;

    for (const edge of this.edges) {
      const u = idToIndex.get(edge.source);
      const v = idToIndex.get(edge.target);
      if (u !== undefined && v !== undefined) {
        matrix[u][v] = Math.min(matrix[u][v], edge.weight);
        if (!this.directed) {
          matrix[v][u] = Math.min(matrix[v][u], edge.weight);
        }
      }
    }

    return { matrix, indexToId, idToIndex };
  }
}

export interface GraphProblem {
  graph: Graph;
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

export type GameProblem = TicTacToeProblem;

export interface NQueensProblem extends AntColonySettings {
  kind: 'n-queens';
  size: number;
  initialState?: number[];
  maxSteps?: number;
  randomSeed?: number;
  sidewaysMoveLimit?: number;
  restartLimit?: number;
  candidateSampleSize?: number;
  beamWidth?: number;
  tabuTenure?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  initialTemperature?: number;
  coolingRate?: number;
  neighborhoodMode?: 'single-queen';
}

export interface TspCity {
  id: string;
  label?: string;
  x: number;
  y: number;
}

export interface TspProblem extends AntColonySettings {
  kind: 'tsp';
  cities: TspCity[];
  initialRoute?: number[];
  maxSteps?: number;
  randomSeed?: number;
  sidewaysMoveLimit?: number;
  restartLimit?: number;
  candidateSampleSize?: number;
  beamWidth?: number;
  tabuTenure?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  initialTemperature?: number;
  coolingRate?: number;
  neighborhoodMode?: 'swap' | 'two-opt' | 'insert';
  fixedStart?: boolean;
}

export interface GraphColoringProblem extends AntColonySettings {
  kind: 'graph-coloring';
  graph: Graph;
  colorCount: number;
  initialColors?: number[];
  maxSteps?: number;
  randomSeed?: number;
  sidewaysMoveLimit?: number;
  restartLimit?: number;
  candidateSampleSize?: number;
  beamWidth?: number;
  tabuTenure?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  initialTemperature?: number;
  coolingRate?: number;
  lockedNodes?: string[];
}

export type LandscapePreset = 'twin-peaks' | 'ridge' | 'crater' | 'rugged';

export interface LandscapeState {
  x: number;
  y: number;
}

export interface LandscapeProblem extends AntColonySettings {
  kind: 'landscape';
  preset: LandscapePreset;
  xRange?: [number, number];
  yRange?: [number, number];
  stepSize?: number;
  initialState?: LandscapeState;
  maxSteps?: number;
  randomSeed?: number;
  sidewaysMoveLimit?: number;
  restartLimit?: number;
  candidateSampleSize?: number;
  beamWidth?: number;
  tabuTenure?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  initialTemperature?: number;
  coolingRate?: number;
}

export interface NPuzzleProblem extends AntColonySettings {
  kind: 'n-puzzle';
  size: 3 | 4;
  tiles: number[];
  maxSteps?: number;
  randomSeed?: number;
  sidewaysMoveLimit?: number;
  restartLimit?: number;
  candidateSampleSize?: number;
  beamWidth?: number;
  tabuTenure?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  initialTemperature?: number;
  coolingRate?: number;
  heuristic?: 'manhattan' | 'misplaced' | 'combined';
  scrambleMoves?: number;
}

export type LocalSearchProblem =
  | NQueensProblem
  | TspProblem
  | GraphColoringProblem
  | LandscapeProblem
  | NPuzzleProblem;

// ---------------------------------------------------------------------------
// Problem saving
// ---------------------------------------------------------------------------

export type ProblemCategory = 'graph' | 'maze' | 'game' | 'local-search';

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
  'local-search': 'local-search',
};
