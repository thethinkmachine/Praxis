import { PriorityQueue } from '@/lib/priority-queue';
import { boardKey, getLegalMoves, type TicTacToeBoard, type TicTacToePlayer } from '@/lib/tic-tac-toe';
import type { EvaluatedMove, GameTreeNode, RecursionFrame, SssOpenEntry, TicTacToeRunner } from './types';
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
} from './shared';
import type { TicTacToeProblem } from '@/types/problem';

interface QueuedOpenEntry extends SssOpenEntry {
  version: number;
}

interface LineEvaluation {
  score: number;
  move: number | null;
  principalVariation: number[];
}

const ROOT_ID = 'ε';

function formatBound(value: number): string {
  if (value === Number.POSITIVE_INFINITY) return '∞';
  if (value === Number.NEGATIVE_INFINITY) return '-∞';
  return String(value);
}

function formatNodeId(path: number[]): string {
  return path.length === 0 ? ROOT_ID : `${ROOT_ID}.${path.join('.')}`;
}

function compareNodePath(left: number[], right: number[]): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return left.length - right.length;
}

function nodeKind(player: TicTacToePlayer, maximizingPlayer: TicTacToePlayer): 'MAX' | 'MIN' {
  return player === maximizingPlayer ? 'MAX' : 'MIN';
}

function clonePath(path: number[]): number[] {
  return [...path];
}

function createNodeRecord(
  board: TicTacToeBoard,
  player: TicTacToePlayer,
  depth: number,
  move: number | null,
  path: number[],
  parentId: string | null,
  searchState: 'L' | 'S',
  discoveryStep: number,
  score: number,
): GameTreeNode {
  const childMoves = isTerminal(board) ? [] : getLegalMoves(board);
  return {
    id: formatNodeId(path),
    parentId,
    board: [...board],
    move,
    score,
    depth,
    player,
    discoveryStep,
    searchState,
    path: clonePath(path),
    childMoves,
    childIds: new Array(childMoves.length).fill(null),
    isTerminal: isTerminal(board),
  };
}

function summarizeChildren(node: GameTreeNode, searchTree: Map<string, GameTreeNode>): EvaluatedMove[] {
  const childIds = node.childIds ?? [];
  const moves: EvaluatedMove[] = [];

  for (const childId of childIds) {
    if (!childId) continue;
    const child = searchTree.get(childId);
    if (!child || child.move === null) continue;

    moves.push({
      move: child.move,
      score: child.score ?? 0,
      detail: `${child.searchState ?? 'inactive'} • h=${formatBound(child.score ?? 0)}`,
    });
  }

  return moves;
}

function buildPathFrames(
  nodeId: string,
  searchTree: Map<string, GameTreeNode>,
  maximizingPlayer: TicTacToePlayer,
): RecursionFrame[] {
  const orderedIds: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId !== null) {
    orderedIds.unshift(currentId);
    currentId = searchTree.get(currentId)?.parentId ?? null;
  }

  return orderedIds.map((id) => {
    const node = searchTree.get(id)!;
    return {
      depth: node.depth,
      player: node.player,
      role: nodeKind(node.player, maximizingPlayer) === 'MAX' ? 'max' : 'min',
      move: node.move,
      board: [...node.board],
      bestScore: node.score,
    };
  });
}

function buildPrincipalVariation(
  board: TicTacToeBoard,
  currentPlayer: TicTacToePlayer,
  maximizingPlayer: TicTacToePlayer,
  memo: Map<string, LineEvaluation>,
  depth: number = 0,
): LineEvaluation {
  const key = `${boardKey(board)}|${currentPlayer}|${maximizingPlayer}`;
  const cached = memo.get(key);
  if (cached) return cached;

  if (isTerminal(board)) {
    const terminal = terminalEvaluation(board, maximizingPlayer, depth);
    const result: LineEvaluation = { score: terminal.score, move: null, principalVariation: [] };
    memo.set(key, result);
    return result;
  }

  const maximizingTurn = currentPlayer === maximizingPlayer;
  let bestScore = maximizingTurn ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  let bestMove: number | null = null;
  let bestVariation: number[] = [];

  for (const move of getLegalMoves(board)) {
    const child = buildPrincipalVariation(nextBoard(board, move, currentPlayer), nextPlayer(currentPlayer), maximizingPlayer, memo, depth + 1);
    const improved = maximizingTurn ? child.score > bestScore : child.score < bestScore;

    if (improved) {
      bestScore = child.score;
      bestMove = move;
      bestVariation = [move, ...child.principalVariation];
    }
  }

  const result: LineEvaluation = { score: bestScore, move: bestMove, principalVariation: bestVariation };
  memo.set(key, result);
  return result;
}

