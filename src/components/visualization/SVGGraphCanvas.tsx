import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/cn';
import EditorToolbar, { type EditorMode } from '@/components/editor/EditorToolbar';
import GraphMinimap from '@/components/visualization/GraphMinimap';
import { useEditorStore } from '@/store/useEditorStore';
import { useGraphInteractions } from '@/hooks/useGraphInteractions';
import { usePreferencesStore } from '@/store/preferences.store';
import type { ElementDefinition } from 'cytoscape';
import {
  NODE_THEME,
  NODE_THEME_LIGHT,
  EDGE_COLORS,
  EDGE_COLORS_LIGHT,
  NODE_W,
  NODE_H,
  NODE_RX,
  GRID_SNAP,
} from './svg-graph.types';
import type { SVGNodeVM, SVGEdgeVM, NodeVisualState } from './svg-graph.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SVGGraphCanvasProps {
  algorithmElements: ElementDefinition[];
  snapToGrid?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Context menu / inline editor types
// ---------------------------------------------------------------------------
interface ContextMenu {
  x: number;
  y: number;
  type: 'node' | 'edge';
  targetId: string;
}

interface RenameTarget {
  nodeId: string;
  label: string;
  x: number;
  y: number;
}

interface WeightTarget {
  edgeId: string;
  weight: string;
  x: number;
  y: number;
}

interface HeuristicTarget {
  nodeId: string;
  heuristic: string;
  x: number;
  y: number;
}

interface HoveredNodeTooltip {
  nodeId: string;
  label: string;
  state: NodeVisualState;
  gCost?: number;
  hCost?: number;
  fCost?: number;
  manualHeuristic?: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers: convert Cytoscape ElementDefinition[] to view models
// ---------------------------------------------------------------------------
function resolveNodeState(classes: string[]): NodeVisualState {
  if (classes.includes('current')) return 'current';
  if (classes.includes('path')) return 'path';
  if (classes.includes('frontier')) return 'frontier';
  if (classes.includes('explored')) return 'explored';
  if (classes.includes('pruned')) return 'pruned';
  if (classes.includes('goal')) return 'goal';
  if (classes.includes('start')) return 'start';
  return 'normal';
}

function elementsToViewModels(
  elements: ElementDefinition[],
  editorNodes: Array<{ id: string; x?: number; y?: number }>,
  isDirected: boolean,
): { nodeVMs: SVGNodeVM[]; edgeVMs: SVGEdgeVM[] } {
  const nodeVMs: SVGNodeVM[] = [];
  const edgeVMs: SVGEdgeVM[] = [];

  for (const el of elements) {
    if (el.data?.source != null) {
      // Edge
      const rawClasses = el.classes ?? '';
      const classes = (Array.isArray(rawClasses) ? rawClasses : rawClasses.split(' ')).filter(Boolean);
      edgeVMs.push({
        id: el.data.id as string,
        sourceId: el.data.source as string,
        targetId: el.data.target as string,
        weight: (el.data.weight as number) ?? 1,
        isDirected,
        isPath: classes.includes('path-edge'),
        isPruned: classes.includes('pruned-edge'),
      });
    } else {
      // Node
      const rawClasses = el.classes ?? '';
      const classes = (Array.isArray(rawClasses) ? rawClasses : rawClasses.split(' ')).filter(Boolean);
      const editorNode = editorNodes.find(n => n.id === el.data?.id);
      const rawLabel = (el.data?.label as string) ?? (el.data?.id as string) ?? '';
      // Split multi-line label — first line is name, rest are cost annotations
      const labelLines = rawLabel.split('\n');

      let gCost: number | undefined;
      let hCost: number | undefined;
      let fCost: number | undefined;

      if (el.data?.gCost != null) gCost = el.data.gCost as number;
      if (el.data?.hCost != null) hCost = el.data.hCost as number;
      if (el.data?.fCost != null) fCost = el.data.fCost as number;

      nodeVMs.push({
        id: el.data?.id as string,
        label: labelLines[0],
        x: el.position?.x ?? editorNode?.x ?? 0,
        y: el.position?.y ?? editorNode?.y ?? 0,
        state: resolveNodeState(classes),
        isStart: classes.includes('start'),
        isGoal: classes.includes('goal'),
        gCost,
        hCost,
        fCost,
      });
    }
  }

  return { nodeVMs, edgeVMs };
}

// ---------------------------------------------------------------------------
// Geometry: compute edge endpoints at node borders
// ---------------------------------------------------------------------------
function borderIntersection(
  cx: number, cy: number,
  angle: number,
  hw: number, hh: number,
  isCircle: boolean = false
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  
  if (isCircle) {
    return { x: cx + hw * cosA, y: cy + hh * sinA };
  }

  const tx = cosA !== 0 ? hw / Math.abs(cosA) : Infinity;
  const ty = sinA !== 0 ? hh / Math.abs(sinA) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + t * cosA, y: cy + t * sinA };
}

