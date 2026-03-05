import type { GraphNode, GraphProblem, HeuristicConfig, HeuristicId } from '@/types/problem';

export interface HeuristicDefinition {
  id: HeuristicId;
  label: string;
  description: string;
  /** If true, the heuristic depends on node/goal geometry (x/y or grid coordinates). */
  requiresGeometry?: boolean;
}

type NodePoint = { x: number; y: number };

type HeuristicContext = {
  problem: GraphProblem;
  config: HeuristicConfig;
  nodeById: Map<string, GraphNode>;
  goalPoint: NodePoint | null;
};

const GRID_ID_RE = /^r(-?\d+)c(-?\d+)$/i;
const GRID_LABEL_RE = /^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/;

export const INFORMED_HEURISTICS: HeuristicDefinition[] = [
  {
    id: 'manual-node',
    label: 'Manual h(n) from Nodes',
    description: 'Uses each node\'s stored heuristic value (node.heuristic).',
  },
  {
    id: 'zero',
    label: 'Zero Heuristic',
    description: 'h(n)=0 for every node (equivalent to Uniform-Cost behavior).',
  },
  {
    id: 'manhattan-distance',
    label: 'Manhattan Distance',
    description: 'h(n)=|dx|+|dy| based on node coordinates or grid IDs.',
    requiresGeometry: true,
  },
  {
    id: 'euclidean-distance',
    label: 'Euclidean Distance',
    description: 'h(n)=sqrt(dx^2+dy^2) based on node coordinates or grid IDs.',
    requiresGeometry: true,
  },
  {
    id: 'chebyshev-distance',
    label: 'Chebyshev Distance',
    description: 'h(n)=max(|dx|,|dy|) based on node coordinates or grid IDs.',
    requiresGeometry: true,
  },
];

const HEURISTIC_IDS = new Set<HeuristicId>(INFORMED_HEURISTICS.map(h => h.id));
const HEURISTIC_BY_ID = new Map<HeuristicId, HeuristicDefinition>(INFORMED_HEURISTICS.map(h => [h.id, h]));

function parseScale(config: HeuristicConfig): number {
  const raw = config.params?.scale;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function parseGridPoint(node: GraphNode): NodePoint | null {
  const idMatch = GRID_ID_RE.exec(node.id);
  if (idMatch) {
    return { x: Number(idMatch[2]), y: Number(idMatch[1]) };
  }
  if (typeof node.label === 'string') {
    const labelMatch = GRID_LABEL_RE.exec(node.label);
    if (labelMatch) {
      return { x: Number(labelMatch[2]), y: Number(labelMatch[1]) };
    }
  }
  return null;
}

function resolveNodePoint(node: GraphNode | undefined): NodePoint | null {
  if (!node) return null;
  if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
    return { x: Number(node.x), y: Number(node.y) };
  }
  return parseGridPoint(node);
}

function getHeuristicConfig(problem: GraphProblem): HeuristicConfig {
  if (problem.heuristic && HEURISTIC_IDS.has(problem.heuristic.id)) {
    return problem.heuristic;
  }
  return { id: 'manual-node' };
}

function manhattan(a: NodePoint, b: NodePoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function euclidean(a: NodePoint, b: NodePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function chebyshev(a: NodePoint, b: NodePoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function evaluateHeuristic(nodeId: string, ctx: HeuristicContext): number {
  const node = ctx.nodeById.get(nodeId);
  if (!node) return 0;

  switch (ctx.config.id) {
    case 'zero':
      return 0;
    case 'manual-node':
      return node.heuristic ?? 0;
    case 'manhattan-distance': {
      const from = resolveNodePoint(node);
      if (!from || !ctx.goalPoint) return 0;
      return parseScale(ctx.config) * manhattan(from, ctx.goalPoint);
    }
    case 'euclidean-distance': {
      const from = resolveNodePoint(node);
      if (!from || !ctx.goalPoint) return 0;
      return parseScale(ctx.config) * euclidean(from, ctx.goalPoint);
    }
    case 'chebyshev-distance': {
      const from = resolveNodePoint(node);
      if (!from || !ctx.goalPoint) return 0;
      return parseScale(ctx.config) * chebyshev(from, ctx.goalPoint);
    }
    default:
      return node.heuristic ?? 0;
  }
}

export function createHeuristicEvaluator(problem: GraphProblem): (nodeId: string) => number {
  const config = getHeuristicConfig(problem);
  const nodeById = new Map(problem.graph.nodes.map(n => [n.id, n] as const));
  const goalPoint = resolveNodePoint(nodeById.get(problem.goalNode));
  const cache = new Map<string, number>();

  const ctx: HeuristicContext = {
    problem,
    config,
    nodeById,
    goalPoint,
  };

  return (nodeId: string) => {
    const hit = cache.get(nodeId);
    if (hit !== undefined) return hit;
    const value = evaluateHeuristic(nodeId, ctx);
    cache.set(nodeId, value);
    return value;
  };
}

export function getHeuristicDefinition(id: HeuristicId): HeuristicDefinition {
  return HEURISTIC_BY_ID.get(id) ?? HEURISTIC_BY_ID.get('manual-node')!;
}

export function getHeuristicValidationWarnings(problem: GraphProblem): string[] {
  const config = getHeuristicConfig(problem);
  const definition = getHeuristicDefinition(config.id);
  const warnings: string[] = [];

  if (config.id === 'manual-node') {
    warnings.push('Selected heuristic may be non-admissible: manual node h(n) values are not automatically validated.');
  }

  if (config.id !== 'zero' && config.id !== 'manual-node') {
    warnings.push(`Selected heuristic may be non-admissible: ${definition.label} is only admissible when edge costs match the chosen distance model.`);
  }

  if (definition.requiresGeometry) {
    const unresolved = problem.graph.nodes.filter(n => resolveNodePoint(n) === null).length;
    if (resolveNodePoint(problem.graph.nodes.find(n => n.id === problem.goalNode)) === null) {
      warnings.push('Heuristic geometry is unavailable for the goal node; h(n) will default to 0.');
    } else if (unresolved > 0) {
      warnings.push(`Heuristic geometry is missing for ${unresolved} node(s); those nodes will use h(n)=0.`);
    }
  }

  return warnings;
}
