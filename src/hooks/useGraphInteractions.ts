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
  edgeData: Array<{ id: string; source: string; target: string }>;
  nodeHitRadius: number;
  onBackgroundClick: (pos: { x: number; y: number }) => void;
  onEmptyClick?: (meta: { append: boolean }) => void;
  onNodeClick: (nodeId: string, meta: { append: boolean }) => void;
  onNodeRightClick: (nodeId: string, screenPos: { x: number; y: number }) => void;
  onNodeDoubleClick: (nodeId: string, screenPos: { x: number; y: number }) => void;
  onEdgeClick: (edgeId: string, meta: { append: boolean }) => void;
  onEdgeRightClick: (edgeId: string, screenPos: { x: number; y: number }) => void;
  onEdgeDoubleClick: (edgeId: string, screenPos: { x: number; y: number }) => void;
  onSelectionBoxComplete?: (payload: { nodeIds: string[]; edgeIds: string[]; append: boolean }) => void;
  onNodeMoved: (nodeId: string, position: { x: number; y: number }) => void;
  onEdgeAdded: (sourceId: string, targetId: string) => void;
  onNodeDragging?: (nodeId: string, pos: { x: number; y: number }) => void;
  snapToGrid?: boolean;
}

interface SelectionBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
interface UseGraphInteractionsReturn {
  transform: d3.ZoomTransform;
  zoomLevel: number;
  selectionBox: SelectionBoxRect | null;
  /** Space held — a pan gesture is available via left-drag regardless of mode. */
  isSpacePressed: boolean;
  /** A pan (right-drag, middle-drag, or space+left-drag) is actively in progress. */
  isPanning: boolean;
  fit: (padding?: number) => void;
  jumpTo: (x: number, y: number, duration?: number) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  runAutoLayout: (
    nodes: Array<{ id: string; x: number; y: number }>,
    edges: Array<{ source: string; target: string }>,
  ) => Array<{ id: string; x: number; y: number }>;
  screenToGraph: (screenX: number, screenY: number) => { x: number; y: number };
}

function isPointInRect(x: number, y: number, rect: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return (
    bx <= Math.max(ax, cx) && bx >= Math.min(ax, cx) &&
    by <= Math.max(ay, cy) && by >= Math.min(ay, cy)
  );
}

