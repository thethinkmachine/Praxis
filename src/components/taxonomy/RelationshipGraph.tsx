import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta, AlgorithmCategory } from '@/types/algorithm';
import { buildRoute } from '@/lib/buildRoute';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/constants';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Search, MoveRight } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

const CATEGORY_COLORS: Record<AlgorithmCategory, string> = {
  'uninformed-search': '#58A6FF',
  'informed-search': '#D2A8FF',
  'game-playing': '#F2C94C',
  'local-search': '#53C880',
  planning: '#56D4DD',
  'constraint-satisfaction': '#FFA657',
};

const RELATIONSHIP_DESCRIPTIONS: Record<string, string> = {
  'adds heuristic': 'Adds an estimate of remaining distance so the search can prefer states that look closer to the goal.',
  'iterative variant': 'Repeats a simpler search with progressively broader limits to recover a stronger guarantee.',
  'optimizing variant': 'Extends a simpler idea toward lower-cost or provably optimal solutions.',
  'depth limits': 'Bounds depth explicitly to avoid following one branch forever.',
  iterates: 'Runs the bounded version repeatedly with increasing limits.',
  weighted: 'Generalizes unweighted expansion to paths whose actions have different costs.',
  bidirectional: 'Searches from both ends and tries to meet in the middle.',
  'f-threshold': 'Uses an f-cost threshold to prune branches while keeping memory small.',
  'memory-bounded': 'Trades memory for recomputation by keeping only the most useful frontier information.',
  prunes: 'Skips branches that cannot change the backed-up decision.',
  symmetric: 'Uses zero-sum symmetry to express minimax as one recurrence.',
  stochastic: 'Backs up expected value instead of assuming a perfectly adversarial reply.',
  sampling: 'Estimates value through repeated simulations rather than exhaustive enumeration.',
  'best-first': 'Expands the most promising open state first instead of following a depth-first path.',
  related: 'Shares a core modeling idea, recurrence, or problem family.',
};

const FALLBACK_EDGE_LABELS: Record<string, string> = {
  'dfs→dls': 'depth limits',
  'dls→iddfs': 'iterates',
  'bfs→ucs': 'weighted',
  'bfs→bidirectional-bfs': 'bidirectional',
  'ucs→bidirectional-bfs': 'bidirectional',
  'ucs→bidirectional-ucs': 'bidirectional',
  'astar→bidirectional-astar': 'bidirectional',
  'bidirectional-ucs→bidirectional-astar': 'adds heuristic',
  'astar→rbfs': 'memory-bounded',
  'astar→sma-star': 'memory-bounded',
  'astar→smgs': 'memory-bounded',
  'rbfs→sma-star': 'memory-bounded',
  'sma-star→smgs': 'memory-bounded',
  'iddfs→ida-star': 'f-threshold',
  'minimax→alpha-beta': 'prunes',
  'minimax→negamax': 'symmetric',
  'minimax→expectimax': 'stochastic',
  'expectimax→mcts': 'sampling',
  'random-walk→simulated-annealing': 'related',
  'hill-climbing-simple→hill-climbing-steepest': 'related',
  'hill-climbing-steepest→hill-climbing-sideways': 'related',
  'hill-climbing-steepest→hill-climbing-random-restart': 'related',
  'hill-climbing-steepest→hill-climbing-stochastic': 'related',
  'hill-climbing-steepest→hill-climbing-first-choice': 'related',
  'local-beam-search→stochastic-beam-search': 'related',
  'stochastic-beam-search→genetic-algorithm': 'related',
  'hill-climbing-sideways→tabu-search': 'related',
  'hill-climbing-steepest→min-conflicts': 'related',
  'fssp→bssp': 'related',
  'fssp→gsp': 'related',
  'gsp→graphplan': 'related',
  'graphplan→satplan': 'related',
  'gsp→pop': 'related',
  'backtracking-search→forward-checking': 'related',
  'forward-checking→mac': 'related',
  'ac-3→gac': 'related',
  'gac→mac': 'related',
  'tree-csp→cutset-conditioning': 'related',
};