function getEdgeEndpoints(
  sx: number, sy: number,
  tx: number, ty: number,
  srcIsCircle: boolean = false,
  tgtIsCircle: boolean = false,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  if (dx === 0 && dy === 0) return { x1: sx, y1: sy, x2: tx, y2: ty };

  const angle = Math.atan2(dy, dx);
  const srcHW = srcIsCircle ? 16 : NODE_W / 2;
  const srcHH = srcIsCircle ? 16 : NODE_H / 2;
  const tgtHW = tgtIsCircle ? 16 : NODE_W / 2;
  const tgtHH = tgtIsCircle ? 16 : NODE_H / 2;

  const src = borderIntersection(sx, sy, angle, srcHW, srcHH, srcIsCircle);
  const tgt = borderIntersection(tx, ty, angle + Math.PI, tgtHW, tgtHH, tgtIsCircle);

  return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
}

function fitNodeLabel(label: string): { displayLabel: string; fontSize: number } {
  const trimmed = label.trim();
  if (trimmed.length <= 9) return { displayLabel: trimmed, fontSize: 11 };
  if (trimmed.length <= 12) return { displayLabel: trimmed, fontSize: 10 };
  return { displayLabel: `${trimmed.slice(0, 11).trimEnd()}…`, fontSize: 9 };
}

