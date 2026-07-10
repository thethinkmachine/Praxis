import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GameTree, type GameProblem, type GameTreeEdgeData, type GameTreeNodeData, type GameTreeNodeKind, type GameTreeProblem } from '@/types/problem';
import type { AlgorithmStep } from '@/types/step';
import type { GameTraceHighlight, GameTraceState } from '@/algorithms/game-playing/types';
import { validateGameTreeProblem } from '@/problems/game-playing/game-tree.domain';
import { useTreeEditorStore } from '@/store/treeEditor.store';
import SVGGameTreeCanvas from '@/components/visualization/SVGGameTreeCanvas';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import EmptyState from '@/components/shared/EmptyState';
import { buildGameTreeElements } from '@/visualizations/adapters/game-tree.adapter';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import Select from '@/components/shared/Select';
import StatTile from '@/components/shared/StatTile';
import { RotateCcw, Copy } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import { toAbsoluteAppUrl } from '@/lib/app-paths';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import type { GameLabContext } from './lab-modules';
import {
  CUSTOM_TREE_SCENARIOS,
  createDefaultGameTreeProblem,
  getCustomTreeScenario,
} from './custom-tree-lab';
import { serializeGameTree, deserializeGameTree } from './custom-tree-share';
import { layoutGameTree } from './tree-layout';

const KIND_OPTIONS = [
  { value: 'max', label: 'Max (maximizes)' },
  { value: 'min', label: 'Min (minimizes)' },
  { value: 'chance', label: 'Chance (averages)' },
  { value: 'terminal', label: 'Leaf (fixed value)' },
];

// Structural fingerprint — deliberately excludes node x/y so repositioning a
// node on the canvas never re-keys the execution engine (mirrors how
// SearchPage strips positions from its algoProblem).
function structuralSignature(nodes: GameTreeNodeData[], edges: GameTreeEdgeData[], rootId: string | null): string {
  const n = nodes
    .map((node) => `${node.id}:${node.kind}:${node.value ?? ''}:${node.label ?? ''}`)
    .sort()
    .join('|');
  const e = edges
    .map((edge) => `${edge.id}:${edge.source}>${edge.target}:${edge.moveLabel ?? ''}:${edge.probability ?? ''}`)
    .sort()
    .join('|');
  return `${rootId ?? ''}#${n}#${e}`;
}

// Position-free problem the algorithm runs on.
function deriveProblem(nodes: GameTreeNodeData[], edges: GameTreeEdgeData[], rootId: string | null): GameTreeProblem {
  const treeNodes = nodes.map((node) => ({ id: node.id, kind: node.kind, value: node.value, label: node.label }));
  return { kind: 'game-tree', tree: new GameTree({ nodes: treeNodes, edges: edges.map((e) => ({ ...e })), rootId }) };
}

/**
 * Keeps the persistent editor store and GamePage's `problem` state in sync.
 * The store is the source of truth: on (re)mount, a non-empty store wins, so
 * navigating away and back never destroys a hand-drawn tree. External loads
 * (preset / import / clear) flow problem -> store; canvas edits flow
 * store -> problem.
 */