const ALGO_RANK: Record<string, number> = {
  bfs: 1, dfs: 1,
  ucs: 2, dls: 2, 'bidirectional-bfs': 2,
  'greedy-bfs': 3, iddfs: 3, 'bidirectional-ucs': 3,
  astar: 4,
  rbfs: 5, 'weighted-astar': 5,
  'sma-star': 6, 'bidirectional-astar': 6, 'ida-star': 6,
  smgs: 7,
  'random-walk': 9,
  'hill-climbing-simple': 10,
  'hill-climbing-steepest': 11,
  'hill-climbing-first-choice': 12,
  'hill-climbing-stochastic': 12,
  'hill-climbing-sideways': 13,
  'hill-climbing-random-restart': 14,
  'simulated-annealing': 14,
  'local-beam-search': 15,
  'stochastic-beam-search': 16,
  'tabu-search': 17,
  'genetic-algorithm': 18,
  'min-conflicts': 19,
  minimax: 20, 'alpha-beta': 21, negamax: 22,
  expectimax: 23, mcts: 24, 'sss-star': 25,
  fssp: 30,
  bssp: 31,
  gsp: 32,
  graphplan: 33,
  satplan: 34,
  pop: 35,
  'backtracking-search': 40,
  'forward-checking': 41,
  'ac-3': 42,
  gac: 43,
  mac: 44,
  'tree-csp': 45,
  'cutset-conditioning': 46,
};

const NODE_H = 34;
const NODE_GAP_X = 180;
const ROW_GAP = 112;
const LANE_GAP = 126;
const LEFT_PAD = 120;
const TOP_PAD = 86;

interface RelationshipGraphProps {
  algorithms: AlgorithmMeta[];
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  isBackground?: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  meta: AlgorithmMeta;
  route: string;
  width: number;
  x: number;
  y: number;
}

interface GraphLink {
  key: string;
  source: string;
  target: string;
  label: string;
}

type Filter = AlgorithmCategory | 'all';

function labelWidth(text: string): number {
  return Math.max(74, Math.min(156, text.length * 6.6 + 26));
}

function getRelationshipLabel(source: AlgorithmMeta, target: AlgorithmMeta): string {
  if (source.relationshipLabel) return source.relationshipLabel;
  if (target.relationshipLabel) return target.relationshipLabel;

  const sTags = new Set(source.tags || []);
  const tTags = new Set(target.tags || []);
  if (tTags.has('heuristic') && !sTags.has('heuristic')) return 'adds heuristic';
  if (tTags.has('iterative') && !sTags.has('iterative')) return 'iterative variant';
  if (tTags.has('optimal') && !sTags.has('optimal')) return 'optimizing variant';

  return FALLBACK_EDGE_LABELS[`${source.id}→${target.id}`] ?? 'related';
}

function sortedByRank(items: AlgorithmMeta[]): AlgorithmMeta[] {
  return [...items].sort((a, b) => {
    const rankDelta = (ALGO_RANK[a.id] ?? 999) - (ALGO_RANK[b.id] ?? 999);
    if (rankDelta !== 0) return rankDelta;
    return (a.shortName ?? a.name).localeCompare(b.shortName ?? b.name);
  });
}

function rectEdgePoint(cx: number, cy: number, halfW: number, halfH: number, towardX: number, towardY: number): [number, number] {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const scaleX = Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return [cx + dx * scale, cy + dy * scale];
}

function edgePath(source: GraphNode, target: GraphNode): { d: string; labelX: number; labelY: number } {
  const [sx, sy] = rectEdgePoint(source.x, source.y, source.width / 2, NODE_H / 2, target.x, target.y);
  const [tx, ty] = rectEdgePoint(target.x, target.y, target.width / 2, NODE_H / 2, source.x, source.y);
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = source.y <= target.y ? 1 : -1;
  const bend = Math.min(54, Math.max(22, distance * 0.14)) * direction;
  const cx = (sx + tx) / 2 - (dy / distance) * bend;
  const cy = (sy + ty) / 2 + (dx / distance) * bend;
  return {
    d: `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`,
    labelX: cx,
    labelY: cy,
  };
}

