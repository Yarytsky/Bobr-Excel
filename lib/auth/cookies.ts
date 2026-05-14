import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

/**
 * Set session ID cookie (DB-only token approach)
 * Tokens are stored in database, only session ID is in cookie
 */
export function setSessionCookie(
    response: NextResponse,
    sessionId: string,
    userId?: number
) {
    response.cookies.set("session_id", sessionId, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        // Session expires when browser closes if maxAge not set
    });

    // Also store user_id for refresh token lookup
    if (userId !== undefined) {
        response.cookies.set("user_id", String(userId), {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
        });
    }
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(response: NextResponse) {
    response.cookies.set("session_id", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
    });
    response.cookies.set("user_id", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
    });
}

// Legacy functions for backward compatibility (if you want to keep both approaches)
export function setAuthCookies(
    response: NextResponse,
    accessToken: string,
    refreshToken: string
) {
    response.cookies.set("access_token", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
    });
    response.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
    });
}

export function clearAuthCookies(response: NextResponse) {
    response.cookies.set("access_token", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
    });
    response.cookies.set("refresh_token", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
    });
}
