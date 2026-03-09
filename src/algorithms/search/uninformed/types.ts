import type { GraphData, GraphProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';

export interface SearchState {
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
  foundPath: string[] | null;
  metadata?: Map<string, unknown>; // for storing g/h/f costs
}

export interface SearchHighlight {
  frontierNodes: Set<string>;
  exploredNodes: Set<string>;
  currentNode: string | null;
  pathEdges: string[] | null;
}

export type SearchStep = AlgorithmStep<SearchState, SearchHighlight>;

export function reconstructPath(pathMap: Map<string, string | null>, goal: string): string[] {
  const path: string[] = [];
  let current: string | null = goal;
  while (current !== null) {
    path.unshift(current);
    current = pathMap.get(current) ?? null;
  }
  return path;
}

export function getDepth(pathMap: Map<string, string | null>, node: string): number {
  let depth = 0;
  let current: string | null = node;
  while (current !== null) {
    const parent = pathMap.get(current);
    if (parent === undefined) break;
    current = parent;
    depth++;
  }
  return depth;
}

export function validateGraphProblem(
  problem: GraphProblem & { graph: GraphData },
  options?: { requireNonNegativeWeights?: boolean },
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(problem.graph.nodes.map(n => n.id));
  if (!nodeIds.has(problem.startNode)) errors.push(`Start node '${problem.startNode}' not found in graph`);
  if (!nodeIds.has(problem.goalNode)) errors.push(`Goal node '${problem.goalNode}' not found in graph`);
  if (problem.graph.nodes.length === 0) errors.push('Graph has no nodes');
  // Check for negative edge weights for algorithms that require non-negative costs.
  if (options?.requireNonNegativeWeights) {
    const negEdges = problem.graph.edges.filter(e => e.weight < 0);
    if (negEdges.length > 0) {
      errors.push(`This algorithm requires non-negative edge weights. Found ${negEdges.length} edge(s) with negative weight.`);
    }
  } else {
    const negEdges = problem.graph.edges.filter(e => e.weight < 0);
    if (negEdges.length > 0) {
      warnings.push(`Graph contains ${negEdges.length} negative-weight edge(s). Some search variants may produce incorrect results.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function getHeuristic(problem: GraphProblem & { graph: GraphData }, nodeId: string): number {
  return problem.graph.nodes.find(n => n.id === nodeId)?.heuristic ?? 0;
}

