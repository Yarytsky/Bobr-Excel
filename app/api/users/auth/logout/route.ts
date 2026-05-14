import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { createClient } from "@/lib/supabase/server";
import { getAccessTokenFromDB, getRefreshTokenFromDB } from "@/lib/auth/db-tokens";

export async function POST() {
    const supabase = await createClient();
    const cookieStore = await (await import("next/headers")).cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    // Delete session from database
    if (sessionId) {
        try {
            // Get user ID from session before deleting
            const accessToken = await getAccessTokenFromDB();
            if (accessToken) {
            const { decodeToken } = await import("@/lib/auth/jwt");
                const payload = decodeToken<{ sub?: string | number }>(accessToken);
            if (payload?.sub) {
                    // Clear refresh token from users table
                await supabase
                    .from("users")
                    .update({
                        refresh_token: null,
                        refresh_token_expires_at: null,
                    })
                    .eq("id", Number(payload.sub));
            }
            }
            
            // Delete session from sessions table
            await supabase.from("sessions").delete().eq("id", Number(sessionId));
        } catch (error) {
            console.error("[logout] error", error);
        }
    }

    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
}
