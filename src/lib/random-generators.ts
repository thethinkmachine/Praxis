/**
 * Random generation utilities for uninformed-search graph problems.
 */

interface GraphNode {
  id: string;
  label?: string;
  heuristic?: number;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

/**
 * Generate a random graph with N nodes and random edges.
 */
export function generateRandomGraph(
  nodeCount: number,
  edgeProbability: number,
  weighted: boolean,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nodes: GraphNode[] = [];
  const cols = Math.ceil(Math.sqrt(nodeCount));

  for (let i = 0; i < nodeCount; i++) {
    const label = i < 26 ? letters[i] : `N${i}`;
    nodes.push({
      id: label,
      label,
      heuristic: weighted ? Math.floor(Math.random() * 15) : undefined,
      x: (i % cols) * 120 + 80 + Math.random() * 40 - 20,
      y: Math.floor(i / cols) * 120 + 80 + Math.random() * 40 - 20,
    });
  }

  const edges: GraphEdge[] = [];
  let edgeId = 0;

  // Ensure graph is connected: create a spanning tree first
  const shuffled = [...nodes].sort(() => Math.random() - 0.5);
  for (let i = 1; i < shuffled.length; i++) {
    const w = weighted ? Math.floor(Math.random() * 15) + 1 : 1;
    edges.push({
      id: `e${edgeId++}`,
      source: shuffled[i - 1].id,
      target: shuffled[i].id,
      weight: w,
    });
  }

  // Add random additional edges
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 2; j < nodeCount; j++) {
      if (Math.random() < edgeProbability) {
        const exists = edges.some(
          (e) =>
            (e.source === nodes[i].id && e.target === nodes[j].id) ||
            (e.source === nodes[j].id && e.target === nodes[i].id),
        );
        if (!exists) {
          const w = weighted ? Math.floor(Math.random() * 15) + 1 : 1;
          edges.push({
            id: `e${edgeId++}`,
            source: nodes[i].id,
            target: nodes[j].id,
            weight: w,
          });
        }
      }
    }
  }

  return { nodes, edges };
}
