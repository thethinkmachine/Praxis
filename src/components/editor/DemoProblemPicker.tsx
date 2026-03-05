import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import type { AlgorithmCategory } from '@/types';

interface DemoProblem {
  id: string;
  name: string;
  description: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSteps: number;
  tags?: string[];
}

const DEMO_PROBLEMS: Record<AlgorithmCategory, DemoProblem[]> = {
  'uninformed-search': [
    {
      id: 'simple-graph',
      name: 'Simple State Graph',
      description: 'A small 8-node graph designed to show the difference between BFS level-order and DFS depth-first traversal. Optimal for step-through learning.',
      difficulty: 'easy',
      estimatedSteps: 15,
      hint: 'Watch how BFS explores level by level while DFS dives deep first.',
      tags: ['BFS', 'DFS', 'comparison'],
    },
    {
      id: 'romania-map',
      name: 'Romania Road Map',
      description: 'The classic AIMA textbook graph — 20 Romanian cities connected by roads. The definitive benchmark for uninformed search algorithms.',
      difficulty: 'medium',
      estimatedSteps: 45,
      hint: 'Find a path from Arad to Bucharest. BFS finds the shallowest path.',
      tags: ['classic', 'AIMA', 'roads'],
    },
    {
      id: 'weighted-grid',
      name: 'Weighted Terrain Grid',
      description: 'A weighted grid where traversal costs vary by region. Useful for observing UCS behavior against uniform-cost assumptions.',
      difficulty: 'hard',
      estimatedSteps: 95,
      hint: 'Watch UCS prioritize lower cumulative path cost over shortest hop count.',
      tags: ['grid', 'weighted', 'ucs'],
    },
  ],
  'informed-search': [
    {
      id: 'romania-map',
      name: 'Romania Road Map',
      description: 'The classic AIMA benchmark — 20 cities with straight-line-distance heuristics to Bucharest. Ideal for comparing A* against Greedy Best-First.',
      difficulty: 'medium',
      estimatedSteps: 30,
      hint: 'A* finds the optimal path. Greedy BFS is faster but may not be optimal.',
      tags: ['classic', 'AIMA', 'heuristic', 'A*'],
    },
    {
      id: 'weighted-grid',
      name: 'Weighted Terrain Grid',
      description: 'A weighted grid with Manhattan-distance heuristics. Observe how the heuristic guides A* to the goal much more efficiently than UCS.',
      difficulty: 'medium',
      estimatedSteps: 55,
      hint: 'Compare nodes expanded by A* vs UCS — the heuristic prunes a large portion of the search.',
      tags: ['grid', 'weighted', 'heuristic'],
    },
    {
      id: 'simple-graph',
      name: 'Simple State Graph',
      description: 'A small 8-node graph. Use it to see clearly how Greedy BFS chases the goal greedily while A* balances cost and estimate.',
      difficulty: 'easy',
      estimatedSteps: 12,
      hint: 'Watch f = g + h annotations update at each step.',
      tags: ['comparison', 'f-cost'],
    },
  ],
  'game-playing': [],
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
  onSelect: (problemId: string) => void;
  trigger?: React.ReactNode;
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
}: DemoProblemPickerProps) {
  const allProblems = DEMO_PROBLEMS[algorithmCategory] ?? [];
  const [filter, setFilter] = useState<DifficultyFilter>('all');

  const problems = filter === 'all'
    ? allProblems
    : allProblems.filter(p => p.difficulty === filter);

  const filterButtons: { label: string; value: DifficultyFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  return (
    <Dialog.Root onOpenChange={(open) => { if (!open) setFilter('all'); }}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded',
              'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]',
              'hover:text-[var(--text)] hover:border-[#58A6FF] hover:bg-[#58A6FF]/5',
              'transition-colors font-medium',
            )}
          >
            <DatabaseIcon />
            Load Demo
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl',
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
                'flex items-center justify-center w-6 h-6 rounded',
                'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                'transition-colors text-base leading-none',
              )}
            >
              ×
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
                  : allProblems.filter(p => p.difficulty === value).length;
                const isActive = filter === value;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    disabled={count === 0}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full font-medium border transition-colors',
                      'disabled:opacity-30 disabled:cursor-not-allowed',
                      isActive
                        ? value === 'all'
                          ? 'bg-[#58A6FF]/15 text-[#58A6FF] border-[#58A6FF]/40'
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
            {problems.length > 0 ? (
              problems.map((p) => (
                <Dialog.Close key={`${p.id}-${p.difficulty}`} asChild>
                  <button
                    onClick={() => onSelect(p.id)}
                    className={cn(
                      'w-full text-left rounded-lg p-3.5 border border-[var(--border)]',
                      'bg-[var(--surface-2)]/60',
                      'hover:border-[#58A6FF] hover:bg-[#58A6FF]/5',
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
                        {p.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]',
                              'group-hover:border-[#58A6FF]/30 transition-colors',
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
                </Dialog.Close>
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
