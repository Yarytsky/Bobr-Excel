/**
 * Convert column index to letter (0 -> A, 25 -> Z, 26 -> AA)
 */
export function colToLetter(col: number): string {
    let result = "";
    col += 1; // 1-indexed
    while (col > 0) {
        col -= 1;
        result = String.fromCharCode(65 + (col % 26)) + result;
        col = Math.floor(col / 26);
    }
    return result;
}

/**
 * Convert letter to column index (A -> 0, Z -> 25, AA -> 26)
 */
export function letterToCol(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1; // 0-indexed
}

/**
 * Parse cell reference (e.g., "A1" -> {row: 0, col: 0})
 */
export function parseCellRef(ref: string): { row: number; col: number } | null {
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    const col = letterToCol(match[1].toUpperCase());
    const row = parseInt(match[2], 10) - 1; // Convert to 0-indexed
    return { row, col };
}

/**
 * Extract all cell references from a formula
 */
export function extractCellRefs(formula: string): string[] {
    const refs: string[] = [];
    const regex = /([A-Z]+[0-9]+)/gi;
    let match;
    while ((match = regex.exec(formula)) !== null) {
        refs.push(match[1].toUpperCase());
    }
    return [...new Set(refs)]; // Remove duplicates
}

/**
 * Check if input is a formula
 */
export function isFormula(input: string): boolean {
    return input.trim().startsWith("=");
}

/**
 * Evaluate a simple formula
 * @param formula - The formula string (without = sign)
 * @param getCellValue - Function to get cell value by row/col
 * @param visited - Set of visited cells to detect circular references
 */
export function evaluateFormula(
    formula: string,
    getCellValue: (row: number, col: number) => string | null,
    visited: Set<string> = new Set()
): string | null {
    try {
        // Remove the = sign if present
        let expr = formula.trim();
        if (expr.startsWith("=")) {
            expr = expr.substring(1).trim();
        }

        if (!expr) return null;

        // Handle basic functions
        // SUM(range) - e.g., SUM(A1:A5)
        const sumMatch = expr.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
        if (sumMatch) {
            const start = parseCellRef(sumMatch[1]);
            const end = parseCellRef(sumMatch[2]);
            if (start && end) {
                let sum = 0;
                for (let r = start.row; r <= end.row; r++) {
                    for (let c = start.col; c <= end.col; c++) {
                        const val = getCellValue(r, c);
                        const num = val ? parseFloat(val) : 0;
                        if (!isNaN(num)) sum += num;
                    }
                }
                return String(sum);
            }
        }

        // AVERAGE(range) - e.g., AVERAGE(A1:A5)
        const avgMatch = expr.match(/^AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
        if (avgMatch) {
            const start = parseCellRef(avgMatch[1]);
            const end = parseCellRef(avgMatch[2]);
            if (start && end) {
                let sum = 0;
                let count = 0;
                for (let r = start.row; r <= end.row; r++) {
                    for (let c = start.col; c <= end.col; c++) {
                        const val = getCellValue(r, c);
                        const num = val ? parseFloat(val) : 0;
                        if (!isNaN(num)) {
                            sum += num;
                            count++;
                        }
                    }
                }
                return count > 0 ? String(sum / count) : "0";
            }
        }

        // Replace cell references with their values
        let evaluated = expr;
        const cellRefs = extractCellRefs(expr);

        for (const ref of cellRefs) {
            const cell = parseCellRef(ref);
            if (!cell) continue;

            // Check for circular reference
            const cellKey = `${cell.row}:${cell.col}`;
            if (visited.has(cellKey)) {
                return "#CIRCULAR!";
            }

            const newVisited = new Set(visited);
            newVisited.add(cellKey);

            const value = getCellValue(cell.row, cell.col);

            // If the referenced cell has a formula, evaluate it
            // This is handled by the getCellValue function in the component
            const numValue = value ? parseFloat(value) : 0;

            // Replace all occurrences of this cell reference
            const regex = new RegExp(ref, "gi");
            evaluated = evaluated.replace(
                regex,
                String(isNaN(numValue) ? 0 : numValue)
            );
        }

        // Evaluate the expression safely
        // Only allow basic math operations
        const sanitized = evaluated.replace(/[^0-9+\-*/().\s]/g, "");
        if (sanitized !== evaluated) {
            return "#ERROR!";
        }

        try {
            // Use Function constructor for safer evaluation
            const result = Function(`"use strict"; return (${sanitized})`)();
            if (typeof result === "number") {
                return isNaN(result) || !isFinite(result)
                    ? "#ERROR!"
                    : String(result);
            }
            return "#ERROR!";
        } catch {
            return "#ERROR!";
        }
    } catch {
        return "#ERROR!";
    }
}
