import type { EvaluatedMove, GameTreeNode, RecursionFrame, GameRunner } from './types';
import {
  collectBestStrategyLeafIds,
  collectBestStrategyNodeIds,
  computeBestStrategy,
  createStep,
  createTraceContext,
  determineOutcome,
  getInitialTraceState,
  validateGameProblem,
  type SearchEvaluation,
} from './shared';
import { resolveGameDomain } from '@/problems/game-playing/domains';
import type { GameProblem } from '@/types/problem';

function validateNegamaxProblem(problem: GameProblem) {
  const base = validateGameProblem(problem);
  if (!base.valid) return base;
  const hasChance = problem.tree.nodes.some((node) => node.kind === 'chance');
  if (hasChance) {
    return {
      valid: false,
      errors: [
        ...base.errors,
        'Negamax requires a tree of only MAX/MIN/terminal nodes; remove chance nodes or run Minimax, Alpha-Beta, Expectimax, or MCTS instead.',
      ],
    };
  }
  return base;
}

export const negamaxRunner: GameRunner = {
  meta: {
    id: 'negamax',
    name: 'Negamax',
    shortName: 'Negamax',
    category: 'game-playing',
    description: 'Uses the zero-sum symmetry of a MAX/MIN game tree to express Minimax with a single maximization recurrence.',
    longDescription: 'Negamax scores every position from the perspective of the node being evaluated, then flips the sign on the recursive return whenever the parent and child disagree on who is maximizing. It has no defined extension for chance nodes, so it is only offered on trees built from MAX, MIN, and terminal nodes.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'negamax', 'zero-sum'],
    bookChapter: 'AIMA 4th Ed. § 5.2',
    relatedAlgorithms: ['minimax', 'alpha-beta'],
  },

  pseudocode: [
    'function NEGAMAX(state, color):',
    '  # color = +1 if state is a MAX node, -1 if MIN',
    '  if TERMINAL(state): return color * UTILITY(state)',
    '  bestScore <- -∞',
    '  for each move in ACTIONS(state):',
    '    child <- RESULT(state, move)',
    '    childColor <- +1 if child is MAX, -1 if MIN',
    '    childScore <- NEGAMAX(child, childColor)',
    '    score <- color = childColor ? childScore : -childScore',
    '    bestScore <- max(bestScore, score)',
    '  return bestScore',
  ],

  validate: validateNegamaxProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const domain = resolveGameDomain(problem);
    const ctx = createTraceContext(problem);
    const initialState = domain.initialState(problem);
    const initialMoves = domain.legalMoves(problem, initialState).map((move) => move.id);
    const searchTree = new Map<string, GameTreeNode>();

    const colorOf = (kind: ReturnType<typeof domain.nodeKind>): 1 | -1 => (kind === 'min' ? -1 : 1);

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
      `Initialized Negamax at ${rootNode.stateLabel}.`,
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
      color: 1 | -1,
      incomingMove: string | null,
      stack: RecursionFrame[],
      nodeId: string,
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const kind = domain.nodeKind(problem, state);
      const stateLabel = domain.describeState(problem, state);
      const isTerminal = domain.isTerminal(problem, state);
      const moves = isTerminal ? [] : domain.legalMoves(problem, state);
      const frame: RecursionFrame = { depth, nodeKind: kind, role: 'negamax', move: incomingMove, stateLabel, bestScore: null };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `Negamax node at depth ${depth} (${kind.toUpperCase()}, color ${color}); moves: ${moves.map((move) => move.label).join(', ') || 'none'}.`,
        2,
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
        const utility = domain.terminalValue(problem, state, depth);
        const signedScore = color * utility;
        node.score = signedScore;
        node.isTerminal = true;

        yield createStep(
          ctx,
          'found',
          `Reached terminal state at depth ${depth}; base utility ${utility}, color-adjusted score ${signedScore}.`,
          1,
          {
            state,
            availableMoves: [],
            currentMove: incomingMove,
            currentScore: signedScore,
            bestScore: signedScore,
            recursionStack,
            searchTree,
            currentNodeId: nodeId,
          },
          { level: 'success' },
        );

        return { score: signedScore, move: null, principalVariation: [] };
      }

      let bestScore = Number.NEGATIVE_INFINITY;
      let bestMove: string | null = null;
      let bestVariation: string[] = [];
      const evaluatedMoves: EvaluatedMove[] = [];

      for (const move of moves) {
        const childState = domain.applyMove(problem, state, move.id);
        const childId = `${nodeId}-${move.id}`;
        const childKind = domain.nodeKind(problem, childState);
        const childColor = colorOf(childKind);

        searchTree.set(childId, {
          id: childId,
          parentId: nodeId,
          stateLabel: domain.describeState(problem, childState),
          nodeKind: childKind,
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
          `Explores ${move.label}; Negamax will ${color === childColor ? 'keep' : 'negate'} the child result on return.`,
          3,
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

        const child = yield* search(childState, depth + 1, childColor, move.id, recursionStack, childId);
        const candidateScore = color === childColor ? child.score : -child.score;
        evaluatedMoves.push({ move: move.id, score: candidateScore });

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestMove = move.id;
          bestVariation = [move.id, ...child.principalVariation];
        }

        frame.bestScore = bestScore;
        node.score = bestScore;

        yield createStep(
          ctx,
          'backtracking',
          `Combines child score ${child.score} into ${candidateScore}; best so far is ${bestMove ?? 'none'} (${bestScore}).`,
          5,
          {
            state,
            availableMoves: moves.map((m) => m.id),
            currentMove: move.id,
            currentScore: candidateScore,
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
        `Negamax node returns ${bestScore} via ${bestMove ?? 'terminal position'}.`,
        6,
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

    const initialColor = colorOf(domain.nodeKind(problem, initialState));
    const evaluation = yield* search(initialState, 0, initialColor, null, [], 'root');
    const bestStrategy = computeBestStrategy(domain, problem, initialState);
    const bestStrategyLeafIds = collectBestStrategyLeafIds(bestStrategy);
    const bestStrategyNodeIds = collectBestStrategyNodeIds(bestStrategy);

    yield createStep(
      ctx,
      'found',
      `Negamax selects ${evaluation.move ?? 'no move'} with score ${evaluation.score}.`,
      6,
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
