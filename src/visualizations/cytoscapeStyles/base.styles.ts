import type { StylesheetStyle } from 'cytoscape';

// ---------------------------------------------------------------------------
// Base stylesheet shared by all graph visualizations.
// Theme: dark background #0F1117 — glassmorphism-inspired with colored glows.
//
// NOTE: Cytoscape cannot resolve CSS custom properties (var(--xyz)).
// All values here must be concrete hex/numeric literals.
//   --bg        #0F1117   --surface    #161B22   --surface-2  #21262D
//   --border    #30363D   --text       #E6EDF3   --text-2     #7D8590
//
// Directed vs undirected:
//   Default edges are UNDIRECTED (no arrowhead).
//   Override 'target-arrow-shape' to 'triangle' in directed contexts.
//   Certain layouts may still use undirected edges by design.
// ---------------------------------------------------------------------------

/** Smooth cross-fade applied to all node state classes */
const T = {
  'transition-property': 'background-color, border-color, shadow-opacity, shadow-color, opacity',
  'transition-duration': 320,
  'transition-timing-function': 'ease-in-out-sine',
} as const;

export const baseStyles = [
  // -------------------------------------------------------------------------
  // Default node — glassy low-opacity fill, subtle ambient glow
  // -------------------------------------------------------------------------
  {
    selector: 'node',
    style: {
      'background-color': '#1C2740',
      'background-opacity': 0.40,
      'border-color': '#3D4B6E',
      'border-width': 1.5,
      color: '#CDD9E5',
      'font-family': 'JetBrains Mono, Fira Code, monospace',
      'font-size': 11,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': 80,
      'text-outline-color': '#0F1117',
      'text-outline-width': 2,
      label: 'data(label)',
      shape: 'round-rectangle',
      width: 60,
      height: 30,
      padding: '6px',
      'shadow-blur': 8,
      'shadow-color': '#58A6FF',
      'shadow-opacity': 0.06,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      ...T,
    },
  },

  // -------------------------------------------------------------------------
  // State classes — each pops with a vivid colored aura
  // -------------------------------------------------------------------------

  // Currently-expanding — orange burst
  {
    selector: 'node.current',
    style: {
      'background-color': '#2D1600',
      'background-opacity': 0.94,
      'border-color': '#F0883E',
      'border-width': 3,
      color: '#FFA657',
      'text-outline-color': '#2D1600',
      'text-outline-width': 2,
      'shadow-blur': 34,
      'shadow-color': '#F0883E',
      'shadow-opacity': 0.92,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      'z-index': 100,
      ...T,
    },
  },

  // Frontier / open-list — electric blue
  {
    selector: 'node.frontier',
    style: {
      'background-color': '#07182E',
      'background-opacity': 0.80,
      'border-color': '#58A6FF',
      'border-width': 2.5,
      color: '#79C0FF',
      'text-outline-color': '#07182E',
      'text-outline-width': 1.5,
      'shadow-blur': 24,
      'shadow-color': '#58A6FF',
      'shadow-opacity': 0.68,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      ...T,
    },
  },

  // Explored / closed — very dim ghost
  {
    selector: 'node.explored',
    style: {
      'background-color': '#161B22',
      'background-opacity': 0.28,
      'border-color': '#252C36',
      'border-width': 1,
      color: '#374151',
      opacity: 0.50,
      ...T,
    },
  },

  // Goal — vivid green
  {
    selector: 'node.goal',
    style: {
      'background-color': '#041409',
      'background-opacity': 0.94,
      'border-color': '#3FB950',
      'border-width': 3,
      color: '#56D364',
      'font-weight': 'bold',
      'text-outline-color': '#041409',
      'text-outline-width': 2,
      'shadow-blur': 32,
      'shadow-color': '#3FB950',
      'shadow-opacity': 0.82,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      ...T,
    },
  },

  // Start — vivid violet
  {
    selector: 'node.start',
    style: {
      'background-color': '#110A26',
      'background-opacity': 0.94,
      'border-color': '#D2A8FF',
      'border-width': 2.5,
      color: '#E2C5FF',
      'font-weight': 'bold',
      'text-outline-color': '#110A26',
      'text-outline-width': 2,
      'shadow-blur': 28,
      'shadow-color': '#A371F7',
      'shadow-opacity': 0.75,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      ...T,
    },
  },

  // Solution path — vivid gold
  {
    selector: 'node.path',
    style: {
      'background-color': '#1C1200',
      'background-opacity': 0.94,
      'border-color': '#E3B341',
      'border-width': 3,
      color: '#F0C55A',
      'font-weight': 'bold',
      'text-outline-color': '#1C1200',
      'text-outline-width': 2,
      'shadow-blur': 28,
      'shadow-color': '#E3B341',
      'shadow-opacity': 0.75,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
      ...T,
    },
  },

  // Pruned — ghosted dashed outline
  {
    selector: 'node.pruned',
    style: {
      'background-color': '#180A0D',
      'background-opacity': 0.20,
      'border-color': '#FF7B72',
      'border-width': 1,
      'border-style': 'dashed',
      color: '#6B2E2A',
      opacity: 0.32,
      ...T,
    },
  },

  // Normal (unvisited)
  {
    selector: 'node.normal',
    style: {
      'background-color': '#1C2740',
      'background-opacity': 0.40,
      'border-color': '#3D4B6E',
      color: '#CDD9E5',
      'shadow-blur': 5,
      'shadow-color': '#58A6FF',
      'shadow-opacity': 0.05,
      ...T,
    },
  },

  // -------------------------------------------------------------------------
  // Default edge — UNDIRECTED (no arrowhead).
  // Directed stylesheets must explicitly set 'target-arrow-shape': 'triangle'.
  // -------------------------------------------------------------------------
  {
    selector: 'edge',
    style: {
      'line-color': '#2D3748',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'curve-style': 'bezier',
      width: 1.5,
      'font-size': 10,
      color: '#5A6478',
      'text-background-color': '#0F1117',
      'text-background-opacity': 0.88,
      'text-background-padding': '2px',
      opacity: 0.65,
    },
  },

  // Opt-in directed class — sharp triangle arrow, standard color
  {
    selector: 'edge.directed',
    style: {
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#8B949E',
      'line-color': '#3D444D',
      width: 1.8,
    },
  },

  // Undirected class — rounded ends, muted color, wider for visibility
  {
    selector: 'edge:not(.directed)',
    style: {
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'line-cap': 'round',
      'line-color': '#444C56',
      width: 1.3,
      opacity: 0.55,
    },
  },

  // Solution path edge (directed) — vivid blue glow with arrow
  {
    selector: 'edge.path-edge.directed',
    style: {
      'line-color': '#58A6FF',
      'target-arrow-color': '#58A6FF',
      'target-arrow-shape': 'triangle',
      width: 3.5,
      opacity: 1,
      'z-index': 10,
      'shadow-blur': 12,
      'shadow-color': '#58A6FF',
      'shadow-opacity': 0.55,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    },
  },

  // Solution path edge (undirected) — vivid blue glow without arrow
  {
    selector: 'edge.path-edge:not(.directed)',
    style: {
      'line-color': '#58A6FF',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'line-cap': 'round',
      width: 3.5,
      opacity: 1,
      'z-index': 10,
      'shadow-blur': 12,
      'shadow-color': '#58A6FF',
      'shadow-opacity': 0.55,
      'shadow-offset-x': 0,
      'shadow-offset-y': 0,
    },
  },

  // Pruned edge — dashed dim, no arrow
  {
    selector: 'edge.pruned-edge',
    style: {
      'line-color': '#FF7B72',
      'line-style': 'dashed',
      'target-arrow-shape': 'none',
      width: 1,
      opacity: 0.22,
    },
  },

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------
  {
    selector: 'node:active',
    style: { 'overlay-color': '#58A6FF', 'overlay-padding': 4, 'overlay-opacity': 0.18 },
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#F0883E',
      'border-width': 3,
      'shadow-blur': 22,
      'shadow-color': '#F0883E',
      'shadow-opacity': 0.65,
    },
  },
  {
    selector: 'edge:selected',
    style: { 'line-color': '#F0883E', 'target-arrow-color': '#F0883E' },
  },
] as unknown as StylesheetStyle[];
