"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, removeToken } from "@/services/auth-service";
import { User } from "@/types";

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
        <p className="text-slate-600">Verifying session...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.full_name}</h1>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Sign Out
        </button>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Documents",
          "AI Chat",
          "Quizzes",
          "Flashcards",
          "Study Progress",
          "History",
          "Settings",
          "Upcoming RAG Insights",
        ].map((item) => (
          <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-medium">{item}</h2>
            <p className="mt-2 text-sm text-slate-600">Scaffolded for iterative implementation.</p>
          </article>
        ))}
      </section>
    </main>
  );
}

