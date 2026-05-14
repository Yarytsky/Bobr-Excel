import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as bcrypt from "bcrypt";

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

        const { error } = await supabase
            .from("users")
            .insert({
                username,
                password: hashedPassword,
                salt: salt,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating user:", error);
            return NextResponse.json(
                { error: "Failed to create user" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                message: "Registration successful!",
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred during registration" },
            { status: 500 }
        );
    }
}
