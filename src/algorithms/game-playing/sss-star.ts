import { PriorityQueue } from '@/lib/priority-queue';
import type { EvaluatedMove, GameTreeNode, RecursionFrame, SssOpenEntry, GameRunner } from './types';
import {
  createStep,
  createTraceContext,
  determineOutcome,
  getInitialTraceState,
  validateGameProblem,
} from './shared';
import { resolveGameDomain } from '@/problems/game-playing/domains';
import type { GameProblem } from '@/types/problem';

interface QueuedOpenEntry extends SssOpenEntry {
  version: number;
}

interface LineEvaluation {
  score: number;
  move: string | null;
  principalVariation: string[];
}

const ROOT_ID = 'ε';

function validateSssStarProblem(problem: GameProblem) {
  const base = validateGameProblem(problem);
  if (!base.valid) return base;
  const hasChance = problem.tree.nodes.some((node) => node.kind === 'chance');
  if (hasChance) {
    return {
      valid: false,
      errors: [
        ...base.errors,
        'SSS* requires a tree of only MAX/MIN/terminal nodes; Stockman\'s Gamma operator has no defined chance-node rule. Remove chance nodes or run Minimax, Alpha-Beta, Expectimax, or MCTS instead.',
      ],
    };
  }
  return base;
}

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
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function clonePath(path: number[]): number[] {
  return [...path];
}

