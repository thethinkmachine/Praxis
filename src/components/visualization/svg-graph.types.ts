// ---------------------------------------------------------------------------
// SVG Graph Canvas — View Model Types
// ---------------------------------------------------------------------------

/** Visual state class for node rendering */
export type NodeVisualState =
  | 'current'
  | 'frontier'
  | 'explored'
  | 'path'
  | 'start'
  | 'goal'
  | 'normal'
  | 'pruned';

/** SVG node view model — everything needed to render a single node */
export interface SVGNodeVM {
  id: string;
  label: string;
  x: number;
  y: number;
  state: NodeVisualState;
  isStart: boolean;
  isGoal: boolean;
  /** Cost annotations from informed search algorithms */
  gCost?: number;
  hCost?: number;
  fCost?: number;
}

/** SVG edge view model — everything needed to render a single edge */
export interface SVGEdgeVM {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  isDirected: boolean;
  isPath: boolean;
  isPruned: boolean;
  label?: string;
}

/** Viewport transform state (mirrors d3.ZoomTransform fields) */
export interface ViewportTransform {
  x: number;
  y: number;
  k: number; // zoom scale
}

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------

export interface NodeTheme {
  fill: string;
  fillOpacity: number;
  border: string;
  borderWidth: number;
  text: string;
  glowFilter: string | null; // filter id or null
}

export const NODE_THEME: Record<NodeVisualState, NodeTheme> = {
  current:  { fill: '#2D1600', fillOpacity: 0.94, border: '#F0883E', borderWidth: 3,   text: '#FFA657', glowFilter: 'glow-current'  },
  frontier: { fill: '#07182E', fillOpacity: 0.80, border: '#58A6FF', borderWidth: 2.5, text: '#79C0FF', glowFilter: 'glow-frontier' },
  explored: { fill: '#161B22', fillOpacity: 0.28, border: '#252C36', borderWidth: 1,   text: '#374151', glowFilter: null             },
  goal:     { fill: '#041409', fillOpacity: 0.94, border: '#3FB950', borderWidth: 3,   text: '#56D364', glowFilter: 'glow-goal'     },
  start:    { fill: '#110A26', fillOpacity: 0.94, border: '#D2A8FF', borderWidth: 2.5, text: '#E2C5FF', glowFilter: 'glow-start'    },
  path:     { fill: '#1C1200', fillOpacity: 0.94, border: '#E3B341', borderWidth: 3,   text: '#F0C55A', glowFilter: 'glow-path'     },
  pruned:   { fill: '#180A0D', fillOpacity: 0.20, border: '#FF7B72', borderWidth: 1,   text: '#6B2E2A', glowFilter: null             },
  normal:   { fill: '#1C2740', fillOpacity: 0.40, border: '#3D4B6E', borderWidth: 1.5, text: '#CDD9E5', glowFilter: null             },
};

export const EDGE_COLORS = {
  normal:  { stroke: '#2D3748', width: 1.5, opacity: 0.65 },
  directed:{ stroke: '#3D444D', width: 1.8, opacity: 0.65, arrowColor: '#8B949E' },
  path:    { stroke: '#58A6FF', width: 3.5, opacity: 1.0,  arrowColor: '#58A6FF' },
  pruned:  { stroke: '#FF7B72', width: 1.0, opacity: 0.22, dasharray: '6,3' },
};

// Node dimensions
export const NODE_W = 60;
export const NODE_H = 30;
export const NODE_RX = 8;
export const NODE_W_WIDE = 82; // with cost annotations
export const NODE_H_TALL = 44;

// Grid snap
export const GRID_SNAP = 20;

// Minimap colors for node dots
export const MINIMAP_DOT_COLORS: Record<NodeVisualState, string> = {
  current:  '#F0883E',
  frontier: '#58A6FF',
  explored: '#374151',
  path:     '#E3B341',
  start:    '#D2A8FF',
  goal:     '#3FB950',
  normal:   '#3D4B6E',
  pruned:   '#FF7B72',
};

// ---------------------------------------------------------------------------
// Light-mode theme variants
// ---------------------------------------------------------------------------

export const NODE_THEME_LIGHT: Record<NodeVisualState, NodeTheme> = {
  current:  { fill: '#FFF3E8', fillOpacity: 0.95, border: '#D4711A', borderWidth: 3,   text: '#A04800', glowFilter: 'glow-current'  },
  frontier: { fill: '#EBF4FF', fillOpacity: 0.90, border: '#2E86C1', borderWidth: 2.5, text: '#1A5276', glowFilter: 'glow-frontier' },
  explored: { fill: '#F0F2F5', fillOpacity: 0.90, border: '#94A3B8', borderWidth: 1,   text: '#475569', glowFilter: null             },
  goal:     { fill: '#EAFAF1', fillOpacity: 0.95, border: '#1E8449', borderWidth: 3,   text: '#145A32', glowFilter: 'glow-goal'     },
  start:    { fill: '#F5EEF8', fillOpacity: 0.95, border: '#7D3C98', borderWidth: 2.5, text: '#4A235A', glowFilter: 'glow-start'    },
  path:     { fill: '#FFFBEA', fillOpacity: 0.95, border: '#B7950B', borderWidth: 3,   text: '#7D6608', glowFilter: 'glow-path'     },
  pruned:   { fill: '#FEF9F9', fillOpacity: 0.70, border: '#E74C3C', borderWidth: 1,   text: '#C0392B', glowFilter: null             },
  normal:   { fill: '#FFFFFF', fillOpacity: 0.85, border: '#94A3B8', borderWidth: 1.5, text: '#1E293B', glowFilter: null             },
};

export const EDGE_COLORS_LIGHT = {
  normal:   { stroke: '#94A3B8', width: 1.5, opacity: 0.80 },
  directed: { stroke: '#7B8794', width: 1.8, opacity: 0.80, arrowColor: '#64748B' },
  path:     { stroke: '#2563EB', width: 3.5, opacity: 1.0,  arrowColor: '#2563EB' },
  pruned:   { stroke: '#E74C3C', width: 1.0, opacity: 0.35, dasharray: '6,3' },
};

export const MINIMAP_DOT_COLORS_LIGHT: Record<NodeVisualState, string> = {
  current:  '#D4711A',
  frontier: '#2E86C1',
  explored: '#94A3B8',
  path:     '#B7950B',
  start:    '#7D3C98',
  goal:     '#1E8449',
  normal:   '#94A3B8',
  pruned:   '#E74C3C',
};
