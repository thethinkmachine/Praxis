import type { LocalSearchProblem } from '@/types/problem';
import type { LocalSearchDomain } from './types';
import { nQueensDomain } from './n-queens';
import { tspDomain } from './tsp';
import { graphColoringDomain } from './graph-coloring';
import { landscapeDomain } from './landscape';
import { nPuzzleDomain } from './n-puzzle';

export const LOCAL_SEARCH_DOMAINS: Record<LocalSearchProblem['kind'], LocalSearchDomain<any, any>> = {
  'n-queens': nQueensDomain,
  tsp: tspDomain,
  'graph-coloring': graphColoringDomain,
  landscape: landscapeDomain,
  'n-puzzle': nPuzzleDomain,
};

export function getLocalSearchDomain(problem: LocalSearchProblem): LocalSearchDomain<any, any> {
  return LOCAL_SEARCH_DOMAINS[problem.kind];
}
