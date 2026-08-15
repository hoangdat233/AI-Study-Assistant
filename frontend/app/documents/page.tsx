"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { deleteDocument, getDocuments } from "@/services/document-service";
import { DocumentItem } from "@/types";

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      try {
        await getCurrentUser();
        const docs = await getDocuments();
        setDocuments(docs);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      } finally {
        setLoading(false);
      }
    }
    loadDocuments();
  }, [router]);

  async function handleDelete(documentId: string, filename: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      setDeletingId(documentId);
      await deleteDocument(documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Loading your study documents...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8 animate-slide-up">
      {/* Top Breadcrumb & Navbar Link */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-indigo-400 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-200">Documents</span>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Header Banner */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            📚 Your Study Documents
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your uploaded PDF materials, view extracted text, and study with AI.
          </p>
        </div>
        <Link
          href="/upload"
          className="self-start rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105 md:self-center cursor-pointer"
        >
          + Upload New PDF
        </Link>
      </header>

      {error && (
        <div className="rounded-xl bg-red-950/80 p-4 text-sm font-medium text-red-200 border border-red-800 shadow-md">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      {documents.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or filename..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
            />
          </div>
          <span className="text-xs font-semibold text-slate-400 self-end sm:self-center">
            Showing <strong className="text-slate-200">{filteredDocs.length}</strong> of{" "}
            <strong className="text-slate-200">{documents.length}</strong> document(s)
          </span>
        </div>
      )}

      {/* Empty State */}
      {!loading && documents.length === 0 && !error && (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 p-12 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950/80 border border-indigo-800/50 text-3xl text-indigo-400 mb-4 shadow-inner">
            📄
          </div>
          <h3 className="text-lg font-bold text-white">No documents uploaded yet</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">
            Upload your first lecture notes, textbook chapters, or academic papers to get started.
          </p>
          <div className="mt-6">
            <Link
              href="/upload"
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105 inline-block"
            >
              + Upload PDF Document
            </Link>
          </div>
        </div>
      )}

      {/* Document Cards Grid */}
      {filteredDocs.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => router.push(`/documents/${doc.id}`)}
              className="glass-panel rounded-3xl p-6 shadow-xl interactive-card border border-slate-800/80 hover:border-indigo-500/50 flex flex-col justify-between cursor-pointer group select-none"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-950 to-slate-900 text-2xl border border-indigo-700/40 shadow-inner group-hover:scale-110 transition-transform">
                    📄
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase border shadow-sm ${
                      doc.processing_status === "INDEXED"
                        ? "bg-purple-950/80 text-purple-300 border-purple-700/60"
                        : doc.processing_status === "COMPLETED"
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-amber-950/80 text-amber-300 border-amber-700/60"
                    }`}
                  >
                    {doc.processing_status}
                  </span>
                </div>

                <h3 className="mt-4 font-bold text-base text-white group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                  {doc.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400 font-mono truncate">{doc.original_filename}</p>
              </div>

              {/* Card Bottom Meta & Actions */}
              <div className="mt-6 border-t border-slate-800/80 pt-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-4 font-medium">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>•</span>
                  <span>{doc.page_count ?? "—"} page(s)</span>
                  <span>•</span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-3.5 py-1.5 text-xs font-bold text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    Open Study Room &rarr;
                  </span>
                  <button
                    onClick={(e) => handleDelete(doc.id, doc.original_filename, e)}
                    disabled={deletingId === doc.id}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/60 hover:text-red-300 transition-all disabled:opacity-40"
                  >
                    {deletingId === doc.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
