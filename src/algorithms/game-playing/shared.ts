import { createLog, statePanels as panelSections } from '@/algorithms/core/utils';
import type { PanelSection } from '@/types';
import type { GameProblem } from '@/types/problem';
import type { GameDomain, GameMove } from '@/problems/game-playing/domain';
import { resolveGameDomain } from '@/problems/game-playing/domains';
import type {
  EvaluatedMove,
  GameStep,
  GameTraceHighlight,
  GameTraceState,
  GameTreeNode,
  RecursionFrame,
  SssClusterInfo,
  SssOpenEntry,
} from './types';

export interface SearchEvaluation {
  score: number;
  move: string | null;
  principalVariation: string[];
}

export interface TraceContext {
  problem: GameProblem;
  domain: GameDomain<GameProblem, unknown>;
  stepNumber: number;
  nodesExpanded: number;
  maxDepth: number;
  maxFrontierSize: number;
}

export interface TraceSnapshot {
  state: unknown;
  availableMoves?: string[];
  openQueue?: SssOpenEntry[];
  currentMove?: string | null;
  currentScore?: number | null;
  bestMove?: string | null;
  bestScore?: number | null;
  evaluatedMoves?: EvaluatedMove[];
  recursionStack?: RecursionFrame[];
  alpha?: number;
  beta?: number;
  principalVariation?: string[] | null;
  bestStrategyLeafIds?: string[];
  bestStrategyNodeIds?: string[];
  alphaCutHorizonIds?: string[];
  betaCutHorizonIds?: string[];
  clusters?: SssClusterInfo[];
  searchTree?: Map<string, GameTreeNode>;
  currentNodeId?: string | null;
}

export function validateGameProblem(problem: GameProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  return resolveGameDomain(problem).validate(problem);
}

export function createTraceContext(problem: GameProblem): TraceContext {
  return {
    problem,
    domain: resolveGameDomain(problem),
    stepNumber: 0,
    nodesExpanded: 0,
    maxDepth: 0,
    maxFrontierSize: 0,
  };
}

export function getInitialTraceState(problem: GameProblem): GameTraceState {
  const domain = resolveGameDomain(problem);
  const state = domain.initialState(problem);
  return {
    stateLabel: domain.describeState(problem, state),
    nodeKind: domain.nodeKind(problem, state),
    extra: domain.getStateExtra?.(problem, state),
    availableMoves: domain.legalMoves(problem, state).map((move) => move.id),
    openQueue: [],
    currentMove: null,
    currentScore: null,
    bestMove: null,
    bestScore: null,
    evaluatedMoves: [],
    recursionStack: [],
    alpha: undefined,
    beta: undefined,
    principalVariation: [],
  };
}

export function cloneFrame(frame: RecursionFrame): RecursionFrame {
  return { ...frame };
}

export function determineOutcome(score: number): 'win' | 'draw' | 'loss' {
  if (score > 0) return 'win';
  if (score < 0) return 'loss';
  return 'draw';
}

export function createTerminalDescription(ctx: TraceContext, state: unknown, depth: number): string {
  return (
    ctx.domain.describeTerminal?.(ctx.problem, state, depth)
    ?? `Reached terminal state ${ctx.domain.describeState(ctx.problem, state)} at depth ${depth}.`
  );
}

export interface BestStrategyNode {
  /** The move that led here from the parent; null at the root. */
  moveId: string | null;
  isTerminal: boolean;
  score: number;
  /** MAX nodes keep only their best child; MIN/chance nodes keep every child, since the strategy must cover any reply. */
  children: BestStrategyNode[];
}

/**
 * Replays the full game tree independently of any search trace (so it's correct even when the
 * algorithm that ran pruned or never fully explored the tree, e.g. Alpha-Beta or SSS*). At MAX
 * nodes it keeps only the best child (ties broken leftmost, matching the strict `>` comparisons
 * used throughout this package's runners); at MIN/chance nodes it keeps every child, since a
 * strategy has to define a response to whichever one the opponent/chance picks.
 *
 * `treatMinAsChance` mirrors Expectimax's own semantics (every non-MAX node is averaged, never
 * minimized) so the reported strategy matches what that particular algorithm actually computed.
 */
