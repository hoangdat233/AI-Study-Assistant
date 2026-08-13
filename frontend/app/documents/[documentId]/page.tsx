"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { deleteDocument, getDocument } from "@/services/document-service";
import { DocumentDetailItem } from "@/types";

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<DocumentDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      try {
        await getCurrentUser();
        const doc = await getDocument(documentId);
        setDocument(doc);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load document details.");
      } finally {
        setLoading(false);
      }
    }
    if (documentId) {
      loadDocument();
    }
  }, [documentId, router]);

  async function handleDelete() {
    if (!document) return;
    if (!confirm(`Are you sure you want to delete "${document.original_filename}"?`)) return;

    try {
      await deleteDocument(document.id);
      router.push("/documents");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete document.");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-slate-600">Loading document details...</p>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200">
          {error ?? "Document not found."}
        </div>
        <div className="mt-4">
          <Link href="/documents" className="text-indigo-600 font-medium hover:text-indigo-500">
            &larr; Back to Documents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4">
        <Link href="/documents" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Documents
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{document.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                document.processing_status === "COMPLETED"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {document.processing_status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Original file: <span className="font-mono text-slate-700">{document.original_filename}</span> •{" "}
            {formatFileSize(document.file_size)} • {document.page_count ?? "N/A"} page(s)
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 md:self-center"
        >
          Delete Document
        </button>
      </header>

      {/* Feature Tabs (Extracted Text active; future AI tabs prepared & disabled) */}
      <nav className="mt-6 flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button className="border-b-2 border-indigo-600 pb-3 text-indigo-600">Extracted Text</button>
        <button disabled className="pb-3 text-slate-400 cursor-not-allowed" title="Coming in Phase 4">
          AI Summary (Phase 4)
        </button>
        <button disabled className="pb-3 text-slate-400 cursor-not-allowed" title="Coming in Phase 5">
          AI Chat (Phase 5)
        </button>
        <button disabled className="pb-3 text-slate-400 cursor-not-allowed" title="Coming in Phase 6">
          Quizzes & Flashcards (Phase 6)
        </button>
      </nav>

      {/* Extracted Text Content Box */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Extracted Content Preview</h2>
        <div className="max-h-[600px] overflow-y-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200">
          {document.extracted_text || "No text could be extracted from this document."}
        </div>
      </section>
    </main>
  );
}

