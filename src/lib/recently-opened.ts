import { registry } from '@/algorithms/core/registry';
import { CATEGORY_LABELS } from '@/lib/constants';
import { DISCOVERY_ITEMS_BY_CATEGORY, type DiscoveryItem } from '@/lib/discovery-items';
import type { AlgorithmCategory } from '@/types/algorithm';

const STORAGE_KEY = 'praxis:recently-opened:v1';
export const RECENTLY_OPENED_UPDATED = 'praxis:recently-opened-updated';
export const RECENTLY_OPENED_LIMIT = 5;

export interface RecentDestination {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  kind: 'algorithm' | 'playground';
  category?: AlgorithmCategory;
  openedAt: number;
}

interface DiscoveryEntry {
  category: AlgorithmCategory;
  item: DiscoveryItem;
}

function flattenDiscoveryItems(): DiscoveryEntry[] {
  return Object.entries(DISCOVERY_ITEMS_BY_CATEGORY).flatMap(([category, items]) =>
    (items ?? []).map((item) => ({ category: category as AlgorithmCategory, item })),
  );
}

function routeParts(path: string): { pathname: string; search: URLSearchParams } {
  const [pathname, rawSearch = ''] = path.split('?');
  return {
    pathname,
    search: new URLSearchParams(rawSearch),
  };
}

function sameRoute(definitionPath: string, pathname: string, search: string): boolean {
  const currentSearch = new URLSearchParams(search);
  const definition = routeParts(definitionPath);
  if (definition.pathname !== pathname) return false;

  for (const [key, value] of definition.search.entries()) {
    if (currentSearch.get(key) !== value) return false;
  }
  return true;
}

function algorithmIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'search' && parts.length >= 3) return parts[2];
  if (parts[0] === 'play' && parts.length >= 3) return parts[2];
  if (['maze', 'local', 'planning', 'csp'].includes(parts[0] ?? '') && parts.length >= 2) return parts[1];
  return null;
}

export function getRecentDestinationForLocation(pathname: string, search: string): Omit<RecentDestination, 'openedAt'> | null {
  if (pathname === '/') return null;

  const discoveryMatch = flattenDiscoveryItems()
    .filter(({ item }) => item.path && item.status === 'live')
    .find(({ item }) => sameRoute(item.path!, pathname, search));

  if (discoveryMatch?.item.path) {
    return {
      id: discoveryMatch.item.path,
      title: discoveryMatch.item.name,
      subtitle: `${CATEGORY_LABELS[discoveryMatch.category]} Playground`,
      path: discoveryMatch.item.path,
      kind: 'playground',
      category: discoveryMatch.category,
    };
  }

  const algorithmId = algorithmIdFromPath(pathname);
  const meta = algorithmId ? registry.get(algorithmId)?.runner.meta : null;
  if (!meta) return null;

  return {
    id: `${pathname}${search}`,
    title: meta.name,
    subtitle: CATEGORY_LABELS[meta.category],
    path: `${pathname}${search}`,
    kind: 'algorithm',
    category: meta.category,
  };
}

export function getRecentlyOpened(): RecentDestination[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as RecentDestination[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.path === 'string' && typeof item.title === 'string')
      .slice(0, RECENTLY_OPENED_LIMIT);
  } catch {
    return [];
  }
}

export function setRecentlyOpened(items: RecentDestination[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, RECENTLY_OPENED_LIMIT)));
    window.dispatchEvent(new CustomEvent(RECENTLY_OPENED_UPDATED));
  } catch {
    // Recents are a convenience; never let storage restrictions break navigation.
  }
}

export function rememberRecentDestination(destination: Omit<RecentDestination, 'openedAt'>): void {
  const next: RecentDestination = { ...destination, openedAt: Date.now() };
  const deduped = getRecentlyOpened().filter((item) => item.id !== next.id && item.path !== next.path);
  setRecentlyOpened([next, ...deduped]);
}

export function rememberRecentLocation(pathname: string, search: string): void {
  const destination = getRecentDestinationForLocation(pathname, search);
  if (destination) rememberRecentDestination(destination);
}
