import { describe, expect, it } from 'vitest';

import { createEmptyBoard, setBoardCell } from '@/lib/tic-tac-toe';

describe('tic-tac-toe editor helpers', () => {
  it('sets a specific cell directly without cycling neighboring cells', () => {
    const board = createEmptyBoard();
    const withX = setBoardCell(board, 4, 'X');

    expect(withX).toEqual([null, null, null, null, 'X', null, null, null, null]);

    const withO = setBoardCell(withX, 1, 'O');
    expect(withO).toEqual([null, 'O', null, null, 'X', null, null, null, null]);

    const erased = setBoardCell(withO, 4, null);
    expect(erased).toEqual([null, 'O', null, null, null, null, null, null, null]);
  });
});