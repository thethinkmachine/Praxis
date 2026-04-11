import type { AlgorithmCategory } from '@/types/algorithm';
import { CSP_LAB_DEFINITIONS } from '@/problems/csp/labs';
import { GAME_PLAYING_LAB_DEFINITIONS } from '@/problems/game-playing/labs';
import { LOCAL_SEARCH_LAB_DEFINITIONS } from '@/problems/local-search/labs';
import { MAZE_LAB_DEFINITIONS } from '@/problems/maze/labs';
import { PLANNING_LAB_DEFINITIONS } from '@/problems/planning/labs';
import { SEARCH_LAB_DEFINITIONS } from '@/problems/search/labs';

export type DiscoveryItemStatus = 'live' | 'coming-soon';
export type DiscoveryItemKind = 'game' | 'sandbox' | 'lab';

export interface DiscoveryItem {
  id: string;
  name: string;
  description: string;
  path?: string;
  status: DiscoveryItemStatus;
  kind: DiscoveryItemKind;
}

export type DiscoveryItemsByCategory = Partial<Record<AlgorithmCategory, DiscoveryItem[]>>;

export const DISCOVERY_ITEMS_BY_CATEGORY: DiscoveryItemsByCategory = {
  'uninformed-search': [
    ...MAZE_LAB_DEFINITIONS.filter((entry) => entry.category === 'uninformed-search').map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      path: entry.path,
      status: entry.status,
      kind: 'game' as const,
    })),
    ...SEARCH_LAB_DEFINITIONS.filter((entry) => entry.category === 'uninformed-search').map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      path: entry.path,
      status: entry.status,
      kind: 'sandbox' as const,
    })),
  ],
  'informed-search': [
    ...MAZE_LAB_DEFINITIONS.filter((entry) => entry.category === 'informed-search').map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      path: entry.path,
      status: entry.status,
      kind: 'game' as const,
    })),
    ...SEARCH_LAB_DEFINITIONS.filter((entry) => entry.category === 'informed-search').map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      path: entry.path,
      status: entry.status,
      kind: 'sandbox' as const,
    })),
  ],
  'game-playing': GAME_PLAYING_LAB_DEFINITIONS.map((entry) => ({
    id: `${entry.id}-lab`,
    name: entry.name,
    description: entry.description,
    path: entry.path,
    status: entry.status,
    kind: 'game' as const,
  })),
  'local-search': LOCAL_SEARCH_LAB_DEFINITIONS.map((entry) => ({
    id: `${entry.id}-lab`,
    name: `${entry.name} Lab`,
    description: entry.description,
    path: entry.path,
    status: 'live' as const,
    kind: 'lab' as const,
  })),
  planning: PLANNING_LAB_DEFINITIONS.map((entry) => ({
    id: `${entry.id}-lab`,
    name: entry.name,
    description: entry.description,
    path: entry.path,
    status: 'live' as const,
    kind: 'lab' as const,
  })),
  'constraint-satisfaction': CSP_LAB_DEFINITIONS.map((entry) => ({
    id: `${entry.id}-lab`,
    name: entry.name,
    description: entry.description,
    path: entry.path,
    status: 'live' as const,
    kind: 'lab' as const,
  })),
};

export function getDiscoveryItemsForCategory(category: AlgorithmCategory): DiscoveryItem[] {
  return DISCOVERY_ITEMS_BY_CATEGORY[category] ?? [];
}
