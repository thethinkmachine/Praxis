import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GraphNode, GraphEdge } from '@/types';

export type EditorMode = 'select' | 'addNode' | 'addEdge' | 'delete';

// ---------------------------------------------------------------------------
// History snapshot — captures undoable graph state (not UI state like mode)
// ---------------------------------------------------------------------------
type GraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startNodeId: string | null;
  goalNodeId: string | null;
  isDirected: boolean;
  nextNodeId: number;
  nextEdgeId: number;
};

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------
interface EditorState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: EditorMode;
  selectedIds: string[];
  startNodeId: string | null;
  goalNodeId: string | null;
  isDirected: boolean;
  nextNodeId: number;
  nextEdgeId: number;
  past: GraphSnapshot[];
  future: GraphSnapshot[];

  setMode: (mode: EditorMode) => void;
  addNode: (node: Omit<GraphNode, 'id'> & { id?: string }) => string;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  batchUpdateNodes: (updates: Array<{ id: string } & Partial<GraphNode>>) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string, weight?: number) => string;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => void;
  removeEdge: (id: string) => void;
  setStartNode: (id: string | null) => void;
  setGoalNode: (id: string | null) => void;
  setSelected: (ids: string[]) => void;
  setDirected: (directed: boolean) => void;
  loadGraph: (nodes: GraphNode[], edges: GraphEdge[], startNodeId?: string, goalNodeId?: string, isDirected?: boolean) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

// ---------------------------------------------------------------------------
// Immer-draft-compatible helpers
// ---------------------------------------------------------------------------

interface SnappableState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startNodeId: string | null;
  goalNodeId: string | null;
  isDirected: boolean;
  nextNodeId: number;
  nextEdgeId: number;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
}

function pushHistory(state: SnappableState) {
  const snap: GraphSnapshot = {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    startNodeId: state.startNodeId,
    goalNodeId: state.goalNodeId,
    isDirected: state.isDirected,
    nextNodeId: state.nextNodeId,
    nextEdgeId: state.nextEdgeId,
  };
  if (state.past.length >= 50) state.past.shift();
  state.past.push(snap);
  state.future = [];
}

function takeSnap(state: SnappableState): GraphSnapshot {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    startNodeId: state.startNodeId,
    goalNodeId: state.goalNodeId,
    isDirected: state.isDirected,
    nextNodeId: state.nextNodeId,
    nextEdgeId: state.nextEdgeId,
  };
}

function applySnapshot(state: SnappableState, snap: GraphSnapshot) {
  state.nodes = snap.nodes;
  state.edges = snap.edges;
  state.startNodeId = snap.startNodeId;
  state.goalNodeId = snap.goalNodeId;
  state.isDirected = snap.isDirected;
  state.nextNodeId = snap.nextNodeId;
  state.nextEdgeId = snap.nextEdgeId;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    mode: 'select',
    selectedIds: [],
    startNodeId: null,
    goalNodeId: null,
    isDirected: false,
    nextNodeId: 1,
    nextEdgeId: 1,
    past: [],
    future: [],

    setMode: (mode) => set(state => { state.mode = mode; }),

    addNode: (node) => {
      const id = node.id ?? `n${get().nextNodeId}`;
      set(state => {
        pushHistory(state);
        state.nodes.push({ ...node, id });
        if (!node.id) state.nextNodeId++;
      });
      return id;
    },

    updateNode: (id, updates) => set(state => {
      pushHistory(state);
      const n = state.nodes.find(n => n.id === id);
      if (n) Object.assign(n, updates);
    }),

    batchUpdateNodes: (updates) => set(state => {
      pushHistory(state);
      for (const u of updates) {
        const n = state.nodes.find(n => n.id === u.id);
        if (n) Object.assign(n, u);
      }
    }),

    removeNode: (id) => set(state => {
      pushHistory(state);
      state.nodes = state.nodes.filter(n => n.id !== id);
      state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
      if (state.startNodeId === id) state.startNodeId = null;
      if (state.goalNodeId === id) state.goalNodeId = null;
    }),

    addEdge: (source, target, weight = 1) => {
      const id = `e${get().nextEdgeId}`;
      set(state => {
        pushHistory(state);
        state.edges.push({ id, source, target, weight });
        state.nextEdgeId++;
      });
      return id;
    },

    updateEdge: (id, updates) => set(state => {
      pushHistory(state);
      const e = state.edges.find(e => e.id === id);
      if (e) Object.assign(e, updates);
    }),

    removeEdge: (id) => set(state => {
      pushHistory(state);
      state.edges = state.edges.filter(e => e.id !== id);
    }),

    setStartNode: (id) => set(state => {
      pushHistory(state);
      state.startNodeId = id;
    }),

    setGoalNode: (id) => set(state => {
      pushHistory(state);
      state.goalNodeId = id;
    }),

    setSelected: (ids) => set(state => { state.selectedIds = ids; }),

    setDirected: (directed) => set(state => {
      pushHistory(state);
      state.isDirected = directed;
    }),

    loadGraph: (nodes, edges, startNodeId, goalNodeId, isDirected) => set(state => {
      pushHistory(state);
      state.nodes = nodes;
      state.edges = edges;
      state.startNodeId = startNodeId ?? null;
      state.goalNodeId = goalNodeId ?? null;
      state.isDirected = isDirected ?? false;
      state.nextNodeId = nodes.reduce((max, n) => {
        const m = n.id.match(/^n(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
      state.nextEdgeId = edges.reduce((max, e) => {
        const m = e.id.match(/^e(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
    }),

    clear: () => set(state => {
      pushHistory(state);
      state.nodes = [];
      state.edges = [];
      state.startNodeId = null;
      state.goalNodeId = null;
      state.selectedIds = [];
      state.nextNodeId = 1;
      state.nextEdgeId = 1;
    }),

    undo: () => set(state => {
      const prev = state.past.pop();
      if (!prev) return;
      const current = takeSnap(state);
      if (state.future.length >= 50) state.future.pop();
      state.future.unshift(current);
      applySnapshot(state, prev);
    }),

    redo: () => set(state => {
      const next = state.future.shift();
      if (!next) return;
      const current = takeSnap(state);
      if (state.past.length >= 50) state.past.shift();
      state.past.push(current);
      applySnapshot(state, next);
    }),
  }))
);
