import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Search, Gamepad2, Network, Play, Pause, Maximize2, Minimize2 } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { AlgorithmCategory } from '@/types/algorithm';
import { DISCOVERY_ITEMS_BY_CATEGORY, getDiscoveryItemsForCategory } from '@/lib/discovery-items';

const HOME_TABS = [
  { id: 'algorithms', label: 'Algorithms', icon: Search, hint: 'Browse registered algorithms' },
  { id: 'games', label: 'Playgrounds', icon: Gamepad2, hint: 'Open games, sandboxes, and labs' },
  { id: 'graph', label: 'Relationship Graph', icon: Network, hint: 'Explore algorithm families visually' },
] as const;

export default function HomePage() {
  const metas = registry.getAllMeta();
  const [activeTab, setActiveTab] = useState('algorithms');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const liveModuleCount = useMemo(() => {
    return Object.values(DISCOVERY_ITEMS_BY_CATEGORY)
      .flat()
      .filter((item) => item.status === 'live').length;
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
    setIsHeroCollapsed(true);
    setIsHeroExpanded(false);
    
    setTimeout(() => {
      const container = document.getElementById('home-main-scroll');
      const el = document.getElementById(`category-${category}`);
      const header = document.getElementById('home-sticky-header');
      
      if (el && container) {
        const offset = header?.offsetHeight || 60;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop + (rect.top - containerRect.top) - offset - 10;
        
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }, 120);
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
  const [animPaused, setAnimPaused] = useState(false);
  const [isHeroExpanded, setIsHeroExpanded] = useState(true);
  const [isHeroCollapsed, setIsHeroCollapsed] = useState(false);
  const [caRule, setCaRule] = useState<{ mode: '1D' | '2D'; name: string; details?: string } | null>(null);

  const lastScrollY = useRef(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    
    // Collapse if scrolling down past a threshold
    if (currentScrollY > 60 && currentScrollY > lastScrollY.current && !isHeroCollapsed) {
      setIsHeroCollapsed(true);
      setIsHeroExpanded(false); // Reset manual expansion when scrolling away
    } 
    // Expand if scrolling up significantly or reaching the top
    else if (isHeroCollapsed) {
      if (currentScrollY < 30 || currentScrollY < lastScrollY.current - 40) {
        setIsHeroCollapsed(false);
      }
    }
    
    lastScrollY.current = currentScrollY;
  }, [isHeroCollapsed]);

  // Reset scroll state when changing tabs
  useEffect(() => {
    const scrollContainer = document.getElementById('home-main-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
    setIsHeroCollapsed(false);
    lastScrollY.current = 0;
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <HomeTitleStrip
          algorithmCount={metas.length}
          liveModuleCount={liveModuleCount}
        />

        <div 
          id="home-main-scroll"
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          onScroll={handleScroll}
        >
          {/* Hero Section */}
          <div
            className={cn(
              'relative mx-3 mt-3 rounded-xl border border-[var(--border)] transition-all duration-700 ease-in-out ide-surface overflow-hidden',
              isGraphTab ? 'h-0 opacity-0 border-0 pointer-events-none m-0' : isHeroExpanded ? 'h-[85vh] opacity-100' : 'h-[360px] opacity-100',
              isHeroCollapsed && 'opacity-0 h-0 border-0 m-0 pointer-events-none'
            )}
          >
            {/* Backdrop - Cellular Automaton */}
            <div className="absolute inset-0 opacity-[0.4] blur-[0.5px] pointer-events-none overflow-hidden rounded-xl">
              <CellularAutomatonBackdrop 
                intervalMs={50} 
                changeRuleIntervalMs={10000} 
                cellSize={10} 
                paused={animPaused} 
                onRuleChange={setCaRule}
              />
            </div>

            {/* CA Rule Info Card */}
            {caRule && (
              <div 
                className={cn(
                  "absolute top-3 left-3 z-30 flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-[var(--surface-2)]/20 backdrop-blur-md pointer-events-none select-none transition-all duration-700",
                  animPaused ? "opacity-40" : "opacity-100"
                )}
              >
                 <span className="text-[8px] uppercase tracking-[0.1em] text-[var(--text-3)] font-bold">Update Rule</span>
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-mono text-[var(--text-2)] font-bold">{caRule.name}</span>
                   {caRule.details && (
                     <span className="text-[9px] text-[var(--text-3)] font-mono opacity-80 border-l border-[var(--border)]/30 pl-2">
                       {caRule.details}
                     </span>
                   )}
                   <div className={cn(
                     "w-1 h-1 rounded-full",
                     animPaused ? "bg-[var(--text-3)]" : "bg-emerald-500 animate-pulse"
                   )} />
                 </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 ">
              <button
                onClick={() => setIsHeroExpanded((e) => !e)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-3)] opacity-40 transition-opacity hover:opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                aria-label={isHeroExpanded ? 'Collapse hero' : 'Expand hero'}
                title={isHeroExpanded ? 'Collapse' : 'Expand'}
              >
                {isHeroExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>

              <button
                onClick={() => setAnimPaused((p) => !p)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-3)] opacity-40 transition-opacity hover:opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                aria-label={animPaused ? 'Play animation' : 'Pause animation'}
                title={animPaused ? 'Play' : 'Pause'}
              >
                {animPaused ? <Play size={11} /> : <Pause size={11} />}
              </button>
            </div>

            {/* Overlay Content */}
            <div className={cn(
              "relative z-10 px-4 sm:px-6 py-6 h-full flex flex-col items-center justify-center text-center gap-4 transition-all duration-700 rounded-xl",
              isHeroExpanded ? "bg-gradient-to-b from-[var(--surface)]/40 to-[var(--surface-2)]/20 backdrop-blur-[1px]" : "bg-gradient-to-b from-[var(--surface)]/70 to-[var(--surface-2)]/40 backdrop-blur-[2px]",
              isHeroCollapsed ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}>
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
                  {liveModuleCount} live modules
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

          {/* Tab strip — STICKY when scrolling */}
          <div id="home-sticky-header" className="sticky top-0 z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
            <div className="flex min-h-12 items-center justify-between gap-3 px-3">
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

          {/* Content Areas - No internal scroll, use parent */}
          <TabsContent value="algorithms" className="relative z-10">
            <TaxonomyCardGrid algorithms={metas} />
          </TabsContent>

          <TabsContent value="games" className="relative z-10 p-4 sm:p-6">
            <div className="mx-auto max-w-5xl space-y-5">
              <SurfaceCard>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-3)]">Playgrounds</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Games, Sandboxes, and Labs by Category</h2>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  Maze is treated as a game, Graph Sandbox is the editable testing surface, and local-search modules stay grouped as labs.
                </p>
              </SurfaceCard>

              {CATEGORY_ORDER.map((category) => {
                const items = getDiscoveryItemsForCategory(category);
                return (
                  <SurfaceCard key={category} tone="muted" className="rounded-xl">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{CATEGORY_LABELS[category]}</h3>
                      <span className="text-[10px] font-mono text-[var(--text-3)] uppercase tracking-wider">
                        {items.length > 0 ? `${items.length} module${items.length > 1 ? 's' : ''}` : 'No modules yet'}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-4">
                        <p className="text-sm text-[var(--text-2)]">Coming soon: category-specific modules for this algorithm family.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {items.map((item) => (
                          item.path ? (
                            <NavigationTile
                              key={item.id}
                              to={item.path}
                              title={item.name}
                              description={item.description}
                              badge={item.kind === 'game' ? 'Game' : item.kind === 'sandbox' ? 'Sandbox' : 'Lab'}
                              badgeTone="success"
                            />
                          ) : (
                            <SurfaceCard key={item.id} tone="muted" padding="sm" className="rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[var(--text)]">{item.name}</p>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)]">
                                  {item.status === 'coming-soon'
                                    ? 'COMING SOON'
                                    : item.kind === 'game'
                                      ? 'GAME'
                                      : item.kind === 'sandbox'
                                        ? 'SANDBOX'
                                        : 'LAB'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[var(--text-2)]">{item.description}</p>
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

          <TabsContent value="graph" className="relative z-10 h-[calc(100vh-160px)]">
            <RelationshipGraph algorithms={metas} onFullscreen={() => setGraphFullscreen(true)} />
          </TabsContent>
        </div>
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
