import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, decodeToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookies";

type SignUpData = {
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
            const body: SignUpData = await request.json();
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

        const { data: existingUser } = await supabase
            .from("users")
            .select("username")
            .eq("username", username)
            .single();

        if (existingUser) {
            return NextResponse.json(
                { error: "Username already exists" },
                { status: 409 }
            );
        }

        const salt = await bcrypt.genSalt(10);
        const passwordWithPepper = password + process.env.PEPPER;
        const hashedPassword = await bcrypt.hash(passwordWithPepper + salt, 12);

        const { data: newUser, error } = await supabase
            .from("users")
            .insert({
                username,
                password: hashedPassword,
                salt: salt,
                created_at: new Date().toISOString(),
            })
            .select("id, username")
            .single();

        if (error || !newUser) {
            console.error("Error creating user:", error);
            return NextResponse.json(
                { error: "Failed to create user" },
                { status: 500 }
            );
        }

        // Generate tokens and create session (same as sign_in)
        const accessToken = signAccessToken({
            sub: String(newUser.id),
            username: newUser.username,
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
                    user_id: newUser.id,
                    token: accessToken,
                    expires_at: expiresAtIso,
                })
                .select("id")
                .single();

            if (sessionErr || !session) {
                console.error("[signup] session_insert_failed", sessionErr);
                return NextResponse.json(
                    { error: "Failed to create session" },
                    { status: 500 }
                );
            }
            sessionId = session.id;
        } catch (sessionErr) {
            console.error("[signup] session_insert_failed", sessionErr);
            return NextResponse.json(
                { error: "Failed to create session" },
                { status: 500 }
            );
        }

        const refreshToken = signRefreshToken({
            sub: String(newUser.id),
            username: newUser.username,
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
            .eq("id", newUser.id);
        if (updateError) {
            console.error("[signup] refresh_update_failed", {
                userId: newUser.id,
                updateError,
            });
            return NextResponse.json(
                { error: "Failed to update session" },
                { status: 500 }
            );
        }

        console.log("[signup] success", { userId: newUser.id, sessionId });
        const res = NextResponse.json(
            { message: "Registration successful!" },
            { status: 201 }
        );
        // Store session ID and user ID in cookies, tokens are in DB
        setSessionCookie(res, String(sessionId), newUser.id);
        return res;
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred during registration" },
            { status: 500 }
        );
    }
}
