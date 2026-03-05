// Graph problem types shared across search algorithms
export interface GraphNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  heuristic?: number; // h(n) for informed search
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
}

// ---------------------------------------------------------------------------
// Problem saving
// ---------------------------------------------------------------------------

export type ProblemCategory = 'graph';

export interface SavedProblem {
  id: string;
  name: string;
  category: ProblemCategory;
  problem: unknown;
  createdAt: string;
}

export const ALGORITHM_TO_PROBLEM_CATEGORY: Record<import('./algorithm').AlgorithmCategory, ProblemCategory> = {
  'uninformed-search': 'graph',
};
