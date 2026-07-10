import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllAlgorithms } from '@/algorithms/register';
import { registry } from '@/algorithms/core/registry';
import type { AlgorithmStep } from '@/types/step';
import type { GameTreeNode } from '@/algorithms/game-playing/types';
import type { GameTreeProblem } from '@/types/problem';
import { validateGameTreeProblem } from '@/problems/game-playing/game-tree.domain';
import { buildGameTree, buildGameTreeProblem, edge, leaf, node } from './fixtures/game-tree-builder';

interface GameResult {
  bestMove: string | null;
  bestScore: number;
  nodesExpanded: number;
}

function runGameAlgorithm(algorithmId: string, problem: unknown): { steps: AlgorithmStep[]; result: GameResult } {
  const entry = registry.get(algorithmId);
  if (!entry) throw new Error(`Algorithm "${algorithmId}" not registered`);

  const generator = entry.runner.run(problem);
  const steps: AlgorithmStep[] = [];
  let next = generator.next();
  while (!next.done) {
    steps.push(next.value as AlgorithmStep);
    next = generator.next();
  }
  return { steps, result: next.value as GameResult };
}

beforeAll(() => {
  registerAllAlgorithms();
});

// root(MAX) -> L(MIN)->[3,5], R(MIN)->[6,2]
// L = min(3,5) = 3; R = min(6,2) = 2; root = max(3,2) = 3, best move = L (id "g1").
const classicTree = buildGameTreeProblem(
  node('max', [
    edge(node('min', [edge(leaf(3)), edge(leaf(5))])),
    edge(node('min', [edge(leaf(6)), edge(leaf(2))])),
  ]),
);

// Shaped so Alpha-Beta provably prunes branches Minimax fully visits (AIMA-style example):
// A = min(3,12,8); B = min(2,4,6) but 4,6 get pruned once bestScore(2) <= alpha(3); C = min(14,5,2).
const pruningTree = buildGameTreeProblem(
  node('max', [
    edge(node('min', [edge(leaf(3)), edge(leaf(12)), edge(leaf(8))])),
    edge(node('min', [edge(leaf(2)), edge(leaf(4)), edge(leaf(6))])),
    edge(node('min', [edge(leaf(14)), edge(leaf(5)), edge(leaf(2))])),
  ]),
);

// root(MAX) -> ChanceA->[10 p=0.5, 0 p=0.5]=5, ChanceB->[4 p=0.2, 6 p=0.8]=5.6
const diceTree = buildGameTreeProblem(
  node('max', [
    edge(node('chance', [edge(leaf(10), 'heads', 0.5), edge(leaf(0), 'tails', 0.5)])),
    edge(node('chance', [edge(leaf(4), 'miss', 0.2), edge(leaf(6), 'hit', 0.8)])),
  ]),
);

