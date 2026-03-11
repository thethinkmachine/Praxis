import type { AlgorithmCategory } from '@/types/algorithm';

export interface SearchLabDefinition {
  id: string;
  name: string;
  description: string;
  category: Extract<AlgorithmCategory, 'uninformed-search' | 'informed-search'>;
  status: 'live' | 'coming-soon';
  defaultAlgorithmId: string;
  path: string;
}

export const SEARCH_LAB_DEFINITIONS: SearchLabDefinition[] = [
  {
    id: 'graph-sandbox',
    name: 'Graph Sandbox',
    description: 'Build custom graphs and inspect the resulting search tree.',
    category: 'uninformed-search',
    status: 'live',
    defaultAlgorithmId: 'bfs',
    path: '/search/uninformed-search/bfs',
  },
  {
    id: 'astar-sandbox',
    name: 'Graph Sandbox',
    description: 'Test informed search on editable graphs with live g(n), h(n), and f(n) annotations.',
    category: 'informed-search',
    status: 'live',
    defaultAlgorithmId: 'astar',
    path: '/search/informed-search/astar',
  },
];

export function getSearchLabsForCategory(category: Extract<AlgorithmCategory, 'uninformed-search' | 'informed-search'>) {
  return SEARCH_LAB_DEFINITIONS.filter((lab) => lab.category === category);
}