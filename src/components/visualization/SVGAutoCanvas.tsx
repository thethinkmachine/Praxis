import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { cn } from '@/lib/cn';
import GraphMinimap from '@/components/visualization/GraphMinimap';
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
  NODE_W_WIDE,
  NODE_H_TALL,
  GRID_SNAP,
} from './svg-graph.types';
import type { SVGNodeVM, SVGEdgeVM, NodeVisualState } from './svg-graph.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SVGAutoCanvasProps {
  elements: ElementDefinition[];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stylesheet?: unknown; // API-compat with CytoscapeRenderer — not used
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseClasses(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : String(raw).split(' ')).filter(Boolean);
}

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

function borderIntersection(
  cx: number, cy: number,
  angle: number,
  hw: number, hh: number,
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tx = cosA !== 0 ? hw / Math.abs(cosA) : Infinity;
  const ty = sinA !== 0 ? hh / Math.abs(sinA) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + t * cosA, y: cy + t * sinA };
}

function getEdgeEndpoints(
  sx: number, sy: number,
  tx: number, ty: number,
  srcHasCosts: boolean,
  tgtHasCosts: boolean,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  if (dx === 0 && dy === 0) return { x1: sx, y1: sy, x2: tx, y2: ty };

  const angle = Math.atan2(dy, dx);
  const srcHW = (srcHasCosts ? NODE_W_WIDE : NODE_W) / 2;
  const srcHH = (srcHasCosts ? NODE_H_TALL : NODE_H) / 2;
  const tgtHW = (tgtHasCosts ? NODE_W_WIDE : NODE_W) / 2;
  const tgtHH = (tgtHasCosts ? NODE_H_TALL : NODE_H) / 2;

  const src = borderIntersection(sx, sy, angle, srcHW, srcHH);
  const tgt = borderIntersection(tx, ty, angle + Math.PI, tgtHW, tgtHH);

  return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
}

