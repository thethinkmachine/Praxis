import { createLog } from '@/algorithms/core/utils';
import {
  applyMove,
  createEmptyBoard,
  evaluateTerminalBoard,
  formatBoard,
  formatMove,
  getLegalMoves,
  getOtherPlayer,
  getWinner,
  getWinningLine,
  inferNextPlayer,
  isBoardFull,
  isTerminalBoard,
  isValidBoard,
  type TicTacToeBoard,
  type TicTacToePlayer,
} from '@/lib/tic-tac-toe';
import type {
  EvaluatedMove,
  GameTreeNode,
  RecursionFrame,
  TicTacToeResult,
  TicTacToeStep,
  TicTacToeTraceHighlight,
  TicTacToeTraceState,
} from './types';
import type { TicTacToeProblem } from '@/types/problem';

export interface ResolvedTicTacToeProblem {
  board: TicTacToeBoard;
  currentPlayer: TicTacToePlayer;
  maximizingPlayer: TicTacToePlayer;
}

export interface SearchEvaluation {
  score: number;
  move: number | null;
  principalVariation: number[];
}

export interface TraceContext {
  stepNumber: number;
  nodesExpanded: number;
  maxDepth: number;
  maxFrontierSize: number;
}

export interface TraceSnapshot {
  board: TicTacToeBoard;
  currentPlayer: TicTacToePlayer;
  maximizingPlayer: TicTacToePlayer;
  availableMoves?: number[];
  currentMove?: number | null;
  currentScore?: number | null;
  bestMove?: number | null;
  bestScore?: number | null;
  evaluatedMoves?: EvaluatedMove[];
  recursionStack?: RecursionFrame[];
  alpha?: number;
  beta?: number;
  principalVariation?: number[] | null;
  searchTree?: Map<string, GameTreeNode>;
  currentNodeId?: string | null;
}

export function validateTicTacToeProblem(problem: TicTacToeProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const board = problem.board ?? createEmptyBoard();

  if (!isValidBoard(board)) {
    errors.push('Board must contain exactly 9 cells using only X, O, or null.');
    return { valid: false, errors };
  }

  const xCount = board.filter((cell: TicTacToeBoard[number]) => cell === 'X').length;
  const oCount = board.filter((cell: TicTacToeBoard[number]) => cell === 'O').length;
  if (oCount > xCount || xCount - oCount > 1) {
    errors.push('Board has an invalid number of X and O moves.');
  }

  const winner = getWinner(board);
  const winningLine = getWinningLine(board);
  if (winner && winningLine) {
    const altWinner = winner === 'X' ? 'O' : 'X';
    const altWinningLine = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ].some(line => line.every(index => board[index] === altWinner));
    if (altWinningLine) {
      errors.push('Board cannot contain winning lines for both players.');
    }
  }

  if (problem.currentPlayer && problem.currentPlayer !== 'X' && problem.currentPlayer !== 'O') {
    errors.push('Current player must be X or O.');
  }

  if (problem.maximizingPlayer && problem.maximizingPlayer !== 'X' && problem.maximizingPlayer !== 'O') {
    errors.push('Maximizing player must be X or O.');
  }

  const inferred = inferNextPlayer(board);
  if (problem.currentPlayer && !winner && !isBoardFull(board) && problem.currentPlayer !== inferred) {
    warnings.push(`Current player ${problem.currentPlayer} does not match inferred turn ${inferred}; using the explicit value.`);
  }

  if (winner) {
    warnings.push(`Board is already terminal with winner ${winner}.`);
  } else if (isBoardFull(board)) {
    warnings.push('Board is already terminal with a draw.');
  }

  return { valid: errors.length === 0, errors, warnings: warnings.length > 0 ? warnings : undefined };
}

export function resolveProblem(problem: TicTacToeProblem): ResolvedTicTacToeProblem {
  const board = problem.board ? [...problem.board] : createEmptyBoard();
  return {
    board,
    currentPlayer: problem.currentPlayer ?? inferNextPlayer(board),
    maximizingPlayer: problem.maximizingPlayer ?? (problem.currentPlayer ?? inferNextPlayer(board)),
  };
}

export function getInitialTraceState(problem: TicTacToeProblem): TicTacToeTraceState {
  const resolved = resolveProblem(problem);
  return {
    board: [...resolved.board],
    currentPlayer: resolved.currentPlayer,
    maximizingPlayer: resolved.maximizingPlayer,
    availableMoves: getLegalMoves(resolved.board),
    currentMove: null,
    currentScore: null,
    bestMove: null,
    bestScore: null,
    evaluatedMoves: [],
    recursionStack: [],
    alpha: undefined,
    beta: undefined,
    terminalWinner: getWinner(resolved.board) ?? (isBoardFull(resolved.board) ? 'draw' : null),
    winningLine: getWinningLine(resolved.board),
    principalVariation: [],
  };
}

