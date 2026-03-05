import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta, AlgorithmCategory } from '@/types/algorithm';
import { buildRoute } from '@/lib/buildRoute';
import { ZoomIn, ZoomOut, Maximize2 } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

const GROUP_COLORS: Record<string, string> = {
  uninformed: '#58A6FF',
};

const CATEGORY_TO_GROUP: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'uninformed',
};

// Curated edge labels for well-known relationships
const EDGE_LABELS: Record<string, string> = {
  'dfs\u2192dls': 'depth limits',
  'dls\u2192iddfs': 'iterates',
  'bfs\u2192ucs': 'weighted',
  'bfs\u2192bidirectional-bfs': 'bidirectional',
  'ucs\u2192bidirectional-bfs': 'bidirectional',
};

interface RelationshipGraphProps {
  algorithms: AlgorithmMeta[];
  onFullscreen?: () => void;
}

/** Approximate the pixel width of a label for rect sizing */
function labelWidth(text: string): number {
  return text.length * 6.5 + 22;
}

const NODE_HEIGHT = 30;

export default function RelationshipGraph({ algorithms, onFullscreen }: RelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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
        const fwd = `${m.id}\u2192${relId}`;
        const rev = `${relId}\u2192${m.id}`;
        if (seenEdges.has(fwd) || seenEdges.has(rev)) continue;
        seenEdges.add(fwd);
        const label = EDGE_LABELS[fwd] ?? EDGE_LABELS[rev] ?? '';
        links.push({ source: m.id, target: relId, label });
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

    // Target positions for each category cluster — tighter spacing
    const GROUP_CENTERS: Record<string, { x: number; y: number }> = {
      uninformed: { x: 0.5 * width, y: 0.5 * height },
    };

    const simulation = d3
      .forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.008))
      .force('collision', d3.forceCollide<SimNode>(d => labelWidth(d.label) / 2 + 8))
      .force('x', d3.forceX<SimNode>(d => GROUP_CENTERS[d.group]?.x ?? width / 2).strength(0.12))
      .force('y', d3.forceY<SimNode>(d => GROUP_CENTERS[d.group]?.y ?? height / 2).strength(0.12))
      .alphaDecay(0.015)
      .alphaMin(0.001)
      .velocityDecay(0.4);

    const g = svg.append('g');

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on('zoom', ev => g.attr('transform', ev.transform));
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Arrow marker
    svg.append('defs').append('marker')
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

    // Curved edges using quadratic bezier paths
    const linkPath = g.selectAll('.rl-link').data(simLinks).enter().append('path')
      .attr('class', 'rl-link')
      .attr('fill', 'none')
      .attr('stroke', 'var(--border, #30363D)')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#rel-arrow)');

    // Edge labels
    const linkLabel = g.selectAll('.rl-label').data(simLinks).enter().append('text')
      .attr('class', 'rl-label')
      .attr('font-size', 9)
      .attr('fill', 'var(--text-3, #6E7681)')
      .attr('text-anchor', 'middle')
      .text(d => d.label);

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
      .on('mouseenter', function () {
        d3.select(this).select('rect')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 0 6px rgba(88, 166, 255, 0.4))');
      })
      .on('mouseleave', function () {
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
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;

        const sHalfW = labelWidth(s.label) / 2;
        const tHalfW = labelWidth(t.label) / 2;
        const halfH = NODE_HEIGHT / 2;

        const [x1, y1] = rectEdgePoint(sx, sy, sHalfW, halfH, tx, ty);
        const [x2, y2] = rectEdgePoint(tx, ty, tHalfW, halfH, sx, sy);

        return curvedPath(x1, y1, x2, y2);
      });

      linkLabel
        .attr('x', d => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr('y', d => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2 - 4);

      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // After simulation stabilises, auto-fit then start breathing animation
    let breatheInterval: ReturnType<typeof setInterval> | null = null;

    simulation.on('end', () => {
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
        // Pick 3 random nodes and nudge them slightly
        for (let i = 0; i < 3; i++) {
          const idx = Math.floor(Math.random() * simNodes.length);
          const node = simNodes[idx];
          if (node.fx != null) continue; // skip if being dragged
          node.vx = (node.vx ?? 0) + (Math.random() - 0.5) * 3;
          node.vy = (node.vy ?? 0) + (Math.random() - 0.5) * 3;
        }
        simulation.alpha(0.03).restart();
      }, 3500);
    });

    // --- Floating Legend ---
    const legendData = Object.entries(GROUP_COLORS);
    const legendPadX = 12;
    const legendPadY = 10;
    const legendRowH = 20;
    const legendW = 110;
    const legendH = legendPadY * 2 + legendData.length * legendRowH;
    const legendX = width - legendW - 16;
    const legendY = height - legendH - 16;

    const legend = svg.append('g')
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
      const row = legend.append('g')
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

    return () => {
      simulation.stop();
      if (breatheInterval) clearInterval(breatheInterval);
    };
  }, [algorithms, width, height, navigate]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[var(--bg)] rounded overflow-hidden">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />

      {/* Zoom controls + fullscreen - top right */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
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
            aria-label="Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        )}
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
    </div>
  );
}
