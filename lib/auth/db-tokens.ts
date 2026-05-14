import { createClient } from "@/lib/supabase/server";
import { verifyToken } from "./jwt";
import { cookies } from "next/headers";

/**
 * Get access token from database using session ID cookie
 */
export async function getAccessTokenFromDB(): Promise<string | null> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
        return null;
    }

    try {
        const supabase = await createClient();
        const { data: session } = await supabase
            .from("sessions")
            .select("token, expires_at")
            .eq("id", sessionId)
            .single();

        if (!session) {
            return null;
        }

        // Check if session is expired
        if (session.expires_at && new Date(session.expires_at) < new Date()) {
            // Clean up expired session
            await supabase.from("sessions").delete().eq("id", sessionId);
            return null;
        }

        // Verify token is still valid
        try {
            verifyToken(session.token);
            return session.token;
        } catch {
            // Token invalid, clean up
            await supabase.from("sessions").delete().eq("id", sessionId);
            return null;
        }
    } catch {
        return null;
    }
}

/**
 * Get refresh token from database using user ID
 */
export async function getRefreshTokenFromDB(
    userId: number
): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: user } = await supabase
            .from("users")
            .select("refresh_token, refresh_token_expires_at")
            .eq("id", userId)
            .single();

        if (!user || !user.refresh_token) {
            return null;
        }

        // Check if refresh token is expired
        if (
            user.refresh_token_expires_at &&
            new Date(user.refresh_token_expires_at) < new Date()
        ) {
            return null;
        }

        return user.refresh_token;
    } catch {
        return null;
    }
}

/**
 * Get user ID from access token (fetched from DB)
 */
export async function getUserIdFromDBToken(): Promise<number | null> {
    const token = await getAccessTokenFromDB();
    if (!token) {
        return null;
    }

    try {
        const payload = verifyToken<{
            sub: string | number;
            username: string;
            type: "access" | "refresh";
        }>(token);

        if (payload.type !== "access") {
            return null;
        }

        return Number(payload.sub);
    } catch {
        return null;
    }
}

/**
 * Find user ID by refresh token from database
 * Used when we need to refresh but don't have an active session
 */
export async function getUserIdFromRefreshTokenInDB(): Promise<number | null> {
    try {
        const supabase = await createClient();
        const { data: users } = await supabase
            .from("users")
            .select("id, refresh_token, refresh_token_expires_at")
            .not("refresh_token", "is", null);

        if (!users || users.length === 0) {
            return null;
        }

        // Find user with valid, non-expired refresh token
        for (const user of users) {
            if (
                user.refresh_token &&
                (!user.refresh_token_expires_at ||
                    new Date(user.refresh_token_expires_at) >= new Date())
            ) {
                try {
                    const { decodeToken } = await import("./jwt");
                    const payload = decodeToken<{
                        sub?: string | number;
                        type?: "access" | "refresh";
                    }>(user.refresh_token);

                    if (payload?.type === "refresh" && payload?.sub) {
                        // Verify the user ID matches
                        if (Number(payload.sub) === user.id) {
                            return user.id;
                        }
                    }
                } catch {
                    // Invalid token, skip
                    continue;
                }
            }
        }

        return null;
    } catch {
        return null;
    }
}
