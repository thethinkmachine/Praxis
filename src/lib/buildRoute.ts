import type { AlgorithmCategory } from '@/types/algorithm';
import type { ProblemCategory } from '@/types/problem';
import { buildGamePlayingRoute, getDefaultGamePlayingLabId, type GamePlayingLabId } from '@/problems/game-playing/labs';

interface BuildRouteOptions {
  gameLabId?: GamePlayingLabId;
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
