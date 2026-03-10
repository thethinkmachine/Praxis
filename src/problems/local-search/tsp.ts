import type { TspCity, TspProblem } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchDomain } from './types';
import { chooseRandom } from './n-queens';

export function validateTspProblem(problem: TspProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  if (problem.cities.length < 4) {
    errors.push('TSP needs at least 4 cities.');
  }
  if (problem.initialRoute) {
    const isPermutation = problem.initialRoute.length === problem.cities.length &&
      new Set(problem.initialRoute).size === problem.cities.length &&
      problem.initialRoute.every(i => i >= 0 && i < problem.cities.length);
    if (!isPermutation) {
      errors.push('Initial route must include every city exactly once.');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function routeDistance(cities: TspCity[], route: number[]): number {
  if (route.length < 2) return 0;
  let total = 0;
  for (let index = 0; index < route.length; index++) {
    const current = cities[route[index]];
    const next = cities[route[(index + 1) % route.length]];
    total += Math.hypot(current.x - next.x, current.y - next.y);
  }
  return total;
}

export function formatRoute(problem: TspProblem, route: number[]): string {
  return route.map(index => problem.cities[index]?.label ?? problem.cities[index]?.id ?? `C${index + 1}`).join(' -> ');
}

export function normalizeRoute(problem: TspProblem, random: () => number): number[] {
  const count = problem.cities.length;
  if (problem.initialRoute?.length === count) {
    return [...problem.initialRoute];
  }
  const route = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [route[index], route[swapIndex]] = [route[swapIndex], route[index]];
  }
  if (problem.fixedStart) {
    const startIndex = route.indexOf(0);
    if (startIndex > 0) {
      route.splice(startIndex, 1);
      route.unshift(0);
    }
  }
  return route;
}

function swapRoute(route: number[], first: number, second: number): number[] {
  const next = [...route];
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

function insertRoute(route: number[], from: number, to: number): number[] {
  const next = [...route];
  const [city] = next.splice(from, 1);
  next.splice(to, 0, city);
  return next;
}

function reverseSegment(route: number[], left: number, right: number): number[] {
  return [...route.slice(0, left), ...route.slice(left, right + 1).reverse(), ...route.slice(right + 1)];
}

export function enumerateTspNeighbors(problem: TspProblem, route: number[]): LocalSearchCandidate[] {
  const currentDistance = routeDistance(problem.cities, route);
  const mode = problem.neighborhoodMode ?? 'swap';
  const candidates: LocalSearchCandidate[] = [];
  const start = problem.fixedStart ? 1 : 0;

  for (let first = start; first < route.length; first++) {
    for (let second = first + 1; second < route.length; second++) {
      const next = mode === 'insert'
        ? insertRoute(route, first, second)
        : mode === 'two-opt'
          ? reverseSegment(route, first, second)
          : swapRoute(route, first, second);
      const distance = routeDistance(problem.cities, next);
      candidates.push({
        id: `${mode}-${first}-${second}`,
        label: mode === 'insert'
          ? `Insert ${first + 1} -> ${second + 1}`
          : mode === 'two-opt'
            ? `Reverse ${first + 1}-${second + 1}`
            : `Swap ${first + 1} <-> ${second + 1}`,
        description: `Tour length becomes ${distance.toFixed(1)}.`,
        state: next,
        score: -distance,
        value: distance,
        displayValue: distance.toFixed(1),
        delta: currentDistance - distance,
        moveKey: `${first}:${second}`,
        preview: formatRoute(problem, next),
        details: [
          `distance ${distance.toFixed(1)}`,
          `delta ${(currentDistance - distance).toFixed(1)}`,
          mode,
        ],
        meta: {
          first,
          second,
          mode,
          distance,
        },
      });
    }
  }

  candidates.sort((a, b) => b.delta - a.delta || a.value - b.value || a.label.localeCompare(b.label));
  return candidates;
}

export const tspDomain: LocalSearchDomain<TspProblem, number[]> = {
  kind: 'tsp',
  label: 'TSP / Route',
  objectiveLabel: 'Tour Length',
  objectiveGoal: 'minimize',
  stateLabel: 'Route',
  validate: validateTspProblem,
  createRandomState: normalizeRoute,
  normalizeState: normalizeRoute,
  evaluate: (problem, state) => {
    const distance = routeDistance(problem.cities, state);
    return {
      score: -distance,
      value: distance,
      displayValue: distance.toFixed(1),
      goalReached: false,
      summary: formatRoute(problem, state),
      stats: [
        { label: 'Cities', value: problem.cities.length },
        { label: 'Distance', value: distance.toFixed(1) },
      ],
    };
  },
  getNeighbors: (problem, state) => enumerateTspNeighbors(problem, state),
  getRandomNeighbor: (problem, state, random) => {
    const neighbors = enumerateTspNeighbors(problem, state);
    return neighbors.length > 0 ? chooseRandom(neighbors, random) : null;
  },
  crossover: (problem, left, right, random) => {
    const size = left.length;
    const start = problem.fixedStart ? 1 : 0;
    const cutA = start + Math.floor(random() * Math.max(size - start - 1, 1));
    const cutB = cutA + Math.floor(random() * Math.max(size - cutA, 1));
    const child = Array<number>(size).fill(-1);
    for (let index = cutA; index < cutB; index++) child[index] = left[index];
    let writeIndex = start;
    for (const city of right) {
      if (problem.fixedStart && city === 0) continue;
      if (child.includes(city)) continue;
      while (child[writeIndex] !== -1) writeIndex++;
      child[writeIndex] = city;
    }
    if (problem.fixedStart) child[0] = 0;
    return child;
  },
  mutate: (problem, state, random) => {
    const start = problem.fixedStart ? 1 : 0;
    const first = start + Math.floor(random() * Math.max(state.length - start, 1));
    const second = start + Math.floor(random() * Math.max(state.length - start, 1));
    return swapRoute(state, Math.min(first, second), Math.max(first, second));
  },
  serializeState: (_problem, state) => state.join(','),
  describeState: (problem, state) => formatRoute(problem, state),
  getStateStats: (problem, state) => [
    { label: 'Distance', value: routeDistance(problem.cities, state).toFixed(1) },
    { label: 'Mode', value: problem.neighborhoodMode ?? 'swap' },
  ],
  getDomainData: (problem, state) => ({
    orderedCities: state.map(index => problem.cities[index]),
  }),
  getPopulationMemberSummary: (problem, state) => {
    const distance = routeDistance(problem.cities, state);
    return {
      id: state.join(','),
      summary: formatRoute(problem, state),
      displayValue: distance.toFixed(1),
      score: -distance,
      state: [...state],
    };
  },
};
