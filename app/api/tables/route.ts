import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { createClient } from "@/lib/supabase/server";
import { getUserIdFromDBToken } from "@/lib/auth/db-tokens";

type CreateTableBody = {
    name: string;
};

export async function POST(request: Request) {
    try {
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
            const body: CreateTableBody = await request.json();
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
            .insert({ name, user_id: userId })
            .select("id, created_at, user_id, name")
            .single();

        if (error) {
            return NextResponse.json(
                { error: "Failed to create table" },
                { status: 500 }
            );
        }

        return NextResponse.json({ table: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
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
            .eq("user_id", userId);

        if (error) {
            return NextResponse.json(
                { error: "Failed to get tables" },
                { status: 500 }
            );
        }

        return NextResponse.json({ tables: data }, { status: 200 });
    } catch (e) {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}

type DeleteTablesBody = {
    ids: number[];
};

export async function DELETE(request: Request) {
    try {
        // Get user ID from database token (using session ID cookie)
        const userId = await getUserIdFromDBToken();
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const contentType = request.headers.get("content-type") || "";
        let ids: number[] | undefined;
        if (contentType.includes("application/json")) {
            const body: DeleteTablesBody = await request.json();
            ids = Array.isArray(body?.ids)
                ? body.ids
                      .map((n) => Number(n))
                      .filter((n) => Number.isFinite(n))
                : undefined;
        } else {
            const form = await request.formData();
            const raw = form.get("ids");
            if (typeof raw === "string") {
                ids = raw
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n));
            }
        }

        if (!ids || ids.length === 0) {
            return NextResponse.json(
                { error: "ids array is required" },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from("tables")
            .delete()
            .in("id", ids)
            .eq("user_id", userId);

        if (error) {
            return NextResponse.json(
                { error: "Failed to delete tables" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { ok: true, deletedIds: ids },
            { status: 200 }
        );
    } catch (e) {
        return NextResponse.json(
            { error: "Unexpected error" },
            { status: 500 }
        );
    }
}
