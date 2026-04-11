import type { AlgorithmCategory } from '@/types/algorithm';
import type { CspLabId, PlanningLabId, ProblemCategory } from '@/types/problem';
import { buildGamePlayingRoute, getDefaultGamePlayingLabId, type GamePlayingLabId } from '@/problems/game-playing/labs';
import { buildPlanningRoute, getDefaultPlanningLabForAlgorithm } from '@/problems/planning/labs';
import { buildCspRoute, getDefaultCspLabForAlgorithm } from '@/problems/csp/labs';

interface BuildRouteOptions {
  gameLabId?: GamePlayingLabId;
  planningLabId?: PlanningLabId;
  cspLabId?: CspLabId;
}

/**
 * Build the correct navigation route for an algorithm based on its category and id.
 */
export function buildRoute(
  meta: { id: string; category: AlgorithmCategory },
  problemCategory: ProblemCategory = 'graph',
  options?: BuildRouteOptions,
): string {
  if (meta.category === 'game-playing' || problemCategory === 'game') {
    return buildGamePlayingRoute(options?.gameLabId ?? getDefaultGamePlayingLabId(), meta.id);
  }
  if (meta.category === 'local-search' || problemCategory === 'local-search') {
    return `/local/${meta.id}`;
  }
  if (meta.category === 'planning' || problemCategory === 'planning') {
    return buildPlanningRoute(meta.id, options?.planningLabId ?? getDefaultPlanningLabForAlgorithm(meta.id));
  }
  if (meta.category === 'constraint-satisfaction' || problemCategory === 'constraint-satisfaction') {
    return buildCspRoute(meta.id, options?.cspLabId ?? getDefaultCspLabForAlgorithm(meta.id));
  }
  if (problemCategory === 'maze') {
    return `/maze/${meta.id}`;
  }
  if (meta.category === 'uninformed-search') {
    return `/search/uninformed-search/${meta.id}`;
  }
  if (meta.category === 'informed-search') {
    return `/search/informed-search/${meta.id}`;
  }
  return '/';
}
