import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { X } from '@/components/shared/Icons';
import type { AlgorithmCategory } from '@/types';
import type { DemoManifest, DemoProblemDefinition } from '@/lib/demo-manifest';
import { isDemoManifest } from '@/lib/demo-manifest';
import { toAppPath } from '@/lib/app-paths';

export const FALLBACK_DEMO_PROBLEMS: Record<AlgorithmCategory, DemoProblemDefinition[]> = {
  'uninformed-search': [
    {
      id: 'romania-map.json',
      name: 'Romania Road Map',
      description: 'The classic AIMA textbook graph with city-to-city routes. Ideal for stepping through frontier growth and path reconstruction.',
      difficulty: 'easy',
      estimatedSteps: 45,
      hint: 'Find a route from Arad to Bucharest and compare how BFS and DFS diverge.',
      tags: ['classic', 'AIMA', 'roads'],
    },
    {
      id: 'india-osm-map.json',
      name: 'India OSM Mesh',
      description: 'A high-fidelity OpenStreetMap city mesh that shows how uninformed search scales on denser real-world topology.',
      difficulty: 'medium',
      estimatedSteps: 200,
      hint: 'Watch queue-based algorithms broaden rapidly across the denser city mesh.',
      tags: ['real-world', 'india', 'routing'],
    },
    {
      id: 'usa-osm-map.json',
      name: 'USA OSM Mesh',
      description: 'A large coast-to-coast routing benchmark with realistic long-haul connectivity.',
      difficulty: 'hard',
      estimatedSteps: 250,
      hint: 'This is a good stress test for UCS-style expansion and frontier management.',
      tags: ['real-world', 'usa', 'routing'],
    },
    {
      id: 'russia-osm-map.json',
      name: 'Russia OSM Mesh',
      description: 'A sparse but expansive graph that emphasizes long-distance path choices.',
      difficulty: 'medium',
      estimatedSteps: 125,
      hint: 'The wide spacing makes path shape easy to read during playback.',
      tags: ['real-world', 'russia', 'routing'],
    },
    {
      id: 'africa-osm-map.json',
      name: 'Africa OSM Mesh',
      description: 'A continental-scale demo with broad geographic spread and a larger exploration surface.',
      difficulty: 'hard',
      estimatedSteps: 250,
      hint: 'This demo makes expansion breadth and dead-end avoidance very visible.',
      tags: ['real-world', 'africa', 'routing'],
    },
    {
      id: 'australia-osm-map.json',
      name: 'Australia OSM Mesh',
      description: 'Coastal connections bounding the Australian continent.',
      difficulty: 'medium',
      estimatedSteps: 150,
      hint: 'Watch algorithms navigate around the continental edge.',
      tags: ['real-world', 'australia', 'routing'],
    },
  ],
  'informed-search': [
    {
      id: 'romania-map.json',
      name: 'Romania Road Map',
      description: 'The classic AIMA benchmark — 20 cities with straight-line-distance heuristics to Bucharest. Ideal for comparing A* against Greedy Best-First.',
      difficulty: 'medium',
      estimatedSteps: 30,
      hint: 'A* finds the optimal path. Greedy BFS is faster but may not be optimal.',
      tags: ['classic', 'AIMA', 'heuristic', 'A*'],
    },
    {
      id: 'india-osm-map.json',
      name: 'India OSM Mesh',
      description: 'A realistic map of Indian cities with spatial structure that makes heuristic guidance visibly useful.',
      difficulty: 'medium',
      estimatedSteps: 200,
      hint: 'Heuristics guide the search rapidly towards the southern goal.',
      tags: ['real-world', 'india', 'heuristic'],
    },
    {
      id: 'usa-osm-map.json',
      name: 'USA OSM Mesh',
      description: 'A large routing benchmark where heuristic quality has an outsized effect on explored nodes.',
      difficulty: 'hard',
      estimatedSteps: 250,
      hint: 'Watch A* carve an optimal path directly across the country.',
      tags: ['real-world', 'usa', 'heuristic'],
    },
    {
      id: 'africa-osm-map.json',
      name: 'Africa OSM Mesh',
      description: 'Continental pathfinding from Casablanca to Cape Town, heavily utilizing distance heuristics.',
      difficulty: 'hard',
      estimatedSteps: 250,
      hint: 'The sheer scale of coordinates makes heuristic evaluation extremely powerful here.',
      tags: ['real-world', 'africa', 'heuristic'],
    },
    {
      id: 'germany-osm-map.json',
      name: 'Germany OSM Mesh',
      description: 'A compact dense graph that is useful for comparing best-first expansion strategies.',
      difficulty: 'medium',
      estimatedSteps: 125,
      hint: 'Compare nodes expanded by A* vs UCS — the heuristic prunes a large portion of the search.',
      tags: ['real-world', 'germany', 'heuristic'],
    },
    {
      id: 'france-osm-map.json',
      name: 'France OSM Mesh',
      description: 'A medium-sized informed-search benchmark with enough branching to make heuristic guidance easy to inspect.',
      difficulty: 'medium',
      estimatedSteps: 125,
      hint: 'This is a good comparison case for A*, Greedy BFS, and RBFS.',
      tags: ['real-world', 'france', 'heuristic'],
    },
  ],
  'game-playing': [],
  'local-search': [],
  'planning': [],
  'constraint-satisfaction': [],
};

const DIFFICULTY_COLORS = {
  easy:   'text-[#3FB950] bg-[#3FB950]/10 border-[#3FB950]/30',
  medium: 'text-[#F0883E] bg-[#F0883E]/10 border-[#F0883E]/30',
  hard:   'text-[#FF7B72] bg-[#FF7B72]/10 border-[#FF7B72]/30',
};

