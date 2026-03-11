import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent } from '@radix-ui/react-tabs';
import { registry } from '@/algorithms/core/registry';
import TaxonomyCardGrid from '@/components/taxonomy/TaxonomyCardGrid';
import RelationshipGraph from '@/components/taxonomy/RelationshipGraph';
import AlgorithmSearch from '@/components/taxonomy/AlgorithmSearch';
import HomeTitleStrip from '@/components/shared/HomeTitleStrip';
import HeaderTabs from '@/components/shared/HeaderTabs';
import SurfaceCard from '@/components/shared/SurfaceCard';
import NavigationTile from '@/components/shared/NavigationTile';
import CellularAutomatonBackdrop from '@/components/visualization/CellularAutomatonBackdrop';
import { Search, Gamepad2, Network } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { AlgorithmCategory } from '@/types/algorithm';
import { getLabsForCategory, GAME_LABS } from '@/lib/game-labs';

const HOME_TABS = [
  { id: 'algorithms', label: 'Algorithms', icon: Search, hint: 'Browse registered algorithms' },
  { id: 'games', label: 'Game Labs', icon: Gamepad2, hint: 'Open game-driven modules' },
  { id: 'graph', label: 'Relationship Graph', icon: Network, hint: 'Explore algorithm families visually' },
] as const;

export default function HomePage() {
  const metas = registry.getAllMeta();
  const [activeTab, setActiveTab] = useState('algorithms');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const liveGamesCount = useMemo(() => {
    return Object.values(GAME_LABS)
      .flat()
      .filter(lab => lab.status === 'live').length;
  }, []);

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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <HomeTitleStrip
          algorithmCount={metas.length}
          liveGamesCount={liveGamesCount}
        />

        {/* Hero Section — hidden when graph tab is active */}
        <div
          className={cn(
            'relative mx-3 mt-3 rounded-xl border border-[var(--border)] transition-all duration-300 ease-in-out ide-surface',
            isGraphTab ? 'max-h-0 opacity-0 border-b-0' : 'max-h-[400px] opacity-100',
          )}
        >
          {/* Backdrop - Cellular Automaton */}
          <div className="absolute inset-0 opacity-[0.4] blur-[0.5px] pointer-events-none overflow-hidden rounded-xl">
            <CellularAutomatonBackdrop intervalMs={50} changeRuleIntervalMs={10000} cellSize={10} />
          </div>

          {/* Overlay Content */}
          <div className="relative z-10 px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-4 bg-gradient-to-b from-[var(--surface)]/70 to-[var(--surface-2)]/40 backdrop-blur-[2px] rounded-xl">
            <span className="font-bold text-4xl sm:text-5xl tracking-tight text-[var(--text)] font-mono">
              Praxis
            </span>
            <p className="text-xs sm:text-sm text-[var(--text-2)] uppercase tracking-[0.2em]">
              Symbolic AI Algorithm Library & Playground
            </p>

            <AlgorithmSearch />

            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] font-mono">
                {metas.length} algorithms
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] font-mono">
                {liveGamesCount} live games
              </span>
            </div>

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

        {/* Tab strip — sits directly below the hero card */}
        <div className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
          <div className="flex min-h-10 items-center justify-between gap-3 px-3">
            <HeaderTabs
              tabs={HOME_TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                icon: <tab.icon size={12} />,
              }))}
              activeTab={activeTab}
              mode="tabs"
            />
            <p className="hidden truncate text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)] lg:block">
              {HOME_TABS.find((t) => t.id === activeTab)?.hint}
            </p>
          </div>
        </div>

        <TabsContent value="algorithms" className="relative z-10 flex-1 overflow-y-auto">
          <TaxonomyCardGrid algorithms={metas} />
        </TabsContent>

        <TabsContent value="games" className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <SurfaceCard>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Game Labs</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Playground Modules by Category</h2>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                Every algorithm family can have its own game lab. Live labs open directly; planned labs are listed as coming soon.
              </p>
            </SurfaceCard>

            {CATEGORY_ORDER.map((category) => {
              const labs = getLabsForCategory(category);
              return (
                <SurfaceCard key={category} tone="muted" className="rounded-xl">
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
                          <NavigationTile
                            key={lab.id}
                            to={lab.path}
                            title={lab.name}
                            description={lab.description}
                            badge="Live"
                            badgeTone="success"
                          />
                        ) : (
                          <SurfaceCard key={lab.id} tone="muted" padding="sm" className="rounded-lg">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--text)]">{lab.name}</p>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)]">
                                {lab.status === 'coming-soon' ? 'COMING SOON' : 'LAB'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-2)]">{lab.description}</p>
                          </SurfaceCard>
                        )
                      ))}
                    </div>
                  )}
                </SurfaceCard>
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
