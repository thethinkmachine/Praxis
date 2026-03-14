import type { AlgorithmRunner } from '@/types/algorithm';
import type { AlgorithmStep } from '@/types/step';
import type { TicTacToeBoard, TicTacToePlayer } from '@/lib/tic-tac-toe';
import type { TicTacToeProblem } from '@/types/problem';

export interface EvaluatedMove {
  move: number;
  score: number;
}

export interface RecursionFrame {
  depth: number;
  player: TicTacToePlayer;
  role: 'max' | 'min' | 'negamax';
  move: number | null;
  board: TicTacToeBoard;
  alpha?: number;
  beta?: number;
  bestScore?: number | null;
}

export interface GameTreeNode {
  id: string;
  parentId: string | null;
  board: TicTacToeBoard;
  move: number | null;
  score: number | null;
  alpha?: number;
  beta?: number;
  depth: number;
  player: TicTacToePlayer;
  isPruned?: boolean;
  isTerminal?: boolean;
  discoveryStep: number;
}

export interface TicTacToeTraceState {
  board: TicTacToeBoard;
  currentPlayer: TicTacToePlayer;
  maximizingPlayer: TicTacToePlayer;
  availableMoves: number[];
  currentMove: number | null;
  currentScore: number | null;
  bestMove: number | null;
  bestScore: number | null;
  evaluatedMoves: EvaluatedMove[];
  recursionStack: RecursionFrame[];
  alpha?: number;
  beta?: number;
  terminalWinner?: TicTacToePlayer | 'draw' | null;
  winningLine?: number[] | null;
  principalVariation?: number[];
  searchTree?: Map<string, GameTreeNode>;
}

export interface TicTacToeTraceHighlight {
  currentCell: number | null;
  candidateCells: Set<number>;
  winningLine: number[] | null;
  principalVariation: number[] | null;
  currentNodeId?: string | null;
}

export interface TicTacToeResult {
  bestMove: number | null;
  bestScore: number;
  nodesExpanded: number;
  principalVariation: number[];
  outcome: 'win' | 'draw' | 'loss';
}

export type TicTacToeRunner = AlgorithmRunner<
  TicTacToeProblem,
  TicTacToeTraceState,
  TicTacToeTraceHighlight,
  TicTacToeResult
>;

export type TicTacToeStep = AlgorithmStep<TicTacToeTraceState, TicTacToeTraceHighlight>;
