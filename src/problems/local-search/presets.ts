import { Graph, type GraphEdge, type GraphNode, type GraphColoringProblem, type LandscapePreset, type LandscapeProblem, type LocalSearchProblem, type NPuzzleProblem, type NQueensProblem, type TspCity, type TspProblem } from '@/types/problem';
import { createSeededRandom } from './n-queens';
import { scrambleTiles } from './n-puzzle';

export interface LocalSearchLabDefinition {
  id: LocalSearchProblem['kind'];
  name: string;
  description: string;
}

export const LOCAL_SEARCH_LABS: LocalSearchLabDefinition[] = [
  {
    id: 'n-queens',
    name: 'N-Queens',
    description: 'Conflict-driven discrete local search with clear local maxima, plateaus, and repair behavior.',
  },
  {
    id: 'tsp',
    name: 'TSP / Route',
    description: 'Tour optimization over Euclidean city layouts using swap, 2-opt, or insertion neighborhoods.',
  },
  {
    id: 'graph-coloring',
    name: 'Graph Coloring',
    description: 'Constraint satisfaction over sparse graphs, useful for tabu search and min-conflicts.',
  },
  {
    id: 'landscape',
    name: 'Landscape',
    description: 'A continuous objective surface for making ridges, plateaus, and annealing behavior visible.',
  },
  {
    id: 'n-puzzle',
    name: 'N-Puzzle',
    description: 'A crossover lab that contrasts heuristic local search behavior with a classic state-space problem.',
  },
];

export function createDefaultNQueensProblem(size = 8): NQueensProblem {
  return {
    kind: 'n-queens',
    size,
    randomSeed: 1337,
    maxSteps: 160,
    sidewaysMoveLimit: 12,
    restartLimit: 8,
    candidateSampleSize: 8,
    beamWidth: 4,
    tabuTenure: 7,
    populationSize: 18,
    mutationRate: 0.18,
    crossoverRate: 0.85,
    initialTemperature: 12,
    coolingRate: 0.94,
  };
}

function createTspCities(count: number, seed = 1337): TspCity[] {
  const random = createSeededRandom(seed);
  const radius = 180;
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    const wobble = 0.72 + random() * 0.5;
    return {
      id: `C${index + 1}`,
      label: `C${index + 1}`,
      x: Math.cos(angle) * radius * wobble,
      y: Math.sin(angle) * radius * wobble + (random() * 48 - 24),
    };
  });
}

export function createDefaultTspProblem(cityCount = 9): TspProblem {
  return {
    kind: 'tsp',
    cities: createTspCities(cityCount),
    randomSeed: 1337,
    maxSteps: 120,
    candidateSampleSize: 8,
    beamWidth: 4,
    tabuTenure: 8,
    populationSize: 18,
    mutationRate: 0.22,
    crossoverRate: 0.88,
    initialTemperature: 15,
    coolingRate: 0.95,
    neighborhoodMode: 'two-opt',
    fixedStart: true,
  };
}

function circleNodes(count: number): GraphNode[] {
  const radius = 180;
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return {
      id: `N${index + 1}`,
      label: `N${index + 1}`,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

function denseColoringEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const next = (index + 1) % nodes.length;
    const skip = (index + 2) % nodes.length;
    edges.push({ id: `e-${index}-${next}`, source: nodes[index].id, target: nodes[next].id, weight: 1 });
    if (skip !== next) edges.push({ id: `e-${index}-${skip}`, source: nodes[index].id, target: nodes[skip].id, weight: 1 });
  }
  return edges;
}

export function createDefaultGraphColoringProblem(nodeCount = 8): GraphColoringProblem {
  const nodes = circleNodes(nodeCount);
  return {
    kind: 'graph-coloring',
    graph: new Graph({
      directed: false,
      nodes,
      edges: denseColoringEdges(nodes),
    }),
    colorCount: 3,
    randomSeed: 1337,
    maxSteps: 140,
    candidateSampleSize: 10,
    beamWidth: 4,
    tabuTenure: 8,
    populationSize: 18,
    mutationRate: 0.18,
    crossoverRate: 0.8,
    initialTemperature: 10,
    coolingRate: 0.94,
  };
}

export function createDefaultLandscapeProblem(preset: LandscapePreset = 'twin-peaks'): LandscapeProblem {
  return {
    kind: 'landscape',
    preset,
    xRange: [-4, 4],
    yRange: [-4, 4],
    stepSize: 0.45,
    randomSeed: 1337,
    maxSteps: 120,
    candidateSampleSize: 8,
    beamWidth: 4,
    tabuTenure: 6,
    populationSize: 16,
    mutationRate: 0.24,
    crossoverRate: 0.8,
    initialTemperature: 9,
    coolingRate: 0.95,
  };
}

export function createDefaultNPuzzleProblem(size: 3 | 4 = 3): NPuzzleProblem {
  const seed = 1337;
  const random = createSeededRandom(seed);
  return {
    kind: 'n-puzzle',
    size,
    tiles: scrambleTiles({ kind: 'n-puzzle', size, tiles: [], randomSeed: seed }, random),
    randomSeed: seed,
    maxSteps: 120,
    candidateSampleSize: 6,
    beamWidth: 4,
    tabuTenure: 8,
    populationSize: 16,
    mutationRate: 0.16,
    crossoverRate: 0.8,
    initialTemperature: 8,
    coolingRate: 0.95,
    heuristic: 'combined',
    scrambleMoves: size === 4 ? 32 : 18,
  };
}

export function createDefaultLocalSearchProblem(kind: LocalSearchProblem['kind']): LocalSearchProblem {
  switch (kind) {
    case 'n-queens':
      return createDefaultNQueensProblem();
    case 'tsp':
      return createDefaultTspProblem();
    case 'graph-coloring':
      return createDefaultGraphColoringProblem();
    case 'landscape':
      return createDefaultLandscapeProblem();
    case 'n-puzzle':
      return createDefaultNPuzzleProblem();
  }
}
