import type { GameTreeNode, RecursionFrame, TicTacToeRunner, EvaluatedMove } from './types';
import {
  boardKey,
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
} from './shared';
import { getLegalMoves, getWinner, type TicTacToeBoard, type TicTacToePlayer } from '@/lib/tic-tac-toe';

interface MctsStats {
  visits: number;
  totalValue: number;
  meanValue: number;
  untriedMoves: number[];
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

function countImmediateWinningMoves(board: TicTacToeBoard, player: TicTacToePlayer): number {
  return getLegalMoves(board).filter((move) => getWinner(nextBoard(board, move, player)) === player).length;
}

function chooseRolloutMove(board: TicTacToeBoard, player: TicTacToePlayer, random: () => number): number {
  const legalMoves = getLegalMoves(board);
  const winningMoves = legalMoves.filter((move) => getWinner(nextBoard(board, move, player)) === player);
  if (winningMoves.length > 0) {
    return winningMoves[0];
  }

  const opponent = nextPlayer(player);
  const safeMoves = legalMoves.filter((move) => countImmediateWinningMoves(nextBoard(board, move, player), opponent) === 0);
  const candidates = safeMoves.length > 0 ? safeMoves : legalMoves;
  return chooseRandom(candidates, random);
}

function simulateRollout(
  board: TicTacToeBoard,
  player: TicTacToePlayer,
  maximizingPlayer: TicTacToePlayer,
  startDepth: number,
  random: () => number,
): { reward: number; plies: number; terminal: { score: number; winner: TicTacToePlayer | 'draw'; winningLine: number[] | null } } {
  let currentBoard = [...board];
  let currentPlayer = player;
  let depth = startDepth;
  let plies = 0;

  while (!isTerminal(currentBoard)) {
    const move = chooseRolloutMove(currentBoard, currentPlayer, random);
    currentBoard = nextBoard(currentBoard, move, currentPlayer);
    currentPlayer = nextPlayer(currentPlayer);
    depth += 1;
    plies += 1;
  }

  const terminal = terminalEvaluation(currentBoard, maximizingPlayer, depth);
  return { reward: terminal.score, plies, terminal };
}

function createStats(board: TicTacToeBoard): MctsStats {
  return {
    visits: 0,
    totalValue: 0,
    meanValue: 0,
    untriedMoves: isTerminal(board) ? [] : getLegalMoves(board),
    children: [],
  };
}

function selectChild(
  nodeId: string,
  nodePlayer: TicTacToePlayer,
  maximizingPlayer: TicTacToePlayer,
  statsByNode: Map<string, MctsStats>,
  searchTree: Map<string, GameTreeNode>,
): string | null {
  const nodeStats = statsByNode.get(nodeId);
  if (!nodeStats || nodeStats.children.length === 0) {
    return null;
  }

  const maximize = nodePlayer === maximizingPlayer;
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
    const score = maximize
      ? exploitation + exploration
      : -exploitation + exploration;
    const bestMove = bestChildId ? searchTree.get(bestChildId)?.move ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

    if (
      bestChildId === null
      || score > bestScore
      || (score === bestScore && (childNode.move ?? Number.POSITIVE_INFINITY) < bestMove)
    ) {
      bestScore = score;
      bestChildId = childId;
    }
  }

  return bestChildId;
}

function summarizeRoot(
  rootId: string,
  maximizingPlayer: TicTacToePlayer,
  searchTree: Map<string, GameTreeNode>,
  statsByNode: Map<string, MctsStats>,
): { bestMove: number | null; bestScore: number; principalVariation: number[]; evaluatedMoves: EvaluatedMove[] } {
  const rootNode = searchTree.get(rootId);
  const rootStats = statsByNode.get(rootId);
  if (!rootNode || !rootStats || rootStats.children.length === 0) {
    return { bestMove: null, bestScore: 0, principalVariation: [], evaluatedMoves: [] };
  }

  const candidates: Array<{ move: number; score: number; visits: number }> = [];
  for (const childId of rootStats.children) {
    const childNode = searchTree.get(childId);
    const childStats = statsByNode.get(childId);
    if (!childNode || !childStats || childNode.move === null) continue;

    candidates.push({
      move: childNode.move,
      score: childStats.meanValue,
      visits: childStats.visits,
    });
  }

  if (candidates.length === 0) {
    return { bestMove: null, bestScore: 0, principalVariation: [], evaluatedMoves: [] };
  }

  const maximize = rootNode.player === maximizingPlayer;
  candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return maximize ? b.score - a.score : a.score - b.score;
    }
    if (a.visits !== b.visits) {
      return b.visits - a.visits;
    }
    return a.move - b.move;
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
}

