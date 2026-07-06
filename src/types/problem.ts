import { compareLabels } from '@/lib/natural-sort';

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
      neighbors.sort((a, b) => compareLabels(getLabel(a.neighbor), getLabel(b.neighbor)));
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

export type PlanningLabId =
  | 'strips'
  | 'state-space'
  | 'goal-stack'
  | 'planning-graph'
  | 'partial-order';

export type PlanningPresetId =
  | 'blocks-world'
  | 'air-cargo'
  | 'spare-tire'
  | 'cake';

export type PlanningHeuristicId =
  | 'goal-count'
  | 'ignore-delete'
  | 'planning-graph-level';

export interface PlanningSchemaParameter {
  key: string;
  objectSet: string;
}

export interface PlanningActionSchema {
  id: string;
  name: string;
  parameters: PlanningSchemaParameter[];
  preconditions: string[];
  addEffects: string[];
  deleteEffects: string[];
  enabled?: boolean;
}

export interface PlanningGroundedAction {
  id: string;
  schemaId: string;
  name: string;
  label: string;
  parameters: Record<string, string>;
  preconditions: string[];
  addEffects: string[];
  deleteEffects: string[];
  enabled?: boolean;
}

export interface PlanningProblem {
  kind: 'planning';
  lab: PlanningLabId;
  presetId: PlanningPresetId;
  domainName: string;
  objectCount?: number;
  objectSets: Record<string, string[]>;
  schemas: PlanningActionSchema[];
  groundedActions: PlanningGroundedAction[];
  initialLiterals: string[];
  goalLiterals: string[];
  heuristic?: PlanningHeuristicId;
  duplicateDetection?: boolean;
  branchOrder?: 'schema' | 'goal-first' | 'reverse';
  tieBreaker?: 'fifo' | 'lifo' | 'lexicographic';
  goalOrdering?: 'input' | 'shortest-first' | 'hardest-first';
  repeatedGoalProtection?: boolean;
  operatorChoice?: 'first-achiever' | 'fewest-preconditions' | 'lexicographic';
  expansionDepthCap?: number;
  showDeleteEffects?: boolean;
  extractionStrategy?: 'serial-first' | 'parallel-first';
  satHorizonCap?: number;
  flawSelection?: 'fifo' | 'most-constrained' | 'recent';
  threatResolution?: 'promotion' | 'demotion' | 'separation';
  leastCommitment?: boolean;
  manualActionHistory?: string[];
}

export type CspLabId =
  | 'constraint-network'
  | 'arc-consistency'
  | 'sudoku'
  | 'cryptarithm'
  | 'scheduling'
  | 'structure';

export type CspPresetId =
  | 'australia-map'
  | 'n-queens-csp'
  | 'graph-coloring'
  | 'custom-network'
  | 'sudoku-4x4-easy'
  | 'sudoku-4x4-medium'
  | 'send-more-money'
  | 'small-timetable'
  | 'tree-map';

export type CspVariableOrdering = 'input' | 'mrv' | 'degree';
export type CspValueOrdering = 'input' | 'lcv';
export type CspQueueDiscipline = 'fifo' | 'lifo';

export type CspValue = string | number;

export interface CspVariable {
  id: string;
  label?: string;
  domain: CspValue[];
  x?: number;
  y?: number;
  meta?: Record<string, string | number | boolean>;
}

interface CspConstraintBase {
  id: string;
  description?: string;
  variables: string[];
}

export interface CspNotEqualConstraint extends CspConstraintBase {
  type: 'not-equal';
  variables: [string, string];
}

export interface CspAllDifferentConstraint extends CspConstraintBase {
  type: 'all-different';
}

export interface CspTableConstraint extends CspConstraintBase {
  type: 'table';
  allowedTuples?: CspValue[][];
  disallowedTuples?: CspValue[][];
}

export interface CspLinearEqConstraint extends CspConstraintBase {
  type: 'linear-eq';
  coefficients: number[];
  constant: number;
}

export interface CspTokenConflictConstraint extends CspConstraintBase {
  type: 'token-conflict';
  variables: [string, string];
  partIndexes: number[];
}

export interface CspTokenOrderConstraint extends CspConstraintBase {
  type: 'token-order';
  variables: [string, string];
  partIndex: number;
  relation: '<' | '<=' | '>' | '>=';
}

export interface CspNonZeroConstraint extends CspConstraintBase {
  type: 'non-zero';
  variables: [string];
}

export type CspConstraint =
  | CspNotEqualConstraint
  | CspAllDifferentConstraint
  | CspTableConstraint
  | CspLinearEqConstraint
  | CspTokenConflictConstraint
  | CspTokenOrderConstraint
  | CspNonZeroConstraint;

export interface CspProblem {
  kind: 'constraint-satisfaction';
  lab: CspLabId;
  presetId: CspPresetId;
  title: string;
  variables: CspVariable[];
  constraints: CspConstraint[];
  variableOrdering?: CspVariableOrdering;
  valueOrdering?: CspValueOrdering;
  queueDiscipline?: CspQueueDiscipline;
  explainPruning?: boolean;
  binaryOnlyView?: boolean;
  propagationFirst?: boolean;
  allDifferentEncoding?: 'global' | 'binary-decomposition';
  rootVariable?: string;
  cutset?: string[];
}

// ---------------------------------------------------------------------------
// Problem saving
// ---------------------------------------------------------------------------

export type ProblemCategory =
  | 'graph'
  | 'maze'
  | 'game'
  | 'local-search'
  | 'planning'
  | 'constraint-satisfaction';

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
  'planning': 'planning',
  'constraint-satisfaction': 'constraint-satisfaction',
};
