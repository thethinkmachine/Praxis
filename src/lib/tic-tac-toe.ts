export type TicTacToePlayer = 'X' | 'O';
export type TicTacToeCell = TicTacToePlayer | null;
export type TicTacToeBoard = TicTacToeCell[];

export const BOARD_SIZE = 9;
export const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard(): TicTacToeBoard {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

export function isValidBoard(board: TicTacToeBoard): boolean {
  return Array.isArray(board) && board.length === BOARD_SIZE && board.every(cell => cell === 'X' || cell === 'O' || cell === null);
}

export function cloneBoard(board: TicTacToeBoard): TicTacToeBoard {
  return [...board];
}

export function getLegalMoves(board: TicTacToeBoard): number[] {
  const moves: number[] = [];
  for (let index = 0; index < board.length; index++) {
    if (board[index] === null) {
      moves.push(index);
    }
  }
  return moves;
}

export function applyMove(board: TicTacToeBoard, move: number, player: TicTacToePlayer): TicTacToeBoard {
  if (move < 0 || move >= BOARD_SIZE) {
    throw new Error(`Move ${move} is out of range`);
  }
  if (board[move] !== null) {
    throw new Error(`Cell ${move} is already occupied`);
  }

  const next = cloneBoard(board);
  next[move] = player;
  return next;
}

export function getOtherPlayer(player: TicTacToePlayer): TicTacToePlayer {
  return player === 'X' ? 'O' : 'X';
}

export function getWinningLine(board: TicTacToeBoard): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return line;
    }
  }
  return null;
}

export function getWinner(board: TicTacToeBoard): TicTacToePlayer | null {
  const line = getWinningLine(board);
  return line ? board[line[0]] : null;
}

export function isBoardFull(board: TicTacToeBoard): boolean {
  return board.every(cell => cell !== null);
}

export function isTerminalBoard(board: TicTacToeBoard): boolean {
  return getWinner(board) !== null || isBoardFull(board);
}

export function inferNextPlayer(board: TicTacToeBoard): TicTacToePlayer {
  const xCount = board.filter(cell => cell === 'X').length;
  const oCount = board.filter(cell => cell === 'O').length;
  return xCount <= oCount ? 'X' : 'O';
}

export function evaluateTerminalBoard(
  board: TicTacToeBoard,
  maximizingPlayer: TicTacToePlayer,
  depth: number,
): number {
  const winner = getWinner(board);
  if (winner === maximizingPlayer) {
    return 10 - depth;
  }
  if (winner === getOtherPlayer(maximizingPlayer)) {
    return depth - 10;
  }
  return 0;
}

export function formatMove(move: number): string {
  const row = Math.floor(move / 3) + 1;
  const col = (move % 3) + 1;
  return `r${row}c${col}`;
}

export function formatBoard(board: TicTacToeBoard): string {
  return board.map(cell => cell ?? '.').join('');
}

export function boardKey(board: TicTacToeBoard): string {
  return formatBoard(board);
}
