import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import type { AlgorithmRunner } from '@/types';
import React from 'react';

export interface RegistryEntry {
  runner: AlgorithmRunner;
  // Lazy-loaded React module component (optional — routing happens via React Router)
  moduleComponent?: React.LazyExoticComponent<React.ComponentType<object>>;
}

class AlgorithmRegistry {
  private entries = new Map<string, RegistryEntry>();

  /** Register a full entry (runner + optional component) */
  register(entry: RegistryEntry | AlgorithmRunner): void {
    if ('meta' in entry && 'run' in entry) {
      // Plain runner passed directly
      this.entries.set((entry as AlgorithmRunner).meta.id, { runner: entry as AlgorithmRunner });
    } else {
      this.entries.set((entry as RegistryEntry).runner.meta.id, entry as RegistryEntry);
    }
  }

  get(id: string): RegistryEntry | undefined {
    return this.entries.get(id);
  }

  getByCategory(category: AlgorithmCategory): RegistryEntry[] {
    return [...this.entries.values()].filter(e => e.runner.meta.category === category);
  }

  getAll(): RegistryEntry[] {
    return [...this.entries.values()];
  }

  getAllMeta(): AlgorithmMeta[] {
    return this.getAll().map(e => e.runner.meta);
  }

  getCategories(): AlgorithmCategory[] {
    const cats = new Set<AlgorithmCategory>();
    for (const entry of this.entries.values()) {
      cats.add(entry.runner.meta.category);
    }
    return [...cats];
  }
}

export const registry = new AlgorithmRegistry();
