import type { ElementDefinition } from 'cytoscape';
import type { GraphData } from '@/types/problem';
import type { VisualizationAdapter } from '@/types/visualization';
import type { AlgorithmStep } from '@/types/step';
import { graphSearchStyles } from '@/visualizations/cytoscapeStyles/graph-search.styles';

// ---------------------------------------------------------------------------
// State and highlight shapes expected from graph-search algorithm runners
// ---------------------------------------------------------------------------
interface SearchState {
  frontier: string[];
  explored: Set<string>;
  pathMap: Map<string, string | null>;
  foundPath: string[] | null;
}

interface SearchHighlight {
  frontierNodes: Set<string>;
  exploredNodes: Set<string>;
  currentNode: string | null;
  pathEdges: string[] | null; // edge ids in the found path
}

// Optional cost maps present on weighted-search state variants
interface CostMaps {
  gCosts?: Map<string, number>;
  hCosts?: Map<string, number>;
  fCosts?: Map<string, number>;
  costs?: Map<string, number>; // single cost map variant
}

function hasCostMaps(state: SearchState): state is SearchState & CostMaps {
  return 'gCosts' in state || 'hCosts' in state ||
         'fCosts' in state || 'costs' in state;
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------
export function createGraphSearchAdapter(
  graphData: GraphData,
): VisualizationAdapter<SearchState, SearchHighlight> {
  return {
    type: 'graph',

    toCytoscapeElements(
      step: AlgorithmStep<SearchState, SearchHighlight>,
    ): ElementDefinition[] {
      const { state, highlight } = step;
      const elements: ElementDefinition[] = [];

      // highlight.pathEdges is a sequence of node IDs (e.g. ['Arad','Sibiu','Bucharest']).
      // Convert consecutive pairs to edge IDs by looking up the graph edges.
      const pathNodeSequence = highlight.pathEdges ?? [];
      const pathEdgeIds = new Set<string>();
      for (let i = 0; i < pathNodeSequence.length - 1; i++) {
        const a = pathNodeSequence[i];
        const b = pathNodeSequence[i + 1];
        const edge = graphData.edges.find(
          e => (e.source === a && e.target === b) || (!graphData.directed && e.source === b && e.target === a),
        );
        if (edge) pathEdgeIds.add(edge.id);
      }

      // Build path node set from foundPath if available
      const pathNodeSet = new Set<string>(state.foundPath ?? []);

      // ------------------------------------------------------------------
      // Nodes
      // ------------------------------------------------------------------
      for (const node of graphData.nodes) {
        const classes: string[] = [];

        if (node.id === step.highlight.currentNode) {
          classes.push('current');
        } else if (pathNodeSet.has(node.id)) {
          classes.push('path');
        } else if (highlight.frontierNodes?.has(node.id)) {
          classes.push('frontier');
        } else if (highlight.exploredNodes?.has(node.id)) {
          classes.push('explored');
        } else {
          classes.push('normal');
        }

        // Cost annotations — read from available cost maps.
        let gCost: number | undefined, hCost: number | undefined, fCost: number | undefined;
        if (hasCostMaps(state)) {
          gCost = state.gCosts?.get(node.id) ?? state.costs?.get(node.id);
          // Prefer dynamic hCosts from the algorithm; only fall back to static
          // node.heuristic when no dynamic map is available (uninformed runners).
          if (state.hCosts && state.hCosts.has(node.id)) {
            hCost = state.hCosts.get(node.id);
          } else if (!state.hCosts || state.hCosts.size === 0) {
            hCost = node.heuristic !== undefined ? node.heuristic : undefined;
          }
          fCost = state.fCosts?.get(node.id);
        } else {
          hCost = node.heuristic !== undefined ? node.heuristic : undefined;
        }

        // Build composite label: node name + cost line below when costs are known
        let label = node.label ?? node.id;
        if (gCost !== undefined || hCost !== undefined) {
          const parts: string[] = [];
          if (gCost !== undefined) parts.push(`g=${Number.isInteger(gCost) ? gCost : gCost.toFixed(1)}`);
          if (hCost !== undefined) parts.push(`h=${Number.isInteger(hCost) ? hCost : hCost.toFixed(1)}`);
          if (fCost !== undefined) parts.push(`f=${Number.isInteger(fCost) ? fCost : fCost.toFixed(1)}`);
          if (parts.length > 0) label += '\n' + parts.join(' ');
        }

        elements.push({
          data: {
            id: node.id,
            label,
            heuristic: node.heuristic,
            gCost,
            hCost,
            fCost,
          },
          position: node.x !== undefined && node.y !== undefined
            ? { x: node.x, y: node.y }
            : undefined,
          classes: classes.join(' '),
        });
      }

      // ------------------------------------------------------------------
      // Edges
      // ------------------------------------------------------------------
      for (const edge of graphData.edges) {
        const inPath = pathEdgeIds.has(edge.id);
        const classes: string[] = [];
        if (inPath) classes.push('path-edge');
        if (graphData.directed) classes.push('directed');
        elements.push({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            weight: edge.weight,
            label: String(edge.weight),
          },
          classes: classes.join(' ') || undefined,
        });
      }

      return elements;
    },

    getStylesheet() {
      return graphSearchStyles;
    },

    getLayout() {
      return { name: 'preset' };
    },
  };
}

/**
 * Convenience wrapper that also stamps start/goal onto graph nodes so the
 * adapter can apply CSS classes without needing the full GraphProblem object.
 */
export function createGraphSearchAdapterFromProblem(
  graphData: GraphData,
  startNode: string,
  goalNode: string,
): VisualizationAdapter<SearchState, SearchHighlight> {
  const adapter = createGraphSearchAdapter(graphData);
  const _toCy = adapter.toCytoscapeElements.bind(adapter);
  adapter.toCytoscapeElements = (step) => {
    const elements = _toCy(step);
    // Re-apply start/goal classes
    for (const el of elements) {
      if (!el.data) continue;
      if (el.data['id'] === startNode) {
        el.classes = ((el.classes ?? '') + ' start').trim();
      }
      if (el.data['id'] === goalNode) {
        el.classes = ((el.classes ?? '') + ' goal').trim();
      }
    }
    return elements;
  };
  return adapter;
}
