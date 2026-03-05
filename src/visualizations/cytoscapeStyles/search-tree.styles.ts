import type { StylesheetStyle } from 'cytoscape';
import { baseStyles } from '@/visualizations/cytoscapeStyles/base.styles';

// ---------------------------------------------------------------------------
// Search-tree-specific stylesheet.
// Edges are DIRECTED (parent → child expansion).
// Extends baseStyles then overrides geometry and intensifies glass effects.
// ---------------------------------------------------------------------------

export function getSearchTreeStyles(showCosts = false): StylesheetStyle[] {
  return [
    ...baseStyles,

    // Default tree node: compact, glassier than graph view
    {
      selector: 'node',
      style: {
        width: showCosts ? 96 : 70,
        height: showCosts ? 46 : 32,
        'text-wrap': 'wrap',
        'text-max-width': showCosts ? 92 : 66,
        'font-size': showCosts ? 9 : 10,
        padding: '4px',
        'background-opacity': 0.42,
        'shadow-blur': 10,
        'shadow-opacity': 0.10,
      },
    },

    // State class overrides: bigger glows + lower fills

    {
      selector: 'node.current',
      style: {
        width: showCosts ? 104 : 78,
        height: showCosts ? 50 : 36,
        'background-opacity': 0.92,
        'shadow-blur': 38,
        'shadow-opacity': 0.96,
        'z-index': 100,
      },
    },

    {
      selector: 'node.frontier',
      style: {
        'background-opacity': 0.70,
        'shadow-blur': 26,
        'shadow-opacity': 0.68,
      },
    },

    {
      selector: 'node.path',
      style: {
        'background-opacity': 0.88,
        'shadow-blur': 28,
        'shadow-opacity': 0.78,
      },
    },

    {
      selector: 'node.goal',
      style: {
        'background-opacity': 0.90,
        'shadow-blur': 32,
        'shadow-opacity': 0.84,
      },
    },

    {
      selector: 'node.start',
      style: {
        'background-opacity': 0.90,
        'shadow-blur': 28,
        'shadow-opacity': 0.76,
      },
    },

    {
      selector: 'node.explored',
      style: {
        'background-opacity': 0.22,
        opacity: 0.45,
      },
    },

    // Tree edges — DIRECTED (parent → child)
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#2D3748',
        'line-color': '#2D3748',
        width: 1.5,
        label: '',
        opacity: 0.60,
      },
    },

    // Path edges — vivid blue directed
    {
      selector: 'edge.path-edge',
      style: {
        'line-color': '#58A6FF',
        'target-arrow-color': '#58A6FF',
        'target-arrow-shape': 'triangle',
        width: 3,
        opacity: 1,
        'shadow-blur': 14,
        'shadow-color': '#58A6FF',
        'shadow-opacity': 0.58,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'z-index': 10,
      },
    },
  ] as unknown as StylesheetStyle[];
}
