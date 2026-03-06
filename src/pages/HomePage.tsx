import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { registry } from '@/algorithms/core/registry';
import TaxonomyCardGrid from '@/components/taxonomy/TaxonomyCardGrid';
import RelationshipGraph from '@/components/taxonomy/RelationshipGraph';
import AlgorithmSearch from '@/components/taxonomy/AlgorithmSearch';
import { X } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { AlgorithmCategory } from '@/types/algorithm';
import { getLabsForCategory } from '@/lib/game-labs';

export default function HomePage() {
  const metas = registry.getAllMeta();
  const [activeTab, setActiveTab] = useState('algorithms');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'algorithms') {
        next.delete('tab');
      } else {
        next.set('tab', value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const scrollToCategory = useCallback((category: AlgorithmCategory) => {
    handleTabChange('algorithms');
    setTimeout(() => {
      const el = document.getElementById(`category-${category}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }, [handleTabChange]);

  // Handle scroll param from sidebar navigation
  useEffect(() => {
    const scrollTarget = searchParams.get('scroll');
    const tab = searchParams.get('tab') || 'algorithms';

    if (tab === 'algorithms' || tab === 'games' || tab === 'graph') {
      setActiveTab(tab);
    }

    if (scrollTarget) {
      const cat = scrollTarget.replace('category-', '') as AlgorithmCategory;
      if (CATEGORY_ORDER.includes(cat)) {
        scrollToCategory(cat);
      }
    }

    if (scrollTarget) {
      const next = new URLSearchParams(searchParams);
      next.delete('scroll');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, scrollToCategory]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!graphFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGraphFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [graphFullscreen]);

  const isGraphTab = activeTab === 'graph';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Hero Section — hidden when graph tab is active */}
      <div
        className={cn(
          'relative mx-3 mt-3 rounded-xl border border-[var(--border)] transition-all duration-300 ease-in-out ide-surface',
          isGraphTab ? 'max-h-0 opacity-0 border-b-0' : 'max-h-[400px] opacity-100',
        )}
      >
        {/* Backdrop - RelationshipGraph at very low opacity */}
        <div className="absolute inset-0 opacity-[0.08] blur-[1px] pointer-events-none">
          <RelationshipGraph algorithms={metas} isBackground={true} />
        </div>

        {/* Overlay Content */}
        <div className="relative z-10 px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-4 bg-gradient-to-b from-[var(--surface)]/80 to-[var(--surface-2)]/60">
          <span className="font-bold text-4xl sm:text-5xl tracking-tight text-[var(--text)] font-mono">
            Praxis
          </span>
          <p className="text-xs sm:text-sm text-[var(--text-2)] uppercase tracking-[0.2em]">
            Algorithm Workspace Console
          </p>

          <div className="text-[11px] font-mono px-3 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)]">
            {`>`} index algorithms --interactive --trace
          </div>

          {/* Search */}
            <AlgorithmSearch />

          {/* Stats & CTA */}
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] font-mono">
              {metas.length} algorithms
            </span>
            <Link
              to="/maze/bfs"
              className="text-xs px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]/60 font-mono transition-colors"
            >
              Open Maze Lab
            </Link>
          </div>

          {/* Category Quick-Nav Chips */}
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className="text-xs px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--accent)]/60 hover:text-[var(--text)] transition-colors font-mono"
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div className="relative z-20 px-3 sm:px-6 border-b border-[var(--border)] shrink-0 bg-[var(--titlebar)]/92 backdrop-blur-xl">
          <TabsList className="flex gap-1 h-10 items-center">
            <TabsTrigger
              value="algorithms"
              className="px-3 py-1.5 text-sm font-mono text-[var(--text-2)] data-[state=active]:text-[var(--text)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent)] transition-colors"
            >
              Algorithms
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="px-3 py-1.5 text-sm font-mono text-[var(--text-2)] data-[state=active]:text-[var(--text)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent)] transition-colors"
            >
              Games
            </TabsTrigger>
            <TabsTrigger
              value="graph"
              className="px-3 py-1.5 text-sm font-mono text-[var(--text-2)] data-[state=active]:text-[var(--text)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent)] transition-colors"
            >
              Relationship Graph
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="algorithms" className="relative z-10 flex-1 overflow-y-auto">
          <TaxonomyCardGrid algorithms={metas} />
        </TabsContent>

        <TabsContent value="games" className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Game Labs</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Playground Modules by Category</h2>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                Every algorithm family can have its own game lab. Live labs open directly; planned labs are listed as coming soon.
              </p>
            </div>

            {CATEGORY_ORDER.map((category) => {
              const labs = getLabsForCategory(category);
              return (
                <section key={category} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{CATEGORY_LABELS[category]}</h3>
                    <span className="text-[10px] font-mono text-[var(--text-3)] uppercase tracking-wider">
                      {labs.length > 0 ? `${labs.length} lab${labs.length > 1 ? 's' : ''}` : 'No labs yet'}
                    </span>
                  </div>

                  {labs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-4">
                      <p className="text-sm text-[var(--text-2)]">Coming soon: category-specific games for this algorithm family.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {labs.map((lab) => (
                        lab.path ? (
                          <Link
                            key={lab.id}
                            to={lab.path}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--text)]">{lab.name}</p>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#53c880]/35 bg-[#53c880]/15 text-[#53c880]">
                                LIVE
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-2)]">{lab.description}</p>
                          </Link>
                        ) : (
                          <div
                            key={lab.id}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--text)]">{lab.name}</p>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)]">
                                {lab.status === 'coming-soon' ? 'COMING SOON' : 'LAB'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-2)]">{lab.description}</p>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="graph" className="relative z-10 flex-1 overflow-hidden">
          <RelationshipGraph algorithms={metas} onFullscreen={() => setGraphFullscreen(true)} />
        </TabsContent>
      </Tabs>

      {/* Fullscreen graph overlay */}
      {graphFullscreen && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)]">
          <RelationshipGraph algorithms={metas} onFullscreen={() => setGraphFullscreen(false)} isFullscreen={true} />
        </div>
      )}
    </div>
  );
}
