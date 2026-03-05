import type { AlgorithmCategory } from '@/types/algorithm';

export const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'Uninformed Search',
  'informed-search': 'Informed Search',
};

export const CATEGORY_ORDER: AlgorithmCategory[] = [
  'uninformed-search',
  'informed-search',
];
