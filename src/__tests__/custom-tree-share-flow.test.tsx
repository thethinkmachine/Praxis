// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// jsdom is missing a few browser APIs the render path touches.
class RO { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
if (!window.matchMedia) {
  // @ts-expect-error test polyfill
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import { registerAllAlgorithms } from '@/algorithms/register';
import GamePage from '@/pages/GamePage';

registerAllAlgorithms();
import { GameTree } from '@/types/problem';
import { serializeGameTree } from '@/problems/game-playing/custom-tree-share';
import { useTreeEditorStore } from '@/store/treeEditor.store';

// A tree with deliberately unique ids so it can't be confused with the default.
const SHARED_TREE = new GameTree({
  nodes: [
    { id: 'S_root', kind: 'max', x: 0, y: 0 },
    { id: 'S_a', kind: 'terminal', value: 7, x: -120, y: 140 },
    { id: 'S_b', kind: 'terminal', value: 3, x: 120, y: 140 },
  ],
  edges: [
    { id: 'S_e1', source: 'S_root', target: 'S_a' },
    { id: 'S_e2', source: 'S_root', target: 'S_b' },
  ],
  rootId: 'S_root',
});

function renderShared() {
  const token = serializeGameTree(SHARED_TREE);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/play/custom-tree/minimax?t=${encodeURIComponent(token)}`]}>
        <Routes>
          <Route path="/play/:labId/:algo" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('custom-tree shared-link flow (real GamePage under StrictMode)', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useTreeEditorStore.getState().clear();
    vi.restoreAllMocks();
  });

  it('loads the shared tree for a fresh visitor (empty store)', async () => {
    renderShared();
    await waitFor(() => {
      const ids = useTreeEditorStore.getState().nodes.map((n) => n.id).sort();
      expect(ids).toEqual(['S_a', 'S_b', 'S_root']);
    }, { timeout: 3000 });
    // Positions must survive so the canvas doesn't pile every node at (0,0).
    const a = useTreeEditorStore.getState().nodes.find((n) => n.id === 'S_a')!;
    expect(a.x).toBe(-120);
    expect(a.y).toBe(140);
  });

  it('shared link overrides a DIFFERENT persisted tree (returning user)', async () => {
    // Simulate a previously hand-drawn tree already in the persistent store.
    useTreeEditorStore.getState().loadTree(
      [{ id: 'OLD_1', kind: 'max', x: 0, y: 0 }, { id: 'OLD_2', kind: 'terminal', value: 1, x: 0, y: 140 }],
      [{ id: 'OLD_e', source: 'OLD_1', target: 'OLD_2' }],
      'OLD_1',
    );

    renderShared();

    await waitFor(() => {
      const ids = useTreeEditorStore.getState().nodes.map((n) => n.id).sort();
      expect(ids).toEqual(['S_a', 'S_b', 'S_root']);
    }, { timeout: 3000 });
  });
});
