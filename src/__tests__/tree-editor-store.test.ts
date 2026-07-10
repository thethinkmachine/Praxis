import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeEditorStore } from '@/store/treeEditor.store';

function resetStore() {
  useTreeEditorStore.setState({
    nodes: [],
    edges: [],
    mode: 'select',
    selectedIds: [],
    rootId: null,
    nextNodeId: 1,
    nextEdgeId: 1,
    past: [],
    future: [],
  });
}

describe('useTreeEditorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('addNode assigns the first node as root', () => {
    const id = useTreeEditorStore.getState().addNode({});
    expect(useTreeEditorStore.getState().rootId).toBe(id);
  });

  it('addEdge connects a parent to a child', () => {
    const store = useTreeEditorStore.getState();
    const a = store.addNode({});
    const b = useTreeEditorStore.getState().addNode({});
    const edgeId = useTreeEditorStore.getState().addEdge(a, b);
    expect(edgeId).not.toBeNull();
    expect(useTreeEditorStore.getState().edges).toHaveLength(1);
  });

  it('rejects a self-loop', () => {
    const a = useTreeEditorStore.getState().addNode({});
    const check = useTreeEditorStore.getState().canAddEdge(a, a);
    expect(check.ok).toBe(false);
    expect(useTreeEditorStore.getState().addEdge(a, a)).toBeNull();
    expect(useTreeEditorStore.getState().edges).toHaveLength(0);
  });

  it('rejects a second incoming edge on the same target', () => {
    const a = useTreeEditorStore.getState().addNode({});
    const b = useTreeEditorStore.getState().addNode({});
    const c = useTreeEditorStore.getState().addNode({});
    useTreeEditorStore.getState().addEdge(a, c);
    const secondEdge = useTreeEditorStore.getState().addEdge(b, c);
    expect(secondEdge).toBeNull();
    expect(useTreeEditorStore.getState().edges).toHaveLength(1);
  });

  it('rejects an edge that would create a cycle', () => {
    const a = useTreeEditorStore.getState().addNode({});
    const b = useTreeEditorStore.getState().addNode({});
    const c = useTreeEditorStore.getState().addNode({});
    useTreeEditorStore.getState().addEdge(a, b);
    useTreeEditorStore.getState().addEdge(b, c);
    // c -> a would close a loop: a -> b -> c -> a
    const cyclic = useTreeEditorStore.getState().addEdge(c, a);
    expect(cyclic).toBeNull();
    expect(useTreeEditorStore.getState().edges).toHaveLength(2);
  });

  it('removeNode cascades to incident edges and clears rootId if the root is removed', () => {
    const a = useTreeEditorStore.getState().addNode({});
    const b = useTreeEditorStore.getState().addNode({});
    useTreeEditorStore.getState().addEdge(a, b);

    useTreeEditorStore.getState().removeNode(a);

    const state = useTreeEditorStore.getState();
    expect(state.nodes.find((n) => n.id === a)).toBeUndefined();
    expect(state.edges).toHaveLength(0);
    expect(state.rootId).not.toBe(a);
  });

  it('setRoot moves the single root marker between nodes', () => {
    const a = useTreeEditorStore.getState().addNode({});
    const b = useTreeEditorStore.getState().addNode({});
    useTreeEditorStore.getState().setRoot(b);
    expect(useTreeEditorStore.getState().rootId).toBe(b);
    expect(useTreeEditorStore.getState().rootId).not.toBe(a);
  });

  it('undo/redo restores prior tree state through add/remove sequences', () => {
    const a = useTreeEditorStore.getState().addNode({});
    useTreeEditorStore.getState().addNode({});
    expect(useTreeEditorStore.getState().nodes).toHaveLength(2);

    useTreeEditorStore.getState().undo();
    expect(useTreeEditorStore.getState().nodes).toHaveLength(1);

    useTreeEditorStore.getState().undo();
    expect(useTreeEditorStore.getState().nodes).toHaveLength(0);

    useTreeEditorStore.getState().redo();
    expect(useTreeEditorStore.getState().nodes).toHaveLength(1);
    expect(useTreeEditorStore.getState().nodes[0]?.id).toBe(a);

    useTreeEditorStore.getState().redo();
    expect(useTreeEditorStore.getState().nodes).toHaveLength(2);
  });
});
