import type { EvaluatedMove, GameTreeNode, RecursionFrame, GameRunner } from './types';
import {
  collectBestStrategyLeafIds,
  collectBestStrategyNodeIds,
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

export const minimaxRunner: GameRunner = {
  meta: {
    id: 'minimax',
    name: 'Minimax',
    shortName: 'Minimax',
    category: 'game-playing',
    description: 'Evaluates the full game tree by alternating maximizing and minimizing turns to choose the optimal move.',
    longDescription: 'Minimax assumes perfect play from both sides. It explores the entire reachable game tree and backs up terminal utilities to identify the best move for the maximizing player. Chance nodes (if present) are backed up as a probability-weighted average, generalizing Minimax into Expectiminimax.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'adversarial search', 'perfect information'],
    bookChapter: 'AIMA 4th Ed. § 5.2',
    relatedAlgorithms: ['alpha-beta', 'negamax'],
  },

  pseudocode: [
    'function MINIMAX(state):',
    '  if TERMINAL(state): return UTILITY(state)',
    '  moves <- ACTIONS(state)',
    '  if MAX(state):',
    '    bestScore <- -∞',
    '    for each move in moves:',
    '      score <- MINIMAX(RESULT(state, move))',
    '      bestScore <- max(bestScore, score)',
    '    return bestScore',
    '  if MIN(state):',
    '    bestScore <- +∞',
    '    for each move in moves:',
    '      score <- MINIMAX(RESULT(state, move))',
    '      bestScore <- min(bestScore, score)',
    '    return bestScore',
    '  # CHANCE(state): probability-weighted average of children',
    '  return Σ P(move) * MINIMAX(RESULT(state, move))',
  ],

  validate: validateGameProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const domain = resolveGameDomain(problem);
    const ctx = createTraceContext(problem);
    const initialState = domain.initialState(problem);
    const initialMoves = domain.legalMoves(problem, initialState).map((move) => move.id);
    const searchTree = new Map<string, GameTreeNode>();

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

    yield createStep(
      ctx,
      'initializing',
      `Initialized Minimax at ${rootNode.stateLabel}.`,
      0,
      {
        state: initialState,
        availableMoves: initialMoves,
        recursionStack: [],
        searchTree,
        currentNodeId: 'root',
      },
    );

    const search = function* (
      state: unknown,
      depth: number,
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
      const frame: RecursionFrame = { depth, nodeKind: kind, role, move: incomingMove, stateLabel, bestScore: null };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `${kind.toUpperCase()} node at depth ${depth}; legal moves: ${moves.map((move) => move.label).join(', ') || 'none'}.`,
        kind === 'max' ? 3 : kind === 'min' ? 9 : 15,
        {
          state,
          availableMoves: moves.map((move) => move.id),
          currentMove: incomingMove,
          recursionStack,
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
            depth: depth + 1,
            discoveryStep: ctx.stepNumber,
          });

          const child = yield* search(childState, depth + 1, move.id, recursionStack, childId);
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
            16,
            {
              state,
              availableMoves: moves.map((m) => m.id),
              currentMove: move.id,
              currentScore: child.score,
              bestScore: expectedScore,
              evaluatedMoves,
              recursionStack: [...stack, { ...frame }],
              searchTree,
              currentNodeId: nodeId,
            },
          );
        }

        yield createStep(
          ctx,
          'backtracking',
          `Chance node returns expected value ${expectedScore.toFixed(2)} from ${moves.length} reply(s).`,
          16,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: incomingMove,
            bestMove,
            bestScore: expectedScore,
            evaluatedMoves,
            recursionStack,
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
          depth: depth + 1,
          discoveryStep: ctx.stepNumber,
        });

        yield createStep(
          ctx,
          'visiting',
          `${kind.toUpperCase()} node considers ${move.label} at depth ${depth}.`,
          maximizing ? 6 : 13,
          {
            state: childState,
            availableMoves: domain.isTerminal(problem, childState) ? [] : domain.legalMoves(problem, childState).map((m) => m.id),
            currentMove: move.id,
            bestMove,
            bestScore: Number.isFinite(bestScore) ? bestScore : null,
            evaluatedMoves,
            recursionStack,
            searchTree,
            currentNodeId: childId,
          },
        );

        const child = yield* search(childState, depth + 1, move.id, recursionStack, childId);
        evaluatedMoves.push({ move: move.id, score: child.score });

        const improved = maximizing ? child.score > bestScore : child.score < bestScore;
        if (improved) {
          bestScore = child.score;
          bestMove = move.id;
          bestVariation = [move.id, ...child.principalVariation];
        }

        frame.bestScore = bestScore;
        node.score = bestScore;

        yield createStep(
          ctx,
          'backtracking',
          `Receives score ${child.score} for ${move.label}; best so far is ${bestMove !== null ? `${bestMove} (${bestScore})` : 'none'}.`,
          maximizing ? 7 : 14,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: move.id,
            currentScore: child.score,
            bestMove,
            bestScore,
            evaluatedMoves,
            recursionStack: [...stack, { ...frame }],
            principalVariation: bestVariation,
            searchTree,
            currentNodeId: nodeId,
          },
        );
      }

      yield createStep(
        ctx,
        'backtracking',
        `${kind.toUpperCase()} node returns ${bestScore} from ${bestMove ?? 'terminal position'}.`,
        maximizing ? 8 : 15,
        {
          state,
          availableMoves: moves.map((m) => m.id),
          currentMove: incomingMove,
          bestMove,
          bestScore,
          evaluatedMoves,
          recursionStack,
          principalVariation: bestVariation,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      return { score: bestScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(initialState, 0, null, [], 'root');
    const bestStrategy = computeBestStrategy(domain, problem, initialState);
    const bestStrategyLeafIds = collectBestStrategyLeafIds(bestStrategy);
    const bestStrategyNodeIds = collectBestStrategyNodeIds(bestStrategy);

    yield createStep(
      ctx,
      'found',
      `Minimax selects ${evaluation.move ?? 'no move'} with score ${evaluation.score}.`,
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
        recursionStack: [],
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
