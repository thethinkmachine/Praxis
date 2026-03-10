import type { AlgorithmCategory } from '@/types/algorithm';
import type { ProblemCategory } from '@/types/problem';

/**
 * Build the correct navigation route for an algorithm based on its category and id.
 */
export function buildRoute(
  meta: { id: string; category: AlgorithmCategory },
  problemCategory: ProblemCategory = 'graph',
): string {
  if (meta.category === 'game-playing' || problemCategory === 'game') {
    return `/play/${meta.category}/${meta.id}`;
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
