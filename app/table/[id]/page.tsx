"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Spreadsheet from "@/components/tables/Spreadsheet";
import { useAuth } from "@/lib/auth/context";

interface Table {
  id: number;
  name: string;
}

export default function TablePage() {
  const params = useParams();
  const id = (params as any).id as string;
  const tableId = Number(id);
  const router = useRouter();
  const { loading: authLoading, isLoggedIn } = useAuth();
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!isLoggedIn && !authLoading) router.replace("/auth/login");
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    if (!Number.isFinite(tableId)) return;
    const fetchTable = async () => {
      try {
        const res = await fetch(`/api/tables/${tableId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load table");
        setTable(data.table);
      } catch (e: any) {
        setError(e?.message || "Failed to load table");
      } finally {
        setLoading(false);
      }
    };
    fetchTable();
  }, [tableId]);

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white/95 border border-slate-200 p-8 shadow-xl">
          <p className="text-slate-700">Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !table) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white/95 border border-slate-200 p-8 shadow-xl text-center">
          <p className="text-red-600 mb-3">{error || "Not found"}</p>
          <button
            onClick={() => router.back()}
            className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700"
          >
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[2rem] bg-white/95 border border-slate-200 p-6 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-violet-500">Spreadsheet</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{table.name}</h1>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Back to dashboard
            </button>
          </div>
        </div>
        <div className="rounded-[2rem] bg-white/95 border border-slate-200 p-4 shadow-2xl">
          <Spreadsheet tableId={table.id} />
        </div>
      </div>
    </main>
  );
}