describe('Custom game tree domain — algorithm behavior', () => {
  it('minimax, alpha-beta, negamax, sss-star, and mcts all agree on a MAX/MIN tree', () => {
    const baseline = runGameAlgorithm('minimax', classicTree).result;
    expect(baseline.bestMove).toBe('g1');
    expect(baseline.bestScore).toBe(3);

    for (const algorithmId of ['alpha-beta', 'negamax', 'sss-star']) {
      const { result } = runGameAlgorithm(algorithmId, classicTree);
      expect(result.bestMove).toBe(baseline.bestMove);
      expect(result.bestScore).toBe(baseline.bestScore);
    }

    const mcts = runGameAlgorithm('mcts', classicTree).result;
    expect(mcts.bestMove).toBe(baseline.bestMove);
    // MCTS's backed-up value is a sampled mean (UCB1 keeps allocating some
    // exploration to the worse child forever), so it converges near but not
    // exactly to the true minimax value within a finite iteration budget.
    expect(Math.abs(mcts.bestScore - baseline.bestScore)).toBeLessThan(0.5);
  });

  it('expectimax disagrees with minimax when the tree has real MIN nodes, since it averages instead of minimizing', () => {
    const minimaxResult = runGameAlgorithm('minimax', classicTree).result;
    const expectimaxResult = runGameAlgorithm('expectimax', classicTree).result;

    // L averages (3+5)/2=4, R averages (6+2)/2=4 -> root picks the first tie, L, with score 4.
    expect(expectimaxResult.bestScore).toBe(4);
    expect(expectimaxResult.bestScore).not.toBe(minimaxResult.bestScore);
  });

  it('minimax and expectimax agree on a tree of only MAX and chance nodes', () => {
    const minimaxResult = runGameAlgorithm('minimax', diceTree).result;
    const expectimaxResult = runGameAlgorithm('expectimax', diceTree).result;

    expect(minimaxResult.bestScore).toBeCloseTo(5.6, 5);
    expect(expectimaxResult.bestScore).toBeCloseTo(5.6, 5);
    expect(minimaxResult.bestMove).toBe(expectimaxResult.bestMove);
  });

  it('alpha-beta expands strictly fewer nodes than minimax and marks pruned branches', () => {
    const minimax = runGameAlgorithm('minimax', pruningTree);
    const alphaBeta = runGameAlgorithm('alpha-beta', pruningTree);

    expect(minimax.result.bestScore).toBe(3);
    expect(alphaBeta.result.bestScore).toBe(3);
    expect(alphaBeta.result.nodesExpanded).toBeLessThan(minimax.result.nodesExpanded);

    const finalState = alphaBeta.steps.at(-1)?.state as { searchTree?: Map<string, GameTreeNode> } | undefined;
    const prunedNodes = [...(finalState?.searchTree?.values() ?? [])].filter((n) => n.isPruned);
    expect(prunedNodes.length).toBeGreaterThan(0);
  });

  it('negamax and sss-star reject trees containing a chance node', () => {
    for (const algorithmId of ['negamax', 'sss-star']) {
      const entry = registry.get(algorithmId);
      const validation = entry?.runner.validate(diceTree);
      expect(validation?.valid).toBe(false);
      expect(validation?.errors.some((e) => e.toLowerCase().includes('chance'))).toBe(true);
    }

    // Both succeed and agree with minimax once the chance node is gone.
    for (const algorithmId of ['negamax', 'sss-star']) {
      const entry = registry.get(algorithmId);
      const validation = entry?.runner.validate(classicTree);
      expect(validation?.valid).toBe(true);
    }
  });
});

describe('validateGameTreeProblem', () => {
  function problemFor(tree: GameTreeProblem['tree']): GameTreeProblem {
    return { kind: 'game-tree', tree };
  }

  it('rejects a tree with no root', () => {
    const tree = buildGameTree(leaf(1));
    tree.rootId = null;
    expect(validateGameTreeProblem(problemFor(tree)).valid).toBe(false);
  });

  it('rejects an orphan node unreachable from root', () => {
    const tree = buildGameTree(node('max', [edge(leaf(1))]));
    tree.nodes.push({ id: 'orphan', kind: 'terminal', value: 5 });
    const result = validateGameTreeProblem(problemFor(tree));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('orphan') && e.includes('reachable'))).toBe(true);
  });

  it('rejects an internal node with no children', () => {
    const tree = buildGameTree(node('max', [edge(leaf(1))]));
    tree.nodes.push({ id: 'lonely', kind: 'min' });
    tree.edges.push({ id: 'e-lonely', source: tree.rootId!, target: 'lonely' });
    const result = validateGameTreeProblem(problemFor(tree));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('lonely'))).toBe(true);
  });

  it('rejects a terminal node missing a numeric value', () => {
    const tree = buildGameTree(node('max', [edge({ kind: 'terminal' })]));
    const result = validateGameTreeProblem(problemFor(tree));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('numeric value'))).toBe(true);
  });

  it('rejects a chance node with partially-set probabilities', () => {
    const tree = buildGameTree(node('chance', [edge(leaf(1), undefined, 0.5), edge(leaf(2))]));
    const result = validateGameTreeProblem(problemFor(tree));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('some but not all'))).toBe(true);
  });

  it('accepts a chance node with no probabilities set at all (defaults to uniform)', () => {
    const tree = buildGameTree(node('chance', [edge(leaf(1)), edge(leaf(2))]));
    expect(validateGameTreeProblem(problemFor(tree)).valid).toBe(true);
  });

  it('rejects a chance node whose probabilities do not sum to 1', () => {
    const tree = buildGameTree(node('chance', [edge(leaf(1), undefined, 0.2), edge(leaf(2), undefined, 0.3)]));
    const result = validateGameTreeProblem(problemFor(tree));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sum to'))).toBe(true);
  });
});
