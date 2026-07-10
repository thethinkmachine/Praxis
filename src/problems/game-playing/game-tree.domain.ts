import type { GameTreeProblem } from '@/types/problem';
import type { GameDomain, GameMove, GameNodeKind } from './domain';

export interface GameTreeDomainState {
  nodeId: string;
}

function resolveNodeKind(problem: GameTreeProblem, nodeId: string): GameNodeKind {
  return problem.tree.getNode(nodeId)?.kind ?? 'terminal';
}

export function validateGameTreeProblem(problem: GameTreeProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const { tree } = problem;

  if (!tree.rootId || !tree.getNode(tree.rootId)) {
    return { valid: false, errors: ['The tree needs a root node. Right-click a node and choose "Set as Root".'] };
  }

  for (const node of tree.nodes) {
    if (node.id === tree.rootId) continue;
    const incoming = tree.edges.filter((edge) => edge.target === node.id);
    if (incoming.length > 1) {
      errors.push(`Node "${node.id}" has more than one parent; trees allow at most one incoming edge per node.`);
    }
  }

  const childrenMap = tree.toChildrenMap();
  const reachable = new Set<string>();
  const queue: string[] = tree.rootId ? [tree.rootId] : [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of childrenMap.get(current) ?? []) {
      queue.push(edge.target);
    }
  }

  for (const node of tree.nodes) {
    if (!reachable.has(node.id)) {
      errors.push(`Node "${node.id}" is not reachable from the root.`);
      continue;
    }

    const children = childrenMap.get(node.id) ?? [];
    if (node.kind === 'terminal') {
      if (children.length > 0) {
        errors.push(`Terminal node "${node.id}" cannot have children.`);
      }
      if (node.value === undefined || Number.isNaN(node.value)) {
        errors.push(`Terminal node "${node.id}" needs a numeric value.`);
      }
    } else if (children.length === 0) {
      errors.push(`Node "${node.id}" is a ${node.kind.toUpperCase()} node with no children; give it at least one child or mark it terminal.`);
    } else if (node.kind === 'chance') {
      const withProbability = children.filter((edge) => edge.probability !== undefined);
      if (withProbability.length > 0 && withProbability.length < children.length) {
        errors.push(`Chance node "${node.id}" has probabilities on some but not all children; set all of them or none (defaults to uniform).`);
      } else if (withProbability.length === children.length) {
        const total = withProbability.reduce((sum, edge) => sum + (edge.probability ?? 0), 0);
        if (Math.abs(total - 1) > 0.01) {
          errors.push(`Chance node "${node.id}"'s child probabilities sum to ${total.toFixed(2)}, not 1. Use "Normalize" to fix.`);
        }
      }
    }
  }

  // Defense in depth: a well-formed single-parent tree reachable from a
  // single root cannot contain a cycle, but malformed imports/presets could.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let hasCycle = false;
  const visit = (nodeId: string) => {
    if (hasCycle || visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      hasCycle = true;
      return;
    }
    visiting.add(nodeId);
    for (const edge of childrenMap.get(nodeId) ?? []) {
      visit(edge.target);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  if (tree.rootId) visit(tree.rootId);
  if (hasCycle) {
    errors.push('The tree contains a cycle.');
  }

  return { valid: errors.length === 0, errors };
}

// The tree is already fully materialized, so "legal moves" is a lookup into
// the edge list rather than a simulated move.
export const gameTreeDomain: GameDomain<GameTreeProblem, GameTreeDomainState> = {
  kind: 'game-tree',

  validate: validateGameTreeProblem,

  initialState(problem) {
    const rootId = problem.tree.rootId ?? problem.tree.nodes[0]?.id ?? '';
    return { nodeId: rootId };
  },

  stateId(_problem, state) {
    return state.nodeId;
  },

  nodeKind(problem, state) {
    return resolveNodeKind(problem, state.nodeId);
  },

  isTerminal(problem, state) {
    return resolveNodeKind(problem, state.nodeId) === 'terminal';
  },

  legalMoves(problem, state): GameMove[] {
    const kind = resolveNodeKind(problem, state.nodeId);
    if (kind === 'terminal') return [];
    const children = problem.tree.toChildrenMap().get(state.nodeId) ?? [];
    const isChance = kind === 'chance';
    const anyProbabilitySet = children.some((edge) => edge.probability !== undefined);
    return children.map((edge) => ({
      id: edge.target,
      label: edge.moveLabel ?? edge.target,
      // Chance-node children with no explicit probabilities default to
      // uniform at run time; validation rejects partially-specified
      // probabilities.
      probability: isChance ? (anyProbabilitySet ? (edge.probability ?? 0) : 1 / children.length) : undefined,
    }));
  },

  applyMove(_problem, _state, moveId) {
    return { nodeId: moveId };
  },

  terminalValue(problem, state) {
    return problem.tree.getNode(state.nodeId)?.value ?? 0;
  },

  describeState(problem, state) {
    const node = problem.tree.getNode(state.nodeId);
    return node?.label ?? state.nodeId;
  },

  describeTerminal(problem, state, depth) {
    const value = problem.tree.getNode(state.nodeId)?.value ?? 0;
    return `Reached terminal node ${state.nodeId} at depth ${depth}; value = ${value}.`;
  },

  getStateExtra(problem, state) {
    const node = problem.tree.getNode(state.nodeId);
    return { nodeId: state.nodeId, kind: node?.kind, label: node?.label };
  },

  // A hand-drawn tree is small and fully enumerable, so a few dozen rollouts
  // per node already converge — keep the trace legible instead of hundreds
  // of iterations.
  mctsBudget(problem) {
    return Math.min(600, Math.max(40, problem.tree.nodes.length * 12));
  },
};
