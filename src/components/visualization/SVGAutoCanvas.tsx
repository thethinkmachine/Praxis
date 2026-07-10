import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ElementDefinition } from 'cytoscape';
import { cn } from '@/lib/cn';
import GraphMinimap from '@/components/visualization/GraphMinimap';
import { Search } from '@/components/shared/Icons';
import { usePreferencesStore } from '@/store/preferences.store';
import {
  EDGE_COLORS,
  EDGE_COLORS_LIGHT,
  GRID_SNAP,
  NODE_THEME,
  NODE_THEME_LIGHT,
} from './svg-graph.types';
import type { NodeVisualState, SVGEdgeVM, SVGNodeShape, SVGNodeVM } from './svg-graph.types';

interface SVGAutoCanvasProps {
  elements: ElementDefinition[];
  stylesheet?: unknown;
  className?: string;
  minimapStorageKey?: string;
}

interface ParsedNode extends SVGNodeVM {
  depth?: number;
  nodeKind?: string;
  sourceLabel: string;
}

const NODE_W = 104;
const NODE_H = 50;
const GAME_NODE = 64;
const PUZZLE_3 = 104;
const PUZZLE_4 = 126;
const LAYER_Y = 124;
const SIBLING_X = 136;

function parseClasses(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : String(raw).split(' ')).filter(Boolean);
}

function resolveNodeState(classes: string[]): NodeVisualState {
  if (classes.includes('current')) return 'current';
  if (classes.includes('path') || classes.includes('active-path')) return 'path';
  if (classes.includes('frontier')) return 'frontier';
  if (classes.includes('explored')) return 'explored';
  if (classes.includes('pruned')) return 'pruned';
  if (classes.includes('goal')) return 'goal';
  if (classes.includes('start')) return 'start';
  return 'normal';
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value === Infinity ? '∞' : value === -Infinity ? '-∞' : '?';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseGridLabel(label: string): number[] | null {
  const parts = label.replace(/[|,\n]/g, ' ').trim().split(/\s+/);
  if (parts.length !== 9 && parts.length !== 16) return null;
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((value) => Number.isNaN(value) || value < 0 || value > 15)) return null;
  return numbers;
}

function nodeSize(node: ParsedNode): { w: number; h: number } {
  const grid = parseGridLabel(node.label);
  if (grid) {
    const size = grid.length === 16 ? PUZZLE_4 : PUZZLE_3;
    return { w: size, h: size + 20 };
  }
  if (node.shape && node.shape !== 'card') return { w: GAME_NODE, h: GAME_NODE };
  const hasCosts = node.gCost != null || node.hCost != null || node.fCost != null;
  const hasScore = node.score !== undefined || node.alpha !== undefined || node.beta !== undefined;
  return { w: hasCosts || hasScore ? 116 : NODE_W, h: hasCosts || hasScore ? 64 : NODE_H };
}

