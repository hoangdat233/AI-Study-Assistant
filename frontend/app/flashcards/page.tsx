"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getDocuments } from "@/services/document-service";
import { DocumentItem } from "@/types";

export default function FlashcardsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await getDocuments();
        setDocuments(docs);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white">🎴 AI Flashcards</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Select any of your uploaded PDF documents below to study or generate interactive flashcards.
        </p>
      </header>

      <section className="mt-8">
        {loading && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span className="text-sm">Loading your documents...</span>
          </div>
        )}

        {!loading && documents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/90 p-10 text-center">
            <p className="text-base font-semibold text-white">No documents uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Upload a PDF document first to generate AI flashcard study sets.
            </p>
            <Link
              href="/upload"
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-purple-500"
            >
              + Upload PDF Document
            </Link>
          </div>
        )}

        {!loading && documents.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg hover:border-purple-500 hover:bg-slate-900 transition-all"
              >
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">
                    {doc.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 font-mono">{doc.original_filename}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-purple-400">
                  <span>Open Flashcards</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
