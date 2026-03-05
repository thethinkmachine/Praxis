import { useMemo } from 'react';
import type { SVGNodeVM } from './svg-graph.types';
import { MINIMAP_DOT_COLORS, MINIMAP_DOT_COLORS_LIGHT } from './svg-graph.types';
import type { ZoomTransform } from 'd3';
import { usePreferencesStore } from '@/store/preferences.store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface GraphMinimapProps {
  /** All node view models */
  nodes: SVGNodeVM[];
  /** Current D3 zoom transform */
  transform: ZoomTransform;
  /** Canvas SVG width in pixels */
  canvasWidth: number;
  /** Canvas SVG height in pixels */
  canvasHeight: number;
  /** Callback to jump the main view to a graph-space coordinate */
  onViewJump?: (x: number, y: number) => void;
}

const MINIMAP_W = 120;
const MINIMAP_H = 80;
const PAD = 40;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GraphMinimap({
  nodes,
  transform,
  canvasWidth,
  canvasHeight,
  onViewJump,
}: GraphMinimapProps) {
  if (nodes.length === 0) return null;

  const darkMode = usePreferencesStore((s) => s.darkMode);
  const dotColors = darkMode ? MINIMAP_DOT_COLORS : MINIMAP_DOT_COLORS_LIGHT;

  const { dots, vx, vy, vw, vh, bbX1, bbY1, scale, offsetX, offsetY } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }

    const bbX1 = minX - PAD;
    const bbY1 = minY - PAD;
    const bbX2 = maxX + PAD;
    const bbY2 = maxY + PAD;
    const bw = bbX2 - bbX1 || 1;
    const bh = bbY2 - bbY1 || 1;
    const scale = Math.min(MINIMAP_W / bw, MINIMAP_H / bh);

    const offsetX = (MINIMAP_W - bw * scale) / 2;
    const offsetY = (MINIMAP_H - bh * scale) / 2;

    // Node dots in minimap space
    const dots = nodes.map(n => ({
      id: n.id,
      cx: (n.x - bbX1) * scale + offsetX,
      cy: (n.y - bbY1) * scale + offsetY,
      color: dotColors[n.state] ?? '#94A3B8',
    }));

    // Viewport rectangle: invert transform to get visible area in graph space
    const invTL = transform.invert([0, 0]);
    const invBR = transform.invert([canvasWidth, canvasHeight]);
    const vx = (invTL[0] - bbX1) * scale + offsetX;
    const vy = (invTL[1] - bbY1) * scale + offsetY;
    const vw = (invBR[0] - invTL[0]) * scale;
    const vh = (invBR[1] - invTL[1]) * scale;

    return { dots, vx, vy, vw, vh, bbX1, bbY1, scale, offsetX, offsetY };
  }, [nodes, transform, canvasWidth, canvasHeight, dotColors]);

  const clampedX = Math.max(0, Math.min(vx, MINIMAP_W));
  const clampedY = Math.max(0, Math.min(vy, MINIMAP_H));
  const clampedW = Math.max(0, Math.min(vw, MINIMAP_W - clampedX));
  const clampedH = Math.max(0, Math.min(vh, MINIMAP_H - clampedY));

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onViewJump) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Convert minimap-space (mx, my) back to graph-space
    const gx = (mx - offsetX) / scale + bbX1;
    const gy = (my - offsetY) / scale + bbY1;

    onViewJump(gx, gy);
  };

  return (
    <div
      className="absolute bottom-3 left-3 rounded border border-[var(--border)] overflow-hidden cursor-crosshair group"
      onClick={handleMinimapClick}
      style={{
        width: MINIMAP_W,
        height: MINIMAP_H,
        background: 'var(--surface)',
        backdropFilter: 'blur(8px)',
        opacity: 0.9,
      }}
    >
      <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--accent-soft)]/5 transition-colors pointer-events-none" />
      <svg width={MINIMAP_W} height={MINIMAP_H} className="pointer-events-none">
        {dots.map(d => (
          <circle
            key={d.id}
            cx={d.cx}
            cy={d.cy}
            r={2.5}
            fill={d.color}
          />
        ))}
        <rect
          x={clampedX}
          y={clampedY}
          width={clampedW}
          height={clampedH}
          fill="none"
          stroke="#58A6FF"
          strokeWidth={1.5}
          rx={1}
        />
      </svg>
    </div>
  );
}
