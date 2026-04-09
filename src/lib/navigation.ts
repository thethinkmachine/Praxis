import type { AlgorithmCategory, AlgorithmMeta } from '@/types';
import { registry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/constants';
import { GAME_PLAYING_LAB_DEFINITIONS } from '@/problems/game-playing/labs';
import { LOCAL_SEARCH_LAB_DEFINITIONS } from '@/problems/local-search/labs';
import { MAZE_LAB_DEFINITIONS } from '@/problems/maze/labs';
import { SEARCH_LAB_DEFINITIONS } from '@/problems/search/labs';

export interface HomeDestination {
  id: 'algorithms' | 'games' | 'graph';
  label: string;
  to: string;
  icon: 'search' | 'gamepad2' | 'network';
}

export interface NavigationAlgorithmEntry {
  id: string;
  name: string;
  path: string;
}

export interface NavigationCategoryGroup {
  category: AlgorithmCategory;
  displayName: string;
  iconToken: string;
  algorithms: NavigationAlgorithmEntry[];
}

export const HOME_DESTINATIONS: HomeDestination[] = [
  { id: 'algorithms', label: 'Algorithms', to: '/', icon: 'search' },
  { id: 'games', label: 'Playgrounds', to: '/?tab=games', icon: 'gamepad2' },
  { id: 'graph', label: 'Graph', to: '/?tab=graph', icon: 'network' },
];

const CATEGORY_ICON_TOKENS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'DIR',
  'informed-search': 'H*',
  'game-playing': 'MINMAX',
  'local-search': 'LS',
};

const STATIC_SEGMENT_LABELS: Record<string, string> = {
  search: 'Search',
  play: 'Play',
  maze: 'Maze',
  taxonomy: 'Taxonomy',
  local: 'Local Search',
  'uninformed-search': CATEGORY_LABELS['uninformed-search'],
  'informed-search': CATEGORY_LABELS['informed-search'],
  'game-playing': CATEGORY_LABELS['game-playing'],
  'local-search': CATEGORY_LABELS['local-search'],
};

function sortAlgorithmsByRegistrationOrder(algorithms: AlgorithmMeta[]): AlgorithmMeta[] {
  return [...algorithms];
}

export function getNavigationCategoryGroups(): NavigationCategoryGroup[] {
  return CATEGORY_ORDER.map((category) => {
    const algorithms = sortAlgorithmsByRegistrationOrder(
      registry.getByCategory(category).map((entry) => entry.runner.meta),
    );

    return {
      category,
      displayName: CATEGORY_LABELS[category],
      iconToken: CATEGORY_ICON_TOKENS[category],
      algorithms: algorithms.map((meta) => ({
        id: meta.id,
        name: meta.shortName ?? meta.name,
        path: buildRoute(
          meta,
          meta.category === 'game-playing'
            ? 'game'
            : meta.category === 'local-search'
              ? 'local-search'
              : 'graph',
        ),
      })),
    };
  });
}

function getModuleSegmentLabel(segment: string): string | null {
  const gameLab = GAME_PLAYING_LAB_DEFINITIONS.find((lab) => lab.id === segment);
  if (gameLab) return gameLab.name;

  const localLab = LOCAL_SEARCH_LAB_DEFINITIONS.find((lab) => lab.id === segment);
  if (localLab) return localLab.name;

  const mazeLab = MAZE_LAB_DEFINITIONS.find((lab) => lab.id === segment);
  if (mazeLab) return mazeLab.name;

  const searchLab = SEARCH_LAB_DEFINITIONS.find((lab) => lab.id === segment);
  if (searchLab) return searchLab.name;

  return null;
}

export function getNavigationSegmentLabel(segment: string): string {
  if (STATIC_SEGMENT_LABELS[segment]) {
    return STATIC_SEGMENT_LABELS[segment];
  }

  const algorithm = registry.get(segment)?.runner.meta;
  if (algorithm) {
    return algorithm.shortName ?? algorithm.name;
  }

  const moduleLabel = getModuleSegmentLabel(segment);
  if (moduleLabel) {
    return moduleLabel;
  }

  return segment.replace(/-/g, ' ');
}
