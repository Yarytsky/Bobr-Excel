import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, decodeToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookies";

type SignInData = {
    username: string;
    password: string;
};

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const contentType = request.headers.get("content-type") || "";
        let username: string | undefined;
        let password: string | undefined;

        if (contentType.includes("application/json")) {
            const body: SignInData = await request.json();
            username = body.username;
            password = body.password;
        } else {
            const formData = await request.formData();
            username = String(formData.get("username") || "");
            password = String(formData.get("password") || "");
        }

        if (!username || !password) {
            return NextResponse.json(
                { error: "Username and password are required" },
                { status: 400 }
            );
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password, salt")
            .eq("username", username)
            .single();

        if (error || !user) {
            console.error("[signin] user_not_found", { username });
            return NextResponse.json(
                { error: "User not found" },
                { status: 401 }
            );
        }

        const passwordWithPepper = password + process.env.PEPPER;
        const isPasswordValid = await bcrypt.compare(
            passwordWithPepper + user.salt,
            user.password
        );

        if (!isPasswordValid) {
            console.error("[signin] invalid_password", { username });
            return NextResponse.json(
                { error: "Credentials are incorrect" },
                { status: 401 }
            );
        }
        console.log("[signin] issuing_tokens", {
            hasAccessSecret: !!process.env.JWT_ACCESS_SECRET,
            accessTTL: process.env.ACCESS_TOKEN_EXPIRES_IN,
            refreshTTL: process.env.REFRESH_TOKEN_EXPIRES_IN,
        });
        const accessToken = signAccessToken({
            sub: String(user.id),
            username: user.username,
        });

        // Persist the issued access token in the sessions table and get session ID
        let sessionId: number | null = null;
        try {
            const decoded = decodeToken<{ exp?: number }>(accessToken);
            const expiresAtIso = decoded?.exp
                ? new Date(decoded.exp * 1000).toISOString()
                : new Date(Date.now() + 15 * 60 * 1000).toISOString();
            const { data: session, error: sessionErr } = await supabase
                .from("sessions")
                .insert({
                    user_id: user.id,
                    token: accessToken,
                    expires_at: expiresAtIso,
                })
                .select("id")
                .single();

            if (sessionErr || !session) {
                console.error("[signin] session_insert_failed", sessionErr);
                return NextResponse.json(
                    { error: "Failed to create session" },
                    { status: 500 }
                );
            }
            sessionId = session.id;
        } catch (sessionErr) {
            console.error("[signin] session_insert_failed", sessionErr);
            return NextResponse.json(
                { error: "Failed to create session" },
                { status: 500 }
            );
        }
        const refreshToken = signRefreshToken({
            sub: String(user.id),
            username: user.username,
        });

        const refreshDays = parseInt(
            process.env.REFRESH_TOKEN_TTL_DAYS || "30",
            10
        );
        const refreshExpiresAt = new Date(
            Date.now() + refreshDays * 24 * 60 * 60 * 1000
        );
        const { error: updateError } = await supabase
            .from("users")
            .update({
                refresh_token: refreshToken,
                refresh_token_expires_at: refreshExpiresAt.toISOString(),
            })
            .eq("id", user.id);
        if (updateError) {
            console.error("[signin] refresh_update_failed", {
                userId: user.id,
                updateError,
            });
            return NextResponse.json(
                { error: "Failed to update session" },
                { status: 500 }
            );
        }

        console.log("[signin] success", { userId: user.id, sessionId });
        const res = NextResponse.json(
            { message: "Login successful!" },
            { status: 200 }
        );
        // Store session ID and user ID in cookies, tokens are in DB
        setSessionCookie(res, String(sessionId), user.id);
        return res;
    } catch (error) {
        console.error("[signin] unhandled_error", error);
        return NextResponse.json(
            { error: "An unexpected error occurred during login" },
            { status: 500 }
        );
    }
}
