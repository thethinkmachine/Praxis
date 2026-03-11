import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { registry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { DISCOVERY_ITEMS_BY_CATEGORY, type DiscoveryItem } from '@/lib/discovery-items';
import { Search, Gamepad2 } from '@/components/shared/Icons';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import { cn } from '@/lib/cn';
import type { AlgorithmMeta, AlgorithmCategory } from '@/types/algorithm';

type SearchItem =
  | { type: 'algorithm'; id: string; route: string; meta: AlgorithmMeta; groupLabel: string }
  | { type: 'module'; id: string; route: string; item: DiscoveryItem; category: AlgorithmCategory; groupLabel: string };

interface DropdownPosition {
  left: number;
  top: number;
  width: number;
}

function flattenDiscoveryItems(): Array<{ category: AlgorithmCategory; item: DiscoveryItem }> {
  return Object.entries(DISCOVERY_ITEMS_BY_CATEGORY).flatMap(([category, items]) =>
    (items ?? []).map((item) => ({ category: category as AlgorithmCategory, item })),
  );
}

export default function AlgorithmSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allAlgorithms = useMemo(() => {
    return registry.getAll().map((entry) => entry.runner.meta);
  }, []);

  const allDiscoveryItems = useMemo(() => flattenDiscoveryItems().filter((entry) => !!entry.item.path), []);

  const algorithmFuse = useMemo(() => new Fuse(allAlgorithms, {
    keys: ['name', 'shortName', 'description', 'category', 'tags'],
    threshold: 0.38,
    includeScore: true,
  }), [allAlgorithms]);

  const discoveryFuse = useMemo(() => new Fuse(allDiscoveryItems, {
    keys: ['item.name', 'item.description', 'category'],
    threshold: 0.4,
    includeScore: true,
  }), [allDiscoveryItems]);

  const algorithmResults = useMemo(() => {
    if (!query.trim()) return [];
    return algorithmFuse.search(query).slice(0, 6).map(({ item }) => ({
      type: 'algorithm' as const,
      id: item.id,
      route: buildRoute({ id: item.id, category: item.category }),
      meta: item,
      groupLabel: 'Algorithms',
    }));
  }, [algorithmFuse, query]);

  const moduleResults = useMemo(() => {
    if (!query.trim()) return [];
    return discoveryFuse.search(query).slice(0, 4).map(({ item }) => ({
      type: 'module' as const,
      id: item.item.id,
      route: item.item.path!,
      item: item.item,
      category: item.category,
      groupLabel: 'Modules',
    }));
  }, [discoveryFuse, query]);

  const flatResults: SearchItem[] = useMemo(() => [...algorithmResults, ...moduleResults], [algorithmResults, moduleResults]);

  const showDropdown = open && query.trim().length > 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setDropdownPosition({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
  }, [showDropdown, query, updateDropdownPosition]);

  useEffect(() => {
    if (!showDropdown) return;
    const handlePosition = () => updateDropdownPosition();
    window.addEventListener('resize', handlePosition);
    window.addEventListener('scroll', handlePosition, true);
    return () => {
      window.removeEventListener('resize', handlePosition);
      window.removeEventListener('scroll', handlePosition, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  function handleSelect(item: SearchItem) {
    navigate(item.route);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const dropdown = showDropdown && dropdownPosition
    ? createPortal(
        <div
          className="fixed z-[80] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)]/96 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl overflow-hidden"
          style={{
            left: dropdownPosition.left,
            top: dropdownPosition.top,
            width: dropdownPosition.width,
          }}
        >
          {flatResults.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto">
              {algorithmResults.length > 0 && (
                <div className="border-b border-[var(--border)]">
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)] bg-[var(--surface-2)]/70">
                    Algorithms
                  </div>
                  {algorithmResults.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 flex flex-col gap-1 transition-colors',
                        index === selectedIndex ? 'bg-[var(--accent-soft)]/85' : 'hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text)]">{item.meta.name}</span>
                        <AlgorithmBadge category={item.meta.category} size="sm" />
                      </div>
                      <p className="text-xs text-[var(--text-2)] line-clamp-1">{item.meta.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {moduleResults.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)] bg-[var(--surface-2)]/70">
                    Modules
                  </div>
                  {moduleResults.map((item, itemIndex) => {
                    const index = algorithmResults.length + itemIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors',
                          index === selectedIndex ? 'bg-[var(--accent-soft)]/85' : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <span className="mt-0.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-1 text-[var(--accent)]">
                          <Gamepad2 size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[var(--text)]">{item.item.name}</span>
                          <span className="block text-xs text-[var(--text-2)] line-clamp-1">{item.item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-[var(--text)]">No matching algorithms or modules</p>
              <p className="mt-1 text-xs text-[var(--text-3)]">Try an algorithm name, heuristic, game, or sandbox title.</p>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search algorithms, games, and sandboxes..."
          className={cn(
            'w-full pl-9 pr-16 py-3 rounded-xl text-sm font-mono',
            'bg-[var(--surface)] border border-[var(--border)] shadow-[0_14px_40px_rgba(0,0,0,0.32)]',
            'text-[var(--text)] placeholder:text-[var(--text-3)]',
            'focus:outline-none focus:border-[var(--accent)]/70 focus:ring-2 focus:ring-[var(--accent)]/10',
            'transition-colors',
          )}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-3)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 font-mono">
          Ctrl+K
        </kbd>
      </div>

      {dropdown}
    </div>
  );
}
