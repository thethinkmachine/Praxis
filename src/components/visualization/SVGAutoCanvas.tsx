import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { cn } from '@/lib/cn';
import GraphMinimap from '@/components/visualization/GraphMinimap';
import { LayoutGrid } from '@/components/shared/Icons';
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
  stylesheet?: unknown;
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
  srcW: number,
  srcH: number,
  tgtW: number,
  tgtH: number,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  if (dx === 0 && dy === 0) return { x1: sx, y1: sy, x2: tx, y2: ty };

  const angle = Math.atan2(dy, dx);
  const srcHW = srcW / 2;
  const srcHH = srcH / 2;
  const tgtHW = tgtW / 2;
  const tgtHH = tgtH / 2;

  const src = borderIntersection(sx, sy, angle, srcHW, srcHH);
  const tgt = borderIntersection(tx, ty, angle + Math.PI, tgtHW, tgtHH);

  return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
}

function formatCost(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function isGridState(label: string): number[] | null {
  // Matches labels like "1 2 3 | 4 0 5 | 6 7 8" or IDs like "1,2,3,4,0,5,6,7,8"
  const clean = label.replace(/[|\n]/g, ' ');
  const parts = clean.trim().split(/\s+/);
  if (parts.length === 9 || parts.length === 16) {
    const numbers = parts.map(p => {
      const n = parseInt(p, 10);
      return isNaN(n) ? -1 : n;
    });
    if (numbers.every(n => n >= 0 && n < 16)) return numbers;
  }
  return null;
}

function renderGrid(tiles: number[], size: number, totalW: number, darkMode: boolean) {
  const cellSize = totalW / size;
  const padding = 1.5;
  const innerSize = cellSize - padding * 2;

  return (
    <g transform={`translate(${-totalW / 2}, ${-totalW / 2})`}>
      {tiles.map((tile, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        if (tile === 0) return (
             <rect
              key={i}
              x={c * cellSize + padding}
              y={r * cellSize + padding}
              width={innerSize}
              height={innerSize}
              rx={3}
              fill={darkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0,0,0,0.05)'}
              stroke="none"
            />
        );

        return (
          <g key={i} transform={`translate(${c * cellSize + padding}, ${r * cellSize + padding})`}>
            <rect
              width={innerSize}
              height={innerSize}
              rx={3}
              fill={darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.03)'}
              stroke={darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0,0,0,0.1)'}
              strokeWidth={0.5}
            />
            <text
              x={innerSize / 2}
              y={innerSize / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size === 4 ? 8 : 10}
              fontWeight="bold"
              fill={darkMode ? '#8b949e' : '#24292f'}
              fontFamily="Outfit, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {tile}
            </text>
          </g>
        );
      })}
    </g>
  );
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
  label?: string;
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
  const [layoutVersion, setLayoutVersion] = useState(0);

  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevNodeKeyRef = useRef<string>('');
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Parse elements ───────────────────────────────────────────────────────

  const { parsedNodes, parsedEdges } = useMemo(() => {
    const parsedNodes: ParsedNode[] = [];
    const parsedEdges: ParsedEdge[] = [];

    for (const el of elements) {
      if (el.data?.source != null) {
        const classes = parseClasses(el.classes);
        parsedEdges.push({
          id: el.data.id as string,
          sourceId: el.data.source as string,
          targetId: el.data.target as string,
          weight: (el.data.weight as number) ?? 1,
          isDirected: classes.includes('directed') || Boolean(el.data?.directed),
          isPath: classes.includes('path-edge'),
          isPruned: classes.includes('pruned-edge'),
          label: el.data?.label as string,
        });
      } else {
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

  useEffect(() => {
    if (parsedNodes.length === 0) return;

    const allHaveElPos = parsedNodes.every(n => n.elX != null && n.elY != null);
    if (allHaveElPos) {
      for (const n of parsedNodes) {
        positionsRef.current.set(n.id, { x: n.elX!, y: n.elY! });
      }
      setLayoutVersion(v => v + 1);
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
      fitTimerRef.current = setTimeout(() => fit(), 50);
      return;
    }

    const nodeKey = parsedNodes.map(n => n.id).sort().join('\0');
    if (nodeKey === prevNodeKeyRef.current) return;
    prevNodeKeyRef.current = nodeKey;

    type SimNode = { id: string; x: number; y: number } & d3.SimulationNodeDatum;
    const simNodes: SimNode[] = parsedNodes.map(n => ({
      id: n.id,
      x: positionsRef.current.get(n.id)?.x ?? (Math.random() - 0.5) * 600,
      y: positionsRef.current.get(n.id)?.y ?? (Math.random() - 0.5) * 400,
    }));
    const simEdges = parsedEdges.map(e => ({ source: e.sourceId, target: e.targetId }));

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink(simEdges.map(e => ({ ...e }))).id(d => (d as SimNode).id).distance(130))
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
  }, [parsedNodes, parsedEdges]);

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
  })), [parsedNodes, layoutVersion]);

  const edgeVMs: SVGEdgeVM[] = useMemo(() => parsedEdges.map(e => ({ ...e })), [parsedEdges]);

  const nodeVMMap = useMemo(() => {
    const m = new Map<string, SVGNodeVM>();
    for (const n of nodeVMs) m.set(n.id, n);
    return m;
  }, [nodeVMs]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !mainGroupRef.current) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        d3.select(mainGroupRef.current).attr('transform', event.transform.toString());
        setTransform(event.transform);
      });
    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom);
    return () => { d3.select(svg).on('.zoom', null); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setCanvasDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback((padding = 50) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom || nodeVMs.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodeVMs) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
    }

    minX -= 40; minY -= 40; maxX += 40; maxY += 40;
    const bw = (maxX - minX) + padding * 2, bh = (maxY - minY) + padding * 2;
    const width = svg.clientWidth, height = svg.clientHeight;
    const scale = Math.min(width / bw, height / bh, 1.5);
    const newTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-(minX + maxX) / 2, -(minY + maxY) / 2);

    d3.select(svg).transition().duration(500).call(zoom.transform as any, newTransform);
  }, [nodeVMs]);

  return (
    <div ref={containerRef} className={cn('h-full relative overflow-hidden dot-grid bg-[var(--bg)]', className)}>
      <svg ref={svgRef} className="w-full h-full" style={{ cursor: 'grab' }}>
        <SvgDefs />
        <g ref={mainGroupRef} className="main-group">
          {/* ── Edges ── */}
          <g>
            {edgeVMs.map(edge => {
              const srcNode = nodeVMMap.get(edge.sourceId), tgtNode = nodeVMMap.get(edge.targetId);
              if (!srcNode || !tgtNode) return null;

              const srcGrid = isGridState(srcNode.label), tgtGrid = isGridState(tgtNode.label);
              const srcW = srcGrid ? (srcGrid.length === 16 ? 110 : 90) : (srcNode.gCost != null ? 100 : 76);
              const srcH = srcGrid ? (srcGrid.length === 16 ? 130 : 104) : (srcNode.gCost != null ? 56 : 38);
              const tgtW = tgtGrid ? (tgtGrid.length === 16 ? 110 : 90) : (tgtNode.gCost != null ? 100 : 76);
              const tgtH = tgtGrid ? (tgtGrid.length === 16 ? 130 : 104) : (tgtNode.gCost != null ? 56 : 38);

              const { x1, y1, x2, y2 } = getEdgeEndpoints(srcNode.x, srcNode.y, tgtNode.x, tgtNode.y, srcW, srcH, tgtW, tgtH);
              const style = edge.isPath ? activeEdgeColors.path : edge.isPruned ? activeEdgeColors.pruned : edge.isDirected ? activeEdgeColors.directed : activeEdgeColors.normal;
              const markerEnd = edge.isDirected ? (edge.isPath ? 'url(#ac-arrow-path)' : 'url(#ac-arrow-default)') : undefined;

              const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;

              return (
                <g key={edge.id}>
                  {edge.isPath && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={darkMode ? '#58A6FF' : '#2563EB'} strokeWidth={10} opacity={0.12} strokeLinecap="round" />}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.stroke} strokeWidth={style.width} opacity={style.opacity} markerEnd={markerEnd} strokeDasharray={'dasharray' in style ? (style as any).dasharray : undefined} />
                  {edge.label && (
                    <g transform={`translate(${lx}, ${ly})`}>
                      <rect x={-12} y={-9} width={24} height={18} rx={6} fill={darkMode ? '#0d1117' : '#ffffff'} stroke={edge.isPath ? (darkMode ? '#58A6FF' : '#2563EB') : (darkMode ? '#30363d' : '#d0d7de')} strokeWidth={1} />
                      <text textAnchor="middle" dominantBaseline="central" fill={edge.isPath ? (darkMode ? '#58A6FF' : '#0969da') : (darkMode ? '#8b949e' : '#57606a')} fontSize={11} fontWeight="800" fontFamily="JetBrains Mono, monospace">{edge.label}</text>
                    </g>
                  )}
                  {edge.weight !== 1 && !edge.label && (
                     <g transform={`translate(${lx}, ${ly})`}>
                        <rect x={-14} y={-8} width={28} height={16} rx={3} fill={darkMode ? '#0F1117' : '#FFFFFF'} fillOpacity={0.9} />
                        <text textAnchor="middle" dominantBaseline="central" fill={darkMode ? '#5A6478' : '#6B7280'} fontSize={10} fontFamily="monospace">{edge.weight}</text>
                     </g>
                  )}
                </g>
              );
            })}
          </g>
          {/* ── Nodes ── */}
          <g>
            {nodeVMs.map(node => {
              const theme = activeNodeTheme[node.state];
              const grid = isGridState(node.label);
              const CARD_W = grid ? (grid.length === 16 ? 110 : 90) : (node.gCost != null ? 100 : 76);
              const CARD_H = grid ? (grid.length === 16 ? 130 : 104) : (node.gCost != null ? 56 : 38);
              const isExplored = node.state === 'explored';

              const filterMap: any = { 'glow-current': 'ac-glow-current', 'glow-frontier': 'ac-glow-frontier', 'glow-goal': 'ac-glow-goal', 'glow-start': 'ac-glow-start', 'glow-path': 'ac-glow-path' };
              const filterId = theme.glowFilter ? (filterMap[theme.glowFilter] ?? theme.glowFilter) : undefined;

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`} filter={filterId ? `url(#${filterId})` : undefined} opacity={isExplored ? 0.45 : 1}>
                  <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={12} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={theme.border} strokeWidth={theme.borderWidth} />
                  {grid ? (
                    <g transform="translate(0, -6)">
                      <text y={-CARD_H/2 + 16} textAnchor="middle" fill={theme.text} fontSize={8} fontWeight="bold" opacity={0.6}>{grid.length === 9 ? '8-PUZZLE' : '15-PUZZLE'}</text>
                      <g transform="translate(0, 8)">{renderGrid(grid, grid.length === 16 ? 4 : 3, grid.length === 16 ? 90 : 70, darkMode)}</g>
                    </g>
                  ) : (
                    <text y={node.gCost != null ? -8 : 0} textAnchor="middle" dominantBaseline="central" fill={theme.text} fontSize={11} fontWeight={node.state === 'path' ? 'bold' : 'normal'} fontFamily="monospace">{node.label}</text>
                  )}
                  {(node.gCost != null || node.hCost != null) && (
                     <g transform={`translate(0, ${CARD_H / 2 - 13})`}>
                        <rect x={-CARD_W/2 + 8} y={-8} width={CARD_W - 16} height={16} rx={8} fill={darkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'} stroke={theme.border} strokeWidth={0.5} strokeOpacity={0.2} />
                        <text textAnchor="middle" dominantBaseline="central" fill={theme.text} fontSize={8} fontFamily="monospace">
                           {node.gCost != null && `g=${formatCost(node.gCost)}`} {node.hCost != null && `h=${formatCost(node.hCost)}`} {node.fCost != null && `f=${formatCost(node.fCost)}`}
                        </text>
                     </g>
                  )}
                  {(node.isStart || node.isGoal) && (
                    <g transform={`translate(0, ${CARD_H / 2 + 16})`}>
                       <text textAnchor="middle" fill={node.isStart ? (darkMode ? '#d2a8ff' : '#6f42c1') : (darkMode ? '#3fb950' : '#1a7f37')} fontSize={9} fontWeight="bold">{node.isStart ? 'START' : 'GOAL'}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <div className="absolute bottom-3 right-3">
        <button onClick={() => fit()} className="ui-btn h-8 rounded-lg px-2.5 text-xs">
          <LayoutGrid size={12} />
          Fit
        </button>
      </div>
      <GraphMinimap nodes={nodeVMs} transform={transform} canvasWidth={canvasDims.w} canvasHeight={canvasDims.h} />
    </div>
  );
}
