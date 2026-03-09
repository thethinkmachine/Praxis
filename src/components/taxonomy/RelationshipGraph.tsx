import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta, AlgorithmCategory } from '@/types/algorithm';
import { buildRoute } from '@/lib/buildRoute';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Search } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

const GROUP_COLORS: Record<string, string> = {
  uninformed: '#58A6FF',
  informed: '#D2A8FF',
  game: '#F2C94C',
};

const CATEGORY_TO_GROUP: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'uninformed',
  'informed-search': 'informed',
  'game-playing': 'game',
};

const CATEGORY_ICONS: Record<string, string> = {
  'uninformed-search': 'search',
  'informed-search': 'zap',
  'game-playing': 'game',
};

const RELATIONSHIP_DESCRIPTIONS: Record<string, string> = {
  'adds heuristic': 'Enhances a classic search by using a heuristic function to estimate the distance to the goal, significantly reducing the number of nodes explored.',
  'iterative variant': 'Adapts the algorithm to use iterative deepening, which provides the space efficiency of depth-first search while maintaining the completeness of breadth-first search.',
  'optimizing variant': 'A more advanced version designed to find the truly optimal (lowest cost) path rather than just any path to the goal.',
  'depth limits': 'Imposes a mandatory maximum depth to prevent infinite loops in deep or cyclic graphs.',
  'iterates': 'Repeatedly runs a depth-limited search with increasing limits until a solution is found.',
  'weighted': 'Generalizes the search to handle graphs where edges have different costs or weights.',
  'bidirectional': 'Searches from both the start and the goal simultaneously, meeting in the middle to find a path much faster than a standard one-directional search.',
  'f-threshold': 'Uses a cost-based threshold to prune branches, similar to how A* uses f(n) to prioritize nodes.',
  'memory-bounded': 'Constrains memory usage by retaining only a limited frontier and backing up f-costs when low-value leaves are discarded.',
  'prunes': 'Eliminates branches of the game tree that are guaranteed not to affect the final decision, dramatically increasing performance.',
  'symmetric': 'Leverages the zero-sum nature of the game to simplify the logic, treating players symmetrically to reduce code complexity.',
  'related': 'These algorithms share fundamental logic or theoretical roots within the same branch of computation.'
};

// Fallback edge labels if metadata-based detection fails
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
  'rbfs→sma-star': 'memory-bounded',
  'iddfs→ida-star': 'f-threshold',
  'minimax→alpha-beta': 'prunes',
  'minimax→negamax': 'symmetric',
};

/** 
 * Establish a logical hierarchy for the lineage arrows.
 * Lower numbers = simpler/earlier algorithms.
 * Arrows always point from Lower Rank -> Higher Rank.
 */
const ALGO_RANK: Record<string, number> = {
  'bfs': 1, 'dfs': 1,
  'ucs': 2, 'dls': 2, 'bidirectional-bfs': 2,
  'greedy-bfs': 3, 'iddfs': 3, 'bidirectional-ucs': 3,
  'astar': 4,
  'rbfs': 5, 'weighted-astar': 5,
  'sma-star': 6, 'bidirectional-astar': 6, 'ida-star': 6,
  'minimax': 10, 'alpha-beta': 11, 'negamax': 12
};

function getRelationshipLabel(source: AlgorithmMeta, target: AlgorithmMeta): string {
  // 1. Check if either metadata has a specific relationship label
  if (source.relationshipLabel) return source.relationshipLabel;
  if (target.relationshipLabel) return target.relationshipLabel;

  // 2. Logic-based inference (Source is lower rank, Target is higher rank)
  const sTags = new Set(source.tags || []);
  const tTags = new Set(target.tags || []);

  // Evolution: simple -> heuristic
  if (tTags.has('heuristic') && !sTags.has('heuristic')) return 'adds heuristic';
  
  // Evolution: static -> iterative
  if (tTags.has('iterative') && !sTags.has('iterative')) return 'iterative variant';

  // Evolution: suboptimal -> optimal
  if (tTags.has('optimal') && !sTags.has('optimal')) return 'optimizing variant';

  // 3. Fallback
  const keyMatch = `${source.id}→${target.id}`;
  return FALLBACK_EDGE_LABELS[keyMatch] ?? 'related';
}

interface RelationshipGraphProps {
  algorithms: AlgorithmMeta[];
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  isBackground?: boolean;
}

/** Approximate the pixel width of a label for rect sizing */
function labelWidth(text: string): number {
  return text.length * 6.5 + 22;
}

