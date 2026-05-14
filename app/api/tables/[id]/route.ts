import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { createClient } from "@/lib/supabase/server";
import { getUserIdFromDBToken } from "@/lib/auth/db-tokens";

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
        const { data, error } = await supabase
            .from("tables")
            .select("id, created_at, user_id, name")
            .eq("id", tableId)
            .eq("user_id", userId)
            .single();

        if (error) {
            return NextResponse.json(
                { error: "Failed to get" },
                { status: 500 }
            );
        }

        return NextResponse.json({ table: data }, { status: 200 });
    } catch {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
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
        const { error } = await supabase
            .from("tables")
            .delete()
            .eq("id", tableId)
            .eq("user_id", userId);

        if (error) {
            return NextResponse.json(
                { error: "Failed to delete" },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}

type UpdateTableBody = {
    name?: string;
};

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

        const contentType = request.headers.get("content-type") || "";
        let name: string | undefined;
        if (contentType.includes("application/json")) {
            const body: UpdateTableBody = await request.json();
            name = body?.name?.trim();
        } else {
            const form = await request.formData();
            name = String(form.get("name") || "").trim();
        }

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("tables")
            .update({ name })
            .eq("id", tableId)
            .eq("user_id", userId)
            .select("id, created_at, user_id, name")
            .single();

        if (error) {
            return NextResponse.json(
                { error: "Failed to update" },
                { status: 500 }
            );
        }

        return NextResponse.json({ table: data }, { status: 200 });
    } catch {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}
