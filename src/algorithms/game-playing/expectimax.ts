import type { GameTreeNode, RecursionFrame, TicTacToeRunner, EvaluatedMove } from './types';
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
import type { TicTacToeProblem } from '@/types/problem';

function validateExpectimaxProblem(problem: TicTacToeProblem) {
  return validateTicTacToeProblem(problem);
}

export const expectimaxRunner: TicTacToeRunner = {
  meta: {
    id: 'expectimax',
    name: 'Expectimax',
    shortName: 'Expectimax',
    category: 'game-playing',
    description: 'Evaluates Tic-Tac-Toe by maximizing expected utility when opponent turns are modeled as uniformly random chance nodes.',
    longDescription: 'Expectimax generalizes Minimax to stochastic settings. For Tic-Tac-Toe, it alternates maximizing turns with chance nodes that average all legal replies, and it still reports a legal root move for the side to move.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(m)',
    complete: true,
    optimal: 'Optimal only under the assumed chance-node model (uniformly random opponent), unlike Minimax\'s worst-case guarantee',
    tags: ['game tree', 'expectimax', 'chance nodes', 'stochastic search', 'tic-tac-toe'],
    bookChapter: 'Chapter 5',
    relatedAlgorithms: ['minimax', 'mcts'],
  },

  pseudocode: [
    'function EXPECTIMAX(board, player):',
    '  if TERMINAL(board): return UTILITY(board)',
    '  if player = maximizingPlayer:',
    '    value <- -∞',
    '    for each move in LEGAL-MOVES(board):',
    '      value <- max(value, EXPECTIMAX(RESULT(board, move), OPPONENT(player)))',
    '    return value',
    '  value <- 0',
    '  for each move in LEGAL-MOVES(board):',
    '    value <- value + P(move) * EXPECTIMAX(RESULT(board, move), OPPONENT(player))',
    '  return value',
  ],

  validate: validateExpectimaxProblem,

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
      `Initialized Expectimax for board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
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
      incomingMove: number | null,
      stack: RecursionFrame[],
      nodeId: string,
    ): Generator<ReturnType<typeof createStep>, SearchEvaluation, void> {
      ctx.nodesExpanded++;
      const legalMoves = isTerminal(board) ? [] : getLegalMoves(board);
      const maximizingTurn = player === resolved.maximizingPlayer;
      const role: RecursionFrame['role'] = maximizingTurn ? 'max' : 'chance';
      const frame: RecursionFrame = {
        depth,
        player,
        role,
        move: incomingMove,
        board: [...board],
        bestScore: null,
      };
      const recursionStack = [...stack, frame];
      const node = searchTree.get(nodeId)!;

      yield createStep(
        ctx,
        'expanding',
        `${maximizingTurn ? 'Max' : 'Chance'} node at depth ${depth} for ${player}; legal moves: ${legalMoves.map(moveLabel).join(', ') || 'none'}.`,
        maximizingTurn ? 3 : 8,
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
        node.score = terminal.score;
        node.isTerminal = true;

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
            searchTree,
            currentNodeId: nodeId,
          },
          { level: 'success', winningLine: terminal.winningLine },
        );

        return { score: terminal.score, move: null, principalVariation: [] };
      }

      if (maximizingTurn) {
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestMove: number | null = null;
        let bestVariation: number[] = [];
        const evaluatedMoves: EvaluatedMove[] = [];

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
            `${player} considers ${moveLabel(move)} while maximizing expected value.`,
            4,
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

          const child = yield* search(childBoard, nextPlayer(player), depth + 1, move, recursionStack, childId);
          evaluatedMoves.push({ move, score: child.score, detail: child.principalVariation.length > 0 ? `line: ${child.principalVariation.map(moveLabel).join(' → ')}` : undefined });

          if (child.score > bestScore) {
            bestScore = child.score;
            bestMove = move;
            bestVariation = [move, ...child.principalVariation];
          }

          frame.bestScore = bestScore;
          node.score = bestScore;

          yield createStep(
            ctx,
            'backtracking',
            `${player} receives score ${child.score} for ${moveLabel(move)}; best so far is ${bestMove !== null ? `${moveLabel(bestMove)} (${bestScore})` : 'none'}.`,
            5,
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
              searchTree,
              currentNodeId: nodeId,
            },
          );
        }

        yield createStep(
          ctx,
          'backtracking',
          `Max node returns ${bestScore} from ${bestMove !== null ? moveLabel(bestMove) : 'terminal position'}.`,
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
            recursionStack: [...stack, { ...frame, board: [...board], bestScore }],
            principalVariation: bestVariation,
            searchTree,
            currentNodeId: nodeId,
          },
        );

        return { score: bestScore, move: bestMove, principalVariation: bestVariation };
      }

      const probability = 1 / legalMoves.length;
      let expectedScore = 0;
      let bestMove: number | null = null;
      let bestChildScore = Number.NEGATIVE_INFINITY;
      let bestVariation: number[] = [];
      const evaluatedMoves: EvaluatedMove[] = [];

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
          `${player} samples ${moveLabel(move)} with probability ${probability.toFixed(2)}.`,
          9,
          {
            board: childBoard,
            currentPlayer: nextPlayer(player),
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: getLegalMoves(childBoard),
            currentMove: move,
            bestMove,
            bestScore: Number.isFinite(expectedScore) ? expectedScore : null,
            evaluatedMoves,
            recursionStack,
            searchTree,
            currentNodeId: childId,
          },
        );

        const child = yield* search(childBoard, nextPlayer(player), depth + 1, move, recursionStack, childId);
        evaluatedMoves.push({ move, score: child.score, detail: `p=${probability.toFixed(2)}` });

        expectedScore += child.score * probability;

        if (child.score > bestChildScore) {
          bestChildScore = child.score;
          bestMove = move;
          bestVariation = [move, ...child.principalVariation];
        }

        frame.bestScore = expectedScore;
        node.score = expectedScore;

        yield createStep(
          ctx,
          'backtracking',
          `${player} samples ${moveLabel(move)} => ${child.score}; expected value now ${expectedScore.toFixed(2)}.`,
          10,
          {
            board,
            currentPlayer: player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: legalMoves,
            currentMove: move,
            currentScore: child.score,
            bestMove,
            bestScore: expectedScore,
            evaluatedMoves,
            recursionStack: [...stack, { ...frame, board: [...board], bestScore: expectedScore }],
            principalVariation: bestVariation,
            searchTree,
            currentNodeId: nodeId,
          },
        );
      }

      yield createStep(
        ctx,
        'backtracking',
        `Chance node returns expected value ${expectedScore.toFixed(2)} from ${legalMoves.length} equally likely reply(s).`,
        11,
        {
          board,
          currentPlayer: player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: legalMoves,
          currentMove: incomingMove,
          bestMove,
          bestScore: expectedScore,
          evaluatedMoves,
          recursionStack: [...stack, { ...frame, board: [...board], bestScore: expectedScore }],
          principalVariation: bestVariation,
          searchTree,
          currentNodeId: nodeId,
        },
      );

      return { score: expectedScore, move: bestMove, principalVariation: bestVariation };
    };

    const evaluation = yield* search(resolved.board, resolved.currentPlayer, 0, null, [], 'root');
    const finalEvaluatedMoves: EvaluatedMove[] = [...searchTree.values()]
      .filter((node) => node.parentId === 'root' && node.move !== null)
      .sort((left, right) => (left.move ?? Number.POSITIVE_INFINITY) - (right.move ?? Number.POSITIVE_INFINITY))
      .map((node) => ({
        move: node.move!,
        score: node.score ?? 0,
      }));

    yield createStep(
      ctx,
      'found',
      `Expectimax selects ${evaluation.move !== null ? moveLabel(evaluation.move) : 'no move'} with expected score ${evaluation.score.toFixed(2)}.`,
      12,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: initialMoves,
        currentMove: evaluation.move,
        bestMove: evaluation.move,
        bestScore: evaluation.score,
        evaluatedMoves: finalEvaluatedMoves,
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