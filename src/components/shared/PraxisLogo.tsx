import { useState } from 'react';

interface PraxisLogoProps {
  /** Rendered height in px. Width scales proportionally (≈ 3.5× height). */
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * PraxisLogo — SVG wordmark for "Praxis"
 *
 * Design:
 *  • "Pr" + "xis" in Inter 700, blue→purple gradient
 *  • "ai" in Inter 700 italic — subtly highlights the AI concept
 *  • Tiny algorithmic graph ornament (3 nodes, 3 edges) top-right
 *  • Thin accent line beneath "ai" at 60% opacity
 *  • Hover: glow filter, ornament brightens, scan-line draws in
 */
export default function PraxisLogo({ size = 32, animated = true, className = '' }: PraxisLogoProps) {
  const [hovered, setHovered] = useState(false);

  // viewBox: 140 wide × 40 tall  →  aspect ≈ 3.5×1
  const W = 140;
  const H = 40;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size * 3.5}
      height={size}
      className={className}
      style={{
        overflow: 'visible',
        transition: animated ? 'filter 300ms ease' : 'none',
        filter: animated && hovered
          ? 'drop-shadow(0 0 8px rgba(88,166,255,0.45))'
          : 'none',
      }}
      onMouseEnter={() => animated && setHovered(true)}
      onMouseLeave={() => animated && setHovered(false)}
      aria-label="Praxis"
    >
      <defs>
        {/* Continuous gradient across the full word — userSpaceOnUse so it
            flows identically across all tspan children */}
        <linearGradient id="plg" x1="4" y1="0" x2="108" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#58A6FF" />
          <stop offset="100%" stopColor="#D2A8FF" />
        </linearGradient>

        {/* Slightly brighter variant for the "ai" accent bar */}
        <linearGradient id="plg-ai" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#79C0FF" />
          <stop offset="100%" stopColor="#C8A8FF" />
        </linearGradient>
      </defs>

      {/* ── Wordmark ─────────────────────────────────────────── */}
      <text
        x="4"
        y="29"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-0.04em"
        fill="url(#plg)"
      >
        {/* "Pr" — upright */}
        <tspan>Pr</tspan>
        {/* "ai" — italic to hint at AI while keeping gradient continuous */}
        <tspan fontStyle="italic" opacity="0.95">ai</tspan>
        {/* "xis" — upright */}
        <tspan>xis</tspan>
      </text>

      {/* ── Accent bar beneath "ai" (approximate character extent) ── */}
      {/* Inter 700/26px: "Pr" ≈ 28px wide → "ai" starts ~31px, spans ~19px */}
      <rect
        x="31"
        y="32.5"
        width="18"
        height="1.4"
        rx="0.7"
        fill="url(#plg-ai)"
        opacity={hovered ? 0.9 : 0.55}
        style={{ transition: 'opacity 300ms ease' }}
      />

      {/* ── Algorithmic graph ornament (top-right) ───────────── */}
      {/* Three nodes forming a small triangle, representing a graph */}
      <g
        opacity={hovered ? 0.65 : 0.22}
        style={{ transition: 'opacity 300ms ease' }}
      >
        {/* Edges first (beneath nodes) */}
        <line x1="120" y1="8"  x2="130" y2="18" stroke="url(#plg)" strokeWidth="0.9" />
        <line x1="130" y1="18" x2="121" y2="24" stroke="url(#plg)" strokeWidth="0.9" />
        <line x1="120" y1="8"  x2="121" y2="24" stroke="url(#plg)" strokeWidth="0.9" strokeDasharray="2 1.5" />

        {/* Nodes */}
        <circle cx="120" cy="8"  r="2.2" fill="url(#plg)" />
        <circle cx="130" cy="18" r="1.8" fill="url(#plg)" />
        <circle cx="121" cy="24" r="1.8" fill="url(#plg)" />
      </g>

      {/* ── Hover scan-line that draws in beneath the full word ── */}
      {animated && hovered && (
        <line
          x1="4"
          y1="36"
          x2="112"
          y2="36"
          stroke="url(#plg)"
          strokeWidth="1.5"
          opacity="0.35"
          strokeLinecap="round"
          style={{ animation: 'plg-scan 450ms cubic-bezier(0.22,1,0.36,1) forwards' }}
        />
      )}

      <style>{`
        @keyframes plg-scan {
          from { stroke-dasharray: 108; stroke-dashoffset: 108; }
          to   { stroke-dasharray: 108; stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}
