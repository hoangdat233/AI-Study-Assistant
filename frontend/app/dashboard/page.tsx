"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, removeToken } from "@/services/auth-service";
import { User } from "@/types";

interface DashboardCard {
  title: string;
  description: string;
  href: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  active: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        removeToken();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  function handleSignOut() {
    removeToken();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Verifying session...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const dashboardCards: DashboardCard[] = [
    {
      title: "My Documents",
      description: "Upload, view, and manage your PDF study materials.",
      href: "/documents",
      icon: "📁",
      badge: "Active",
      badgeColor: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
      active: true,
    },
    {
      title: "Upload PDF",
      description: "Add new lecture notes, textbooks, or research papers.",
      href: "/upload",
      icon: "📤",
      badge: "Active",
      badgeColor: "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
      active: true,
    },
    {
      title: "AI Document Chat",
      description: "Ask questions and get grounded answers with page citations.",
      href: "/documents",
      icon: "💬",
      badge: "Phase 5 Active",
      badgeColor: "bg-purple-900/60 text-purple-300 border-purple-700/50",
      active: true,
    },
    {
      title: "AI Document Summary",
      description: "Generate structured study overviews and key takeaways.",
      href: "/documents",
      icon: "⚡",
      badge: "Phase 4 Active",
      badgeColor: "bg-amber-900/60 text-amber-300 border-amber-700/50",
      active: true,
    },
    {
      title: "Quizzes",
      description: "Generate multiple-choice practice tests from your PDFs.",
      href: "/quiz",
      icon: "📝",
      badge: "Phase 6",
      badgeColor: "bg-slate-800 text-slate-400 border-slate-700",
      active: false,
    },
    {
      title: "Flashcards",
      description: "Review key terminology and spaced-repetition cards.",
      href: "/flashcards",
      icon: "🎴",
      badge: "Phase 6",
      badgeColor: "bg-slate-800 text-slate-400 border-slate-700",
      active: false,
    },
    {
      title: "Study Progress",
      description: "Track your study time, quiz scores, and mastery metrics.",
      href: "/progress",
      icon: "📊",
      badge: "Phase 6",
      badgeColor: "bg-slate-800 text-slate-400 border-slate-700",
      active: false,
    },
    {
      title: "Settings",
      description: "Configure user preferences, security, and LLM providers.",
      href: "/settings",
      icon: "⚙️",
      badge: "Settings",
      badgeColor: "bg-slate-800 text-slate-400 border-slate-700",
      active: true,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Top Welcome Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Welcome back, {user.full_name}!
          </h1>
          <p className="mt-1 text-sm text-slate-400 font-mono">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-all hover:scale-105"
          >
            + Upload PDF
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Grid Section */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white tracking-wide">AI Study Hub</h2>
          <span className="text-xs text-slate-400 font-medium">Click any card to launch feature</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`group flex flex-col justify-between rounded-xl border bg-slate-800/90 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-indigo-500/10 ${
                card.active
                  ? "border-slate-700/80 hover:border-indigo-500 hover:bg-slate-800"
                  : "border-slate-800 opacity-80 hover:border-slate-600"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{card.icon}</span>
                  {card.badge && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${card.badgeColor}`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-5 flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1.5 transition-transform">
                Open Feature &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
