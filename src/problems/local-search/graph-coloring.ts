import type { GraphColoringProblem } from '@/types/problem';
import type { GraphNode } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchDomain } from './types';
import { chooseRandom } from './n-queens';

export function normalizeGraphNodes(problem: GraphColoringProblem): GraphNode[] {
  const nodes = problem.graph.nodes;
  const radius = 180;
  return nodes.map((node, index) => {
    if (typeof node.x === 'number' && typeof node.y === 'number') return node;
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function validateGraphColoringProblem(problem: GraphColoringProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  if (problem.graph.nodes.length < 3) {
    errors.push('Graph Coloring needs at least 3 nodes.');
  }
  if (!Number.isInteger(problem.colorCount) || problem.colorCount < 2 || problem.colorCount > 8) {
    errors.push('Color count must be between 2 and 8.');
  }
  if (problem.initialColors && problem.initialColors.length !== problem.graph.nodes.length) {
    errors.push('Initial colors must provide one color index per node.');
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeColoring(problem: GraphColoringProblem, random: () => number): number[] {
  if (problem.initialColors?.length === problem.graph.nodes.length) {
    return [...problem.initialColors];
  }
  return Array.from({ length: problem.graph.nodes.length }, () => Math.floor(random() * problem.colorCount));
}

export function countColorConflicts(problem: GraphColoringProblem, colors: number[]): number {
  let conflicts = 0;
  const nodeIndex = new Map(problem.graph.nodes.map((node, index) => [node.id, index]));
  for (const edge of problem.graph.edges) {
    const left = nodeIndex.get(edge.source);
    const right = nodeIndex.get(edge.target);
    if (left == null || right == null) continue;
    if (colors[left] === colors[right]) conflicts++;
  }
  return conflicts;
}

export function conflictCountByNode(problem: GraphColoringProblem, colors: number[]): number[] {
  const counts = Array.from({ length: problem.graph.nodes.length }, () => 0);
  const nodeIndex = new Map(problem.graph.nodes.map((node, index) => [node.id, index]));
  for (const edge of problem.graph.edges) {
    const left = nodeIndex.get(edge.source);
    const right = nodeIndex.get(edge.target);
    if (left == null || right == null) continue;
    if (colors[left] === colors[right]) {
      counts[left]++;
      counts[right]++;
    }
  }
  return counts;
}

function formatAssignment(problem: GraphColoringProblem, colors: number[]): string {
  return problem.graph.nodes
    .map((node, index) => `${node.label ?? node.id}:${colors[index] + 1}`)
    .join(' | ');
}

export function enumerateGraphColoringNeighbors(problem: GraphColoringProblem, colors: number[]): LocalSearchCandidate[] {
  const currentConflicts = countColorConflicts(problem, colors);
  const locked = new Set(problem.lockedNodes ?? []);
  const candidates: LocalSearchCandidate[] = [];

  for (let nodeIndex = 0; nodeIndex < problem.graph.nodes.length; nodeIndex++) {
    const node = problem.graph.nodes[nodeIndex];
    if (locked.has(node.id)) continue;
    for (let color = 0; color < problem.colorCount; color++) {
      if (color === colors[nodeIndex]) continue;
      const next = [...colors];
      next[nodeIndex] = color;
      const conflicts = countColorConflicts(problem, next);
      candidates.push({
        id: `${node.id}:${color}`,
        label: `${node.label ?? node.id} -> color ${color + 1}`,
        description: `${node.label ?? node.id} changes to color ${color + 1}.`,
        state: next,
        score: -conflicts,
        value: conflicts,
        displayValue: `${conflicts}`,
        delta: currentConflicts - conflicts,
        moveKey: `${node.id}:${color}`,
        preview: formatAssignment(problem, next),
        details: [
          `conflicts ${conflicts}`,
          `delta ${currentConflicts - conflicts >= 0 ? '+' : ''}${currentConflicts - conflicts}`,
        ],
        meta: {
          nodeIndex,
          nodeId: node.id,
          color,
          conflicts,
        },
      });
    }
  }

  candidates.sort((a, b) => b.delta - a.delta || a.value - b.value || a.label.localeCompare(b.label));
  return candidates;
}

export const graphColoringDomain: LocalSearchDomain<GraphColoringProblem, number[]> = {
  kind: 'graph-coloring',
  label: 'Graph Coloring',
  objectiveLabel: 'Conflicting Edges',
  objectiveGoal: 'minimize',
  stateLabel: 'Assignment',
  validate: validateGraphColoringProblem,
  createRandomState: normalizeColoring,
  normalizeState: normalizeColoring,
  evaluate: (problem, state) => {
    const conflicts = countColorConflicts(problem, state);
    return {
      score: -conflicts,
      value: conflicts,
      displayValue: `${conflicts}`,
      goalReached: conflicts === 0,
      summary: formatAssignment(problem, state),
      stats: [
        { label: 'Nodes', value: problem.graph.nodes.length },
        { label: 'Edges', value: problem.graph.edges.length },
        { label: 'Conflicts', value: conflicts },
      ],
    };
  },
  getNeighbors: (problem, state) => enumerateGraphColoringNeighbors(problem, state),
  getRandomNeighbor: (problem, state, random) => {
    const neighbors = enumerateGraphColoringNeighbors(problem, state);
    return neighbors.length > 0 ? chooseRandom(neighbors, random) : null;
  },
  getRepairCandidates: (problem, state, random) => {
    const counts = conflictCountByNode(problem, state);
    const conflicted = counts
      .map((count, index) => ({ count, index }))
      .filter(item => item.count > 0)
      .map(item => item.index);
    if (conflicted.length === 0) return [];
    const nodeIndex = chooseRandom(conflicted, random);
    return enumerateGraphColoringNeighbors(problem, state).filter(candidate => Number(candidate.meta?.nodeIndex) === nodeIndex);
  },
  crossover: (_problem, left, right, random) => {
    const pivot = Math.floor(random() * left.length);
    return left.map((value, index) => (index < pivot ? value : right[index]));
  },
  mutate: (problem, state, random) => {
    const next = [...state];
    const index = Math.floor(random() * next.length);
    next[index] = Math.floor(random() * problem.colorCount);
    return next;
  },
  serializeState: (_problem, state) => state.join(','),
  describeState: (problem, state) => formatAssignment(problem, state),
  getStateStats: (problem, state) => [
    { label: 'Colors', value: problem.colorCount },
    { label: 'Conflicts', value: countColorConflicts(problem, state) },
  ],
  getDomainData: (problem, state) => ({
    nodePositions: normalizeGraphNodes(problem),
    conflictCounts: conflictCountByNode(problem, state),
  }),
  getPopulationMemberSummary: (problem, state) => {
    const conflicts = countColorConflicts(problem, state);
    return {
      id: state.join(','),
      summary: formatAssignment(problem, state),
      displayValue: `${conflicts} conflicts`,
      score: -conflicts,
      state: [...state],
    };
  },
};
