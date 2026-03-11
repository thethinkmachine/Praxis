import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';
import { Check, ChevronDown, Copy, Database, Download, FolderOpen, Save, Upload, X } from '@/components/shared/Icons';
import { useProblemImportExport } from '@/hooks/useProblemImportExport';
import { useSavedProblemsStore } from '@/store/savedProblems.store';
import type { ProblemCategory } from '@/types/problem';
import { dropdownMenuContentClass, dropdownMenuItemClass, dropdownMenuLabelClass } from '@/components/shared/DropdownActionMenu';

interface ProblemImportExportButtonProps {
    problem: unknown;
    algorithmId: string;
    onImport: (problem: unknown) => void;
    problemCategory: ProblemCategory;
    /** When provided, renders a "Load Demo..." item at the top of the dropdown. */
    onDemoRequest?: () => void;
}

export default function ProblemImportExportButton({
    problem,
    algorithmId,
    onImport,
    problemCategory,
    onDemoRequest,
}: ProblemImportExportButtonProps) {
    const [open, setOpen] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleError = useCallback((msg: string) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(null), 4000);
    }, []);

    const { exportProblem, importProblem } = useProblemImportExport(
        problem,
        algorithmId,
        onImport,
        handleError,
    );

    const allProblems = useSavedProblemsStore((s) => s.problems);
    const saved = useMemo(
        () => allProblems.filter((p) => p.category === problemCategory),
        [allProblems, problemCategory],
    );
    const saveProblem = useSavedProblemsStore((s) => s.saveProblem);
    const deleteProblem = useSavedProblemsStore((s) => s.deleteProblem);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [naming, setNaming] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (naming) {
            // Focus the input after render
            nameInputRef.current?.focus();
        }
    }, [naming]);

    function handleSaveStart() {
        setNaming(true);
        setNameInput('');
    }

    function handleSaveConfirm() {
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        saveProblem(trimmed, problemCategory, problem);
        setNaming(false);
        setNameInput('');
        setOpen(false);
    }

    function handleSaveKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSaveConfirm();
        if (e.key === 'Escape') {
            setNaming(false);
            setNameInput('');
        }
    }

    function handleLoad(id: string) {
        const entry = saved.find((p) => p.id === id);
        if (entry) onImport(entry.problem);
    }

    function handleDelete(e: React.MouseEvent, id: string) {
        e.preventDefault();
        e.stopPropagation();
        if (confirmDelete === id) {
            deleteProblem(id);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(id);
        }
    }

    return (
        <>
            <DropdownMenu.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirmDelete(null); setNaming(false); } }}>
                <DropdownMenu.Trigger asChild>
                    <button
                        className={cn(
                            'ui-btn h-7 rounded-lg px-2.5 text-[11px]',
                        )}
                        aria-label="Problem actions"
                    >
                        <Database size={12} />
                        Problem
                        <ChevronDown size={12} className="text-[var(--text-3)]" />
                    </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        className={dropdownMenuContentClass('min-w-[220px]')}
                        sideOffset={4}
                        align="end"
                    >
                        {/* Load Demo — only shown when consumer provides the callback */}
                        {onDemoRequest && (
                            <>
                                <DropdownMenu.Item
                                    onSelect={() => { setOpen(false); onDemoRequest(); }}
                                    className={dropdownMenuItemClass()}
                                >
                                    <FolderOpen size={12} className="shrink-0" />
                                    Browse Demo Problems
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                            </>
                        )}

                        {/* Save — inline input or trigger */}
                        {naming ? (
                            <div
                                className="flex items-center gap-1 px-2 py-1.5"
                                onKeyDown={(e) => e.stopPropagation()}
                            >
                                <input
                                    ref={nameInputRef}
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={handleSaveKeyDown}
                                    placeholder="Problem name..."
                                    className="ui-input flex-1 text-xs px-2 py-1"
                                    aria-label="Problem name"
                                />
                                <button
                                    onClick={handleSaveConfirm}
                                    disabled={!nameInput.trim()}
                                    className="ui-btn ui-btn-active h-7 rounded-md px-2 text-xs"
                                >
                                    <Check size={12} />
                                    Save
                                </button>
                            </div>
                        ) : (
                            <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); handleSaveStart(); }} className={dropdownMenuItemClass()}>
                                <Save size={12} className="shrink-0" />
                                Save Problem
                            </DropdownMenu.Item>
                        )}

                        <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

                        {/* Load saved */}
                        <DropdownMenu.Label className={dropdownMenuLabelClass()}>
                            Saved
                        </DropdownMenu.Label>

                        {saved.length === 0 ? (
                            <DropdownMenu.Item disabled className="px-3 py-1.5 text-xs text-[var(--text-3)] italic outline-none">
                                No saved problems
                            </DropdownMenu.Item>
                        ) : (
                            saved.map((sp) => (
                                <div
                                    key={sp.id}
                                    className="flex items-center justify-between hover:bg-[var(--accent)]/10"
                                >
                                    <DropdownMenu.Item
                                        onSelect={() => handleLoad(sp.id)}
                                        className="flex-1 truncate px-3 py-1.5 text-xs text-[var(--text)] hover:text-[var(--accent)] cursor-pointer outline-none"
                                    >
                                        {sp.name}
                                    </DropdownMenu.Item>
                                    <button
                                        onClick={(e) => handleDelete(e, sp.id)}
                                        className={cn(
                                            'shrink-0 text-[10px] px-1 rounded mr-3 inline-flex items-center justify-center',
                                            confirmDelete === sp.id
                                                ? 'text-[var(--danger)] bg-[var(--danger)]/10'
                                                : 'text-[var(--text-3)] hover:text-[var(--danger)]',
                                        )}
                                        title={confirmDelete === sp.id ? 'Click again to confirm' : 'Delete'}
                                    >
                                        {confirmDelete === sp.id ? 'confirm?' : <X size={11} />}
                                    </button>
                                </div>
                            ))
                        )}

                        <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

                        {/* Import / Export */}
                        <DropdownMenu.Item onSelect={exportProblem} className={dropdownMenuItemClass()}>
                            <Download size={12} className="shrink-0" />
                            Export Problem JSON
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={importProblem} className={dropdownMenuItemClass()}>
                            <Upload size={12} className="shrink-0" />
                            Import Problem JSON
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Error toast */}
            {errorMsg && (
                <div
                    role="alert"
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-xs text-[var(--danger)] shadow-lg"
                >
                    {errorMsg}
                </div>
            )}
        </>
    );
}
