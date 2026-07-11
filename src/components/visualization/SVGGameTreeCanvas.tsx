import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/cn';
import EditorToolbar, { type EditorMode } from '@/components/editor/EditorToolbar';
import GraphMinimap from '@/components/visualization/GraphMinimap';
import GameTreeContextMenu from '@/components/visualization/GameTreeContextMenu';
import { useTreeEditorStore } from '@/store/treeEditor.store';
import { useGraphInteractions } from '@/hooks/useGraphInteractions';
import { usePreferencesStore } from '@/store/preferences.store';
import { layoutGameTree } from '@/problems/game-playing/tree-layout';
import type { AlgorithmStep } from '@/types/step';
import type { GameTraceState, GameTraceHighlight, GameTreeNode as TraceNode } from '@/algorithms/game-playing/types';
import type { GameTreeNodeKind } from '@/types/problem';
import {
  NODE_THEME,
  NODE_THEME_LIGHT,
  EDGE_COLORS,
  EDGE_COLORS_LIGHT,
} from './svg-graph.types';
import type { SVGNodeVM, NodeVisualState } from './svg-graph.types';

// ---------------------------------------------------------------------------
// Kind-based theme (used when no algorithm step is active). During replay the
// algorithm's NodeVisualState theme takes over so the search is legible, while
// the node's *shape* always encodes its kind.
// ---------------------------------------------------------------------------
interface KindTheme {
  fill: string;
  fillOpacity: number;
  border: string;
  borderWidth: number;
  text: string;
}

const KIND_THEME_DARK: Record<GameTreeNodeKind, KindTheme> = {
  max: { fill: '#0B1A2E', fillOpacity: 0.9, border: '#58A6FF', borderWidth: 2, text: '#79C0FF' },
  min: { fill: '#241405', fillOpacity: 0.9, border: '#F0883E', borderWidth: 2, text: '#FFA657' },
  chance: { fill: '#1A0F2E', fillOpacity: 0.9, border: '#D2A8FF', borderWidth: 2, text: '#E2C5FF' },
  terminal: { fill: '#041409', fillOpacity: 0.94, border: '#3FB950', borderWidth: 2, text: '#56D364' },
};

const KIND_THEME_LIGHT: Record<GameTreeNodeKind, KindTheme> = {
  max: { fill: '#EBF4FF', fillOpacity: 0.95, border: '#2E86C1', borderWidth: 2, text: '#1A5276' },
  min: { fill: '#FDF2E9', fillOpacity: 0.95, border: '#D4711A', borderWidth: 2, text: '#A04800' },
  chance: { fill: '#F5EEF8', fillOpacity: 0.95, border: '#7D3C98', borderWidth: 2, text: '#4A235A' },
  terminal: { fill: '#EAFAF1', fillOpacity: 0.95, border: '#1E8449', borderWidth: 2, text: '#145A32' },
};

const KIND_LABELS: Record<GameTreeNodeKind, string> = {
  max: 'MAX', min: 'MIN', chance: 'CHANCE', terminal: 'LEAF',
};

const KIND_PALETTE: Array<{ kind: GameTreeNodeKind; title: string }> = [
  { kind: 'max', title: 'Add a MAX node (square) — maximizes' },
  { kind: 'min', title: 'Add a MIN node (circle) — minimizes' },
  { kind: 'chance', title: 'Add a CHANCE node (diamond) — probability-weighted average' },
  { kind: 'terminal', title: 'Add a LEAF node (rounded) — fixed value' },
];

