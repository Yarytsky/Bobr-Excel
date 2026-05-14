import { NextResponse } from "next/server";
import {
    verifyToken,
    signAccessToken,
    signRefreshToken,
    decodeToken,
} from "@/lib/auth/jwt";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { createClient } from "@/lib/supabase/server";
import {
    getAccessTokenFromDB,
    getRefreshTokenFromDB,
    getUserIdFromRefreshTokenInDB,
} from "@/lib/auth/db-tokens";

export async function POST(request: Request) {
    const supabase = await createClient();

    let userId: number | null = null;

    // Try to get user ID from cookie first (most efficient)
    const cookieStore = await (await import("next/headers")).cookies();
    const userIdCookie = cookieStore.get("user_id")?.value;
    if (userIdCookie) {
        userId = Number(userIdCookie);
        if (!Number.isFinite(userId)) {
            userId = null;
        }
    }

    // If no user_id cookie, try to get from access token (if session exists)
    if (!userId) {
        const currentAccessToken = await getAccessTokenFromDB();
        if (currentAccessToken) {
            try {
                const payload = verifyToken<{
                    sub: string | number;
                    username: string;
                    type: "access" | "refresh";
                }>(currentAccessToken);
                userId = Number(payload.sub);
            } catch {
                // Access token invalid, continue to try refresh token approach
            }
        }
    }

    // If still no user ID, try to find user from refresh tokens in DB
    // This handles the case where session expired but refresh token is still valid
    if (!userId) {
        userId = await getUserIdFromRefreshTokenInDB();
    }

    // If still no user ID, we can't proceed
    if (!userId) {
        const res = NextResponse.json(
            { error: "No active session or valid refresh token" },
            { status: 401 }
        );
        clearSessionCookie(res);
        return res;
    }

    try {
        // Get refresh token from database
        const refreshToken = await getRefreshTokenFromDB(userId);
        if (!refreshToken) {
            console.error("[refresh] no refresh token found for user", userId);
            const res = NextResponse.json(
                { error: "No refresh token" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        // Decode token first to check expiration without verification
        const decodedToken = decodeToken<{
            sub?: string | number;
            username?: string;
            type?: "access" | "refresh";
            exp?: number;
        }>(refreshToken);

        if (!decodedToken) {
            console.error("[refresh] failed to decode token", { userId });
            const res = NextResponse.json(
                { error: "Invalid refresh token: cannot decode" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        // Check if token is expired (JWT exp claim)
        if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
            console.error("[refresh] token expired (JWT exp)", {
                userId,
                exp: new Date(decodedToken.exp * 1000),
                now: new Date(),
            });
            const res = NextResponse.json(
                { error: "Refresh token expired" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        // Verify refresh token signature and structure
        let refreshPayload;
        try {
            refreshPayload = verifyToken<{
                sub: string | number;
                username: string;
                type: "access" | "refresh";
            }>(refreshToken);
        } catch (verifyError) {
            console.error("[refresh] token verification failed", {
                userId,
                error: verifyError,
                errorMessage:
                    verifyError instanceof Error
                        ? verifyError.message
                        : String(verifyError),
                tokenPreview: refreshToken.substring(0, 20) + "...",
            });
            const res = NextResponse.json(
                { error: "Invalid refresh token: verification failed" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        if (refreshPayload.type !== "refresh") {
            const res = NextResponse.json(
                { error: "Invalid token type" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        // Check token matches DB and not expired
        const { data: user } = await supabase
            .from("users")
            .select("id, username, refresh_token, refresh_token_expires_at")
            .eq("id", userId)
            .single();

        if (
            !user ||
            user.refresh_token !== refreshToken ||
            (user.refresh_token_expires_at &&
                new Date(user.refresh_token_expires_at) < new Date())
        ) {
            const res = NextResponse.json(
                { error: "Refresh token invalid" },
                { status: 401 }
            );
            clearSessionCookie(res);
            return res;
        }

        // Generate new tokens
        const newAccess = signAccessToken({
            sub: String(user.id),
            username: user.username,
        });
        const newRefresh = signRefreshToken({
            sub: String(user.id),
            username: user.username,
        });

        // Update refresh token in users table
        // Use the same calculation as sign_in for consistency
        const refreshDays = parseInt(
            process.env.REFRESH_TOKEN_TTL_DAYS || "30",
            10
        );
        const refreshExpiresAt = new Date(
            Date.now() + refreshDays * 24 * 60 * 60 * 1000
        );
        await supabase
            .from("users")
            .update({
                refresh_token: newRefresh,
                refresh_token_expires_at: refreshExpiresAt.toISOString(),
            })
            .eq("id", user.id);

        // Get current session ID to update it, or create new one
        const sessionId = cookieStore.get("session_id")?.value;
        const decoded = decodeToken<{ exp?: number }>(newAccess);
        const expiresAtIso = decoded?.exp
            ? new Date(decoded.exp * 1000).toISOString()
            : new Date(Date.now() + 15 * 60 * 1000).toISOString();

        let finalSessionId = sessionId;

        if (sessionId) {
            // Try to update existing session with new access token
            const { data: updatedSession, error: updateError } = await supabase
                .from("sessions")
                .update({
                    token: newAccess,
                    expires_at: expiresAtIso,
                })
                .eq("id", Number(sessionId))
                .select("id")
                .maybeSingle();

            if (updateError || !updatedSession) {
                console.warn(
                    "[refresh] failed to update session, creating new one",
                    {
                        sessionId,
                        error: updateError,
                    }
                );
                // If update failed (session doesn't exist), create a new session
                const { data: newSession, error: sessionError } = await supabase
                    .from("sessions")
                    .insert({
                        user_id: user.id,
                        token: newAccess,
                        expires_at: expiresAtIso,
                    })
                    .select("id")
                    .single();

                if (sessionError) {
                    console.error("[refresh] failed to create new session", {
                        error: sessionError,
                    });
                } else if (newSession) {
                    finalSessionId = String(newSession.id);
                    console.log(
                        "[refresh] created new session after update failed",
                        {
                            oldSessionId: sessionId,
                            newSessionId: finalSessionId,
                        }
                    );
                }
            } else {
                console.log("[refresh] updated existing session", {
                    sessionId,
                });
                // Session updated successfully, keep the same session ID
            }
        } else {
            // Create new session if one doesn't exist
            const { data: newSession, error: sessionError } = await supabase
                .from("sessions")
                .insert({
                    user_id: user.id,
                    token: newAccess,
                    expires_at: expiresAtIso,
                })
                .select("id")
                .single();

            if (sessionError) {
                console.error("[refresh] failed to create session", {
                    error: sessionError,
                });
            } else if (newSession) {
                finalSessionId = String(newSession.id);
                console.log("[refresh] created new session", {
                    sessionId: finalSessionId,
                });
            }
        }

        const res = NextResponse.json({ ok: true });

        // Always set session_id cookie to ensure it's available and up-to-date
        if (finalSessionId) {
            res.cookies.set("session_id", finalSessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            console.log("[refresh] set session_id cookie", {
                sessionId: finalSessionId,
                wasExisting: !!sessionId,
            });
        } else {
            console.error(
                "[refresh] CRITICAL: no session ID to set in cookie - session creation failed"
            );
        }

        // Always set user_id cookie to ensure it's available
        res.cookies.set("user_id", String(user.id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        console.log("[refresh] set user_id cookie", { userId: user.id });

        return res;
    } catch (e) {
        console.error("[refresh] unexpected error", {
            userId,
            error: e,
            message: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
        });
        const res = NextResponse.json(
            {
                error: "Invalid refresh token",
                details: e instanceof Error ? e.message : String(e),
            },
            { status: 401 }
        );
        clearSessionCookie(res);
        return res;
    }
}
