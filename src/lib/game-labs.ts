import type { AlgorithmCategory } from '@/types/algorithm';

export type GameLabStatus = 'live' | 'coming-soon';

export interface GameLab {
  id: string;
  name: string;
  description: string;
  path?: string;
  status: GameLabStatus;
}

export type GameLabsByCategory = Partial<Record<AlgorithmCategory, GameLab[]>>;

// Central registry for game-style labs surfaced on the Home "Games" tab.
// Add future categories/labs here without touching UI components.
export const GAME_LABS: GameLabsByCategory = {
  'uninformed-search': [
    {
      id: 'maze-lab',
      name: 'Maze Lab',
      description: 'Design mazes, tune terrain costs, and watch frontier growth step-by-step.',
      path: '/maze/bfs',
      status: 'live',
    },
    {
      id: 'search-sandbox',
      name: 'Graph Sandbox',
      description: 'Build custom graphs and inspect the resulting search tree.',
      path: '/search/uninformed-search/bfs',
      status: 'live',
    },
  ],
  'informed-search': [
    {
      id: 'heuristic-maze',
      name: 'Heuristic Maze',
      description: 'Watch A* and Greedy Best-First navigate mazes guided by Manhattan-distance heuristics.',
      path: '/maze/astar',
      status: 'live',
    },
    {
      id: 'astar-sandbox',
      name: 'A* Sandbox',
      description: 'Explore heuristic search on the Romania map and weighted grids with live f/g/h annotations.',
      path: '/search/informed-search/astar',
      status: 'live',
    },
  ],
  'game-playing': [
    {
      id: 'tic-tac-toe-lab',
      name: 'Tic-Tac-Toe Lab',
      description: 'Set up board positions and inspect adversarial search with Minimax, Alpha-Beta, and Negamax.',
      path: '/play/game-playing/minimax',
      status: 'live',
    },
  ],
};

export function getLabsForCategory(category: AlgorithmCategory): GameLab[] {
  return GAME_LABS[category] ?? [];
}