// Small shape preview used in the node-type palette.
function KindGlyph({ kind }: { kind: GameTreeNodeKind }) {
  const color = kind === 'max' ? '#58A6FF' : kind === 'min' ? '#F0883E' : kind === 'chance' ? '#D2A8FF' : '#3FB950';
  const common = { fill: 'none', stroke: color, strokeWidth: 1.8 };
  return (
    <svg width={16} height={16} viewBox="-9 -9 18 18">
      {kind === 'max' && <rect x={-6} y={-6} width={12} height={12} rx={1.5} {...common} />}
      {kind === 'min' && <circle r={6.5} {...common} />}
      {kind === 'chance' && <polygon points="0,-7.5 7.5,0 0,7.5 -7.5,0" {...common} />}
      {kind === 'terminal' && <rect x={-7} y={-4.5} width={14} height={9} rx={3} {...common} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Node geometry per kind (half-extents, for edge clipping + hit rendering)
// ---------------------------------------------------------------------------
interface NodeExtent { shape: 'circle' | 'square' | 'diamond' | 'rect'; hw: number; hh: number; r: number; }

function nodeExtent(kind: GameTreeNodeKind): NodeExtent {
  switch (kind) {
    case 'max': return { shape: 'square', hw: 20, hh: 20, r: 20 };
    case 'min': return { shape: 'circle', hw: 21, hh: 21, r: 21 };
    case 'chance': return { shape: 'diamond', hw: 24, hh: 24, r: 24 };
    case 'terminal': return { shape: 'rect', hw: 26, hh: 17, r: 20 };
  }
}

function clipToBorder(cx: number, cy: number, angle: number, ext: NodeExtent): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (ext.shape === 'circle' || ext.shape === 'diamond') {
    return { x: cx + ext.r * cos, y: cy + ext.r * sin };
  }
  const tx = cos !== 0 ? ext.hw / Math.abs(cos) : Infinity;
  const ty = sin !== 0 ? ext.hh / Math.abs(sin) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + t * cos, y: cy + t * sin };
}

function formatScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '?';
  if (v === Number.POSITIVE_INFINITY) return '∞';
  if (v === Number.NEGATIVE_INFINITY) return '-∞';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function formatBound(v: number | undefined): string {
  if (v === undefined) return '·';
  if (v === Number.POSITIVE_INFINITY) return '∞';
  if (v === Number.NEGATIVE_INFINITY) return '-∞';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ---------------------------------------------------------------------------
// Per-editor-node algorithm state, derived from the trace's search tree.
// ---------------------------------------------------------------------------
interface NodeAlgo {
  state: NodeVisualState;
  score: number | null;
  alpha?: number;
  beta?: number;
}

interface ContextMenuState { x: number; y: number; type: 'node' | 'edge'; targetId: string; }
interface ValueTarget { nodeId: string; x: number; y: number; }
interface ProbTarget { edgeId: string; x: number; y: number; }

// ---------------------------------------------------------------------------
// SVG defs (grid + arrow markers + glow filters) — mirrors SVGGraphCanvas.
// ---------------------------------------------------------------------------
function SvgDefs({ darkMode, transform }: { darkMode: boolean; transform?: d3.ZoomTransform }) {
  const GRID = 20;
  return (
    <defs>
      <pattern id="gt-dot-grid" x="0" y="0" width={GRID} height={GRID} patternUnits="userSpaceOnUse" patternTransform={transform?.toString()}>
        <circle cx="1" cy="1" r="1.2" fill={darkMode ? '#38bdf8' : '#1e293b'} fillOpacity={darkMode ? 0.12 : 0.18} />
      </pattern>
      <marker id="gt-arrow-default" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#8B949E" />
      </marker>
      <marker id="gt-arrow-path" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#E3B341" />
      </marker>
      {[
        { id: 'gt-glow-current', color: '#F0883E', std: 8, opacity: 0.9 },
        { id: 'gt-glow-frontier', color: '#58A6FF', std: 6, opacity: 0.65 },
        { id: 'gt-glow-goal', color: '#3FB950', std: 8, opacity: 0.8 },
        { id: 'gt-glow-path', color: '#E3B341', std: 7, opacity: 0.7 },
      ].map(({ id, color, std, opacity }) => (
        <filter key={id} id={id} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={std} result="blur" />
          <feFlood floodColor={color} floodOpacity={opacity} />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      ))}
    </defs>
  );
}

// Map a NodeVisualState glow to the local (gt-prefixed) filter id.
const STATE_GLOW: Partial<Record<NodeVisualState, string>> = {
  current: 'gt-glow-current',
  frontier: 'gt-glow-frontier',
  goal: 'gt-glow-goal',
  path: 'gt-glow-path',
};

interface SVGGameTreeCanvasProps {
  step: AlgorithmStep<GameTraceState, GameTraceHighlight> | null;
  /** Bumps when a new problem is loaded (preset/import/clear) to re-center the view. */
  problemKey?: string;
  className?: string;
}

export default function SVGGameTreeCanvas({ step, problemKey, className }: SVGGameTreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mainGroupRef = useRef<SVGGElement>(null);
  const tempEdgeRef = useRef<SVGLineElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const darkMode = usePreferencesStore((s) => s.darkMode);
  const activeNodeTheme = darkMode ? NODE_THEME : NODE_THEME_LIGHT;
  const activeKindTheme = darkMode ? KIND_THEME_DARK : KIND_THEME_LIGHT;
  const activeEdgeColors = darkMode ? EDGE_COLORS : EDGE_COLORS_LIGHT;

  const [mode, setMode] = useState<EditorMode>('select');
  const [nextNodeKind, setNextNodeKind] = useState<GameTreeNodeKind>('max');
  const [liveDrag, setLiveDrag] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [valueTarget, setValueTarget] = useState<ValueTarget | null>(null);
  const [valueInput, setValueInput] = useState('');
  const valueInputRef = useRef<HTMLInputElement>(null);
  const [probTarget, setProbTarget] = useState<ProbTarget | null>(null);
  const [probInput, setProbInput] = useState('');
  const probInputRef = useRef<HTMLInputElement>(null);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });

  const {
    nodes, edges, rootId,
    addNode, addEdge, canAddEdge, removeNode, removeEdge, updateNode, updateEdge,
    setRoot, setSelected, clear, undo, redo,
  } = useTreeEditorStore();
  const canUndo = useTreeEditorStore((s) => s.past.length > 0);
  const canRedo = useTreeEditorStore((s) => s.future.length > 0);
  const selectedIds = useTreeEditorStore((s) => s.selectedIds);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // ── Derive per-editor-node algorithm coloring from the trace search tree ──
  const algo = useMemo(() => {
    if (!step) return null;
    const st = step.state;
    const tree = st.searchTree;
    if (!(tree instanceof Map)) return null;

    const currentSearchId = step.highlight.currentNodeId ?? st.currentNodeId ?? null;
    // The recursion path to the active node (editor ids).
    const activePath = new Set<string>();
    let cursor: string | null = currentSearchId;
    let guard = 0;
    while (cursor && guard++ < 10000) {
      const n: TraceNode | undefined = tree.get(cursor);
      if (!n) break;
      const eid = n.extra?.nodeId as string | undefined;
      if (eid) activePath.add(eid);
      cursor = n.parentId;
    }

    // Principal variation (single best line) and best strategy (best child at every MAX node,
    // every child at MIN/chance nodes — a branching policy, not just one line). For the game-tree
    // domain a move id IS the child editor node id, so both sets are root + those ids — keeps
    // them highlighted in gold even after the run finishes.
    const pv = step.highlight.principalVariation ?? st.principalVariation ?? null;
    const bestStrategy = step.highlight.bestStrategyNodeIds ?? st.bestStrategyNodeIds ?? null;
    const pathSet = new Set(activePath);
    if (rootId) pathSet.add(rootId);
    if (Array.isArray(pv)) for (const id of pv) pathSet.add(id);
    if (Array.isArray(bestStrategy)) for (const id of bestStrategy) pathSet.add(id);

    const map = new Map<string, NodeAlgo>();
    for (const n of tree.values()) {
      if (n.discoveryStep > step.stepNumber) continue;
      const eid = n.extra?.nodeId as string | undefined;
      if (!eid) continue;
      const isCurrent = n.id === currentSearchId;
      let state: NodeVisualState;
      if (isCurrent) state = 'current';
      else if (n.isPruned) state = 'pruned';
      else if (activePath.has(eid) || pathSet.has(eid)) state = 'path';
      else if (n.score != null) state = 'explored';
      else state = 'frontier';
      const existing = map.get(eid);
      // If an editor node maps to multiple trace nodes (shouldn't in a tree),
      // keep the most active one.
      const priority: NodeVisualState[] = ['current', 'path', 'frontier', 'explored', 'pruned', 'normal'];
      if (!existing || priority.indexOf(state) < priority.indexOf(existing.state)) {
        map.set(eid, { state, score: n.score, alpha: n.alpha, beta: n.beta });
      }
    }
    return { map, activePath: pathSet };
  }, [step, rootId]);

  const flashEdgeError = useCallback((message: string) => {
    setEdgeError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setEdgeError(null), 2200);
  }, []);

  // ── Inline editors ────────────────────────────────────────────────────────
  const openValueEdit = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesById.get(nodeId);
    if (!node || node.kind !== 'terminal') return;
    setContextMenu(null);
    setValueInput(String(node.value ?? 0));
    setValueTarget({ nodeId, x, y });
  }, [nodesById]);

  const openProbEdit = useCallback((edgeId: string, x: number, y: number) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    setContextMenu(null);
    setProbInput(edge.probability == null ? '' : String(edge.probability));
    setProbTarget({ edgeId, x, y });
  }, [edges]);

  useEffect(() => {
    if (valueTarget) {
      const t = setTimeout(() => { valueInputRef.current?.focus(); valueInputRef.current?.select(); }, 0);
      return () => clearTimeout(t);
    }
  }, [valueTarget]);
  useEffect(() => {
    if (probTarget) {
      const t = setTimeout(() => { probInputRef.current?.focus(); probInputRef.current?.select(); }, 0);
      return () => clearTimeout(t);
    }
  }, [probTarget]);

  const commitValue = useCallback(() => {
    if (valueTarget) {
      const num = Number(valueInput.trim());
      if (valueInput.trim() !== '' && Number.isFinite(num)) {
        updateNode(valueTarget.nodeId, { value: num });
      }
    }
    setValueTarget(null);
  }, [valueTarget, valueInput, updateNode]);

  const commitProb = useCallback(() => {
    if (probTarget) {
      const raw = probInput.trim();
      if (raw === '') {
        updateEdge(probTarget.edgeId, { probability: undefined });
      } else {
        const num = Number(raw);
        if (Number.isFinite(num) && num >= 0) updateEdge(probTarget.edgeId, { probability: num });
      }
    }
    setProbTarget(null);
  }, [probTarget, probInput, updateEdge]);

  // ── Interaction handlers ────────────────────────────────────────────────
  const handleNodeClick = useCallback((nodeId: string, meta: { append: boolean }) => {
    if (mode === 'delete') { removeNode(nodeId); return; }
    if (mode === 'select') {
      if (meta.append) {
        setSelected(selectedSet.has(nodeId) ? selectedIds.filter((id) => id !== nodeId) : [...selectedIds, nodeId]);
      } else {
        setSelected([nodeId]);
      }
    }
  }, [mode, removeNode, selectedIds, selectedSet, setSelected]);

  const handleNodeRightClick = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setValueTarget(null); setProbTarget(null);
    setContextMenu({ x: pos.x, y: pos.y, type: 'node', targetId: nodeId });
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (mode !== 'select') return;
    openValueEdit(nodeId, pos.x, pos.y);
  }, [mode, openValueEdit]);

  const handleEdgeClick = useCallback((edgeId: string, meta: { append: boolean }) => {
    if (mode === 'delete') { removeEdge(edgeId); return; }
    if (mode === 'select') {
      if (meta.append) {
        setSelected(selectedSet.has(edgeId) ? selectedIds.filter((id) => id !== edgeId) : [...selectedIds, edgeId]);
      } else {
        setSelected([edgeId]);
      }
    }
  }, [mode, removeEdge, selectedIds, selectedSet, setSelected]);

  const handleEdgeRightClick = useCallback((edgeId: string, pos: { x: number; y: number }) => {
    setValueTarget(null); setProbTarget(null);
    setContextMenu({ x: pos.x, y: pos.y, type: 'edge', targetId: edgeId });
  }, []);

  const handleEdgeDoubleClick = useCallback((edgeId: string, pos: { x: number; y: number }) => {
    if (mode !== 'select') return;
    const edge = edges.find((e) => e.id === edgeId);
    if (edge && nodesById.get(edge.source)?.kind === 'chance') openProbEdit(edgeId, pos.x, pos.y);
  }, [mode, edges, nodesById, openProbEdit]);

  const handleBgClick = useCallback((pos: { x: number; y: number }) => {
    if (mode === 'addNode') {
      addNode({ x: pos.x, y: pos.y, kind: nextNodeKind, value: nextNodeKind === 'terminal' ? 0 : undefined });
    }
  }, [mode, addNode, nextNodeKind]);

  // Picking a node type from the palette also switches to add-node mode.
  const pickKind = useCallback((kind: GameTreeNodeKind) => {
    setNextNodeKind(kind);
    setMode('addNode');
  }, []);

  const handleEmptyClick = useCallback((meta: { append: boolean }) => {
    if (mode === 'select' && !meta.append) setSelected([]);
  }, [mode, setSelected]);

  const handleSelectionBoxComplete = useCallback((payload: { nodeIds: string[]; edgeIds: string[]; append: boolean }) => {
    const ids = [...payload.nodeIds, ...payload.edgeIds];
    if (!payload.append) { setSelected(ids); return; }
    const merged = new Set(selectedIds);
    for (const id of ids) merged.add(id);
    setSelected(Array.from(merged));
  }, [selectedIds, setSelected]);

  const handleEdgeAdded = useCallback((sourceId: string, targetId: string) => {
    const check = canAddEdge(sourceId, targetId);
    if (!check.ok) { flashEdgeError(check.reason ?? 'Cannot add that edge.'); return; }
    addEdge(sourceId, targetId);
  }, [canAddEdge, addEdge, flashEdgeError]);

  const handleNodeMoved = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setLiveDrag(null);
    updateNode(nodeId, { x: position.x, y: position.y });
  }, [updateNode]);

  const nodePositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) m.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    return m;
  }, [nodes]);

  const {
    transform, selectionBox, isSpacePressed, isPanning,
    fit, jumpTo, zoomIn, zoomOut,
  } = useGraphInteractions({
    svgRef, mainGroupRef, tempEdgeRef, mode,
    nodePositions,
    edgeData: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    nodeHitRadius: 34,
    onBackgroundClick: handleBgClick,
    onEmptyClick: handleEmptyClick,
    onNodeClick: handleNodeClick,
    onNodeRightClick: handleNodeRightClick,
    onNodeDoubleClick: handleNodeDoubleClick,
    onEdgeClick: handleEdgeClick,
    onEdgeRightClick: handleEdgeRightClick,
    onEdgeDoubleClick: handleEdgeDoubleClick,
    onSelectionBoxComplete: handleSelectionBoxComplete,
    onNodeMoved: handleNodeMoved,
    onEdgeAdded: handleEdgeAdded,
    onNodeDragging: (nodeId, pos) => setLiveDrag({ nodeId, ...pos }),
    snapToGrid: false,
  });

  // Dismiss context menu on pan/zoom or when its target disappears.
  useEffect(() => { setContextMenu(null); }, [transform]);
  useEffect(() => {
    if (!contextMenu) return;
    const exists = contextMenu.type === 'node'
      ? nodes.some((n) => n.id === contextMenu.targetId)
      : edges.some((e) => e.id === contextMenu.targetId);
    if (!exists) setContextMenu(null);
  }, [nodes, edges, contextMenu]);

  // Undo/redo keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { if (e.shiftKey) redo(); else undo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { redo(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const positions = layoutGameTree(nodes, edges, rootId);
    positions.forEach((pos, id) => updateNode(id, pos));
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => fit(), 60);
  }, [nodes, edges, rootId, updateNode, fit]);

  // Re-center when a new problem loads.
  useEffect(() => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => fit(), 60);
  }, [problemKey, fit]);

  useEffect(() => () => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setCanvasDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
      fitTimerRef.current = setTimeout(() => fit(), 100);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  // Minimap node VMs (position + a color proxy via NodeVisualState).
  const minimapNodes = useMemo<SVGNodeVM[]>(() => nodes.map((n) => ({
    id: n.id,
    label: '',
    x: n.x ?? 0,
    y: n.y ?? 0,
    state: (algo?.map.get(n.id)?.state ?? 'normal') as NodeVisualState,
    isStart: n.id === rootId,
    isGoal: false,
  })), [nodes, rootId, algo]);

  const modeColors: Record<EditorMode, string> = { select: '#58A6FF', addNode: '#3FB950', addEdge: '#F0883E', delete: '#FF7B72' };
  const modeLabels: Record<EditorMode, string> = { select: 'Select', addNode: 'Add Node', addEdge: 'Add Edge', delete: 'Delete' };

  function liveNodePos(id: string, fx: number, fy: number): { x: number; y: number } {
    if (liveDrag && liveDrag.nodeId === id) return { x: liveDrag.x, y: liveDrag.y };
    return { x: fx, y: fy };
  }

  const panAffordance = isPanning || isSpacePressed;
  const panCursor = isPanning ? 'grabbing' : 'grab';
  const svgCursor = panAffordance ? panCursor : mode === 'addNode' ? 'crosshair' : 'default';
  const nodeCursor = panAffordance ? panCursor : mode === 'delete' ? 'pointer' : mode === 'addEdge' ? 'crosshair' : mode === 'addNode' ? 'default' : 'grab';

  const contextNode = contextMenu?.type === 'node' ? nodesById.get(contextMenu.targetId) : null;
  const contextEdge = contextMenu?.type === 'edge' ? edges.find((e) => e.id === contextMenu.targetId) : null;

  return (
    <div className={cn('h-full flex flex-col bg-[var(--bg)] overflow-hidden', className)}>
      <div className="flex items-center shrink-0">
        <div className="flex-1 min-w-0">
          <EditorToolbar
            mode={mode}
            onModeChange={setMode}
            onClear={clear}
            isDirected
            onToggleDirected={() => {}}
            hideDirected
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            rightSlot={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1" title="Pick a node type, then click the canvas to place it">
                  {KIND_PALETTE.map((item) => {
                    const active = mode === 'addNode' && nextNodeKind === item.kind;
                    return (
                      <button
                        key={item.kind}
                        onClick={() => pickKind(item.kind)}
                        title={item.title}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
                          active
                            ? 'border-[var(--accent)]/55 bg-[var(--accent-soft)]'
                            : 'border-transparent hover:bg-[var(--surface)]',
                        )}
                      >
                        <KindGlyph kind={item.kind} />
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-[var(--text-3)] font-mono tabular-nums shrink-0">
                  {nodes.length}N {edges.length}E
                </span>
              </div>
            }
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[var(--bg)]">
        <svg ref={svgRef} className="w-full h-full" style={{ cursor: svgCursor }}>
          <SvgDefs darkMode={darkMode} transform={transform} />
          <rect width="100%" height="100%" fill="url(#gt-dot-grid)" style={{ pointerEvents: 'none' }} />

          <g ref={mainGroupRef} className="main-group">
            {/* ── Edges ── */}
            <g className="edges-layer">
              {edges.map((edge) => {
                const src = nodesById.get(edge.source);
                const tgt = nodesById.get(edge.target);
                if (!src || !tgt) return null;
                const sp = liveNodePos(src.id, src.x ?? 0, src.y ?? 0);
                const tp = liveNodePos(tgt.id, tgt.x ?? 0, tgt.y ?? 0);
                const dx = tp.x - sp.x, dy = tp.y - sp.y;
                const angle = Math.atan2(dy, dx);
                const a = clipToBorder(sp.x, sp.y, angle, nodeExtent(src.kind));
                const b = clipToBorder(tp.x, tp.y, angle + Math.PI, nodeExtent(tgt.kind));

                const childAlgo = algo?.map.get(edge.target);
                const isPruned = childAlgo?.state === 'pruned';
                const isPath = !!algo && algo.activePath.has(edge.source) && algo.activePath.has(edge.target);
                const isSelected = selectedSet.has(edge.id);

                const style = isPath ? activeEdgeColors.path : isPruned ? activeEdgeColors.pruned : activeEdgeColors.directed;
                const stroke = isSelected ? (darkMode ? '#79C0FF' : '#2563EB') : style.stroke;
                const markerEnd = isPath ? 'url(#gt-arrow-path)' : 'url(#gt-arrow-default)';
                const mx = (sp.x + tp.x) / 2, my = (sp.y + tp.y) / 2;

                const label = edge.moveLabel ?? '';
                const probLabel = edge.probability != null ? `p=${edge.probability}` : (src.kind === 'chance' ? 'p=?' : '');

                return (
                  <g key={edge.id} className="edge-group" data-edge-id={edge.id}>
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={stroke} strokeWidth={style.width + (isSelected ? 1.2 : 0)} opacity={isSelected ? 1 : style.opacity}
                      markerEnd={markerEnd}
                      strokeDasharray={'dasharray' in style ? (style as { dasharray: string }).dasharray : undefined}
                      style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease' }}
                    />
                    <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y} stroke="transparent" strokeWidth={14}
                      style={{ cursor: panAffordance ? panCursor : mode === 'delete' ? 'pointer' : 'default' }} />
                    {isPath && (
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={darkMode ? '#E3B341' : '#B7950B'} strokeWidth={11} opacity={0.16} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                    )}
                    {(label || probLabel) && (
                      <g transform={`translate(${mx}, ${my})`} style={{ pointerEvents: 'none' }}>
                        <rect x={-26} y={-9} width={52} height={18} rx={4} fill={darkMode ? '#0F1117' : '#FFFFFF'} fillOpacity={darkMode ? 0.85 : 0.92} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontFamily="JetBrains Mono, monospace" fill={darkMode ? '#8B949E' : '#57606a'}>
                          {[label, probLabel].filter(Boolean).join('  ')}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            <line ref={tempEdgeRef} stroke="#F0883E" strokeWidth={2} strokeDasharray="6,4" visibility="hidden" style={{ pointerEvents: 'none' }} />

            {/* ── Nodes ── */}
            <g className="nodes-layer">
              {nodes.map((node) => {
                const pos = liveNodePos(node.id, node.x ?? 0, node.y ?? 0);
                const na = algo?.map.get(node.id);
                const theme = na ? activeNodeTheme[na.state] : activeKindTheme[node.kind];
                const glowFilter = na ? STATE_GLOW[na.state] : undefined;
                const ext = nodeExtent(node.kind);
                const isSelected = selectedSet.has(node.id);
                const dim = na?.state === 'explored' || na?.state === 'pruned';
                const selStroke = darkMode ? '#79C0FF' : '#2563EB';

                // Center text: terminal → value; internal during replay → backed-up score; else label.
                const centerText = node.kind === 'terminal'
                  ? formatScore(node.value ?? 0)
                  : na && na.score != null ? formatScore(na.score)
                  : (node.label ?? '');

                const showBounds = na && (na.alpha !== undefined || na.beta !== undefined) && node.kind !== 'terminal';

                return (
                  <g
                    key={node.id}
                    className="node-group"
                    data-node-id={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    filter={glowFilter ? `url(#${glowFilter})` : undefined}
                    opacity={dim ? 0.5 : 1}
                    style={{ cursor: nodeCursor, transition: 'filter 0.3s ease, opacity 0.3s ease' }}
                  >
                    {/* Root ring */}
                    {node.id === rootId && (
                      ext.shape === 'circle'
                        ? <circle r={ext.r + 5} fill="none" stroke="#A371F7" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3,2" style={{ pointerEvents: 'none' }} />
                        : <rect x={-ext.hw - 5} y={-ext.hh - 5} width={ext.hw * 2 + 10} height={ext.hh * 2 + 10} rx={6} fill="none" stroke="#A371F7" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3,2" style={{ pointerEvents: 'none' }} />
                    )}

                    {/* Body by kind */}
                    {ext.shape === 'circle' && (
                      <circle r={ext.r} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={isSelected ? selStroke : theme.border} strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth} style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }} />
                    )}
                    {ext.shape === 'square' && (
                      <rect x={-ext.hw} y={-ext.hh} width={ext.hw * 2} height={ext.hh * 2} rx={4} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={isSelected ? selStroke : theme.border} strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth} style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }} />
                    )}
                    {ext.shape === 'diamond' && (
                      <polygon points={`0,${-ext.r} ${ext.r},0 0,${ext.r} ${-ext.r},0`} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={isSelected ? selStroke : theme.border} strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth} style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }} />
                    )}
                    {ext.shape === 'rect' && (
                      <rect x={-ext.hw} y={-ext.hh} width={ext.hw * 2} height={ext.hh * 2} rx={9} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={isSelected ? selStroke : theme.border} strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth} style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }} />
                    )}

                    {/* Node id — always visible so it can be matched against panel chip ids (tXX);
                        idle internal nodes also get the kind glyph alongside it. */}
                    <title>{node.label ? `${node.id} — ${node.label}` : node.id}</title>
                    <text y={-ext.hh - 6} textAnchor="middle" fontSize={7.5} fontFamily="JetBrains Mono, monospace" fill={theme.text} opacity={0.8} style={{ pointerEvents: 'none' }}>
                      {!na && node.kind !== 'terminal' ? `${KIND_LABELS[node.kind]} · ${node.id}` : node.id}
                    </text>

                    {/* Center text */}
                    {centerText !== '' && (
                      <text y={0} textAnchor="middle" dominantBaseline="central" fill={theme.text} fontSize={12} fontWeight="bold" fontFamily="JetBrains Mono, monospace" style={{ pointerEvents: 'none', transition: 'fill 0.3s ease' }}>
                        {centerText}
                      </text>
                    )}

                    {/* Alpha/Beta window during replay */}
                    {showBounds && (
                      <text y={ext.hh + 12} textAnchor="middle" fontSize={8} fontFamily="JetBrains Mono, monospace" fill={theme.text} opacity={0.85} style={{ pointerEvents: 'none' }}>
                        α{formatBound(na?.alpha)} β{formatBound(na?.beta)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Mode badge */}
        <div className="ui-panel absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium pointer-events-none select-none">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: modeColors[mode] }} />
          <span className="text-[var(--text-2)]">{modeLabels[mode]}</span>
        </div>

        {/* Mode hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-[var(--text-3)] pointer-events-none select-none text-center">
          {mode === 'addNode' && `Click empty area to add a ${KIND_LABELS[nextNodeKind]} node • pick a shape at the top-right to change type`}
          {mode === 'addEdge' && 'Drag from a parent node to a child node'}
          {mode === 'delete' && 'Click node or edge to delete'}
          {mode === 'select' && 'Drag to move • Double-click a leaf to set its value • Right-click for options'}
        </div>

        {/* Edge-rejection toast */}
        {edgeError && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 rounded-md border border-[#FF7B72]/40 bg-[#FF7B72]/12 px-3 py-1.5 text-[10px] text-[#FF7B72] pointer-events-none">
            {edgeError}
          </div>
        )}

        {/* Context menu */}
        {contextMenu?.type === 'node' && contextNode && (
          <GameTreeContextMenu
            type="node"
            x={contextMenu.x}
            y={contextMenu.y}
            currentKind={contextNode.kind}
            isRoot={contextNode.id === rootId}
            onSetKind={(kind) => updateNode(contextNode.id, kind === 'terminal' ? { kind, value: contextNode.value ?? 0 } : { kind, value: undefined })}
            onSetRoot={() => setRoot(contextNode.id)}
            onEditValue={() => openValueEdit(contextNode.id, contextMenu.x, contextMenu.y)}
            onDelete={() => removeNode(contextNode.id)}
            onClose={() => setContextMenu(null)}
          />
        )}
        {contextMenu?.type === 'edge' && contextEdge && (
          <GameTreeContextMenu
            type="edge"
            x={contextMenu.x}
            y={contextMenu.y}
            canEditProbability={nodesById.get(contextEdge.source)?.kind === 'chance'}
            onEditProbability={() => openProbEdit(contextEdge.id, contextMenu.x, contextMenu.y)}
            onDelete={() => removeEdge(contextEdge.id)}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Inline value editor */}
        {valueTarget && (
          <div className="fixed z-50" style={{ left: valueTarget.x, top: valueTarget.y }}>
            <input
              ref={valueInputRef}
              type="number"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              className="ui-input px-2 py-1 text-sm w-28 shadow-lg"
              placeholder="Leaf value"
              onKeyDown={(e) => { if (e.key === 'Enter') commitValue(); else if (e.key === 'Escape') setValueTarget(null); }}
              onBlur={commitValue}
            />
          </div>
        )}

        {/* Inline probability editor */}
        {probTarget && (
          <div className="fixed z-50" style={{ left: probTarget.x, top: probTarget.y }}>
            <input
              ref={probInputRef}
              type="number"
              value={probInput}
              step="0.05"
              min="0"
              max="1"
              className="ui-input px-2 py-1 text-sm w-28 shadow-lg"
              placeholder="probability"
              onChange={(e) => setProbInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitProb(); else if (e.key === 'Escape') setProbTarget(null); }}
              onBlur={commitProb}
            />
          </div>
        )}

        {/* Selection marquee */}
        {selectionBox && (
          <div className="fixed z-30 pointer-events-none border border-[var(--accent)] bg-[var(--accent)]/12 rounded-sm"
            style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />
        )}

        <GraphMinimap
          nodes={minimapNodes}
          transform={transform}
          canvasWidth={canvasDims.w}
          canvasHeight={canvasDims.h}
          storageKey="praxis:tree-minimap-position"
          onViewJump={(x, y) => jumpTo(x, y)}
          onZoomIn={() => zoomIn()}
          onZoomOut={() => zoomOut()}
          onFit={() => fit()}
          onAutoLayout={handleAutoLayout}
        />
      </div>
    </div>
  );
}