function formatCost(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ---------------------------------------------------------------------------
// SVG Defs — identical to SVGGraphCanvas
// ---------------------------------------------------------------------------
function SvgDefs() {
  return (
    <defs>
      <marker id="ac-arrow-default" viewBox="0 -5 10 10" refX="10" refY="0"
        markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#8B949E" />
      </marker>
      <marker id="ac-arrow-path" viewBox="0 -5 10 10" refX="10" refY="0"
        markerWidth="8" markerHeight="8" orient="auto" markerUnits="strokeWidth">
        <path d="M0,-4L10,0L0,4" fill="#58A6FF" />
      </marker>

      {[
        { id: 'ac-glow-current', color: '#F0883E', std: 8, opacity: 0.9 },
        { id: 'ac-glow-frontier', color: '#58A6FF', std: 6, opacity: 0.65 },
        { id: 'ac-glow-goal', color: '#3FB950', std: 8, opacity: 0.8 },
        { id: 'ac-glow-start', color: '#A371F7', std: 7, opacity: 0.7 },
        { id: 'ac-glow-path', color: '#E3B341', std: 7, opacity: 0.7 },
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
// Parsed element types (without positions — positions computed separately)
// ---------------------------------------------------------------------------
interface ParsedNode {
  id: string;
  label: string;
  state: NodeVisualState;
  isStart: boolean;
  isGoal: boolean;
  gCost?: number;
  hCost?: number;
  fCost?: number;
  /** Pre-computed position from element data (if adapter supplies it) */
  elX?: number;
  elY?: number;
}

interface ParsedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  isDirected: boolean;
  isPath: boolean;
  isPruned: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SVGAutoCanvas({ elements, className }: SVGAutoCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mainGroupRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const darkMode = usePreferencesStore(s => s.darkMode);
  const activeNodeTheme = darkMode ? NODE_THEME : NODE_THEME_LIGHT;
  const activeEdgeColors = darkMode ? EDGE_COLORS : EDGE_COLORS_LIGHT;

  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });
  // Bump to trigger re-render after layout positions are computed
  const [layoutVersion, setLayoutVersion] = useState(0);

  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevNodeKeyRef = useRef<string>('');
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Parse elements (structure + visual state, no positions) ───────────────

  const { parsedNodes, parsedEdges } = useMemo(() => {
    const parsedNodes: ParsedNode[] = [];
    const parsedEdges: ParsedEdge[] = [];

    for (const el of elements) {
      if (el.data?.source != null) {
        // Edge
        const classes = parseClasses(el.classes);
        parsedEdges.push({
          id: el.data.id as string,
          sourceId: el.data.source as string,
          targetId: el.data.target as string,
          weight: (el.data.weight as number) ?? 1,
          isDirected: classes.includes('directed') || Boolean(el.data?.directed),
          isPath: classes.includes('path-edge'),
          isPruned: classes.includes('pruned-edge'),
        });
      } else {
        // Node
        const id = el.data?.id as string;
        const classes = parseClasses(el.classes);
        const rawLabel = (el.data?.label as string) ?? id ?? '';
        const labelLines = rawLabel.split('\n');

        let gCost: number | undefined, hCost: number | undefined, fCost: number | undefined;
        if (el.data?.gCost != null) gCost = el.data.gCost as number;
        if (el.data?.hCost != null) hCost = el.data.hCost as number;
        if (el.data?.fCost != null) fCost = el.data.fCost as number;

        parsedNodes.push({
          id,
          label: labelLines[0],
          state: resolveNodeState(classes),
          isStart: classes.includes('start'),
          isGoal: classes.includes('goal'),
          gCost,
          hCost,
          fCost,
          elX: el.position?.x,
          elY: el.position?.y,
        });
      }
    }

    return { parsedNodes, parsedEdges };
  }, [elements]);

  // ── Topology change → D3 force layout ────────────────────────────────────

  useEffect(() => {
    if (parsedNodes.length === 0) return;

    // Check if ALL nodes have pre-supplied positions from el.position
    const allHaveElPos = parsedNodes.every(n => n.elX != null && n.elY != null);
    if (allHaveElPos) {
      // Use element positions directly — no force layout needed
      for (const n of parsedNodes) {
        positionsRef.current.set(n.id, { x: n.elX!, y: n.elY! });
      }
      setLayoutVersion(v => v + 1);
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
      fitTimerRef.current = setTimeout(() => fit(), 50);
      return;
    }

    // Check topology change (by sorted node ID key)
    const nodeKey = parsedNodes.map(n => n.id).sort().join('\0');
    if (nodeKey === prevNodeKeyRef.current) return; // visual-only update
    prevNodeKeyRef.current = nodeKey;

    // D3 force simulation — identical to runAutoLayout in useGraphInteractions
    type SimNode = { id: string; x: number; y: number } & d3.SimulationNodeDatum;
    const simNodes: SimNode[] = parsedNodes.map(n => ({
      id: n.id,
      x: positionsRef.current.get(n.id)?.x ?? (Math.random() - 0.5) * 600,
      y: positionsRef.current.get(n.id)?.y ?? (Math.random() - 0.5) * 400,
    }));

    const simEdges = parsedEdges.map(e => ({ source: e.sourceId, target: e.targetId }));

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link',
        d3.forceLink(simEdges.map(e => ({ ...e })))
          .id(d => (d as SimNode).id)
          .distance(130),
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(65))
      .stop();

    for (let i = 0; i < 300; i++) simulation.tick();

    for (const n of simNodes) {
      positionsRef.current.set(n.id, {
        x: Math.round((n.x ?? 0) / GRID_SNAP) * GRID_SNAP,
        y: Math.round((n.y ?? 0) / GRID_SNAP) * GRID_SNAP,
      });
    }

    setLayoutVersion(v => v + 1);

    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => fit(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedNodes, parsedEdges]);

  // ── Build final view models (uses layoutVersion to re-read positionsRef) ──

  // (layoutVersion in deps ensures this re-runs after positions are stored)
  const nodeVMs: SVGNodeVM[] = useMemo(() => parsedNodes.map(n => ({
    id: n.id,
    label: n.label,
    x: positionsRef.current.get(n.id)?.x ?? n.elX ?? 0,
    y: positionsRef.current.get(n.id)?.y ?? n.elY ?? 0,
    state: n.state,
    isStart: n.isStart,
    isGoal: n.isGoal,
    gCost: n.gCost,
    hCost: n.hCost,
    fCost: n.fCost,
  })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [parsedNodes, layoutVersion]);

  const edgeVMs: SVGEdgeVM[] = useMemo(() => parsedEdges.map(e => ({ ...e })),
    [parsedEdges]);

  const nodeVMMap = useMemo(() => {
    const m = new Map<string, SVGNodeVM>();
    for (const n of nodeVMs) m.set(n.id, n);
    return m;
  }, [nodeVMs]);

  // ── D3 zoom/pan (once) ────────────────────────────────────────────────────

  useEffect(() => {
    const svg = svgRef.current;
    const mainGroup = mainGroupRef.current;
    if (!svg || !mainGroup) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(mainGroup).attr('transform', event.transform.toString());
        setTransform(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom);

    const preventCtxMenu = (e: Event) => e.preventDefault();
    svg.addEventListener('contextmenu', preventCtxMenu);

    return () => {
      d3.select(svg).on('.zoom', null);
      svg.removeEventListener('contextmenu', preventCtxMenu);
    };
  }, []);

  // ── Container resize ─────────────────────────────────────────────────────

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

  // ── Fit ──────────────────────────────────────────────────────────────────

  const fit = useCallback((padding = 50) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom || nodeVMs.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodeVMs) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }

    minX -= 40; minY -= 25; maxX += 40; maxY += 25;
    const bw = (maxX - minX) + padding * 2;
    const bh = (maxY - minY) + padding * 2;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

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
  }, [nodeVMs]);

  // Cleanup
  useEffect(() => {
    return () => { if (fitTimerRef.current) clearTimeout(fitTimerRef.current); };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={cn('h-full relative overflow-hidden dot-grid bg-[var(--bg)]', className)}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
      >
        <SvgDefs />

        <g ref={mainGroupRef} className="main-group">
          {/* ── Edge layer ───────────────────────────────────────── */}
          <g>
            {edgeVMs.map(edge => {
              const srcNode = nodeVMMap.get(edge.sourceId);
              const tgtNode = nodeVMMap.get(edge.targetId);
              if (!srcNode || !tgtNode) return null;

              const srcHasCosts = srcNode.gCost != null || srcNode.hCost != null;
              const tgtHasCosts = tgtNode.gCost != null || tgtNode.hCost != null;
              const { x1, y1, x2, y2 } = getEdgeEndpoints(
                srcNode.x, srcNode.y, tgtNode.x, tgtNode.y,
                srcHasCosts, tgtHasCosts,
              );

              const style = edge.isPath ? activeEdgeColors.path
                : edge.isPruned ? activeEdgeColors.pruned
                : edge.isDirected ? activeEdgeColors.directed
                : activeEdgeColors.normal;

              const markerEnd = edge.isDirected
                ? (edge.isPath ? 'url(#ac-arrow-path)' : 'url(#ac-arrow-default)')
                : undefined;

              const mx = (srcNode.x + tgtNode.x) / 2;
              const my = (srcNode.y + tgtNode.y) / 2;

              return (
                <g key={edge.id}>
                  {/* Visible line */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    opacity={style.opacity}
                    markerEnd={markerEnd}
                    strokeDasharray={'dasharray' in style ? (style as { dasharray: string }).dasharray : undefined}
                    style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease' }}
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
                  {/* Path glow */}
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

          {/* ── Node layer ───────────────────────────────────────── */}
          <g>
            {nodeVMs.map(node => {
              const theme = activeNodeTheme[node.state];
              const hasCosts = node.gCost != null || node.hCost != null;
              const w = hasCosts ? NODE_W_WIDE : NODE_W;
              const h = hasCosts ? NODE_H_TALL : NODE_H;
              const isExplored = node.state === 'explored';

              let costStr = '';
              if (node.gCost != null) costStr += `g=${formatCost(node.gCost)}`;
              if (node.hCost != null) costStr += (costStr ? ' ' : '') + `h=${formatCost(node.hCost)}`;
              if (node.fCost != null) costStr += (costStr ? ' ' : '') + `f=${formatCost(node.fCost)}`;

              // Map glow filter IDs to the "ac-" prefixed versions in this component's defs
              const filterMap: Record<string, string> = {
                'glow-current': 'ac-glow-current',
                'glow-frontier': 'ac-glow-frontier',
                'glow-goal': 'ac-glow-goal',
                'glow-start': 'ac-glow-start',
                'glow-path': 'ac-glow-path',
              };
              const filterId = theme.glowFilter ? filterMap[theme.glowFilter] ?? theme.glowFilter : undefined;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  filter={filterId ? `url(#${filterId})` : undefined}
                  opacity={isExplored ? 0.5 : 1}
                  style={{ transition: 'filter 0.3s ease, opacity 0.3s ease' }}
                >
                  <rect
                    x={-w / 2} y={-h / 2}
                    width={w} height={h}
                    rx={NODE_RX}
                    fill={theme.fill}
                    fillOpacity={theme.fillOpacity}
                    stroke={theme.border}
                    strokeWidth={theme.borderWidth}
                    style={{ transition: 'fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease' }}
                  />
                  <text
                    y={hasCosts ? -6 : 0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={theme.text}
                    fontSize={11}
                    fontFamily="JetBrains Mono, Fira Code, monospace"
                    fontWeight={node.isStart || node.isGoal || node.state === 'path' ? 'bold' : 'normal'}
                    style={{ pointerEvents: 'none', transition: 'fill 0.3s ease' }}
                  >
                    {node.label}
                  </text>
                  {costStr && (
                    <text
                      y={10}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={theme.text}
                      fontSize={8}
                      fontFamily="JetBrains Mono, Fira Code, monospace"
                      opacity={0.7}
                      style={{ pointerEvents: 'none' }}
                    >
                      {costStr}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* ── HTML Overlays ──────────────────────────────────────────── */}

      {/* Fit button */}
      <div className="absolute bottom-3 right-3">
        <button
          onClick={() => fit()}
          className="text-xs px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] hover:text-[var(--text)] transition-colors"
          title="Fit graph to view"
        >
          ⊡ Fit
        </button>
      </div>

      {/* Minimap */}
      <GraphMinimap
        nodes={nodeVMs}
        transform={transform}
        canvasWidth={canvasDims.w}
        canvasHeight={canvasDims.h}
      />

      {/* Zoom indicator */}
      <div
        className="absolute bottom-14 right-3 px-2 py-0.5 rounded text-[10px] font-mono tabular-nums text-[var(--text-3)] border border-[var(--border)] pointer-events-none select-none"
        style={{ background: 'var(--surface)', backdropFilter: 'blur(8px)' }}
      >
        {Math.round(transform.k * 100)}%
      </div>
    </div>
  );
}
