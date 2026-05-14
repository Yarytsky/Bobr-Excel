"use client";

import { useAuth } from "@/lib/auth/context";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
    const { login, isLoggedIn, loading } = useAuth();
    const router = useRouter();
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && isLoggedIn) {
            router.replace("/protected");
        }
    }, [isLoggedIn, loading, router]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;

        try {
            const response = await fetch("/api/users/auth/sign_up", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                login(username);
                router.push("/protected");
            } else {
                setError(data.error || "Sign up failed");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-[2rem] bg-white/95 border border-slate-200 shadow-2xl p-8 backdrop-blur-sm">
                <div className="mb-6 text-center">
                    <p className="text-sm uppercase tracking-[0.4em] text-violet-500">
                        Bobr Exel
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                        Create your account
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Start building and editing spreadsheets instantly.
                    </p>
                </div>
                {error && (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium text-slate-700">
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            placeholder="Choose a username"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-slate-700">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            placeholder="Create a secure password"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || isSubmitting}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? "Creating account..." : "Create account"}
                    </button>
                </form>
                <p className="mt-5 text-center text-sm text-slate-500">
                    Already have an account?{' '}
                    <a
                        className="font-medium text-violet-600 hover:text-violet-700"
                        href="/auth/login"
                    >
                        Sign in
                    </a>
                </p>
            </div>
        </main>
    );
}
