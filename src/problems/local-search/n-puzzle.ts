import type { NPuzzleProblem } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchDomain } from './types';
import { chooseRandom } from './n-queens';

function goalTiles(size: number): number[] {
  return Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size));
}

export function validateNPuzzleProblem(problem: NPuzzleProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const expected = problem.size * problem.size;
  if (problem.tiles.length !== expected) {
    errors.push(`N-Puzzle tiles must contain exactly ${expected} entries.`);
  }
  const sorted = [...problem.tiles].sort((a, b) => a - b);
  const expectedTiles = Array.from({ length: expected }, (_, index) => index);
  if (sorted.length === expected && sorted.some((tile, index) => tile !== expectedTiles[index])) {
    errors.push('N-Puzzle tiles must contain each number from 0 to N² - 1 exactly once.');
  }
  return { valid: errors.length === 0, errors };
}

function blankIndex(tiles: number[]): number {
  return tiles.indexOf(0);
}

function moveBlank(tiles: number[], first: number, second: number): number[] {
  const next = [...tiles];
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

function getNeighborIndices(size: number, index: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors: number[] = [];
  if (row > 0) neighbors.push(index - size);
  if (row < size - 1) neighbors.push(index + size);
  if (col > 0) neighbors.push(index - 1);
  if (col < size - 1) neighbors.push(index + 1);
  return neighbors;
}

export function scrambleTiles(problem: NPuzzleProblem, random: () => number): number[] {
  let tiles = goalTiles(problem.size);
  const moves = problem.scrambleMoves ?? (problem.size === 4 ? 28 : 18);
  for (let step = 0; step < moves; step++) {
    const blank = blankIndex(tiles);
    const neighbors = getNeighborIndices(problem.size, blank);
    const nextIndex = chooseRandom(neighbors, random);
    tiles = moveBlank(tiles, blank, nextIndex);
  }
  return tiles;
}

export function normalizeTiles(problem: NPuzzleProblem, random: () => number): number[] {
  return problem.tiles.length === problem.size * problem.size
    ? [...problem.tiles]
    : scrambleTiles(problem, random);
}

export function misplacedTiles(problem: NPuzzleProblem, tiles: number[]): number {
  const goal = goalTiles(problem.size);
  let misplaced = 0;
  for (let index = 0; index < tiles.length; index++) {
    if (tiles[index] !== 0 && tiles[index] !== goal[index]) misplaced++;
  }
  return misplaced;
}

export function manhattanDistance(problem: NPuzzleProblem, tiles: number[]): number {
  let total = 0;
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];
    if (tile === 0) continue;
    const goalIndex = tile - 1;
    total += Math.abs(Math.floor(index / problem.size) - Math.floor(goalIndex / problem.size));
    total += Math.abs((index % problem.size) - (goalIndex % problem.size));
  }
  return total;
}

function heuristicValue(problem: NPuzzleProblem, tiles: number[]): number {
  const heuristic = problem.heuristic ?? 'combined';
  if (heuristic === 'misplaced') return misplacedTiles(problem, tiles);
  if (heuristic === 'manhattan') return manhattanDistance(problem, tiles);
  return manhattanDistance(problem, tiles) + misplacedTiles(problem, tiles) * 0.5;
}

function formatTiles(problem: NPuzzleProblem, tiles: number[]): string {
  const rows: string[] = [];
  for (let row = 0; row < problem.size; row++) {
    rows.push(tiles.slice(row * problem.size, (row + 1) * problem.size).join(' '));
  }
  return rows.join(' | ');
}

export function enumerateNPuzzleNeighbors(problem: NPuzzleProblem, tiles: number[]): LocalSearchCandidate[] {
  const blank = blankIndex(tiles);
  const currentHeuristic = heuristicValue(problem, tiles);
  return getNeighborIndices(problem.size, blank).map(nextIndex => {
    const next = moveBlank(tiles, blank, nextIndex);
    const heuristic = heuristicValue(problem, next);
    return {
      id: `blank-${blank}-${nextIndex}`,
      label: `Slide ${tiles[nextIndex]}`,
      description: `Move tile ${tiles[nextIndex]} into the blank.`,
      state: next,
      score: -heuristic,
      value: heuristic,
      displayValue: heuristic.toFixed(1),
      delta: currentHeuristic - heuristic,
      moveKey: `${blank}:${nextIndex}`,
      preview: formatTiles(problem, next),
      details: [
        `heuristic ${heuristic.toFixed(1)}`,
        `delta ${(currentHeuristic - heuristic).toFixed(1)}`,
      ],
      meta: {
        blank,
        movedTile: tiles[nextIndex],
        targetIndex: nextIndex,
      },
    };
  }).sort((a, b) => b.delta - a.delta || a.value - b.value || a.label.localeCompare(b.label));
}

export const nPuzzleDomain: LocalSearchDomain<NPuzzleProblem, number[]> = {
  kind: 'n-puzzle',
  label: 'N-Puzzle',
  objectiveLabel: 'Heuristic Cost',
  objectiveGoal: 'minimize',
  stateLabel: 'Board',
  validate: validateNPuzzleProblem,
  createRandomState: scrambleTiles,
  normalizeState: normalizeTiles,
  evaluate: (problem, state) => {
    const value = heuristicValue(problem, state);
    return {
      score: -value,
      value,
      displayValue: value.toFixed(1),
      goalReached: value === 0,
      summary: formatTiles(problem, state),
      stats: [
        { label: 'Manhattan', value: manhattanDistance(problem, state) },
        { label: 'Misplaced', value: misplacedTiles(problem, state) },
      ],
    };
  },
  getNeighbors: (problem, state) => enumerateNPuzzleNeighbors(problem, state),
  getRandomNeighbor: (problem, state, random) => {
    const neighbors = enumerateNPuzzleNeighbors(problem, state);
    return neighbors.length > 0 ? chooseRandom(neighbors, random) : null;
  },
  serializeState: (_problem, state) => state.join(','),
  describeState: (problem, state) => formatTiles(problem, state),
  getStateStats: (problem, state) => [
    { label: 'Heuristic', value: heuristicValue(problem, state).toFixed(1) },
    { label: 'Blank', value: blankIndex(state) + 1 },
  ],
  getDomainData: (_problem, state) => ({
    blankIndex: blankIndex(state),
  }),
  getPopulationMemberSummary: (problem, state) => {
    const value = heuristicValue(problem, state);
    return {
      id: state.join(','),
      summary: formatTiles(problem, state),
      displayValue: value.toFixed(1),
      score: -value,
      state: [...state],
    };
  },
};