const NODE_HEIGHT = 30;

export default function RelationshipGraph({ algorithms, onFullscreen, isFullscreen, isBackground }: RelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [hoveredNode, setHoveredNode] = useState<AlgorithmMeta | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ sourceName: string; targetName: string; label: string; description: string } | null>(null);
  const [nodeSpacing, setNodeSpacing] = useState(120);
  const [clusterSpread, setClusterSpread] = useState(1.0);

  const hoverRef = useRef({ hoveredNode, hoveredEdge });
  useEffect(() => {
    hoverRef.current = { hoveredNode, hoveredEdge };
  }, [hoveredNode, hoveredEdge]);

  // Track container dimensions via ResizeObserver
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 800, height: 520 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ width, height });
        }
      }
    });

    observer.observe(container);

    // Set initial dimensions
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDims({ width: rect.width, height: rect.height });
    }

    return () => observer.disconnect();
  }, []);

  const { width, height } = dims;

  // Zoom control callbacks
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1 / 1.3);
  }, []);

  const handleResetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  useEffect(() => {
    if (!svgRef.current || algorithms.length === 0 || width === 0 || height === 0) return;

    const idSet = new Set(algorithms.map(m => m.id));

    // Build node data from algorithm metadata
    const nodes = algorithms.map(m => ({
      id: m.id,
      label: m.shortName ?? m.name,
      group: CATEGORY_TO_GROUP[m.category] ?? 'other',
      category: m.category,
      route: buildRoute({ id: m.id, category: m.category }),
    }));

    // Build deduplicated directed edges from relatedAlgorithms
    const seenEdges = new Set<string>();
    const links: { source: string; target: string; label: string }[] = [];

    for (const m of algorithms) {
      for (const relId of (m.relatedAlgorithms ?? [])) {
        if (!idSet.has(relId)) continue;
        const targetMeta = algorithms.find(a => a.id === relId);
        if (!targetMeta) continue;

        // Ensure arrows point from Simpler -> Complex (Lower Rank -> Higher Rank)
        const sRank = ALGO_RANK[m.id] ?? 0;
        const tRank = ALGO_RANK[relId] ?? 0;
        
        const sourceId = sRank <= tRank ? m.id : relId;
        const targetId = sRank <= tRank ? relId : m.id;
        const sMeta = sRank <= tRank ? m : targetMeta;
        const tMeta = sRank <= tRank ? targetMeta : m;

        const edgeKey = `${sourceId}→${targetId}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        
        const label = getRelationshipLabel(sMeta, tMeta);
        links.push({ source: sourceId, target: targetId, label });
      }
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    type SimNode = typeof nodes[number] & d3.SimulationNodeDatum;
    type SimLink = d3.SimulationLinkDatum<SimNode> & { label: string };

    const simNodes: SimNode[] = nodes.map(n => ({ ...n }));
    const nodeById = new Map(simNodes.map(n => [n.id, n]));

    const simLinks: SimLink[] = links.map(l => ({
      source: nodeById.get(l.source) ?? l.source,
      target: nodeById.get(l.target) ?? l.target,
      label: l.label,
    })).filter(l => typeof l.source === 'object' && typeof l.target === 'object');

    // Target positions for each category cluster — dynamically spread
    const GROUP_CENTERS: Record<string, { x: number; y: number }> = {
      uninformed: { 
        x: width * (0.5 - 0.26 * clusterSpread), 
        y: height * (0.5 + 0.22 * clusterSpread) 
      },
      informed: { 
        x: width * (0.5 + 0.26 * clusterSpread), 
        y: height * (0.5 + 0.22 * clusterSpread) 
      },
      game: { 
        x: width * 0.5, 
        y: height * (0.5 - 0.32 * clusterSpread) 
      },
    };

    const simulation = d3
      .forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(nodeSpacing * 1.5))
      .force('charge', d3.forceManyBody().strength(-nodeSpacing * 5))
      .force('collision', d3.forceCollide<SimNode>(d => labelWidth(d.label) / 2 + (nodeSpacing * 0.2)))
      .force('x', d3.forceX<SimNode>(d => GROUP_CENTERS[d.group]?.x ?? width / 2).strength(0.08))
      .force('y', d3.forceY<SimNode>(d => GROUP_CENTERS[d.group]?.y ?? height / 2).strength(0.08))
      .alphaDecay(0.018) // Slightly faster decay for stability
      .alphaMin(0.001)
      .velocityDecay(0.4);

    const g = svg.append('g');

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on('zoom', (ev) => {
      g.attr('transform', ev.transform);
      setZoomPercent(Math.round(ev.transform.k * 100));
    });
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Standard Arrow marker
    const defs = svg.append('defs');
    
    defs.append('marker')
      .attr('id', 'rel-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--text-3, #484F58)');

    // Active/Hover Arrow marker
    defs.append('marker')
      .attr('id', 'rel-arrow-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--accent, #58a6ff)');

    // Curved edges using quadratic bezier paths
    const linkGroup = g.selectAll('.rl-link-group').data(simLinks).enter().append('g')
      .attr('class', 'rl-link-group');

    const linkHitArea = linkGroup.append('path')
      .attr('class', 'rl-link-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .style('cursor', 'help');

    const linkPath = linkGroup.append('path')
      .attr('class', 'rl-link')
      .attr('fill', 'none')
      .attr('stroke', 'var(--border, #30363D)')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#rel-arrow)');

    // Edge labels
    const linkLabel = linkGroup.append('text')
      .attr('class', 'rl-label')
      .attr('font-size', 9)
      .attr('fill', 'var(--text-3, #6E7681)')
      .attr('text-anchor', 'middle')
      .text(d => d.label);

    linkGroup
      .on('mouseenter', function (_ev, d) {
        const sNode = algorithms.find(a => a.id === (d.source as SimNode).id);
        const tNode = algorithms.find(a => a.id === (d.target as SimNode).id);
        if (sNode && tNode) {
          setHoveredEdge({
            sourceName: sNode.shortName || sNode.name,
            targetName: tNode.shortName || tNode.name,
            label: d.label,
            description: RELATIONSHIP_DESCRIPTIONS[d.label] || 'Related concepts in algorithm design.'
          });
        }
        d3.select(this).select('.rl-link')
          .attr('stroke', 'var(--accent, #58a6ff)')
          .attr('stroke-width', 1.8)
          .attr('marker-end', 'url(#rel-arrow-active)');
        d3.select(this).select('.rl-label')
          .attr('fill', 'var(--text, #f0f6fc)')
          .attr('font-weight', '600');
      })
      .on('mouseleave', function () {
        setHoveredEdge(null);
        d3.select(this).select('.rl-link')
          .attr('stroke', 'var(--border, #30363D)')
          .attr('stroke-width', 1.2)
          .attr('marker-end', 'url(#rel-arrow)');
        d3.select(this).select('.rl-label')
          .attr('fill', 'var(--text-3, #6E7681)')
          .attr('font-weight', 'normal');
      });

    const nodeGroup = g.selectAll('.rn').data(simNodes).enter().append('g')
      .attr('class', 'rn')
      .style('cursor', d => d.route ? 'pointer' : 'default')
      .on('click', (_ev, d) => { if (d.route) navigate(d.route); })
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (ev, d) => { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on('end', (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Hover effects
    nodeGroup
      .on('mouseenter', function (_ev, d) {
        setHoveredNode(algorithms.find(a => a.id === d.id) || null);
        d3.select(this).select('rect')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 0 6px rgba(88, 166, 255, 0.4))');
      })
      .on('mouseleave', function () {
        setHoveredNode(null);
        d3.select(this).select('rect')
          .attr('stroke-width', 1.5)
          .style('filter', 'none');
      });

    // Rounded rectangle node background
    nodeGroup.append('rect')
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('width', d => labelWidth(d.label))
      .attr('height', NODE_HEIGHT)
      .attr('x', d => -labelWidth(d.label) / 2)
      .attr('y', -NODE_HEIGHT / 2)
      .attr('fill', d => (GROUP_COLORS[d.group] ?? '#7D8590') + '25')
      .attr('stroke', d => GROUP_COLORS[d.group] ?? '#7D8590')
      .attr('stroke-width', 1.5);

    // Node label text — uses CSS variable for theme-awareness
    nodeGroup.append('text')
      .attr('font-size', 10)
      .attr('fill', 'var(--text, #E6EDF3)')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .text(d => d.label);

    /** Compute a quadratic bezier curve between source and target. */
    function curvedPath(sx: number, sy: number, tx: number, ty: number): string {
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const offset = Math.min(dist * 0.2, 40);
      const mx = (sx + tx) / 2 - (dy / dist) * offset;
      const my = (sy + ty) / 2 + (dx / dist) * offset;

      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    }

    /** Compute where an edge should connect to a rounded-rect node boundary */
    function rectEdgePoint(
      cx: number, cy: number,
      halfW: number, halfH: number,
      fromX: number, fromY: number,
    ): [number, number] {
      const dx = fromX - cx;
      const dy = fromY - cy;
      if (dx === 0 && dy === 0) return [cx, cy];

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const scaleX = absDx > 0 ? halfW / absDx : Infinity;
      const scaleY = absDy > 0 ? halfH / absDy : Infinity;
      const scale = Math.min(scaleX, scaleY);

      return [cx + dx * scale, cy + dy * scale];
    }

    simulation.on('tick', () => {
      linkPath.attr('d', d => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${s.x ?? 0},${s.y ?? 0}A${dr},${dr} 0 0,1 ${t.x ?? 0},${t.y ?? 0}`;
      });

      linkHitArea.attr('d', d => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${s.x ?? 0},${s.y ?? 0}A${dr},${dr} 0 0,1 ${t.x ?? 0},${t.y ?? 0}`;
      });

      linkLabel.attr('transform', d => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        
        const mx = ((s.x ?? 0) + (t.x ?? 0)) / 2;
        const my = ((s.y ?? 0) + (t.y ?? 0)) / 2;
        
        const normalX = -dy / (dr/20 || 1);
        const normalY = dx / (dr/20 || 1);
        
        return `translate(${mx + normalX}, ${my + normalY})`;
      });

      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // After simulation stabilises, auto-fit then start breathing animation
    let breatheInterval: ReturnType<typeof setInterval> | null = null;
    let hasFitted = false;

    simulation.on('end', () => {
      if (hasFitted) return;
      hasFitted = true;

      // Auto-fit
      const gNode = g.node() as SVGGElement | null;
      if (gNode) {
        const bbox = gNode.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          const pad = 48;
          const scale = Math.min(
            (width - 2 * pad) / bbox.width,
            (height - 2 * pad) / bbox.height,
            1.4,
          );
          const tx = (width - scale * (2 * bbox.x + bbox.width)) / 2;
          const ty = (height - scale * (2 * bbox.y + bbox.height)) / 2;
          svg.transition().duration(600).call(
            zoomBehavior.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale),
          );
        }
      }

      // Start breathing animation — gentle perturbation every 3.5s
      breatheInterval = setInterval(() => {
        // FREEZE: Don't perturb if user is reading (hovering) or if it's the main page and not background
        if (hoverRef.current.hoveredNode || hoverRef.current.hoveredEdge) return;

        // Pick 2 random nodes and nudge them slightly
        for (let i = 0; i < 2; i++) {
          const idx = Math.floor(Math.random() * simNodes.length);
          const node = simNodes[idx];
          if (node.fx != null) continue; // skip if being dragged
          node.vx = (node.vx ?? 0) + (Math.random() - 0.5) * 2;
          node.vy = (node.vy ?? 0) + (Math.random() - 0.5) * 2;
        }
        simulation.alpha(0.02).restart();
      }, 3500);
    });

    // --- Floating Legend ---
    let legend: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
    if (!isBackground) {
      const legendData = Object.entries(GROUP_COLORS);
      const legendPadX = 12;
      const legendPadY = 10;
      const legendRowH = 20;
      const legendW = 110;
      const legendH = legendPadY * 2 + legendData.length * legendRowH;
      const legendX = width - legendW - 16;
      const legendY = height - legendH - 16;

      legend = svg.append('g')
        .attr('transform', `translate(${legendX}, ${legendY})`);

      legend.append('rect')
        .attr('width', legendW)
        .attr('height', legendH)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', 'var(--surface, #161B22)')
        .attr('fill-opacity', 0.85)
        .attr('stroke', 'var(--border, #30363D)')
        .attr('stroke-width', 1);

      legendData.forEach(([group, color], i) => {
        const row = legend!.append('g')
          .attr('transform', `translate(${legendPadX}, ${legendPadY + i * legendRowH + legendRowH / 2})`);

        row.append('rect')
          .attr('rx', 3)
          .attr('ry', 3)
          .attr('width', 12)
          .attr('height', 12)
          .attr('x', 0)
          .attr('y', -6)
          .attr('fill', color + '40')
          .attr('stroke', color)
          .attr('stroke-width', 1);

        row.append('text')
          .attr('x', 18)
          .attr('y', 4)
          .attr('font-size', 10)
          .attr('fill', 'var(--text-2, #8B949E)')
          .text(group.charAt(0).toUpperCase() + group.slice(1));
      });
    }

    return () => {
      simulation.stop();
      if (breatheInterval) clearInterval(breatheInterval);
    };
  }, [algorithms, width, height, nodeSpacing, clusterSpread, navigate]);

  return (
    <div ref={containerRef} className="relative w-full h-full rounded overflow-hidden bg-[radial-gradient(circle_at_top,rgba(88,166,255,0.09),transparent_40%),var(--bg)]">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />

      {!isBackground && (
        <>
          <div className="absolute left-3 top-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/88 px-3 py-2 backdrop-blur-xl max-w-xs transition-all duration-200">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)] font-mono">
              {hoveredNode ? hoveredNode.name : hoveredEdge ? `${hoveredEdge.sourceName} → ${hoveredEdge.targetName}` : 'Algorithm Lineage'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)] leading-relaxed">
              {hoveredNode 
                ? hoveredNode.description 
                : hoveredEdge
                ? hoveredEdge.description
                : 'Traverse the evolutionary tree of search. Edges highlight how algorithms derive from, optimize, or specialize one another.'}
            </p>
            {hoveredNode && (
              <div className="mt-2 flex flex-wrap gap-1">
                {hoveredNode.tags?.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {hoveredEdge && (
              <div className="mt-2 text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
                {hoveredEdge.label}
              </div>
            )}
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/88 p-2 backdrop-blur-xl">
            {/* Spacing Controls Group */}
            <div className="flex items-center gap-4 px-2 border-r border-[var(--border)]">
              {/* Node Sparsity */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-[var(--text-3)] font-mono whitespace-nowrap">Node Sparsity</span>
                <div className="relative w-20 h-4 flex items-center group">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--border)]" />
                  <div 
                    className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[#58A6FF] to-[#D2A8FF]" 
                    style={{ width: `${((nodeSpacing - 50) / 250) * 100}%` }}
                  />
                  <input 
                    type="range"
                    min={50}
                    max={300}
                    value={nodeSpacing}
                    onChange={(e) => setNodeSpacing(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#58A6FF] shadow-sm pointer-events-none transition-transform group-active:scale-125"
                    style={{ left: `calc(${((nodeSpacing - 50) / 250) * 100}% - 6px)` }}
                  />
                </div>
              </div>

              {/* Cluster Sparsity */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-[var(--text-3)] font-mono whitespace-nowrap">Cluster Sparsity</span>
                <div className="relative w-20 h-4 flex items-center group">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--border)]" />
                  <div 
                    className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[#D2A8FF] to-[#F2C94C]" 
                    style={{ width: `${((clusterSpread - 0.4) / 1.6) * 100}%` }}
                  />
                  <input 
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.1}
                    value={clusterSpread}
                    onChange={(e) => setClusterSpread(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#D2A8FF] shadow-sm pointer-events-none transition-transform group-active:scale-125"
                    style={{ left: `calc(${((clusterSpread - 0.4) / 1.6) * 100}% - 6px)` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-mono text-[var(--text)]">
              {zoomPercent}%
            </div>
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className={cn(
              'p-1.5 rounded-md',
              'bg-[var(--surface)] border border-[var(--border)]',
              'text-[var(--text-2)] hover:text-[var(--text)]',
              'hover:bg-[var(--surface-2)] hover:border-[#58A6FF]',
              'transition-colors duration-150',
            )}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
        <button
          onClick={handleResetView}
          className={cn(
            'p-1.5 rounded-md',
            'bg-[var(--surface)] border border-[var(--border)]',
            'text-[var(--text-2)] hover:text-[var(--text)]',
            'hover:bg-[var(--surface-2)] hover:border-[#58A6FF]',
            'transition-colors duration-150',
          )}
          aria-label="Reset view"
        >
          <Search size={16} />
        </button>
        <button
          onClick={handleZoomIn}
          className={cn(
            'p-1.5 rounded-md',
            'bg-[var(--surface)] border border-[var(--border)]',
            'text-[var(--text-2)] hover:text-[var(--text)]',
            'hover:bg-[var(--surface-2)] hover:border-[#58A6FF]',
            'transition-colors duration-150',
          )}
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className={cn(
            'p-1.5 rounded-md',
            'bg-[var(--surface)] border border-[var(--border)]',
            'text-[var(--text-2)] hover:text-[var(--text)]',
            'hover:bg-[var(--surface-2)] hover:border-[#58A6FF]',
            'transition-colors duration-150',
          )}
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
      </div>
        </>
      )}
    </div>
  );
}
