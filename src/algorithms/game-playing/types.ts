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
  isTerminal?: boolean;
  searchState?: 'L' | 'S';
  path?: number[];
  childMoves?: string[];
  childIds?: Array<string | null>;
  discoveryStep: number;
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
  searchTree?: Map<string, GameTreeNode>;
  currentNodeId?: string | null;
}

export interface GameTraceHighlight {
  currentMove: string | null;
  candidateMoves: Set<string>;
  winningLine: number[] | null;
  principalVariation: string[] | null;
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
