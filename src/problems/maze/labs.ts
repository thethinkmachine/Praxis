import type { AlgorithmCategory } from '@/types/algorithm';

export interface MazeLabDefinition {
  id: string;
  name: string;
  description: string;
  category: Extract<AlgorithmCategory, 'uninformed-search' | 'informed-search'>;
  status: 'live' | 'coming-soon';
  defaultAlgorithmId: string;
  defaultDemoId?: string;
  path: string;
}

export const MAZE_LAB_DEFINITIONS: MazeLabDefinition[] = [
  {
    id: 'maze-lab',
    name: 'Maze',
    description: 'Design mazes, tune terrain costs, and watch frontier growth step-by-step.',
    category: 'uninformed-search',
    status: 'live',
    defaultAlgorithmId: 'bfs',
    defaultDemoId: 'labyrinth',
    path: '/maze/bfs',
  },
  {
    id: 'heuristic-maze',
    name: 'Maze',
    description: 'Play the maze with heuristic-guided search such as A* and Greedy Best-First.',
    category: 'informed-search',
    status: 'live',
    defaultAlgorithmId: 'astar',
    defaultDemoId: 'weighted-terrain',
    path: '/maze/astar',
  },
];

export function getMazeLabsForCategory(category: Extract<AlgorithmCategory, 'uninformed-search' | 'informed-search'>) {
  return MAZE_LAB_DEFINITIONS.filter((lab) => lab.category === category);
}