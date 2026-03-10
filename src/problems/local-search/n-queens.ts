import type { NQueensProblem } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchDomain } from './types';

export interface NQueensMove {
  column: number;
  fromRow: number;
  toRow: number;
}

export interface NQueensCandidateMove extends NQueensMove, LocalSearchCandidate {
  state: number[];
  conflicts: number;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function chooseRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

export function createRandomState(size: number, random: () => number): number[] {
  return Array.from({ length: size }, () => Math.floor(random() * size));
}

export function normalizeState(problem: NQueensProblem, random = createSeededRandom(problem.randomSeed ?? 1337)): number[] {
  if (problem.initialState?.length === problem.size) {
    return [...problem.initialState];
  }
  return createRandomState(problem.size, random);
}

export function countConflicts(state: number[]): number {
  let conflicts = 0;
  for (let a = 0; a < state.length; a++) {
    for (let b = a + 1; b < state.length; b++) {
      const sameRow = state[a] === state[b];
      const sameDiag = Math.abs(state[a] - state[b]) === Math.abs(a - b);
      if (sameRow || sameDiag) conflicts++;
    }
  }
  return conflicts;
}

export function scoreState(state: number[]): number {
  return -countConflicts(state);
}

export function getConflictCountsByColumn(state: number[]): number[] {
  return state.map((row, column) => {
    let conflicts = 0;
    for (let other = 0; other < state.length; other++) {
      if (other === column) continue;
      if (state[other] === row || Math.abs(state[other] - row) === Math.abs(other - column)) {
        conflicts++;
      }
    }
    return conflicts;
  });
}

export function validateNQueensProblem(problem: NQueensProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(problem.size) || problem.size < 4 || problem.size > 24) {
    errors.push('N-Queens size must be an integer between 4 and 24.');
  }

  if (problem.initialState) {
    if (problem.initialState.length !== problem.size) {
      errors.push('Initial state must contain exactly one row index per column.');
    } else if (problem.initialState.some(row => !Number.isInteger(row) || row < 0 || row >= problem.size)) {
      errors.push('Initial state rows must be integers between 0 and N - 1.');
    }
  }

  if (problem.maxSteps !== undefined && (!Number.isInteger(problem.maxSteps) || problem.maxSteps <= 0)) {
    errors.push('Max steps must be a positive integer.');
  }

  if (problem.restartLimit !== undefined && (!Number.isInteger(problem.restartLimit) || problem.restartLimit < 0)) {
    errors.push('Restart limit must be a non-negative integer.');
  }

  if (problem.sidewaysMoveLimit !== undefined && (!Number.isInteger(problem.sidewaysMoveLimit) || problem.sidewaysMoveLimit < 0)) {
    errors.push('Sideways move limit must be a non-negative integer.');
  }

  if (problem.initialState && errors.length === 0 && countConflicts(problem.initialState) === 0) {
    warnings.push('Initial board is already a valid solution.');
  }

  return { valid: errors.length === 0, errors, warnings: warnings.length > 0 ? warnings : undefined };
}

export function formatState(state: number[]): string {
  return `[${state.join(', ')}]`;
}

export function applyMove(state: number[], move: NQueensMove): number[] {
  const next = [...state];
  next[move.column] = move.toRow;
  return next;
}

export function enumerateCandidateMoves(state: number[]): NQueensCandidateMove[] {
  const currentConflicts = countConflicts(state);
  const candidates: NQueensCandidateMove[] = [];

  for (let column = 0; column < state.length; column++) {
    for (let row = 0; row < state.length; row++) {
      if (row === state[column]) continue;
      const nextState = [...state];
      nextState[column] = row;
      const conflicts = countConflicts(nextState);
      candidates.push({
        id: `q${column}-r${row}`,
        label: `Q${column + 1} -> row ${row + 1}`,
        description: `Move queen in column ${column + 1} from row ${state[column] + 1} to row ${row + 1}.`,
        column,
        fromRow: state[column],
        toRow: row,
        state: nextState,
        conflicts,
        score: -conflicts,
        value: conflicts,
        displayValue: `${conflicts} conflicts`,
        delta: currentConflicts - conflicts,
        moveKey: `${column}:${row}`,
        preview: formatState(nextState),
        details: [
          `column ${column + 1}`,
          `row ${row + 1}`,
          `conflicts ${conflicts}`,
          `delta ${currentConflicts - conflicts >= 0 ? '+' : ''}${currentConflicts - conflicts}`,
        ],
        meta: {
          column,
          fromRow: state[column],
          toRow: row,
          conflicts,
        },
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.conflicts !== b.conflicts) return a.conflicts - b.conflicts;
    if (a.column !== b.column) return a.column - b.column;
    return a.toRow - b.toRow;
  });

  return candidates;
}

export const nQueensDomain: LocalSearchDomain<NQueensProblem, number[]> = {
  kind: 'n-queens',
  label: 'N-Queens',
  objectiveLabel: 'Conflicts',
  objectiveGoal: 'minimize',
  stateLabel: 'Board',
  validate: validateNQueensProblem,
  createRandomState: (problem, random) => createRandomState(problem.size, random),
  normalizeState: (problem, random) => normalizeState(problem, random),
  evaluate: (_problem, state) => {
    const conflicts = countConflicts(state);
    return {
      score: -conflicts,
      value: conflicts,
      displayValue: `${conflicts}`,
      goalReached: conflicts === 0,
      summary: formatState(state),
      stats: [
        { label: 'Queens', value: state.length },
        { label: 'Attacking pairs', value: conflicts },
      ],
    };
  },
  getNeighbors: (_problem, state) => enumerateCandidateMoves(state),
  getRandomNeighbor: (_problem, state, random) => {
    const neighbors = enumerateCandidateMoves(state);
    return neighbors.length > 0 ? chooseRandom(neighbors, random) : null;
  },
  getRepairCandidates: (_problem, state, random) => {
    const conflictCounts = getConflictCountsByColumn(state);
    const conflictedColumns = conflictCounts
      .map((count, index) => ({ count, index }))
      .filter(item => item.count > 0)
      .map(item => item.index);
    if (conflictedColumns.length === 0) return [];
    const chosenColumn = chooseRandom(conflictedColumns, random);
    return enumerateCandidateMoves(state).filter(candidate => candidate.column === chosenColumn);
  },
  crossover: (_problem, left, right, random) => {
    const pivot = Math.max(1, Math.min(left.length - 1, Math.floor(random() * left.length)));
    return [...left.slice(0, pivot), ...right.slice(pivot)];
  },
  mutate: (_problem, state, random) => {
    const column = Math.floor(random() * state.length);
    const row = Math.floor(random() * state.length);
    const next = [...state];
    next[column] = row;
    return next;
  },
  serializeState: (_problem, state) => state.join(','),
  describeState: (_problem, state) => formatState(state),
  getStateStats: (_problem, state) => {
    const conflicts = countConflicts(state);
    return [
      { label: 'Size', value: state.length },
      { label: 'Conflicts', value: conflicts },
    ];
  },
  getDomainData: (_problem, state) => ({
    conflictCounts: getConflictCountsByColumn(state),
  }),
  getPopulationMemberSummary: (_problem, state) => {
    const conflicts = countConflicts(state);
    return {
      id: state.join(','),
      summary: formatState(state),
      displayValue: `${conflicts} conflicts`,
      score: -conflicts,
      state: [...state],
    };
  },
};
