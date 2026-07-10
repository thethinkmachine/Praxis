import type { EvaluatedMove, GameTreeNode, RecursionFrame, GameRunner } from './types';
import {
  createStep,
  createTraceContext,
  determineOutcome,
  getInitialTraceState,
  validateGameProblem,
} from './shared';
import { resolveGameDomain } from '@/problems/game-playing/domains';
import type { GameMove } from '@/problems/game-playing/domain';

interface MctsStats {
  visits: number;
  totalValue: number;
  meanValue: number;
  untriedMoves: GameMove[];
  children: string[];
}

const EXPLORATION_CONSTANT = Math.SQRT2;

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function chooseRandom<T>(values: T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function chooseWeighted(moves: GameMove[], random: () => number): GameMove {
  const total = moves.reduce((sum, move) => sum + (move.probability ?? 1 / moves.length), 0) || 1;
  let roll = random() * total;
  for (const move of moves) {
    roll -= move.probability ?? 1 / moves.length;
    if (roll <= 0) return move;
  }
  return moves[moves.length - 1];
}

export const mctsRunner: GameRunner = {
  meta: {
    id: 'mcts',
    name: 'Monte Carlo Tree Search',
    shortName: 'MCTS',
    category: 'game-playing',
    description: 'Approximates move quality with UCT-guided simulations and rollout-based value estimates.',
    longDescription: 'Monte Carlo Tree Search incrementally grows a search tree, balances exploration and exploitation with UCT at MAX/MIN nodes, and samples chance nodes by their edge probabilities. It estimates move quality by backing up random playout results, offering a sampling-based alternative to exhaustive adversarial search.',
    timeComplexity: 'O(k · d)',
    spaceComplexity: 'O(k)',
    complete: false,
    optimal: false,
    tags: ['game tree', 'monte carlo tree search', 'uct', 'sampling'],
    bookChapter: 'Chapter 5',
    relatedAlgorithms: ['expectimax'],
  },

  pseudocode: [
    'function MCTS(root):',
    '  repeat k times:',
    '    node <- SELECT(root)   # UCB1 at MAX/MIN, probability sample at CHANCE',
    '    leaf <- EXPAND(node)',
    '    reward <- SIMULATE(leaf)',
    '    BACKPROPAGATE(leaf, reward)',
    '  return best child of root',
  ],

  validate: validateGameProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const domain = resolveGameDomain(problem);
    const ctx = createTraceContext(problem);
    const initialState = domain.initialState(problem);
    const initialMoves = domain.legalMoves(problem, initialState).map((move) => move.id);
    const searchTree = new Map<string, GameTreeNode>();
    const statsByNode = new Map<string, MctsStats>();

    const createStats = (state: unknown): MctsStats => ({
      visits: 0,
      totalValue: 0,
      meanValue: 0,
      untriedMoves: domain.isTerminal(problem, state) ? [] : domain.legalMoves(problem, state),
      children: [],
    });

    const selectChild = (nodeId: string, state: unknown, random: () => number): string | null => {
      const nodeStats = statsByNode.get(nodeId);
      if (!nodeStats || nodeStats.children.length === 0) return null;
      const node = searchTree.get(nodeId)!;

      if (node.nodeKind === 'chance') {
        const candidates = nodeStats.children
          .map((childId) => searchTree.get(childId))
          .filter((child): child is GameTreeNode => Boolean(child));
        if (candidates.length === 0) return null;
        const legalMoves = domain.legalMoves(problem, state);
        const byId = new Map(legalMoves.map((move) => [move.id, move]));
        const weighted: GameMove[] = candidates.map((child) => byId.get(child.move ?? '') ?? { id: child.id, label: child.moveLabel ?? child.id, probability: 1 / candidates.length });
        const picked = chooseWeighted(weighted, random);
        return candidates.find((child) => child.move === picked.id)?.id ?? candidates[0].id;
      }

      const maximize = node.nodeKind === 'max';
      const parentVisits = Math.max(nodeStats.visits, 1);

      let bestChildId: string | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const childId of nodeStats.children) {
        const childStats = statsByNode.get(childId);
        const childNode = searchTree.get(childId);
        if (!childStats || !childNode) continue;

        const exploitation = childStats.visits > 0 ? childStats.meanValue : 0;
        const exploration = childStats.visits > 0
          ? EXPLORATION_CONSTANT * Math.sqrt(Math.log(parentVisits + 1) / childStats.visits)
          : Number.POSITIVE_INFINITY;
        const score = maximize ? exploitation + exploration : -exploitation + exploration;
        const bestMoveId = bestChildId ? searchTree.get(bestChildId)?.move ?? null : null;

        if (
          bestChildId === null
          || score > bestScore
          || (score === bestScore && (childNode.move ?? '') < (bestMoveId ?? ''))
        ) {
          bestScore = score;
          bestChildId = childId;
        }
      }

      return bestChildId;
    };

    const simulateRollout = (
      state: unknown,
      startDepth: number,
      random: () => number,
    ): { reward: number; plies: number } => {
      let currentState = state;
      let depth = startDepth;
      let plies = 0;

      while (!domain.isTerminal(problem, currentState)) {
        const kind = domain.nodeKind(problem, currentState);
        const moves = domain.legalMoves(problem, currentState);
        const move = kind === 'chance'
          ? chooseWeighted(moves, random)
          : (domain.chooseRolloutMove?.(problem, currentState, random) ?? chooseRandom(moves, random));
        currentState = domain.applyMove(problem, currentState, move.id);
        depth += 1;
        plies += 1;
      }

      return { reward: domain.terminalValue(problem, currentState, depth), plies };
    };

    const summarizeRoot = (rootId: string): { bestMove: string | null; bestScore: number; principalVariation: string[]; evaluatedMoves: EvaluatedMove[] } => {
      const rootNode = searchTree.get(rootId);
      const rootStats = statsByNode.get(rootId);
      if (!rootNode || !rootStats || rootStats.children.length === 0) {
        return { bestMove: null, bestScore: 0, principalVariation: [], evaluatedMoves: [] };
      }

      const candidates: Array<{ move: string; score: number; visits: number }> = [];
      for (const childId of rootStats.children) {
        const childNode = searchTree.get(childId);
        const childStats = statsByNode.get(childId);
        if (!childNode || !childStats || childNode.move === null) continue;
        candidates.push({ move: childNode.move, score: childStats.meanValue, visits: childStats.visits });
      }

      if (candidates.length === 0) {
        return { bestMove: null, bestScore: 0, principalVariation: [], evaluatedMoves: [] };
      }

      const maximize = rootNode.nodeKind !== 'min';
      candidates.sort((a, b) => {
        if (a.score !== b.score) return maximize ? b.score - a.score : a.score - b.score;
        if (a.visits !== b.visits) return b.visits - a.visits;
        return a.move.localeCompare(b.move);
      });

      const best = candidates[0];
      return {
        bestMove: best.move,
        bestScore: best.score,
        principalVariation: [best.move],
        evaluatedMoves: candidates.map((candidate) => ({
          move: candidate.move,
          score: candidate.score,
          detail: `${candidate.visits} visit${candidate.visits === 1 ? '' : 's'}`,
        })),
      };
    };

    const rootNode: GameTreeNode = {
      id: 'root',
      parentId: null,
      stateLabel: domain.describeState(problem, initialState),
      nodeKind: domain.nodeKind(problem, initialState),
      extra: domain.getStateExtra?.(problem, initialState),
      move: null,
      moveLabel: null,
      score: null,
      depth: 0,
      discoveryStep: 0,
    };
    searchTree.set('root', rootNode);
    statsByNode.set('root', createStats(initialState));

    yield createStep(
      ctx,
      'initializing',
      `Initialized Monte Carlo Tree Search at ${rootNode.stateLabel}.`,
      0,
      {
        state: initialState,
        availableMoves: initialMoves,
        recursionStack: [],
        searchTree,
        currentNodeId: 'root',
      },
    );

    if (domain.isTerminal(problem, initialState)) {
      const score = domain.terminalValue(problem, initialState, 0);

      yield createStep(
        ctx,
        'found',
        `Reached terminal root state; no move is available.`,
        1,
        {
          state: initialState,
          availableMoves: [],
          currentMove: null,
          bestMove: null,
          bestScore: score,
          recursionStack: [],
          searchTree,
          currentNodeId: 'root',
        },
        { level: 'success' },
      );

      return { bestMove: null, bestScore: score, nodesExpanded: 0, principalVariation: [], outcome: determineOutcome(score) };
    }

    const random = createSeededRandom(hashString(`${domain.stateId(problem, initialState)}|mcts`));
    const iterationBudget = domain.mctsBudget?.(problem) ?? Math.max(384, initialMoves.length * 48);

    for (let iteration = 0; iteration < iterationBudget; iteration++) {
      ctx.nodesExpanded += 1;

      let currentNodeId = 'root';
      let currentState = initialState;
      let currentDepth = 0;
      const pathNodeIds: string[] = ['root'];
      const pathFrames: RecursionFrame[] = [{
        depth: 0,
        nodeKind: rootNode.nodeKind,
        role: 'selection',
        move: null,
        stateLabel: rootNode.stateLabel,
        bestScore: null,
      }];

      let expandedMove: GameMove | null = null;

      while (true) {
        const node = searchTree.get(currentNodeId)!;
        const nodeStats = statsByNode.get(currentNodeId) ?? createStats(currentState);
        statsByNode.set(currentNodeId, nodeStats);

        if (domain.isTerminal(problem, currentState)) {
          node.isTerminal = true;
          node.score = nodeStats.meanValue;
          break;
        }

        if (nodeStats.untriedMoves.length > 0) {
          const moveIndex = Math.floor(random() * nodeStats.untriedMoves.length);
          expandedMove = nodeStats.untriedMoves.splice(moveIndex, 1)[0];
          const childState = domain.applyMove(problem, currentState, expandedMove.id);
          const childId = `${currentNodeId}-${expandedMove.id}-${nodeStats.children.length}`;

          nodeStats.children.push(childId);
          searchTree.set(childId, {
            id: childId,
            parentId: currentNodeId,
            stateLabel: domain.describeState(problem, childState),
            nodeKind: domain.nodeKind(problem, childState),
            extra: domain.getStateExtra?.(problem, childState),
            move: expandedMove.id,
            moveLabel: expandedMove.label,
            score: null,
            depth: currentDepth + 1,
            discoveryStep: ctx.stepNumber,
          });
          statsByNode.set(childId, createStats(childState));

          currentNodeId = childId;
          currentState = childState;
          currentDepth += 1;
          pathNodeIds.push(childId);
          pathFrames.push({
            depth: currentDepth,
            nodeKind: domain.nodeKind(problem, childState),
            role: 'selection',
            move: expandedMove.id,
            stateLabel: domain.describeState(problem, childState),
            bestScore: null,
          });
          break;
        }

        const selectedChildId = selectChild(currentNodeId, currentState, random);
        if (!selectedChildId) break;

        const selectedNode = searchTree.get(selectedChildId)!;
        currentNodeId = selectedChildId;
        currentState = domain.applyMove(problem, currentState, selectedNode.move!);
        currentDepth = selectedNode.depth;
        pathNodeIds.push(currentNodeId);
        pathFrames.push({
          depth: currentDepth,
          nodeKind: selectedNode.nodeKind,
          role: 'selection',
          move: selectedNode.move,
          stateLabel: selectedNode.stateLabel,
          bestScore: statsByNode.get(currentNodeId)?.meanValue ?? null,
        });
      }

      const rollout = simulateRollout(currentState, currentDepth, random);

      for (let index = pathNodeIds.length - 1; index >= 0; index--) {
        const nodeId = pathNodeIds[index];
        const nodeStats = statsByNode.get(nodeId);
        const node = searchTree.get(nodeId);
        if (!nodeStats || !node) continue;

        nodeStats.visits += 1;
        nodeStats.totalValue += rollout.reward;
        nodeStats.meanValue = nodeStats.totalValue / nodeStats.visits;
        node.score = nodeStats.meanValue;
      }

      const rootSummary = summarizeRoot('root');
      const recursionStack: RecursionFrame[] = pathFrames.map((frame, index) => ({
        ...frame,
        role: (index === pathFrames.length - 1 ? 'rollout' : 'selection') as RecursionFrame['role'],
        bestScore: statsByNode.get(pathNodeIds[index])?.meanValue ?? frame.bestScore ?? null,
      }));

      yield createStep(
        ctx,
        'expanding',
        `Iteration ${iteration + 1}/${iterationBudget}: expanded ${expandedMove ? expandedMove.label : 'an existing node'} and rolled out ${rollout.plies} ply for a score of ${rollout.reward}.`,
        3,
        {
          state: currentState,
          availableMoves: domain.isTerminal(problem, currentState) ? [] : domain.legalMoves(problem, currentState).map((m) => m.id),
          currentMove: expandedMove?.id ?? null,
          bestMove: rootSummary.bestMove,
          bestScore: rootSummary.bestScore,
          evaluatedMoves: rootSummary.evaluatedMoves,
          recursionStack,
          searchTree,
          currentNodeId,
        },
      );

      yield createStep(
        ctx,
        'backtracking',
        `Backpropagated reward ${rollout.reward} through ${pathFrames.length} node(s); root now prefers ${rootSummary.bestMove ?? 'no move'} (${rootSummary.bestScore.toFixed(2)}).`,
        5,
        {
          state: initialState,
          availableMoves: initialMoves,
          currentMove: expandedMove?.id ?? null,
          bestMove: rootSummary.bestMove,
          bestScore: rootSummary.bestScore,
          evaluatedMoves: rootSummary.evaluatedMoves,
          recursionStack,
          principalVariation: rootSummary.principalVariation,
          searchTree,
          currentNodeId: 'root',
        },
      );
    }

    const finalSummary = summarizeRoot('root');

    yield createStep(
      ctx,
      'found',
      `Monte Carlo Tree Search selects ${finalSummary.bestMove ?? 'no move'} after ${iterationBudget} simulations with mean score ${finalSummary.bestScore.toFixed(2)}.`,
      6,
      {
        state: initialState,
        availableMoves: initialMoves,
        currentMove: finalSummary.bestMove,
        bestMove: finalSummary.bestMove,
        bestScore: finalSummary.bestScore,
        evaluatedMoves: finalSummary.evaluatedMoves,
        principalVariation: finalSummary.principalVariation,
        recursionStack: [],
        searchTree,
        currentNodeId: 'root',
      },
      { level: 'success' },
    );

    return {
      bestMove: finalSummary.bestMove,
      bestScore: finalSummary.bestScore,
      nodesExpanded: ctx.nodesExpanded,
      principalVariation: finalSummary.principalVariation,
      outcome: determineOutcome(finalSummary.bestScore),
    };
  },
};
