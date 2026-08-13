"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { getDashboard } from "@/services/document-service";
import { DashboardData, User } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const u = await getCurrentUser();
        setUser(u);
        const data = await getDashboard();
        setDashboard(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
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
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Loading student study analytics...</p>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl bg-red-950/80 p-5 text-sm font-medium text-red-200 border border-red-800 shadow-md">
          {error ?? "Failed to load dashboard statistics."}
        </div>
      </main>
    );
  }

  const { stats, recent_documents, recent_activity } = dashboard;
  const isNewUser = stats.documents === 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      {/* Header Banner */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Welcome back, {user?.full_name ?? "Student"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track your AI document study progress, quiz scores, and flashcard practice.
          </p>
        </div>
        <Link
          href="/upload"
          className="self-start rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105 md:self-center"
        >
          + Upload New Document
        </Link>
      </header>

      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Documents */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Documents</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 text-lg border border-indigo-800/50">
              📄
            </span>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{stats.documents}</div>
          <p className="mt-1 text-xs text-slate-400">PDF study materials</p>
        </div>

        {/* AI Questions Asked */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">AI Chats</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-950 text-purple-400 text-lg border border-purple-800/50">
              💬
            </span>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{stats.questions_asked}</div>
          <p className="mt-1 text-xs text-slate-400">RAG questions answered</p>
        </div>

        {/* Quizzes Completed */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Quizzes</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 text-lg border border-emerald-800/50">
              📝
            </span>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{stats.quizzes_completed}</div>
          <p className="mt-1 text-xs text-slate-400">Attempts completed</p>
        </div>

        {/* Average Quiz Score */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Avg Score</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950 text-amber-400 text-lg border border-amber-800/50">
              🎯
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1 text-3xl font-black text-white">
            {stats.average_quiz_score}
            <span className="text-lg text-amber-400">%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Overall quiz mastery</p>
        </div>

        {/* Total Flashcards */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Flashcards</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-950 text-pink-400 text-lg border border-pink-800/50">
              🎴
            </span>
          </div>
          <div className="mt-3 text-3xl font-black text-white">{stats.flashcards}</div>
          <p className="mt-1 text-xs text-slate-400">Active study cards</p>
        </div>
      </section>

      {/* Empty State CTA for New Users */}
      {isNewUser && (
        <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/90 p-12 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-950 border border-indigo-800 text-3xl text-indigo-400 mb-4">
            📚
          </div>
          <h2 className="text-xl font-extrabold text-white">Start Your AI Study Journey</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Upload your first lecture PDF or textbook chapter to instantly generate AI document summaries, practice quizzes, and interactive flashcards.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 transition-all hover:scale-105"
          >
            + Upload PDF Document
          </Link>
        </section>
      )}

      {/* Recent Documents & Recent Activity Split */}
      {!isNewUser && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Recent Documents */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                📄 Recent Documents
              </h2>
              <Link href="/documents" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {recent_documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm hover:border-indigo-500 hover:bg-slate-900 transition-all"
                >
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {doc.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400 font-mono">{doc.original_filename}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      doc.processing_status === "INDEXED"
                        ? "bg-purple-900/60 text-purple-300 border-purple-700/50"
                        : "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
                    }`}
                  >
                    {doc.processing_status}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activity Timeline */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ⚡ Recent Study Activity
              </h2>
              <Link href="/progress" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                Full Progress &rarr;
              </Link>
            </div>

            {recent_activity.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">No study activity recorded yet.</p>
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
          </section>
        </div>
      )}
    </main>
  );
}
