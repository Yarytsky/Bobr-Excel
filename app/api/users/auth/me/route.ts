import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getAccessTokenFromDB } from "@/lib/auth/db-tokens";

export async function GET() {
    // Get token from database using session ID
    const cookieStore = await (await import("next/headers")).cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    console.log("[me] checking session", { hasSessionId: !!sessionId, sessionId });
    
    const token = await getAccessTokenFromDB();
    if (!token) {
        console.log("[me] no token found", { sessionId });
        return NextResponse.json(
            { error: "Unauthorized", user: null },
            { status: 401 }
        );
    }
    
    console.log("[me] token found, verifying", { tokenPreview: token.substring(0, 20) + "..." });

    try {
        const payload = verifyToken<{
            sub: string | number;
            username: string;
            type: "access" | "refresh";
        }>(token);
        if (payload.type !== "access") {
            return NextResponse.json(
                { error: "Unauthorized", user: null },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { user: { id: payload.sub, username: payload.username } },
            { status: 200 }
        );
    } catch {
        return NextResponse.json(
            { error: "Unauthorized", user: null },
            { status: 401 }
        );
    }
}