function buildGameTreeSnapshot(openQueue: Map<string, QueuedOpenEntry>): SssOpenEntry[] {
  return [...openQueue.values()]
    .sort((left, right) => {
      if (left.h !== right.h) {
        return right.h - left.h;
      }
      return compareNodePath(left.path, right.path);
    })
    .map(({ version: _version, ...entry }) => ({
      ...entry,
      path: clonePath(entry.path),
    }));
}

function validateSssStarProblem(problem: TicTacToeProblem) {
  return validateTicTacToeProblem(problem);
}

export const sssStarRunner: TicTacToeRunner = {
  meta: {
    id: 'sss-star',
    name: 'State Space Search SSS*',
    shortName: 'SSS*',
    category: 'game-playing',
    description: 'Runs Stockman\'s best-first SSS* minimax search with an OPEN queue of live and solved states ordered by optimistic bounds.',
    longDescription: 'SSS* (Stockman, 1979) searches the game tree in best-first order instead of depth-first order. It keeps an OPEN queue of live and solved states, repeatedly applies the Gamma operator, and returns the minimax value once the root becomes solved.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(b^m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'best-first search', 'state-space search', 'adversarial search', 'tic-tac-toe'],
    bookChapter: 'Stockman (1979)',
    relatedAlgorithms: ['minimax', 'alpha-beta'],
    relationshipLabel: 'best-first',
  },

  pseudocode: [
    'OPEN <- {(ε, L, +∞)}',
    'while true:',
    '  p <- pop head(OPEN)',
    '  if p = (ε, S, h): return h',
    '  apply Γ(p)',
    'Γ(J, L, h):',
    '  if terminal(J): add (J, S, min(h, value(J)))',
    '  else if J is MIN: add (J.1, L, h)',
    '  else add each child J.j as live with h',
    'Γ(J, S, h):',
    '  if J is MIN: add parent(J) as solved and remove its children from OPEN',
    '  else if J is last child: add parent(J) as solved',
    '  else add next sibling as live',
  ],

  validate: validateSssStarProblem,

  getInitialState: getInitialTraceState,

  *run(problem) {
    const resolved = resolveProblem(problem);
    const ctx = createTraceContext();
    const searchTree = new Map<string, GameTreeNode>();
    const openQueue = new PriorityQueue<QueuedOpenEntry>((left, right) => compareNodePath(left.path, right.path));
    const activeEntries = new Map<string, QueuedOpenEntry>();
    const entryVersions = new Map<string, number>();

    const rootPath: number[] = [];
    const rootMoves = getLegalMoves(resolved.board);
    const rootId = formatNodeId(rootPath);
    const rootNode = createNodeRecord(
      resolved.board,
      resolved.currentPlayer,
      0,
      null,
      rootPath,
      null,
      'L',
      0,
      Number.POSITIVE_INFINITY,
    );
    searchTree.set(rootId, rootNode);

    const pushOpen = (nodeId: string, state: 'L' | 'S', h: number): void => {
      const node = searchTree.get(nodeId);
      if (!node) return;
      const version = (entryVersions.get(nodeId) ?? 0) + 1;
      const entry: QueuedOpenEntry = {
        id: nodeId,
        state,
        h,
        move: node.move,
        depth: node.depth,
        path: clonePath(node.path ?? []),
        version,
      };

      entryVersions.set(nodeId, version);
      activeEntries.set(nodeId, entry);
      node.searchState = state;
      node.score = h;
      openQueue.push(entry, -h);
    };

    const removeOpen = (nodeId: string, clearLiveState: boolean = true): void => {
      activeEntries.delete(nodeId);
      entryVersions.delete(nodeId);
      const node = searchTree.get(nodeId);
      if (node && clearLiveState && node.searchState === 'L') {
        node.searchState = undefined;
      }
    };

    const popOpen = (): QueuedOpenEntry | null => {
      while (!openQueue.isEmpty) {
        const entry = openQueue.pop();
        if (!entry) break;
        const latestVersion = entryVersions.get(entry.id);
        if (latestVersion === undefined || latestVersion !== entry.version) {
          continue;
        }

        activeEntries.delete(entry.id);
        entryVersions.delete(entry.id);
        return entry;
      }

      return null;
    };

    const ensureChildNode = (parentId: string, childIndex: number): string => {
      const parent = searchTree.get(parentId);
      if (!parent) {
        throw new Error(`Missing parent node ${parentId}`);
      }

      parent.childMoves ??= isTerminal(parent.board) ? [] : getLegalMoves(parent.board);
      parent.childIds ??= new Array(parent.childMoves.length).fill(null);

      const existingId = parent.childIds[childIndex];
      if (existingId) {
        return existingId;
      }

      const move = parent.childMoves[childIndex];
      if (move === undefined) {
        throw new Error(`Missing child move ${childIndex + 1} for ${parentId}`);
      }

      const childPath = [...(parent.path ?? []), childIndex + 1];
      const childId = formatNodeId(childPath);
      const childBoard = nextBoard(parent.board, move, parent.player);
      const childNode = createNodeRecord(
        childBoard,
        nextPlayer(parent.player),
        parent.depth + 1,
        move,
        childPath,
        parentId,
        'L',
        ctx.stepNumber,
        Number.POSITIVE_INFINITY,
      );

      searchTree.set(childId, childNode);
      parent.childIds[childIndex] = childId;
      return childId;
    };

    const collectEvaluatedMoves = (node: GameTreeNode): EvaluatedMove[] => summarizeChildren(node, searchTree);

    pushOpen(rootId, 'L', Number.POSITIVE_INFINITY);

    yield createStep(
      ctx,
      'initializing',
      `Initialized SSS* on board ${boardKey(resolved.board)} with ${resolved.currentPlayer} to move.`,
      0,
      {
        board: resolved.board,
        currentPlayer: resolved.currentPlayer,
        maximizingPlayer: resolved.maximizingPlayer,
        availableMoves: rootMoves,
        openQueue: buildGameTreeSnapshot(activeEntries),
        recursionStack: [],
        searchTree,
        currentNodeId: rootId,
      },
    );

    while (true) {
      const entry = popOpen();
      if (!entry) {
        throw new Error('SSS* exhausted OPEN without solving the root node.');
      }

      ctx.nodesExpanded += 1;
      const node = searchTree.get(entry.id);
      if (!node) {
        continue;
      }

      if (entry.state === 'L') {
        node.searchState = undefined;
      }

      const maximizingTurn = nodeKind(node.player, resolved.maximizingPlayer) === 'MAX';
      const terminal = isTerminal(node.board);
      const openSnapshotBeforeAction = buildGameTreeSnapshot(activeEntries);
      const stack = buildPathFrames(node.id, searchTree, resolved.maximizingPlayer);

      if (entry.id === rootId && entry.state === 'S') {
        const bestLine = buildPrincipalVariation(resolved.board, resolved.currentPlayer, resolved.maximizingPlayer, new Map<string, LineEvaluation>());

        yield createStep(
          ctx,
          'found',
          `SSS* solves the root with value ${formatBound(entry.h)} and selects ${bestLine.move !== null ? moveLabel(bestLine.move) : 'no move'}.`,
          3,
          {
            board: resolved.board,
            currentPlayer: resolved.currentPlayer,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: rootMoves,
            openQueue: openSnapshotBeforeAction,
            currentMove: bestLine.move,
            currentScore: entry.h,
            bestMove: bestLine.move,
            bestScore: entry.h,
            evaluatedMoves: collectEvaluatedMoves(node),
            recursionStack: [],
            principalVariation: bestLine.principalVariation,
            searchTree,
            currentNodeId: rootId,
          },
          { level: 'success', winningLine: terminalEvaluation(resolved.board, resolved.maximizingPlayer, 0).winningLine },
        );

        return {
          bestMove: bestLine.move,
          bestScore: entry.h,
          nodesExpanded: ctx.nodesExpanded,
          principalVariation: bestLine.principalVariation,
          outcome: determineOutcome(entry.h),
        };
      }

      if (entry.state === 'L') {
        if (terminal) {
          const terminalInfo = terminalEvaluation(node.board, resolved.maximizingPlayer, node.depth);
          const solvedScore = Math.min(entry.h, terminalInfo.score);
          node.isTerminal = true;
          node.score = solvedScore;
          pushOpen(node.id, 'S', solvedScore);

          yield createStep(
            ctx,
            'propagating',
            createTerminalDescription(node.board, resolved.maximizingPlayer, node.depth),
            6,
            {
              board: node.board,
              currentPlayer: node.player,
              maximizingPlayer: resolved.maximizingPlayer,
              availableMoves: [],
              openQueue: buildGameTreeSnapshot(activeEntries),
              currentMove: node.move,
              currentScore: solvedScore,
              bestScore: solvedScore,
              evaluatedMoves: [],
              recursionStack: stack,
              searchTree,
              currentNodeId: node.id,
            },
            { level: 'success', winningLine: terminalInfo.winningLine },
          );

          continue;
        }

        const childMoves = node.childMoves ?? getLegalMoves(node.board);
        node.childMoves = childMoves;
        node.childIds ??= new Array(childMoves.length).fill(null);

        if (maximizingTurn) {
          node.childIds.forEach((_childId, index) => {
            const generatedId = ensureChildNode(node.id, index);
            pushOpen(generatedId, 'L', entry.h);
          });

          yield createStep(
            ctx,
            'visiting',
            `Expanded MAX node ${node.id} and pushed ${childMoves.length} live child state(s) into OPEN.`,
            8,
            {
              board: node.board,
              currentPlayer: node.player,
              maximizingPlayer: resolved.maximizingPlayer,
              availableMoves: childMoves,
              openQueue: buildGameTreeSnapshot(activeEntries),
              currentMove: node.move,
              currentScore: entry.h,
              bestScore: entry.h,
              evaluatedMoves: collectEvaluatedMoves(node),
              recursionStack: stack,
              searchTree,
              currentNodeId: node.id,
            },
          );

          continue;
        }

        const firstChildId = ensureChildNode(node.id, 0);
        pushOpen(firstChildId, 'L', entry.h);

        yield createStep(
          ctx,
          'visiting',
          `Expanded MIN node ${node.id} and pushed its left-most child ${firstChildId} into OPEN.`,
          7,
          {
            board: node.board,
            currentPlayer: node.player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: childMoves,
            openQueue: buildGameTreeSnapshot(activeEntries),
            currentMove: node.move,
            currentScore: entry.h,
            bestScore: entry.h,
            evaluatedMoves: collectEvaluatedMoves(node),
            recursionStack: stack,
            searchTree,
            currentNodeId: node.id,
          },
        );

        continue;
      }

      // Solved state from OPEN.
      const parentId = node.parentId;
      if (!parentId) {
        throw new Error(`Solved non-root node ${node.id} is missing a parent.`);
      }

      const parent = searchTree.get(parentId);
      if (!parent) {
        throw new Error(`Missing parent node ${parentId}`);
      }

      const childIndex = (node.path?.[node.path.length - 1] ?? 1) - 1;

      if (nodeKind(node.player, resolved.maximizingPlayer) === 'MIN') {
        const parentScore = entry.h;
        parent.score = parentScore;
        parent.searchState = 'S';
        pushOpen(parentId, 'S', parentScore);

        for (const childId of parent.childIds ?? []) {
          if (!childId) continue;
          removeOpen(childId, true);
        }

        yield createStep(
          ctx,
          'propagating',
          `Solved MIN node ${node.id} backs up h=${formatBound(entry.h)} to parent ${parentId} and removes the parent's children from OPEN.`,
          11,
          {
            board: node.board,
            currentPlayer: node.player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: node.childMoves ?? [],
            openQueue: buildGameTreeSnapshot(activeEntries),
            currentMove: node.move,
            currentScore: entry.h,
            bestScore: entry.h,
            evaluatedMoves: collectEvaluatedMoves(node),
            recursionStack: stack,
            searchTree,
            currentNodeId: node.id,
          },
        );

        continue;
      }

      const childMoves = parent.childMoves ?? getLegalMoves(parent.board);
      parent.childMoves = childMoves;
      parent.childIds ??= new Array(childMoves.length).fill(null);

      if (childIndex >= childMoves.length - 1) {
        parent.score = entry.h;
        parent.searchState = 'S';
        pushOpen(parentId, 'S', entry.h);

        yield createStep(
          ctx,
          'propagating',
          `Solved MAX node ${node.id} backs up h=${formatBound(entry.h)} to parent ${parentId}.`,
          12,
          {
            board: node.board,
            currentPlayer: node.player,
            maximizingPlayer: resolved.maximizingPlayer,
            availableMoves: node.childMoves ?? [],
            openQueue: buildGameTreeSnapshot(activeEntries),
            currentMove: node.move,
            currentScore: entry.h,
            bestScore: entry.h,
            evaluatedMoves: collectEvaluatedMoves(node),
            recursionStack: stack,
            searchTree,
            currentNodeId: node.id,
          },
        );

        continue;
      }

      const nextChildId = ensureChildNode(parentId, childIndex + 1);
      pushOpen(nextChildId, 'L', entry.h);

      yield createStep(
        ctx,
        'visiting',
        `Solved MAX node ${node.id} promotes sibling ${nextChildId} as live with h=${formatBound(entry.h)}.`,
        13,
        {
          board: node.board,
          currentPlayer: node.player,
          maximizingPlayer: resolved.maximizingPlayer,
          availableMoves: node.childMoves ?? [],
          openQueue: buildGameTreeSnapshot(activeEntries),
          currentMove: node.move,
          currentScore: entry.h,
          bestScore: entry.h,
          evaluatedMoves: collectEvaluatedMoves(node),
          recursionStack: stack,
          searchTree,
          currentNodeId: node.id,
        },
      );
    }
  },
};