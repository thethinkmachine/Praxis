import type { AlgorithmCategory } from '@/types/algorithm';

/**
 * Build the correct navigation route for an algorithm based on its category and id.
 */
export function buildRoute(meta: { id: string; category: AlgorithmCategory }): string {
  if (meta.category === 'uninformed-search') {
    return `/search/uninformed-search/${meta.id}`;
  }
  if (meta.category === 'informed-search') {
    return `/search/informed-search/${meta.id}`;
  }
  return '/';
}
