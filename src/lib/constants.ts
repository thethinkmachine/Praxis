import type { AlgorithmCategory } from '@/types/algorithm';

export const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'Uninformed Search',
  'informed-search': 'Informed Search',
  'game-playing': 'Game Playing',
};

export const CATEGORY_ORDER: AlgorithmCategory[] = [
  'uninformed-search',
  'informed-search',
  'game-playing',
];
