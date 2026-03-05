import type { RecursionFrame, TicTacToeRunner } from './types';
import {
  createStep,
  createTerminalDescription,
  createTraceContext,
  determineOutcome,
  getInitialTraceState,
  isTerminal,
  moveLabel,
  nextBoard,
  nextPlayer,
  resolveProblem,
  terminalEvaluation,
  validateTicTacToeProblem,
  type SearchEvaluation,
} from './shared';
import { boardKey, getLegalMoves, type TicTacToeBoard, type TicTacToePlayer } from '@/lib/tic-tac-toe';

export const alphaBetaRunner: TicTacToeRunner = {
  meta: {
    id: 'alpha-beta',
    name: 'Alpha-Beta Pruning',
    shortName: 'Alpha-Beta',
    category: 'game-playing',
    description: 'Runs Minimax with alpha-beta bounds to prune branches that cannot affect the final Tic-Tac-Toe decision.',
    longDescription: 'Alpha-beta pruning preserves Minimax optimality while skipping provably irrelevant branches once the current node is outside the allowable score window.',
    timeComplexity: 'O(b^m), best case O(b^(m/2))',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'alpha-beta pruning', 'tic-tac-toe', 'adversarial search'],
    bookChapter: 'AIMA 4th Ed. § 5.3',
    relatedAlgorithms: ['minimax', 'negamax'],
  },

  pseudocode: [
    'function ALPHA-BETA(board, player, alpha, beta):',
    '  if TERMINAL(board): return UTILITY(board)',
    '  if player = maximizingPlayer:',
    '    value <- -∞',
    '    for each move in LEGAL-MOVES(board):',
    '      value <- max(value, ALPHA-BETA(RESULT(board, move), OPPONENT(player), alpha, beta))',
    '      if value >= beta: return value',
    '      alpha <- max(alpha, value)',
    '    return value',
    '  value <- +∞',
    '  for each move in LEGAL-MOVES(board):',
    '    value <- min(value, ALPHA-BETA(RESULT(board, move), OPPONENT(player), alpha, beta))',
    '    if value <= alpha: return value',
    '    beta <- min(beta, value)',
    '  return value',
  ],

  validate: validateTicTacToeProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const resolved = resolveProblem(problem);
    const ctx = createTraceContext();
    const initialMoves = getLegalMoves(resolved.board);

    yield createStep(
      ctx,
      'initializing',
      `Initialized Alpha-Beta on board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
      0,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: initialMoves,
        recursionStack: [],
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
      },
    );

    const search = function* (
      board: TicTacToeBoard,
      player: TicTacToePlayer,
      depth: number,
      alpha: number,
      beta: number,
      incomingMove: number | null,
      stack: RecursionFrame[],
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const maximizingTurn = player === resolved.maximizingPlayer;
      const role: RecursionFrame['role'] = maximizingTurn ? 'max' : 'min';
      const legalMoves = isTerminal(board) ? [] : getLegalMoves(board);
      const frame: RecursionFrame = {
        depth,
        player,
        role,
        move: incomingMove,
        board: [...board],
        alpha,
        beta,
        bestScore: null,
      };
      const recursionStack = [...stack, frame];

      yield createStep(
        ctx,
        'expanding',
        `${maximizingTurn ? 'Max' : 'Min'} node at depth ${depth} opens with α=${alpha}, β=${beta}.`,
        maximizingTurn ? 2 : 9,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          recursionStack,
          alpha,
          beta,
        },
      );

      if (isTerminal(board)) {
        const terminal = terminalEvaluation(board, resolved.maximizingPlayer, depth);
        yield createStep(
          ctx,
          'found',
          createTerminalDescription(board, resolved.maximizingPlayer, depth),
          1,
          {
            board,
            currentPlayer: player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: [],
            currentMove: incomingMove,
            currentScore: terminal.score,
            bestScore: terminal.score,
            recursionStack,
            alpha,
            beta,
          },
          { level: 'success', winningLine: terminal.winningLine },
        );

        return { score: terminal.score, move: null, principalVariation: [] };
      }

      let bestScore = maximizingTurn ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      let bestMove: number | null = null;
      let bestVariation: number[] = [];
      const evaluatedMoves: Array<{ move: number; score: number }> = [];

      for (const move of legalMoves) {
        const childBoard = nextBoard(board, move, player);

        yield createStep(
          ctx,
          'visiting',
          `${player} explores ${moveLabel(move)} with current window [${alpha}, ${beta}].`,
          maximizingTurn ? 4 : 10,
          {
            board: childBoard,
            currentPlayer: nextPlayer(player),
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: getLegalMoves(childBoard),
            currentMove: move,
            bestMove,
            bestScore: Number.isFinite(bestScore) ? bestScore : null,
            evaluatedMoves,
            recursionStack,
            alpha,
            beta,
          },
        );

        const child = yield* search(childBoard, nextPlayer(player), depth + 1, alpha, beta, move, recursionStack);
        evaluatedMoves.push({ move, score: child.score });

        const improved = maximizingTurn ? child.score > bestScore : child.score < bestScore;
        if (improved) {
          bestScore = child.score;
          bestMove = move;
          bestVariation = [move, ...child.principalVariation];
        }

        if (maximizingTurn) {
          alpha = Math.max(alpha, bestScore);
        } else {
          beta = Math.min(beta, bestScore);
        }

        frame.alpha = alpha;
        frame.beta = beta;
        frame.bestScore = bestScore;

        yield createStep(
          ctx,
          'backtracking',
          `${player} backs up ${child.score} from ${moveLabel(move)}; best=${bestScore}, α=${alpha}, β=${beta}.`,
          maximizingTurn ? 7 : 13,
          {
            board,
            currentPlayer: player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: legalMoves,
            currentMove: move,
            currentScore: child.score,
            bestMove,
            bestScore,
            evaluatedMoves,
            recursionStack: [...stack, { ...frame, board: [...board] }],
            alpha,
            beta,
            principalVariation: bestVariation,
          },
        );

        const shouldPrune = maximizingTurn ? bestScore >= beta : bestScore <= alpha;
        if (shouldPrune) {
          const remainingMoves = legalMoves.filter(candidate => candidate !== move && !evaluatedMoves.some(item => item.move === candidate));
          yield createStep(
            ctx,
            'pruning',
            `Pruned ${remainingMoves.length} remaining move(s) because ${maximizingTurn ? `value ${bestScore} >= β ${beta}` : `value ${bestScore} <= α ${alpha}`}.`,
            maximizingTurn ? 6 : 12,
            {
              board,
              currentPlayer: player,
              maximizingPlayer: resolved.maximizingPlayer,
              availableMoves: remainingMoves,
              currentMove: move,
              bestMove,
              bestScore,
              evaluatedMoves,
              recursionStack: [...stack, { ...frame, board: [...board] }],
              alpha,
              beta,
              principalVariation: bestVariation,
            },
            { level: 'warn' },
          );
          break;
        }
      }

      yield createStep(
        ctx,
        'backtracking',
        `${maximizingTurn ? 'Max' : 'Min'} node returns ${bestScore} via ${bestMove !== null ? moveLabel(bestMove) : 'terminal position'}.`,
        maximizingTurn ? 8 : 14,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          bestMove,
          bestScore,
          evaluatedMoves,
          recursionStack: [...stack, { ...frame, board: [...board] }],
          alpha,
          beta,
          principalVariation: bestVariation,
        },
      );

      return { score: bestScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(
      resolved.board,
      resolved.currentPlayer,
      0,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      null,
      [],
    );

    yield createStep(
      ctx,
      'found',
      `Alpha-Beta selects ${evaluation.move !== null ? moveLabel(evaluation.move) : 'no move'} with score ${evaluation.score}.`,
      8,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: initialMoves,
        currentMove: evaluation.move,
        bestMove: evaluation.move,
        bestScore: evaluation.score,
        principalVariation: evaluation.principalVariation,
        recursionStack: [],
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
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
