"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { getDashboard } from "@/services/document-service";
import { DashboardData } from "@/types";

export default function ProgressPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProgress() {
      try {
        await getCurrentUser();
        const data = await getDashboard();
        setDashboard(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load study progress.");
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, [router]);

  function formatTimestamp(tsStr: string): string {
    try {
      const date = new Date(tsStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return tsStr;
    }
  }

  function getActivityIcon(type: string): string {
    switch (type) {
      case "upload":
        return "📄";
      case "chat":
        return "💬";
      case "quiz_gen":
        return "⚡";
      case "quiz_attempt":
        return "🎯";
      case "flashcard":
        return "🎴";
      default:
        return "📌";
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Loading progress analytics...</p>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl bg-red-950/80 p-5 text-sm font-medium text-red-200 border border-red-800 shadow-md">
          {error ?? "Failed to load study progress."}
        </div>
      </main>
    );
  }

  const { stats, recent_activity, recent_documents } = dashboard;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white">📊 Study Progress & Analytics</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Track your overall quiz mastery, document engagement, and study timeline.
        </p>
      </header>

      {/* Quiz Performance Mastery Card */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🎯 Quiz Performance Mastery
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Based on {stats.quizzes_completed} completed quiz attempt(s)
            </p>
          </div>
          <div className="flex items-baseline gap-1 text-3xl font-black text-amber-400">
            {stats.average_quiz_score}
            <span className="text-base text-slate-400">%</span>
          </div>
        </div>

        {/* CSS Progress Bar */}
        <div className="w-full rounded-full bg-slate-950 h-3 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, stats.average_quiz_score))}%` }}
          />
        </div>
      </section>

      {/* Study Activity Grid */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Full Activity Timeline */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            ⏱️ Study Activity Timeline
          </h2>

          {recent_activity.length === 0 && (
            <p className="text-xs text-slate-400 py-8 text-center">No study activity recorded yet.</p>
          )}

          <div className="space-y-3">
            {recent_activity.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950 p-3.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm">
                  {getActivityIcon(act.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white leading-tight">{act.title}</h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTimestamp(act.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 truncate">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Document Study Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            📚 Documents Summary
          </h2>

          {recent_documents.length === 0 && (
            <p className="text-xs text-slate-400 py-8 text-center">No documents uploaded yet.</p>
          )}

          <div className="space-y-3">
            {recent_documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 shadow-sm hover:border-indigo-500 hover:bg-slate-900 transition-all"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {doc.title}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-400 font-mono">{doc.original_filename}</p>
                </div>
                <span className="rounded-md bg-indigo-950 px-2 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-800/60">
                  Open &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
