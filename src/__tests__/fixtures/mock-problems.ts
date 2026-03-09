import { Graph, type GraphData, type GraphProblem } from '@/types/problem';

export const simpleGraphData: GraphData = {
  directed: false,
  nodes: [
    { id: 'S', label: 'S', x: 80,  y: 80,  heuristic: 4 },
    { id: 'A', label: 'A', x: 240, y: 80,  heuristic: 3 },
    { id: 'B', label: 'B', x: 80,  y: 220, heuristic: 3 },
    { id: 'C', label: 'C', x: 400, y: 80,  heuristic: 2 },
    { id: 'D', label: 'D', x: 560, y: 80,  heuristic: 2 },
    { id: 'E', label: 'E', x: 240, y: 220, heuristic: 2 },
    { id: 'F', label: 'F', x: 560, y: 220, heuristic: 1 },
    { id: 'G', label: 'G', x: 320, y: 340, heuristic: 0 },
  ],
  edges: [
    { id: 'e-S-A', source: 'S', target: 'A', weight: 1 },
    { id: 'e-S-B', source: 'S', target: 'B', weight: 1 },
    { id: 'e-A-C', source: 'A', target: 'C', weight: 1 },
    { id: 'e-A-E', source: 'A', target: 'E', weight: 2 },
    { id: 'e-C-D', source: 'C', target: 'D', weight: 1 },
    { id: 'e-D-F', source: 'D', target: 'F', weight: 1 },
    { id: 'e-B-G', source: 'B', target: 'G', weight: 2 },
    { id: 'e-E-G', source: 'E', target: 'G', weight: 2 },
    { id: 'e-F-G', source: 'F', target: 'G', weight: 2 },
  ],
};

export const simpleGraphProblem: GraphProblem = {
  graph: new Graph(simpleGraphData),
  startNode: 'S',
  goalNode: 'G',
  useHeuristic: false,
};

export const romaniaMapData: GraphData = {
  directed: false,
  nodes: [
    { id: 'Arad',            label: 'Arad',            x: 91,  y: 193, heuristic: 366 },
    { id: 'Sibiu',           label: 'Sibiu',           x: 311, y: 247, heuristic: 253 },
    { id: 'Fagaras',         label: 'Fagaras',         x: 428, y: 213, heuristic: 176 },
    { id: 'RimnicuVilcea',   label: 'Rimnicu Vilcea',  x: 363, y: 321, heuristic: 193 },
    { id: 'Pitesti',         label: 'Pitesti',         x: 455, y: 396, heuristic: 100 },
    { id: 'Bucharest',       label: 'Bucharest',       x: 538, y: 400, heuristic: 0   },
  ],
  edges: [
    { id: 'e-Arad-Sibiu',             source: 'Arad',          target: 'Sibiu',         weight: 140 },
    { id: 'e-Sibiu-RimnicuVilcea',    source: 'Sibiu',         target: 'RimnicuVilcea', weight: 80  },
    { id: 'e-Sibiu-Fagaras',          source: 'Sibiu',         target: 'Fagaras',       weight: 99  },
    { id: 'e-RimnicuVilcea-Pitesti',  source: 'RimnicuVilcea', target: 'Pitesti',       weight: 97  },
    { id: 'e-Fagaras-Bucharest',      source: 'Fagaras',       target: 'Bucharest',     weight: 211 },
    { id: 'e-Pitesti-Bucharest',      source: 'Pitesti',       target: 'Bucharest',     weight: 101 },
  ],
};

export const romaniaMapProblem: GraphProblem = {
  graph: new Graph(romaniaMapData),
  startNode: 'Arad',
  goalNode: 'Bucharest',
  useHeuristic: true,
};
