import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { EditorMode } from '@/components/editor/EditorToolbar';
import { GRID_SNAP } from '@/components/visualization/svg-graph.types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
interface UseGraphInteractionsOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  mainGroupRef: React.RefObject<SVGGElement | null>;
  tempEdgeRef: React.RefObject<SVGLineElement | null>;
  mode: EditorMode;
  /** Node positions keyed by node id — used for fit calculation and edge-draw hit testing */
  nodePositions: Map<string, { x: number; y: number }>;
  nodeHitRadius: number;
  onBackgroundClick: (pos: { x: number; y: number }) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeRightClick: (nodeId: string, screenPos: { x: number; y: number }) => void;
  onNodeDoubleClick: (nodeId: string, screenPos: { x: number; y: number }) => void;
  onEdgeClick: (edgeId: string) => void;
  onEdgeRightClick: (edgeId: string, screenPos: { x: number; y: number }) => void;
  onEdgeDoubleClick: (edgeId: string, screenPos: { x: number; y: number }) => void;
  onNodeMoved: (nodeId: string, position: { x: number; y: number }) => void;
  onEdgeAdded: (sourceId: string, targetId: string) => void;
  onNodeDragging?: (nodeId: string, pos: { x: number; y: number }) => void;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
interface UseGraphInteractionsReturn {
  transform: d3.ZoomTransform;
  zoomLevel: number;
  fit: (padding?: number) => void;
  runAutoLayout: (
    nodes: Array<{ id: string; x: number; y: number }>,
    edges: Array<{ source: string; target: string }>,
  ) => Array<{ id: string; x: number; y: number }>;
  screenToGraph: (screenX: number, screenY: number) => { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useGraphInteractions(options: UseGraphInteractionsOptions): UseGraphInteractionsReturn {
  const {
    svgRef,
    mainGroupRef,
    tempEdgeRef,
    mode,
    nodePositions,
    nodeHitRadius,
    onBackgroundClick,
    onNodeClick,
    onNodeRightClick,
    onNodeDoubleClick,
    onEdgeClick,
    onEdgeRightClick,
    onEdgeDoubleClick,
    onNodeMoved,
    onEdgeAdded,
  } = options;

  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track drag state to distinguish click from drag
  const draggedRef = useRef(false);

  // ── Zoom / Pan setup (once) ──────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    const mainGroup = mainGroupRef.current;
    if (!svg || !mainGroup) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event: Event) => {
        // Allow scroll-wheel zoom always
        if (event.type === 'wheel') return true;
        // Suppress pan when in addNode mode (background click should add node)
        const m = optionsRef.current.mode;
        if (m === 'addNode') return false;
        // Allow pan on middle-mouse or when mode is select AND NOT on a node
        if (event instanceof MouseEvent) {
          if (event.button === 1) return true; // middle mouse always pans
          const target = event.target as SVGElement;
          const isNode = target.closest('.node-group') !== null;
          if (isNode) return false; // don't pan when dragging nodes
        }
        return true;
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(mainGroup).attr('transform', event.transform.toString());
        setTransform(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom);

    // Suppress default browser context menu on the SVG
    const preventCtxMenu = (e: Event) => e.preventDefault();
    svg.addEventListener('contextmenu', preventCtxMenu);

    return () => {
      d3.select(svg).on('.zoom', null);
      svg.removeEventListener('contextmenu', preventCtxMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Node Drag ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const nodeGroups = svg.querySelectorAll<SVGGElement>('.node-group');
    if (nodeGroups.length === 0) return;

    const sel = d3.selectAll<SVGGElement, unknown>(Array.from(nodeGroups));

    if (mode === 'select') {
      const drag = d3.drag<SVGGElement, unknown>()
        .on('start', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          event.sourceEvent.stopPropagation();
          draggedRef.current = false;
        })
        .on('drag', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          draggedRef.current = true;
          // Update SVG directly for smooth 60fps dragging
          const newX = event.x;
          const newY = event.y;
          d3.select(this).attr('transform', `translate(${newX}, ${newY})`);
          // Notify canvas so edges can track the node live
          const nodeId = this.dataset.nodeId!;
          optionsRef.current.onNodeDragging?.(nodeId, { x: newX, y: newY });
        })
        .on('end', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          if (!draggedRef.current) return;
          const nodeId = this.dataset.nodeId!;
          const snappedX = Math.round(event.x / GRID_SNAP) * GRID_SNAP;
          const snappedY = Math.round(event.y / GRID_SNAP) * GRID_SNAP;
          d3.select(this).attr('transform', `translate(${snappedX}, ${snappedY})`);
          optionsRef.current.onNodeMoved(nodeId, { x: snappedX, y: snappedY });
        });

      sel.call(drag);

      return () => {
        sel.on('.drag', null);
      };
    } else if (mode === 'addEdge') {
      // In addEdge mode, dragging from a node draws a temp edge
      let sourceId: string | null = null;
      let sourceX = 0;
      let sourceY = 0;

      const drag = d3.drag<SVGGElement, unknown>()
        .on('start', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          event.sourceEvent.stopPropagation();
          sourceId = this.dataset.nodeId!;
          const pos = optionsRef.current.nodePositions.get(sourceId);
          if (pos) { sourceX = pos.x; sourceY = pos.y; }
          const tempEdge = tempEdgeRef.current;
          if (tempEdge) {
            tempEdge.setAttribute('x1', String(sourceX));
            tempEdge.setAttribute('y1', String(sourceY));
            tempEdge.setAttribute('x2', String(sourceX));
            tempEdge.setAttribute('y2', String(sourceY));
            tempEdge.setAttribute('visibility', 'visible');
          }
        })
        .on('drag', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          const tempEdge = tempEdgeRef.current;
          if (tempEdge) {
            tempEdge.setAttribute('x2', String(event.x));
            tempEdge.setAttribute('y2', String(event.y));
          }
        })
        .on('end', function (event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
          const tempEdge = tempEdgeRef.current;
          if (tempEdge) {
            tempEdge.setAttribute('visibility', 'hidden');
          }
          if (!sourceId) return;
          // Find target node near the drop point
          const hitRadius = optionsRef.current.nodeHitRadius;
          let targetId: string | null = null;
          for (const [id, pos] of optionsRef.current.nodePositions) {
            if (id === sourceId) continue;
            const dx = pos.x - event.x;
            const dy = pos.y - event.y;
            if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
              targetId = id;
              break;
            }
          }
          if (targetId) {
            optionsRef.current.onEdgeAdded(sourceId, targetId);
          }
          sourceId = null;
        });

      sel.call(drag);

      return () => {
        sel.on('.drag', null);
      };
    } else {
      // Other modes: disable drag
      sel.on('.drag', null);
    }
  }, [mode, svgRef, tempEdgeRef, nodePositions, nodeHitRadius]);

  // ── Click handlers (delegated on SVG) ────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleClick = (e: MouseEvent) => {
      if (draggedRef.current) {
        draggedRef.current = false; // reset so next click works normally
        return;
      }

      const target = e.target as SVGElement;
      const m = optionsRef.current.mode;

      // Node click
      const nodeGroup = target.closest('.node-group') as SVGGElement | null;
      if (nodeGroup) {
        const nodeId = nodeGroup.dataset.nodeId!;
        optionsRef.current.onNodeClick(nodeId);
        return;
      }

      // Edge click (hit target or visible line)
      const edgeGroup = target.closest('.edge-group') as SVGGElement | null;
      if (edgeGroup) {
        const edgeId = edgeGroup.dataset.edgeId!;
        optionsRef.current.onEdgeClick(edgeId);
        return;
      }

      // Background click
      if (m === 'addNode' && (target === svg || target.closest('.main-group'))) {
        const t = d3.zoomTransform(svg);
        const rect = svg.getBoundingClientRect();
        const graphX = (e.clientX - rect.left - t.x) / t.k;
        const graphY = (e.clientY - rect.top - t.y) / t.k;
        optionsRef.current.onBackgroundClick({
          x: Math.round(graphX / GRID_SNAP) * GRID_SNAP,
          y: Math.round(graphY / GRID_SNAP) * GRID_SNAP,
        });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const target = e.target as SVGElement;

      const nodeGroup = target.closest('.node-group') as SVGGElement | null;
      if (nodeGroup) {
        const nodeId = nodeGroup.dataset.nodeId!;
        optionsRef.current.onNodeRightClick(nodeId, { x: e.clientX, y: e.clientY });
        return;
      }

      const edgeGroup = target.closest('.edge-group') as SVGGElement | null;
      if (edgeGroup) {
        const edgeId = edgeGroup.dataset.edgeId!;
        optionsRef.current.onEdgeRightClick(edgeId, { x: e.clientX, y: e.clientY });
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const nodeGroup = target.closest('.node-group') as SVGGElement | null;
      if (nodeGroup) {
        const nodeId = nodeGroup.dataset.nodeId!;
        optionsRef.current.onNodeDoubleClick(nodeId, { x: e.clientX, y: e.clientY });
        return;
      }

      const edgeGroup = target.closest('.edge-group') as SVGGElement | null;
      if (edgeGroup) {
        const edgeId = edgeGroup.dataset.edgeId!;
        optionsRef.current.onEdgeDoubleClick(edgeId, { x: e.clientX, y: e.clientY });
      }
    };

    svg.addEventListener('click', handleClick);
    svg.addEventListener('contextmenu', handleContextMenu);
    svg.addEventListener('dblclick', handleDblClick);

    return () => {
      svg.removeEventListener('click', handleClick);
      svg.removeEventListener('contextmenu', handleContextMenu);
      svg.removeEventListener('dblclick', handleDblClick);
    };
  }, [svgRef]);

  // ── Fit ──────────────────────────────────────────────────────────────────
  const fit = useCallback((padding = 50) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;

    const positions = optionsRef.current.nodePositions;
    if (positions.size === 0) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of positions.values()) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }

    // Add node size padding
    minX -= 40; minY -= 25; maxX += 40; maxY += 25;

    const bw = (maxX - minX) + padding * 2;
    const bh = (maxY - minY) + padding * 2;
    const scale = Math.min(width / bw, height / bh, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const newTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-cx, -cy);

    d3.select(svg)
      .transition()
      .duration(500)
      .call(zoom.transform as unknown as (t: d3.Transition<SVGSVGElement, unknown, null, undefined>) => void, newTransform);
  }, [svgRef]);

  // ── Auto-Layout (headless D3 force simulation) ───────────────────────────
  const runAutoLayout = useCallback((
    nodes: Array<{ id: string; x: number; y: number }>,
    edges: Array<{ source: string; target: string }>,
  ): Array<{ id: string; x: number; y: number }> => {
    type SimNode = { id: string; x: number; y: number } & d3.SimulationNodeDatum;
    const simNodes: SimNode[] = nodes.map(n => ({ ...n }));

    const svgEl = svgRef.current;
    const cx = svgEl ? svgEl.clientWidth / 2 : 400;
    const cy = svgEl ? svgEl.clientHeight / 2 : 300;

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink(edges.map(e => ({ ...e }))).id((d) => (d as SimNode).id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(cx, cy))
      .force('collision', d3.forceCollide(50))
      .stop();

    // Run 300 ticks synchronously
    for (let i = 0; i < 300; i++) simulation.tick();

    return simNodes.map(n => ({
      id: n.id,
      x: Math.round((n.x ?? 0) / GRID_SNAP) * GRID_SNAP,
      y: Math.round((n.y ?? 0) / GRID_SNAP) * GRID_SNAP,
    }));
  }, [svgRef]);

  // ── Screen-to-Graph coordinate conversion ────────────────────────────────
  const screenToGraph = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: screenX, y: screenY };
    const t = d3.zoomTransform(svg);
    const rect = svg.getBoundingClientRect();
    return {
      x: (screenX - rect.left - t.x) / t.k,
      y: (screenY - rect.top - t.y) / t.k,
    };
  }, [svgRef]);

  return {
    transform,
    zoomLevel: transform.k,
    fit,
    runAutoLayout,
    screenToGraph,
  };
}