export const mctsRunner: TicTacToeRunner = {
  meta: {
    id: 'mcts',
    name: 'Monte Carlo Tree Search',
    shortName: 'MCTS',
    category: 'game-playing',
    description: 'Approximates Tic-Tac-Toe move quality with UCT-guided simulations and rollout-based value estimates.',
    longDescription: 'Monte Carlo Tree Search incrementally grows a search tree, balances exploration and exploitation with UCT, and estimates move quality by backing up random playout results. In Tic-Tac-Toe it offers a sampling-based alternative to exhaustive adversarial search.',
    timeComplexity: 'O(k · d)',
    spaceComplexity: 'O(k)',
    complete: false,
    optimal: false,
    tags: ['game tree', 'monte carlo tree search', 'uct', 'sampling', 'tic-tac-toe'],
    bookChapter: 'Chapter 5',
    relatedAlgorithms: ['expectimax'],
  },

  pseudocode: [
    'function MCTS(root):',
    '  repeat k times:',
    '    node <- SELECT(root)',
    '    leaf <- EXPAND(node)',
    '    reward <- SIMULATE(leaf)',
    '    BACKPROPAGATE(leaf, reward)',
    '  return best child of root',
  ],

  validate: validateTicTacToeProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const resolved = resolveProblem(problem);
    const ctx = createTraceContext();
    const initialMoves = getLegalMoves(resolved.board);
    const searchTree = new Map<string, GameTreeNode>();
    const statsByNode = new Map<string, MctsStats>();

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
    statsByNode.set('root', createStats(resolved.board));

    yield createStep(
      ctx,
      'initializing',
      `Initialized Monte Carlo Tree Search for board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
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

    if (isTerminal(resolved.board)) {
      const terminal = terminalEvaluation(resolved.board, resolved.maximizingPlayer, 0);

      yield createStep(
        ctx,
        'found',
        `Reached terminal root board ${boardKey(resolved.board)}; no move is available.`,
        1,
        {
          board: resolved.board,
          currentPlayer: resolved.currentPlayer,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: [],
          currentMove: null,
          bestMove: null,
          bestScore: terminal.score,
          recursionStack: [],
          searchTree,
          currentNodeId: 'root',
        },
        { level: 'success', winningLine: terminal.winningLine },
      );

      return {
        bestMove: null,
        bestScore: terminal.score,
        nodesExpanded: 0,
        principalVariation: [],
        outcome: determineOutcome(terminal.score),
      };
    }

    const random = createSeededRandom(hashString(`${boardKey(resolved.board)}|${resolved.currentPlayer}|${resolved.maximizingPlayer}|mcts`));
    const iterationBudget = Math.max(384, initialMoves.length * 48);

    for (let iteration = 0; iteration < iterationBudget; iteration++) {
      ctx.nodesExpanded += 1;

      let currentNodeId = 'root';
      let currentBoard = [...resolved.board];
      let currentPlayer = resolved.currentPlayer;
      let currentDepth = 0;
      const pathNodeIds: string[] = ['root'];
      const pathFrames: RecursionFrame[] = [{
        depth: 0,
        player: currentPlayer,
        role: 'selection',
        move: null,
        board: [...currentBoard],
        bestScore: null,
      }];

      let expandedMove: number | null = null;

      while (true) {
        const node = searchTree.get(currentNodeId)!;
        const nodeStats = statsByNode.get(currentNodeId) ?? createStats(currentBoard);
        statsByNode.set(currentNodeId, nodeStats);

        if (isTerminal(currentBoard)) {
          node.isTerminal = true;
          node.score = nodeStats.meanValue;
          break;
        }

        if (nodeStats.untriedMoves.length > 0) {
          const moveIndex = Math.floor(random() * nodeStats.untriedMoves.length);
          expandedMove = nodeStats.untriedMoves.splice(moveIndex, 1)[0];
          const childBoard = nextBoard(currentBoard, expandedMove, currentPlayer);
          const childId = `${currentNodeId}-${expandedMove}-${nodeStats.children.length}`;

          nodeStats.children.push(childId);
          searchTree.set(childId, {
            id: childId,
            parentId: currentNodeId,
            board: [...childBoard],
            move: expandedMove,
            score: null,
            depth: currentDepth + 1,
            player: nextPlayer(currentPlayer),
            discoveryStep: ctx.stepNumber,
          });
          statsByNode.set(childId, createStats(childBoard));

          currentNodeId = childId;
          currentBoard = childBoard;
          currentPlayer = nextPlayer(currentPlayer);
          currentDepth += 1;
          pathNodeIds.push(childId);
          pathFrames.push({
            depth: currentDepth,
            player: currentPlayer,
            role: 'selection',
            move: expandedMove,
            board: [...currentBoard],
            bestScore: null,
          });
          break;
        }

        const selectedChildId = selectChild(currentNodeId, currentPlayer, resolved.maximizingPlayer, statsByNode, searchTree);
        if (!selectedChildId) {
          break;
        }

        const selectedNode = searchTree.get(selectedChildId)!;
        currentNodeId = selectedChildId;
        currentBoard = [...selectedNode.board];
        currentPlayer = selectedNode.player;
        currentDepth = selectedNode.depth;
        pathNodeIds.push(currentNodeId);
        pathFrames.push({
          depth: currentDepth,
          player: currentPlayer,
          role: 'selection',
          move: selectedNode.move,
          board: [...currentBoard],
          bestScore: statsByNode.get(currentNodeId)?.meanValue ?? null,
        });
      }

      const rollout = simulateRollout(currentBoard, currentPlayer, resolved.maximizingPlayer, currentDepth, random);

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

      const rootSummary = summarizeRoot('root', resolved.maximizingPlayer, searchTree, statsByNode);
      const recursionStack: RecursionFrame[] = pathFrames.map((frame, index) => ({
        ...frame,
        role: (index === pathFrames.length - 1 ? 'rollout' : 'selection') as RecursionFrame['role'],
        bestScore: statsByNode.get(pathNodeIds[index])?.meanValue ?? frame.bestScore ?? null,
      }));

      yield createStep(
        ctx,
        'expanding',
        `Iteration ${iteration + 1}/${iterationBudget}: expanded ${expandedMove !== null ? moveLabel(expandedMove) : 'an existing node'} and rolled out ${rollout.plies} ply for a score of ${rollout.reward}.`,
        3,
        {
          board: currentBoard,
          currentPlayer,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: isTerminal(currentBoard) ? [] : getLegalMoves(currentBoard),
          currentMove: expandedMove,
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
        `Backpropagated reward ${rollout.reward} through ${pathFrames.length} node(s); root now prefers ${rootSummary.bestMove !== null ? `${moveLabel(rootSummary.bestMove)} (${rootSummary.bestScore.toFixed(2)})` : 'no move'}.`,
        5,
        {
          board: resolved.board,
          currentPlayer: resolved.currentPlayer,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: initialMoves,
          currentMove: expandedMove,
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

    const finalSummary = summarizeRoot('root', resolved.maximizingPlayer, searchTree, statsByNode);

    yield createStep(
      ctx,
      'found',
      `Monte Carlo Tree Search selects ${finalSummary.bestMove !== null ? moveLabel(finalSummary.bestMove) : 'no move'} after ${iterationBudget} simulations with mean score ${finalSummary.bestScore.toFixed(2)}.`,
      6,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
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