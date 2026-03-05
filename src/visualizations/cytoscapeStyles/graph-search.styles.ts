import type { StylesheetStyle } from 'cytoscape';
import { baseStyles } from '@/visualizations/cytoscapeStyles/base.styles';

// ---------------------------------------------------------------------------
// Graph-search-specific stylesheet.
// Edges are DIRECTED — traversal moves along edge direction.
// showWeightLabels=false for uninformed algorithms (BFS/DFS/DLS/IDDFS).
// ---------------------------------------------------------------------------
export function getGraphSearchStyles(showWeightLabels = true): StylesheetStyle[] {
  return [
    ...baseStyles,

    // Weight labels on all edges (applies regardless of direction)
    ...(showWeightLabels
      ? [
          {
            selector: 'edge',
            style: {
              label: 'data(label)',
              'text-rotation': 'autorotate',
              'text-margin-y': -8,
              'font-size': 10,
              color: '#5A6478',
            },
          },
        ]
      : []),

    // Directed edges only: show triangle arrow
    {
      selector: 'edge.directed',
      style: {
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#3D444D',
      },
    },

    // Undirected edges: no arrows, rounded appearance
    {
      selector: 'edge:not(.directed)',
      style: {
        'target-arrow-shape': 'none',
        'source-arrow-shape': 'none',
      },
    },

    // Path edge: vivid blue; arrow only if directed
    {
      selector: 'edge.path-edge.directed',
      style: {
        'target-arrow-shape': 'triangle',
        ...(showWeightLabels
          ? { label: 'data(label)', color: '#79C0FF', 'font-weight': 'bold' }
          : { label: '' }),
      },
    },
    {
      selector: 'edge.path-edge:not(.directed)',
      style: {
        'target-arrow-shape': 'none',
        ...(showWeightLabels
          ? { label: 'data(label)', color: '#79C0FF', 'font-weight': 'bold' }
          : { label: '' }),
      },
    },

    // Frontier: stronger glow + solid border
    {
      selector: 'node.frontier',
      style: {
        'border-style': 'solid',
        'shadow-blur': 28,
        'shadow-opacity': 0.72,
      },
    },

    // Current node: larger + maximum glow
    {
      selector: 'node.current',
      style: {
        width: 76,
        height: 38,
        'shadow-blur': 38,
        'shadow-opacity': 0.96,
      },
    },

    // Goal: larger with strong green glow
    {
      selector: 'node.goal',
      style: {
        width: 76,
        height: 38,
        'border-width': 3,
        'shadow-blur': 34,
        'shadow-opacity': 0.85,
      },
    },

    // Start: larger with strong violet glow
    {
      selector: 'node.start',
      style: {
        width: 76,
        height: 38,
        'border-width': 3,
        'shadow-blur': 30,
        'shadow-opacity': 0.78,
      },
    },

    // Nodes with cost annotations — placed LAST so height/font override state classes.
    // Height 50 accommodates 2-line label: "NodeName\ng=X h=Y f=Z"
    {
      selector: 'node[gCost], node[fCost]',
      style: {
        width: 80,
        height: 50,
        'font-size': 9,
        'text-wrap': 'wrap',
        'text-max-width': 76,
        'line-height': 1.4,
      },
    },
  ] as unknown as StylesheetStyle[];
}

// Convenience pre-built exports
export const graphSearchStyles = getGraphSearchStyles(true);
export const uninformedGraphSearchStyles = getGraphSearchStyles(false);
