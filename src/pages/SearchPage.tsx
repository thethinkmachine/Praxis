import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { registry } from '@/algorithms/core/registry';
import { useEditorStore } from '@/store/useEditorStore';
import { useExecutionStore } from '@/store/execution.store';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator from '@/components/module/ProblemConfigurator';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import SVGGraphCanvas from '@/components/visualization/SVGGraphCanvas';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import DemoProblemPicker from '@/components/editor/DemoProblemPicker';
import { Dice5 } from '@/components/shared/Icons';
import { generateRandomGraph } from '@/lib/random-generators';
import { INFORMED_HEURISTICS, getHeuristicDefinition } from '@/algorithms/search/informed/types';
import { createGraphSearchAdapterFromProblem } from '@/visualizations/adapters/graph-search.adapter';
import { getGraphSearchStyles } from '@/visualizations/cytoscapeStyles/graph-search.styles';
import { buildSearchTreeElements } from '@/visualizations/adapters/search-tree.adapter';

import type { AlgorithmStep } from '@/types/step';
import { Graph, type GraphProblem, type HeuristicId } from '@/types/problem';

// Algorithms that operate on unweighted graphs — don't display edge weight labels
const UNINFORMED_ALGOS = new Set(['bfs', 'dfs', 'dls', 'iddfs']);

function evaluationFormula(algo: string): string {
  if (algo === 'greedy-bfs') return 'f(n) = h(n)';
  if (algo === 'weighted-astar') return 'f(n) = g(n) + w * h(n)';
  if (algo === 'astar' || algo === 'ida-star') return 'f(n) = g(n) + h(n)';
  return 'Heuristic scoring is not used by this algorithm.';
}

