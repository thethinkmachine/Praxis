// Hand-drawn icons for each algorithm category — generic Lucide glyphs (compass,
// target, swords, ...) read as ambiguous decoration here, so each of these encodes
// a specific idea from the category instead of a generic mood.
interface CategoryIconProps {
  size?: number;
  className?: string;
}

const svgProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true as const,
});

/** Symmetric 3-way branching, no path favored — BFS/DFS/UCS explore blindly. */
export function UninformedSearchIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 7 L5 17" />
      <path d="M12 7 L12 17" />
      <path d="M12 7 L19 17" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
    </svg>
  );
}

/** An arrow flying straight at a target — heuristic-guided, goal-directed search. */
export function InformedSearchIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 19 L14 10" />
      <path d="M9 10 H14 V15" />
      <circle cx="19" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="4" />
    </svg>
  );
}

/** Two triangles meeting tip to tip — MAX vs MIN, the two opposing sides of a game tree. */
export function GamePlayingIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 6 L4 18 L12 12 Z" />
      <path d="M20 6 L20 18 L12 12 Z" />
    </svg>
  );
}

/** A grounded twin-peak silhouette with the marker on the shorter peak — stuck at a local optimum. */
export function LocalSearchIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M2 19 L7 8 L11 14 L17 4 L22 19 Z" />
      <circle cx="7" cy="8" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Ascending steps to a planted flag — ordered actions building toward a goal. */
export function PlanningIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M2 20 H22" />
      <rect x="3" y="15" width="4" height="5" />
      <rect x="10" y="10" width="4" height="10" />
      <rect x="17" y="6" width="4" height="14" />
      <path d="M18 6 L18 1" />
      <path d="M18 1 L18 5 L22 3 Z" />
    </svg>
  );
}

/** A constrained grid with non-conflicting placements — Sudoku/N-Queens/graph-coloring style puzzles. */
export function ConstraintSatisfactionIcon({ size = 24, className }: CategoryIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9 L21 9" />
      <path d="M3 15 L21 15" />
      <path d="M9 3 L9 21" />
      <path d="M15 3 L15 21" />
      <circle cx="6" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