function formatSteps(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k steps`;
  return `~${n} steps`;
}

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

interface DemoProblemPickerProps {
  algorithmCategory: AlgorithmCategory;
  onSelect: (problemDef: unknown) => void;
  trigger?: React.ReactNode;
  /** Controlled open state — when provided, the built-in trigger is not rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Inline database/bookmark SVG icon for the trigger button. */
function DatabaseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="8" cy="3.5" rx="6" ry="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 3.5v4c0 1.105 2.686 2 6 2s6-.895 6-2v-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M2 7.5v4c0 1.105 2.686 2 6 2s6-.895 6-2v-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DemoProblemPicker({
  algorithmCategory,
  onSelect,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DemoProblemPickerProps) {
  const [manifestData, setManifestData] = useState<DemoManifest | null>(null);
  const [filter, setFilter] = useState<DifficultyFilter>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        const response = await fetch(toAppPath('problems/graphs/_manifest.json'));
        if (!response.ok) {
          throw new Error(`Manifest request failed with ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled && isDemoManifest(data)) {
          setManifestData(data);
        }
      } catch {
        if (!cancelled) {
          setManifestData(null);
        }
      }
    }

    loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  const allProblems: DemoProblemDefinition[] = manifestData?.[algorithmCategory] ?? FALLBACK_DEMO_PROBLEMS[algorithmCategory] ?? [];


  const problems = filter === 'all'
    ? allProblems
    : allProblems.filter((p: DemoProblemDefinition) => p.difficulty === filter);

  const filterButtons: { label: string; value: DifficultyFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  const handleSelect = async (filename: string) => {
    try {
      setErrorMsg(null);
      const resp = await fetch(toAppPath(`problems/graphs/${filename}`));
      if (!resp.ok) throw new Error('File not found');
      const data = await resp.json();
      onSelect(data.problem);
      if (isControlled) {
        controlledOnOpenChange?.(false);
      } else {
        setInternalOpen(false);
      }
      setFilter('all');
    } catch {
      setErrorMsg(`Could not load demo "${filename}".`);
    }
  };

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog.Root
      open={isControlled ? controlledOpen : internalOpen}
      onOpenChange={(o) => {
        if (!isControlled) {
          setInternalOpen(o);
        }
        if (!o) {
          setFilter('all');
          setErrorMsg(null);
        }
        controlledOnOpenChange?.(o);
      }}
    >
      {!isControlled && (
        <Dialog.Trigger asChild>
          {trigger ?? (
            <button
              className={cn(
                'ui-btn h-7 rounded-lg px-2.5 text-[11px] font-medium',
              )}
            >
              <DatabaseIcon />
              Load Demo
            </button>
          )}
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay fixed inset-0 z-40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'ui-panel-elevated w-full max-w-lg rounded-xl',
            'focus:outline-none overflow-hidden',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <Dialog.Title className="text-sm font-semibold text-[var(--text)]">
                Choose a Demo Problem
              </Dialog.Title>
              <p className="text-xs text-[var(--text-2)] mt-0.5">
                {allProblems.length} problem{allProblems.length !== 1 ? 's' : ''} available
              </p>
            </div>
            <Dialog.Close
              className={cn(
                'ui-btn ui-btn-ghost ui-btn-icon h-6 w-6 rounded',
              )}
            >
              <X size={14} />
            </Dialog.Close>
          </div>

          {/* Difficulty filter */}
          {allProblems.length > 0 && (
            <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/30">
              <span className="text-[10px] text-[var(--text-3)] font-medium uppercase tracking-wider mr-1">
                Difficulty
              </span>
              {filterButtons.map(({ label, value }) => {
                const count = value === 'all'
                  ? allProblems.length
                  : allProblems.filter((p: DemoProblemDefinition) => p.difficulty === value).length;
                const isActive = filter === value;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    disabled={count === 0}
                    className={cn(
                      'ui-pill text-[11px] px-2.5 py-1 font-medium border transition-colors',
                      'disabled:opacity-30 disabled:cursor-not-allowed',
                      isActive
                        ? value === 'all'
                          ? 'ui-pill-accent'
                          : DIFFICULTY_COLORS[value as 'easy' | 'medium' | 'hard']
                        : 'bg-transparent text-[var(--text-2)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-3)]',
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span className="ml-1 opacity-60">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Problem list */}
          <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
            {errorMsg && (
              <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                {errorMsg}
              </div>
            )}
            {problems.length > 0 ? (
              problems.map((p: DemoProblemDefinition) => (
                <button
                  key={`${p.id}-${p.difficulty}`}
                  onClick={() => handleSelect(p.id)}
                  className={cn(
                    'ui-panel-muted w-full text-left rounded-lg p-3.5',
                    'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/30',
                    'active:scale-[0.995]',
                    'transition-all duration-150 group cursor-pointer',
                  )}
                >
                  {/* Top row: name + difficulty badge + step count */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-[var(--text)] group-hover:text-white transition-colors flex-1 min-w-0 truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-3)] font-mono shrink-0">
                      {formatSteps(p.estimatedSteps)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border shrink-0',
                        DIFFICULTY_COLORS[p.difficulty],
                      )}
                    >
                      {p.difficulty}
                    </span>
                  </div>

                  {/* Description — clamped to 2 lines */}
                  <p
                    className="text-xs text-[var(--text-2)] mb-2 leading-relaxed"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {p.description}
                  </p>

                  {/* Tags */}
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]',
                            'group-hover:border-[var(--accent)]/30 transition-colors',
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hint */}
                  <p className="text-[11px] text-[var(--text-3)] leading-snug">
                    <span className="not-italic font-medium text-[var(--accent)] opacity-80">Hint:</span>{' '}
                    <span className="italic">{p.hint}</span>
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-[var(--text-3)] text-center py-10">
                No problems at this difficulty level.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
