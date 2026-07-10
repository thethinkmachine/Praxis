import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GameTreeNodeData, GameTreeEdgeData } from '@/types/problem';

export type TreeEditorMode = 'select' | 'addNode' | 'addEdge' | 'delete';

// ---------------------------------------------------------------------------
// History snapshot — captures undoable tree state (not UI state like mode)
// ---------------------------------------------------------------------------
type TreeSnapshot = {
  nodes: GameTreeNodeData[];
  edges: GameTreeEdgeData[];
  rootId: string | null;
  nextNodeId: number;
  nextEdgeId: number;
};

interface EdgeCheckResult {
  ok: boolean;
  reason?: string;
}

interface TreeEditorState {
  nodes: GameTreeNodeData[];
  edges: GameTreeEdgeData[];
  mode: TreeEditorMode;
  selectedIds: string[];
  rootId: string | null;
  nextNodeId: number;
  nextEdgeId: number;
  past: TreeSnapshot[];
  future: TreeSnapshot[];

  setMode: (mode: TreeEditorMode) => void;
  addNode: (node: Omit<Partial<GameTreeNodeData>, 'id'> & { id?: string }) => string;
  updateNode: (id: string, updates: Partial<GameTreeNodeData>) => void;
  removeNode: (id: string) => void;
  canAddEdge: (source: string, target: string) => EdgeCheckResult;
  addEdge: (source: string, target: string, opts?: { moveLabel?: string; probability?: number }) => string | null;
  updateEdge: (id: string, updates: Partial<GameTreeEdgeData>) => void;
  removeEdge: (id: string) => void;
  setRoot: (id: string | null) => void;
  setSelected: (ids: string[]) => void;
  loadTree: (nodes: GameTreeNodeData[], edges: GameTreeEdgeData[], rootId: string | null) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

interface SnappableState {
  nodes: GameTreeNodeData[];
  edges: GameTreeEdgeData[];
  rootId: string | null;
  nextNodeId: number;
  nextEdgeId: number;
  past: TreeSnapshot[];
  future: TreeSnapshot[];
}

function pushHistory(state: SnappableState) {
  const snap: TreeSnapshot = {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    rootId: state.rootId,
    nextNodeId: state.nextNodeId,
    nextEdgeId: state.nextEdgeId,
  };
  if (state.past.length >= 50) state.past.shift();
  state.past.push(snap);
  state.future = [];
}

function takeSnap(state: SnappableState): TreeSnapshot {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    rootId: state.rootId,
    nextNodeId: state.nextNodeId,
    nextEdgeId: state.nextEdgeId,
  };
}

function applySnapshot(state: SnappableState, snap: TreeSnapshot) {
  state.nodes = snap.nodes;
  state.edges = snap.edges;
  state.rootId = snap.rootId;
  state.nextNodeId = snap.nextNodeId;
  state.nextEdgeId = snap.nextEdgeId;
}

/** Pure so it can back both the store's own guard and cytoscape's live canConnect check. */
function checkEdge(nodes: GameTreeNodeData[], edges: GameTreeEdgeData[], source: string, target: string): EdgeCheckResult {
  if (source === target) {
    return { ok: false, reason: 'A node cannot connect to itself.' };
  }
  if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) {
    return { ok: false, reason: 'Unknown node.' };
  }
  if (edges.some((e) => e.target === target)) {
    return { ok: false, reason: 'That node already has a parent — a tree allows only one incoming edge per node.' };
  }

  // Cycle check: walk up from source's ancestors; if we reach target, connecting
  // source -> target would close a loop back to target.
  const guard = new Set<string>();
  let current: string | undefined = source;
  while (current) {
    if (current === target) {
      return { ok: false, reason: 'That would create a cycle.' };
    }
    if (guard.has(current)) break;
    guard.add(current);
    current = edges.find((e) => e.target === current)?.source;
  }

  return { ok: true };
}

export const useTreeEditorStore = create<TreeEditorState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    mode: 'select',
    selectedIds: [],
    rootId: null,
    nextNodeId: 1,
    nextEdgeId: 1,
    past: [],
    future: [],

    setMode: (mode) => set((state) => { state.mode = mode; }),

    addNode: (node) => {
      const id = node.id ?? `t${get().nextNodeId}`;
      set((state) => {
        pushHistory(state);
        state.nodes.push({ kind: 'max', ...node, id });
        if (!node.id) state.nextNodeId++;
        if (state.rootId === null) state.rootId = id;
      });
      return id;
    },

    updateNode: (id, updates) => set((state) => {
      pushHistory(state);
      const n = state.nodes.find((n) => n.id === id);
      if (n) Object.assign(n, updates);
    }),

    removeNode: (id) => set((state) => {
      pushHistory(state);
      const removedEdgeIds = new Set(
        state.edges.filter((e) => e.source === id || e.target === id).map((e) => e.id),
      );
      state.nodes = state.nodes.filter((n) => n.id !== id);
      state.edges = state.edges.filter((e) => e.source !== id && e.target !== id);
      state.selectedIds = state.selectedIds.filter((sel) => sel !== id && !removedEdgeIds.has(sel));
      if (state.rootId === id) state.rootId = state.nodes[0]?.id ?? null;
    }),

    canAddEdge: (source, target) => checkEdge(get().nodes, get().edges, source, target),

    addEdge: (source, target, opts) => {
      const check = checkEdge(get().nodes, get().edges, source, target);
      if (!check.ok) return null;
      const id = `te${get().nextEdgeId}`;
      set((state) => {
        pushHistory(state);
        state.edges.push({ id, source, target, moveLabel: opts?.moveLabel, probability: opts?.probability });
        state.nextEdgeId++;
      });
      return id;
    },

    updateEdge: (id, updates) => set((state) => {
      pushHistory(state);
      const e = state.edges.find((e) => e.id === id);
      if (e) Object.assign(e, updates);
    }),

    removeEdge: (id) => set((state) => {
      pushHistory(state);
      state.edges = state.edges.filter((e) => e.id !== id);
      state.selectedIds = state.selectedIds.filter((sel) => sel !== id);
    }),

    setRoot: (id) => set((state) => {
      pushHistory(state);
      state.rootId = id;
    }),

    setSelected: (ids) => set((state) => { state.selectedIds = ids; }),

    loadTree: (nodes, edges, rootId) => set((state) => {
      pushHistory(state);
      state.nodes = nodes;
      state.edges = edges;
      state.selectedIds = [];
      state.rootId = rootId ?? nodes[0]?.id ?? null;
      state.nextNodeId = nodes.reduce((max, n) => {
        const m = n.id.match(/^t(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
      state.nextEdgeId = edges.reduce((max, e) => {
        const m = e.id.match(/^te(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
    }),

    clear: () => set((state) => {
      pushHistory(state);
      state.nodes = [];
      state.edges = [];
      state.rootId = null;
      state.selectedIds = [];
      state.nextNodeId = 1;
      state.nextEdgeId = 1;
    }),

    undo: () => set((state) => {
      const prev = state.past.pop();
      if (!prev) return;
      const current = takeSnap(state);
      if (state.future.length >= 50) state.future.pop();
      state.future.unshift(current);
      applySnapshot(state, prev);
    }),

    redo: () => set((state) => {
      const next = state.future.shift();
      if (!next) return;
      const current = takeSnap(state);
      if (state.past.length >= 50) state.past.shift();
      state.past.push(current);
      applySnapshot(state, next);
    }),
  })),
);