export default function SearchPage() {
  const { algo = 'bfs' } = useParams<{ category: string; algo: string }>();
  const [heuristicId, setHeuristicId] = useState<HeuristicId>('manual-node');
  const [heuristicScale, setHeuristicScale] = useState(1);

  // ── Runner (for meta.category in SVGGraphCanvas) ─────────────────────
  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);
  const isInformedAlgorithm = !UNINFORMED_ALGOS.has(algo);
  const heuristicDefinition = useMemo(() => getHeuristicDefinition(heuristicId), [heuristicId]);

  // ── Execution store read (step needed for visualization memos) ───────
  const step = useExecutionStore(s => s.currentStep) as AlgorithmStep | null;

  // ── Editor store subscriptions ───────────────────────────────────────
  const editorNodes = useEditorStore(s => s.nodes);
  const editorEdges = useEditorStore(s => s.edges);
  const editorStartId = useEditorStore(s => s.startNodeId);
  const editorGoalId = useEditorStore(s => s.goalNodeId);
  const editorIsDirected = useEditorStore(s => s.isDirected);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const updateNode = useEditorStore(s => s.updateNode);

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
    fetch('/Praxis/problems/graphs/romania-map.json')
      .then(res => res.json())
      .then(data => {
        const p = data.problem;
        useEditorStore.getState().loadGraph(
          p.graph.nodes,
          p.graph.edges,
          p.startNode,
          p.goalNode,
          p.graph.directed ?? false
        );
      })
      .catch(err => console.error("Failed to preload Romania Map:", err));
  }, []);

  // ── Demo selector ────────────────────────────────────────────────────
  const handleDemoSelect = useCallback((problem: unknown) => {
    const p = problem as GraphProblem;
    // We already passed the exact json problem shape from `fetch` in Picker
    if (p?.graph?.nodes && p?.graph?.edges) {
      useEditorStore.getState().loadGraph(
        p.graph.nodes,
        p.graph.edges,
        p.startNode ?? '',
        p.goalNode ?? '',
        p.graph.directed ?? false,
      );
    }
  }, []);

  // ── Problems ─────────────────────────────────────────────────────────
  // algoProblem: topology-only (no positions) — changing this reloads the engine.
  // Uses nodeTopoKey as the trigger so position-only changes (drags) are ignored.
  const algoProblem = useMemo<GraphProblem>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const topoNodes = useEditorStore.getState().nodes.map(({ x: _x, y: _y, ...n }) => n);
    return {
      graph: new Graph({ directed: editorIsDirected, nodes: topoNodes, edges: editorEdges }),
      startNode: editorStartId ?? '',
      goalNode: editorGoalId ?? '',
      useHeuristic: isInformedAlgorithm,
      heuristic: isInformedAlgorithm
        ? {
            id: heuristicId,
            params: heuristicScale !== 1 ? { scale: heuristicScale } : undefined,
          }
        : undefined,
    };
  }, [nodeTopoKey, editorEdges, editorStartId, editorGoalId, editorIsDirected, isInformedAlgorithm, heuristicId, heuristicScale]);

  // displayProblem: includes positions — used only for Cytoscape element generation.
  const displayProblem = useMemo<GraphProblem>(() => ({
    graph: new Graph({ directed: editorIsDirected, nodes: editorNodes, edges: editorEdges }),
    startNode: editorStartId ?? '',
    goalNode: editorGoalId ?? '',
    useHeuristic: isInformedAlgorithm,
    heuristic: isInformedAlgorithm
      ? {
          id: heuristicId,
          params: heuristicScale !== 1 ? { scale: heuristicScale } : undefined,
        }
      : undefined,
  }), [editorNodes, editorEdges, editorStartId, editorGoalId, editorIsDirected, isInformedAlgorithm, heuristicId, heuristicScale]);

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
  ], [algorithmElements, stylesheet, step, runner, handleDemoSelect, treeElements]);

  // ── Title actions ────────────────────────────────────────────────────
  const titleActions = useMemo(() => (
    <div className="flex items-center gap-2">
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
      <DemoProblemPicker
        algorithmCategory={runner?.meta.category ?? 'uninformed-search'}
        onSelect={handleDemoSelect}
      />
    </div>
  ), [algo, runner, handleDemoSelect]);

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
      if (p.heuristic?.id) {
        setHeuristicId(p.heuristic.id);
        const importedScale = Number(p.heuristic.params?.scale);
        setHeuristicScale(Number.isFinite(importedScale) && importedScale > 0 ? importedScale : 1);
      }
    }
  }, []);

  const updateNodeHeuristic = useCallback((nodeId: string, raw: string) => {
    if (raw.trim() === '') {
      updateNode(nodeId, { heuristic: undefined });
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    updateNode(nodeId, { heuristic: parsed });
  }, [updateNode]);

  const configPanel = useMemo(() => {
    const selectedNode = selectedIds.length === 1 ? editorNodes.find(n => n.id === selectedIds[0]) : null;
    const selectedEdge = !selectedNode && selectedIds.length === 1 ? editorEdges.find(e => e.id === selectedIds[0]) : null;

    if (selectedNode) {
      return (
        <ProblemConfigurator title={`Node: ${selectedNode.label ?? selectedNode.id}`}>
          <div className="space-y-4 text-xs">
             <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Label</p>
                <input
                  type="text"
                  value={selectedNode.label ?? ''}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                  className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] font-mono focus:border-[var(--accent)]/50 outline-none"
                  placeholder={selectedNode.id}
                />
             </div>
             <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Heuristic Value (h)</p>
                <input
                  type="number"
                  step={0.1}
                  value={selectedNode.heuristic ?? ''}
                  onChange={(e) => updateNodeHeuristic(selectedNode.id, e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] font-mono focus:border-[var(--accent)]/50 outline-none"
                  placeholder="0.0"
                />
             </div>
             <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => useEditorStore.getState().setStartNode(selectedNode.id)}
                  className={cn(
                    "w-full py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    editorStartId === selectedNode.id 
                      ? "bg-[var(--purple)]/20 border-[var(--purple)]/50 text-[var(--purple)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-3)]"
                  )}
                >
                  Set as Start
                </button>
                <button
                  onClick={() => useEditorStore.getState().setGoalNode(selectedNode.id)}
                  className={cn(
                    "w-full py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    editorGoalId === selectedNode.id 
                      ? "bg-[var(--success)]/20 border-[var(--success)]/50 text-[var(--success)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-3)]"
                  )}
                >
                  Set as Goal
                </button>
             </div>
          </div>
        </ProblemConfigurator>
      );
    }

    if (selectedEdge) {
      return (
        <ProblemConfigurator title={`Edge: ${selectedEdge.id}`}>
          <div className="space-y-4 text-xs">
             <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Weight (Cost)</p>
                <input
                  type="number"
                  step={1}
                  value={selectedEdge.weight ?? 1}
                  onChange={(e) => useEditorStore.getState().updateEdge(selectedEdge.id, { weight: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] font-mono focus:border-[var(--accent)]/50 outline-none"
                />
             </div>
             <div className="text-[10px] text-[var(--text-3)] bg-[var(--surface-2)]/30 p-2 rounded border border-[var(--border)]">
                Connects <span className="text-[var(--text-2)] font-mono">{selectedEdge.source}</span> and <span className="text-[var(--text-2)] font-mono">{selectedEdge.target}</span>
             </div>
          </div>
        </ProblemConfigurator>
      );
    }

    return (
      <ProblemConfigurator title="Global Config">
        <div className="space-y-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Algorithm</p>
            <p className="text-[12px] text-[var(--text-2)] font-mono">{algo}</p>
          </div>

          {isInformedAlgorithm ? (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Heuristic Function</p>
                <select
                  value={heuristicId}
                  onChange={(e) => setHeuristicId(e.target.value as HeuristicId)}
                  className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
                >
                  {INFORMED_HEURISTICS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-3)] mt-1">{heuristicDefinition.description}</p>
              </div>

              {heuristicId !== 'manual-node' && heuristicId !== 'zero' && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Scale</p>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={heuristicScale}
                    onChange={(e) => setHeuristicScale(Math.max(0.1, Number(e.target.value) || 0.1))}
                    className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
                  />
                </div>
              )}

              {heuristicId === 'manual-node' && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Quick Table</p>
                  <div className="rounded border border-[var(--border)] overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--surface)]">
                      {[...editorNodes]
                        .sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id))
                        .map((node) => (
                          <div key={node.id} className="flex items-center justify-between px-2 py-1 gap-2">
                            <span className="truncate text-[10px] text-[var(--text-2)] font-mono">
                              {node.label ?? node.id}
                            </span>
                            <input
                              type="number"
                              step={0.1}
                              value={node.heuristic ?? ''}
                              onChange={(e) => updateNodeHeuristic(node.id, e.target.value)}
                              className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-right font-mono text-[10px]"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded border border-[var(--border)] p-2 bg-[var(--surface-2)]/30">
              <p className="text-[11px] text-[var(--text-2)]">This algorithm ignores heuristic functions.</p>
            </div>
          )}
        </div>
      </ProblemConfigurator>
    );
  }, [algo, isInformedAlgorithm, heuristicId, heuristicDefinition.description, heuristicScale, editorNodes, editorStartId, editorGoalId, editorEdges, selectedIds, updateNodeHeuristic]);

  return (
    <AlgorithmPage
      algorithmId={algo}
      problem={algoProblem}
      category={runner?.meta.category ?? 'uninformed-search'}
      problemCategory="graph"
      onProblemImport={handleImport}
      tabs={tabs}
      titleActions={titleActions}
      configPanel={configPanel}
      defaultConfigOpen={isInformedAlgorithm}
    />
  );
}
