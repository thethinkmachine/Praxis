import type { GameTreeNode, RecursionFrame, TicTacToeRunner } from './types';
import {
  createStep,
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

export const negamaxRunner: TicTacToeRunner = {
  meta: {
    id: 'negamax',
    name: 'Negamax',
    shortName: 'Negamax',
    category: 'game-playing',
    description: 'Uses the zero-sum symmetry of Tic-Tac-Toe to express Minimax with a single maximization recurrence.',
    longDescription: 'Negamax scores every position from the perspective of the side to move, then flips the sign on the recursive return to avoid separate max and min branches.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'negamax', 'zero-sum', 'tic-tac-toe'],
    bookChapter: 'AIMA 4th Ed. § 5.2',
    relatedAlgorithms: ['minimax', 'alpha-beta'],
  },

  pseudocode: [
    'function NEGAMAX(board, player, color):',
    '  if TERMINAL(board): return color * UTILITY(board)',
    '  bestScore <- -∞',
    '  for each move in LEGAL-MOVES(board):',
    '    childScore <- -NEGAMAX(RESULT(board, move), OPPONENT(player), -color)',
    '    bestScore <- max(bestScore, childScore)',
    '  return bestScore',
  ],

  validate: validateTicTacToeProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const resolved = resolveProblem(problem);
    const ctx = createTraceContext();
    const initialMoves = getLegalMoves(resolved.board);
    const searchTree = new Map<string, GameTreeNode>();

    const rootNode: GameTreeNode = {
      id: 'root',
      parentId: null,
      board: [...resolved.board],
      move: null,
      score: null,
      depth: 0,
      player: resolved.currentPlayer,
      discoveryStep: 0,
    };
    searchTree.set('root', rootNode);

    yield createStep(
      ctx,
      'initializing',
      `Initialized Negamax for board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
      0,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: initialMoves,
        recursionStack: [],
        searchTree,
        currentNodeId: 'root',
      },
    );

    const search = function* (
      board: TicTacToeBoard,
      player: TicTacToePlayer,
      depth: number,
      color: 1 | -1,
      incomingMove: number | null,
      stack: RecursionFrame[],
      nodeId: string,
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const legalMoves = isTerminal(board) ? [] : getLegalMoves(board);
      const frame: RecursionFrame = {
        depth,
        player,
        role: 'negamax',
        move: incomingMove,
        board: [...board],
        bestScore: null,
      };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `Negamax node at depth ${depth} for ${player} with color ${color}; moves: ${legalMoves.map(moveLabel).join(', ') || 'none'}.`,
        2,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          recursionStack,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      if (isTerminal(board)) {
        const terminal = terminalEvaluation(board, resolved.maximizingPlayer, depth);
        const signedScore = color * terminal.score;
        const winnerLabel = terminal.winner === 'draw' ? 'draw' : `${terminal.winner} wins`;
        
        node.score = signedScore;
        node.isTerminal = true;

        yield createStep(
          ctx,
          'found',
          `Reached terminal board at depth ${depth}; base score ${terminal.score}, color-adjusted score ${signedScore} (${winnerLabel}).`,
          1,
          {
            board,
            currentPlayer: player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: [],
            currentMove: incomingMove,
            currentScore: signedScore,
            bestScore: signedScore,
            recursionStack,
            searchTree,
            currentNodeId: nodeId,
          },
          { level: 'success', winningLine: terminal.winningLine },
        );

        return { score: signedScore, move: null, principalVariation: [] };
      }

      let bestScore = Number.NEGATIVE_INFINITY;
      let bestMove: number | null = null;
      let bestVariation: number[] = [];
      const evaluatedMoves: Array<{ move: number; score: number }> = [];

      for (const move of legalMoves) {
        const childBoard = nextBoard(board, move, player);
        const childId = `${nodeId}-${move}`;

        searchTree.set(childId, {
          id: childId,
          parentId: nodeId,
          board: [...childBoard],
          move,
          score: null,
          depth: depth + 1,
          player: nextPlayer(player),
          discoveryStep: ctx.stepNumber,
        });

        yield createStep(
          ctx,
          'visiting',
          `${player} explores ${moveLabel(move)}; Negamax will negate the child result on return.`,
          3,
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
            searchTree,
            currentNodeId: childId,
          },
        );

        const child = yield* search(childBoard, nextPlayer(player), depth + 1, color === 1 ? -1 : 1, move, recursionStack, childId);
        const candidateScore = -child.score;
        evaluatedMoves.push({ move, score: candidateScore });

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestMove = move;
          bestVariation = [move, ...child.principalVariation];
        }

        frame.bestScore = bestScore;
        node.score = bestScore;

        yield createStep(
          ctx,
          'backtracking',
          `${player} negates child score ${child.score} to ${candidateScore}; best so far is ${bestMove !== null ? `${moveLabel(bestMove)} (${bestScore})` : 'none'}.`,
          5,
          {
            board,
            currentPlayer: player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: legalMoves,
            currentMove: move,
            currentScore: candidateScore,
            bestMove,
            bestScore,
            evaluatedMoves,
            recursionStack: [...stack, { ...frame, board: [...board] }],
            principalVariation: bestVariation,
            searchTree,
            currentNodeId: nodeId,
          },
        );
      }

      yield createStep(
        ctx,
        'backtracking',
        `Negamax node returns ${bestScore} via ${bestMove !== null ? moveLabel(bestMove) : 'terminal position'}.`,
        6,
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
          principalVariation: bestVariation,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      return { score: bestScore, move: bestMove, principalVariation: bestVariation };
    };

    const initialColor: 1 | -1 = resolved.currentPlayer === resolved.maximizingPlayer ? 1 : -1;
    const evaluation = yield* search(resolved.board, resolved.currentPlayer, 0, initialColor, null, [], 'root');

    yield createStep(
      ctx,
      'found',
      `Negamax selects ${evaluation.move !== null ? moveLabel(evaluation.move) : 'no move'} with score ${evaluation.score}.`,
      6,
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
