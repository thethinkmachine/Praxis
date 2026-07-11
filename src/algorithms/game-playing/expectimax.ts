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

export const expectimaxRunner: GameRunner = {
  meta: {
    id: 'expectimax',
    name: 'Expectimax',
    shortName: 'Expectimax',
    category: 'game-playing',
    description: 'Evaluates a game tree by maximizing expected utility while every non-maximizing node is modeled as a chance node.',
    longDescription: 'Expectimax generalizes Minimax to stochastic settings: it never assumes an adversarial opponent. Any node that is not a MAX node — whether the tree author labeled it MIN or CHANCE — is averaged over its children (weighted by the edge probabilities on true chance nodes, or uniformly otherwise). This is what distinguishes it from Minimax, which treats MIN nodes adversarially: on a tree with an explicit MIN node the two algorithms can disagree, illustrating why Expectimax suits non-adversarial environments.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: 'Optimal only under the assumed chance-node model (non-adversarial opponent), unlike Minimax\'s worst-case guarantee',
    tags: ['game tree', 'expectimax', 'chance nodes', 'stochastic search'],
    bookChapter: 'Chapter 5',
    relatedAlgorithms: ['minimax', 'mcts'],
  },

  pseudocode: [
    'function EXPECTIMAX(state):',
    '  if TERMINAL(state): return UTILITY(state)',
    '  if MAX(state):',
    '    value <- -∞',
    '    for each move in ACTIONS(state):',
    '      value <- max(value, EXPECTIMAX(RESULT(state, move)))',
    '    return value',
    '  # every other node (MIN or CHANCE) is averaged, never minimized',
    '  value <- 0',
    '  for each move in ACTIONS(state):',
    '    value <- value + P(move) * EXPECTIMAX(RESULT(state, move))',
    '  return value',
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
      `Initialized Expectimax at ${rootNode.stateLabel}.`,
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
      const maximizingTurn = kind === 'max';
      const role: RecursionFrame['role'] = maximizingTurn ? 'max' : 'chance';
      const frame: RecursionFrame = { depth, nodeKind: kind, role, move: incomingMove, stateLabel, bestScore: null };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `${maximizingTurn ? 'Max' : 'Chance'} node at depth ${depth}; legal moves: ${moves.map((move) => move.label).join(', ') || 'none'}.`,
        maximizingTurn ? 3 : 8,
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

      if (maximizingTurn) {
        let bestScore = Number.NEGATIVE_INFINITY;
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
            `Considers ${move.label} while maximizing expected value.`,
            4,
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
          evaluatedMoves.push({
            move: move.id,
            score: child.score,
            detail: child.principalVariation.length > 0 ? `line: ${child.principalVariation.join(' → ')}` : undefined,
          });

          if (child.score > bestScore) {
            bestScore = child.score;
            bestMove = move.id;
            bestVariation = [move.id, ...child.principalVariation];
          }

          frame.bestScore = bestScore;
          node.score = bestScore;

          yield createStep(
            ctx,
            'backtracking',
            `Receives score ${child.score} for ${move.label}; best so far is ${bestMove ?? 'none'} (${bestScore}).`,
            5,
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
          `Max node returns ${bestScore} from ${bestMove ?? 'terminal position'}.`,
          6,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: incomingMove,
            bestMove,
            bestScore,
            evaluatedMoves,
            recursionStack: [...stack, { ...frame }],
            principalVariation: bestVariation,
            searchTree,
            currentNodeId: nodeId,
          },
        );

        return { score: bestScore, move: bestMove, principalVariation: bestVariation };
      }

      let expectedScore = 0;
      let bestMove: string | null = null;
      let bestChildScore = Number.NEGATIVE_INFINITY;
      let bestVariation: string[] = [];
      const evaluatedMoves: EvaluatedMove[] = [];

      for (const move of moves) {
        const childState = domain.applyMove(problem, state, move.id);
        const childId = `${nodeId}-${move.id}`;
        // Every non-MAX node is averaged uniformly unless the tree explicitly
        // supplies chance-node probabilities.
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

        yield createStep(
          ctx,
          'visiting',
          `Samples ${move.label} with probability ${probability.toFixed(2)}.`,
          9,
          {
            state: childState,
            availableMoves: domain.isTerminal(problem, childState) ? [] : domain.legalMoves(problem, childState).map((m) => m.id),
            currentMove: move.id,
            bestMove,
            bestScore: Number.isFinite(expectedScore) ? expectedScore : null,
            evaluatedMoves,
            recursionStack,
            searchTree,
            currentNodeId: childId,
          },
        );

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
          `Samples ${move.label} => ${child.score}; expected value now ${expectedScore.toFixed(2)}.`,
          10,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: move.id,
            currentScore: child.score,
            bestMove,
            bestScore: expectedScore,
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
        `Chance node returns expected value ${expectedScore.toFixed(2)} from ${moves.length} equally-weighted reply(s).`,
        11,
        {
          state,
          availableMoves: moves.map((m) => m.id),
          currentMove: incomingMove,
          bestMove,
          bestScore: expectedScore,
          evaluatedMoves,
          recursionStack: [...stack, { ...frame }],
          principalVariation: bestVariation,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      return { score: expectedScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(initialState, 0, null, [], 'root');
    const finalEvaluatedMoves: EvaluatedMove[] = [...searchTree.values()]
      .filter((node) => node.parentId === 'root' && node.move !== null)
      .map((node) => ({ move: node.move!, score: node.score ?? 0 }));
    // treatMinAsChance=true: Expectimax averages every non-MAX node (MIN or CHANCE), so the
    // reported strategy has to use that same semantics rather than adversarial minimax.
    const bestStrategy = computeBestStrategy(domain, problem, initialState, true);
    const bestStrategyLeafIds = collectBestStrategyLeafIds(bestStrategy);
    const bestStrategyNodeIds = collectBestStrategyNodeIds(bestStrategy);

    yield createStep(
      ctx,
      'found',
      `Expectimax selects ${evaluation.move ?? 'no move'} with expected score ${evaluation.score.toFixed(2)}.`,
      12,
      {
        state: initialState,
        availableMoves: initialMoves,
        currentMove: evaluation.move,
        bestMove: evaluation.move,
        bestScore: evaluation.score,
        evaluatedMoves: finalEvaluatedMoves,
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
