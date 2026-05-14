"use client";

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import TableManager from "@/components/tables/TableManager";

export default function ProtectedPage() {
    const { user, logout, isLoggedIn, loading } = useAuth();
    const router = useRouter();

    // All hooks must be called before any conditional returns
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            router.replace("/auth/login");
        }
    }, [isLoggedIn, loading, router]);

    const handleLogout = () => {
        logout();
        router.push("/");
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="rounded-3xl bg-white/95 border border-slate-200 p-8 shadow-xl">
                    <p className="text-center text-slate-700">Loading...</p>
                </div>
            </main>
        );
    }

    if (!isLoggedIn) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="rounded-3xl bg-white/95 border border-slate-200 p-8 shadow-xl text-center">
                    <h1 className="text-2xl font-semibold mb-2 text-slate-900">
                        Access Denied
                    </h1>
                    <p className="text-slate-600 mb-4">
                        You need to be logged in to view this page.
                    </p>
                    <a
                        href="/auth/login"
                        className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700"
                    >
                        Go to Login
                    </a>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="rounded-[2rem] bg-white/95 border border-slate-200 p-6 shadow-2xl">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-[0.3em] text-violet-500">Dashboard</p>
                            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                                Welcome, {user?.username}
                            </h1>
                            <p className="mt-2 text-sm text-slate-500">
                                Your spreadsheets are ready. Create a new table or continue editing existing ones.
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/10 transition hover:bg-rose-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
                <div className="rounded-[2rem] bg-white/95 border border-slate-200 p-6 shadow-2xl">
                    <TableManager />
                </div>
            </div>
        </main>
    );
}
