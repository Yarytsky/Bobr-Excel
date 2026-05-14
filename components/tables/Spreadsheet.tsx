"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    isFormula,
    evaluateFormula,
    extractCellRefs,
} from "@/lib/spreadsheet/formula";

interface Cell {
    row: number;
    col: number;
    value: string | null;
    formula: string | null;
}

interface SpreadsheetProps {
    tableId: number;
    initialCells?: Cell[];
}

function cellKey(r: number, c: number) {
    return `${r}:${c}`;
}

export default function Spreadsheet({
    tableId,
    initialCells,
}: SpreadsheetProps) {
    const router = useRouter();
    const [cells, setCells] = useState<Record<string, Cell>>({});
    const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [rows] = useState<number>(50);
    const [cols] = useState<number>(26); // A-Z
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const cellsRef = useRef<Record<string, Cell>>({});

    // Keep cellsRef in sync with cells state
    useEffect(() => {
        cellsRef.current = cells;
    }, [cells]);

    // Helper function to recalculate formulas based on current cell state
    const recalculateFormulas = (currentCells: Record<string, Cell>) => {
        const updated = { ...currentCells };
        let changed = false;

        // Get all cells with formulas
        const formulaCells = Object.entries(currentCells).filter(
            ([_, cell]) => cell.formula
        );

        // Re-evaluate each formula
        formulaCells.forEach(([key, cell]) => {
            // Create a getter that uses current cell values
            const getCellValueForEval = (
                r: number,
                col: number
            ): string | null => {
                const k = cellKey(r, col);
                const cellData = updated[k];
                if (!cellData) return null;

                // If referenced cell has a formula, get its current value
                // (which should be the last evaluated result)
                return cellData.value;
            };

            const evaluatedValue = evaluateFormula(
                cell.formula!,
                getCellValueForEval
            );

            // Only update if the value actually changed
            if (evaluatedValue !== cell.value) {
                updated[key] = {
                    ...cell,
                    value: evaluatedValue,
                };
                changed = true;
            }
        });

        if (changed) {
            setCells(updated);
        }
    };

    // Load initial cells once when provided
    useEffect(() => {
        if (!initialCells || initialCells.length === 0) return;
        const map: Record<string, Cell> = {};
        initialCells.forEach((c) => {
            map[cellKey(c.row, c.col)] = c;
        });
        setCells(map);
        cellsRef.current = map;

        // Evaluate formulas after loading
        setTimeout(() => {
            recalculateFormulas(map);
        }, 0);

        setLoading(false);
    }, [initialCells]);

    // Fetch latest cells from server on mount if not provided
    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return; // guard against Strict-Mode double invoke
        didFetchRef.current = true;
        if (initialCells && initialCells.length > 0) {
            setLoading(false);
            return;
        }
        const fetchCells = async () => {
            try {
                const res = await fetch(`/api/tables/${tableId}/cells`, {
                    cache: "no-store",
                });
                const data = await res.json();
                if (!res.ok)
                    throw new Error(data?.error || "Failed to load cells");
                const map: Record<string, Cell> = {};
                (data.cells as any[]).forEach((c: any) => {
                    map[
                        cellKey(
                            c.row_index ?? c.row,
                            c.column_index ?? c.col_index ?? c.col
                        )
                    ] = {
                        row: c.row_index ?? c.row,
                        col: c.column_index ?? c.col_index ?? c.col,
                        value: c.value,
                        formula: c.formula,
                    } as Cell;
                });
                setCells(map);
                cellsRef.current = map;

                // Evaluate formulas after loading
                setTimeout(() => {
                    recalculateFormulas(map);
                }, 0);
            } catch (e) {
                console.error("[Spreadsheet] load error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchCells();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableId]);

    const handleBlur = async (r: number, c: number, text: string) => {
        const key = cellKey(r, c);
        const trimmedText = text.trim();
        const prevCell = cells[key];
        const prevValue = prevCell?.formula || prevCell?.value || "";

        // Check if value actually changed
        if (trimmedText === prevValue) {
            setEditingCell(null);
            return;
        }

        setDirtyKeys((ks) => new Set(ks).add(key));
        setEditingCell(null);

        // Check if it's a formula
        if (isFormula(trimmedText)) {
            const formula = trimmedText;

            // Evaluate the formula using current cell state
            const evaluatedValue = evaluateFormula(
                formula,
                (row: number, col: number) => {
                    const k = cellKey(row, col);
                    const cellData = cellsRef.current[k];
                    // If referenced cell has a formula, return its evaluated value
                    // Otherwise return the raw value
                    return cellData?.value ?? null;
                }
            );

            // Update with both formula and evaluated value
            setCells((prevCells) => {
                const updated = {
                    ...prevCells,
                    [key]: {
                        row: r,
                        col: c,
                        value: evaluatedValue,
                        formula: formula,
                    },
                };

                // Recalculate all formulas after updating this one
                // Use setTimeout to ensure state update completes first
                setTimeout(() => {
                    recalculateFormulas(updated);
                }, 0);

                return updated;
            });
        } else {
            // Regular value (not a formula)
            setCells((prevCells) => {
                const updated = {
                    ...prevCells,
                    [key]: {
                        row: r,
                        col: c,
                        value: trimmedText || null,
                        formula: null,
                    },
                };

                // Recalculate formulas that might depend on this cell
                setTimeout(() => {
                    recalculateFormulas(updated);
                }, 0);

                return updated;
            });
        }
    };

    const handleFocus = (
        r: number,
        c: number,
        e: React.FocusEvent<HTMLTextAreaElement>
    ) => {
        const key = cellKey(r, c);
        setEditingCell(key);
        const cell = cells[key];
        // Show formula when editing, value when viewing
        if (cell?.formula) {
            e.currentTarget.value = cell.formula;
        }
    };

    const handleSave = async () => {
        if (dirtyKeys.size === 0 || saving) return;
        setSaving(true);
        const dirtyKeysArray = Array.from(dirtyKeys);
        console.log("[Spreadsheet] Saving cells:", dirtyKeysArray.length);

        try {
            const results = await Promise.allSettled(
                dirtyKeysArray.map(async (k) => {
                    const [rStr, cStr] = k.split(":");
                    const r = Number(rStr);
                    const c = Number(cStr);
                    const cell = cells[k];
                    const val = cell?.value ?? "";
                    const formula = cell?.formula || null;

                    const response = await fetch(
                        `/api/tables/${tableId}/cells`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                row: r,
                                col: c,
                                value: val === "" ? null : val,
                                formula: formula,
                            }),
                        }
                    );

                    if (!response.ok) {
                        const errorData = await response
                            .json()
                            .catch(() => ({}));
                        throw new Error(
                            errorData.error || `Failed to save cell ${r}:${c}`
                        );
                    }

                    return { key: k, success: true };
                })
            );

            // Check for failures
            const failures = results.filter((r) => r.status === "rejected");
            if (failures.length > 0) {
                console.error(
                    "[Spreadsheet] Some cells failed to save:",
                    failures
                );
                failures.forEach((f) => {
                    if (f.status === "rejected") {
                        console.error("[Spreadsheet] Save error:", f.reason);
                    }
                });
                // Don't clear dirtyKeys if there were failures
                alert(
                    `Failed to save ${failures.length} cell(s). Please try again.`
                );
                return;
            }

            // All succeeded
            console.log("[Spreadsheet] All cells saved successfully");
            setDirtyKeys(new Set());
        } catch (e) {
            console.error("[Spreadsheet] bulk save error", e);
            alert("Failed to save cells. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const renderHeader = () => {
        const letters = Array.from({ length: cols }, (_, i) =>
            String.fromCharCode(65 + i)
        );
        return (
            <TableRow>
                <TableHead className="w-8" />
                {letters.map((l) => (
                    <TableHead key={l} className="w-20 text-center">
                        {l}
                    </TableHead>
                ))}
            </TableRow>
        );
    };

    const renderRows = () => {
        const rowsArr = Array.from({ length: rows }, (_, i) => i);
        return rowsArr.map((r) => (
            <TableRow key={r}>
                <TableHead className="w-8 text-center">{r + 1}</TableHead>
                {Array.from({ length: cols }, (_, c) => {
                    const key = cellKey(r, c);
                    const cell = cells[key];
                    const isEditing = editingCell === key;

                    // Show formula when editing, calculated result when viewing
                    const displayValue =
                        isEditing && cell?.formula
                            ? cell.formula
                            : cell?.value ?? "";

                    return (
                        <TableCell key={c} className="p-0 w-20 relative">
                            <textarea
                                key={`${key}-${isEditing ? "edit" : "view"}-${
                                    cell?.value || ""
                                }`} // Force re-render when value changes or switching modes
                                ref={textareaRef}
                                defaultValue={displayValue}
                                onBlur={(e) =>
                                    handleBlur(r, c, e.currentTarget.value)
                                }
                                onFocus={(e) => handleFocus(r, c, e)}
                                className="w-full h-full resize-none p-1 focus:outline-none border-0"
                                rows={1}
                                style={{
                                    // Visual indicator for formula cells - light blue background
                                    backgroundColor:
                                        cell?.formula && !isEditing
                                            ? "#f0f9ff"
                                            : "transparent",
                                }}
                            />
                            {/* Small formula indicator icon when not editing - shows it's a formula */}
                            {!isEditing && cell?.formula && (
                                <div
                                    className="absolute top-0 right-0 text-[8px] text-blue-500 px-1 pointer-events-none font-bold z-10"
                                    title={`Formula: ${cell.formula}`}
                                >
                                    =
                                </div>
                            )}
                        </TableCell>
                    );
                })}
            </TableRow>
        ));
    };

    const renderSkeletonRows = () => {
        const rowsArr = Array.from({ length: rows }, (_, i) => i);
        return rowsArr.map((r) => (
            <TableRow key={r}>
                <TableHead className="w-8 text-center">{r + 1}</TableHead>
                {Array.from({ length: cols }, (_, c) => (
                    <TableCell key={c} className="p-0 w-20">
                        <div className="h-6 w-full bg-gray-200 animate-pulse rounded" />
                    </TableCell>
                ))}
            </TableRow>
        ));
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                        ← Back
                    </button>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
                        Edit mode
                    </span>
                </div>
                <button
                    onClick={handleSave}
                    disabled={dirtyKeys.size === 0 || saving || loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save changes"}
                </button>
            </div>
            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
                <Table className="select-none">
                    <TableHeader>{renderHeader()}</TableHeader>
                    <TableBody>
                        {loading ? renderSkeletonRows() : renderRows()}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
