import type { AlgorithmRunner } from '@/types/algorithm';
import type { AlgorithmStep } from '@/types/step';
import type { GameProblem } from '@/types/problem';
import type { GameNodeKind } from '@/problems/game-playing/domain';

export interface EvaluatedMove {
  move: string;
  score: number;
  detail?: string;
}

export interface SssOpenEntry {
  id: string;
  state: 'L' | 'S';
  h: number;
  move: string | null;
  depth: number;
  path: number[];
}

export interface RecursionFrame {
  depth: number;
  nodeKind: GameNodeKind;
  role: 'max' | 'min' | 'negamax' | 'chance' | 'selection' | 'rollout' | 'backprop';
  move: string | null;
  stateLabel: string;
  alpha?: number;
  beta?: number;
  bestScore?: number | null;
}

export interface GameTreeNode {
  id: string;
  parentId: string | null;
  stateLabel: string;
  nodeKind: GameNodeKind;
  /** Domain-specific rendering payload. */
  extra?: Record<string, unknown>;
  move: string | null;
  moveLabel: string | null;
  score: number | null;
  alpha?: number;
  beta?: number;
  depth: number;
  isPruned?: boolean;
  /** Set on pruned nodes: which bound caused the cut. Beta cuts fire at MAX nodes, alpha cuts at MIN nodes. */
  prunedBy?: 'alpha' | 'beta';
  isTerminal?: boolean;
  searchState?: 'L' | 'S';
  path?: number[];
  childMoves?: string[];
  childIds?: Array<string | null>;
  discoveryStep: number;
  /** SSS*-only: index of the cluster (MAX-node sibling batch) this node was pushed live as part of. */
  clusterIndex?: number;
}

/** SSS*-only: a batch of siblings pushed LIVE together when a MAX node is expanded (Γ operator, MAX case). */
export interface SssClusterInfo {
  index: number;
  /** The MAX node whose expansion formed this cluster. */
  sourceNodeId: string;
  /** Search-tree ids of the siblings pushed live together. */
  memberIds: string[];
  /** Horizon/terminal leaves reachable beneath this cluster's members, regardless of whether SSS* has visited them yet. */
  horizonIds: string[];
}

export interface GameTraceState {
  stateLabel: string;
  nodeKind: GameNodeKind;
  extra?: Record<string, unknown>;
  availableMoves: string[];
  openQueue?: SssOpenEntry[];
  currentMove: string | null;
  currentScore: number | null;
  bestMove: string | null;
  bestScore: number | null;
  evaluatedMoves: EvaluatedMove[];
  recursionStack: RecursionFrame[];
  alpha?: number;
  beta?: number;
  principalVariation?: string[];
  /** Horizon/terminal leaves belonging to the full best-strategy subtree (best child at MAX nodes, every child at MIN/chance nodes), independent of pruning. */
  bestStrategyLeafIds?: string[];
  /** Every node id (leaves and internal) belonging to the best-strategy subtree; used for highlighting. */
  bestStrategyNodeIds?: string[];
  /** Horizon/terminal leaves that fall beneath a branch pruned by an alpha cut (MIN node, value <= alpha). */
  alphaCutHorizonIds?: string[];
  /** Horizon/terminal leaves that fall beneath a branch pruned by a beta cut (MAX node, value >= beta). */
  betaCutHorizonIds?: string[];
  /** SSS*-only: MAX-node sibling batches formed so far, in formation order. */
  clusters?: SssClusterInfo[];
  searchTree?: Map<string, GameTreeNode>;
  currentNodeId?: string | null;
}

export interface GameTraceHighlight {
  currentMove: string | null;
  candidateMoves: Set<string>;
  winningLine: number[] | null;
  principalVariation: string[] | null;
  bestStrategyNodeIds?: string[] | null;
  currentNodeId?: string | null;
}

export interface GameResult {
  bestMove: string | null;
  bestScore: number;
  nodesExpanded: number;
  principalVariation: string[];
  outcome: 'win' | 'draw' | 'loss';
}

export type GameRunner = AlgorithmRunner<GameProblem, GameTraceState, GameTraceHighlight, GameResult>;

export type GameStep = AlgorithmStep<GameTraceState, GameTraceHighlight>;