// ---------------------------------------------------------------------------
// SVG Defs: Arrow markers + Glow filters
// ---------------------------------------------------------------------------
function SvgDefs({ darkMode, transform }: { darkMode: boolean; transform?: d3.ZoomTransform }) {
  return (
    <defs>
      {/* Scaling dot grid pattern */}
      <pattern 
        id="dot-grid-pattern" 
        x="0" y="0" 
        width={GRID_SNAP} 
        height={GRID_SNAP} 
        patternUnits="userSpaceOnUse"
        patternTransform={transform?.toString()}
      >
        <circle 
          cx="1" cy="1" r="1.2" 
          fill={darkMode ? '#38bdf8' : '#1e293b'} 
          fillOpacity={darkMode ? 0.12 : 0.18} 
        />
      </pattern>

      {/* Arrow markers — one per edge color */}
      <marker id="arrow-default" viewBox="0 -5 10 10" refX="10" refY="0"
        markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#8B949E" />
      </marker>
      <marker id="arrow-path" viewBox="0 -5 10 10" refX="10" refY="0"
        markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#58A6FF" />
      </marker>

      {/* Glow filters */}
      {[
        { id: 'glow-current', color: '#F0883E', std: 8, opacity: 0.9 },
        { id: 'glow-frontier', color: '#58A6FF', std: 6, opacity: 0.65 },
        { id: 'glow-goal', color: '#3FB950', std: 8, opacity: 0.8 },
        { id: 'glow-start', color: '#A371F7', std: 7, opacity: 0.7 },
        { id: 'glow-path', color: '#E3B341', std: 7, opacity: 0.7 },
      ].map(({ id, color, std, opacity }) => (
        <filter key={id} id={id} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={std} result="blur" />
          <feFlood floodColor={color} floodOpacity={opacity} />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ))}
    </defs>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SVGGraphCanvas({
  algorithmElements,
  snapToGrid = false,
  className,
}: SVGGraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mainGroupRef = useRef<SVGGElement>(null);
  const tempEdgeRef = useRef<SVGLineElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const darkMode = usePreferencesStore((s) => s.darkMode);
  const activeNodeTheme = darkMode ? NODE_THEME : NODE_THEME_LIGHT;
  const activeEdgeColors = darkMode ? EDGE_COLORS : EDGE_COLORS_LIGHT;

  const [mode, setMode] = useState<EditorMode>('select');
  const [liveDrag, setLiveDrag] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameCommittedRef = useRef(false);
  const [weightTarget, setWeightTarget] = useState<WeightTarget | null>(null);
  const [weightValue, setWeightValue] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);
  const weightCommittedRef = useRef(false);
  const [heuristicTarget, setHeuristicTarget] = useState<HeuristicTarget | null>(null);
  const [heuristicValue, setHeuristicValue] = useState('');
  const heuristicInputRef = useRef<HTMLInputElement>(null);
  const heuristicCommittedRef = useRef(false);
  const [hoveredNodeTooltip, setHoveredNodeTooltip] = useState<HoveredNodeTooltip | null>(null);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });

  const {
    nodes,
    edges,
    addNode,
    addEdge,
    removeNode,
    removeEdge,
    setStartNode,
    setGoalNode,
    updateNode,
    updateEdge,
    batchUpdateNodes,
    setSelected,
    clear,
    isDirected,
    setDirected,
    startNodeId,
    goalNodeId,
    undo,
    redo,
  } = useEditorStore();

  const canUndo = useEditorStore(s => s.past.length > 0);
  const canRedo = useEditorStore(s => s.future.length > 0);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ── Build view models ────────────────────────────────────────────────────

  // Editor-only elements (when no algorithm step is active)
  const editorVMs = useMemo(() => {
    const nodeVMs: SVGNodeVM[] = nodes.map(n => ({
      id: n.id,
      label: n.label ?? n.id,
      x: n.x ?? 0,
      y: n.y ?? 0,
      state: (n.id === startNodeId ? 'start' : n.id === goalNodeId ? 'goal' : 'normal') as NodeVisualState,
      isStart: n.id === startNodeId,
      isGoal: n.id === goalNodeId,
      gCost: undefined,
      hCost: undefined,
      fCost: undefined,
    }));
    const edgeVMs: SVGEdgeVM[] = edges.map(e => ({
      id: e.id,
      sourceId: e.source,
      targetId: e.target,
      weight: e.weight,
      isDirected,
      isPath: false,
      isPruned: false,
    }));
    return { nodeVMs, edgeVMs };
  }, [nodes, edges, startNodeId, goalNodeId, isDirected]);

  // Algorithm-colored elements
  const algoVMs = useMemo(() => {
    if (algorithmElements.length === 0) return null;
    return elementsToViewModels(algorithmElements, nodes, isDirected);
  }, [algorithmElements, nodes, isDirected]);

  const { nodeVMs, edgeVMs } = algoVMs ?? editorVMs;

  // Node position map for interactions
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of nodeVMs) map.set(n.id, { x: n.x, y: n.y });
    return map;
  }, [nodeVMs]);

  // Node VM map for O(1) edge source/target lookup
  const nodeVMMap = useMemo(() => {
    const m = new Map<string, SVGNodeVM>();
    for (const n of nodeVMs) m.set(n.id, n);
    return m;
  }, [nodeVMs]);

  const manualHeuristicById = useMemo(() => {
    const m = new Map<string, number | undefined>();
    for (const node of nodes) m.set(node.id, node.heuristic);
    return m;
  }, [nodes]);

  // ── Rename / weight helpers ──────────────────────────────────────────────

  const openRename = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodes.find(n => n.id === nodeId);
    const label = node?.label ?? nodeId;
    renameCommittedRef.current = false;
    setContextMenu(null);
    setRenameTarget({ nodeId, label, x, y });
  }, [nodes]);

  const openWeightEdit = useCallback((edgeId: string, x: number, y: number) => {
    const edge = edges.find(e => e.id === edgeId);
    const weight = String(edge?.weight ?? 1);
    weightCommittedRef.current = false;
    setContextMenu(null);
    setWeightTarget({ edgeId, weight, x, y });
  }, [edges]);

  const openHeuristicEdit = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodes.find(n => n.id === nodeId);
    const heuristic = node?.heuristic == null ? '' : String(node.heuristic);
    heuristicCommittedRef.current = false;
    setContextMenu(null);
    setHeuristicTarget({ nodeId, heuristic, x, y });
  }, [nodes]);

  useEffect(() => {
    if (renameTarget) {
      setRenameValue(renameTarget.label);
      const t = setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 0);
      return () => clearTimeout(t);
    }
  }, [renameTarget]);

  useEffect(() => {
    if (weightTarget) {
      setWeightValue(weightTarget.weight);
      const t = setTimeout(() => { weightInputRef.current?.focus(); weightInputRef.current?.select(); }, 0);
      return () => clearTimeout(t);
    }
  }, [weightTarget]);

  useEffect(() => {
    if (heuristicTarget) {
      setHeuristicValue(heuristicTarget.heuristic);
      const t = setTimeout(() => { heuristicInputRef.current?.focus(); heuristicInputRef.current?.select(); }, 0);
      return () => clearTimeout(t);
    }
  }, [heuristicTarget]);

  const commitRename = useCallback(() => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    const val = renameValue.trim();
    if (val && renameTarget) updateNode(renameTarget.nodeId, { label: val });
    setRenameTarget(null);
  }, [renameValue, renameTarget, updateNode]);

  const cancelRename = useCallback(() => { renameCommittedRef.current = true; setRenameTarget(null); }, []);

  const commitWeight = useCallback(() => {
    if (weightCommittedRef.current) return;
    weightCommittedRef.current = true;
    const num = Number(weightValue.trim());
    if (weightTarget && weightValue.trim() !== '' && !isNaN(num) && num > 0) {
      updateEdge(weightTarget.edgeId, { weight: num });
    }
    setWeightTarget(null);
  }, [weightValue, weightTarget, updateEdge]);

  const cancelWeight = useCallback(() => { weightCommittedRef.current = true; setWeightTarget(null); }, []);

  const commitHeuristic = useCallback(() => {
    if (heuristicCommittedRef.current) return;
    heuristicCommittedRef.current = true;
    if (heuristicTarget) {
      const raw = heuristicValue.trim();
      if (raw === '') {
        updateNode(heuristicTarget.nodeId, { heuristic: undefined });
      } else {
        const num = Number(raw);
        if (Number.isFinite(num)) {
          updateNode(heuristicTarget.nodeId, { heuristic: num });
        }
      }
    }
    setHeuristicTarget(null);
  }, [heuristicTarget, heuristicValue, updateNode]);

  const cancelHeuristic = useCallback(() => {
    heuristicCommittedRef.current = true;
    setHeuristicTarget(null);
  }, []);

  // ── Event handlers ───────────────────────────────────────────────────────

  const handleNodeClick = useCallback((nodeId: string, meta: { append: boolean }) => {
    setContextMenu(null);
    if (mode === 'delete') {
      removeNode(nodeId);
      return;
    }
    if (mode === 'select') {
      if (meta.append) {
        setSelected(selectedSet.has(nodeId)
          ? selectedIds.filter(id => id !== nodeId)
          : [...selectedIds, nodeId]);
      } else {
        setSelected([nodeId]);
      }
    }
  }, [mode, removeNode, selectedIds, selectedSet, setSelected]);

  const handleNodeRightClick = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setRenameTarget(null);
    setWeightTarget(null);
    setHeuristicTarget(null);
    setHoveredNodeTooltip(null);
    setContextMenu({ x: pos.x, y: pos.y, type: 'node', targetId: nodeId });
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (mode !== 'select') return;
    openRename(nodeId, pos.x, pos.y);
  }, [mode, openRename]);

  const handleEdgeClick = useCallback((edgeId: string, meta: { append: boolean }) => {
    setContextMenu(null);
    if (mode === 'delete') {
      removeEdge(edgeId);
      return;
    }
    if (mode === 'select') {
      if (meta.append) {
        setSelected(selectedSet.has(edgeId)
          ? selectedIds.filter(id => id !== edgeId)
          : [...selectedIds, edgeId]);
      } else {
        setSelected([edgeId]);
      }
    }
  }, [mode, removeEdge, selectedIds, selectedSet, setSelected]);

  const handleEdgeRightClick = useCallback((edgeId: string, pos: { x: number; y: number }) => {
    setRenameTarget(null);
    setWeightTarget(null);
    setHeuristicTarget(null);
    setHoveredNodeTooltip(null);
    setContextMenu({ x: pos.x, y: pos.y, type: 'edge', targetId: edgeId });
  }, []);

  const handleEdgeDoubleClick = useCallback((edgeId: string, pos: { x: number; y: number }) => {
    if (mode !== 'select') return;
    openWeightEdit(edgeId, pos.x, pos.y);
  }, [mode, openWeightEdit]);

  const handleBgClick = useCallback((pos: { x: number; y: number }) => {
    setContextMenu(null);
    if (mode === 'addNode') {
      addNode({ x: pos.x, y: pos.y });
    }
  }, [mode, addNode]);

  const handleEmptyClick = useCallback((meta: { append: boolean }) => {
    if (mode !== 'select') return;
    if (!meta.append) {
      setSelected([]);
    }
  }, [mode, setSelected]);

  const handleSelectionBoxComplete = useCallback((payload: { nodeIds: string[]; edgeIds: string[]; append: boolean }) => {
    const ids = [...payload.nodeIds, ...payload.edgeIds];
    if (!payload.append) {
      setSelected(ids);
      return;
    }
    const merged = new Set(selectedIds);
    for (const id of ids) merged.add(id);
    setSelected(Array.from(merged));
  }, [selectedIds, setSelected]);

  const handleEdgeAdded = useCallback((sourceId: string, targetId: string) => {
    addEdge(sourceId, targetId, 1);
  }, [addEdge]);

  const handleNodeMoved = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setLiveDrag(null);
    updateNode(nodeId, { x: position.x, y: position.y });
  }, [updateNode]);

  // ── D3 interactions ──────────────────────────────────────────────────────

  const {
    transform,
    zoomLevel,
    selectionBox,
    fit,
    jumpTo,
    zoomIn,
    zoomOut,
    runAutoLayout,
  } = useGraphInteractions({
    svgRef,
    mainGroupRef,
    tempEdgeRef,
    mode,
    nodePositions,
    edgeData: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
    nodeHitRadius: 40,
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
    snapToGrid,
  });

  // ── Keyboard shortcuts (undo/redo) ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Auto-layout handler ──────────────────────────────────────────────────

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const layoutNodes = nodes.map(n => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
    const layoutEdges = edges.map(e => ({ source: e.source, target: e.target }));
    const results = runAutoLayout(layoutNodes, layoutEdges);
    batchUpdateNodes(results);
    // Fit after layout
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => fit(), 50);
  }, [nodes, edges, runAutoLayout, batchUpdateNodes, fit]);

  // ── Track container dimensions ───────────────────────────────────────────

  // Cleanup fitTimerRef on unmount
  useEffect(() => {
    return () => { if (fitTimerRef.current) clearTimeout(fitTimerRef.current); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Mode badge colors ────────────────────────────────────────────────────

  const modeColors: Record<EditorMode, string> = {
    select: '#58A6FF',
    addNode: '#3FB950',
    addEdge: '#F0883E',
    delete: '#FF7B72',
  };

  const modeLabels: Record<EditorMode, string> = {
    select: 'Select',
    addNode: 'Add Node',
    addEdge: 'Add Edge',
    delete: 'Delete',
  };

  // ── Live position helper (fluid drag) ────────────────────────────────────

  function liveNodePos(node: SVGNodeVM): { x: number; y: number } {
    if (liveDrag && liveDrag.nodeId === node.id) return { x: liveDrag.x, y: liveDrag.y };
    return { x: node.x, y: node.y };
  }

  // ── Cursors based on mode ────────────────────────────────────────────────

  const svgCursor = mode === 'addNode' ? 'crosshair'
    : mode === 'addEdge' ? 'default'
    : mode === 'delete' ? 'pointer'
    : 'grab';

  const nodeCursor = mode === 'delete' ? 'pointer'
    : mode === 'addEdge' ? 'crosshair'
    : 'grab';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('h-full flex flex-col bg-[var(--bg)] overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center shrink-0">
        <div className="flex-1 min-w-0">
          <EditorToolbar
            mode={mode}
            onModeChange={setMode}
            onClear={clear}
            isDirected={isDirected}
            onToggleDirected={() => setDirected(!isDirected)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            rightSlot={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-3)] font-mono tabular-nums">
                  {nodes.length}N {edges.length}E
                </span>
              </div>
            }
          />
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[var(--bg)]">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: svgCursor }}
        >
          <SvgDefs darkMode={darkMode} transform={transform} />

          {/* ── Background Grid (Infinite) ─────────────────────────── */}
          <rect 
            width="100%" height="100%" 
            fill="url(#dot-grid-pattern)" 
            style={{ pointerEvents: 'none' }}
          />

          <g ref={mainGroupRef} className="main-group">
            {/* ── Edge layer ─────────────────────────────────────────── */}
            <g className="edges-layer">
              {edgeVMs.map(edge => {
                const srcNode = nodeVMMap.get(edge.sourceId);
                const tgtNode = nodeVMMap.get(edge.targetId);
                if (!srcNode || !tgtNode) return null;
                const isSelected = selectedSet.has(edge.id);

                const srcPos = liveNodePos(srcNode);
                const tgtPos = liveNodePos(tgtNode);
                const srcIsCircle = srcNode.label.length <= 2;
                const tgtIsCircle = tgtNode.label.length <= 2;
                const { x1, y1, x2, y2 } = getEdgeEndpoints(
                  srcPos.x, srcPos.y, tgtPos.x, tgtPos.y,
                  srcIsCircle, tgtIsCircle
                );

                const style = edge.isPath ? activeEdgeColors.path
                  : edge.isPruned ? activeEdgeColors.pruned
                  : edge.isDirected ? activeEdgeColors.directed
                  : activeEdgeColors.normal;
                const stroke = isSelected ? (darkMode ? '#79C0FF' : '#2563EB') : style.stroke;
                const strokeWidth = style.width + (isSelected ? 1.2 : 0);
                const opacity = isSelected ? 1 : style.opacity;

                const markerEnd = edge.isDirected
                  ? (edge.isPath ? 'url(#arrow-path)' : 'url(#arrow-default)')
                  : undefined;

                const mx = (srcPos.x + tgtPos.x) / 2;
                const my = (srcPos.y + tgtPos.y) / 2;

                return (
                  <g key={edge.id} className="edge-group" data-edge-id={edge.id}>
                    {/* Visible edge line */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      markerEnd={markerEnd}
                      strokeDasharray={'dasharray' in style ? (style as { dasharray: string }).dasharray : undefined}
                      style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease' }}
                    />
                    {/* Invisible wide hit target for easier clicking */}
                    <line
                      x1={srcPos.x} y1={srcPos.y} x2={tgtPos.x} y2={tgtPos.y}
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ cursor: mode === 'delete' ? 'pointer' : 'default' }}
                    />
                    {/* Weight label */}
                    {edge.weight !== 1 && (
                      <g transform={`translate(${mx}, ${my})`}>
                        <rect
                          x={-14} y={-8}
                          width={28} height={16}
                          rx={3}
                          fill={darkMode ? '#0F1117' : '#FFFFFF'}
                          fillOpacity={darkMode ? 0.88 : 0.92}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={darkMode ? '#5A6478' : '#6B7280'}
                          fontSize={10}
                          fontFamily="JetBrains Mono, Fira Code, monospace"
                          style={{ pointerEvents: 'none' }}
                        >
                          {edge.weight}
                        </text>
                      </g>
                    )}
                    {/* Path edge glow (extra wide faint line behind) */}
                    {edge.isPath && (
                      <line
                        x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={darkMode ? '#58A6FF' : '#2563EB'}
                        strokeWidth={12}
                        opacity={0.15}
                        strokeLinecap="round"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Temp edge for edge-drawing mode ────────────────────── */}
            <line
              ref={tempEdgeRef}
              stroke="#58A6FF"
              strokeWidth={2}
              strokeDasharray="6,4"
              visibility="hidden"
              style={{ pointerEvents: 'none' }}
            />

            {/* ── Node layer ─────────────────────────────────────────── */}
            <g className="nodes-layer">
              {nodeVMs.map(node => {
                const theme = activeNodeTheme[node.state];
                const isCircle = node.label.length <= 2;
                const r = 16;
                const w = NODE_W;
                const h = NODE_H;
                const isExplored = node.state === 'explored';
                const isSelected = selectedSet.has(node.id);

                return (
                  <g
                    key={node.id}
                    className="node-group"
                    data-node-id={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    filter={theme.glowFilter ? `url(#${theme.glowFilter})` : undefined}
                    opacity={isExplored ? 0.5 : 1}
                    onMouseEnter={(e) => {
                      const manualHeuristic = manualHeuristicById.get(node.id);
                      setHoveredNodeTooltip({
                        nodeId: node.id,
                        label: node.label,
                        state: node.state,
                        gCost: node.gCost,
                        hCost: node.hCost,
                        fCost: node.fCost,
                        manualHeuristic,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      setHoveredNodeTooltip(prev => prev && prev.nodeId === node.id
                        ? { ...prev, x: e.clientX, y: e.clientY }
                        : prev);
                    }}
                    onMouseLeave={() => setHoveredNodeTooltip(prev => prev?.nodeId === node.id ? null : prev)}
                    style={{
                      cursor: nodeCursor,
                      transition: 'filter 0.3s ease, opacity 0.3s ease',
                    }}
                  >
                    {/* Node body */}
                    {isCircle ? (
                      <circle
                        cx={0} cy={0}
                        r={r}
                        fill={theme.fill}
                        fillOpacity={theme.fillOpacity}
                        stroke={isSelected ? (darkMode ? '#79C0FF' : '#2563EB') : theme.border}
                        strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth}
                        style={{ transition: 'fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease' }}
                      />
                    ) : (
                      <rect
                        x={-w / 2} y={-h / 2}
                        width={w} height={h}
                        rx={NODE_RX}
                        fill={theme.fill}
                        fillOpacity={theme.fillOpacity}
                        stroke={isSelected ? (darkMode ? '#79C0FF' : '#2563EB') : theme.border}
                        strokeWidth={isSelected ? theme.borderWidth + 1.4 : theme.borderWidth}
                        style={{ transition: 'fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease' }}
                      />
                    )}
                    {isSelected && (
                      isCircle ? (
                        <circle
                          cx={0} cy={0}
                          r={r + 3}
                          fill="none"
                          stroke={darkMode ? '#79C0FF' : '#2563EB'}
                          strokeOpacity={0.5}
                          strokeWidth={1}
                          style={{ pointerEvents: 'none' }}
                        />
                      ) : (
                        <rect
                          x={-w / 2 - 3} y={-h / 2 - 3}
                          width={w + 6} height={h + 6}
                          rx={NODE_RX + 2}
                          fill="none"
                          stroke={darkMode ? '#79C0FF' : '#2563EB'}
                          strokeOpacity={0.5}
                          strokeWidth={1}
                          style={{ pointerEvents: 'none' }}
                        />
                      )
                    )}
                    {/* Label */}
                    {(() => {
                      const { displayLabel, fontSize } = fitNodeLabel(node.label);
                      return (
                        <text
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={theme.text}
                          fontSize={fontSize}
                          fontFamily="JetBrains Mono, Fira Code, monospace"
                          fontWeight={node.isStart || node.isGoal || node.state === 'path' ? 'bold' : 'normal'}
                          style={{ pointerEvents: 'none', transition: 'fill 0.3s ease' }}
                        >
                          {displayLabel}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* ── HTML Overlays ──────────────────────────────────────────── */}

        {/* Mode badge (top-left) */}
        <div className="ui-panel absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium pointer-events-none select-none">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: modeColors[mode] }} />
          <span className="text-[var(--text-2)]">{modeLabels[mode]}</span>
        </div>

        {/* Mode hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-[var(--text-3)] pointer-events-none select-none">
          {mode === 'addNode' && 'Click empty area to add node'}
          {mode === 'addEdge' && 'Drag from source node to target node'}
          {mode === 'delete' && 'Click node or edge to delete'}
          {mode === 'select' && 'Drag to move • Drag empty space to select • Right-drag to pan • Scroll to zoom'}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="ui-menu fixed z-[110] rounded-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'node' && (
              <>
                <button className="ui-menu-item text-[var(--text)]"
                  onClick={() => openRename(contextMenu.targetId, contextMenu.x, contextMenu.y)}>
                  Rename Node
                </button>
                <button className="ui-menu-item ui-menu-item-accent"
                  onClick={() => openHeuristicEdit(contextMenu.targetId, contextMenu.x, contextMenu.y)}>
                  Edit h(n)
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button className="ui-menu-item ui-menu-item-purple"
                  onClick={() => { setStartNode(contextMenu.targetId); setContextMenu(null); }}>
                  Set as Start
                </button>
                <button className="ui-menu-item ui-menu-item-success"
                  onClick={() => { setGoalNode(contextMenu.targetId); setContextMenu(null); }}>
                  Set as Goal
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button className="ui-menu-item ui-menu-item-danger"
                  onClick={() => { removeNode(contextMenu.targetId); setContextMenu(null); }}>
                  Delete Node
                </button>
              </>
            )}
            {contextMenu.type === 'edge' && (
              <>
                <button className="ui-menu-item text-[var(--text)]"
                  onClick={() => openWeightEdit(contextMenu.targetId, contextMenu.x, contextMenu.y)}>
                  Edit Weight
                </button>
                <div className="border-t border-[var(--border)] my-1" />
                <button className="ui-menu-item ui-menu-item-danger"
                  onClick={() => { removeEdge(contextMenu.targetId); setContextMenu(null); }}>
                  Delete Edge
                </button>
              </>
            )}
            <button className="ui-menu-item"
              onClick={() => setContextMenu(null)}>
              Cancel
            </button>
          </div>
        )}

        {/* Inline rename input */}
        {renameTarget && (
          <div className="fixed z-50" style={{ left: renameTarget.x, top: renameTarget.y }}>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="ui-input px-2 py-1 text-sm w-32 shadow-lg"
              placeholder="Node label"
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') cancelRename(); }}
              onBlur={commitRename}
            />
          </div>
        )}

        {/* Inline weight edit input */}
        {weightTarget && (
          <div className="fixed z-50" style={{ left: weightTarget.x, top: weightTarget.y }}>
            <input
              ref={weightInputRef}
              type="number"
              value={weightValue}
              min="0.01"
              step="1"
              onChange={e => setWeightValue(e.target.value)}
              className="ui-input px-2 py-1 text-sm w-32 shadow-lg"
              placeholder="Weight"
              onKeyDown={e => { if (e.key === 'Enter') commitWeight(); else if (e.key === 'Escape') cancelWeight(); }}
              onBlur={commitWeight}
            />
          </div>
        )}

        {/* Inline heuristic edit input */}
        {heuristicTarget && (
          <div className="fixed z-50" style={{ left: heuristicTarget.x, top: heuristicTarget.y }}>
            <input
              ref={heuristicInputRef}
              type="number"
              value={heuristicValue}
              step="0.1"
              className="ui-input px-2 py-1 text-sm w-32 shadow-lg"
              placeholder="h(n)"
              onChange={e => setHeuristicValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitHeuristic(); else if (e.key === 'Escape') cancelHeuristic(); }}
              onBlur={commitHeuristic}
            />
          </div>
        )}

        {/* Hover tooltip with algorithm costs */}
        {hoveredNodeTooltip && (
          <div
            className="fixed z-40 pointer-events-none min-w-[156px] rounded-md border border-[var(--border)] bg-[var(--surface)]/95 shadow-lg backdrop-blur px-2 py-1.5"
            style={{ left: hoveredNodeTooltip.x + 14, top: hoveredNodeTooltip.y + 14 }}
          >
            <div className="text-[10px] text-[var(--text)] font-semibold leading-none mb-1">
              {hoveredNodeTooltip.label}
            </div>
            <div className="text-[9px] text-[var(--text-3)] font-mono mb-1">{hoveredNodeTooltip.nodeId}</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono text-[var(--text-2)]">
              <span>g(n)</span>
              <span className="text-right">{hoveredNodeTooltip.gCost == null ? '-' : formatCost(hoveredNodeTooltip.gCost)}</span>
              <span>h(n)</span>
              <span className="text-right">{hoveredNodeTooltip.hCost == null ? '-' : formatCost(hoveredNodeTooltip.hCost)}</span>
              <span>f(n)</span>
              <span className="text-right">{hoveredNodeTooltip.fCost == null ? '-' : formatCost(hoveredNodeTooltip.fCost)}</span>
              <span>manual h</span>
              <span className="text-right">{hoveredNodeTooltip.manualHeuristic == null ? '-' : formatCost(hoveredNodeTooltip.manualHeuristic)}</span>
            </div>
          </div>
        )}

        {/* Drag-selection marquee */}
        {selectionBox && (
          <div
            className="fixed z-30 pointer-events-none border border-[var(--accent)] bg-[var(--accent)]/12 rounded-sm"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

        {/* Minimap */}
        <GraphMinimap
          nodes={nodeVMs}
          transform={transform}
          canvasWidth={canvasDims.w}
          canvasHeight={canvasDims.h}
          zoomLevel={zoomLevel}
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

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function formatCost(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
