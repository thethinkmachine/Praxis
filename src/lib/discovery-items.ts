import type { AlgorithmCategory } from '@/types/algorithm';
import { CSP_LAB_DEFINITIONS } from '@/problems/csp/labs';
import { GAME_PLAYING_LAB_DEFINITIONS } from '@/problems/game-playing/labs';
import { LOCAL_SEARCH_LAB_DEFINITIONS } from '@/problems/local-search/labs';
import { MAZE_LAB_DEFINITIONS } from '@/problems/maze/labs';
import { PLANNING_LAB_DEFINITIONS } from '@/problems/planning/labs';
import { SEARCH_LAB_DEFINITIONS } from '@/problems/search/labs';

export type DiscoveryItemStatus = 'live' | 'coming-soon';

/**
 * Every interactive module is a "playground": the editor for one algorithm
 * family where you set up a custom problem and step through it. We used to split
 * these into game / sandbox / lab, but that distinction was cosmetic — there is
 * one concept, surfaced uniformly. Keep it that way.
 */
export type DiscoveryItemKind = 'playground';

export interface DiscoveryItem {
  id: string;
  name: string;
  description: string;
  path?: string;
  status: DiscoveryItemStatus;
  kind: DiscoveryItemKind;
}

export type DiscoveryItemsByCategory = Partial<Record<AlgorithmCategory, DiscoveryItem[]>>;

interface SourceDefinition {
  id: string;
  name: string;
  description: string;
  path?: string;
  status?: DiscoveryItemStatus;
}

/**
 * Uniform mapping from a family's lab registry to discovery items. The aggregator
 * stays dumb: every family is surfaced the same way, with the same `playground`
 * kind. The only per-family knob is an optional id suffix used to disambiguate
 * module ids from their underlying lab ids.
 */
function toDiscoveryItems(
  defs: SourceDefinition[],
  options: { idSuffix?: string } = {},
): DiscoveryItem[] {
  const { idSuffix = '' } = options;
  return defs.map((def) => ({
    id: `${def.id}${idSuffix}`,
    name: def.name,
    description: def.description,
    path: def.path,
    status: def.status ?? 'live',
    kind: 'playground' as const,
  }));
}

export const DISCOVERY_ITEMS_BY_CATEGORY: DiscoveryItemsByCategory = {
  'uninformed-search': [
    ...toDiscoveryItems(MAZE_LAB_DEFINITIONS.filter((entry) => entry.category === 'uninformed-search')),
    ...toDiscoveryItems(SEARCH_LAB_DEFINITIONS.filter((entry) => entry.category === 'uninformed-search')),
  ],
  'informed-search': [
    ...toDiscoveryItems(MAZE_LAB_DEFINITIONS.filter((entry) => entry.category === 'informed-search')),
    ...toDiscoveryItems(SEARCH_LAB_DEFINITIONS.filter((entry) => entry.category === 'informed-search')),
  ],
  'game-playing': toDiscoveryItems(GAME_PLAYING_LAB_DEFINITIONS, { idSuffix: '-lab' }),
  'local-search': toDiscoveryItems(LOCAL_SEARCH_LAB_DEFINITIONS, { idSuffix: '-lab' }),
  planning: toDiscoveryItems(PLANNING_LAB_DEFINITIONS, { idSuffix: '-lab' }),
  'constraint-satisfaction': toDiscoveryItems(CSP_LAB_DEFINITIONS, { idSuffix: '-lab' }),
};

export function getDiscoveryItemsForCategory(category: AlgorithmCategory): DiscoveryItem[] {
  return DISCOVERY_ITEMS_BY_CATEGORY[category] ?? [];
}
