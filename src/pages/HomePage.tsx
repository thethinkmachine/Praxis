import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { registry } from '@/algorithms/core/registry';
import TaxonomyCardGrid from '@/components/taxonomy/TaxonomyCardGrid';
import RelationshipGraph from '@/components/taxonomy/RelationshipGraph';
import AlgorithmSearch from '@/components/taxonomy/AlgorithmSearch';
import { X } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { AlgorithmCategory } from '@/types/algorithm';

export default function HomePage() {
  const metas = registry.getAllMeta();
  const [activeTab, setActiveTab] = useState('overview');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const scrollToCategory = useCallback((category: AlgorithmCategory) => {
    setActiveTab('overview');
    setTimeout(() => {
      const el = document.getElementById(`category-${category}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }, []);

  // Handle scroll param from sidebar navigation
  useEffect(() => {
    const scrollTarget = searchParams.get('scroll');
    if (scrollTarget) {
      const cat = scrollTarget.replace('category-', '') as AlgorithmCategory;
      if (CATEGORY_ORDER.includes(cat)) {
        scrollToCategory(cat);
      }
      setSearchParams({}, { replace: true });
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
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* Hero Section — hidden when graph tab is active */}
      <div
        className={cn(
          'relative border-b border-[var(--border)] overflow-hidden transition-all duration-300 ease-in-out',
          isGraphTab ? 'max-h-0 opacity-0 border-b-0' : 'max-h-[400px] opacity-100',
        )}
      >
        {/* Backdrop - RelationshipGraph at very low opacity */}
        <div className="absolute inset-0 opacity-[0.06] blur-[1px] pointer-events-none">
          <RelationshipGraph algorithms={metas} />
        </div>

        {/* Overlay Content */}
        <div className="relative z-10 px-6 py-8 flex flex-col items-center text-center gap-4">
          <span className="font-bold text-5xl tracking-tight text-[var(--text)]">
            Praxis
          </span>
          <p className="text-sm text-[var(--text-2)]">
            Interactive AI Algorithm Visualization
          </p>

          {/* Search */}
          <AlgorithmSearch />

          {/* Stats & CTA */}
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
              {metas.length} algorithms
            </span>
          </div>

          {/* Category Quick-Nav Chips */}
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className="text-xs px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--accent)]/60 hover:text-[var(--text)] transition-colors"
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 border-b border-[var(--border)] shrink-0">
          <TabsList className="flex gap-1 h-10 items-center">
            <TabsTrigger
              value="overview"
              className="px-3 py-1.5 text-sm text-[var(--text-2)] data-[state=active]:text-[var(--text)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent)] transition-colors"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="graph"
              className="px-3 py-1.5 text-sm text-[var(--text-2)] data-[state=active]:text-[var(--text)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent)] transition-colors"
            >
              Relationship Graph
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto">
          <TaxonomyCardGrid algorithms={metas} />
        </TabsContent>

        <TabsContent value="graph" className="flex-1 overflow-hidden">
          <RelationshipGraph algorithms={metas} onFullscreen={() => setGraphFullscreen(true)} />
        </TabsContent>
      </Tabs>

      {/* Fullscreen graph overlay */}
      {graphFullscreen && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)]">
          <RelationshipGraph algorithms={metas} />
          <button
            onClick={() => setGraphFullscreen(false)}
            className={cn(
              'fixed top-4 right-4 z-50 p-2 rounded-lg',
              'bg-[var(--surface)] border border-[var(--border)]',
              'text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]/50',
              'transition-colors shadow-lg',
            )}
            aria-label="Exit fullscreen"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