export function computeBestStrategy(
  domain: GameDomain<GameProblem, unknown>,
  problem: GameProblem,
  state: unknown,
  treatMinAsChance: boolean = false,
  depth: number = 0,
): BestStrategyNode {
  if (domain.isTerminal(problem, state)) {
    return { moveId: null, isTerminal: true, score: domain.terminalValue(problem, state, depth), children: [] };
  }

  const kind = domain.nodeKind(problem, state);
  const moves = domain.legalMoves(problem, state);

  if (kind === 'max') {
    let best: { move: GameMove; node: BestStrategyNode } | null = null;
    for (const move of moves) {
      const childState = domain.applyMove(problem, state, move.id);
      const childNode = computeBestStrategy(domain, problem, childState, treatMinAsChance, depth + 1);
      if (!best || childNode.score > best.node.score) {
        best = { move, node: childNode };
      }
    }
    if (!best) return { moveId: null, isTerminal: false, score: Number.NEGATIVE_INFINITY, children: [] };
    return {
      moveId: null,
      isTerminal: false,
      score: best.node.score,
      children: [{ ...best.node, moveId: best.move.id }],
    };
  }

  const useExpectation = kind === 'chance' || treatMinAsChance;
  const children: BestStrategyNode[] = [];
  let score = useExpectation ? 0 : Number.POSITIVE_INFINITY;
  for (const move of moves) {
    const childState = domain.applyMove(problem, state, move.id);
    const childNode = computeBestStrategy(domain, problem, childState, treatMinAsChance, depth + 1);
    children.push({ ...childNode, moveId: move.id });
    if (useExpectation) {
      score += childNode.score * (move.probability ?? 1 / moves.length);
    } else {
      score = Math.min(score, childNode.score);
    }
  }
  return { moveId: null, isTerminal: false, score, children };
}

