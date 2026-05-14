import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserIdFromDBToken } from "@/lib/auth/db-tokens";

type CreateCellBody = {
    row: number;
    col: number;
    value: string | null;
    formula: string | null;
};

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tableId = Number(id);
        if (!Number.isFinite(tableId)) {
            return NextResponse.json(
                { error: "Invalid table id" },
                { status: 400 }
            );
        }

        // Get user ID from database token (using session ID cookie)
        const userId = await getUserIdFromDBToken();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const contentType = request.headers.get("content-type") || "";
        let row: number | undefined;
        let col: number | undefined;
        let value: string | null | undefined;
        let formula: string | null | undefined;
        if (contentType.includes("application/json")) {
            const body: CreateCellBody = await request.json();
            row = Number(body?.row);
            col = Number(body?.col);
            const v = body.value;
            value = v === null ? null : String(v);
            const f = body.formula;
            formula = f === null ? null : String(f);
        } else {
            const form = await request.formData();
            row = Number(form.get("row"));
            col = Number(form.get("col"));
            const v = form.get("value");
            value = v === null ? null : String(v);
            const f = form.get("formula");
            formula = f === null ? null : String(f);
        }

        if (!Number.isFinite(row!) || !Number.isFinite(col!)) {
            return NextResponse.json(
                { error: "row and col are required numbers" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data: table, error: tableError } = await supabase
            .from("tables")
            .select("id, user_id")
            .eq("id", tableId)
            .single();

        if (tableError || !table || table.user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Optimization: only store when has data; otherwise skip
        const hasContent =
            (value !== null && value !== "") ||
            (formula !== null && formula !== "");
        if (!hasContent) {
            return NextResponse.json(
                { ok: true, skipped: true },
                { status: 204 }
            );
        }

        const { data, error } = await supabase
            .from("table_cells")
            .insert({
                table_id: tableId,
                row_index: row,
                column_index: col,
                value,
                formula,
            })
            .select(
                "id, created_at, table_id, row_index, column_index, value, formula"
            )
            .single();

        if (error) {
            return NextResponse.json(
                { error: "Failed to create cell" },
                { status: 500 }
            );
        }

        return NextResponse.json({ cell: data }, { status: 201 });
    } catch {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tableId = Number(id);
        if (!Number.isFinite(tableId)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        // Get user ID from database token (using session ID cookie)
        const userId = await getUserIdFromDBToken();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const supabase = await createClient();
        // Ownership already validated above via token; ensure table belongs to user
        const { data: table, error: tableErr } = await supabase
            .from("tables")
            .select("id, user_id")
            .eq("id", tableId)
            .single();

        // If the table does not exist, respond with an empty cells array rather than an error
        if (tableErr || !table) {
            return NextResponse.json({ cells: [] }, { status: 200 });
        }

        // The table exists but belongs to a different user – keep the original 404 behaviour to avoid data leaks
        if (table.user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const { data, error } = await supabase
            .from("table_cells")
            .select(
                "id, created_at, table_id, row_index, column_index, value, formula"
            )
            .eq("table_id", tableId);

        if (error) {
            console.warn("[cells:get] fetch_error", { tableId, error });
            return NextResponse.json({ cells: [] }, { status: 200 });
        }

        return NextResponse.json({ cells: data ?? [] }, { status: 200 });
    } catch (e) {
        console.error("[cells:get] unexpected_error", e);
        return NextResponse.json(
            {
                error: "Unexpected error",
                details: e instanceof Error ? e.message : String(e),
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tableId = Number(id);
        if (!Number.isFinite(tableId)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        // Get user ID from database token (using session ID cookie)
        const userId = await getUserIdFromDBToken();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        console.log("[cells:patch] request received", { tableId, userId });

        const contentType = request.headers.get("content-type") || "";
        let value: string | null | undefined;
        let formula: string | null | undefined;
        let row: number | undefined;
        let col: number | undefined;
        if (contentType.includes("application/json")) {
            const body: {
                value: string | null;
                formula: string | null;
                row: number;
                col: number;
            } = await request.json();
            value = body.value;
            formula = body.formula;
            row = Number(body.row);
            col = Number(body.col);
        } else {
            const form = await request.formData();
            value =
                form.get("value") === null ? null : String(form.get("value"));
            formula =
                form.get("formula") === null
                    ? null
                    : String(form.get("formula"));
            row = Number(form.get("row"));
            col = Number(form.get("col"));
        }

        if (!Number.isFinite(row!) || !Number.isFinite(col!)) {
            return NextResponse.json(
                { error: "row and col are required numbers" },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        // Check ownership of table
        const { data: table, error: tableError } = await supabase
            .from("tables")
            .select("id, user_id")
            .eq("id", tableId)
            .single();
        if (tableError || !table || table.user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const hasContent =
            (value !== null && value !== undefined && value !== "") ||
            (formula !== null && formula !== undefined && formula !== "");

        if (!hasContent) {
            // Delete the cell if clearing content
            const { error } = await supabase
                .from("table_cells")
                .delete()
                .eq("table_id", tableId)
                .eq("row_index", row)
                .eq("column_index", col);
            if (error) {
                return NextResponse.json(
                    { error: "Failed to clear cell" },
                    { status: 500 }
                );
            }
            return NextResponse.json(
                { ok: true, deleted: true },
                { status: 200 }
            );
        }

        // Try update first
        const { data: updated, error: updateErr } = await supabase
            .from("table_cells")
            .update({ value, formula })
            .eq("table_id", tableId)
            .eq("row_index", row)
            .eq("column_index", col)
            .select(
                "id, created_at, table_id, row_index, column_index, value, formula"
            )
            .maybeSingle();

        if (updateErr) {
            console.error("[cells:patch] update_error", {
                tableId,
                row,
                col,
                error: updateErr,
            });
        }

        if (!updateErr && updated) {
            console.log("[cells:patch] cell updated successfully", {
                tableId,
                row,
                col,
            });
            return NextResponse.json({ cell: updated }, { status: 200 });
        }

        // If nothing updated, insert new
        console.log("[cells:patch] no existing cell found, inserting new", {
            tableId,
            row,
            col,
        });
        // If insert fails due to unique constraint, try update again
        let inserted;
        let insertErr;
        const insertResult = await supabase
            .from("table_cells")
            .insert({
                table_id: tableId,
                row_index: row,
                column_index: col,
                value,
                formula,
            })
            .select(
                "id, created_at, table_id, row_index, column_index, value, formula"
            )
            .single();

        inserted = insertResult.data;
        insertErr = insertResult.error;

        // If insert failed, it might be due to unique constraint - try update again
        if (insertErr) {
            console.warn("[cells:patch] insert_failed_trying_update", {
                tableId,
                row,
                col,
                error: insertErr,
            });

            // Try update one more time in case the cell was created between our first update and insert
            const { data: updated2, error: updateErr2 } = await supabase
                .from("table_cells")
                .update({ value, formula })
                .eq("table_id", tableId)
                .eq("row_index", row)
                .eq("column_index", col)
                .select(
                    "id, created_at, table_id, row_index, column_index, value, formula"
                )
                .single();

            if (!updateErr2 && updated2) {
                console.log("[cells:patch] cell updated on retry", {
                    tableId,
                    row,
                    col,
                });
                return NextResponse.json({ cell: updated2 }, { status: 200 });
            }

            // If update also failed, return the original insert error
            console.error("[cells:patch] both_insert_and_update_failed", {
                insertError: insertErr,
                updateError: updateErr2,
            });
        }

        if (insertErr) {
            console.error("[cells:patch] insert_error", {
                tableId,
                row,
                col,
                error: insertErr,
                message: insertErr.message,
                details: insertErr.details,
            });
            return NextResponse.json(
                {
                    error: "Failed to save cell",
                    details: insertErr.message || String(insertErr),
                },
                { status: 500 }
            );
        }

        console.log("[cells:patch] cell inserted successfully", {
            tableId,
            row,
            col,
        });
        return NextResponse.json({ cell: inserted }, { status: 200 });
    } catch (e) {
        console.error("[cells:patch] unexpected_error", e);
        return NextResponse.json(
            {
                error: "Unexpected error",
                details: e instanceof Error ? e.message : String(e),
            },
            { status: 500 }
        );
    }
}