export function createTraceContext(): TraceContext {
  return {
    stepNumber: 0,
    nodesExpanded: 0,
    maxDepth: 0,
    maxFrontierSize: 0,
  };
}

export function cloneFrame(frame: RecursionFrame): RecursionFrame {
  return {
    ...frame,
    board: [...frame.board],
  };
}

export function determineOutcome(score: number): TicTacToeResult['outcome'] {
  if (score > 0) return 'win';
  if (score < 0) return 'loss';
  return 'draw';
}

export function terminalEvaluation(
  board: TicTacToeBoard,
  maximizingPlayer: TicTacToePlayer,
  depth: number,
): { score: number; winner: TicTacToePlayer | 'draw'; winningLine: number[] | null } {
  const winner = getWinner(board);
  return {
    score: evaluateTerminalBoard(board, maximizingPlayer, depth),
    winner: winner ?? 'draw',
    winningLine: getWinningLine(board),
  };
}

export function createStep(
  ctx: TraceContext,
  phase: TicTacToeStep['phase'],
  description: string,
  pseudocodeLine: number,
  snapshot: TraceSnapshot,
  options?: {
    level?: 'info' | 'warn' | 'success' | 'error';
    winningLine?: number[] | null;
  },
): TicTacToeStep {
  const recursionStack = (snapshot.recursionStack ?? []).map(cloneFrame);
  const availableMoves = [...(snapshot.availableMoves ?? getLegalMoves(snapshot.board))];
  ctx.maxDepth = Math.max(ctx.maxDepth, recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth);
  ctx.maxFrontierSize = Math.max(ctx.maxFrontierSize, availableMoves.length);

  const state: TicTacToeTraceState = {
    board: [...snapshot.board],
    currentPlayer: snapshot.currentPlayer,
    maximizingPlayer: snapshot.maximizingPlayer,
    availableMoves,
    currentMove: snapshot.currentMove ?? null,
    currentScore: snapshot.currentScore ?? null,
    bestMove: snapshot.bestMove ?? null,
    bestScore: snapshot.bestScore ?? null,
    evaluatedMoves: (snapshot.evaluatedMoves ?? []).map(item => ({ ...item })),
    recursionStack,
    alpha: snapshot.alpha,
    beta: snapshot.beta,
    terminalWinner: getWinner(snapshot.board) ?? (isBoardFull(snapshot.board) ? 'draw' : null),
    winningLine: options?.winningLine ?? getWinningLine(snapshot.board),
    principalVariation: snapshot.principalVariation ? [...snapshot.principalVariation] : [],
    searchTree: snapshot.searchTree, // Shared reference
  };

  const highlight: TicTacToeTraceHighlight = {
    currentCell: snapshot.currentMove ?? null,
    candidateCells: new Set(availableMoves),
    winningLine: state.winningLine ?? null,
    principalVariation: snapshot.principalVariation ? [...snapshot.principalVariation] : null,
    currentNodeId: snapshot.currentNodeId ?? null,
  };

  return {
    stepNumber: ctx.stepNumber++,
    phase,
    description,
    state,
    highlight,
    pseudocodeLine,
    metrics: {
      nodesExpanded: ctx.nodesExpanded,
      frontierSize: availableMoves.length,
      maxFrontierSize: ctx.maxFrontierSize,
      currentDepth: recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth,
      pathCost: snapshot.currentScore ?? snapshot.bestScore ?? 0,
      memoryUsed: recursionStack.length + availableMoves.length,
    },
    logs: [createLog(description, options?.level ?? 'info')],
  };
}

export function createTerminalDescription(
  board: TicTacToeBoard,
  maximizingPlayer: TicTacToePlayer,
  depth: number,
): string {
  const { score, winner } = terminalEvaluation(board, maximizingPlayer, depth);
  if (winner === 'draw') {
    return `Reached terminal draw at depth ${depth}; score = ${score}.`;
  }
  const relation = winner === maximizingPlayer ? 'maximizing player wins' : 'maximizing player loses';
  return `Reached terminal board ${formatBoard(board)} at depth ${depth}; ${relation}, score = ${score}.`;
}

export function nextBoard(board: TicTacToeBoard, move: number, player: TicTacToePlayer): TicTacToeBoard {
  return applyMove(board, move, player);
}

export function moveLabel(move: number): string {
  return formatMove(move);
}

export function nextPlayer(player: TicTacToePlayer): TicTacToePlayer {
  return getOtherPlayer(player);
}

export function boardKey(board: TicTacToeBoard): string {
  return formatBoard(board);
}

export function isTerminal(board: TicTacToeBoard): boolean {
  return isTerminalBoard(board);
}
