import { useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { registry } from '@/algorithms/core/registry';
import { useEditorStore } from '@/store/useEditorStore';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import SVGGraphCanvas from '@/components/visualization/SVGGraphCanvas';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import MazeEditor, { MazeAlgorithmOverlay } from '@/components/visualization/MazeEditor';
import { Dice5 } from '@/components/shared/Icons';
import { generateRandomGraph } from '@/lib/random-generators';
import { createGraphSearchAdapterFromProblem } from '@/visualizations/adapters/graph-search.adapter';
import { getGraphSearchStyles } from '@/visualizations/cytoscapeStyles/graph-search.styles';
import { buildSearchTreeElements } from '@/visualizations/adapters/search-tree.adapter';
import { getSearchTreeStyles } from '@/visualizations/cytoscapeStyles/search-tree.styles';
import { romaniaMapData, romaniaMapProblem } from '@/problems/graphs/romania-map';
import { simpleGraphData, simpleGraphProblem } from '@/problems/graphs/simple-graph';
import { createGridGraph } from '@/problems/graphs/grid-graph';
import { weightedGridData, weightedGridProblem } from '@/problems/graphs/weighted-grid';
import type { AlgorithmStep } from '@/types/step';
import type { GraphProblem } from '@/types/problem';
import type cytoscape from 'cytoscape';

// Algorithms that operate on unweighted graphs — don't display edge weight labels
const UNINFORMED_ALGOS = new Set(['bfs', 'dfs', 'dls', 'iddfs']);

export default function SearchPage() {
  const { algo = 'bfs' } = useParams<{ category: string; algo: string }>();

  // ── Runner (for meta.category in SVGGraphCanvas) ─────────────────────
  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);

  // ── Execution store read (step needed for visualization memos) ───────
  const step = useExecutionStore(s => s.currentStep) as AlgorithmStep | null;

  // ── Editor store subscriptions ───────────────────────────────────────
  const editorNodes = useEditorStore(s => s.nodes);
  const editorEdges = useEditorStore(s => s.edges);
  const editorStartId = useEditorStore(s => s.startNodeId);
  const editorGoalId = useEditorStore(s => s.goalNodeId);
  const editorIsDirected = useEditorStore(s => s.isDirected);

  // Topology fingerprint — stable string that changes only when nodes are
  // added/removed/renamed, NOT when positions change.
  const nodeTopoKey = useEditorStore(
    s => s.nodes
      .map(n => `${n.id}:${n.label ?? ''}:${n.heuristic ?? ''}`)
      .sort()
      .join(','),
  );

  // ── Pre-load Romania map on first mount ──────────────────────────────
  useEffect(() => {
    useEditorStore.getState().loadGraph(
      romaniaMapData.nodes,
      romaniaMapData.edges,
      romaniaMapProblem.startNode,
      romaniaMapProblem.goalNode,
      romaniaMapData.directed ?? false,
    );
  }, []);

  // ── Demo selector ────────────────────────────────────────────────────
  const handleDemoSelect = useCallback((problemId: string) => {
    const state = useEditorStore.getState();
    if (problemId === 'romania-map') {
      state.loadGraph(romaniaMapData.nodes, romaniaMapData.edges, romaniaMapProblem.startNode, romaniaMapProblem.goalNode, romaniaMapData.directed ?? false);
    } else if (problemId === 'simple-graph') {
      state.loadGraph(simpleGraphData.nodes, simpleGraphData.edges, simpleGraphProblem.startNode, simpleGraphProblem.goalNode, simpleGraphData.directed ?? false);
    } else if (problemId === 'grid-maze') {
      const gridData = createGridGraph(6, 6, 5, 5);
      state.loadGraph(gridData.nodes, gridData.edges, 'r0c0', 'r5c5', false);
    } else if (problemId === 'weighted-grid') {
      state.loadGraph(weightedGridData.nodes, weightedGridData.edges, weightedGridProblem.startNode, weightedGridProblem.goalNode, weightedGridProblem.graph.directed ?? false);
    }
  }, []);

  // ── Problems ─────────────────────────────────────────────────────────
  // algoProblem: topology-only (no positions) — changing this reloads the engine.
  // Uses nodeTopoKey as the trigger so position-only changes (drags) are ignored.
  const algoProblem = useMemo<GraphProblem>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const topoNodes = useEditorStore.getState().nodes.map(({ x: _x, y: _y, ...n }) => n);
    return {
      graph: { directed: editorIsDirected, nodes: topoNodes, edges: editorEdges },
      startNode: editorStartId ?? romaniaMapProblem.startNode,
      goalNode: editorGoalId ?? romaniaMapProblem.goalNode,
      useHeuristic: !UNINFORMED_ALGOS.has(algo),
    };
  }, [nodeTopoKey, editorEdges, editorStartId, editorGoalId, editorIsDirected, algo]);

  // displayProblem: includes positions — used only for Cytoscape element generation.
  const displayProblem = useMemo<GraphProblem>(() => ({
    graph: { directed: editorIsDirected, nodes: editorNodes, edges: editorEdges },
    startNode: editorStartId ?? romaniaMapProblem.startNode,
    goalNode: editorGoalId ?? romaniaMapProblem.goalNode,
    useHeuristic: !UNINFORMED_ALGOS.has(algo),
  }), [editorNodes, editorEdges, editorStartId, editorGoalId, editorIsDirected, algo]);

  // ── Stylesheet ───────────────────────────────────────────────────────
  const stylesheet = useMemo(
    () => getGraphSearchStyles(!UNINFORMED_ALGOS.has(algo)),
    [algo],
  );

  // ── Cytoscape elements (colored by algorithm state) ──────────────────
  const algorithmElements = useMemo(() => {
    if (!step) return [];
    try {
      return createGraphSearchAdapterFromProblem(
        displayProblem.graph,
        displayProblem.startNode,
        displayProblem.goalNode,
      ).toCytoscapeElements(step as unknown as AlgorithmStep<never, never>);
    } catch {
      return [];
    }
  }, [step, displayProblem]);

  // ── Node label map (for tree node display names) ─────────────────────
  const labelMap = useMemo(
    () => new Map(editorNodes.map(n => [n.id, n.label ?? n.id])),
    [editorNodes],
  );

  // ── Search tree Cytoscape elements ───────────────────────────────────
  const treeElements = useMemo(() => {
    if (!step) return [];
    try {
      const st = step.state as Record<string, unknown>;
      const pathMap = st.pathMap instanceof Map
        ? st.pathMap as Map<string, string | null>
        : new Map<string, string | null>();
      const foundPath = Array.isArray(st.foundPath) ? st.foundPath as string[] : null;

      const gCosts = (st.gCosts instanceof Map ? st.gCosts : st.costs instanceof Map ? st.costs : undefined) as Map<string, number> | undefined;
      const hCosts = (st.hCosts instanceof Map ? st.hCosts : undefined) as Map<string, number> | undefined;
      const fCosts = (st.fCosts instanceof Map ? st.fCosts : undefined) as Map<string, number> | undefined;

      const highlight = step.highlight as {
        frontierNodes?: Set<string>;
        exploredNodes?: Set<string>;
        currentNode?: string | null;
        pathEdges?: string[] | null;
      };

      return buildSearchTreeElements(pathMap, highlight, foundPath, {
        startNode: displayProblem.startNode,
        goalNode: displayProblem.goalNode,
        labelMap,
        gCosts,
        hCosts,
        fCosts,
      });
    } catch {
      return [];
    }
  }, [step, displayProblem.startNode, displayProblem.goalNode, labelMap]);

  // ── Tree stylesheet & layout (kept for potential future use) ──────────
  const treeStylesheet = useMemo(
    () => getSearchTreeStyles(!UNINFORMED_ALGOS.has(algo)),
    [algo],
  );

  const treeLayout = useMemo<cytoscape.LayoutOptions>(
    () => ({ name: 'dagre', rankDir: 'TB', nodeSep: 40, rankSep: 60, padding: 20 } as cytoscape.LayoutOptions),
    [],
  );

  // Suppress unused-variable warnings — these are kept for future use
  void treeStylesheet;
  void treeLayout;

  // ── Maze algorithm overlay ───────────────────────────────────────────
  const mazeOverlay = useMemo<MazeAlgorithmOverlay | null>(() => {
    if (!step) return null;
    const st = step.state as Record<string, unknown>;
    const h = step.highlight as Record<string, unknown>;
    const frontier = new Set<string>(Array.isArray(st.frontier) ? st.frontier as string[] : []);
    const explored = st.explored instanceof Set ? st.explored as Set<string> : new Set<string>();
    const currentNode = typeof h.currentNode === 'string' ? h.currentNode : null;
    const foundPath = Array.isArray(st.foundPath) ? st.foundPath as string[] : [];
    return { frontier, explored, currentNode, pathNodes: new Set(foundPath) };
  }, [step]);

  // ── Tabs ─────────────────────────────────────────────────────────────
  const tabs: TabDefinition[] = useMemo(() => [
    {
      id: 'graph',
      label: 'Graph View',
      content: (
        <SVGGraphCanvas
          algorithmElements={algorithmElements}
          stylesheet={stylesheet}
          description={step?.description}
          algorithmCategory={runner?.meta.category ?? 'uninformed-search'}
          onDemoSelect={handleDemoSelect}
          className="h-full"
        />
      ),
      keepMounted: true,
    },
    {
      id: 'tree',
      label: 'Search Tree',
      content: treeElements.length > 0 ? (
        <SVGAutoCanvas elements={treeElements} />
      ) : (
        <div className="h-full flex items-center justify-center bg-[var(--bg)]">
          <div className="text-center space-y-1.5">
            <p className="text-sm text-[var(--text-3)]">No search tree yet</p>
            <p className="text-xs text-[var(--text-3)]">
              Step through the algorithm to build the exploration tree
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'maze',
      label: 'Maze Editor',
      content: (
        <div className="h-full overflow-auto flex items-start justify-center pt-4 pb-4 bg-[var(--bg)]">
          <MazeEditor
            rows={10}
            cols={14}
            algorithmOverlay={mazeOverlay}
            onMazeChange={(graphData, startId, goalId) => {
              useEditorStore.getState().loadGraph(graphData.nodes, graphData.edges, startId, goalId, false);
            }}
          />
        </div>
      ),
    },
  ], [algorithmElements, stylesheet, step, runner, handleDemoSelect, treeElements, mazeOverlay]);

  // ── Title actions ────────────────────────────────────────────────────
  const titleActions = useMemo(() => (
    <button
      onClick={() => {
        const weighted = !UNINFORMED_ALGOS.has(algo);
        const { nodes, edges } = generateRandomGraph(6 + Math.floor(Math.random() * 5), 0.25, weighted);
        const ids = nodes.map(n => n.id);
        useEditorStore.getState().loadGraph(nodes, edges, ids[0], ids[ids.length - 1], false);
      }}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--accent)]/60 transition-colors"
      title="Generate random graph"
    >
      <Dice5 size={12} />
      Random
    </button>
  ), [algo]);

  // ── Problem import handler ───────────────────────────────────────────
  const handleImport = useCallback((imported: unknown) => {
    const p = imported as GraphProblem;
    if (p?.graph?.nodes && p?.graph?.edges) {
      useEditorStore.getState().loadGraph(
        p.graph.nodes,
        p.graph.edges,
        p.startNode ?? 'A',
        p.goalNode ?? 'B',
        p.graph.directed ?? false,
      );
    }
  }, []);

  return (
    <AlgorithmPage
      algorithmId={algo}
      problem={algoProblem}
      category={runner?.meta.category ?? 'uninformed-search'}
      problemCategory="graph"
      onProblemImport={handleImport}
      tabs={tabs}
      titleActions={titleActions}
    />
  );
}
