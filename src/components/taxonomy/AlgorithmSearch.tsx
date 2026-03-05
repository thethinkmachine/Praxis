import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { registry } from '@/algorithms/core/registry';
import { buildRoute } from '@/lib/buildRoute';
import { Search } from '@/components/shared/Icons';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import { cn } from '@/lib/cn';
import type { AlgorithmMeta } from '@/types/algorithm';

export default function AlgorithmSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allMetas = useMemo(() => {
    return registry.getAll().map(e => e.runner.meta);
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(allMetas, {
      keys: ['name', 'shortName', 'description', 'category', 'tags'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allMetas]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 8).map(r => r.item);
  }, [fuse, query]);

  // Global Ctrl+K shortcut to focus
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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(meta: AlgorithmMeta) {
    navigate(buildRoute({ id: meta.id, category: meta.category }));
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && query.trim().length > 0 && results.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input */}
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
          placeholder="Search algorithms..."
          className={cn(
            'w-full pl-9 pr-16 py-2.5 rounded-lg text-sm font-mono',
            'bg-[var(--surface)] border border-[var(--border)] shadow-[0_8px_30px_rgba(0,0,0,0.25)]',
            'text-[var(--text)] placeholder:text-[var(--text-3)]',
            'focus:outline-none focus:border-[var(--accent)]/70',
            'transition-colors',
          )}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-3)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 font-mono">
          Ctrl+K
        </kbd>
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
          {results.map((meta, i) => (
            <button
              key={meta.id}
              onClick={() => handleSelect(meta)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                'w-full text-left px-3 py-2.5 flex flex-col gap-1 transition-colors',
                i === selectedIndex
                  ? 'bg-[var(--accent-soft)]'
                  : 'hover:bg-[var(--surface-2)]',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)]">
                  {meta.name}
                </span>
                <AlgorithmBadge category={meta.category} size="sm" />
              </div>
              {meta.description && (
                <p className="text-xs text-[var(--text-2)] line-clamp-1">
                  {meta.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {open && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg p-4 text-center">
          <p className="text-sm text-[var(--text-2)]">No algorithms found</p>
        </div>
      )}
    </div>
  );
}
