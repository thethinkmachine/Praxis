import type { ElementDefinition, StylesheetStyle, LayoutOptions } from 'cytoscape';
import type { AlgorithmStep } from './step';

export interface VisualizationAdapter<TState = unknown, THighlight = unknown> {
  type: 'graph' | 'tree';
  toCytoscapeElements(step: AlgorithmStep<TState, THighlight>): ElementDefinition[];
  getStylesheet(): StylesheetStyle[];
  getLayout(step?: AlgorithmStep<TState, THighlight>): LayoutOptions;
}

export interface GridCell {
  value: string | number | null;
  label?: string;
  state: 'empty' | 'filled' | 'conflict' | 'candidate' | 'fixed' | 'highlighted' | 'queen' | 'attacked';
  row: number;
  col: number;
  annotation?: string;
}

export interface GridVisualizationAdapter<TState = unknown, THighlight = unknown> {
  type: 'grid';
  toGridCells(step: AlgorithmStep<TState, THighlight>): GridCell[][];
  getGridDimensions(): { rows: number; cols: number };
}

export interface LandscapePoint {
  x: number;
  y: number;
  label?: string;
  isCurrent?: boolean;
  isBest?: boolean;
}

export interface LandscapeData {
  points: LandscapePoint[];
  landscapeFn?: (x: number) => number;
  xRange?: [number, number];
}
