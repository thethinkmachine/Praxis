import { createLog, statePanels as panelSections } from '@/algorithms/core/utils';
import type { PanelSection } from '@/types';
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
  SssOpenEntry,
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
  openQueue?: SssOpenEntry[];
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
    openQueue: [],
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
  const parts = [frame.move === null ? 'root' : formatMove(frame.move)];
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
    parts.push(`move=${formatMove(entry.move)}`);
  }
  return parts.join(' • ');
}

function buildStatePanels(state: TicTacToeTraceState): PanelSection[] {
  const panels: PanelSection[] = [];

  panels.push(panelSections.keyValue('Position', [
    { key: 'Board', value: formatBoard(state.board) },
    { key: 'Current player', value: state.currentPlayer },
    { key: 'Maximizing player', value: state.maximizingPlayer },
    { key: 'Terminal winner', value: state.terminalWinner ?? '-' },
  ]));

  const searchItems = [
    { key: 'Current candidate', value: state.currentMove === null ? '-' : formatMove(state.currentMove) },
    { key: 'Best move', value: state.bestMove === null ? '-' : formatMove(state.bestMove) },
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
    state.availableMoves.map(move => ({
      id: String(move),
      label: formatMove(move),
      variant: 'frontier',
    })),
  ));

  if ((state.principalVariation ?? []).length > 0) {
    panels.push(panelSections.chips(
      'Principal Variation',
      (state.principalVariation ?? []).map(move => ({
        id: String(move),
        label: formatMove(move),
        variant: 'path',
      })),
    ));
  }

  if (state.evaluatedMoves.length > 0) {
    panels.push(panelSections.nodes(
      'Evaluated Moves',
      state.evaluatedMoves.map(move => ({
        id: String(move.move),
        label: formatMove(move.move),
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
      { key: 'Terminal', value: nodes.filter(node => node.isTerminal).length },
      { key: 'Live', value: liveNodes },
      { key: 'Solved', value: solvedNodes },
      { key: 'Pruned', value: nodes.filter(node => node.isPruned).length },
      { key: 'Max depth', value: nodes.reduce((maxDepth, node) => Math.max(maxDepth, node.depth), 0) },
      { key: 'Current node', value: state.currentNodeId ?? '-' },
    ]));
  }

  return panels;
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
  const openQueue = snapshot.openQueue ? snapshot.openQueue.map((entry) => ({
    ...entry,
    path: [...entry.path],
  })) : undefined;
  const frontierSize = openQueue?.length ?? availableMoves.length;
  ctx.maxDepth = Math.max(ctx.maxDepth, recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth);
  ctx.maxFrontierSize = Math.max(ctx.maxFrontierSize, frontierSize);

  const state: TicTacToeTraceState = {
    board: [...snapshot.board],
    currentPlayer: snapshot.currentPlayer,
    maximizingPlayer: snapshot.maximizingPlayer,
    availableMoves,
    openQueue,
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
    statePanels: buildStatePanels(state),
    metrics: [
      { label: 'Expanded', value: ctx.nodesExpanded, color: 'text-[var(--accent)]' },
      { label: 'Frontier', value: frontierSize, color: 'text-[var(--accent)]' },
      { label: 'Max Frontier', value: ctx.maxFrontierSize, color: 'text-[var(--text-2)]' },
      { label: 'Depth', value: recursionStack.length === 0 ? 0 : recursionStack[recursionStack.length - 1].depth, color: 'text-[var(--text)]' },
      { label: 'Score', value: snapshot.currentScore ?? snapshot.bestScore ?? 0, color: 'text-[var(--warning)]' },
      { label: 'Memory', value: recursionStack.length + frontierSize, color: 'text-[var(--text-2)]' },
    ],
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
