import type { RecursionFrame, TicTacToeRunner } from './types';
import {
  boardKey,
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
import { getLegalMoves, type TicTacToeBoard, type TicTacToePlayer } from '@/lib/tic-tac-toe';

export const minimaxRunner: TicTacToeRunner = {
  meta: {
    id: 'minimax',
    name: 'Minimax',
    shortName: 'Minimax',
    category: 'game-playing',
    description: 'Evaluates the full Tic-Tac-Toe game tree by alternating maximizing and minimizing turns to choose the optimal move.',
    longDescription: 'Minimax assumes perfect play from both sides. For Tic-Tac-Toe, it explores the entire reachable game tree and backs up terminal utilities to identify the best move for the maximizing player.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'adversarial search', 'tic-tac-toe', 'perfect information'],
    bookChapter: 'AIMA 4th Ed. § 5.2',
    relatedAlgorithms: ['alpha-beta', 'negamax'],
  },

  pseudocode: [
    'function MINIMAX(board, player, maximizingPlayer):',
    '  if TERMINAL(board): return UTILITY(board)',
    '  moves <- LEGAL-MOVES(board)',
    '  if player = maximizingPlayer:',
    '    bestScore <- -∞',
    '    for each move in moves:',
    '      score <- MINIMAX(RESULT(board, move), OPPONENT(player), maximizingPlayer)',
    '      bestScore <- max(bestScore, score)',
    '    return bestScore',
    '  bestScore <- +∞',
    '  for each move in moves:',
    '    score <- MINIMAX(RESULT(board, move), OPPONENT(player), maximizingPlayer)',
    '    bestScore <- min(bestScore, score)',
    '  return bestScore',
  ],

  validate: validateTicTacToeProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const resolved = resolveProblem(problem);
    const ctx = createTraceContext();
    const initialMoves = getInitialTraceState(problem).availableMoves;

    yield createStep(
      ctx,
      'initializing',
      `Initialized Minimax for board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
      0,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: initialMoves,
        recursionStack: [],
      },
    );

    const search = function* (
      board: TicTacToeBoard,
      player: TicTacToePlayer,
      depth: number,
      incomingMove: number | null,
      stack: RecursionFrame[],
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const maximizingTurn = player === resolved.maximizingPlayer;
      const role: RecursionFrame['role'] = maximizingTurn ? 'max' : 'min';
      const legalMoves = isTerminal(board) ? [] : getLegalMoves(board);
      const frame: RecursionFrame = { depth, player, role, move: incomingMove, board: [...board], bestScore: null };
      const recursionStack = [...stack, frame];

      yield createStep(
        ctx,
        'expanding',
        `${maximizingTurn ? 'Max' : 'Min'} node at depth ${depth} for ${player}; legal moves: ${legalMoves.map(moveLabel).join(', ') || 'none'}.`,
        maximizingTurn ? 3 : 9,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          recursionStack,
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
          `${player} considers ${moveLabel(move)} at depth ${depth}; exploring child board ${boardKey(childBoard)}.`,
          maximizingTurn ? 6 : 10,
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
          },
        );

        const child = yield* search(childBoard, nextPlayer(player), depth + 1, move, recursionStack);
        evaluatedMoves.push({ move, score: child.score });

        const improved = maximizingTurn ? child.score > bestScore : child.score < bestScore;
        if (improved) {
          bestScore = child.score;
          bestMove = move;
          bestVariation = [move, ...child.principalVariation];
        }

        frame.bestScore = bestScore;
        yield createStep(
          ctx,
          'backtracking',
          `${player} receives score ${child.score} for ${moveLabel(move)}; best so far is ${bestMove !== null ? `${moveLabel(bestMove)} (${bestScore})` : 'none'}.`,
          maximizingTurn ? 7 : 11,
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
            recursionStack: [...stack, { ...frame, board: [...board], bestScore }],
            principalVariation: bestVariation,
          },
        );
      }

      yield createStep(
        ctx,
        'backtracking',
        `${maximizingTurn ? 'Max' : 'Min'} node returns ${bestScore} from ${bestMove !== null ? moveLabel(bestMove) : 'terminal position'}.`,
        maximizingTurn ? 8 : 12,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          bestMove,
          bestScore,
          evaluatedMoves,
          recursionStack,
          principalVariation: bestVariation,
        },
      );

      return { score: bestScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(resolved.board, resolved.currentPlayer, 0, null, []);

    yield createStep(
      ctx,
      'found',
      `Minimax selects ${evaluation.move !== null ? moveLabel(evaluation.move) : 'no move'} with score ${evaluation.score}.`,
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