export function collectBestStrategyLeafIds(strategy: BestStrategyNode): string[] {
  const ids: string[] = [];
  const visit = (node: BestStrategyNode) => {
    if (node.isTerminal) {
      if (node.moveId) ids.push(node.moveId);
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(strategy);
  return ids;
}

export function collectBestStrategyNodeIds(strategy: BestStrategyNode): string[] {
  const ids: string[] = [];
  const visit = (node: BestStrategyNode) => {
    if (node.moveId) ids.push(node.moveId);
    for (const child of node.children) visit(child);
  };
  visit(strategy);
  return ids;
}

/**
 * DFS over the domain (not the search trace) to find every terminal/horizon leaf reachable
 * beneath `state`. Used to attribute horizon nodes to branches a search algorithm pruned or
 * otherwise never actually visited (Alpha-Beta cuts, SSS* clusters).
 */
export function collectTerminalDescendantIds(
  domain: GameDomain<GameProblem, unknown>,
  problem: GameProblem,
  state: unknown,
): string[] {
  const leaves: string[] = [];
  const visit = (s: unknown) => {
    for (const move of domain.legalMoves(problem, s)) {
      const childState = domain.applyMove(problem, s, move.id);
      if (domain.isTerminal(problem, childState)) {
        leaves.push(move.id);
      } else {
        visit(childState);
      }
    }
  };
  if (!domain.isTerminal(problem, state)) visit(state);
  return leaves;
}

function formatBound(value: number | undefined): string {
  if (value === undefined) return '-';
  if (value === Number.POSITIVE_INFINITY) return '∞';
  if (value === Number.NEGATIVE_INFINITY) return '-∞';
  return String(value);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return formatBound(value);
}

function formatMoveDetail(frame: RecursionFrame): string {
  const parts = [frame.move === null ? 'root' : frame.move];
  if (frame.alpha !== undefined || frame.beta !== undefined) {
    parts.push(`[${formatBound(frame.alpha)}, ${formatBound(frame.beta)}]`);
  }
  if (frame.bestScore !== undefined && frame.bestScore !== null) {
    parts.push(`best=${formatScore(frame.bestScore)}`);
  }
  return parts.join(' • ');
}

function formatOpenQueueDetail(entry: SssOpenEntry): string {
  const parts = [entry.state, `h=${formatBound(entry.h)}`];
  if (entry.move !== null) {
    parts.push(`move=${entry.move}`);
  }
  return parts.join(' • ');
}

function buildStatePanels(state: GameTraceState): PanelSection[] {
  const panels: PanelSection[] = [];

  const positionItems: Array<{ key: string; value: string | number }> = [
    { key: 'State', value: state.stateLabel },
    { key: 'Node kind', value: state.nodeKind.toUpperCase() },
  ];
  panels.push(panelSections.keyValue('Position', positionItems));

  const searchItems = [
    { key: 'Current candidate', value: state.currentMove ?? '-' },
    { key: 'Best move', value: state.bestMove ?? '-' },
    { key: 'Current score', value: formatScore(state.currentScore) },
    { key: 'Best score', value: formatScore(state.bestScore) },
  ];
  if (state.alpha !== undefined || state.beta !== undefined) {
    searchItems.push({ key: 'Window', value: `[${formatBound(state.alpha)}, ${formatBound(state.beta)}]` });
  }
  panels.push(panelSections.keyValue('Best Move', searchItems));

  if ((state.openQueue ?? []).length > 0) {
    panels.push(panelSections.chips(
      'OPEN Queue',
      (state.openQueue ?? []).map((entry) => ({
        id: entry.id,
        label: entry.id,
        detail: formatOpenQueueDetail(entry),
        variant: entry.state === 'S' ? 'explored' : 'frontier',
      })),
    ));
  }

  panels.push(panelSections.chips(
    'Available Moves',
    state.availableMoves.map((move) => ({
      id: move,
      label: move,
      variant: 'frontier',
    })),
  ));

  if ((state.principalVariation ?? []).length > 0) {
    panels.push(panelSections.chips(
      'Principal Variation',
      (state.principalVariation ?? []).map((move) => ({
        id: move,
        label: move,
        variant: 'path',
      })),
    ));
  }

  if ((state.bestStrategyLeafIds ?? []).length > 0) {
    panels.push(panelSections.chips(
      'Best Strategy — Horizon Nodes',
      (state.bestStrategyLeafIds ?? []).map((id) => ({
        id,
        label: id,
        variant: 'strategy',
      })),
    ));
  }

  if ((state.alphaCutHorizonIds ?? []).length > 0) {
    panels.push(panelSections.chips(
      'Pruned by Alpha-Cuts (horizon)',
      (state.alphaCutHorizonIds ?? []).map((id) => ({
        id,
        label: id,
        variant: 'pruned',
      })),
    ));
  }

  if ((state.betaCutHorizonIds ?? []).length > 0) {
    panels.push(panelSections.chips(
      'Pruned by Beta-Cuts (horizon)',
      (state.betaCutHorizonIds ?? []).map((id) => ({
        id,
        label: id,
        variant: 'pruned',
      })),
    ));
  }

  if ((state.clusters ?? []).length > 0) {
    panels.push(panelSections.nodes(
      'SSS* Clusters',
      (state.clusters ?? []).map((cluster) => ({
        id: `cluster-${cluster.index}`,
        label: `Cluster ${cluster.index} (from ${cluster.sourceNodeId})`,
        detail: `members: ${cluster.memberIds.join(', ') || 'none'} • horizon: ${cluster.horizonIds.join(', ') || 'none'}`,
      })),
    ));
  }

  if (state.evaluatedMoves.length > 0) {
    panels.push(panelSections.nodes(
      'Evaluated Moves',
      state.evaluatedMoves.map((move) => ({
        id: move.move,
        label: move.move,
        detail: move.detail ? `score=${move.score} • ${move.detail}` : `score=${move.score}`,
      })),
    ));
  }

  if (state.recursionStack.length > 0) {
    panels.push(panelSections.nodes(
      'Recursion Stack',
      state.recursionStack.map((frame, index) => ({
        id: `${frame.depth}-${frame.move ?? 'root'}-${index}`,
        label: frame.role ? `${frame.role.toUpperCase()} d${frame.depth}` : `d${frame.depth}`,
        detail: formatMoveDetail(frame),
      })),
    ));
  }

  if (state.searchTree instanceof Map && state.searchTree.size > 0) {
    const nodes = [...state.searchTree.values()];
    const liveNodes = nodes.filter((node) => node.searchState === 'L').length;
    const solvedNodes = nodes.filter((node) => node.searchState === 'S').length;
    panels.push(panelSections.keyValue('Search Tree', [
      { key: 'Nodes', value: nodes.length },
      { key: 'Terminal', value: nodes.filter((node) => node.isTerminal).length },
      { key: 'Live', value: liveNodes },
      { key: 'Solved', value: solvedNodes },
      { key: 'Pruned', value: nodes.filter((node) => node.isPruned).length },
      { key: 'Max depth', value: nodes.reduce((maxDepth, node) => Math.max(maxDepth, node.depth), 0) },
      { key: 'Current node', value: state.currentNodeId ?? '-' },
    ]));
  }

  return panels;
}

export function createStep(
  ctx: TraceContext,
  phase: GameStep['phase'],
  description: string,
  pseudocodeLine: number,
  snapshot: TraceSnapshot,
  options?: {
    level?: 'info' | 'warn' | 'success' | 'error';
    winningLine?: number[] | null;
  },
): GameStep {
  const recursionStack = (snapshot.recursionStack ?? []).map(cloneFrame);
  const availableMoves = snapshot.availableMoves ?? ctx.domain.legalMoves(ctx.problem, snapshot.state).map((move) => move.id);
  const openQueue = snapshot.openQueue ? snapshot.openQueue.map((entry) => ({
    ...entry,
    path: [...entry.path],
  })) : undefined;
  const frontierSize = openQueue?.length ?? availableMoves.length;
  ctx.maxDepth = Math.max(ctx.maxDepth, recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth);
  ctx.maxFrontierSize = Math.max(ctx.maxFrontierSize, frontierSize);

  const state: GameTraceState = {
    stateLabel: ctx.domain.describeState(ctx.problem, snapshot.state),
    nodeKind: ctx.domain.nodeKind(ctx.problem, snapshot.state),
    extra: ctx.domain.getStateExtra?.(ctx.problem, snapshot.state),
    availableMoves,
    openQueue,
    currentMove: snapshot.currentMove ?? null,
    currentScore: snapshot.currentScore ?? null,
    bestMove: snapshot.bestMove ?? null,
    bestScore: snapshot.bestScore ?? null,
    evaluatedMoves: (snapshot.evaluatedMoves ?? []).map((item) => ({ ...item })),
    recursionStack,
    alpha: snapshot.alpha,
    beta: snapshot.beta,
    principalVariation: snapshot.principalVariation ? [...snapshot.principalVariation] : [],
    bestStrategyLeafIds: snapshot.bestStrategyLeafIds,
    bestStrategyNodeIds: snapshot.bestStrategyNodeIds,
    alphaCutHorizonIds: snapshot.alphaCutHorizonIds,
    betaCutHorizonIds: snapshot.betaCutHorizonIds,
    clusters: snapshot.clusters,
    searchTree: snapshot.searchTree, // Shared reference
    currentNodeId: snapshot.currentNodeId ?? null,
  };

  const highlight: GameTraceHighlight = {
    currentMove: snapshot.currentMove ?? null,
    candidateMoves: new Set(availableMoves),
    winningLine: options?.winningLine ?? null,
    principalVariation: snapshot.principalVariation ? [...snapshot.principalVariation] : null,
    bestStrategyNodeIds: snapshot.bestStrategyNodeIds ?? null,
    currentNodeId: snapshot.currentNodeId ?? null,
  };

  return {
    stepNumber: ctx.stepNumber++,
    phase,
    description,
    state,
    highlight,
    pseudocodeLine,
    statePanels: buildStatePanels(state),
    metrics: [
      // Expanded/Score lead the array — activity + the actual evaluation number
      // a viewer cares about, so compact surfaces that only show the first
      // couple of tiles (e.g. the status bar) still say something useful.
      { label: 'Expanded', value: ctx.nodesExpanded, color: 'text-[var(--accent)]' },
      { label: 'Score', value: snapshot.currentScore ?? snapshot.bestScore ?? 0, color: 'text-[var(--warning)]' },
      { label: 'Frontier', value: frontierSize, color: 'text-[var(--accent)]' },
      { label: 'Max Frontier', value: ctx.maxFrontierSize, color: 'text-[var(--text-2)]' },
      { label: 'Depth', value: recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth, color: 'text-[var(--text)]' },
      { label: 'Memory', value: recursionStack.length + frontierSize, color: 'text-[var(--text-2)]' },
    ],
    logs: [createLog(description, options?.level ?? 'info')],
  };
}
