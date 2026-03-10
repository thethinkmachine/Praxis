import type { LandscapeProblem, LandscapePreset, LandscapeState } from '@/types/problem';
import type { LocalSearchCandidate, LocalSearchDomain } from './types';
import { chooseRandom } from './n-queens';

const PRESET_THRESHOLDS: Record<LandscapePreset, number> = {
  'twin-peaks': 5.5,
  ridge: 3.2,
  crater: 2.8,
  rugged: 3.2,
};

function getRanges(problem: LandscapeProblem) {
  return {
    xRange: problem.xRange ?? [-4, 4],
    yRange: problem.yRange ?? [-4, 4],
  };
}

export function validateLandscapeProblem(problem: LandscapeProblem): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  if ((problem.stepSize ?? 0.5) <= 0) {
    errors.push('Landscape step size must be positive.');
  }
  return { valid: errors.length === 0, errors };
}

export function evaluateLandscape(problem: LandscapeProblem, state: LandscapeState): number {
  const { x, y } = state;
  switch (problem.preset) {
    case 'twin-peaks':
      return 5 * Math.exp(-((x + 1.25) ** 2 + (y + 0.8) ** 2))
        + 4.2 * Math.exp(-((x - 1.8) ** 2 + (y - 1.4) ** 2) / 1.4)
        - 0.4 * (x ** 2 + y ** 2);
    case 'ridge':
      return 3.8 * Math.exp(-((y - 0.8 * Math.sin(x * 1.4)) ** 2) * 2.2) - 0.15 * x ** 2;
    case 'crater': {
      const radius = Math.sqrt(x ** 2 + y ** 2);
      return 3.6 * Math.exp(-((radius - 1.8) ** 2) * 2.5) - 0.25 * radius ** 2;
    }
    case 'rugged':
    default:
      return 2.4 * Math.sin(1.8 * x) + 2.1 * Math.cos(1.4 * y) + 0.8 * Math.sin(2.5 * (x + y)) - 0.18 * (x ** 2 + y ** 2);
  }
}

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeLandscapeState(problem: LandscapeProblem, random: () => number): LandscapeState {
  if (problem.initialState) return { ...problem.initialState };
  const { xRange, yRange } = getRanges(problem);
  return {
    x: xRange[0] + random() * (xRange[1] - xRange[0]),
    y: yRange[0] + random() * (yRange[1] - yRange[0]),
  };
}

function formatPoint(state: LandscapeState): string {
  return `(${state.x.toFixed(2)}, ${state.y.toFixed(2)})`;
}

export function enumerateLandscapeNeighbors(problem: LandscapeProblem, state: LandscapeState): LocalSearchCandidate[] {
  const stepSize = problem.stepSize ?? 0.5;
  const { xRange, yRange } = getRanges(problem);
  const currentScore = evaluateLandscape(problem, state);
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];

  return directions.map(([dx, dy], index) => {
    const next = {
      x: clamp(state.x + dx * stepSize, xRange),
      y: clamp(state.y + dy * stepSize, yRange),
    };
    const score = evaluateLandscape(problem, next);
    return {
      id: `step-${index}-${next.x.toFixed(2)}-${next.y.toFixed(2)}`,
      label: `${dx === 0 ? '' : dx > 0 ? 'E' : 'W'}${dy === 0 ? '' : dy > 0 ? 'N' : 'S'}` || 'stay',
      description: `Move to ${formatPoint(next)}.`,
      state: next,
      score,
      value: score,
      displayValue: score.toFixed(2),
      delta: score - currentScore,
      moveKey: `${next.x.toFixed(2)}:${next.y.toFixed(2)}`,
      preview: formatPoint(next),
      details: [
        `score ${score.toFixed(2)}`,
        `delta ${(score - currentScore).toFixed(2)}`,
      ],
      meta: {
        x: next.x,
        y: next.y,
      },
    };
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

export const landscapeDomain: LocalSearchDomain<LandscapeProblem, LandscapeState> = {
  kind: 'landscape',
  label: 'Landscape',
  objectiveLabel: 'Elevation',
  objectiveGoal: 'maximize',
  stateLabel: 'Position',
  validate: validateLandscapeProblem,
  createRandomState: normalizeLandscapeState,
  normalizeState: normalizeLandscapeState,
  evaluate: (problem, state) => {
    const score = evaluateLandscape(problem, state);
    return {
      score,
      value: score,
      displayValue: score.toFixed(2),
      goalReached: score >= PRESET_THRESHOLDS[problem.preset],
      summary: formatPoint(state),
      stats: [
        { label: 'x', value: state.x.toFixed(2) },
        { label: 'y', value: state.y.toFixed(2) },
      ],
    };
  },
  getNeighbors: (problem, state) => enumerateLandscapeNeighbors(problem, state),
  getRandomNeighbor: (problem, state, random) => {
    const neighbors = enumerateLandscapeNeighbors(problem, state);
    return neighbors.length > 0 ? chooseRandom(neighbors, random) : null;
  },
  crossover: (_problem, left, right) => ({
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  }),
  mutate: (problem, state, random) => {
    const step = problem.stepSize ?? 0.5;
    const { xRange, yRange } = getRanges(problem);
    return {
      x: clamp(state.x + (random() * 2 - 1) * step, xRange),
      y: clamp(state.y + (random() * 2 - 1) * step, yRange),
    };
  },
  serializeState: (_problem, state) => `${state.x.toFixed(3)},${state.y.toFixed(3)}`,
  describeState: (_problem, state) => formatPoint(state),
  getStateStats: (_problem, state) => [
    { label: 'x', value: state.x.toFixed(2) },
    { label: 'y', value: state.y.toFixed(2) },
  ],
  getDomainData: (problem, state) => ({
    preset: problem.preset,
    xRange: getRanges(problem).xRange,
    yRange: getRanges(problem).yRange,
    point: { ...state },
  }),
  getPopulationMemberSummary: (problem, state) => {
    const score = evaluateLandscape(problem, state);
    return {
      id: `${state.x.toFixed(3)},${state.y.toFixed(3)}`,
      summary: formatPoint(state),
      displayValue: score.toFixed(2),
      score,
      state: { ...state },
    };
  },
};
