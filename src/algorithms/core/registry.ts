import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import type { AlgorithmRunner } from '@/types';
import React from 'react';

type AnyRunner = AlgorithmRunner<unknown, unknown, unknown, unknown>;

export interface RegistryEntry {
  runner: AnyRunner;
  // Lazy-loaded React module component (optional — routing happens via React Router)
  moduleComponent?: React.LazyExoticComponent<React.ComponentType<object>>;
}

class AlgorithmRegistry {
  private entries = new Map<string, RegistryEntry>();

  /** Register a full entry (runner + optional component) */
  register(entry: RegistryEntry | AnyRunner): void {
    const normalized = 'meta' in entry && 'run' in entry
      ? { runner: entry as AnyRunner }
      : entry as RegistryEntry;
    const id = normalized.runner.meta.id;

    if (this.entries.has(id)) {
      throw new Error(`Algorithm "${id}" is already registered`);
    }

    this.entries.set(id, normalized);
  }

  registerMany(entries: Array<RegistryEntry | AnyRunner>): void {
    entries.forEach(entry => this.register(entry));
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