export const sssStarRunner: GameRunner = {
  meta: {
    id: 'sss-star',
    name: 'State Space Search SSS*',
    shortName: 'SSS*',
    category: 'game-playing',
    description: 'Runs Stockman\'s best-first SSS* minimax search with an OPEN queue of live and solved states ordered by optimistic bounds.',
    longDescription: 'SSS* (Stockman, 1979) searches the game tree in best-first order instead of depth-first order. It keeps an OPEN queue of live and solved states, repeatedly applies the Gamma operator, and returns the minimax value once the root becomes solved. The Gamma operator has no defined chance-node case, so SSS* is only offered on trees built from MAX, MIN, and terminal nodes.',
    timeComplexity: 'O(b^m)',
    spaceComplexity: 'O(b^m)',
    complete: true,
    optimal: true,
    tags: ['game tree', 'best-first search', 'state-space search', 'adversarial search'],
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
    const domain = resolveGameDomain(problem);
    const ctx = createTraceContext(problem);
    const searchTree = new Map<string, GameTreeNode>();
    const statesByNodeId = new Map<string, unknown>();
    const openQueue = new PriorityQueue<QueuedOpenEntry>((left, right) => compareNodePath(left.path, right.path));
    const activeEntries = new Map<string, QueuedOpenEntry>();
    const entryVersions = new Map<string, number>();

    const createNodeRecord = (
      state: unknown,
      depth: number,
      move: string | null,
      moveLabel: string | null,
      path: number[],
      parentId: string | null,
      searchState: 'L' | 'S',
      discoveryStep: number,
      score: number,
    ): GameTreeNode => {
      const id = formatNodeId(path);
      statesByNodeId.set(id, state);
      const isTerminal = domain.isTerminal(problem, state);
      return {
        id,
        parentId,
        stateLabel: domain.describeState(problem, state),
        nodeKind: domain.nodeKind(problem, state),
        extra: domain.getStateExtra?.(problem, state),
        move,
        moveLabel,
        score,
        depth,
        discoveryStep,
        searchState,
        path: clonePath(path),
        childMoves: isTerminal ? [] : domain.legalMoves(problem, state).map((m) => m.id),
        childIds: isTerminal ? [] : new Array(domain.legalMoves(problem, state).length).fill(null),
        isTerminal,
      };
    };

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
        if (latestVersion === undefined || latestVersion !== entry.version) continue;
        activeEntries.delete(entry.id);
        entryVersions.delete(entry.id);
        return entry;
      }
      return null;
    };

    const ensureChildNode = (parentId: string, childIndex: number): string => {
      const parent = searchTree.get(parentId);
      const parentState = statesByNodeId.get(parentId);
      if (!parent || parentState === undefined) {
        throw new Error(`Missing parent node ${parentId}`);
      }

      parent.childMoves ??= domain.isTerminal(problem, parentState) ? [] : domain.legalMoves(problem, parentState).map((m) => m.id);
      parent.childIds ??= new Array(parent.childMoves.length).fill(null);

      const existingId = parent.childIds[childIndex];
      if (existingId) return existingId;

      const moveId = parent.childMoves[childIndex];
      if (moveId === undefined) {
        throw new Error(`Missing child move ${childIndex + 1} for ${parentId}`);
      }
      const move = domain.legalMoves(problem, parentState).find((m) => m.id === moveId);

      const childPath = [...(parent.path ?? []), childIndex + 1];
      const childId = formatNodeId(childPath);
      const childState = domain.applyMove(problem, parentState, moveId);
      const childNode = createNodeRecord(
        childState,
        parent.depth + 1,
        moveId,
        move?.label ?? moveId,
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

    const collectEvaluatedMoves = (node: GameTreeNode): EvaluatedMove[] => {
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
    };

    const buildPathFrames = (nodeId: string): RecursionFrame[] => {
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
          nodeKind: node.nodeKind,
          role: node.nodeKind === 'min' ? 'min' : 'max',
          move: node.move,
          stateLabel: node.stateLabel,
          bestScore: node.score,
        };
      });
    };

    const buildPrincipalVariation = (
      state: unknown,
      memo: Map<string, LineEvaluation>,
      depth: number = 0,
    ): LineEvaluation => {
      const key = domain.stateId(problem, state);
      const cached = memo.get(key);
      if (cached) return cached;

      if (domain.isTerminal(problem, state)) {
        const result: LineEvaluation = { score: domain.terminalValue(problem, state, depth), move: null, principalVariation: [] };
        memo.set(key, result);
        return result;
      }

      const maximizingTurn = domain.nodeKind(problem, state) === 'max';
      let bestScore = maximizingTurn ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      let bestMove: string | null = null;
      let bestVariation: string[] = [];

      for (const move of domain.legalMoves(problem, state)) {
        const child = buildPrincipalVariation(domain.applyMove(problem, state, move.id), memo, depth + 1);
        const improved = maximizingTurn ? child.score > bestScore : child.score < bestScore;
        if (improved) {
          bestScore = child.score;
          bestMove = move.id;
          bestVariation = [move.id, ...child.principalVariation];
        }
      }

      const result: LineEvaluation = { score: bestScore, move: bestMove, principalVariation: bestVariation };
      memo.set(key, result);
      return result;
    };

    const buildGameTreeSnapshot = (): SssOpenEntry[] => [...activeEntries.values()]
      .sort((left, right) => {
        if (left.h !== right.h) return right.h - left.h;
        return compareNodePath(left.path, right.path);
      })
      .map(({ version: _version, ...entry }) => ({ ...entry, path: clonePath(entry.path) }));

    const initialState = domain.initialState(problem);
    const rootPath: number[] = [];
    const rootMoves = domain.legalMoves(problem, initialState).map((move) => move.id);
    const rootId = formatNodeId(rootPath);
    const rootNode = createNodeRecord(initialState, 0, null, null, rootPath, null, 'L', 0, Number.POSITIVE_INFINITY);
    searchTree.set(rootId, rootNode);

    pushOpen(rootId, 'L', Number.POSITIVE_INFINITY);

    yield createStep(
      ctx,
      'initializing',
      `Initialized SSS* at ${rootNode.stateLabel}.`,
      0,
      {
        state: initialState,
        availableMoves: rootMoves,
        openQueue: buildGameTreeSnapshot(),
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
      if (!node) continue;
      const state = statesByNodeId.get(entry.id);

      if (entry.state === 'L') {
        node.searchState = undefined;
      }

      const maximizingTurn = node.nodeKind === 'max';
      const terminal = domain.isTerminal(problem, state);
      const openSnapshotBeforeAction = buildGameTreeSnapshot();
      const stack = buildPathFrames(node.id);

      if (entry.id === rootId && entry.state === 'S') {
        const bestLine = buildPrincipalVariation(initialState, new Map<string, LineEvaluation>());

        yield createStep(
          ctx,
          'found',
          `SSS* solves the root with value ${formatBound(entry.h)} and selects ${bestLine.move ?? 'no move'}.`,
          3,
          {
            state: initialState,
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
          { level: 'success' },
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
          const solvedScore = Math.min(entry.h, domain.terminalValue(problem, state, node.depth));
          node.isTerminal = true;
          node.score = solvedScore;
          pushOpen(node.id, 'S', solvedScore);

          yield createStep(
            ctx,
            'propagating',
            `Reached terminal state ${node.stateLabel} at depth ${node.depth}; solved value ${solvedScore}.`,
            6,
            {
              state,
              availableMoves: [],
              openQueue: buildGameTreeSnapshot(),
              currentMove: node.move,
              currentScore: solvedScore,
              bestScore: solvedScore,
              evaluatedMoves: [],
              recursionStack: stack,
              searchTree,
              currentNodeId: node.id,
            },
            { level: 'success' },
          );

          continue;
        }

        const childMoves = node.childMoves ?? domain.legalMoves(problem, state).map((m) => m.id);
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
              state,
              availableMoves: childMoves,
              openQueue: buildGameTreeSnapshot(),
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
            state,
            availableMoves: childMoves,
            openQueue: buildGameTreeSnapshot(),
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

      if (node.nodeKind === 'min') {
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
            state,
            availableMoves: node.childMoves ?? [],
            openQueue: buildGameTreeSnapshot(),
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

      const parentState = statesByNodeId.get(parentId);
      const childMoves = parent.childMoves ?? domain.legalMoves(problem, parentState).map((m) => m.id);
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
            state,
            availableMoves: node.childMoves ?? [],
            openQueue: buildGameTreeSnapshot(),
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
          state,
          availableMoves: node.childMoves ?? [],
          openQueue: buildGameTreeSnapshot(),
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