function useTreeProblemSync(context: GameLabContext, onExternalLoad: () => void) {
  const problem = context.problem as GameTreeProblem;
  const lastStructuralRef = useRef<string | null>(null);
  // The initial problem object (stable across renders). The mount effect below
  // owns the initial problem<->store sync, so the [problem] effect must NOT act
  // while `problem` is still this initial value — see the guard there.
  const initialProblemRef = useRef(problem);
  const [searchParams] = useSearchParams();
  const sharedToken = searchParams.get('t');

  // Adopt the store on first mount. Precedence: a ?t= share link > the persisted
  // store (so navigating away/back keeps a hand-drawn tree) > the default problem.
  useEffect(() => {
    const store = useTreeEditorStore.getState();
    const shared = sharedToken ? deserializeGameTree(sharedToken) : null;
    if (shared) {
      let sharedNodes = shared.tree.nodes.map((n) => ({ ...n }));
      const sharedEdges = shared.tree.edges.map((e) => ({ ...e }));
      // Defends against tokens that lack positions (e.g. links shared before
      // this fix) — without this every node would default to (0, 0) and pile
      // on top of each other instead of rendering as a tree.
      if (!sharedNodes.some((n) => n.x !== undefined && n.y !== undefined)) {
        const positions = layoutGameTree(sharedNodes, sharedEdges, shared.tree.rootId);
        sharedNodes = sharedNodes.map((n) => ({ ...n, ...positions.get(n.id) }));
      }
      store.loadTree(sharedNodes, sharedEdges, shared.tree.rootId);
      lastStructuralRef.current = structuralSignature(sharedNodes, sharedEdges, shared.tree.rootId);
      context.setProblem(deriveProblem(sharedNodes, sharedEdges, shared.tree.rootId));
      onExternalLoad();
    } else if (store.nodes.length === 0) {
      store.loadTree(problem.tree.nodes.map((n) => ({ ...n })), problem.tree.edges.map((e) => ({ ...e })), problem.tree.rootId);
      lastStructuralRef.current = structuralSignature(problem.tree.nodes, problem.tree.edges, problem.tree.rootId);
    } else {
      lastStructuralRef.current = structuralSignature(store.nodes, store.edges, store.rootId);
      context.setProblem(deriveProblem(store.nodes, store.edges, store.rootId));
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External problem change (preset/import/clear) -> load into the store.
  useEffect(() => {
    // Skip while `problem` is still the initial value. This effect fires on
    // mount with the *stale* initial problem (default) even though the mount
    // effect above has already synced the store to a ?t= shared tree and
    // called setProblem — acting on that stale value would reload the default
    // over the shared tree. Reference identity is StrictMode-safe (unlike a
    // "first run" counter, which the setup->cleanup->setup double-invoke
    // defeats). Genuine preset/import/clear changes produce a new object and
    // pass this guard.
    if (problem === initialProblemRef.current) return;
    const sig = structuralSignature(problem.tree.nodes, problem.tree.edges, problem.tree.rootId);
    const store = useTreeEditorStore.getState();
    const storeSig = structuralSignature(store.nodes, store.edges, store.rootId);
    if (sig !== lastStructuralRef.current && sig !== storeSig) {
      store.loadTree(problem.tree.nodes.map((n) => ({ ...n })), problem.tree.edges.map((e) => ({ ...e })), problem.tree.rootId);
      lastStructuralRef.current = sig;
      onExternalLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  // Canvas structural edits -> derive a new problem for the algorithm.
  const storeNodes = useTreeEditorStore((s) => s.nodes);
  const storeEdges = useTreeEditorStore((s) => s.edges);
  const storeRootId = useTreeEditorStore((s) => s.rootId);
  useEffect(() => {
    const sig = structuralSignature(storeNodes, storeEdges, storeRootId);
    if (sig !== lastStructuralRef.current) {
      lastStructuralRef.current = sig;
      context.setProblem(deriveProblem(storeNodes, storeEdges, storeRootId));
      context.markProblemChanged('tree-edit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeNodes, storeEdges, storeRootId]);
}

function ProblemViewTab({ context }: { context: GameLabContext }) {
  const [problemKey, setProblemKey] = useState(0);
  useTreeProblemSync(context, () => setProblemKey((k) => k + 1));
  const step = context.step as AlgorithmStep<GameTraceState, GameTraceHighlight> | null;
  return <SVGGameTreeCanvas step={step} problemKey={String(problemKey)} />;
}

function SearchTreeTab({ context }: { context: GameLabContext }) {
  const step = context.step as AlgorithmStep<GameTraceState, GameTraceHighlight> | null;
  const elements = useMemo(() => {
    if (!step?.state?.searchTree) return [];
    return buildGameTreeElements(
      step.state.searchTree,
      step.highlight.currentNodeId ?? null,
      step.highlight.principalVariation ?? null,
      step.stepNumber,
      (node) => (node.nodeKind === 'terminal' ? String(node.score ?? 0) : (node.score != null ? String(node.score) : node.stateLabel)),
      (node) => node.moveLabel ?? '',
      (node) => (node.nodeKind === 'max' ? 'circle' : node.nodeKind === 'min' ? 'square' : node.nodeKind === 'chance' ? 'diamond' : 'card'),
    );
  }, [step]);

  if (elements.length === 0) {
    return (
      <EmptyState
        title="No search tree yet"
        description="Step through the algorithm to watch it expand the tree in discovery order."
        className="bg-[var(--bg)]"
      />
    );
  }
  return <div className="h-full w-full bg-[var(--bg)]"><SVGAutoCanvas elements={elements} minimapStorageKey="praxis:tree-minimap-position" /></div>;
}

function CustomTreeConfigPanel({ context }: { context: GameLabContext }) {
  const nodes = useTreeEditorStore((s) => s.nodes);
  const edges = useTreeEditorStore((s) => s.edges);
  const rootId = useTreeEditorStore((s) => s.rootId);
  const selectedIds = useTreeEditorStore((s) => s.selectedIds);
  const updateNode = useTreeEditorStore((s) => s.updateNode);
  const updateEdge = useTreeEditorStore((s) => s.updateEdge);

  const validation = useMemo(
    () => validateGameTreeProblem(deriveProblem(nodes, edges, rootId)),
    [nodes, edges, rootId],
  );

  const selectedNode = nodes.find((n) => selectedIds.includes(n.id));
  const childEdges = selectedNode ? edges.filter((e) => e.source === selectedNode.id) : [];
  const probabilitySum = childEdges.reduce((sum, e) => sum + (e.probability ?? 0), 0);

  return (
    <ProblemConfigurator title="Custom Tree">
      <ConfigSection title="Presets" defaultOpen={!selectedNode}>
        <div className="space-y-1.5">
          <button
            onClick={() => { context.setProblem(createDefaultGameTreeProblem()); context.markProblemChanged('scenario:default'); }}
            className="ui-btn w-full justify-start gap-2 rounded-md px-2 py-1.5 text-[11px]"
            title="Start over with the small starter tree"
          >
            <RotateCcw size={12} />
            Starter Tree
          </button>
          {CUSTOM_TREE_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => { context.setProblem(getCustomTreeScenario(scenario.id)); context.markProblemChanged(`scenario:${scenario.id}`); }}
              className="ui-btn w-full justify-start rounded-md px-2 py-1.5 text-[11px]"
              title={scenario.description}
            >
              {scenario.name}
            </button>
          ))}
        </div>
      </ConfigSection>

      <ConfigSection title="Tree Summary">
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Nodes" value={String(nodes.length)} compact className="text-center" />
          <StatTile label="Edges" value={String(edges.length)} compact className="text-center" />
        </div>
        {validation.valid ? (
          <p className="mt-2 text-[10px] text-[var(--success,#3FB950)]">Tree is valid — ready to run.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[11px] text-[var(--danger,#FF7B72)] list-disc pl-4">
            {validation.errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        )}
      </ConfigSection>

      {selectedNode ? (
        <ConfigSection title={`Node: ${selectedNode.id}${selectedNode.id === rootId ? ' (root)' : ''}`}>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Type</p>
              <Select
                value={selectedNode.kind}
                onValueChange={(value) => {
                  const kind = value as GameTreeNodeKind;
                  updateNode(selectedNode.id, kind === 'terminal' ? { kind, value: selectedNode.value ?? 0 } : { kind, value: undefined });
                }}
                options={KIND_OPTIONS}
              />
            </div>

            {selectedNode.kind === 'terminal' && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Value</p>
                <input
                  type="number"
                  value={selectedNode.value ?? 0}
                  onChange={(e) => updateNode(selectedNode.id, { value: Number(e.target.value) })}
                  className="ui-input w-full px-2 py-1.5 font-mono"
                />
              </div>
            )}

            {selectedNode.kind === 'chance' && childEdges.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Child Probabilities</p>
                  <span className="text-[10px] font-mono text-[var(--text-3)]">Σ={probabilitySum.toFixed(2)}</span>
                </div>
                <div className="space-y-1.5">
                  {childEdges.map((edge) => (
                    <div key={edge.id} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-[11px] text-[var(--text-2)]">
                        {edge.moveLabel || nodes.find((n) => n.id === edge.target)?.label || edge.target}
                      </span>
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={edge.probability ?? ''}
                        placeholder="uniform"
                        onChange={(e) => updateEdge(edge.id, { probability: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="ui-input w-20 px-2 py-1 font-mono"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const total = childEdges.reduce((sum, e) => sum + (e.probability ?? 0), 0);
                    if (total <= 0) {
                      // All blank/zero → distribute uniformly instead of zeroing out.
                      childEdges.forEach((e) => updateEdge(e.id, { probability: 1 / childEdges.length }));
                    } else {
                      childEdges.forEach((e) => updateEdge(e.id, { probability: (e.probability ?? 0) / total }));
                    }
                  }}
                  className="ui-btn mt-2 h-7 w-full rounded-md text-[10px]"
                >
                  Normalize to sum to 1
                </button>
              </div>
            )}

            <p className="text-[10px] text-[var(--text-3)] leading-relaxed">
              Tip: right-click any node on the canvas to change its type or set the root; double-click a leaf to edit its value.
            </p>
          </div>
        </ConfigSection>
      ) : (
        <ConfigSection title="Node Inspector" defaultOpen={false}>
          <p className="text-[11px] text-[var(--text-3)]">Select a node on the canvas to edit its type, value, or probabilities.</p>
        </ConfigSection>
      )}
    </ProblemConfigurator>
  );
}

export function renderCustomTreeConfigPanel(context: GameLabContext) {
  return <CustomTreeConfigPanel context={context} />;
}

export function renderCustomTreeTabs(context: GameLabContext): TabDefinition[] {
  return [
    { id: 'tree', label: 'Problem View', content: <ProblemViewTab context={context} />, keepMounted: true },
    { id: 'search-tree', label: 'Search Tree', content: <SearchTreeTab context={context} /> },
  ];
}

function CustomTreeTitleActions({ context }: { context: GameLabContext }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyShareLink = useCallback(async () => {
    try {
      const store = useTreeEditorStore.getState();
      const token = serializeGameTree(new GameTree({ nodes: store.nodes, edges: store.edges, rootId: store.rootId }));
      const url = toAbsoluteAppUrl(`play/custom-tree/${context.algorithmId}?t=${encodeURIComponent(token)}`);
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1200);
  }, [context.algorithmId]);

  return (
    <TitleBarActionGroup>
      <TitleBarActionButton
        onClick={copyShareLink}
        icon={<Copy size={12} />}
        label={copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy Failed' : 'Share Tree'}
        title="Copy a shareable link to this tree"
      />
    </TitleBarActionGroup>
  );
}

export function renderCustomTreeTitleActions(context: GameLabContext) {
  return <CustomTreeTitleActions context={context} />;
}
