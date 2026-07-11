import type { EvaluatedMove, GameTreeNode, RecursionFrame, GameRunner } from './types';
import {
  collectBestStrategyLeafIds,
  collectBestStrategyNodeIds,
  collectTerminalDescendantIds,
  computeBestStrategy,
  createStep,
  createTerminalDescription,
  createTraceContext,
  determineOutcome,
  getInitialTraceState,
  validateGameProblem,
  type SearchEvaluation,
} from './shared';
import { resolveGameDomain } from '@/problems/game-playing/domains';

export const alphaBetaRunner: GameRunner = {
  meta: {
    id: 'alpha-beta',
    name: 'Alpha-Beta Pruning',
    shortName: 'Alpha-Beta',
    category: 'game-playing',
    description: 'Runs Minimax with alpha-beta bounds to prune branches that cannot affect the final decision.',
    longDescription: 'Alpha-beta pruning preserves Minimax optimality while skipping provably irrelevant branches once the current node is outside the allowable score window. Chance nodes (if present) compute a probability-weighted average with no pruning bound of their own, but pruning stays fully active at any MAX/MIN ancestor above them.',
    timeComplexity: 'O(b^m), best case O(b^(m/2))',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'alpha-beta pruning', 'adversarial search'],
    bookChapter: 'AIMA 4th Ed. § 5.3',
    relatedAlgorithms: ['minimax', 'negamax'],
  },

  pseudocode: [
    'function ALPHA-BETA(state, alpha, beta):',
    '  if TERMINAL(state): return UTILITY(state)',
    '  if MAX(state):',
    '    value <- -∞',
    '    for each move in ACTIONS(state):',
    '      value <- max(value, ALPHA-BETA(RESULT(state, move), alpha, beta))',
    '      if value >= beta: return value',
    '      alpha <- max(alpha, value)',
    '    return value',
    '  if MIN(state):',
    '    value <- +∞',
    '    for each move in ACTIONS(state):',
    '      value <- min(value, ALPHA-BETA(RESULT(state, move), alpha, beta))',
    '      if value <= alpha: return value',
    '      beta <- min(beta, value)',
    '    return value',
    '  # CHANCE(state): no pruning at this node',
    '  return Σ P(move) * ALPHA-BETA(RESULT(state, move), alpha, beta)',
  ],

  validate: validateGameProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const domain = resolveGameDomain(problem);
    const ctx = createTraceContext(problem);
    const initialState = domain.initialState(problem);
    const initialMoves = domain.legalMoves(problem, initialState).map((move) => move.id);
    const searchTree = new Map<string, GameTreeNode>();
    // Pruned branches are never actually visited, so their horizon descendants have to be found
    // via a fresh domain-level walk rather than read off the (incomplete) search tree.
    const alphaCutHorizonIds = new Set<string>();
    const betaCutHorizonIds = new Set<string>();

    const rootNode: GameTreeNode = {
      id: 'root',
      parentId: null,
      stateLabel: domain.describeState(problem, initialState),
      nodeKind: domain.nodeKind(problem, initialState),
      extra: domain.getStateExtra?.(problem, initialState),
      move: null,
      moveLabel: null,
      score: null,
      alpha: Number.NEGATIVE_INFINITY,
      beta: Number.POSITIVE_INFINITY,
      depth: 0,
      discoveryStep: 0,
    };
    searchTree.set('root', rootNode);

    yield createStep(
      ctx,
      'initializing',
      `Initialized Alpha-Beta at ${rootNode.stateLabel}.`,
      0,
      {
        state: initialState,
        availableMoves: initialMoves,
        recursionStack: [],
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
        searchTree,
        currentNodeId: 'root',
      },
    );

    const search = function* (
      state: unknown,
      depth: number,
      alpha: number,
      beta: number,
      incomingMove: string | null,
      stack: RecursionFrame[],
      nodeId: string,
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const kind = domain.nodeKind(problem, state);
      const stateLabel = domain.describeState(problem, state);
      const isTerminal = domain.isTerminal(problem, state);
      const moves = isTerminal ? [] : domain.legalMoves(problem, state);
      const role: RecursionFrame['role'] = kind === 'chance' ? 'chance' : kind === 'min' ? 'min' : 'max';
      const frame: RecursionFrame = { depth, nodeKind: kind, role, move: incomingMove, stateLabel, alpha, beta, bestScore: null };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `${kind.toUpperCase()} node at depth ${depth} opens with α=${alpha}, β=${beta}.`,
        kind === 'max' ? 2 : kind === 'min' ? 9 : 16,
        {
          state,
          availableMoves: moves.map((move) => move.id),
          currentMove: incomingMove,
          recursionStack,
          alpha,
          beta,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      if (isTerminal) {
        const score = domain.terminalValue(problem, state, depth);
        node.score = score;
        node.isTerminal = true;

        yield createStep(
          ctx,
          'found',
          createTerminalDescription(ctx, state, depth),
          1,
          {
            state,
            availableMoves: [],
            currentMove: incomingMove,
            currentScore: score,
            bestScore: score,
            recursionStack,
            alpha,
            beta,
            searchTree,
            currentNodeId: nodeId,
          },
          { level: 'success' },
        );

        return { score, move: null, principalVariation: [] };
      }

      if (kind === 'chance') {
        let expectedScore = 0;
        let bestMove: string | null = null;
        let bestChildScore = Number.NEGATIVE_INFINITY;
        let bestVariation: string[] = [];
        const evaluatedMoves: EvaluatedMove[] = [];

        for (const move of moves) {
          const childState = domain.applyMove(problem, state, move.id);
          const childId = `${nodeId}-${move.id}`;
          const probability = move.probability ?? 1 / moves.length;

          searchTree.set(childId, {
            id: childId,
            parentId: nodeId,
            stateLabel: domain.describeState(problem, childState),
            nodeKind: domain.nodeKind(problem, childState),
            extra: domain.getStateExtra?.(problem, childState),
            move: move.id,
            moveLabel: move.label,
            score: null,
            alpha,
            beta,
            depth: depth + 1,
            discoveryStep: ctx.stepNumber,
          });

          const child = yield* search(childState, depth + 1, alpha, beta, move.id, recursionStack, childId);
          evaluatedMoves.push({ move: move.id, score: child.score, detail: `p=${probability.toFixed(2)}` });
          expectedScore += child.score * probability;

          if (child.score > bestChildScore) {
            bestChildScore = child.score;
            bestMove = move.id;
            bestVariation = [move.id, ...child.principalVariation];
          }

          frame.bestScore = expectedScore;
          node.score = expectedScore;

          yield createStep(
            ctx,
            'backtracking',
            `Samples ${move.label} with probability ${probability.toFixed(2)} => ${child.score}; expected value now ${expectedScore.toFixed(2)}.`,
            17,
            {
              state,
              availableMoves: moves.map((m) => m.id),
              currentMove: move.id,
              currentScore: child.score,
              bestScore: expectedScore,
              evaluatedMoves,
              recursionStack: [...stack, { ...frame }],
              alpha,
              beta,
              searchTree,
              currentNodeId: nodeId,
            },
          );
        }

        yield createStep(
          ctx,
          'backtracking',
          `Chance node returns expected value ${expectedScore.toFixed(2)} from ${moves.length} reply(s).`,
          17,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: incomingMove,
            bestMove,
            bestScore: expectedScore,
            evaluatedMoves,
            recursionStack,
            alpha,
            beta,
            searchTree,
            currentNodeId: nodeId,
          },
        );

        return { score: expectedScore, move: bestMove, principalVariation: bestVariation };
      }

      const maximizing = kind === 'max';
      let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      let bestMove: string | null = null;
      let bestVariation: string[] = [];
      const evaluatedMoves: EvaluatedMove[] = [];

      for (const move of moves) {
        const childState = domain.applyMove(problem, state, move.id);
        const childId = `${nodeId}-${move.id}`;

        searchTree.set(childId, {
          id: childId,
          parentId: nodeId,
          stateLabel: domain.describeState(problem, childState),
          nodeKind: domain.nodeKind(problem, childState),
          extra: domain.getStateExtra?.(problem, childState),
          move: move.id,
          moveLabel: move.label,
          score: null,
          alpha,
          beta,
          depth: depth + 1,
          discoveryStep: ctx.stepNumber,
        });

        const child = yield* search(childState, depth + 1, alpha, beta, move.id, recursionStack, childId);
        evaluatedMoves.push({ move: move.id, score: child.score });

        const improved = maximizing ? child.score > bestScore : child.score < bestScore;
        if (improved) {
          bestScore = child.score;
          bestMove = move.id;
          bestVariation = [move.id, ...child.principalVariation];
        }

        if (maximizing) {
          alpha = Math.max(alpha, bestScore);
        } else {
          beta = Math.min(beta, bestScore);
        }

        frame.alpha = alpha;
        frame.beta = beta;
        frame.bestScore = bestScore;
        node.score = bestScore;
        node.alpha = alpha;
        node.beta = beta;

        const shouldPrune = maximizing ? bestScore >= beta : bestScore <= alpha;
        if (shouldPrune) {
          const remainingMoves = moves.filter((candidate) => candidate.id !== move.id && !evaluatedMoves.some((item) => item.move === candidate.id));
          // Beta cuts fire while maximizing (value >= beta); alpha cuts fire while minimizing (value <= alpha).
          const cutKind: 'alpha' | 'beta' = maximizing ? 'beta' : 'alpha';
          const cutHorizonSet = maximizing ? betaCutHorizonIds : alphaCutHorizonIds;

          for (const remaining of remainingMoves) {
            const prunedId = `${nodeId}-${remaining.id}`;
            const prunedState = domain.applyMove(problem, state, remaining.id);
            searchTree.set(prunedId, {
              id: prunedId,
              parentId: nodeId,
              stateLabel: domain.describeState(problem, prunedState),
              nodeKind: domain.nodeKind(problem, prunedState),
              extra: domain.getStateExtra?.(problem, prunedState),
              move: remaining.id,
              moveLabel: remaining.label,
              score: null,
              alpha,
              beta,
              depth: depth + 1,
              isPruned: true,
              prunedBy: cutKind,
              discoveryStep: ctx.stepNumber,
            });

            // The pruned branch was never explored, so find its horizon descendants (if any)
            // with a fresh domain walk rather than relying on the (nonexistent) search-tree entries.
            if (domain.isTerminal(problem, prunedState)) {
              cutHorizonSet.add(remaining.id);
            } else {
              for (const leafId of collectTerminalDescendantIds(domain, problem, prunedState)) {
                cutHorizonSet.add(leafId);
              }
            }
          }

          yield createStep(
            ctx,
            'pruning',
            `Pruned ${remainingMoves.length} remaining move(s) because ${maximizing ? `value ${bestScore} >= β ${beta}` : `value ${bestScore} <= α ${alpha}`}.`,
            maximizing ? 6 : 14,
            {
              state,
              availableMoves: remainingMoves.map((m) => m.id),
              currentMove: move.id,
              bestMove,
              bestScore,
              evaluatedMoves,
              recursionStack: [...stack, { ...frame }],
              alpha,
              beta,
              principalVariation: bestVariation,
              alphaCutHorizonIds: [...alphaCutHorizonIds],
              betaCutHorizonIds: [...betaCutHorizonIds],
              searchTree,
              currentNodeId: nodeId,
            },
            { level: 'warn' },
          );
          break;
        }
      }

      yield createStep(
        ctx,
        'backtracking',
        `${kind.toUpperCase()} node returns ${bestScore} via ${bestMove ?? 'terminal position'}.`,
        maximizing ? 8 : 15,
        {
          state,
          availableMoves: moves.map((m) => m.id),
          currentMove: incomingMove,
          bestMove,
          bestScore,
          evaluatedMoves,
          recursionStack: [...stack, { ...frame }],
          alpha,
          beta,
          principalVariation: bestVariation,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      return { score: bestScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(
      initialState,
      0,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      null,
      [],
      'root',
    );
    // Pruning means the trace itself may never have visited large parts of the tree, so the
    // best-strategy subtree is computed independently, same as the other exhaustive runners.
    const bestStrategy = computeBestStrategy(domain, problem, initialState);
    const bestStrategyLeafIds = collectBestStrategyLeafIds(bestStrategy);
    const bestStrategyNodeIds = collectBestStrategyNodeIds(bestStrategy);

    yield createStep(
      ctx,
      'found',
      `Alpha-Beta selects ${evaluation.move ?? 'no move'} with score ${evaluation.score}.`,
      8,
      {
        state: initialState,
        availableMoves: initialMoves,
        currentMove: evaluation.move,
        bestMove: evaluation.move,
        bestScore: evaluation.score,
        principalVariation: evaluation.principalVariation,
        bestStrategyLeafIds,
        bestStrategyNodeIds,
        alphaCutHorizonIds: [...alphaCutHorizonIds],
        betaCutHorizonIds: [...betaCutHorizonIds],
        recursionStack: [],
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
        searchTree,
        currentNodeId: 'root',
      },
      { level: 'success' },
    );

    return {
      bestMove: evaluation.move,
      bestScore: evaluation.score,
      nodesExpanded: ctx.nodesExpanded,
      principalVariation: evaluation.principalVariation,
      outcome: determineOutcome(evaluation.score),
    };
  },
};