export default function RelationshipGraph({ algorithms, onFullscreen, isFullscreen, isBackground }: RelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const markerBase = useId().replace(/:/g, '');
  const navigate = useNavigate();

  const [dims, setDims] = useState({ width: 800, height: 560 });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [filter, setFilter] = useState<Filter>('all');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateDims = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setDims((previous) => {
        const next = { width: Math.round(width), height: Math.round(height) };
        return previous.width === next.width && previous.height === next.height ? previous : next;
      });
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateDims(width, height);
      }
    });
    observer.observe(container);
    const rect = container.getBoundingClientRect();
    updateDims(rect.width, rect.height);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(() => {
    const metaById = new Map(algorithms.map((meta) => [meta.id, meta]));
    const visibleCategories = filter === 'all' ? CATEGORY_ORDER : [filter];
    const visibleMetas = visibleCategories.flatMap((category) => sortedByRank(algorithms.filter((meta) => meta.category === category)));

    const nodes: GraphNode[] = [];
    const nodeById = new Map<string, GraphNode>();

    if (filter === 'all') {
      visibleCategories.forEach((category, laneIndex) => {
        const categoryMetas = sortedByRank(algorithms.filter((meta) => meta.category === category));
        categoryMetas.forEach((meta, index) => {
          const label = meta.shortName ?? meta.name;
          const node: GraphNode = {
            id: meta.id,
            label,
            meta,
            route: buildRoute({ id: meta.id, category: meta.category }),
            width: labelWidth(label),
            x: LEFT_PAD + index * NODE_GAP_X,
            y: TOP_PAD + laneIndex * LANE_GAP,
          };
          nodes.push(node);
          nodeById.set(node.id, node);
        });
      });
    } else {
      const columns = Math.max(3, Math.floor((dims.width - 180) / NODE_GAP_X));
      visibleMetas.forEach((meta, index) => {
        const label = meta.shortName ?? meta.name;
        const node: GraphNode = {
          id: meta.id,
          label,
          meta,
          route: buildRoute({ id: meta.id, category: meta.category }),
          width: labelWidth(label),
          x: LEFT_PAD + (index % columns) * NODE_GAP_X,
          y: TOP_PAD + Math.floor(index / columns) * ROW_GAP,
        };
        nodes.push(node);
        nodeById.set(node.id, node);
      });
    }

    const seen = new Set<string>();
    const links: GraphLink[] = [];
    for (const meta of algorithms) {
      for (const relatedId of meta.relatedAlgorithms ?? []) {
        const related = metaById.get(relatedId);
        if (!related) continue;
        const metaRank = ALGO_RANK[meta.id] ?? 999;
        const relatedRank = ALGO_RANK[related.id] ?? 999;
        const source = metaRank <= relatedRank ? meta : related;
        const target = metaRank <= relatedRank ? related : meta;
        if (!nodeById.has(source.id) || !nodeById.has(target.id)) continue;
        const key = `${source.id}→${target.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ key, source: source.id, target: target.id, label: getRelationshipLabel(source, target) });
      }
    }

    const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2), dims.width - 80);
    const maxY = Math.max(...nodes.map((node) => node.y + NODE_H / 2), dims.height - 80);
    return {
      nodes,
      links,
      nodeById,
      bounds: { x: 0, y: 0, width: maxX + 110, height: maxY + 86 },
    };
  }, [algorithms, dims.width, dims.height, filter]);

  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  const activeEdge = hoveredEdgeKey ? graph.links.find((link) => link.key === hoveredEdgeKey) ?? null : null;

  const connected = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    if (!activeNodeId) return { nodeIds, edgeKeys };
    nodeIds.add(activeNodeId);
    for (const link of graph.links) {
      if (link.source === activeNodeId || link.target === activeNodeId) {
        edgeKeys.add(link.key);
        nodeIds.add(link.source);
        nodeIds.add(link.target);
      }
    }
    return { nodeIds, edgeKeys };
  }, [activeNodeId, graph.links]);

  const fitView = useCallback((duration = 420) => {
    if (!svgRef.current || !zoomRef.current) return;
    const { bounds } = graph;
    const pad = isFullscreen ? 72 : 44;
    const scale = Math.min((dims.width - pad * 2) / bounds.width, (dims.height - pad * 2) / bounds.height, 1.25);
    const tx = (dims.width - bounds.width * scale) / 2;
    const ty = (dims.height - bounds.height * scale) / 2;
    d3.select(svgRef.current)
      .transition()
      .duration(duration)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(Math.max(0.35, scale)));
  }, [dims.width, dims.height, graph.bounds.width, graph.bounds.height, isFullscreen]);

  useEffect(() => {
    if (!svgRef.current || !contentRef.current) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 2.8])
      .on('zoom', (event) => {
        d3.select(contentRef.current).attr('transform', event.transform.toString());
        setZoomPercent(Math.round(event.transform.k * 100));
      });
    d3.select(svgRef.current).call(zoom);
    zoomRef.current = zoom;
    return () => {
      d3.select(svgRef.current).on('.zoom', null);
    };
  }, []);

  const autoFitKey = `${filter}:${dims.width}x${dims.height}:${graph.bounds.width}x${graph.bounds.height}:${isFullscreen ? 'fullscreen' : 'inline'}`;
  const lastAutoFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastAutoFitKeyRef.current === autoFitKey) return;
    lastAutoFitKeyRef.current = autoFitKey;
    const timeout = window.setTimeout(() => fitView(0), 20);
    return () => window.clearTimeout(timeout);
  }, [autoFitKey, fitView]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, 1.22);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, 1 / 1.22);
  }, []);

  const selectedNode = activeNodeId ? graph.nodeById.get(activeNodeId) ?? null : null;
  const detailNode = hoveredNodeId ? graph.nodeById.get(hoveredNodeId) ?? null : selectedNode;
  const outgoing = detailNode ? graph.links.filter((link) => link.source === detailNode.id) : [];
  const incoming = detailNode ? graph.links.filter((link) => link.target === detailNode.id) : [];

  const focusIsActive = Boolean(activeNodeId || activeEdge);
  const categoriesWithCounts = CATEGORY_ORDER.map((category) => ({
    category,
    count: algorithms.filter((meta) => meta.category === category).length,
  }));

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded bg-[var(--bg)]">
      <svg ref={svgRef} width={dims.width} height={dims.height} className="h-full w-full">
        <defs>
          <pattern id={`${markerBase}-grid`} x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--text-3)" opacity="0.12" />
          </pattern>
          <marker id={`${markerBase}-arrow`} viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,-4L10,0L0,4" fill="var(--text-3)" opacity="0.75" />
          </marker>
          <marker id={`${markerBase}-arrow-active`} viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,-4L10,0L0,4" fill="var(--accent)" />
          </marker>
          <filter id={`${markerBase}-node-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#58A6FF" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${markerBase}-grid)`} />
        <g ref={contentRef}>
          {filter === 'all' && CATEGORY_ORDER.map((category, index) => {
            const y = TOP_PAD + index * LANE_GAP;
            return (
              <g key={category} opacity={focusIsActive && selectedNode?.meta.category !== category ? 0.42 : 1}>
                <line x1={42} y1={y} x2={graph.bounds.width - 68} y2={y} stroke="var(--border)" strokeDasharray="4 10" opacity={0.45} />
                <text x={42} y={y - 26} fill={CATEGORY_COLORS[category]} fontSize={11} fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                  {CATEGORY_LABELS[category]}
                </text>
              </g>
            );
          })}

          <g>
            {graph.links.map((link) => {
              const source = graph.nodeById.get(link.source);
              const target = graph.nodeById.get(link.target);
              if (!source || !target) return null;
              const path = edgePath(source, target);
              const isConnected = connected.edgeKeys.has(link.key);
              const isHovered = hoveredEdgeKey === link.key;
              const isActive = isConnected || isHovered;
              const opacity = focusIsActive ? (isActive ? 0.95 : 0.1) : 0.34;
              return (
                <g
                  key={link.key}
                  onMouseEnter={() => setHoveredEdgeKey(link.key)}
                  onMouseLeave={() => setHoveredEdgeKey(null)}
                  className="cursor-help"
                >
                  <path d={path.d} fill="none" stroke="transparent" strokeWidth={14} />
                  <path
                    d={path.d}
                    fill="none"
                    stroke={isActive ? 'var(--accent)' : 'var(--border)'}
                    strokeWidth={isActive ? 1.9 : 1.15}
                    opacity={opacity}
                    markerEnd={`url(#${isActive ? `${markerBase}-arrow-active` : `${markerBase}-arrow`})`}
                  />
                  {isActive && (
                    <g transform={`translate(${path.labelX}, ${path.labelY})`} pointerEvents="none">
                      <rect x={-labelWidth(link.label) / 2} y={-10} width={labelWidth(link.label)} height={20} rx={5} fill="var(--surface)" stroke="var(--border)" opacity={0.94} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontFamily="JetBrains Mono, monospace" fill="var(--text-2)">
                        {link.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          <g>
            {graph.nodes.map((node) => {
              const color = CATEGORY_COLORS[node.meta.category];
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnected = connected.nodeIds.has(node.id);
              const isDimmed = focusIsActive && !isConnected && !isHovered && !(activeEdge && (activeEdge.source === node.id || activeEdge.target === node.id));
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  opacity={isDimmed ? 0.22 : 1}
                  filter={isSelected || isHovered ? `url(#${markerBase}-node-glow)` : undefined}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => setSelectedNodeId((current) => current === node.id ? null : node.id)}
                >
                  <rect
                    x={-node.width / 2}
                    y={-NODE_H / 2}
                    width={node.width}
                    height={NODE_H}
                    rx={7}
                    fill={color}
                    fillOpacity={isSelected || isHovered ? 0.24 : 0.13}
                    stroke={color}
                    strokeWidth={isSelected || isHovered ? 2.1 : 1.2}
                  />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontFamily="JetBrains Mono, monospace" fill="var(--text)" fontWeight={isSelected ? 700 : 500} pointerEvents="none">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {!isBackground && (
        <>
          <div className="absolute left-3 top-3 right-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-1 backdrop-blur-xl scrollbar-none">
              <button
                onClick={() => { setFilter('all'); setSelectedNodeId(null); }}
                className={cn('h-7 rounded-md px-2 text-[10px] font-mono transition-colors', filter === 'all' ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--text-2)] hover:text-[var(--text)]')}
              >
                Overview
              </button>
              {categoriesWithCounts.map(({ category, count }) => (
                <button
                  key={category}
                  onClick={() => { setFilter(category); setSelectedNodeId(null); }}
                  className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-mono transition-colors', filter === category ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-2)] hover:text-[var(--text)]')}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
                  <span className="hidden sm:inline">{CATEGORY_LABELS[category]}</span>
                  <span className="sm:hidden">{CATEGORY_LABELS[category].split(' ')[0]}</span>
                  <span className="text-[var(--text-3)]">{count}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-1 backdrop-blur-xl">
              <span className="hidden rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-mono text-[var(--text-2)] sm:inline">{zoomPercent}%</span>
              {onFullscreen && (
                <button onClick={onFullscreen} className="ui-btn ui-btn-icon h-7 w-7 rounded-md" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              )}
              <button onClick={() => fitView()} className="ui-btn ui-btn-icon h-7 w-7 rounded-md" aria-label="Reset view"><Search size={14} /></button>
              <button onClick={handleZoomIn} className="ui-btn ui-btn-icon h-7 w-7 rounded-md" aria-label="Zoom in"><ZoomIn size={14} /></button>
              <button onClick={handleZoomOut} className="ui-btn ui-btn-icon h-7 w-7 rounded-md" aria-label="Zoom out"><ZoomOut size={14} /></button>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 md:left-auto md:w-[360px] rounded-lg border border-[var(--border)] bg-[var(--surface)]/92 p-3 backdrop-blur-xl shadow-lg">
            {activeEdge ? (
              <>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">Relationship</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {graph.nodeById.get(activeEdge.source)?.label} → {graph.nodeById.get(activeEdge.target)?.label}
                </h3>
                <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)]">{activeEdge.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-2)]">
                  {RELATIONSHIP_DESCRIPTIONS[activeEdge.label] ?? RELATIONSHIP_DESCRIPTIONS.related}
                </p>
              </>
            ) : detailNode ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">{CATEGORY_LABELS[detailNode.meta.category]}</p>
                    <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">{detailNode.meta.name}</h3>
                  </div>
                  <button
                    onClick={() => navigate(detailNode.route)}
                    className="ui-btn h-7 rounded-md px-2 text-[10px]"
                    title="Open algorithm"
                  >
                    <MoveRight size={12} />
                    Open
                  </button>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-2)]">{detailNode.meta.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {detailNode.meta.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-2)]">
                      {tag}
                    </span>
                  ))}
                </div>
                {(incoming.length > 0 || outgoing.length > 0) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="mb-1 font-mono uppercase tracking-wider text-[var(--text-3)]">Builds On</p>
                      <div className="space-y-1">
                        {incoming.slice(0, 3).map((link) => <p key={link.key} className="truncate text-[var(--text-2)]">{graph.nodeById.get(link.source)?.label}</p>)}
                        {incoming.length === 0 && <p className="text-[var(--text-3)]">Foundation</p>}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 font-mono uppercase tracking-wider text-[var(--text-3)]">Leads To</p>
                      <div className="space-y-1">
                        {outgoing.slice(0, 3).map((link) => <p key={link.key} className="truncate text-[var(--text-2)]">{graph.nodeById.get(link.target)?.label}</p>)}
                        {outgoing.length === 0 && <p className="text-[var(--text-3)]">Specialized end</p>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-3)]">Algorithm Lineage</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">A calmer map of conceptual inheritance</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-2)]">
                  Families are arranged left to right from foundation algorithms toward more specialized variants. Relationship labels stay quiet until a node or edge is in focus.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