function segmentsIntersect(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number,
): boolean {
  const o1 = orientation(a1x, a1y, a2x, a2y, b1x, b1y);
  const o2 = orientation(a1x, a1y, a2x, a2y, b2x, b2y);
  const o3 = orientation(b1x, b1y, b2x, b2y, a1x, a1y);
  const o4 = orientation(b1x, b1y, b2x, b2y, a2x, a2y);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (o1 === 0 && onSegment(a1x, a1y, b1x, b1y, a2x, a2y)) return true;
  if (o2 === 0 && onSegment(a1x, a1y, b2x, b2y, a2x, a2y)) return true;
  if (o3 === 0 && onSegment(b1x, b1y, a1x, a1y, b2x, b2y)) return true;
  if (o4 === 0 && onSegment(b1x, b1y, a2x, a2y, b2x, b2y)) return true;
  return false;
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  if (isPointInRect(x1, y1, rect) || isPointInRect(x2, y2, rect)) return true;

  const { minX, minY, maxX, maxY } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, minX, minY, maxX, minY) ||
    segmentsIntersect(x1, y1, x2, y2, maxX, minY, maxX, maxY) ||
    segmentsIntersect(x1, y1, x2, y2, maxX, maxY, minX, maxY) ||
    segmentsIntersect(x1, y1, x2, y2, minX, maxY, minX, minY)
  );
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
  const [selectionBox, setSelectionBox] = useState<SelectionBoxRect | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const isSpacePressedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);
  const rightPanRef = useRef(false);
  const rightPanMovedRef = useRef(false);

  // Track drag state to distinguish click from drag
  const draggedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };
    const onBlur = () => { isSpacePressedRef.current = false; setIsSpacePressed(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // ── Zoom / Pan setup (once) ──────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    const mainGroup = mainGroupRef.current;
    if (!svg || !mainGroup) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 6])
      .wheelDelta((event: WheelEvent) => {
        // Tune zoom speed so trackpad and wheel both feel less jumpy.
        const factor = event.ctrlKey ? 0.002 : 0.0012;
        return -event.deltaY * factor;
      })
      .filter((event: Event) => {
        if (event.type === 'wheel') return true;

        // Natural pan affordance: middle drag, right drag, or hold Space + left drag.
        if (event instanceof MouseEvent) {
          if (event.button === 1 || event.button === 2) return true;
          if (event.button === 0 && isSpacePressedRef.current) return true;
        }

        return false;
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(mainGroup).attr('transform', event.transform.toString());
        setTransform(event.transform);
        // A 'zoom' event only fires when the transform actually changes, so
        // seeing one during an active right-button gesture means the user is
        // genuinely panning (as opposed to a stationary right-click, which
        // d3-zoom still reports as a start/end pair with no zoom in between).
        if (rightPanRef.current) rightPanMovedRef.current = true;
      })
      .on('start', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const src = event.sourceEvent;
        // Wheel-driven zoom also fires start/end — only a mouse-drag gesture
        // (right/middle button, or space+left) counts as an actual pan.
        if (src instanceof MouseEvent) {
          setIsPanning(true);
          if (src.button === 2) {
            rightPanRef.current = true;
            rightPanMovedRef.current = false;
          }
        }
      })
      .on('end', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (event.sourceEvent instanceof MouseEvent) {
          setIsPanning(false);
        }
        if (rightPanRef.current) {
          // Only swallow the upcoming contextmenu event if this was a real
          // pan — a plain right-click with no movement must still open the
          // context menu.
          if (rightPanMovedRef.current) {
            suppressContextMenuRef.current = true;
            setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
          }
          rightPanRef.current = false;
          rightPanMovedRef.current = false;
        }
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom);
    d3.select(svg).on('dblclick.zoom', null);

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
          
          let finalX = event.x;
          let finalY = event.y;

          if (optionsRef.current.snapToGrid) {
            finalX = Math.round(event.x / GRID_SNAP) * GRID_SNAP;
            finalY = Math.round(event.y / GRID_SNAP) * GRID_SNAP;
          }

          d3.select(this).attr('transform', `translate(${finalX}, ${finalY})`);
          optionsRef.current.onNodeMoved(nodeId, { x: finalX, y: finalY });
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
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      if (draggedRef.current) {
        draggedRef.current = false; // reset so next click works normally
        return;
      }

      const target = e.target as SVGElement;
      const m = optionsRef.current.mode;
      const append = e.shiftKey || e.ctrlKey || e.metaKey;

      // Node click
      const nodeGroup = target.closest('.node-group') as SVGGElement | null;
      if (nodeGroup) {
        const nodeId = nodeGroup.dataset.nodeId!;
        optionsRef.current.onNodeClick(nodeId, { append });
        return;
      }

      // Edge click (hit target or visible line)
      const edgeGroup = target.closest('.edge-group') as SVGGElement | null;
      if (edgeGroup) {
        const edgeId = edgeGroup.dataset.edgeId!;
        optionsRef.current.onEdgeClick(edgeId, { append });
        return;
      }

      // Background click
      if (m === 'addNode' && (target === svg || target.closest('.main-group'))) {
        const t = d3.zoomTransform(svg);
        const rect = svg.getBoundingClientRect();
        let graphX = (e.clientX - rect.left - t.x) / t.k;
        let graphY = (e.clientY - rect.top - t.y) / t.k;
        
        if (optionsRef.current.snapToGrid) {
          graphX = Math.round(graphX / GRID_SNAP) * GRID_SNAP;
          graphY = Math.round(graphY / GRID_SNAP) * GRID_SNAP;
        }

        optionsRef.current.onBackgroundClick({
          x: graphX,
          y: graphY,
        });
      } else if (m === 'select') {
        optionsRef.current.onEmptyClick?.({ append });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (suppressContextMenuRef.current) return;
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

  // ── Selection box (left-drag on empty canvas in select mode) ────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let dragActive = false;
    let moved = false;
    let append = false;
    let startX = 0;
    let startY = 0;
    let currentBox: SelectionBoxRect | null = null;

    const toGraph = (screenX: number, screenY: number) => {
      const t = d3.zoomTransform(svg);
      const rect = svg.getBoundingClientRect();
      return {
        x: (screenX - rect.left - t.x) / t.k,
        y: (screenY - rect.top - t.y) / t.k,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (optionsRef.current.mode !== 'select') return;
      if (e.button !== 0) return;
      if (isSpacePressedRef.current) return;

      const target = e.target as SVGElement;
      if (target.closest('.node-group') || target.closest('.edge-group')) return;

      dragActive = true;
      moved = false;
      append = e.shiftKey || e.ctrlKey || e.metaKey;
      startX = e.clientX;
      startY = e.clientY;
      currentBox = { x: startX, y: startY, width: 0, height: 0 };
      setSelectionBox(currentBox);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragActive) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        moved = true;
      }
      currentBox = {
        x: Math.min(startX, e.clientX),
        y: Math.min(startY, e.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      setSelectionBox(currentBox);
    };

    const onMouseUp = () => {
      if (!dragActive) return;
      dragActive = false;

      const box = currentBox;
      setSelectionBox(null);
      currentBox = null;
      if (!moved || !box) return;

      const p1 = toGraph(box.x, box.y);
      const p2 = toGraph(box.x + box.width, box.y + box.height);
      const graphRect = {
        minX: Math.min(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxX: Math.max(p1.x, p2.x),
        maxY: Math.max(p1.y, p2.y),
      };

      const nodeIds: string[] = [];
      for (const [id, pos] of optionsRef.current.nodePositions) {
        if (isPointInRect(pos.x, pos.y, graphRect)) {
          nodeIds.push(id);
        }
      }

      const edgeIds: string[] = [];
      for (const edge of optionsRef.current.edgeData) {
        const src = optionsRef.current.nodePositions.get(edge.source);
        const tgt = optionsRef.current.nodePositions.get(edge.target);
        if (!src || !tgt) continue;
        if (segmentIntersectsRect(src.x, src.y, tgt.x, tgt.y, graphRect)) {
          edgeIds.push(edge.id);
        }
      }

      optionsRef.current.onSelectionBoxComplete?.({ nodeIds, edgeIds, append });
      suppressNextClickRef.current = true;
    };

    svg.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      svg.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSelectionBox(null);
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

  const jumpTo = useCallback((x: number, y: number, duration = 500) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const current = d3.zoomTransform(svg);

    const newTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(current.k)
      .translate(-x, -y);

    d3.select(svg)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform as unknown as (t: d3.Transition<SVGSVGElement, unknown, null, undefined>) => void, newTransform);
  }, [svgRef]);

  const zoomBy = useCallback((factor: number) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;

    d3.select(svg)
      .transition()
      .duration(180)
      .ease(d3.easeCubicOut)
      .call(zoom.scaleBy as unknown as (t: d3.Transition<SVGSVGElement, unknown, null, undefined>, factor: number) => void, factor);
  }, [svgRef]);

  const zoomIn = useCallback((factor = 1.2) => {
    zoomBy(factor);
  }, [zoomBy]);

  const zoomOut = useCallback((factor = 1 / 1.2) => {
    zoomBy(factor);
  }, [zoomBy]);

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
    selectionBox,
    isSpacePressed,
    isPanning,
    fit,
    jumpTo,
    zoomIn,
    zoomOut,
    runAutoLayout,
    screenToGraph,
  };
}
