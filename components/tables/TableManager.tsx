"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TableRow = {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
};

export default function TableManager() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [name, setName] = useState<string>("");

  const loadTables = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tables", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load tables");
      setTables(data.tables || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const createTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create table");
      setName("");
      setTables((prev) => [data.table, ...prev]);
      // Redirect to newly created table page
      router.push(`/table/${data.table.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create table");
    } finally {
      setLoading(false);
    }
  };

  const deleteTable = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete table");
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e?.message || "Failed to delete table");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 rounded-[1.75rem] bg-slate-950/5 border border-slate-200 p-6 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Your tables</h2>
            <p className="mt-2 text-sm text-slate-500">
              Create and manage your sheets from one place.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-sm">
            <span className="text-sm text-slate-600">{tables.length} tables</span>
            {loading && <span className="text-sm text-slate-500">Updating…</span>}
          </div>
        </div>
      </div>
      <form onSubmit={createTable} className="mb-6 rounded-[1.5rem] bg-white border border-slate-200 p-5 shadow-lg shadow-slate-200/60">
        <div className="flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New table name"
            className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create table
          </button>
        </div>
      </form>
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-lg shadow-slate-200/50">
        {loading ? (
          <p className="text-slate-600">Loading your tables…</p>
        ) : tables.length === 0 ? (
          <p className="text-slate-600">No tables yet. Create your first one.</p>
        ) : (
          <ul className="space-y-3">
            {tables.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
              >
                <button
                  onClick={() => router.push(`/table/${t.id}`)}
                  className="text-left flex-1 text-sm font-medium text-slate-900 hover:text-slate-700"
                >
                  {t.name}
                </button>
                <button
                  onClick={() => deleteTable(t.id)}
                  className="ml-4 rounded-full px-3 py-1 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