function edgePoint(from: ParsedNode, to: ParsedNode): { x: number; y: number } {
  const size = nodeSize(from);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y };
  const halfW = size.w / 2;
  const halfH = size.h / 2;
  const scale = Math.min(
    Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity,
  );
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function computeLayeredPositions(nodes: ParsedNode[], edges: SVGEdgeVM[]): Map<string, { x: number; y: number }> {
  const children = new Map<string, string[]>();
  const incoming = new Set<string>();
  for (const edge of edges) {
    children.set(edge.sourceId, [...(children.get(edge.sourceId) ?? []), edge.targetId]);
    incoming.add(edge.targetId);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const explicitRoot = nodes.find((node) => node.isStart)?.id;
  const rootId = explicitRoot ?? nodes.find((node) => !incoming.has(node.id))?.id ?? nodes[0]?.id;
  if (!rootId) return new Map();

  const widths = new Map<string, number>();
  const visiting = new Set<string>();
  const widthOf = (id: string): number => {
    if (visiting.has(id)) return 1;
    visiting.add(id);
    const kids = (children.get(id) ?? []).filter((child) => nodeIds.has(child));
    const width = kids.length === 0
      ? 1
      : kids.reduce((sum, child) => sum + widthOf(child), 0) + (kids.length - 1) * 0.45;
    visiting.delete(id);
    widths.set(id, width);
    return width;
  };

  const rootWidth = widthOf(rootId);
  const positions = new Map<string, { x: number; y: number }>();
  const assigned = new Set<string>();
  const assign = (id: string, left: number, depth: number) => {
    if (assigned.has(id)) return;
    assigned.add(id);
    const width = widths.get(id) ?? 1;
    positions.set(id, { x: (left + width / 2 - rootWidth / 2) * SIBLING_X, y: depth * LAYER_Y });
    let cursor = left;
    for (const child of children.get(id) ?? []) {
      const childWidth = widths.get(child) ?? 1;
      assign(child, cursor, depth + 1);
      cursor += childWidth + 0.45;
    }
  };

  assign(rootId, 0, 0);

  const orphans = nodes.filter((node) => !positions.has(node.id));
  orphans.forEach((node, index) => {
    positions.set(node.id, {
      x: (index - (orphans.length - 1) / 2) * SIBLING_X,
      y: (Math.max(1, ...Array.from(positions.values()).map((pos) => pos.y / LAYER_Y)) + 1) * LAYER_Y,
    });
  });

  return positions;
}

function renderPuzzleGrid(tiles: number[], darkMode: boolean) {
  const side = tiles.length === 16 ? 4 : 3;
  const total = tiles.length === 16 ? 92 : 74;
  const cell = total / side;
  return (
    <g transform={`translate(${-total / 2}, ${-total / 2})`}>
      {tiles.map((tile, index) => {
        const x = (index % side) * cell;
        const y = Math.floor(index / side) * cell;
        return (
          <g key={index} transform={`translate(${x + 2}, ${y + 2})`}>
            <rect
              width={cell - 4}
              height={cell - 4}
              rx={4}
              fill={tile === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)'}
              stroke={tile === 0 ? 'transparent' : 'var(--border)'}
              strokeWidth={0.8}
            />
            {tile !== 0 && (
              <text x={(cell - 4) / 2} y={(cell - 4) / 2} textAnchor="middle" dominantBaseline="central" fontSize={side === 4 ? 8 : 10} fill="var(--text-2)" fontWeight={700}>
                {tile}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function SvgDefs({ idBase, darkMode, transform }: { idBase: string; darkMode: boolean; transform: d3.ZoomTransform }) {
  return (
    <defs>
      <pattern id={`${idBase}-grid`} x="0" y="0" width={GRID_SNAP} height={GRID_SNAP} patternUnits="userSpaceOnUse" patternTransform={transform.toString()}>
        <circle cx="1" cy="1" r="1.2" fill={darkMode ? '#38bdf8' : '#1e293b'} fillOpacity={darkMode ? 0.12 : 0.16} />
      </pattern>
      <marker id={`${idBase}-arrow`} viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0,-4L10,0L0,4" fill="var(--text-3)" />
      </marker>
      <marker id={`${idBase}-arrow-path`} viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0,-4L10,0L0,4" fill="var(--accent)" />
      </marker>
      {[
        ['current', '#F0883E'],
        ['frontier', '#58A6FF'],
        ['goal', '#3FB950'],
        ['start', '#D2A8FF'],
        ['path', '#E3B341'],
      ].map(([name, color]) => (
        <filter key={name} id={`${idBase}-glow-${name}`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feFlood floodColor={color} floodOpacity="0.55" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      ))}
    </defs>
  );
}

export default function SVGAutoCanvas({ elements, className, minimapStorageKey = 'praxis:search-tree-minimap-position' }: SVGAutoCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mainGroupRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idBase = useId().replace(/:/g, '');
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const nodeTheme = darkMode ? NODE_THEME : NODE_THEME_LIGHT;
  const edgeTheme = darkMode ? EDGE_COLORS : EDGE_COLORS_LIGHT;

  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const parsedNodes: ParsedNode[] = [];
    const parsedEdges: SVGEdgeVM[] = [];

    for (const element of elements) {
      if (element.data?.source != null) {
        const classes = parseClasses(element.classes);
        parsedEdges.push({
          id: String(element.data.id),
          sourceId: String(element.data.source),
          targetId: String(element.data.target),
          weight: (element.data.weight as number) ?? 1,
          isDirected: classes.includes('directed') || Boolean(element.data.directed),
          isPath: classes.includes('path-edge'),
          isPruned: classes.includes('pruned-edge'),
          label: element.data.label as string | undefined,
        });
        continue;
      }

      const id = String(element.data?.id ?? '');
      const classes = parseClasses(element.classes);
      const sourceLabel = String(element.data?.label ?? id);
      const label = sourceLabel.split('\n')[0] ?? id;
      parsedNodes.push({
        id,
        label,
        sourceLabel,
        x: element.position?.x ?? 0,
        y: element.position?.y ?? 0,
        state: resolveNodeState(classes),
        isStart: classes.includes('start'),
        isGoal: classes.includes('goal'),
        gCost: element.data?.gCost as number | undefined,
        hCost: element.data?.hCost as number | undefined,
        fCost: element.data?.fCost as number | undefined,
        score: element.data?.score as number | null | undefined,
        alpha: element.data?.alpha as number | undefined,
        beta: element.data?.beta as number | undefined,
        shape: element.data?.shape as SVGNodeShape | undefined,
        depth: element.data?.depth as number | undefined,
        nodeKind: element.data?.nodeKind as string | undefined,
      });
    }

    const hasPositions = parsedNodes.every((node) => node.x !== 0 || node.y !== 0 || node.isStart);
    const positions = hasPositions ? null : computeLayeredPositions(parsedNodes, parsedEdges);
    const positionedNodes = parsedNodes.map((node) => {
      const position = positions?.get(node.id);
      return position ? { ...node, ...position } : node;
    });

    return { nodes: positionedNodes, edges: parsedEdges };
  }, [elements]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeNode = activeNodeId ? nodeMap.get(activeNodeId) ?? null : null;
  const minimapNodes = useMemo<SVGNodeVM[]>(() => nodes.map((node) => ({ ...node })), [nodes]);
  const layoutKey = useMemo(() => elements.map((element) => String(element.data?.id ?? '')).join('|'), [elements]);

  const fit = useCallback((duration = 420) => {
    if (!svgRef.current || !zoomRef.current || nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const size = nodeSize(node);
      minX = Math.min(minX, node.x - size.w / 2);
      minY = Math.min(minY, node.y - size.h / 2);
      maxX = Math.max(maxX, node.x + size.w / 2);
      maxY = Math.max(maxY, node.y + size.h / 2);
    }
    const pad = 72;
    const width = Math.max(1, canvasDims.w);
    const height = Math.max(1, canvasDims.h);
    const scale = Math.min((width - pad * 2) / Math.max(1, maxX - minX), (height - pad * 2) / Math.max(1, maxY - minY), 1.35);
    const next = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(Math.max(0.16, scale))
      .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
    d3.select(svgRef.current).transition().duration(duration).call(zoomRef.current.transform, next);
  }, [canvasDims.h, canvasDims.w, nodes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !mainGroupRef.current) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 3.2])
      .on('zoom', (event) => {
        d3.select(mainGroupRef.current).attr('transform', event.transform.toString());
        setTransform(event.transform);
      });
    zoomRef.current = zoom;
    d3.select(svg).call(zoom);
    return () => { d3.select(svg).on('.zoom', null); };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setCanvasDims({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => fit(0), 40);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [fit, layoutKey]);

  const jumpTo = useCallback((x: number, y: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const next = d3.zoomIdentity
      .translate(canvasDims.w / 2, canvasDims.h / 2)
      .scale(transform.k)
      .translate(-x, -y);
    d3.select(svgRef.current).transition().duration(320).call(zoomRef.current.transform, next);
  }, [canvasDims.h, canvasDims.w, transform.k]);

  const zoomBy = useCallback((factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, factor);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative h-full overflow-hidden bg-[var(--bg)]', className)}>
      <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
        <SvgDefs idBase={idBase} darkMode={darkMode} transform={transform} />
        <rect width="100%" height="100%" fill={`url(#${idBase}-grid)`} pointerEvents="none" />

        <g ref={mainGroupRef}>
          <g>
            {edges.map((edge) => {
              const source = nodeMap.get(edge.sourceId);
              const target = nodeMap.get(edge.targetId);
              if (!source || !target) return null;
              const start = edgePoint(source, target);
              const end = edgePoint(target, source);
              const midY = (start.y + end.y) / 2;
              const d = `M${start.x},${start.y} C${start.x},${midY} ${end.x},${midY} ${end.x},${end.y}`;
              const style = edge.isPath ? edgeTheme.path : edge.isPruned ? edgeTheme.pruned : edgeTheme.directed;
              return (
                <g key={edge.id} opacity={edge.isPruned ? 0.55 : 1}>
                  {edge.isPath && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={10} opacity={0.1} strokeLinecap="round" />}
                  <path
                    d={d}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    opacity={style.opacity}
                    strokeDasharray={'dasharray' in style ? style.dasharray : undefined}
                    markerEnd={edge.isDirected ? `url(#${edge.isPath ? `${idBase}-arrow-path` : `${idBase}-arrow`})` : undefined}
                  />
                  {edge.label && (
                    <g transform={`translate(${(start.x + end.x) / 2}, ${midY})`}>
                      <rect x={-18} y={-10} width={36} height={20} rx={6} fill="var(--surface)" stroke="var(--border)" opacity={0.95} />
                      <text textAnchor="middle" dominantBaseline="central" fill={edge.isPath ? 'var(--accent)' : 'var(--text-2)'} fontSize={10} fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          <g>
            {nodes.map((node) => {
              const theme = nodeTheme[node.state];
              const size = nodeSize(node);
              const grid = parseGridLabel(node.label);
              const filter = theme.glowFilter ? `url(#${idBase}-${theme.glowFilter.replace('glow-', 'glow-')})` : undefined;
              const isMuted = node.state === 'explored' || node.state === 'pruned';
              const isActive = activeNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  opacity={isMuted && !isActive ? 0.52 : 1}
                  filter={filter}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveNodeId((current) => current === node.id ? null : node.id);
                  }}
                >
                  {node.shape === 'circle' ? (
                    <circle r={size.w / 2} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={theme.border} strokeWidth={isActive ? theme.borderWidth + 1 : theme.borderWidth} />
                  ) : node.shape === 'diamond' ? (
                    <polygon points={`0,${-size.h / 2} ${size.w / 2},0 0,${size.h / 2} ${-size.w / 2},0`} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={theme.border} strokeWidth={isActive ? theme.borderWidth + 1 : theme.borderWidth} />
                  ) : (
                    <rect x={-size.w / 2} y={-size.h / 2} width={size.w} height={size.h} rx={node.shape === 'square' ? 7 : 12} fill={theme.fill} fillOpacity={theme.fillOpacity} stroke={theme.border} strokeWidth={isActive ? theme.borderWidth + 1 : theme.borderWidth} />
                  )}

                  {grid ? (
                    <g>
                      <text y={-size.h / 2 + 13} textAnchor="middle" fill="var(--text-3)" fontSize={8} fontWeight={700} letterSpacing={1}>
                        {grid.length === 16 ? '15-PUZZLE' : '8-PUZZLE'}
                      </text>
                      <g transform="translate(0, 9)">{renderPuzzleGrid(grid, darkMode)}</g>
                    </g>
                  ) : (
                    <>
                      <text y={node.gCost != null || node.score !== undefined ? -8 : 0} textAnchor="middle" dominantBaseline="central" fill={theme.text} fontSize={11} fontFamily="JetBrains Mono, monospace" fontWeight={node.state === 'path' || node.state === 'current' ? 800 : 600}>
                        {node.label}
                      </text>
                      {(node.gCost != null || node.hCost != null || node.fCost != null) && (
                        <text y={14} textAnchor="middle" dominantBaseline="central" fill="var(--text-2)" fontSize={8.5} fontFamily="JetBrains Mono, monospace">
                          {node.gCost != null && `g=${formatNumber(node.gCost)} `}{node.hCost != null && `h=${formatNumber(node.hCost)} `}{node.fCost != null && `f=${formatNumber(node.fCost)}`}
                        </text>
                      )}
                      {node.score !== undefined && (
                        <text y={14} textAnchor="middle" dominantBaseline="central" fill="var(--text-2)" fontSize={9} fontFamily="JetBrains Mono, monospace">
                          v={node.score == null ? '?' : formatNumber(node.score)}
                        </text>
                      )}
                    </>
                  )}

                  {(node.isStart || node.isGoal || node.nodeKind) && (
                    <text y={size.h / 2 + 15} textAnchor="middle" fill={node.isGoal ? 'var(--success)' : 'var(--text-3)'} fontSize={8.5} fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                      {node.nodeKind ? node.nodeKind.toUpperCase() : node.isStart ? 'START' : 'GOAL'}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="absolute left-3 top-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/92 px-3 py-2 shadow-lg backdrop-blur-xl">
        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">Search Tree</p>
        <p className="mt-1 text-xs text-[var(--text-2)]">{nodes.length} nodes · {edges.length} edges</p>
      </div>

      {activeNode && (
        <div className="absolute bottom-3 left-1/2 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/94 p-3 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{activeNode.label}</p>
              <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-3)]">{activeNode.state}</p>
            </div>
            <button onClick={() => setActiveNodeId(null)} className="ui-btn ui-btn-icon h-7 w-7 rounded-md" aria-label="Close node details">×</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            {activeNode.gCost != null && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">g <span className="text-[var(--text)]">{formatNumber(activeNode.gCost)}</span></div>}
            {activeNode.hCost != null && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">h <span className="text-[var(--text)]">{formatNumber(activeNode.hCost)}</span></div>}
            {activeNode.fCost != null && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">f <span className="text-[var(--text)]">{formatNumber(activeNode.fCost)}</span></div>}
            {activeNode.score !== undefined && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">value <span className="text-[var(--text)]">{activeNode.score == null ? '?' : formatNumber(activeNode.score)}</span></div>}
            {activeNode.alpha !== undefined && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">α <span className="text-[var(--text)]">{formatNumber(activeNode.alpha)}</span></div>}
            {activeNode.beta !== undefined && <div className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[var(--text-2)]">β <span className="text-[var(--text)]">{formatNumber(activeNode.beta)}</span></div>}
          </div>
        </div>
      )}

      <GraphMinimap
        nodes={minimapNodes}
        transform={transform}
        canvasWidth={canvasDims.w}
        canvasHeight={canvasDims.h}
        storageKey={minimapStorageKey}
        onViewJump={jumpTo}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(1 / 1.25)}
        onFit={() => fit()}
        disableAutoLayout
      />

      <div className="absolute bottom-3 right-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/94 px-3 py-2 text-[11px] font-mono text-[var(--text)] shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        {Math.round(transform.k * 100)}%
      </div>

      <button
        onClick={() => fit()}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]/92 text-[var(--text-2)] shadow-lg backdrop-blur-xl transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
        aria-label="Fit search tree"
        title="Fit search tree"
      >
        <Search size={15} />
      </button>
    </div>
  );
}
