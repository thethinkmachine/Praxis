import type { LocalSearchProblem } from '@/types/problem';

export function createLocalSearchFixtureBuilder<TProblem extends LocalSearchProblem>(baseProblem: TProblem) {
  return function buildFixture(overrides: Partial<TProblem> = {}): TProblem {
    return {
      ...baseProblem,
      ...overrides,
    };
  };
}