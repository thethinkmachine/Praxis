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
}

export interface TicTacToeTraceHighlight {
  currentCell: number | null;
  candidateCells: Set<number>;
  winningLine: number[] | null;
  principalVariation: number[] | null;
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
